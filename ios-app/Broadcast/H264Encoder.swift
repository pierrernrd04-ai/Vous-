import Foundation
import CoreMedia
import CoreVideo
import VideoToolbox

/// Encodeur H.264 matériel produisant un flux Annex B.
/// Toutes les méthodes doivent être appelées sur `queue` ; les sorties y sont aussi livrées.
final class H264Encoder {
    /// (image Annex B, SPS+PPS Annex B si image clé sinon nil)
    var onFrame: ((Data, Data?) -> Void)?

    private let queue: DispatchQueue
    private var session: VTCompressionSession?
    private var width = 0
    private var height = 0
    private var forceKeyFrame = false
    private var lastPixelBuffer: CVPixelBuffer?
    private(set) var lastEncodeTime: Double = 0

    private let minInterval = 1.0 / 30.0
    private static let startCode: [UInt8] = [0, 0, 0, 1]

    init(queue: DispatchQueue) {
        self.queue = queue
    }

    func requestKeyFrame() {
        forceKeyFrame = true
    }

    /// Garde la dernière image pour pouvoir la réencoder (écran immobile, nouveau client).
    func remember(_ pixelBuffer: CVPixelBuffer) {
        lastPixelBuffer = pixelBuffer
    }

    func encodeLast() {
        if let pixelBuffer = lastPixelBuffer {
            encode(pixelBuffer, throttled: false)
        }
    }

    func encode(_ pixelBuffer: CVPixelBuffer, throttled: Bool = true) {
        let now = CMClockGetTime(CMClockGetHostTimeClock())
        let seconds = CMTimeGetSeconds(now)
        // Limite à 30 i/s (petite tolérance pour la gigue de ReplayKit).
        if throttled && seconds - lastEncodeTime < minInterval - 0.004 { return }

        let w = CVPixelBufferGetWidth(pixelBuffer)
        let h = CVPixelBufferGetHeight(pixelBuffer)
        if session == nil || w != width || h != height {
            invalidateSession()
            guard makeSession(width: w, height: h) else { return }
        }
        guard let session = session else { return }

        var properties: CFDictionary?
        if forceKeyFrame {
            properties = [kVTEncodeFrameOptionKey_ForceKeyFrame as String: true] as CFDictionary
        }

        let status = VTCompressionSessionEncodeFrame(
            session,
            imageBuffer: pixelBuffer,
            presentationTimeStamp: now,
            duration: CMTime.invalid,
            frameProperties: properties,
            infoFlagsOut: nil
        ) { [weak self] status, _, sampleBuffer in
            guard status == noErr, let sampleBuffer = sampleBuffer, let encoder = self else { return }
            encoder.queue.async { [weak encoder] in
                encoder?.handle(sampleBuffer)
            }
        }

        if status == noErr {
            lastEncodeTime = seconds
            forceKeyFrame = false
        } else {
            // Session invalide (ex. après une interruption) : on la recrée à la prochaine image.
            invalidateSession()
        }
    }

    func invalidate() {
        invalidateSession()
        lastPixelBuffer = nil
        onFrame = nil
    }

    // MARK: - Session

    private func makeSession(width: Int, height: Int) -> Bool {
        var newSession: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: kCFAllocatorDefault,
            width: Int32(width),
            height: Int32(height),
            codecType: kCMVideoCodecType_H264,
            encoderSpecification: nil,
            imageBufferAttributes: nil,
            compressedDataAllocator: nil,
            outputCallback: nil,
            refcon: nil,
            compressionSessionOut: &newSession
        )
        guard status == noErr, let s = newSession else { return false }

        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_RealTime, value: kCFBooleanTrue)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_ProfileLevel, value: kVTProfileLevel_H264_High_AutoLevel)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_AllowFrameReordering, value: kCFBooleanFalse)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_AverageBitRate, value: NSNumber(value: 6_000_000))
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_DataRateLimits,
                             value: [NSNumber(value: 1_500_000), NSNumber(value: 1)] as CFArray)
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_MaxKeyFrameInterval, value: NSNumber(value: 60))
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration, value: NSNumber(value: 2))
        VTSessionSetProperty(s, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: NSNumber(value: 30))
        VTCompressionSessionPrepareToEncodeFrames(s)

        session = s
        self.width = width
        self.height = height
        forceKeyFrame = true
        return true
    }

    private func invalidateSession() {
        if let s = session {
            VTCompressionSessionInvalidate(s)
        }
        session = nil
    }

    // MARK: - Sortie AVCC -> Annex B

    private func handle(_ sampleBuffer: CMSampleBuffer) {
        guard let onFrame = onFrame,
              CMSampleBufferDataIsReady(sampleBuffer),
              let block = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }

        var isKeyFrame = true
        if let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[String: Any]],
           let first = attachments.first,
           let notSync = first[kCMSampleAttachmentKey_NotSync as String] as? Bool {
            isKeyFrame = !notSync
        }

        var headerLength: Int32 = 4
        var parameterSets: Data?
        if let format = CMSampleBufferGetFormatDescription(sampleBuffer) {
            var count = 0
            if CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
                format, parameterSetIndex: 0, parameterSetPointerOut: nil, parameterSetSizeOut: nil,
                parameterSetCountOut: &count, nalUnitHeaderLengthOut: &headerLength) != noErr {
                headerLength = 4
            }
            if isKeyFrame {
                var sets = Data()
                for index in 0..<count {
                    var pointer: UnsafePointer<UInt8>?
                    var size = 0
                    if CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
                        format, parameterSetIndex: index, parameterSetPointerOut: &pointer,
                        parameterSetSizeOut: &size, parameterSetCountOut: nil,
                        nalUnitHeaderLengthOut: nil) == noErr, let pointer = pointer {
                        sets.append(contentsOf: H264Encoder.startCode)
                        sets.append(pointer, count: size)
                    }
                }
                parameterSets = sets.isEmpty ? nil : sets
            }
        }

        let length = CMBlockBufferGetDataLength(block)
        guard length > 0 else { return }
        var bytes = [UInt8](repeating: 0, count: length)
        guard CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: &bytes) == kCMBlockBufferNoErr else { return }

        let prefix = Int(headerLength)
        var frame = Data(capacity: length + 16)
        var offset = 0
        while offset + prefix <= length {
            var nalLength = 0
            for k in 0..<prefix {
                nalLength = (nalLength << 8) | Int(bytes[offset + k])
            }
            offset += prefix
            guard nalLength > 0, offset + nalLength <= length else { break }
            frame.append(contentsOf: H264Encoder.startCode)
            frame.append(contentsOf: bytes[offset..<(offset + nalLength)])
            offset += nalLength
        }
        guard !frame.isEmpty else { return }

        // Une image clé sans SPS/PPS récupérables est traitée comme une image P.
        onFrame(frame, isKeyFrame ? parameterSets : nil)
    }
}

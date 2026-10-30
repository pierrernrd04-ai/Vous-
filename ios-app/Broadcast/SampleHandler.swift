import ReplayKit
import CoreMedia

/// Extension de diffusion : encode l'écran en H.264 et le sert en TCP sur le port 5000.
final class SampleHandler: RPBroadcastSampleHandler {
    private let queue = DispatchQueue(label: "fr.pierre.iphonelive.stream")
    private var server: StreamServer?
    private var encoder: H264Encoder?
    private var heartbeat: DispatchSourceTimer?

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        queue.sync {
            let server = StreamServer(queue: queue)
            let encoder = H264Encoder(queue: queue)

            encoder.onFrame = { [weak server] frame, parameterSets in
                server?.broadcast(frame, parameterSets: parameterSets)
            }
            // Nouveau client : image clé immédiate, même si l'écran ne bouge pas.
            server.onClientConnected = { [weak encoder] in
                encoder?.requestKeyFrame()
                encoder?.encodeLast()
            }
            server.start()

            // ReplayKit n'envoie rien quand l'écran est immobile : on répète la dernière image.
            let timer = DispatchSource.makeTimerSource(queue: queue)
            timer.schedule(deadline: .now() + 0.5, repeating: 0.5)
            timer.setEventHandler { [weak self] in
                guard let self = self, let server = self.server, let encoder = self.encoder,
                      server.hasClients else { return }
                let now = CMTimeGetSeconds(CMClockGetTime(CMClockGetHostTimeClock()))
                if now - encoder.lastEncodeTime > 0.5 { encoder.encodeLast() }
            }
            timer.resume()

            self.server = server
            self.encoder = encoder
            self.heartbeat = timer
        }
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        // Synchrone : pas de file d'attente qui grossit, l'encodage lui-même est asynchrone.
        queue.sync {
            guard let encoder = encoder, let server = server else { return }
            encoder.remember(pixelBuffer)
            if server.hasClients {
                encoder.encode(pixelBuffer)
            }
        }
    }

    override func broadcastFinished() {
        queue.sync {
            heartbeat?.cancel()
            heartbeat = nil
            server?.stop()
            server = nil
            encoder?.invalidate()
            encoder = nil
        }
    }
}

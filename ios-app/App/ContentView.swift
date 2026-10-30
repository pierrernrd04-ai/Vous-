import SwiftUI
import ReplayKit
import Combine

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var addresses: [LocalAddress] = []
    private let refresh = Timer.publish(every: 3, on: .main, in: .common).autoconnect()

    private let steps = [
        "1. Active le Partage de connexion et relie le PC (Wi-Fi ou câble).",
        "2. Touche le bouton rond ci-dessous puis « Commencer la diffusion ».",
        "3. Ton écran apparaît sur le PC. Pour arrêter : la pastille rouge en haut."
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                Text("iPhone Live")
                    .font(.system(size: 34, weight: .bold))
                    .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: 14) {
                    ForEach(steps, id: \.self) { step in
                        Text(step)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color(UIColor.secondarySystemBackground))
                )

                ZStack {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 112, height: 112)
                        .shadow(color: Color.accentColor.opacity(0.35), radius: 14, x: 0, y: 6)
                    BroadcastPicker()
                        .frame(width: 80, height: 80)
                }
                .padding(.vertical, 8)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Adresses de cet iPhone")
                        .font(.footnote.weight(.semibold))
                        .foregroundColor(.secondary)
                    if addresses.isEmpty {
                        Text("Aucun réseau actif.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(addresses) { address in
                            HStack {
                                Text("\(address.ip):5000")
                                    .font(.system(.footnote, design: .monospaced))
                                Spacer()
                                Text(address.label)
                                    .font(.footnote)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(24)
        }
        .onAppear { addresses = LocalAddress.current() }
        .onReceive(refresh) { _ in addresses = LocalAddress.current() }
        .onChange(of: scenePhase) { phase in
            if phase == .active { addresses = LocalAddress.current() }
        }
    }
}

/// Bouton système qui ouvre le sélecteur de diffusion, pointé sur notre extension.
struct BroadcastPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 80, height: 80))
        picker.preferredExtension = "fr.pierre.iphonelive.broadcast"
        picker.showsMicrophoneButton = false
        picker.backgroundColor = .clear
        tint(picker)
        return picker
    }

    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {
        tint(uiView)
    }

    private func tint(_ picker: RPSystemBroadcastPickerView) {
        picker.tintColor = .white
        for case let button as UIButton in picker.subviews {
            button.tintColor = .white
            button.imageView?.tintColor = .white
        }
    }
}

/// Adresse IPv4 d'une interface active de l'iPhone.
struct LocalAddress: Identifiable, Equatable {
    let interface: String
    let ip: String
    var id: String { interface + ip }

    var label: String {
        if ip == "172.20.10.1" { return "Partage de connexion" }
        if interface == "en0" { return "Wi-Fi" }
        if interface.hasPrefix("bridge") { return "Partage de connexion" }
        return interface
    }

    static func current() -> [LocalAddress] {
        var head: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&head) == 0, let first = head else { return [] }
        defer { freeifaddrs(head) }

        var result: [LocalAddress] = []
        for pointer in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let ifa = pointer.pointee
            guard let addr = ifa.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET) else { continue }
            let flags = Int32(bitPattern: ifa.ifa_flags)
            guard flags & IFF_UP != 0, flags & IFF_LOOPBACK == 0 else { continue }
            let name = String(cString: ifa.ifa_name)
            // Les interfaces cellulaires et VPN ne sont pas joignables depuis le PC.
            if name.hasPrefix("pdp_ip") || name.hasPrefix("utun") || name.hasPrefix("ipsec") { continue }

            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(addr, socklen_t(addr.pointee.sa_len), &host, socklen_t(host.count),
                              nil, 0, NI_NUMERICHOST) == 0 else { continue }
            let entry = LocalAddress(interface: name, ip: String(cString: host))
            if !result.contains(entry) { result.append(entry) }
        }
        // Le partage de connexion en premier : c'est le cas normal.
        return result.sorted { ($0.ip == "172.20.10.1" ? 0 : 1) < ($1.ip == "172.20.10.1" ? 0 : 1) }
    }
}

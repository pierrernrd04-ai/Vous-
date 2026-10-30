import Foundation
import Network

/// Serveur TCP (port 5000) qui diffuse le flux H.264 Annex B à tous les clients.
/// Toutes les méthodes doivent être appelées sur `queue` ; les callbacks réseau y tournent aussi.
final class StreamServer {
    /// Appelé quand un client arrive : il faut une image clé tout de suite.
    var onClientConnected: (() -> Void)?

    private final class Client {
        let connection: NWConnection
        var pendingBytes = 0
        var waitingKeyFrame = true
        init(connection: NWConnection) { self.connection = connection }
    }

    private let queue: DispatchQueue
    private let port: NWEndpoint.Port = 5000
    private var listener: NWListener?
    private var clients: [ObjectIdentifier: Client] = [:]
    private var parameterSets: Data?
    private var running = false

    /// Au-delà, on saute les images P jusqu'à la prochaine image clé.
    private let softLimit = 2 * 1024 * 1024
    /// Au-delà, on saute aussi les images clés (borne dure de la mémoire).
    private let hardLimit = 4 * 1024 * 1024

    init(queue: DispatchQueue) {
        self.queue = queue
    }

    var hasClients: Bool { !clients.isEmpty }

    func start() {
        running = true
        startListener()
    }

    func stop() {
        running = false
        listener?.stateUpdateHandler = nil
        listener?.newConnectionHandler = nil
        listener?.cancel()
        listener = nil
        for id in Array(clients.keys) { remove(id) }
        parameterSets = nil
        onClientConnected = nil
    }

    /// Envoie une image ; `sets` (SPS+PPS) non nil signifie image clé.
    func broadcast(_ frame: Data, parameterSets sets: Data?) {
        var keyPayload: Data?
        if let sets = sets {
            parameterSets = sets
            keyPayload = sets + frame
        }
        for client in clients.values {
            if let payload = keyPayload {
                if client.pendingBytes > hardLimit {
                    client.waitingKeyFrame = true
                    continue
                }
                client.waitingKeyFrame = false
                send(payload, to: client)
            } else {
                if client.waitingKeyFrame { continue }
                if client.pendingBytes > softLimit {
                    client.waitingKeyFrame = true
                    continue
                }
                send(frame, to: client)
            }
        }
    }

    // MARK: - Écoute

    private func startListener() {
        guard running else { return }
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        let parameters = NWParameters(tls: nil, tcp: tcp)
        parameters.allowLocalEndpointReuse = true

        guard let listener = try? NWListener(using: parameters, on: port) else {
            retryListener()
            return
        }
        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
        listener.stateUpdateHandler = { [weak self] state in
            if case .failed = state { self?.retryListener() }
        }
        self.listener = listener
        listener.start(queue: queue)
    }

    private func retryListener() {
        listener?.stateUpdateHandler = nil
        listener?.newConnectionHandler = nil
        listener?.cancel()
        listener = nil
        queue.asyncAfter(deadline: .now() + 1) { [weak self] in
            self?.startListener()
        }
    }

    // MARK: - Clients

    private func accept(_ connection: NWConnection) {
        let id = ObjectIdentifier(connection)
        let client = Client(connection: connection)
        clients[id] = client

        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .failed(_), .cancelled, .waiting(_):
                self?.remove(id)
            default:
                break
            }
        }
        connection.start(queue: queue)
        receive(on: connection, id: id)

        // D'abord les derniers SPS/PPS, puis on attend l'image clé forcée.
        if let sets = parameterSets {
            send(sets, to: client)
        }
        onClientConnected?()
    }

    /// Lecture en boucle (le PC n'envoie rien) pour détecter vite une déconnexion.
    private func receive(on connection: NWConnection, id: ObjectIdentifier) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] _, _, isComplete, error in
            guard let self = self, self.clients[id] != nil else { return }
            if isComplete || error != nil {
                self.remove(id)
            } else {
                self.receive(on: connection, id: id)
            }
        }
    }

    private func send(_ data: Data, to client: Client) {
        let id = ObjectIdentifier(client.connection)
        let size = data.count
        client.pendingBytes += size
        client.connection.send(content: data, completion: .contentProcessed { [weak self, weak client] error in
            client?.pendingBytes -= size
            if error != nil { self?.remove(id) }
        })
    }

    private func remove(_ id: ObjectIdentifier) {
        guard let client = clients.removeValue(forKey: id) else { return }
        client.connection.stateUpdateHandler = nil
        client.connection.cancel()
    }
}

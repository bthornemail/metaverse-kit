import { UdpDiscovery } from "@metaverse-kit/tilestore";
import { DiscoveryGraph } from "@metaverse-kit/discovery";
import type { TipAdvert } from "@metaverse-kit/discovery";

export function startDiscovery(opts: { persistPath?: string; peerId: string }) {
  const graph = new DiscoveryGraph({
    persistPath: opts.persistPath,
    peerTtlMs: 2 * 60_000,
    tileTtlMs: 5 * 60_000,
    maxPeers: 512,
    maxTiles: 4096,
    maxPeersPerTile: 32,
  });

  const udp = new UdpDiscovery(48888);

  udp.onMessage((msg: TipAdvert) => {
    if (msg.peer_id === opts.peerId) return;
    graph.ingestTip(msg);
  });

  return { graph, udp };
}

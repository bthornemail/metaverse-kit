import dgram from "dgram";

export interface TipAdvert {
  type: "advertise_tip";
  peer_id: string;
  space_id: string;
  tile_id: string;
  tip_event: string;
  tip_segment: string;
  ts: number;
}

export class UdpDiscovery {
  sock = dgram.createSocket("udp4");

  constructor(public port = 48888, public broadcastAddr = "255.255.255.255") {
    this.sock.bind(() => {
      this.sock.setBroadcast(true);
    });
  }

  broadcastTip(msg: TipAdvert) {
    const buf = Buffer.from(JSON.stringify(msg), "utf8");
    this.sock.send(buf, this.port, this.broadcastAddr);
  }

  onMessage(handler: (msg: TipAdvert) => void) {
    this.sock.on("message", (data) => {
      try {
        const obj = JSON.parse(data.toString("utf8"));
        if (obj?.type === "advertise_tip") handler(obj);
      } catch {
        // ignore malformed packets
      }
    });
  }
}

// Online play: peer-to-peer (WebRTC) through PeerJS. No server of your own needed.
let loading;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return (loading ||= new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
    s.onload = ok;
    s.onerror = () => no(new Error("Could not load the online library. Check your internet connection."));
    document.head.append(s);
  }));
}

const PREFIX = "deadchamber-";
const newCode = () => Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");

export async function host(onConn) {
  await loadPeer();
  const code = newCode(), peer = new Peer(PREFIX + code);
  return new Promise((ok, no) => {
    peer.on("open", () => ok({ code, peer }));
    peer.on("error", (e) => no(e.type === "unavailable-id" ? new Error("Code clash. Please try again.") : e));
    peer.on("connection", (c) => c.on("open", () => onConn(c)));
  });
}

export async function join(code) {
  await loadPeer();
  const peer = new Peer();
  return new Promise((ok, no) => {
    let timer;
    peer.on("error", (e) => { clearTimeout(timer); no(e.type === "peer-unavailable" ? new Error("Room not found. Check the code.") : e); });
    peer.on("open", () => {
      const conn = peer.connect(PREFIX + code.toUpperCase().trim(), { reliable: true });
      conn.on("open", () => { clearTimeout(timer); ok({ peer, conn }); });
      timer = setTimeout(() => { peer.destroy(); no(new Error("Could not connect. Try again.")); }, 12000);
    });
  });
}

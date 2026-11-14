import { newMatch, act, view, ITEMS } from "./chamber-engine.js";
import { host, join } from "./chamber-net.js";

const hearts = (n, max) => "♥".repeat(n) + "♡".repeat(max - n);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function mount(el) {
  let s, v, mode, me = 0, conn, peer, cover = false, note = "";

  const stop = () => { try { peer && peer.destroy(); } catch {} peer = conn = null; };
  const leave = (m = "") => { stop(); mode = null; v = null; note = m; menu(); };
  const status = (t) => { const p = el.querySelector(".status"); if (p) p.textContent = t; };

  function menu() {
    el.innerHTML = `<div class="ch-menu">
      <button class="btn" data-m="local">Play on this device (2 players)</button>
      <button class="btn" data-m="host">Host an online game</button>
      <div class="ch-join"><input id="chCode" maxlength="4" placeholder="Code" aria-label="Room code"><button class="btn" data-m="join">Join online game</button></div>
      <p class="status" role="status"></p>
      <details class="rules"><summary>How to play</summary>
        <p>Each round the shotgun is loaded with a random mix of live and blank shells. You see how many of each, but not the order.</p>
        <p>On your turn, shoot your opponent or yourself. A live shell costs 1 life. A blank shot at yourself gives you another turn. A blank shot at your opponent passes the turn.</p>
        <p>Items: Magnifier shows the current shell. Beer ejects it. Cigarette heals 1. Handcuffs make your opponent skip a turn. Saw doubles the next live shot. Last player standing wins.</p>
      </details></div>`;
    status(note);
  }

  function send() {
    if (mode === "host") { conn.send({ t: "state", v: view(s, 1) }); v = view(s, 0); }
    else if (mode === "local") v = view(s, s.turn);
    render();
  }

  function play(a) {
    if (mode === "guest") return conn.send({ t: "act", a });
    const before = s.turn;
    if (!act(s, mode === "local" ? s.turn : 0, a)) return;
    if (mode === "local" && s.turn !== before && s.winner === null) cover = true;
    send();
  }

  function render() {
    const pv = mode === "local" ? v.turn : me, op = 1 - pv;
    const mineTurn = v.turn === pv && v.winner === null, over = v.winner !== null;
    const name = (i) => `Player ${i + 1}${mode !== "local" && i === pv ? " (you)" : ""}`;
    if (cover) {
      el.innerHTML = `<div class="ch-cover"><h3>Pass the device to Player ${v.turn + 1}</h3><button class="btn" data-a="ready">I'm Player ${v.turn + 1}, show the table</button></div>`;
      return;
    }
    const items = (p, mine) => v.items[p].map((k, i) => mine
      ? `<button class="itm" data-i="${i}" title="${ITEMS[k].tip}" ${mineTurn ? "" : "disabled"}>${ITEMS[k].icon} ${ITEMS[k].name}</button>`
      : `<span class="itm" title="${ITEMS[k].tip}">${ITEMS[k].icon} ${ITEMS[k].name}</span>`).join("") || `<span>No items</span>`;
    const panel = (p, mine) => `<section class="ch-panel"><h3>${name(p)}${v.turn === p && !over ? ", your move" : ""}</h3>
      <p class="hearts" aria-label="${v.lives[p]} lives">${hearts(v.lives[p], v.max)}${v.cuffed[p] ? " ⛓️" : ""}</p>
      <div class="items">${items(p, mine)}</div></section>`;
    el.innerHTML = `${panel(op, false)}
      <div class="ch-table">
        <p>Round ${v.round}: ${v.live} live, ${v.blank} blank loaded. ${v.left} shell${v.left === 1 ? "" : "s"} left.${v.saw ? " Barrel sawed off." : ""}</p>
        ${v.peek ? `<p class="peek">Current shell: ${v.peek === "L" ? "LIVE" : "BLANK"}</p>` : ""}
        <ul class="ch-log">${v.log.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        ${over ? `<p class="win">${name(v.winner)} wins!</p>` : ""}
      </div>
      <div class="ch-actions">
        <button class="btn" data-shoot="foe" ${mineTurn ? "" : "disabled"}>Shoot ${name(op)}</button>
        <button class="btn" data-shoot="self" ${mineTurn ? "" : "disabled"}>Shoot yourself</button>
      </div>
      ${panel(pv, true)}
      <div class="ch-actions">
        ${over && mode !== "guest" ? `<button class="btn" data-a="again">New match</button>` : ""}
        ${over && mode === "guest" ? `<span>Waiting for the host to start a new match…</span>` : ""}
        <button class="btn ghost" data-a="menu">Leave</button>
      </div>`;
  }

  function wire() {
    conn.on("data", (d) => {
      if (mode === "host" && d && d.t === "act") { if (act(s, 1, d.a)) send(); }
      else if (mode === "guest" && d && d.t === "state") {
        try { v = d.v; render(); } catch { leave("Received invalid data from the host."); }
      }
    });
    conn.on("close", () => leave("Opponent disconnected."));
  }

  async function hostGame() {
    status("Creating room…");
    try {
      const r = await host((c) => {
        if (conn) return c.close();
        conn = c; mode = "host"; me = 0; s = newMatch(); cover = false; wire(); send();
      });
      peer = r.peer;
      el.innerHTML = `<div class="ch-menu"><h3>Room code: ${r.code}</h3><p>Send this code to your friend and keep this page open. Waiting for them to join…</p><button class="btn ghost" data-a="menu">Cancel</button></div>`;
    } catch (e) { leave(e.message || "Could not create a room."); }
  }

  async function joinGame() {
    const code = el.querySelector("#chCode").value;
    if (code.trim().length !== 4) return status("Enter the 4-letter room code.");
    status("Connecting…");
    try {
      const r = await join(code);
      peer = r.peer; conn = r.conn; mode = "guest"; me = 1; wire();
      el.innerHTML = `<p class="status">Connected. Waiting for the host…</p>`;
    } catch (e) { leave(e.message || "Could not join the room."); }
  }

  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.m === "local") { mode = "local"; s = newMatch(); cover = false; send(); }
    else if (d.m === "host") hostGame();
    else if (d.m === "join") joinGame();
    else if (d.shoot) play({ t: "shoot", target: d.shoot });
    else if (d.i !== undefined) play({ t: "item", i: Number(d.i) });
    else if (d.a === "ready") { cover = false; render(); }
    else if (d.a === "again") { s = newMatch(); cover = false; send(); }
    else if (d.a === "menu") leave();
  });

  menu();
  return stop;
}

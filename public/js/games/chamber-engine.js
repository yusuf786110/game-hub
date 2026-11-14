// Pure game rules for Dead Chamber. No DOM, no network: the host (or the local device) runs this.
export const ITEMS = {
  magnifier: { icon: "🔍", name: "Magnifier", tip: "See the current shell" },
  beer: { icon: "🍺", name: "Beer", tip: "Eject the current shell" },
  cigarette: { icon: "🚬", name: "Cigarette", tip: "Restore 1 life" },
  cuffs: { icon: "⛓️", name: "Handcuffs", tip: "Opponent skips their next turn" },
  saw: { icon: "🪚", name: "Saw", tip: "Next shot deals double damage" }
};
const KEYS = Object.keys(ITEMS);
const MAX_ITEMS = 4;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function reload(s) {
  const total = rnd(2, 8), live = rnd(1, total - 1);
  s.round++; s.live = live; s.blank = total - live;
  s.chamber = shuffle([...Array(live).fill("L"), ...Array(total - live).fill("B")]);
  s.known = null; s.saw = false;
  for (const p of [0, 1]) {
    const n = Math.min(rnd(1, 3), MAX_ITEMS - s.items[p].length);
    for (let i = 0; i < n; i++) s.items[p].push(KEYS[rnd(0, KEYS.length - 1)]);
  }
  s.log.push(`Round ${s.round}: ${live} live, ${s.blank} blank. Items dealt.`);
}

export function newMatch() {
  const max = rnd(3, 5);
  const s = { lives: [max, max], max, turn: 0, items: [[], []], cuffed: [false, false], saw: false,
    known: null, log: [], winner: null, round: 0, chamber: [], live: 0, blank: 0 };
  reload(s);
  return s;
}

function endShot(s, p, keepTurn) {
  const foe = 1 - p;
  if (s.lives[0] <= 0) s.winner = 1;
  else if (s.lives[1] <= 0) s.winner = 0;
  if (s.winner !== null) { s.log.push(`Player ${s.winner + 1} wins the match.`); return; }
  if (!keepTurn) {
    if (s.cuffed[foe]) { s.cuffed[foe] = false; s.log.push(`Player ${foe + 1} is cuffed and skips a turn.`); }
    else s.turn = foe;
  }
  if (!s.chamber.length) reload(s);
}

// Returns true if the action was legal and applied.
export function act(s, p, a) {
  if (!a || s.winner !== null || s.turn !== p) return false;
  const foe = 1 - p, who = `Player ${p + 1}`;
  if (a.t === "item" && Number.isInteger(a.i)) {
    const it = s.items[p][a.i];
    if (!it || (it === "cigarette" && s.lives[p] >= s.max) || (it === "cuffs" && s.cuffed[foe]) || (it === "saw" && s.saw)) return false;
    s.items[p].splice(a.i, 1);
    if (it === "magnifier") { s.known = { shell: s.chamber[0], by: p }; s.log.push(`${who} used the magnifier.`); }
    else if (it === "cigarette") { s.lives[p]++; s.log.push(`${who} smoked a cigarette and healed 1.`); }
    else if (it === "cuffs") { s.cuffed[foe] = true; s.log.push(`${who} handcuffed Player ${foe + 1}.`); }
    else if (it === "saw") { s.saw = true; s.log.push(`${who} sawed off the barrel.`); }
    else if (it === "beer") {
      const x = s.chamber.shift(); s.known = null;
      s.log.push(`${who} ejected a ${x === "L" ? "live" : "blank"} shell.`);
      endShot(s, p, true);
    }
    return true;
  }
  if (a.t === "shoot" && (a.target === "self" || a.target === "foe")) {
    const x = s.chamber.shift(), t = a.target === "self" ? p : foe;
    s.known = null;
    if (x === "L") {
      const d = s.saw ? 2 : 1;
      s.lives[t] = Math.max(0, s.lives[t] - d);
      s.log.push(`${who} shot ${t === p ? "themselves" : "Player " + (t + 1)}: LIVE, -${d}.`);
    } else s.log.push(`${who} shot ${t === p ? "themselves" : "Player " + (t + 1)}: blank.`);
    s.saw = false;
    endShot(s, p, x === "B" && t === p);
    return true;
  }
  return false;
}

// What player p is allowed to see. The shell order never leaves the host.
export const view = (s, p) => ({
  lives: s.lives, max: s.max, turn: s.turn, items: s.items, cuffed: s.cuffed, saw: s.saw,
  log: s.log.slice(-5), winner: s.winner, round: s.round, live: s.live, blank: s.blank,
  left: s.chamber.length, peek: s.known && s.known.by === p ? s.known.shell : null
});

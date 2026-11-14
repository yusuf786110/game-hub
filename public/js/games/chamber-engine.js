// Game engine for Buckshot Roulette with complete Dealer AI & Item mechanics

export const ITEMS = {
  magnifier: { icon: "🔍", name: "Magnifying Glass", tip: "Inspect the chamber to see the current shell" },
  beer: { icon: "🍺", name: "Beer Can", tip: "Racks the shotgun and ejects the current shell" },
  cigarette: { icon: "🚬", name: "Cigarette Pack", tip: "Smoke to restore 1 defibrillator charge" },
  cuffs: { icon: "⛓️", name: "Handcuffs", tip: "Lock opponent; skips their next turn" },
  saw: { icon: "🪚", name: "Hand Saw", tip: "Saw off barrel; next live shell deals 2 damage" },
  inverter: { icon: "🔄", name: "Polarity Inverter", tip: "Flips current shell: Live becomes Blank, Blank becomes Live" },
  phone: { icon: "📱", name: "Burner Phone", tip: "Reveals the shell type at a random future position" }
};

const KEYS = Object.keys(ITEMS);
const MAX_ITEMS = 6;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function reload(s) {
  let total, live;
  if (s.round === 0) {
    // Round 1: tutorial/starter feel: 3-4 shells
    total = rnd(3, 4);
    live = rnd(1, total - 1);
  } else if (s.round === 1) {
    // Round 2: 4-6 shells
    total = rnd(4, 6);
    live = rnd(1, total - 1);
  } else {
    // Round 3+: 5-8 shells
    total = rnd(5, 8);
    live = rnd(2, total - 2);
  }

  s.round++;
  s.live = live;
  s.blank = total - live;
  s.chamber = shuffle([...Array(live).fill("L"), ...Array(total - live).fill("B")]);
  s.initialChamber = [...s.chamber]; // Keep track of loaded sequence for animations
  s.known = null;
  s.saw = false;

  // Distribute items
  const itemsPerPlayer = s.round === 1 ? rnd(1, 2) : rnd(2, 3);
  for (const p of [0, 1]) {
    const space = MAX_ITEMS - s.items[p].length;
    const n = Math.min(itemsPerPlayer, space);
    for (let i = 0; i < n; i++) {
      s.items[p].push(KEYS[rnd(0, KEYS.length - 1)]);
    }
  }

  s.log.push(`ROUND ${s.round}: ${live} LIVE, ${s.blank} BLANK loaded into chamber.`);
}

export function newMatch(isDealerMatch = true) {
  const max = 4;
  const s = {
    isDealer: isDealerMatch,
    lives: [max, max],
    max,
    turn: 0,
    items: [[], []],
    cuffed: [false, false],
    saw: false,
    known: null,
    phoneInfo: null,
    log: [],
    winner: null,
    round: 0,
    chamber: [],
    initialChamber: [],
    live: 0,
    blank: 0,
    lastAction: null
  };
  reload(s);
  return s;
}

function endShot(s, p, keepTurn) {
  const foe = 1 - p;
  if (s.lives[0] <= 0) s.winner = 1;
  else if (s.lives[1] <= 0) s.winner = 0;

  if (s.winner !== null) {
    const winnerName = s.winner === 1 && s.isDealer ? "The Dealer" : `Player ${s.winner + 1}`;
    s.log.push(`MATCH OVER: ${winnerName} is victorious!`);
    return;
  }

  if (!keepTurn) {
    if (s.cuffed[foe]) {
      s.cuffed[foe] = false;
      const foeName = foe === 1 && s.isDealer ? "The Dealer" : `Player ${foe + 1}`;
      s.log.push(`${foeName} is handcuffed and forced to skip their turn!`);
    } else {
      s.turn = foe;
    }
  }

  if (!s.chamber.length) {
    reload(s);
  }
}

// Executes an action in the game engine
export function act(s, p, a) {
  if (!a || s.winner !== null || s.turn !== p) return false;
  const foe = 1 - p;
  const who = p === 1 && s.isDealer ? "The Dealer" : `Player ${p + 1}`;
  const foeName = foe === 1 && s.isDealer ? "The Dealer" : `Player ${foe + 1}`;

  s.lastAction = null;

  if (a.t === "item" && Number.isInteger(a.i)) {
    const it = s.items[p][a.i];
    if (!it) return false;
    if (it === "cigarette" && s.lives[p] >= s.max) return false;
    if (it === "cuffs" && s.cuffed[foe]) return false;
    if (it === "saw" && s.saw) return false;

    s.items[p].splice(a.i, 1);

    if (it === "magnifier") {
      s.known = { shell: s.chamber[0], by: p };
      s.log.push(`${who} inspected the chamber with the Magnifying Glass.`);
      s.lastAction = { type: "item_magnifier", by: p, shell: s.chamber[0] };
    } else if (it === "cigarette") {
      s.lives[p] = Math.min(s.max, s.lives[p] + 1);
      s.log.push(`${who} smoked a cigarette and recovered 1 charge.`);
      s.lastAction = { type: "item_cigarette", by: p };
    } else if (it === "cuffs") {
      s.cuffed[foe] = true;
      s.log.push(`${who} handcuffed ${foeName}!`);
      s.lastAction = { type: "item_cuffs", by: p };
    } else if (it === "saw") {
      s.saw = true;
      s.log.push(`${who} sawed off the shotgun barrel! Next shot deals 2x damage!`);
      s.lastAction = { type: "item_saw", by: p };
    } else if (it === "inverter") {
      if (s.chamber.length > 0) {
        const cur = s.chamber[0];
        s.chamber[0] = cur === "L" ? "B" : "L";
        if (cur === "L") { s.live--; s.blank++; }
        else { s.blank--; s.live++; }
        if (s.known) s.known.shell = s.chamber[0];
        s.log.push(`${who} used the Polarity Inverter on the chamber!`);
        s.lastAction = { type: "item_inverter", by: p };
      }
    } else if (it === "phone") {
      if (s.chamber.length > 1) {
        const idx = rnd(1, s.chamber.length - 1);
        const sh = s.chamber[idx];
        s.phoneInfo = { index: idx + 1, shell: sh, by: p };
        s.log.push(`${who} answered the Burner Phone: Shell #${idx + 1} is ${sh === "L" ? "LIVE" : "BLANK"}.`);
        s.lastAction = { type: "item_phone", by: p, index: idx + 1, shell: sh };
      } else {
        s.log.push(`${who} answered the Burner Phone... but only static answers.`);
        s.lastAction = { type: "item_phone", by: p, static: true };
      }
    } else if (it === "beer") {
      const ejected = s.chamber.shift();
      if (ejected === "L") s.live--; else s.blank--;
      s.known = null;
      s.log.push(`${who} drank a beer and racked the slide, ejecting a ${ejected === "L" ? "LIVE" : "BLANK"} shell!`);
      s.lastAction = { type: "item_beer", by: p, ejected };
      endShot(s, p, true);
    }
    return true;
  }

  if (a.t === "shoot" && (a.target === "self" || a.target === "foe")) {
    const x = s.chamber.shift();
    if (x === "L") s.live--; else s.blank--;
    const t = a.target === "self" ? p : foe;
    const targetName = t === p ? "themselves" : foeName;
    const wasSawed = s.saw;
    s.known = null;

    if (x === "L") {
      const dmg = wasSawed ? 2 : 1;
      s.lives[t] = Math.max(0, s.lives[t] - dmg);
      s.log.push(`💥 BOOM! ${who} fired at ${targetName} with a LIVE shell! (-${dmg} Life)`);
      s.lastAction = { type: "shoot", by: p, target: a.target, shell: "L", damage: dmg };
    } else {
      s.log.push(`*CLICK* ${who} fired at ${targetName}: BLANK.`);
      s.lastAction = { type: "shoot", by: p, target: a.target, shell: "B", damage: 0 };
    }

    s.saw = false;
    // Shooting yourself with a blank keeps your turn!
    endShot(s, p, x === "B" && t === p);
    return true;
  }

  return false;
}

// AI decision maker for The Dealer
export function dealerThink(s) {
  if (s.turn !== 1 || s.winner !== null) return null;
  const items = s.items[1];
  const foeLives = s.lives[0];
  const dealerLives = s.lives[1];
  const liveCount = s.chamber.filter(c => c === "L").length;
  const blankCount = s.chamber.filter(c => c === "B").length;
  const total = s.chamber.length;

  // 1. Heal if low
  if (dealerLives < s.max) {
    const cigIdx = items.indexOf("cigarette");
    if (cigIdx !== -1) return { t: "item", i: cigIdx };
  }

  // 2. If Dealer knows the current shell
  if (s.known && s.known.by === 1) {
    if (s.known.shell === "L") {
      // It's live! Check if we can saw
      if (!s.saw) {
        const sawIdx = items.indexOf("saw");
        if (sawIdx !== -1) return { t: "item", i: sawIdx };
      }
      // Check cuffs
      if (!s.cuffed[0]) {
        const cuffIdx = items.indexOf("cuffs");
        if (cuffIdx !== -1) return { t: "item", i: cuffIdx };
      }
      // Shoot player!
      return { t: "shoot", target: "foe" };
    } else {
      // It's blank! Shoot himself to keep turn safely
      return { t: "shoot", target: "self" };
    }
  }

  // 3. Inspect chamber if magnifier available
  const magIdx = items.indexOf("magnifier");
  if (magIdx !== -1) return { t: "item", i: magIdx };

  // 4. Burner phone if available
  const phoneIdx = items.indexOf("phone");
  if (phoneIdx !== -1 && total > 1) return { t: "item", i: phoneIdx };

  // 5. Inverter: if 100% sure or mostly blanks
  if (liveCount === 0 && blankCount > 0) {
    const invIdx = items.indexOf("inverter");
    if (invIdx !== -1) return { t: "item", i: invIdx };
  }

  // 6. Cuffs if player has lots of items or lives
  if (!s.cuffed[0] && items.includes("cuffs") && total > 2) {
    return { t: "item", i: items.indexOf("cuffs") };
  }

  // 7. Probability decision
  const probLive = liveCount / total;

  if (probLive > 0.5) {
    // Higher chance live -> shoot player
    if (probLive >= 0.75 && !s.saw) {
      const sawIdx = items.indexOf("saw");
      if (sawIdx !== -1) return { t: "item", i: sawIdx };
    }
    return { t: "shoot", target: "foe" };
  } else {
    // 50% or more blanks -> shoot self for extra turn
    return { t: "shoot", target: "self" };
  }
}

// Redacted view for network/local player
export const view = (s, p) => ({
  isDealer: s.isDealer,
  lives: s.lives,
  max: s.max,
  turn: s.turn,
  items: s.items,
  cuffed: s.cuffed,
  saw: s.saw,
  log: s.log.slice(-6),
  winner: s.winner,
  round: s.round,
  live: s.live,
  blank: s.blank,
  left: s.chamber.length,
  peek: s.known && s.known.by === p ? s.known.shell : null,
  phoneInfo: s.phoneInfo && s.phoneInfo.by === p ? s.phoneInfo : null,
  lastAction: s.lastAction
});

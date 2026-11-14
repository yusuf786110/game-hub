const FACES = ["🚀", "🎮", "🍕", "🐙", "⚡", "🎲", "🌈", "🔥"];

export function mount(el, { submitScore }) {
  el.innerHTML = `<div class="mem"></div><p class="status" aria-live="polite"></p><button class="btn" data-act="new">New game</button>`;
  const grid = el.querySelector(".mem");
  const status = el.querySelector(".status");
  let tiles, open, moves, matched, lock, timeout;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function reset() {
    clearTimeout(timeout);
    tiles = shuffle([...FACES, ...FACES]).map((f) => ({ f, state: "down" }));
    open = []; moves = 0; matched = 0; lock = false;
    status.textContent = "Moves: 0";
    render();
  }

  function render() {
    grid.replaceChildren();
    tiles.forEach((t, i) => {
      const c = document.createElement("button");
      c.className = "tile" + (t.state === "open" ? " open" : t.state === "done" ? " done" : "");
      c.textContent = t.state === "down" ? "" : t.f;
      c.setAttribute("aria-label", t.state === "down" ? "Hidden tile" : t.f);
      c.addEventListener("click", () => flip(i));
      grid.append(c);
    });
  }

  function flip(i) {
    if (lock || tiles[i].state !== "down") return;
    tiles[i].state = "open"; open.push(i); render();
    if (open.length < 2) return;
    moves++; status.textContent = `Moves: ${moves}`;
    const [a, b] = open; open = [];
    if (tiles[a].f === tiles[b].f) {
      tiles[a].state = tiles[b].state = "done"; matched++; render();
      if (matched === FACES.length) {
        const score = Math.max(10, 100 - moves * 3);
        status.textContent = `Done in ${moves} moves. Score: ${score}`;
        submitScore(score);
      }
    } else {
      lock = true;
      timeout = setTimeout(() => { tiles[a].state = tiles[b].state = "down"; lock = false; render(); }, 700);
    }
  }

  el.querySelector("[data-act=new]").addEventListener("click", reset);
  reset();
  return () => clearTimeout(timeout);
}

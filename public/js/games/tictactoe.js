const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function mount(el, { submitScore }) {
  el.innerHTML = `<div class="ttt"></div><p class="status" aria-live="polite"></p><button class="btn" data-act="new">New round</button>`;
  const grid = el.querySelector(".ttt");
  const status = el.querySelector(".status");
  let b, over, wins = 0;

  const winner = (s) => {
    for (const [x, y, z] of LINES) if (s[x] && s[x] === s[y] && s[x] === s[z]) return s[x];
    return s.every(Boolean) ? "draw" : null;
  };

  function findMove(mark) {
    for (const l of LINES) {
      const vals = l.map((i) => b[i]);
      if (vals.filter((v) => v === mark).length === 2 && vals.includes(null)) return l[vals.indexOf(null)];
    }
    return -1;
  }

  function computer() {
    let m = findMove("O");
    if (m < 0) m = findMove("X");
    if (m < 0) {
      const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      m = b[4] === null && Math.random() < 0.6 ? 4 : free[Math.floor(Math.random() * free.length)];
    }
    b[m] = "O";
  }

  function render() {
    grid.replaceChildren();
    b.forEach((v, i) => {
      const c = document.createElement("button");
      c.className = "cell";
      c.textContent = v || "";
      c.setAttribute("aria-label", `Square ${i + 1}${v ? ": " + v : ""}`);
      c.addEventListener("click", () => play(i));
      grid.append(c);
    });
  }

  function end(w) {
    over = true;
    if (w === "X") { wins++; status.textContent = `You win! Streak: ${wins}`; submitScore(wins); }
    else if (w === "O") { wins = 0; status.textContent = "Computer wins. Streak reset."; }
    else status.textContent = "Draw.";
  }

  function play(i) {
    if (over || b[i]) return;
    b[i] = "X";
    let w = winner(b);
    if (!w) { computer(); w = winner(b); }
    render();
    if (w) end(w);
  }

  function reset() { b = Array(9).fill(null); over = false; status.textContent = `Your turn. Streak: ${wins}`; render(); }
  el.querySelector("[data-act=new]").addEventListener("click", reset);
  reset();
  return () => {};
}

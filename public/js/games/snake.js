const N = 18, CELL = 20;

export function mount(el, { submitScore }) {
  el.innerHTML = `<canvas width="${N * CELL}" height="${N * CELL}" aria-label="Snake board"></canvas>
    <p class="status" aria-live="polite"></p>
    <button class="btn" data-act="start">Start</button>
    <div class="dpad">
      <button class="btn up" data-d="0,-1" aria-label="Up">↑</button>
      <button class="btn" data-d="-1,0" aria-label="Left">←</button>
      <button class="btn" data-d="0,1" aria-label="Down">↓</button>
      <button class="btn" data-d="1,0" aria-label="Right">→</button>
    </div>`;
  const ctx = el.querySelector("canvas").getContext("2d");
  const status = el.querySelector(".status");
  let snake, dir, next, food, score, timer;

  const rand = () => ({ x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) });

  function start() {
    clearInterval(timer);
    snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }];
    dir = next = { x: 1, y: 0 };
    score = 0; food = rand();
    status.textContent = "Score: 0";
    timer = setInterval(tick, 120);
  }

  function turn(x, y) {
    if (x === -dir.x && y === -dir.y) return;
    next = { x, y };
  }

  function tick() {
    dir = next;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hit = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N ||
      snake.some((s) => s.x === head.x && s.y === head.y);
    if (hit) {
      clearInterval(timer);
      status.textContent = `Game over. Score: ${score}`;
      if (score > 0) submitScore(score);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10; food = rand();
      status.textContent = `Score: ${score}`;
    } else snake.pop();
    draw();
  }

  function draw() {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, N * CELL, N * CELL);
    ctx.fillStyle = "#ff7eb6"; ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);
    snake.forEach((s, i) => {
      ctx.fillStyle = i ? "#3ddc97" : "#1b1a33";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  const keys = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  function onKey(e) {
    const k = keys[e.key];
    if (!k) return;
    e.preventDefault();
    turn(...k);
  }
  document.addEventListener("keydown", onKey);
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "start") start();
    if (b.dataset.d) turn(...b.dataset.d.split(",").map(Number));
  });

  snake = [{ x: 9, y: 9 }]; dir = next = { x: 1, y: 0 }; food = { x: 3, y: 3 }; draw();
  status.textContent = "Press Start.";
  return () => { clearInterval(timer); document.removeEventListener("keydown", onKey); };
}

import { getScores, postScore } from "./api.js";
import * as snake from "./games/snake.js";
import * as tictactoe from "./games/tictactoe.js";
import * as memory from "./games/memory.js";
import * as chamber from "./games/chamber.js";

// To add a game: create js/games/<id>.js exporting mount(el, ctx), then add it here
// (and add its id to GAMES in api/scores.js).
const GAMES = [
  { id: "snake", title: "Snake", emoji: "🐍", color: "var(--mint)", blurb: "Eat, grow, don't crash.", help: "Arrow keys or WASD. On a phone, use the buttons.", mod: snake },
  { id: "tictactoe", title: "Tic-Tac-Toe", emoji: "❌", color: "var(--pink)", blurb: "Beat the computer. Build a streak.", help: "You are X. Your score is your win streak.", mod: tictactoe },
  { id: "memory", title: "Memory Match", emoji: "🧠", color: "var(--sun)", blurb: "Find all 8 pairs in few moves.", help: "Flip two tiles. Fewer moves means a higher score.", mod: memory },
  { id: "chamber", title: "Buckshot Roulette", emoji: "💀", color: "#241920", blurb: "12-gauge shotgun vs The Dealer. Live or blank?", help: "Sign the waiver, enter the basement, and face The Dealer.", noBoard: true, mod: chamber }
];

const $ = (id) => document.getElementById(id);
const nameInput = $("player");
nameInput.value = localStorage.getItem("player") || "";
nameInput.addEventListener("input", () => localStorage.setItem("player", nameInput.value));

let destroy = null;

async function renderBoard(id) {
  const list = $("board");
  const scores = await getScores(id);
  list.replaceChildren();
  if (!scores.length) {
    const li = document.createElement("li");
    li.textContent = "No scores yet. Be the first.";
    return list.append(li);
  }
  for (const s of scores) {
    const li = document.createElement("li");
    const a = document.createElement("span"), b = document.createElement("strong");
    a.textContent = s.name; b.textContent = s.score;
    li.append(a, b);
    list.append(li);
  }
}

function open(game) {
  $("lobby").hidden = true; $("stage").hidden = false;
  $("gameTitle").textContent = game.title;
  $("gameHelp").textContent = game.help;
  const mount = $("gameMount");
  mount.replaceChildren();
  document.querySelector("aside").hidden = !!game.noBoard;
  if (!game.noBoard) renderBoard(game.id);
  destroy = game.mod.mount(mount, {
    async submitScore(score) {
      await postScore(game.id, nameInput.value || "Player", score);
      renderBoard(game.id);
    }
  });
}

function close() {
  if (destroy) destroy();
  destroy = null;
  $("stage").hidden = true; $("lobby").hidden = false;
}

$("back").addEventListener("click", close);

for (const g of GAMES) {
  const card = document.createElement("button");
  card.className = "card";
  card.style.background = g.color;
  card.innerHTML = `<span class="big" aria-hidden="true">${g.emoji}</span><span><h3>${g.title}</h3><p>${g.blurb}</p></span>`;
  card.addEventListener("click", () => open(g));
  $("cards").append(card);
}

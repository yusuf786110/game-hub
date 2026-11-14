// Vercel serverless function: GET /api/scores?game=snake  |  POST /api/scores
// NOTE: scores live in memory, so they reset when the function restarts.
// For permanent storage, swap `store` for Upstash Redis / Vercel KV (see README).

const GAMES = ["snake", "tictactoe", "memory"];
const store = globalThis.__scores || (globalThis.__scores = {});

function top(game) {
  return (store[game] || []).slice().sort((a, b) => b.score - a.score).slice(0, 10);
}

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const game = String(req.query.game || "");
    if (!GAMES.includes(game)) return res.status(400).json({ error: "Unknown game." });
    return res.status(200).json({ scores: top(game) });
  }

  if (req.method === "POST") {
    const { game, name, score } = req.body || {};
    const cleanName = String(name || "").replace(/[^\w \-]/g, "").trim().slice(0, 12) || "Player";
    const n = Math.floor(Number(score));
    if (!GAMES.includes(game)) return res.status(400).json({ error: "Unknown game." });
    if (!Number.isFinite(n) || n < 0 || n > 100000) return res.status(400).json({ error: "Invalid score." });
    (store[game] = store[game] || []).push({ name: cleanName, score: n, at: Date.now() });
    store[game] = top(game);
    return res.status(201).json({ scores: store[game] });
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
};

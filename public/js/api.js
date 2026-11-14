// Talks to the serverless functions in /api
export async function getScores(game) {
  try {
    const r = await fetch(`/api/scores?game=${encodeURIComponent(game)}`);
    return (await r.json()).scores || [];
  } catch { return []; }
}

export async function postScore(game, name, score) {
  try {
    const r = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, name, score })
    });
    return (await r.json()).scores || [];
  } catch { return []; }
}

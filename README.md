# Game Hub

Browser games (Snake, Tic-Tac-Toe, Memory Match) with a leaderboard API.

```
game-hub/
├─ api/scores.js          Serverless function: GET/POST /api/scores
├─ public/
│  ├─ index.html          Page shell
│  ├─ css/style.css       Styles
│  └─ js/
│     ├─ main.js          Lobby, game switching, leaderboard UI
│     ├─ api.js           fetch helpers for /api
│     └─ games/           One file per game
├─ vercel.json
└─ package.json
```

## Run locally
```
npm i -g vercel
vercel dev
```
Open the URL it prints. The /api route only works through `vercel dev` or after deploying.

## Deploy
1. `git init && git add . && git commit -m "Game Hub"`
2. Create a GitHub repo and push.
3. On vercel.com choose Add New, then Project. Import the repo, keep the defaults, and click Deploy.

## Add a game
1. Create `public/js/games/<id>.js` exporting `mount(el, { submitScore })` that returns a cleanup function.
2. Register it in `GAMES` in `public/js/main.js`.
3. Add its id to `GAMES` in `api/scores.js`.

## Making scores permanent
The leaderboard is held in memory, so it resets sometimes. For permanent scores, add Upstash Redis from the Vercel Marketplace and replace `store` in `api/scores.js` with sorted-set calls.

## Dead Chamber (two-player shotgun game)
- `public/js/games/chamber-engine.js`: pure rules, easy to test.
- `public/js/games/chamber-net.js`: online play over WebRTC using PeerJS (free public broker, no backend needed).
- `public/js/games/chamber.js`: UI. Modes: same device (pass-and-play) or online with a 4-letter room code.
- The host runs the rules and only sends each player what they may see, so the shell order stays hidden.
- Some strict school or office networks block WebRTC. If online play fails there, use a phone hotspot or add a TURN server.

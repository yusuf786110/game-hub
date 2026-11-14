// Buckshot Roulette - Authentic Web Edition with Intro Video/Waiver, 3D Table, Dealer AI & Procedural Audio
import { newMatch, act, view, dealerThink, ITEMS } from "./chamber-engine.js";
import { host, join } from "./chamber-net.js";
import { sounds } from "./chamber-audio.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function mount(el) {
  let s = null, v = null, mode = "dealer", me = 0, conn = null, peer = null;
  let cover = false, note = "";
  let inIntro = true;
  let introStep = "terminal"; // terminal -> waiver -> door -> game
  let dealerThinking = false;
  let animState = { aiming: "idle", shaking: 0, flash: null, shellEject: null, sawed: false };
  let animFrameId = null;

  const stop = () => {
    try { peer && peer.destroy(); } catch {}
    peer = conn = null;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  };

  const leave = (m = "") => {
    stop();
    mode = null;
    v = null;
    s = null;
    note = m;
    inIntro = false;
    renderMenu();
  };

  // --- AUDIO INITIALIZATION ON FIRST GESTURE ---
  const ensureAudio = () => {
    sounds.init();
  };

  // --- INTRO / ENTRY CUTSCENE ---
  function renderIntro() {
    el.innerHTML = `
      <div class="br-container br-crt">
        <div class="br-scanlines"></div>
        <div class="br-intro-screen">
          ${introStep === "terminal" ? `
            <div class="br-terminal">
              <div class="br-term-header">SYSTEM_BOOT // CLUB_BASEMENT_V2.1</div>
              <p class="br-term-line delay-1">> CONNECTING TO UNDERGROUND FEED...</p>
              <p class="br-term-line delay-2">> CHAMBER TEMPERATURE: 11°C</p>
              <p class="br-term-line delay-3">> 12-GAUGE PUMP ACTION LOADED</p>
              <p class="br-term-line delay-4">> OPPONENT: THE DEALER</p>
              <div class="br-term-action">
                <button class="br-btn br-btn-red" id="btnEnterClub">ENTER BASEMENT</button>
              </div>
            </div>
          ` : introStep === "waiver" ? `
            <div class="br-waiver-wrapper">
              <div class="br-clipboard">
                <div class="br-clip"></div>
                <div class="br-waiver-paper">
                  <h2>GENERAL RELEASE OF LIABILITY</h2>
                  <p class="br-waiver-sub">TABLE 07 - UNREGISTERED BUCKSHOT GAME</p>
                  <div class="br-waiver-body">
                    <p>I hereby acknowledge that I am voluntarily entering a high-stakes, 12-gauge shotgun wager against <strong>THE DEALER</strong>.</p>
                    <p>I agree that neither the venue nor the Dealer shall be held accountable for severe lacerations, lead buckshot discharge, cardiac defibrillator failure, or sudden expiration.</p>
                    <p>Rounds are loaded with an undisclosed sequence of LIVE and BLANK cartridges. All items placed on the metal table are final.</p>
                  </div>
                  <div class="br-signature-box">
                    <label>CONTESTANT NAME:</label>
                    <input type="text" id="waiverName" maxlength="12" value="${localStorage.getItem("player") || "GUEST"}" placeholder="Your Name" />
                    <button class="br-btn br-btn-stamp" id="btnSignWaiver">SIGN WAIVER</button>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div class="br-door-screen">
              <div class="br-door br-door-left"></div>
              <div class="br-door br-door-right"></div>
              <div class="br-door-light"></div>
              <div class="br-door-label">CLEARANCE GRANTED</div>
            </div>
          `}
        </div>
      </div>
    `;

    if (introStep === "terminal") {
      el.querySelector("#btnEnterClub").onclick = () => {
        ensureAudio();
        sounds.playHeartbeat();
        introStep = "waiver";
        renderIntro();
      };
    } else if (introStep === "waiver") {
      const nameInput = el.querySelector("#waiverName");
      el.querySelector("#btnSignWaiver").onclick = () => {
        ensureAudio();
        const finalName = nameInput.value.trim() || "GUEST";
        localStorage.setItem("player", finalName);
        sounds.playDoorOpen();
        introStep = "door";
        renderIntro();

        setTimeout(() => {
          inIntro = false;
          mode = "dealer";
          startMatch();
        }, 1600);
      };
    }
  }

  // --- MENU SCREEN ---
  function renderMenu() {
    el.innerHTML = `
      <div class="br-container br-crt">
        <div class="br-scanlines"></div>
        <div class="br-menu-panel">
          <div class="br-title-glow">
            <h1 class="br-glitch" data-text="BUCKSHOT ROULETTE">BUCKSHOT ROULETTE</h1>
            <p class="br-sub">12-GAUGE VOLTAGE & BLOOD</p>
          </div>
          <div class="br-menu-buttons">
            <button class="br-btn br-btn-red br-big" data-m="dealer">VS THE DEALER (SOLO)</button>
            <button class="br-btn br-btn-wood" data-m="local">LOCAL 2 PLAYERS (ONE DEVICE)</button>
            <button class="br-btn br-btn-wood" data-m="host">HOST ONLINE GAME (P2P)</button>
            <div class="br-join-group">
              <input id="chCode" maxlength="4" placeholder="ROOM" aria-label="Room code" />
              <button class="br-btn br-btn-blue" data-m="join">JOIN GAME</button>
            </div>
          </div>
          ${note ? `<p class="br-status-note">${esc(note)}</p>` : ""}
          <details class="br-rules-fold">
            <summary>RULES OF THE CHAMBER</summary>
            <ul>
              <li>Each round, the shotgun is loaded with a known count of <strong>LIVE (RED)</strong> and <strong>BLANK (BLUE)</strong> shells in random order.</li>
              <li>Aim at opponent to deal damage. Aim at yourself: if BLANK, you take another turn; if LIVE, you lose 1 life!</li>
              <li><strong>ITEMS:</strong> Magnifier (peek chamber), Beer (eject shell), Cigarette (+1 life), Handcuffs (skip turn), Saw (2x damage), Inverter (flip live/blank), Burner Phone (future intel).</li>
            </ul>
          </details>
        </div>
      </div>
    `;
  }

  function startMatch() {
    me = 0;
    cover = false;
    dealerThinking = false;
    animState = { aiming: "idle", shaking: 0, flash: null, shellEject: null, sawed: false };
    s = newMatch(mode === "dealer");
    v = view(s, 0);
    renderGame();
    animateTable();
  }

  // --- ACTIONS DISPATCHER ---
  function play(a) {
    if (dealerThinking) return;
    ensureAudio();

    if (mode === "guest") {
      return conn && conn.send({ t: "act", a });
    }

    const currentTurn = s.turn;
    const isDealerMatch = mode === "dealer";

    // Item audio cues
    if (a.t === "item" && Number.isInteger(a.i)) {
      const it = s.items[currentTurn][a.i];
      if (it === "cigarette") sounds.playCigarette();
      else if (it === "beer") sounds.playBeerOpen();
      else if (it === "cuffs") sounds.playCuffs();
      else if (it === "saw") { sounds.playSaw(); animState.sawed = true; }
      else if (it === "magnifier") sounds.playMagnifier();
      else if (it === "phone") sounds.playHeartbeat(true);
      else if (it === "inverter") sounds.playBlankClick();
    }

    // Shoot audio and visual animation triggers
    if (a.t === "shoot") {
      animState.aiming = a.target === "self" ? "self" : "foe";
      sounds.playPumpRack();

      setTimeout(() => {
        const nextShell = s.chamber[0];
        if (nextShell === "L") {
          sounds.playShotgunBlast();
          animState.flash = "red";
          animState.shaking = 18;
          animState.shellEject = "L";
        } else {
          sounds.playBlankClick();
          animState.flash = "cyan";
          animState.shaking = 6;
          animState.shellEject = "B";
        }

        const success = act(s, currentTurn, a);
        if (!success) return;

        if (mode === "local" && s.turn !== currentTurn && s.winner === null) {
          cover = true;
        }

        updateViews();

        // Check if Dealer should take their turn
        if (isDealerMatch && s.turn === 1 && s.winner === null) {
          handleDealerTurn();
        }
      }, 350);
      return;
    }

    const before = s.turn;
    if (!act(s, currentTurn, a)) return;

    if (mode === "local" && s.turn !== before && s.winner === null) {
      cover = true;
    }

    updateViews();

    if (isDealerMatch && s.turn === 1 && s.winner === null) {
      handleDealerTurn();
    }
  }

  function handleDealerTurn() {
    dealerThinking = true;
    renderGame();

    setTimeout(() => {
      if (!s || s.turn !== 1 || s.winner !== null) {
        dealerThinking = false;
        renderGame();
        return;
      }

      const dealerAction = dealerThink(s);
      if (!dealerAction) {
        dealerThinking = false;
        return;
      }

      if (dealerAction.t === "item") {
        play(dealerAction);
        setTimeout(() => {
          if (s && s.turn === 1 && s.winner === null) handleDealerTurn();
          else dealerThinking = false;
        }, 1100);
      } else if (dealerAction.t === "shoot") {
        play(dealerAction);
        setTimeout(() => {
          dealerThinking = false;
          if (s && s.turn === 1 && s.winner === null) {
            handleDealerTurn();
          }
        }, 1200);
      }
    }, 1200);
  }

  function updateViews() {
    if (mode === "host") {
      conn && conn.send({ t: "state", v: view(s, 1) });
      v = view(s, 0);
    } else if (mode === "local") {
      v = view(s, s.turn);
    } else {
      v = view(s, me);
    }
    renderGame();
  }

  // --- RENDER TABLE & GAME STATE ---
  function renderGame() {
    if (!v) return;

    const pv = mode === "local" ? v.turn : me;
    const op = 1 - pv;
    const isMyTurn = v.turn === pv && v.winner === null && !dealerThinking;
    const isOver = v.winner !== null;

    const myName = localStorage.getItem("player") || "YOU";
    const opName = mode === "dealer" ? "THE DEALER" : `Player ${op + 1}`;

    if (cover) {
      el.innerHTML = `
        <div class="br-container br-crt">
          <div class="br-scanlines"></div>
          <div class="br-cover-box">
            <h2>PASS DEVICE TO PLAYER ${v.turn + 1}</h2>
            <button class="br-btn br-btn-red" data-a="ready">I AM READY, SHOW TABLE</button>
          </div>
        </div>
      `;
      return;
    }

    // Build items trays
    const renderItems = (playerIdx, isClickable) => {
      const itemsList = v.items[playerIdx];
      if (!itemsList.length) return `<div class="br-item-empty">NO ITEMS ON TRAY</div>`;
      return itemsList.map((k, i) => {
        const it = ITEMS[k];
        if (isClickable && isMyTurn) {
          return `
            <button class="br-item-btn" data-i="${i}" title="${it.tip}">
              <span class="br-item-icon">${it.icon}</span>
              <span class="br-item-name">${it.name}</span>
            </button>
          `;
        }
        return `
          <div class="br-item-btn disabled" title="${it.tip}">
            <span class="br-item-icon">${it.icon}</span>
            <span class="br-item-name">${it.name}</span>
          </div>
        `;
      }).join("");
    };

    // Defibrillator defibrillation life cells
    const renderDefib = (lives, max, cuffed) => {
      let cells = "";
      for (let i = 0; i < max; i++) {
        const active = i < lives;
        cells += `<div class="br-defib-cell ${active ? "charged" : "dead"}"></div>`;
      }
      return `
        <div class="br-defib-monitor">
          <div class="br-defib-screen">
            <span class="br-defib-label">VOLTAGE</span>
            <div class="br-defib-cells">${cells}</div>
            <div class="br-defib-ecg ${lives <= 1 ? "critical" : ""}"></div>
          </div>
          ${cuffed ? `<div class="br-cuffs-badge">CUFFED ⛓️</div>` : ""}
        </div>
      `;
    };

    // Loaded shells rack
    const renderShellRack = () => {
      let shellsHtml = "";
      for (let i = 0; i < v.live; i++) {
        shellsHtml += `<div class="br-shell live" title="Live Shell (Red)"></div>`;
      }
      for (let i = 0; i < v.blank; i++) {
        shellsHtml += `<div class="br-shell blank" title="Blank Shell (Blue)"></div>`;
      }
      return shellsHtml;
    };

    el.innerHTML = `
      <div class="br-container br-crt ${animState.flash ? "br-flash-" + animState.flash : ""}">
        <div class="br-scanlines"></div>
        <div class="br-vignette"></div>

        <!-- TOP BAR: DEALER DEFIB & STATUS -->
        <header class="br-head">
          <div class="br-player-tag">
            <span class="br-tag-title">${opName}</span>
            ${renderDefib(v.lives[op], v.max, v.cuffed[op])}
          </div>
          <div class="br-chamber-info">
            <div class="br-round-banner">ROUND ${v.round}</div>
            <div class="br-shell-rack">
              <span class="br-rack-desc">${v.live} LIVE &bull; ${v.blank} BLANK</span>
              <div class="br-shells-view">${renderShellRack()}</div>
            </div>
            ${v.saw ? `<div class="br-saw-tag">BARREL SAWED OFF (2X DAMAGE)</div>` : ""}
          </div>
          <div class="br-player-tag align-right">
            <span class="br-tag-title">${myName} (YOU)</span>
            ${renderDefib(v.lives[pv], v.max, v.cuffed[pv])}
          </div>
        </header>

        <!-- 3D TABLE VIEWPORT -->
        <div class="br-table-viewport">
          <canvas id="brCanvas" width="900" height="420"></canvas>

          <!-- PEAK NOTIFICATION -->
          ${v.peek ? `
            <div class="br-peek-modal">
              <div class="br-peek-badge ${v.peek === "L" ? "live" : "blank"}">
                CHAMBER PEEK: ${v.peek === "L" ? "LIVE CARTRIDGE (RED)" : "BLANK CARTRIDGE (BLUE)"}
              </div>
            </div>
          ` : ""}

          ${v.phoneInfo ? `
            <div class="br-peek-modal">
              <div class="br-peek-badge">
                BURNER PHONE: SHELL #${v.phoneInfo.index} IS ${v.phoneInfo.shell === "L" ? "LIVE" : "BLANK"}
              </div>
            </div>
          ` : ""}

          ${dealerThinking ? `
            <div class="br-dealer-thinking">THE DEALER IS CONTEMPLATING...</div>
          ` : ""}
        </div>

        <!-- ITEMS TRAYS -->
        <div class="br-trays-container">
          <div class="br-tray">
            <div class="br-tray-header">YOUR ITEMS TRAY</div>
            <div class="br-items-row">${renderItems(pv, true)}</div>
          </div>
        </div>

        <!-- LOG & ACTION CONTROLS -->
        <footer class="br-foot">
          <div class="br-action-controls">
            <button class="br-btn br-btn-fire ${isMyTurn ? "active" : ""}" data-shoot="foe" ${isMyTurn ? "" : "disabled"}>
              <span class="br-btn-symbol">🎯</span>
              <span class="br-btn-label">SHOOT ${opName}</span>
            </button>
            <button class="br-btn br-btn-self ${isMyTurn ? "active" : ""}" data-shoot="self" ${isMyTurn ? "" : "disabled"}>
              <span class="br-btn-symbol">💀</span>
              <span class="br-btn-label">SHOOT YOURSELF</span>
              <span class="br-btn-hint">(Free turn if blank)</span>
            </button>
          </div>

          <div class="br-log-window">
            <ul class="br-log-list">
              ${v.log.map(item => `<li>${esc(item)}</li>`).join("")}
            </ul>
          </div>

          <div class="br-foot-actions">
            ${isOver ? `<button class="br-btn br-btn-stamp" data-a="again">REMATCH</button>` : ""}
            <button class="br-btn br-btn-subtle" data-a="menu">LEAVE TABLE</button>
          </div>
        </footer>
      </div>
    `;

    // Clear flash after momentary shock
    if (animState.flash) {
      setTimeout(() => { animState.flash = null; }, 180);
    }
  }

  // --- CANVAS TABLE ANIMATION (DEALER, SHOTGUN, LIGHTING) ---
  function animateTable() {
    const canvas = el.querySelector("#brCanvas");
    if (!canvas) {
      animFrameId = requestAnimationFrame(animateTable);
      return;
    }
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    // Time counter for breathing and swaying light
    const t = Date.now() * 0.002;
    const lampSway = Math.sin(t * 0.7) * 35;

    // Screen shake
    ctx.save();
    if (animState.shaking > 0) {
      const sx = (Math.random() - 0.5) * animState.shaking;
      const sy = (Math.random() - 0.5) * animState.shaking;
      ctx.translate(sx, sy);
      animState.shaking *= 0.88;
      if (animState.shaking < 0.5) animState.shaking = 0;
    }

    // 1. Dark Grungy Room Background
    ctx.fillStyle = "#0c0a0d";
    ctx.fillRect(0, 0, W, H);

    // Wall grime lines
    ctx.strokeStyle = "rgba(35, 28, 30, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * 0.5); ctx.stroke();
    }

    // 2. Concrete/Wood Table Top in Perspective
    const tableTopY = H * 0.44;
    const gradTable = ctx.createLinearGradient(0, tableTopY, 0, H);
    gradTable.addColorStop(0, "#2c1c14");
    gradTable.addColorStop(0.4, "#1d120d");
    gradTable.addColorStop(1, "#0f0907");
    ctx.fillStyle = gradTable;
    ctx.beginPath();
    ctx.moveTo(0, tableTopY + 20);
    ctx.lineTo(W, tableTopY + 20);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Table scratch lines and cigarette burns
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(W * 0.35, tableTopY + 70, 14, 0, Math.PI * 2);
    ctx.arc(W * 0.65, tableTopY + 110, 10, 0, Math.PI * 2);
    ctx.fill();

    // 3. Overhead Pendant Lamp Cone of Light
    const lampX = W * 0.5 + lampSway;
    const lampY = -20;
    const gradLight = ctx.createRadialGradient(lampX, 80, 20, lampX, 260, 420);
    gradLight.addColorStop(0, "rgba(255, 235, 170, 0.28)");
    gradLight.addColorStop(0.5, "rgba(220, 190, 120, 0.12)");
    gradLight.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradLight;
    ctx.beginPath();
    ctx.moveTo(lampX - 40, lampY);
    ctx.lineTo(lampX + 40, lampY);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // 4. THE DEALER (Across the Table)
    const dealerY = tableTopY + 10 + Math.sin(t * 1.2) * 4;
    const dealerX = W * 0.5;

    // Dealer shadowy torso
    ctx.fillStyle = "#110e13";
    ctx.beginPath();
    ctx.moveTo(dealerX - 160, tableTopY + 50);
    ctx.lineTo(dealerX - 90, dealerY - 100);
    ctx.lineTo(dealerX + 90, dealerY - 100);
    ctx.lineTo(dealerX + 160, tableTopY + 50);
    ctx.closePath();
    ctx.fill();

    // Dealer Head
    ctx.fillStyle = "#1a161f";
    ctx.beginPath();
    ctx.ellipse(dealerX, dealerY - 120, 68, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dealer Glowing Eyes
    const eyeFlicker = Math.random() > 0.96 ? 0.2 : 1;
    ctx.fillStyle = `rgba(255, 30, 30, ${0.85 * eyeFlicker})`;
    ctx.shadowColor = "#ff2200";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(dealerX - 25, dealerY - 125, 9, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(dealerX + 25, dealerY - 125, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset

    // Grinning needle teeth
    ctx.strokeStyle = "rgba(230, 220, 200, 0.75)";
    ctx.lineWidth = 2;
    for (let dx = -30; dx <= 30; dx += 8) {
      ctx.beginPath();
      ctx.moveTo(dealerX + dx, dealerY - 88);
      ctx.lineTo(dealerX + dx, dealerY - 74);
      ctx.stroke();
    }

    // 5. THE 12-GAUGE SHOTGUN (On the Table or Aiming)
    ctx.save();
    let gunX = W * 0.5;
    let gunY = tableTopY + 120;
    let gunAngle = 0;

    if (animState.aiming === "foe") {
      // Aiming up at Dealer
      gunAngle = -0.38;
      gunY = tableTopY + 100;
    } else if (animState.aiming === "self") {
      // Aiming toward player camera
      gunAngle = 0.55;
      gunY = tableTopY + 140;
    }

    ctx.translate(gunX, gunY);
    ctx.rotate(gunAngle);

    // Gun Stock (dark wood)
    ctx.fillStyle = "#3d2217";
    ctx.fillRect(-170, -10, 85, 20);

    // Gun Receiver (steel)
    ctx.fillStyle = "#22252a";
    ctx.fillRect(-85, -13, 75, 24);

    // Pump Slide (wood or ribbed plastic)
    ctx.fillStyle = "#4a2d1d";
    ctx.fillRect(0, -9, 45, 18);

    // Magazine Tube & Barrel
    const barrelLen = animState.sawed ? 80 : 160;
    ctx.fillStyle = "#16181b";
    ctx.fillRect(45, -11, barrelLen, 12); // main barrel
    ctx.fillRect(45, 1, barrelLen - 15, 8); // magazine tube

    // Muzzle flash on shot
    if (animState.flash) {
      ctx.fillStyle = animState.flash === "red" ? "#ff4411" : "#44bbff";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.arc(45 + barrelLen + 15, -5, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    ctx.restore(); // restore shake
    animFrameId = requestAnimationFrame(animateTable);
  }

  // --- NETWORKING (MULTIPLAYER) ---
  function wire() {
    conn.on("data", (d) => {
      if (mode === "host" && d && d.t === "act") {
        if (act(s, 1, d.a)) updateViews();
      } else if (mode === "guest" && d && d.t === "state") {
        try {
          v = d.v;
          renderGame();
        } catch {
          leave("Received invalid data from the host.");
        }
      }
    });
    conn.on("close", () => leave("Opponent disconnected."));
  }

  async function hostGame() {
    ensureAudio();
    renderMenu();
    try {
      const r = await host((c) => {
        if (conn) return c.close();
        conn = c;
        mode = "host";
        me = 0;
        s = newMatch(false);
        cover = false;
        wire();
        updateViews();
      });
      peer = r.peer;
      el.innerHTML = `
        <div class="br-container br-crt">
          <div class="br-scanlines"></div>
          <div class="br-menu-panel">
            <h2>ROOM CODE: <span class="br-gold">${r.code}</span></h2>
            <p>Share this code with your friend. Waiting for connection...</p>
            <button class="br-btn br-btn-subtle" data-a="menu">CANCEL</button>
          </div>
        </div>
      `;
    } catch (e) {
      leave(e.message || "Could not host game.");
    }
  }

  async function joinGame() {
    ensureAudio();
    const code = el.querySelector("#chCode").value;
    if (code.trim().length !== 4) return alert("Enter the 4-letter room code.");
    renderMenu();
    try {
      const r = await join(code);
      peer = r.peer;
      conn = r.conn;
      mode = "guest";
      me = 1;
      wire();
      el.innerHTML = `
        <div class="br-container br-crt">
          <div class="br-scanlines"></div>
          <div class="br-menu-panel">
            <h2>CONNECTED TO ROOM ${code}</h2>
            <p>Waiting for the host to start round...</p>
          </div>
        </div>
      `;
    } catch (e) {
      leave(e.message || "Could not join game.");
    }
  }

  // --- EVENT LISTENERS ---
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;

    if (d.m === "dealer") {
      mode = "dealer";
      startMatch();
    } else if (d.m === "local") {
      mode = "local";
      startMatch();
    } else if (d.m === "host") {
      hostGame();
    } else if (d.m === "join") {
      joinGame();
    } else if (d.shoot) {
      play({ t: "shoot", target: d.shoot });
    } else if (d.i !== undefined) {
      play({ t: "item", i: Number(d.i) });
    } else if (d.a === "ready") {
      cover = false;
      renderGame();
    } else if (d.a === "again") {
      startMatch();
    } else if (d.a === "menu") {
      leave();
    }
  });

  // Start with Intro Sequence
  if (inIntro) {
    renderIntro();
  } else {
    renderMenu();
  }

  return stop;
}

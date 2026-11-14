// Buckshot Roulette - Authentic Web Edition
// Features: Cinematic Entry & Waiver, Loading Phase with Hidden Shells, Intelligent Dealer AI, Online Multiplayer, Procedural WebAudio
import { newMatch, act, view, dealerThink, finishLoadingPhase, ITEMS } from "./chamber-engine.js";
import { host, join } from "./chamber-net.js";
import { sounds } from "./chamber-audio.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function mount(el) {
  let s = null, v = null, mode = "dealer", me = 0, conn = null, peer = null;
  let cover = false, note = "";
  let inIntro = true;
  let introStep = "terminal";
  let isActionBusy = false;
  let dealerThinking = false;
  let animState = { aiming: "idle", shaking: 0, flash: null, sawed: false, ejectedCasings: [] };
  let animFrameId = null;
  let loadingTimer = null;

  const stop = () => {
    try { peer && peer.destroy(); } catch {}
    peer = conn = null;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (loadingTimer) clearTimeout(loadingTimer);
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

  const ensureAudio = () => {
    sounds.init();
  };

  // --- INTRO CUTSCENE ---
  function renderIntro() {
    el.innerHTML = `
      <div class="br-container br-crt">
        <div class="br-scanlines"></div>
        <div class="br-intro-screen">
          ${introStep === "terminal" ? `
            <div class="br-terminal">
              <div class="br-term-header">SYSTEM_BOOT // BASEMENT_TERMINAL_V3</div>
              <p class="br-term-line delay-1">> FEED: LIVE UNDERGROUND CLUB</p>
              <p class="br-term-line delay-2">> 12-GAUGE PUMP ACTION LOADED</p>
              <p class="br-term-line delay-3">> DEALER AWAITING CONTESTANT...</p>
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
                    <p>I agree that neither the venue nor the Dealer shall be held accountable for lead buckshot perforations, defibrillator overload, or sudden cardiac expiration.</p>
                    <p>Rounds are loaded with an undisclosed sequence of LIVE and BLANK cartridges. All items placed on the table are final.</p>
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
            <h1 class="br-glitch">BUCKSHOT ROULETTE</h1>
            <p class="br-sub">12-GAUGE VOLTAGE & BLOOD</p>
          </div>
          <div class="br-menu-buttons">
            <button class="br-btn br-btn-red br-big" data-m="dealer">VS THE DEALER (SOLO)</button>
            <button class="br-btn br-btn-wood" data-m="local">LOCAL 2 PLAYERS (ONE SCREEN)</button>
            <button class="br-btn br-btn-wood" data-m="host">HOST ONLINE GAME (P2P)</button>
            <div class="br-join-group">
              <input id="chCode" maxlength="4" placeholder="ROOM" aria-label="Room code" />
              <button class="br-btn br-btn-blue" data-m="join">JOIN GAME</button>
            </div>
          </div>
          ${note ? `<p class="br-status-note">${esc(note)}</p>` : ""}
          <details class="br-rules-fold">
            <summary>RULES OF THE TABLE</summary>
            <ul>
              <li>At the start of each reload, the loaded shells are shown <strong>ONCE</strong> before being fed into the shotgun. Memorize them!</li>
              <li>Aim at opponent to deal damage. Aim at yourself: if BLANK, you take another turn; if LIVE, you lose 1 life!</li>
              <li><strong>ITEMS:</strong> Magnifier (peek chamber), Beer (eject shell), Cigarette (+1 life), Handcuffs (skip turn), Saw (2x damage), Inverter (flip shell), Burner Phone (future intel).</li>
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
    isActionBusy = false;
    animState = { aiming: "idle", shaking: 0, flash: null, sawed: false, ejectedCasings: [] };
    s = newMatch(mode === "dealer");
    v = view(s, 0);
    renderGame();
    animateTable();
    checkLoadingPhase();
  }

  // Handles the brief loading phase where shells are revealed once, then hidden into the gun
  function checkLoadingPhase() {
    if (!s || !s.loadingPhase) return;

    // Play shell insert sounds during loading
    let delay = 350;
    for (let i = 0; i < s.chamber.length; i++) {
      setTimeout(() => { sounds.playShellInsert(); }, delay);
      delay += 400;
    }

    // Rack shotgun at the end of loading
    setTimeout(() => {
      sounds.playPumpRack();
    }, delay + 200);

    // End loading phase after shells are loaded
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      if (!s) return;
      finishLoadingPhase(s);
      updateViews();

      // If it's Dealer's turn first, let Dealer act
      if (mode === "dealer" && s.turn === 1 && s.winner === null) {
        queueDealerTurn();
      }
    }, delay + 800);
  }

  // Executes an action for a specific player (0 = Player 1, 1 = Player 2 / Dealer)
  function executeAction(a, playerIdx) {
    if (!s || isActionBusy || s.loadingPhase) return;
    ensureAudio();

    const foe = 1 - playerIdx;
    isActionBusy = true;

    // Item audio & animations
    if (a.t === "item" && Number.isInteger(a.i)) {
      const it = s.items[playerIdx][a.i];
      if (it === "cigarette") sounds.playCigarette();
      else if (it === "beer") {
        sounds.playBeerOpen();
        sounds.playPumpRack();
        animState.ejectedCasings.push({
          type: s.chamber[0],
          x: 450 + (Math.random() * 80 - 40),
          y: 260 + (Math.random() * 40 - 20),
          rot: Math.random() * Math.PI
        });
        setTimeout(() => { sounds.playShellBounce(); }, 300);
      } else if (it === "cuffs") sounds.playCuffs();
      else if (it === "saw") { sounds.playSaw(); animState.sawed = true; }
      else if (it === "magnifier") sounds.playMagnifier();
      else if (it === "phone") sounds.playHeartbeat(true);
      else if (it === "inverter") sounds.playBlankClick();

      act(s, playerIdx, a);
      isActionBusy = false;
      updateViews();

      if (mode === "dealer" && s.turn === 1 && s.winner === null) {
        queueDealerTurn();
      }
      return;
    }

    // Shotgun firing logic & animations
    if (a.t === "shoot") {
      animState.aiming = a.target === "self" ? "self" : "foe";
      sounds.playPumpRack();

      setTimeout(() => {
        if (!s) return;
        const currentShell = s.chamber[0];

        if (currentShell === "L") {
          sounds.playShotgunBlast();
          animState.flash = "red";
          animState.shaking = 24;
          animState.ejectedCasings.push({
            type: "L",
            x: 450 + (Math.random() * 100 - 50),
            y: 270 + (Math.random() * 50 - 25),
            rot: Math.random() * Math.PI
          });
          setTimeout(() => { sounds.playShellBounce(); }, 350);
        } else {
          sounds.playBlankClick();
          animState.flash = "cyan";
          animState.shaking = 7;
          animState.ejectedCasings.push({
            type: "B",
            x: 450 + (Math.random() * 100 - 50),
            y: 270 + (Math.random() * 50 - 25),
            rot: Math.random() * Math.PI
          });
          setTimeout(() => { sounds.playShellBounce(); }, 350);
        }

        const wasReloadNeededBefore = s.chamber.length <= 1;
        act(s, playerIdx, a);

        setTimeout(() => {
          animState.aiming = "idle";
          isActionBusy = false;

          // If local two-player and turn switched, show cover screen
          if (mode === "local" && s.turn !== playerIdx && s.winner === null) {
            cover = true;
          }

          updateViews();

          // If a new reload started, run the loading phase
          if (wasReloadNeededBefore && s.loadingPhase) {
            checkLoadingPhase();
          } else if (mode === "dealer" && s.turn === 1 && s.winner === null) {
            queueDealerTurn();
          }
        }, 500);
      }, 400);
    }
  }

  function queueDealerTurn() {
    if (!s || s.turn !== 1 || s.winner !== null || s.loadingPhase) return;
    dealerThinking = true;
    renderGame();

    setTimeout(() => {
      dealerThinking = false;
      if (!s || s.turn !== 1 || s.winner !== null || s.loadingPhase) {
        renderGame();
        return;
      }

      const decision = dealerThink(s);
      if (decision) {
        executeAction(decision, 1);
      }
    }, 1300);
  }

  function updateViews() {
    if (!s) return;
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

  // --- RENDER TABLE UI ---
  function renderGame() {
    if (!v) return;

    const pv = mode === "local" ? v.turn : me;
    const op = 1 - pv;
    const isMyTurn = v.turn === pv && v.winner === null && !dealerThinking && !isActionBusy && !v.loadingPhase;
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

    // Render Items Tray
    const renderItems = (playerIdx, isClickable) => {
      const itemsList = v.items[playerIdx] || [];
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

    // Defibrillator Voltage Cells
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

    // Magazine Shells Status:
    // If in loadingPhase: shows the live (red) and blank (blue) shells!
    // After loadingPhase: SHELLS ARE HIDDEN! Only unknown mystery shell icons appear!
    const renderShellDisplay = () => {
      if (v.loadingPhase && v.visibleShells) {
        return `
          <div class="br-loading-banner">
            <span class="br-loading-title">DEALER LOADING CHAMBER:</span>
            <span class="br-loading-counts">${v.live} LIVE &bull; ${v.blank} BLANK</span>
            <div class="br-shells-view">
              ${v.visibleShells.map(sh => `<div class="br-shell ${sh === "L" ? "live" : "blank"}"></div>`).join("")}
            </div>
            <span class="br-loading-sub">MEMORIZE THE SEQUENCE...</span>
          </div>
        `;
      } else {
        // Unknown mystery shells
        let mysteryShells = "";
        for (let i = 0; i < v.left; i++) {
          mysteryShells += `<div class="br-shell mystery" title="Mystery Shell in Tube">?</div>`;
        }
        return `
          <div class="br-chamber-info">
            <div class="br-round-banner">ROUND ${v.round}</div>
            <span class="br-rack-desc">${v.left} SHELL${v.left === 1 ? "" : "S"} IN MAGAZINE</span>
            <div class="br-shells-view">${mysteryShells}</div>
            ${v.saw ? `<div class="br-saw-tag">BARREL SAWED OFF (2X DAMAGE)</div>` : ""}
          </div>
        `;
      }
    };

    el.innerHTML = `
      <div class="br-container br-crt ${animState.flash ? "br-flash-" + animState.flash : ""}">
        <div class="br-scanlines"></div>
        <div class="br-vignette"></div>

        <!-- TOP BAR: OPPONENT & PLAYER DEFIB -->
        <header class="br-head">
          <div class="br-player-tag">
            <span class="br-tag-title">${opName}</span>
            ${renderDefib(v.lives[op], v.max, v.cuffed[op])}
          </div>
          
          <div class="br-center-display">
            ${renderShellDisplay()}
          </div>

          <div class="br-player-tag align-right">
            <span class="br-tag-title">${myName} (YOU)</span>
            ${renderDefib(v.lives[pv], v.max, v.cuffed[pv])}
          </div>
        </header>

        <!-- 3D TABLE VIEWPORT -->
        <div class="br-table-viewport">
          <canvas id="brCanvas" width="900" height="420"></canvas>

          <!-- ITEM OVERLAYS -->
          ${v.peek ? `
            <div class="br-peek-modal">
              <div class="br-peek-badge ${v.peek === "L" ? "live" : "blank"}">
                MAGNIFIER INSPECTION: ${v.peek === "L" ? "LIVE (RED)" : "BLANK (BLUE)"}
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
            <div class="br-dealer-thinking">THE DEALER IS CONTEMPLATING HIS MOVE...</div>
          ` : ""}

          ${isOver ? `
            <div class="br-over-modal">
              <h2 class="br-over-title">${v.winner === 1 && v.isDealer ? "THE DEALER PREVAILED" : "YOU SURVIVED"}</h2>
              <button class="br-btn br-btn-red br-big" data-a="again">PLAY AGAIN</button>
            </div>
          ` : ""}
        </div>

        <!-- ITEMS TRAY -->
        <div class="br-trays-container">
          <div class="br-tray">
            <div class="br-tray-header">YOUR ITEMS TRAY</div>
            <div class="br-items-row">${renderItems(pv, true)}</div>
          </div>
        </div>

        <!-- ACTION CONTROLS & LOG -->
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
            <button class="br-btn br-btn-subtle" data-a="menu">LEAVE TABLE</button>
          </div>
        </footer>
      </div>
    `;

    if (animState.flash) {
      setTimeout(() => { animState.flash = null; }, 200);
    }
  }

  // --- CANVAS TABLE ANIMATIONS (CRISP & DETAILED) ---
  function animateTable() {
    const canvas = el.querySelector("#brCanvas");
    if (!canvas) {
      animFrameId = requestAnimationFrame(animateTable);
      return;
    }
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    const t = Date.now() * 0.002;
    const lampSway = Math.sin(t * 0.6) * 35;

    ctx.save();
    if (animState.shaking > 0) {
      const sx = (Math.random() - 0.5) * animState.shaking;
      const sy = (Math.random() - 0.5) * animState.shaking;
      ctx.translate(sx, sy);
      animState.shaking *= 0.88;
      if (animState.shaking < 0.5) animState.shaking = 0;
    }

    // 1. Dark Bunker Wall & Ambient Grime
    ctx.fillStyle = "#0a080d";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(45, 35, 40, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 55) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * 0.48); ctx.stroke();
    }

    // 2. Heavy Scratched Metal/Wood Table Surface
    const tableTopY = H * 0.43;
    const gradTable = ctx.createLinearGradient(0, tableTopY, 0, H);
    gradTable.addColorStop(0, "#281b14");
    gradTable.addColorStop(0.35, "#1c110b");
    gradTable.addColorStop(1, "#0c0705");
    ctx.fillStyle = gradTable;
    ctx.beginPath();
    ctx.moveTo(0, tableTopY + 15);
    ctx.lineTo(W, tableTopY + 15);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Table divider line
    ctx.strokeStyle = "rgba(180, 150, 100, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, tableTopY + 15);
    ctx.lineTo(W, tableTopY + 15);
    ctx.stroke();

    // Bloodstains & cigarette burn marks
    ctx.fillStyle = "rgba(70, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(W * 0.38, tableTopY + 85, 28, 16, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 10, 8, 0.7)";
    ctx.beginPath();
    ctx.arc(W * 0.68, tableTopY + 110, 12, 0, Math.PI * 2);
    ctx.fill();

    // 3. Swaying Overhead Pendant Light Cone
    const lampX = W * 0.5 + lampSway;
    const lampY = -25;
    const gradLight = ctx.createRadialGradient(lampX, 80, 20, lampX, 260, 420);
    gradLight.addColorStop(0, "rgba(255, 235, 175, 0.3)");
    gradLight.addColorStop(0.5, "rgba(220, 190, 125, 0.12)");
    gradLight.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradLight;
    ctx.beginPath();
    ctx.moveTo(lampX - 45, lampY);
    ctx.lineTo(lampX + 45, lampY);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // 4. THE DEALER (High Detail Sinister Silhouette)
    const dealerY = tableTopY + 12 + Math.sin(t * 1.3) * 3;
    const dealerX = W * 0.5;

    // Dark trenchcoat torso
    ctx.fillStyle = "#120f14";
    ctx.beginPath();
    ctx.moveTo(dealerX - 170, tableTopY + 50);
    ctx.lineTo(dealerX - 95, dealerY - 105);
    ctx.lineTo(dealerX + 95, dealerY - 105);
    ctx.lineTo(dealerX + 170, tableTopY + 50);
    ctx.closePath();
    ctx.fill();

    // Coat lapel lines
    ctx.strokeStyle = "#251e2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dealerX - 40, dealerY - 100);
    ctx.lineTo(dealerX, tableTopY + 40);
    ctx.lineTo(dealerX + 40, dealerY - 100);
    ctx.stroke();

    // Head
    ctx.fillStyle = "#1c1722";
    ctx.beginPath();
    ctx.ellipse(dealerX, dealerY - 125, 65, 78, 0, 0, Math.PI * 2);
    ctx.fill();

    // Piercing Red Glowing Eyes
    const eyeBlink = Math.random() > 0.97 ? 0.1 : 1;
    ctx.fillStyle = `rgba(255, 25, 25, ${0.9 * eyeBlink})`;
    ctx.shadowColor = "#ff2200";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(dealerX - 24, dealerY - 130, 9, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(dealerX + 24, dealerY - 130, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Jagged needle teeth
    ctx.strokeStyle = "rgba(240, 230, 210, 0.85)";
    ctx.lineWidth = 2;
    for (let dx = -32; dx <= 32; dx += 8) {
      ctx.beginPath();
      ctx.moveTo(dealerX + dx, dealerY - 92);
      ctx.lineTo(dealerX + dx, dealerY - 76);
      ctx.stroke();
    }

    // 5. EJECTED SPENT CASINGS ON TABLE
    for (const c of animState.ejectedCasings) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.type === "L" ? "#991111" : "#114499";
      ctx.fillRect(-12, -4, 24, 8);
      ctx.fillStyle = "#cca845"; // brass rim
      ctx.fillRect(-15, -5, 4, 10);
      ctx.restore();
    }

    // 6. THE 12-GAUGE SHOTGUN (3D Perspective)
    ctx.save();
    let gunX = W * 0.5;
    let gunY = tableTopY + 120;
    let gunAngle = 0;

    if (animState.aiming === "foe") {
      gunAngle = -0.38;
      gunY = tableTopY + 95;
    } else if (animState.aiming === "self") {
      gunAngle = 0.55;
      gunY = tableTopY + 145;
    }

    ctx.translate(gunX, gunY);
    ctx.rotate(gunAngle);

    // Walnut wood stock
    ctx.fillStyle = "#3e2417";
    ctx.fillRect(-175, -11, 88, 22);

    // Steel receiver
    ctx.fillStyle = "#22252a";
    ctx.fillRect(-87, -14, 76, 26);

    // Ejection port on receiver
    ctx.fillStyle = "#0c0d0f";
    ctx.fillRect(-55, -12, 28, 8);

    // Ribbed pump slide forend
    ctx.fillStyle = "#4a2d1d";
    ctx.fillRect(0, -10, 48, 19);

    // Barrel & Magazine Tube
    const barrelLen = animState.sawed ? 82 : 165;
    ctx.fillStyle = "#16181b";
    ctx.fillRect(48, -12, barrelLen, 13);
    ctx.fillRect(48, 1, barrelLen - 15, 9);

    // Brass bead sight
    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.arc(48 + barrelLen - 2, -13, 2, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle flash on shot
    if (animState.flash) {
      ctx.fillStyle = animState.flash === "red" ? "#ff4411" : "#44bbff";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(48 + barrelLen + 20, -5, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    ctx.restore();
    animFrameId = requestAnimationFrame(animateTable);
  }

  // --- MULTIPLAYER P2P (WEBRTC) ---
  function wireMultiplayer() {
    conn.on("data", (d) => {
      if (mode === "host" && d && d.t === "act") {
        executeAction(d.a, 1);
      } else if (mode === "guest" && d && d.t === "state") {
        try {
          v = d.v;
          renderGame();
        } catch {
          leave("Received invalid state from host.");
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
        isActionBusy = false;
        wireMultiplayer();
        renderGame();
        animateTable();
        checkLoadingPhase();
      });
      peer = r.peer;
      el.innerHTML = `
        <div class="br-container br-crt">
          <div class="br-scanlines"></div>
          <div class="br-menu-panel">
            <h2>ONLINE ROOM CODE: <span class="br-gold">${r.code}</span></h2>
            <p class="br-sub">Tell your friend to enter this code in "JOIN GAME". Waiting for connection...</p>
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
    const code = el.querySelector("#chCode").value.toUpperCase().trim();
    if (code.length !== 4) return alert("Enter the 4-letter room code.");
    renderMenu();
    try {
      const r = await join(code);
      peer = r.peer;
      conn = r.conn;
      mode = "guest";
      me = 1;
      wireMultiplayer();
      animateTable();
      el.innerHTML = `
        <div class="br-container br-crt">
          <div class="br-scanlines"></div>
          <div class="br-menu-panel">
            <h2>CONNECTED TO ROOM ${code}</h2>
            <p class="br-sub">Waiting for host to begin round...</p>
          </div>
        </div>
      `;
    } catch (e) {
      leave(e.message || "Could not join game.");
    }
  }

  // --- EVENT DISPATCHER ---
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
      if (mode === "guest") {
        conn && conn.send({ t: "act", a: { t: "shoot", target: d.shoot } });
      } else {
        executeAction({ t: "shoot", target: d.shoot }, mode === "local" ? s.turn : 0);
      }
    } else if (d.i !== undefined) {
      if (mode === "guest") {
        conn && conn.send({ t: "act", a: { t: "item", i: Number(d.i) } });
      } else {
        executeAction({ t: "item", i: Number(d.i) }, mode === "local" ? s.turn : 0);
      }
    } else if (d.a === "ready") {
      cover = false;
      renderGame();
    } else if (d.a === "again") {
      startMatch();
    } else if (d.a === "menu") {
      leave();
    }
  });

  if (inIntro) {
    renderIntro();
  } else {
    renderMenu();
  }

  return stop;
}

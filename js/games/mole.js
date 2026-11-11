export default {
  id: 'mole',
  title: 'Whack a Mole',
  accent: '#2ea043',

  ctx: null,
  container: null,

  score: 0,
  timeLeft: 30,
  isPlaying: false,
  activeHoles: Array(9).fill(null), // null | 'regular' | 'golden'
  spawnTimer: null,
  clockTimer: null,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame" style="padding:12px; background:var(--bg-panel); border:1px solid var(--border-line); border-radius:8px;">
          <div id="moleHolesGrid" style="display:grid; grid-template-columns:repeat(3, 86px); grid-template-rows:repeat(3, 86px); gap:10px; background:var(--bg-base); padding:10px; border-radius:6px; border:1px solid var(--border-line);">
            ${Array(9).fill(0).map((_, i) => `
              <div class="mole-hole" data-idx="${i}" style="position:relative; width:86px; height:86px; background:#161b22; border:1px solid var(--border-line); border-radius:50%; overflow:hidden; cursor:pointer;">
                <div class="mole-actor" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:700; transform:translateY(100%); transition:transform 0.12s ease-out; user-select:none;"></div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="padding:12px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:center;">
              <div>
                <span class="t-label">Score</span>
                <div id="moleScore" class="t-val" style="font-size:1.8rem; color:var(--status-win); margin-top:2px;">0</div>
              </div>
              <div>
                <span class="t-label">Time Left</span>
                <div id="moleTime" class="t-val" style="font-size:1.8rem; margin-top:2px;">30s</div>
              </div>
            </div>
          </div>

          <div class="telemetry-cell" style="padding:10px; text-align:center;">
            <p style="font-size:0.75rem; color:var(--text-sub); line-height:1.4;">
              Mole = 10 pts &bull; Golden Mole = 30 pts<br>
              Tap as fast as they appear!
            </p>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start() {
    this.score = 0;
    this.timeLeft = 30;
    this.isPlaying = true;
    this.activeHoles = Array(9).fill(null);

    this.clearTimers();
    this.resetAllHolesVisual();
    this.updateUI();

    this.clockTimer = setInterval(() => {
      this.timeLeft--;
      this.updateUI();
      if (this.timeLeft <= 0) {
        this.endMatch();
      }
    }, 1000);

    this.startSpawning();
  },

  startSpawning() {
    const popCycle = () => {
      if (!this.isPlaying) return;

      const emptyIndices = [];
      this.activeHoles.forEach((val, idx) => {
        if (val === null) emptyIndices.push(idx);
      });

      if (emptyIndices.length > 0) {
        const pickIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const isGolden = Math.random() < 0.2;
        const moleType = isGolden ? 'golden' : 'regular';

        this.showMole(pickIdx, moleType);

        const stayDuration = Math.max(500, 950 - (30 - this.timeLeft) * 15);
        setTimeout(() => {
          if (this.activeHoles[pickIdx] !== null) {
            this.hideMole(pickIdx);
          }
        }, stayDuration);
      }

      const nextSpawnDelay = Math.max(350, 750 - (30 - this.timeLeft) * 12);
      this.spawnTimer = setTimeout(popCycle, nextSpawnDelay);
    };

    popCycle();
  },

  showMole(idx, type) {
    this.activeHoles[idx] = type;
    const hole = document.querySelector(`.mole-hole[data-idx="${idx}"]`);
    if (!hole) return;

    const actor = hole.querySelector('.mole-actor');
    if (actor) {
      actor.textContent = type === 'golden' ? 'G' : 'M';
      actor.style.color = type === 'golden' ? 'var(--status-coin)' : '#ffffff';
      actor.style.transform = 'translateY(0%)';
    }
  },

  hideMole(idx) {
    this.activeHoles[idx] = null;
    const hole = document.querySelector(`.mole-hole[data-idx="${idx}"]`);
    if (!hole) return;

    const actor = hole.querySelector('.mole-actor');
    if (actor) {
      actor.style.transform = 'translateY(100%)';
    }
  },

  setupListeners() {
    const grid = document.getElementById('moleHolesGrid');
    if (!grid) return;

    grid.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying) return;
      const hole = e.target.closest('.mole-hole');
      if (!hole) return;

      const idx = parseInt(hole.getAttribute('data-idx'), 10);
      const moleType = this.activeHoles[idx];

      if (moleType !== null) {
        const points = (moleType === 'golden') ? 30 : 10;
        this.score += points;

        if (moleType === 'golden') {
          this.ctx.fx.playTone(880, 'sine', 0.05, 0.15);
        } else {
          this.ctx.fx.playTone(520, 'triangle', 0.03, 0.12);
        }

        this.ctx.fx.shake('soft');

        const actor = hole.querySelector('.mole-actor');
        if (actor) {
          actor.textContent = '+';
        }

        this.activeHoles[idx] = null;
        setTimeout(() => this.hideMole(idx), 100);

        this.updateUI();
      }
    });
  },

  resetAllHolesVisual() {
    document.querySelectorAll('.mole-actor').forEach(actor => {
      actor.style.transform = 'translateY(100%)';
      actor.textContent = '';
    });
  },

  updateUI() {
    const sEl = document.getElementById('moleScore');
    const tEl = document.getElementById('moleTime');
    if (sEl) sEl.textContent = this.score;
    if (tEl) tEl.textContent = `${this.timeLeft}s`;
  },

  endMatch() {
    this.isPlaying = false;
    this.clearTimers();
    this.resetAllHolesVisual();

    const isWin = (this.score >= 120);

    if (isWin) {
      this.ctx.fx.sfx.victory();
    } else {
      this.ctx.fx.sfx.defeat();
    }

    this.ctx.recordResult(isWin ? 'WIN' : 'LOSS', {
      score: this.score,
      summary: `Score: ${this.score} pts (${isWin ? 'Target Beat!' : 'Try Again'})`
    });
  },

  clearTimers() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.spawnTimer) clearTimeout(this.spawnTimer);
  },

  pause() {
    this.isPlaying = false;
    this.clearTimers();
  },

  resume() {
    if (this.timeLeft > 0 && !this.isPlaying) {
      this.isPlaying = true;
      this.clockTimer = setInterval(() => {
        this.timeLeft--;
        this.updateUI();
        if (this.timeLeft <= 0) this.endMatch();
      }, 1000);
      this.startSpawning();
    }
  },

  restart() {
    this.start();
  },

  destroy() {
    this.clearTimers();
    this.container = null;
  }
};
// mole.js: Whack-a-Mole. 3 by 3 holes, 30 seconds, score 120 to win.
// All timers go through ctx.scheduler, so the pause menu stops them too.
const moleFace = (fill) => `<svg viewBox="0 0 48 48" width="54" height="54" aria-hidden="true"><ellipse cx="24" cy="28" rx="17" ry="16" fill="${fill}" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="24" r="2.4" fill="currentColor"/><circle cx="31" cy="24" r="2.4" fill="currentColor"/><ellipse cx="24" cy="31" rx="4.5" ry="3.2" fill="#d8504e" stroke="currentColor" stroke-width="1.4"/></svg>`;
const HIT_BURST = '<svg viewBox="0 0 48 48" width="54" height="54" aria-hidden="true"><path d="M24 3l4.5 10.5L39 9l-4.5 10.5L45 24l-10.5 4.5L39 39l-10.5-4.5L24 45l-4.5-10.5L9 39l4.5-10.5L3 24l10.5-4.5L9 9l10.5 4.5z" fill="#f2b705" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

export default {
  id: 'mole',
  title: 'Whack-a-Mole',
  accent: '#9a6b52',

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
        <div class="arena-board-frame" style="padding:12px;">
          <div id="moleHolesGrid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; width:min(calc(100vw - 54px), 330px); background:var(--bg-base); padding:12px; border-radius:6px; border:1.5px solid var(--border-line);">
            ${Array(9).fill(0).map((_, i) => `
              <div class="mole-hole" data-idx="${i}">
                <div class="mole-actor"></div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
              <div>
                <span class="stat-label">Score</span>
                <div id="moleScore" class="stat-value" style="font-size:2.2rem;">0</div>
              </div>
              <div>
                <span class="stat-label">Time left</span>
                <div id="moleTime" class="stat-value" style="font-size:2.2rem;">30s</div>
              </div>
            </div>
          </div>

          <div class="stat-label" style="text-align:center;">
            Brown mole 10 points, golden mole 30. Get to 120 to win.
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

    this.clockTimer = this.ctx.scheduler.every(1000, () => {
      this.timeLeft--;
      this.updateUI();
      if (this.timeLeft <= 0) {
        this.endMatch();
      }
    });

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
        const isGolden = Math.random() < 0.22;
        const moleType = isGolden ? 'golden' : 'regular';

        this.showMole(pickIdx, moleType);

        // moles stay for less time as the clock runs down
        const stayDuration = Math.max(500, 950 - (30 - this.timeLeft) * 15);
        this.ctx.scheduler.after(stayDuration, () => {
          if (this.activeHoles[pickIdx] !== null) {
            this.hideMole(pickIdx);
          }
        });
      }

      const nextSpawnDelay = Math.max(350, 750 - (30 - this.timeLeft) * 12);
      this.spawnTimer = this.ctx.scheduler.after(nextSpawnDelay, popCycle);
    };

    popCycle();
  },

  showMole(idx, type) {
    this.activeHoles[idx] = type;
    const hole = document.querySelector(`.mole-hole[data-idx="${idx}"]`);
    if (!hole) return;

    const actor = hole.querySelector('.mole-actor');
    if (actor) {
      actor.innerHTML = moleFace(type === 'golden' ? '#f2b705' : '#9a6b52');
      actor.style.transform = 'translateY(8%)';
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
          this.ctx.fx.playTone(880, 'sine', 0.05, 0.2);
        } else {
          this.ctx.fx.playTone(520, 'triangle', 0.03, 0.15);
        }

        this.ctx.fx.shake('soft');

        const actor = hole.querySelector('.mole-actor');
        if (actor) {
          actor.innerHTML = HIT_BURST;
        }

        this.activeHoles[idx] = null;
        this.ctx.scheduler.after(120, () => this.hideMole(idx));

        this.updateUI();
      }
    });
  },

  resetAllHolesVisual() {
    document.querySelectorAll('.mole-actor').forEach(actor => {
      actor.style.transform = 'translateY(100%)';
      actor.innerHTML = '';
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

    this.ctx.recordResult(isWin ? 'WIN' : 'LOSS', {
      score: this.score,
      summary: isWin
        ? `You scored ${this.score}. That beats the 120 target.`
        : `You scored ${this.score}. You needed 120.`
    });
  },

  clearTimers() {
    if (this.clockTimer) this.ctx.scheduler.cancel(this.clockTimer);
    if (this.spawnTimer) this.ctx.scheduler.cancel(this.spawnTimer);
  },

  // the scheduler is paused by the app, nothing to do here
  pause() {},
  resume() {},

  restart() {
    this.start();
  },

  destroy() {
    this.isPlaying = false;
    this.container = null;
  }
};
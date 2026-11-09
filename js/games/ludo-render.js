/**
 * js/games/ludo-render.js
 * Physical Classic Ludo Board & Plastic Pawns Canvas 2D Engine
 * Flat cabinet aesthetic, 2px outlines, crisp paper texture, zero diffuse glow
 */

import {
  LUDO_PALETTE,
  LUDO_CONFIG,
  TRACK_COORDINATES,
  HOME_COLUMNS,
  YARD_WELL_COORDINATES,
  CENTER_GOAL_COORDINATES,
  LudoRules
} from './ludo-rules.js';

export class LudoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.offscreenBoard = null;
    this.paperPattern = null;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.boardSize = 540;
    this.cellSize = 36;

    this.colorBlindMode = false;
    this.initOffscreenSurfaces();
  }

  setColorBlind(enabled) {
    this.colorBlindMode = !!enabled;
  }

  resize(displaySize) {
    const size = Math.floor(displaySize);
    this.boardSize = size;
    this.cellSize = size / 15;

    this.canvas.width = Math.floor(size * this.dpr);
    this.canvas.height = Math.floor(size * this.dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.renderStaticBoardToCache();
  }

  initOffscreenSurfaces() {
    this.createPaperTexture();
    this.renderStaticBoardToCache();
  }

  createPaperTexture() {
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 128;
    texCanvas.height = 128;
    const tCtx = texCanvas.getContext('2d');

    tCtx.fillStyle = LUDO_PALETTE.PAPER;
    tCtx.fillRect(0, 0, 128, 128);

    const imgData = tCtx.getImageData(0, 0, 128, 128);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 6;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    tCtx.putImageData(imgData, 0, 0);

    tCtx.fillStyle = 'rgba(43, 43, 43, 0.025)';
    for (let j = 0; j < 25; j++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      tCtx.fillRect(x, y, 1.5, 1.5);
    }

    this.paperPattern = this.ctx.createPattern(texCanvas, 'repeat');
  }

  renderStaticBoardToCache() {
    this.offscreenBoard = document.createElement('canvas');
    this.offscreenBoard.width = Math.floor(this.boardSize * this.dpr);
    this.offscreenBoard.height = Math.floor(this.boardSize * this.dpr);
    const bCtx = this.offscreenBoard.getContext('2d');

    bCtx.scale(this.dpr, this.dpr);

    const s = this.boardSize;
    const c = this.cellSize;

    // Dark solid wood outer frame
    bCtx.fillStyle = LUDO_PALETTE.FRAME;
    bCtx.beginPath();
    bCtx.roundRect(0, 0, s, s, 12);
    bCtx.fill();

    bCtx.strokeStyle = '#140b05';
    bCtx.lineWidth = 2;
    bCtx.strokeRect(1, 1, s - 2, s - 2);

    // Paper playing field
    const inset = 6;
    bCtx.save();
    bCtx.beginPath();
    bCtx.roundRect(inset, inset, s - inset * 2, s - inset * 2, 8);
    bCtx.clip();

    if (this.paperPattern) {
      bCtx.fillStyle = this.paperPattern;
      bCtx.fillRect(0, 0, s, s);
    } else {
      bCtx.fillStyle = LUDO_PALETTE.PAPER;
      bCtx.fillRect(0, 0, s, s);
    }

    // 4 Corner Yards
    this.drawYard(bCtx, 0, 0, LUDO_PALETTE.RED, 'RED');
    this.drawYard(bCtx, 9, 0, LUDO_PALETTE.GREEN, 'GREEN');
    this.drawYard(bCtx, 9, 9, LUDO_PALETTE.YELLOW, 'YELLOW');
    this.drawYard(bCtx, 0, 9, LUDO_PALETTE.BLUE, 'BLUE');

    // Outer Track Cells
    for (let i = 0; i < LUDO_CONFIG.TRACK_LENGTH; i++) {
      const [col, row] = TRACK_COORDINATES[i];
      const x = col * c;
      const y = row * c;

      if (i === 0) {
        bCtx.fillStyle = LUDO_PALETTE.RED;
        bCtx.fillRect(x, y, c, c);
        this.drawStartArrow(bCtx, x, y, c, 'RIGHT', '#ffffff');
      } else if (i === 13) {
        bCtx.fillStyle = LUDO_PALETTE.GREEN;
        bCtx.fillRect(x, y, c, c);
        this.drawStartArrow(bCtx, x, y, c, 'DOWN', '#ffffff');
      } else if (i === 26) {
        bCtx.fillStyle = LUDO_PALETTE.YELLOW;
        bCtx.fillRect(x, y, c, c);
        this.drawStartArrow(bCtx, x, y, c, 'LEFT', '#2B2B2B');
      } else if (i === 39) {
        bCtx.fillStyle = LUDO_PALETTE.BLUE;
        bCtx.fillRect(x, y, c, c);
        this.drawStartArrow(bCtx, x, y, c, 'UP', '#ffffff');
      }

      bCtx.strokeStyle = LUDO_PALETTE.INK;
      bCtx.lineWidth = 1;
      bCtx.strokeRect(x, y, c, c);

      if (LUDO_CONFIG.SAFE_SQUARES.includes(i) && ![0, 13, 26, 39].includes(i)) {
        this.drawStar(bCtx, x + c / 2, y + c / 2, c * 0.32, 'rgba(43, 43, 43, 0.75)');
      }
    }

    // Home Runways
    this.drawHomeRunway(bCtx, HOME_COLUMNS.RED, LUDO_PALETTE.RED);
    this.drawHomeRunway(bCtx, HOME_COLUMNS.GREEN, LUDO_PALETTE.GREEN);
    this.drawHomeRunway(bCtx, HOME_COLUMNS.YELLOW, LUDO_PALETTE.YELLOW);
    this.drawHomeRunway(bCtx, HOME_COLUMNS.BLUE, LUDO_PALETTE.BLUE);

    // Center Triangles
    this.drawCenterGoal(bCtx, c);

    bCtx.restore();
  }

  drawYard(ctx, col, row, colorHex, colorKey) {
    const c = this.cellSize;
    const x = col * c;
    const y = row * c;
    const size = 6 * c;

    ctx.fillStyle = colorHex;
    ctx.fillRect(x, y, size, size);

    ctx.strokeStyle = LUDO_PALETTE.INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size, size);

    const pad = c * 0.8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, 10);
    ctx.fill();
    ctx.strokeStyle = '#2B2B2B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const wells = YARD_WELL_COORDINATES[colorKey];
    wells.forEach(([wx, wy]) => {
      const cx = wx * c;
      const cy = wy * c;
      const r = c * 0.4;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = colorHex;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });
  }

  drawHomeRunway(ctx, columnCoords, colorHex) {
    const c = this.cellSize;
    columnCoords.forEach(([col, row]) => {
      const x = col * c;
      const y = row * c;

      ctx.fillStyle = colorHex;
      ctx.fillRect(x, y, c, c);

      ctx.strokeStyle = LUDO_PALETTE.INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, c, c);
    });
  }

  drawCenterGoal(ctx, c) {
    const cx = 7.5 * c;
    const cy = 7.5 * c;

    // RED Left
    ctx.beginPath();
    ctx.moveTo(6 * c, 6 * c);
    ctx.lineTo(cx, cy);
    ctx.lineTo(6 * c, 9 * c);
    ctx.fillStyle = LUDO_PALETTE.RED;
    ctx.fill();

    // GREEN Top
    ctx.beginPath();
    ctx.moveTo(6 * c, 6 * c);
    ctx.lineTo(cx, cy);
    ctx.lineTo(9 * c, 6 * c);
    ctx.fillStyle = LUDO_PALETTE.GREEN;
    ctx.fill();

    // YELLOW Right
    ctx.beginPath();
    ctx.moveTo(9 * c, 6 * c);
    ctx.lineTo(cx, cy);
    ctx.lineTo(9 * c, 9 * c);
    ctx.fillStyle = LUDO_PALETTE.YELLOW;
    ctx.fill();

    // BLUE Bottom
    ctx.beginPath();
    ctx.moveTo(6 * c, 9 * c);
    ctx.lineTo(cx, cy);
    ctx.lineTo(9 * c, 9 * c);
    ctx.fillStyle = LUDO_PALETTE.BLUE;
    ctx.fill();

    // Clean white partition lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6 * c, 6 * c);
    ctx.lineTo(9 * c, 9 * c);
    ctx.moveTo(6 * c, 9 * c);
    ctx.lineTo(9 * c, 6 * c);
    ctx.stroke();

    // Center circular badge
    ctx.beginPath();
    ctx.arc(cx, cy, c * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = LUDO_PALETTE.PAPER;
    ctx.fill();
    ctx.strokeStyle = LUDO_PALETTE.INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawStartArrow(ctx, x, y, c, dir, color) {
    ctx.save();
    ctx.translate(x + c / 2, y + c / 2);

    let angle = 0;
    if (dir === 'DOWN') angle = Math.PI / 2;
    if (dir === 'LEFT') angle = Math.PI;
    if (dir === 'UP') angle = -Math.PI / 2;
    ctx.rotate(angle);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-c * 0.25, -c * 0.15);
    ctx.lineTo(c * 0.05, -c * 0.15);
    ctx.lineTo(c * 0.05, -c * 0.28);
    ctx.lineTo(c * 0.32, 0);
    ctx.lineTo(c * 0.05, c * 0.28);
    ctx.lineTo(c * 0.05, c * 0.15);
    ctx.lineTo(-c * 0.25, c * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawStar(ctx, cx, cy, radius, fill) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const ai = a + Math.PI / 5;
      const x1 = cx + Math.cos(a) * radius;
      const y1 = cy + Math.sin(a) * radius;
      const x2 = cx + Math.cos(ai) * (radius * 0.45);
      const y2 = cy + Math.sin(ai) * (radius * 0.45);
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  renderFrame(state, options = {}) {
    const {
      activeColor = 'RED',
      legalMoves = [],
      animatingHop = null,
      selectedToken = null,
      hoverPreviewCell = null,
      effects = []
    } = options;

    const ctx = this.ctx;
    const c = this.cellSize;

    ctx.clearRect(0, 0, this.boardSize, this.boardSize);
    if (this.offscreenBoard) {
      ctx.drawImage(this.offscreenBoard, 0, 0, this.boardSize, this.boardSize);
    }

    this.drawYardTurnIndicator(activeColor);

    if (hoverPreviewCell) {
      const [hx, hy] = hoverPreviewCell;
      ctx.save();
      ctx.strokeStyle = LUDO_PALETTE[activeColor];
      ctx.lineWidth = 2.5;
      ctx.strokeRect(hx * c + 2, hy * c + 2, c - 4, c - 4);
      ctx.restore();
    }

    const cellMap = new Map();
    const colors = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

    for (const col of colors) {
      const pawns = state.tokens[col];
      if (!pawns) continue;

      for (let idx = 0; idx < pawns.length; idx++) {
        if (animatingHop && animatingHop.color === col && animatingHop.tokenIndex === idx) {
          continue;
        }

        const prog = pawns[idx];
        const [gx, gy] = LudoRules.getGridCoordinates(col, idx, prog);
        const key = `${gx.toFixed(1)},${gy.toFixed(1)}`;

        if (!cellMap.has(key)) cellMap.set(key, []);
        cellMap.get(key).push({
          color: col,
          tokenIndex: idx,
          progress: prog,
          gx,
          gy,
          isLegal: (col === activeColor && legalMoves.includes(idx)),
          isSelected: (selectedToken && selectedToken.color === col && selectedToken.index === idx)
        });
      }
    }

    for (const [, pawnGroup] of cellMap.entries()) {
      this.drawPawnGroup(pawnGroup);
    }

    if (animatingHop) {
      this.drawHoppingPawn(animatingHop);
    }

    this.drawParticleEffects(effects);
  }

  drawYardTurnIndicator(activeColor) {
    const c = this.cellSize;
    const yardOrigins = {
      RED: [0, 0],
      GREEN: [9, 0],
      YELLOW: [9, 9],
      BLUE: [0, 9]
    };
    const [col, row] = yardOrigins[activeColor] || [0, 0];
    const x = col * c;
    const y = row * c;
    const size = 6 * c;

    this.ctx.save();
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    this.ctx.restore();
  }

  drawPawnGroup(pawns) {
    const count = pawns.length;
    const c = this.cellSize;

    if (count === 1) {
      const p = pawns[0];
      const cx = p.gx * c + c / 2;
      const cy = p.gy * c + c / 2;
      this.drawPawn(cx, cy, p.color, 1.0, p.isLegal, p.isSelected, p.tokenIndex);
      return;
    }

    const allSameColor = pawns.every(p => p.color === pawns[0].color);
    if (allSameColor) {
      const col = pawns[0].color;
      const baseGx = pawns[0].gx;
      const baseGy = pawns[0].gy;
      const cx = baseGx * c + c / 2;
      const cy = baseGy * c + c / 2;

      const scale = 0.78;
      const offsets = [
        { dx: -5, dy: -4 },
        { dx: 4, dy: -4 },
        { dx: -4, dy: 4 },
        { dx: 4, dy: 4 }
      ];

      pawns.forEach((p, i) => {
        const off = offsets[i % offsets.length];
        this.drawPawn(cx + off.dx, cy + off.dy, col, scale, p.isLegal, p.isSelected, p.tokenIndex);
      });

      this.drawStackBadge(cx + c * 0.32, cy - c * 0.32, count, LUDO_PALETTE[col]);
      return;
    }

    const quadrants = [
      { dx: -c * 0.22, dy: -c * 0.22 },
      { dx: c * 0.22, dy: -c * 0.22 },
      { dx: -c * 0.22, dy: c * 0.22 },
      { dx: c * 0.22, dy: c * 0.22 }
    ];

    pawns.forEach((p, idx) => {
      const q = quadrants[idx % quadrants.length];
      const cx = p.gx * c + c / 2 + q.dx;
      const cy = p.gy * c + c / 2 + q.dy;
      this.drawPawn(cx, cy, p.color, 0.74, p.isLegal, p.isSelected, p.tokenIndex);
    });
  }

  drawPawn(cx, cy, colorKey, scale = 1.0, isLegal = false, isSelected = false, tokenIndex = 0) {
    const ctx = this.ctx;
    const baseColor = LUDO_PALETTE[colorKey];

    ctx.save();
    ctx.translate(cx, cy);

    let liftY = 0;
    if (isLegal) {
      liftY = isSelected ? -4 : -2;

      // Solid flat highlight ring (no blur)
      ctx.beginPath();
      ctx.arc(0, 0, 15 * scale + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 15 * scale + 1, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Contact shadow
    ctx.beginPath();
    ctx.ellipse(0, 6 * scale, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();

    ctx.translate(0, liftY);

    // Conic body
    ctx.beginPath();
    ctx.moveTo(-9 * scale, 4 * scale);
    ctx.quadraticCurveTo(-7 * scale, -4 * scale, -4 * scale, -7 * scale);
    ctx.lineTo(4 * scale, -7 * scale);
    ctx.quadraticCurveTo(7 * scale, -4 * scale, 9 * scale, 4 * scale);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.8 * scale;
    ctx.stroke();

    // Collar
    ctx.beginPath();
    ctx.ellipse(0, -7 * scale, 5.5 * scale, 2 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.shadeColor(baseColor, 15);
    ctx.fill();
    ctx.stroke();

    // Head
    const headRadius = 6.2 * scale;
    const headY = -13 * scale;
    ctx.beginPath();
    ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.stroke();

    // Specular dot
    ctx.beginPath();
    ctx.arc(-2 * scale, headY - 2 * scale, 1.6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    if (this.colorBlindMode) {
      this.drawColorBlindMark(ctx, 0, headY, tokenIndex, scale);
    }

    ctx.restore();
  }

  drawColorBlindMark(ctx, x, y, tokenIndex, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(7 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${tokenIndex + 1}`, 0, 0.5);
    ctx.restore();
  }

  drawStackBadge(x, y, count, bgColor) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${count}`, x, y + 0.5);
    ctx.restore();
  }

  drawHoppingPawn(hop) {
    const { color, tokenIndex, fromGrid, toGrid, progress } = hop;
    const c = this.cellSize;

    const startX = fromGrid[0] * c + c / 2;
    const startY = fromGrid[1] * c + c / 2;
    const endX = toGrid[0] * c + c / 2;
    const endY = toGrid[1] * c + c / 2;

    const floorX = startX + (endX - startX) * progress;
    const floorY = startY + (endY - startY) * progress;

    const maxHeight = 16;
    const arcHeight = 4 * maxHeight * progress * (1 - progress);

    const pawnX = floorX;
    const pawnY = floorY - arcHeight;

    const shadowScale = 1.0 - (arcHeight / maxHeight) * 0.4;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.ellipse(floorX, floorY + 6, 12 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    this.ctx.fill();
    this.ctx.restore();

    this.drawPawn(pawnX, pawnY, color, 1.05, true, false, tokenIndex);
  }

  drawParticleEffects(effects) {
    if (!effects || effects.length === 0) return;
    const ctx = this.ctx;

    effects.forEach(fx => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fx.life);

      if (fx.type === 'ring') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        ctx.strokeStyle = fx.color || '#000000';
        ctx.lineWidth = fx.lineWidth || 2;
        ctx.stroke();
      } else if (fx.type === 'spark') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
        ctx.fillStyle = fx.color || '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  shadeColor(color, percent) {
    let num = parseInt(color.replace('#', ''), 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) + amt;
    let B = ((num >> 8) & 0x00FF) + amt;
    let G = (num & 0x0000FF) + amt;

    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
      (G < 255 ? (G < 1 ? 0 : G) : 255)
    ).toString(16).slice(1);
  }
}
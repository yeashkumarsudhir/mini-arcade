import {
  LUDO_PALETTE,
  LUDO_CONFIG,
  TRACK_COORDINATES,
  HOME_COLUMNS,
  YARD_WELL_COORDINATES,
  LudoRules
} from './ludo-rules.js';

export class LudoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.offscreenBoard = null;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.boardSize = 540;
    this.cellSize = 36;
    this.colorBlindMode = false;

    this.renderStaticBoard();
  }

  setColorBlind(enabled) {
    this.colorBlindMode = !!enabled;
  }

  resize(displaySize) {
    const size = Math.max(300, Math.min(Math.floor(displaySize), 540));
    this.boardSize = size;
    this.cellSize = size / 15;

    this.canvas.width = Math.floor(size * this.dpr);
    this.canvas.height = Math.floor(size * this.dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.renderStaticBoard();
  }

  renderStaticBoard() {
    this.offscreenBoard = document.createElement('canvas');
    this.offscreenBoard.width = Math.floor(this.boardSize * this.dpr);
    this.offscreenBoard.height = Math.floor(this.boardSize * this.dpr);
    const bCtx = this.offscreenBoard.getContext('2d');

    bCtx.scale(this.dpr, this.dpr);

    const s = this.boardSize;
    const c = this.cellSize;

    // Outer frame
    bCtx.fillStyle = '#2b1d16';
    bCtx.beginPath();
    bCtx.roundRect(0, 0, s, s, 6);
    bCtx.fill();

    // Inner board
    const inset = 4;
    bCtx.save();
    bCtx.beginPath();
    bCtx.roundRect(inset, inset, s - inset * 2, s - inset * 2, 4);
    bCtx.clip();

    bCtx.fillStyle = '#fffdf7';
    bCtx.fillRect(0, 0, s, s);

    // 4 Corner yards
    this.drawYard(bCtx, 0, 0, LUDO_PALETTE.RED, 'RED');
    this.drawYard(bCtx, 9, 0, LUDO_PALETTE.GREEN, 'GREEN');
    this.drawYard(bCtx, 9, 9, LUDO_PALETTE.YELLOW, 'YELLOW');
    this.drawYard(bCtx, 0, 9, LUDO_PALETTE.BLUE, 'BLUE');

    // Outer track cells
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
        this.drawStartArrow(bCtx, x, y, c, 'LEFT', '#222222');
      } else if (i === 39) {
        bCtx.fillStyle = LUDO_PALETTE.BLUE;
        bCtx.fillRect(x, y, c, c);
        this.drawStartArrow(bCtx, x, y, c, 'UP', '#ffffff');
      }

      bCtx.strokeStyle = '#222222';
      bCtx.lineWidth = 1;
      bCtx.strokeRect(x, y, c, c);

      if (LUDO_CONFIG.SAFE_SQUARES.includes(i) && ![0, 13, 26, 39].includes(i)) {
        this.drawStar(bCtx, x + c / 2, y + c / 2, c * 0.32, 'rgba(40, 40, 40, 0.7)');
      }
    }

    // Home runways
    this.drawHomeRunway(bCtx, HOME_COLUMNS.RED, LUDO_PALETTE.RED);
    this.drawHomeRunway(bCtx, HOME_COLUMNS.GREEN, LUDO_PALETTE.GREEN);
    this.drawHomeRunway(bCtx, HOME_COLUMNS.YELLOW, LUDO_PALETTE.YELLOW);
    this.drawHomeRunway(bCtx, HOME_COLUMNS.BLUE, LUDO_PALETTE.BLUE);

    // Center triangles
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

    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size, size);

    const pad = c * 0.8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, 6);
    ctx.fill();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const wells = YARD_WELL_COORDINATES[colorKey];
    wells.forEach(([wx, wy]) => {
      const cx = wx * c;
      const cy = wy * c;
      const r = c * 0.38;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = colorHex;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  drawHomeRunway(ctx, columnCoords, colorHex) {
    const c = this.cellSize;
    columnCoords.forEach(([col, row]) => {
      const x = col * c;
      const y = row * c;
      ctx.fillStyle = colorHex;
      ctx.fillRect(x, y, c, c);
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, c, c);
    });
  }

  drawCenterGoal(ctx, c) {
    const cx = 7.5 * c;
    const cy = 7.5 * c;

    const triangles = [
      { coords: [[6 * c, 6 * c], [cx, cy], [6 * c, 9 * c]], color: LUDO_PALETTE.RED },
      { coords: [[6 * c, 6 * c], [cx, cy], [9 * c, 6 * c]], color: LUDO_PALETTE.GREEN },
      { coords: [[9 * c, 6 * c], [cx, cy], [9 * c, 9 * c]], color: LUDO_PALETTE.YELLOW },
      { coords: [[6 * c, 9 * c], [cx, cy], [9 * c, 9 * c]], color: LUDO_PALETTE.BLUE }
    ];

    triangles.forEach(t => {
      ctx.beginPath();
      ctx.moveTo(t.coords[0][0], t.coords[0][1]);
      ctx.lineTo(t.coords[1][0], t.coords[1][1]);
      ctx.lineTo(t.coords[2][0], t.coords[2][1]);
      ctx.fillStyle = t.color;
      ctx.fill();
    });

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6 * c, 6 * c); ctx.lineTo(9 * c, 9 * c);
    ctx.moveTo(6 * c, 9 * c); ctx.lineTo(9 * c, 6 * c);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, c * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#222222';
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
    ctx.moveTo(-c * 0.22, -c * 0.12);
    ctx.lineTo(c * 0.05, -c * 0.12);
    ctx.lineTo(c * 0.05, -c * 0.25);
    ctx.lineTo(c * 0.3, 0);
    ctx.lineTo(c * 0.05, c * 0.25);
    ctx.lineTo(c * 0.05, c * 0.12);
    ctx.lineTo(-c * 0.22, c * 0.12);
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
      hoverPreviewCell = null
    } = options;

    const ctx = this.ctx;
    const c = this.cellSize;

    ctx.clearRect(0, 0, this.boardSize, this.boardSize);
    if (this.offscreenBoard) {
      ctx.drawImage(this.offscreenBoard, 0, 0, this.boardSize, this.boardSize);
    }

    if (hoverPreviewCell) {
      const [hx, hy] = hoverPreviewCell;
      ctx.save();
      ctx.strokeStyle = LUDO_PALETTE[activeColor];
      ctx.lineWidth = 2;
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

    const quadrants = [
      { dx: -c * 0.2, dy: -c * 0.2 },
      { dx: c * 0.2, dy: -c * 0.2 },
      { dx: -c * 0.2, dy: c * 0.2 },
      { dx: c * 0.2, dy: c * 0.2 }
    ];

    pawns.forEach((p, idx) => {
      const q = quadrants[idx % quadrants.length];
      const cx = p.gx * c + c / 2 + q.dx;
      const cy = p.gy * c + c / 2 + q.dy;
      this.drawPawn(cx, cy, p.color, 0.72, p.isLegal, p.isSelected, p.tokenIndex);
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

      ctx.beginPath();
      ctx.arc(0, 0, 14 * scale + 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 6 * scale, 10 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();

    ctx.translate(0, liftY);

    // Pawn Body
    ctx.beginPath();
    ctx.moveTo(-8 * scale, 4 * scale);
    ctx.quadraticCurveTo(-6 * scale, -3 * scale, -3 * scale, -6 * scale);
    ctx.lineTo(3 * scale, -6 * scale);
    ctx.quadraticCurveTo(6 * scale, -3 * scale, 8 * scale, 4 * scale);
    ctx.closePath();
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Pawn Head
    const headRadius = 5.5 * scale;
    const headY = -11 * scale;
    ctx.beginPath();
    ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.stroke();

    if (this.colorBlindMode) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(7 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${tokenIndex + 1}`, 0, headY);
    }

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

    const maxHeight = 14;
    const arcHeight = 4 * maxHeight * progress * (1 - progress);
    const pawnY = floorY - arcHeight;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.ellipse(floorX, floorY + 4, 10, 4, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fill();
    this.ctx.restore();

    this.drawPawn(floorX, pawnY, color, 1.05, true, false, tokenIndex);
  }
}
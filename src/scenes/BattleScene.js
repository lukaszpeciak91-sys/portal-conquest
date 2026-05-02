import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';
import { clearPendingTransition, consumePendingTransition, markNodeState } from '../state/runtimeState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { GameState } from '../state/GameState';
import { textureExists } from '../assets/safeTexture';

const CARD_ASPECT = 0.72;
const MAX_HAND = 5;

export class BattleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BATTLE);
    this.transition = null;
    this.handCards = [];
    this.playerSlots = [];
    this.enemySlots = [];
    this.selectedHandIndex = null;
    this.placedUnits = new Map();
  }

  preload() {
    loadAssetsFromManifest(this, assetManifest.units);

    const units = GameState?.data?.faction?.units ?? [];
    const baseUrl = import.meta.env.BASE_URL ?? '/';
    units.forEach((unit) => {
      const key = `unit-${unit.id}`;
      const path = String(unit?.asset ?? '').replace(/^\//, '');
      if (path) this.load.image(key, `${baseUrl}${path}`);
    });
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this);
    this.transition = consumePendingTransition();
    this.handUnits = (GameState?.data?.faction?.units ?? []).slice(0, MAX_HAND);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearPendingTransition();
      this.transition = null;
    });

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('battle');
    }

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });

    this.drawLayout();
    this.input.keyboard.on('keydown-M', () => this.returnToMap());
  }

  handleResize(gameSize) {
    if (!gameSize?.width || !gameSize?.height) return;
    this.drawLayout();
  }

  drawLayout() {
    this.children.removeAll(true);
    this.handCards = [];
    this.playerSlots = [];
    this.enemySlots = [];

    const { width: w, height: h } = this.scale.gameSize;
    const centerX = w / 2;

    const boardTop = h * 0.11;
    const boardBottom = h * 0.68;
    const boardH = boardBottom - boardTop;
    const boardCardH = Phaser.Math.Clamp(boardH * 0.33, 140, 280);
    const boardCardW = boardCardH * CARD_ASPECT;
    const colGap = Math.min(w * 0.03, 28);
    const totalBoardW = (boardCardW * 3) + (colGap * 2);
    const startX = centerX - (totalBoardW / 2) + (boardCardW / 2);

    this.addHeroPanel(centerX, h * 0.065, w * 0.56, h * 0.05, 'ENEMY HERO', '#ff6c6c');

    const enemyY = boardTop + boardCardH / 2;
    const middleY = boardTop + (boardH / 2);
    const playerY = boardBottom - boardCardH / 2;

    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * (boardCardW + colGap);
      this.drawSlot(x, enemyY, boardCardW, boardCardH, 0x8a939e, 0.8, false);
      this.enemySlots.push({ x, y: enemyY, occupied: false });

      this.drawSlot(x, middleY, boardCardW, boardCardH * 0.62, 0x7f8894, 0.3, true);

      const slot = this.drawSlot(x, playerY, boardCardW, boardCardH, 0x8a939e, 0.9, false);
      slot.setInteractive(new Phaser.Geom.Rectangle(-boardCardW / 2, -boardCardH / 2, boardCardW, boardCardH), Phaser.Geom.Rectangle.Contains);
      slot.on('pointerdown', () => this.handlePlayerSlotClick(i));
      this.playerSlots.push({ x, y: playerY, occupied: false, slot });
    }

    this.addHeroPanel(centerX, h * 0.73, w * 0.56, h * 0.05, 'PLAYER HERO', '#6ca8ff');

    const buttonY = h * 0.79;
    this.add.roundedRectangle(centerX, buttonY, w * 0.35, h * 0.05, 10, 0x111822, 0.8)
      .setStrokeStyle(2, 0x70839b, 0.9);
    this.add.text(centerX, buttonY, 'END TURN', { fontFamily: 'Arial', fontSize: `${Math.round(h * 0.028)}px`, color: '#e8edf2', fontStyle: 'bold' }).setOrigin(0.5);

    this.drawHandArea(w, h);
  }

  addHeroPanel(x, y, width, height, label, accentColor) {
    this.add.roundedRectangle(x, y, width, height, 10, 0x0c121c, 0.78).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(accentColor).color, 0.7);
    this.add.text(x, y - height * 0.17, label, { fontFamily: 'Arial', fontSize: `${Math.round(height * 0.4)}px`, color: accentColor, fontStyle: 'bold' }).setOrigin(0.5, 0.5);
    this.add.text(x, y + height * 0.18, 'HP 12 / 12', { fontFamily: 'Arial', fontSize: `${Math.round(height * 0.52)}px`, color: '#f2f4f7', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
  }

  drawSlot(x, y, width, height, color, alpha, dashed) {
    const g = this.add.graphics({ x, y });
    g.lineStyle(2, color, alpha);
    if (dashed) {
      const dash = 10;
      const gap = 8;
      for (let dx = -width / 2; dx < width / 2; dx += dash + gap) {
        g.lineBetween(dx, -height / 2, Math.min(dx + dash, width / 2), -height / 2);
        g.lineBetween(dx, height / 2, Math.min(dx + dash, width / 2), height / 2);
      }
      for (let dy = -height / 2; dy < height / 2; dy += dash + gap) {
        g.lineBetween(-width / 2, dy, -width / 2, Math.min(dy + dash, height / 2));
        g.lineBetween(width / 2, dy, width / 2, Math.min(dy + dash, height / 2));
      }
    } else {
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    }
    return g;
  }

  drawHandArea(w, h) {
    const handY = h * 0.915;
    const handH = h * 0.16;
    const handW = w * 0.95;
    this.add.roundedRectangle(w / 2, handY, handW, handH, 8, 0x101722, 0.85).setStrokeStyle(2, 0x3b4656, 0.9);
    this.add.text((w - handW) / 2 + 16, handY - handH / 2 + 10, 'YOUR HAND', { fontFamily: 'Arial', fontSize: `${Math.round(h * 0.02)}px`, color: '#aab4c2', fontStyle: 'bold' });

    const deckColW = Math.max(140, handW * 0.21);
    const cardsRegionW = handW - deckColW - 20;
    const cardH = Phaser.Math.Clamp(handH * 0.7, 96, 170);
    const cardW = cardH * CARD_ASPECT;
    const handCount = this.handUnits.length;
    const spread = Math.min(cardW * 0.9, (cardsRegionW - cardW) / Math.max(1, handCount - 1));
    const cardsStartX = (w - handW) / 2 + 20 + (cardW / 2);

    for (let i = 0; i < handCount; i += 1) {
      const x = cardsStartX + i * spread;
      const card = this.renderUnitCard(x, handY + 10, cardW, cardH, this.handUnits[i], i);
      this.handCards.push(card);
    }

    const deckX = (w + handW) / 2 - (deckColW / 2);
    this.add.line(deckX - (deckColW / 2), handY, 0, -handH / 2 + 8, 0, handH / 2 - 8, 0x465266, 0.7).setLineWidth(2, 2);
    this.add.text(deckX, handY - handH * 0.4, 'DECK', { fontFamily: 'Arial', fontSize: `${Math.round(h * 0.022)}px`, color: '#b7c0cb', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.rectangle(deckX, handY + 8, deckColW * 0.52, cardH * 0.86, 0x121a26, 0.9).setStrokeStyle(2, 0x5b6779, 0.8);
    this.add.text(deckX, handY + handH * 0.36, `DECK x${Math.max(0, 7 - this.placedUnits.size)}`, { fontFamily: 'Arial', fontSize: `${Math.round(h * 0.028)}px`, color: '#e8edf2', fontStyle: 'bold' }).setOrigin(0.5);
  }

  renderUnitCard(x, y, width, height, unit, index) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, 0x161f2b, 0.95).setStrokeStyle(2, 0x6b778a, 0.9);
    container.add(bg);

    const key = unit ? `unit-${unit.id}` : null;
    if (key && textureExists(this, key)) {
      const image = this.add.image(0, -height * 0.1, key).setDisplaySize(width * 0.7, width * 0.7);
      container.add(image);
    }
    container.add(this.add.text(0, height * 0.22, unit?.name ?? 'CARD', { fontFamily: 'Arial', fontSize: `${Math.max(12, Math.round(height * 0.12))}px`, color: '#eef2f6', align: 'center', fontStyle: 'bold', wordWrap: { width: width * 0.9 } }).setOrigin(0.5));

    container.setSize(width, height);
    container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', () => this.selectHandCard(index));
    return container;
  }

  selectHandCard(index) {
    this.selectedHandIndex = index;
    this.handCards.forEach((card, i) => {
      card.setScale(i === index ? 1.05 : 1);
      card.alpha = i === index ? 1 : 0.9;
    });
  }

  handlePlayerSlotClick(slotIndex) {
    if (this.selectedHandIndex === null) return;
    const slot = this.playerSlots[slotIndex];
    if (!slot || slot.occupied) return;

    const unit = this.handUnits[this.selectedHandIndex];
    const key = unit ? `unit-${unit.id}` : null;
    if (key && textureExists(this, key)) {
      this.add.image(slot.x, slot.y, key).setDisplaySize(70, 70);
    } else {
      this.add.text(slot.x, slot.y, unit?.name ?? 'UNIT', { color: '#ffffff', fontSize: '14px', fontFamily: 'Arial' }).setOrigin(0.5);
    }
    slot.occupied = true;
    this.placedUnits.set(slotIndex, unit?.id ?? `unit-${slotIndex}`);
  }

  returnToMap() {
    const sourceNodeId = this.transition?.sourceNodeId;
    if (sourceNodeId && (this.transition?.type === 'battle' || this.transition?.type === 'portal')) {
      markNodeState(sourceNodeId, { cleared: true });
    }
    clearPendingTransition();
    this.router.goTo(SCENES.MAP);
  }
}

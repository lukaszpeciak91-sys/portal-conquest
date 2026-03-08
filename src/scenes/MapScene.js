import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { GameState } from '../state/GameState';
import { clearPendingTransition, ensureNodeRuntime, isNodeCleared, isNodeConsumed, markNodeState, setPendingTransition } from '../state/runtimeState';
import { syncSceneState } from '../state/sceneState';
import map01FallbackUrl from '../data/maps/map01.png';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { addFallbackPlaceholder, textureExists } from '../assets/safeTexture';

const NODE_TYPES = {
  CASTLE: 'castle',
  BATTLE: 'battle',
  PORTAL: 'portal',
  EVENT: 'event',
  RESOURCE: 'resource',
  BEACON: 'beacon',
};

const NODE_INSPECT_COPY = {
  [NODE_TYPES.CASTLE]: {
    abbr: 'CA',
    label: 'Castle',
    action: 'Enter castle',
  },
  [NODE_TYPES.BATTLE]: {
    abbr: 'BA',
    label: 'Battle',
    action: 'Start battle',
  },
  [NODE_TYPES.PORTAL]: {
    abbr: 'PO',
    label: 'Portal',
    action: 'Enter portal battle',
  },
  [NODE_TYPES.EVENT]: {
    abbr: 'EV',
    label: 'Event',
    action: 'Trigger event',
  },
  [NODE_TYPES.RESOURCE]: {
    abbr: 'RE',
    label: 'Resource',
    action: 'Collect resource',
  },
  [NODE_TYPES.BEACON]: {
    abbr: 'BE',
    label: 'Beacon',
    action: 'Activate beacon',
  },
};

const HERO_HP_STUB = 100;
const HERO_LEVEL_STUB = 1;
const NODE_MARKER_SIZE = 24;
const NODE_HIT_AREA_SIZE = 40;
const MIN_VALID_VIEWPORT_SIDE = 64;
const MIN_VALID_PLAYABLE_HEIGHT = 96;
const PLAYABLE_BOUNDS_RETRY_MS = 120;

export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MAP);
    this.nodeMarkers = new Map();
    this.nodeDataById = new Map();
    this.selectedNodeId = null;
    this.isMoving = false;
    this.debugEnabled = false;
    this.inspectTargetNodeId = null;
    this.inspectSubmitLocked = false;
    this.debugState = {
      scene: 'scene: MapScene',
      mode: 'ui mode: map',
      currentNode: 'current node: —',
      selectedNode: 'selected node: —',
      pendingTransition: 'pending transition: —',
      lastAction: 'last action: Tap a node to inspect.',
    };
  }

  preload() {
    const baseUrl = import.meta.env.BASE_URL ?? '/';
    this.load.image('map01-bg', `${baseUrl}assets/maps/map01.png`);
    this.load.image('map01-bg-fallback', map01FallbackUrl);
    loadAssetsFromManifest(this, assetManifest.nodes);
  }

  create() {
    syncSceneState(this.scene.key);
    console.log('[MapScene] create');

    this.router = new SceneRouter(this);
    clearPendingTransition();

    const { map, config, faction } = GameState.data;
    this.mapLogicalBounds = map?.generation?.bounds ?? null;
    this.mapById = new Map((map?.nodes ?? []).map((node) => [node.id, node]));
    this.nodeDataById = this.mapById;
    console.log(`Data ready: map=${map?.id}, biome=${map?.biome}, regions=${config?.regions}, faction=${faction?.id}`);

    this.lastGoodViewport = this.getSafeViewportSize({ width: this.scale.width, height: this.scale.height })
      ?? { width: 1280, height: 720 };

    this.layoutRetryTimer = null;

    this.layoutMapBackground(this.lastGoodViewport.width, this.lastGoodViewport.height);
    this.renderNodes(map);
    this.renderHeroMarker();

    this.scale.on('resize', this.handleResize, this);
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.updateHud();
    this.syncDebugPanel();

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
    this.input.keyboard.on('keydown-C', () => this.router.goTo(SCENES.CASTLE));
    this.input.keyboard.on('keydown-B', () => this.router.goTo(SCENES.BATTLE));

    this.ensureInputReady();

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('map');
      this.setDebugEnabled(window.gameUi.isDebugEnabled?.() ?? false);
    }
  }

  ensureInputReady() {
    if (!this.input) {
      return;
    }

    this.input.enabled = true;
    this.input.topOnly = true;
  }

  onWake() {
    this.ensureInputReady();
    this.refreshNodeMarkerStates();
  }

  getSafeViewportSize(gameSize) {
    const widthCandidate = gameSize?.width ?? this.scale.width;
    const heightCandidate = gameSize?.height ?? this.scale.height;
    const width = Number.isFinite(widthCandidate) ? widthCandidate : this.scale.width;
    const height = Number.isFinite(heightCandidate) ? heightCandidate : this.scale.height;

    if (width < MIN_VALID_VIEWPORT_SIDE || height < MIN_VALID_VIEWPORT_SIDE) {
      if (this.lastGoodViewport?.width >= MIN_VALID_VIEWPORT_SIDE && this.lastGoodViewport?.height >= MIN_VALID_VIEWPORT_SIDE) {
        return this.lastGoodViewport;
      }

      return null;
    }

    this.lastGoodViewport = { width, height };
    return this.lastGoodViewport;
  }

  getPlayableBounds(viewportWidth, viewportHeight) {
    const rootStyle = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null;

    const toNumber = (value) => {
      const parsed = Number.parseFloat(value ?? '0');
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const topInset = toNumber(rootStyle?.getPropertyValue('--safe-top'));
    const bottomInset = toNumber(rootStyle?.getPropertyValue('--safe-bottom'));
    const topBarHeightVar = toNumber(rootStyle?.getPropertyValue('--top-bar-height'));
    const bottomBarHeightVar = toNumber(rootStyle?.getPropertyValue('--bottom-bar-height'));

    const topBarRect = typeof document !== 'undefined'
      ? document.querySelector('.top-bar')?.getBoundingClientRect?.() ?? null
      : null;
    const bottomBarRect = typeof document !== 'undefined'
      ? document.querySelector('.bottom-mode-bar')?.getBoundingClientRect?.() ?? null
      : null;
    const gameContainerRect = typeof document !== 'undefined'
      ? document.querySelector('#game-container')?.getBoundingClientRect?.() ?? null
      : null;

    const relativeTopBarBottom = topBarRect && gameContainerRect
      ? Math.max(0, topBarRect.bottom - gameContainerRect.top)
      : null;
    const relativeBottomBarTop = bottomBarRect && gameContainerRect
      ? Math.max(0, bottomBarRect.top - gameContainerRect.top)
      : null;

    const fallbackTop = Phaser.Math.Clamp(topInset + topBarHeightVar, 0, Math.max(0, viewportHeight - 1));
    const fallbackBottom = Phaser.Math.Clamp(viewportHeight - (bottomInset + bottomBarHeightVar), fallbackTop + 1, viewportHeight);

    const topCandidate = Number.isFinite(relativeTopBarBottom) ? relativeTopBarBottom : fallbackTop;
    const bottomCandidate = Number.isFinite(relativeBottomBarTop) ? relativeBottomBarTop : fallbackBottom;

    const top = Phaser.Math.Clamp(topCandidate, 0, Math.max(0, viewportHeight - 1));
    const bottom = Phaser.Math.Clamp(bottomCandidate, top + 1, viewportHeight);
    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, bottom - top);

    return {
      x: 0,
      y: top,
      width,
      height,
      centerX: width / 2,
      centerY: top + (height / 2),
    };
  }

  isPlayableBoundsValid(bounds) {
    return Number.isFinite(bounds?.width)
      && Number.isFinite(bounds?.height)
      && bounds.width >= MIN_VALID_VIEWPORT_SIDE
      && bounds.height >= MIN_VALID_PLAYABLE_HEIGHT;
  }

  buildRenderContract(playableBounds) {
    const innerMargin = Phaser.Math.Clamp(Math.min(playableBounds.width, playableBounds.height) * 0.02, 8, 20);

    return {
      playableBounds,
      projectionBounds: {
        x: playableBounds.x + innerMargin,
        y: playableBounds.y + innerMargin,
        width: Math.max(1, playableBounds.width - (innerMargin * 2)),
        height: Math.max(1, playableBounds.height - (innerMargin * 2)),
      },
    };
  }

  getMapRenderContract(viewportWidth, viewportHeight) {
    const measuredPlayableBounds = this.getPlayableBounds(viewportWidth, viewportHeight);
    const fallbackPlayableBounds = this.lastGoodPlayableBounds
      ?? {
        x: 0,
        y: 0,
        width: Math.max(MIN_VALID_VIEWPORT_SIDE, viewportWidth),
        height: Math.max(MIN_VALID_PLAYABLE_HEIGHT, viewportHeight),
        centerX: Math.max(MIN_VALID_VIEWPORT_SIDE, viewportWidth) / 2,
        centerY: Math.max(MIN_VALID_PLAYABLE_HEIGHT, viewportHeight) / 2,
      };
    const hasValidMeasuredBounds = this.isPlayableBoundsValid(measuredPlayableBounds);
    const playableBounds = hasValidMeasuredBounds ? measuredPlayableBounds : fallbackPlayableBounds;

    if (hasValidMeasuredBounds) {
      this.lastGoodPlayableBounds = measuredPlayableBounds;
    }

    return {
      ...this.buildRenderContract(playableBounds),
      hasValidMeasuredBounds,
    };
  }

  scheduleLayoutRetry() {
    if (this.layoutRetryTimer) {
      return;
    }

    this.layoutRetryTimer = window.setTimeout(() => {
      this.layoutRetryTimer = null;
      const viewport = this.getSafeViewportSize({ width: this.scale.width, height: this.scale.height });
      if (!viewport) {
        this.scheduleLayoutRetry();
        return;
      }

      this.handleResize(viewport);
    }, PLAYABLE_BOUNDS_RETRY_MS);
  }

  layoutMapBackground(viewportWidth, viewportHeight) {
    this.mapRenderContract = this.getMapRenderContract(viewportWidth, viewportHeight);
    this.playableBounds = this.mapRenderContract.playableBounds;
    this.mapBounds = this.mapRenderContract.projectionBounds;
    this.drawMapBackground(this.mapRenderContract);

    if (!this.mapRenderContract.hasValidMeasuredBounds) {
      this.scheduleLayoutRetry();
    }

  }

  drawMapBackground(renderContract = this.getMapRenderContract(this.scale.width, this.scale.height)) {
    const { playableBounds } = renderContract;
    const fallbackBounds = {
      x: playableBounds.x,
      y: playableBounds.y,
      width: playableBounds.width,
      height: playableBounds.height,
      scale: 1,
    };

    const textureKey = textureExists(this, 'map01-bg')
      ? 'map01-bg'
      : (textureExists(this, 'map01-bg-fallback') ? 'map01-bg-fallback' : null);

    if (!textureKey) {
      this.mapBackgroundImage?.destroy();
      this.mapMissingPlaceholder?.destroy();
      this.mapBackgroundImage = this.add.rectangle(playableBounds.centerX, playableBounds.centerY, playableBounds.width + 2, playableBounds.height + 2, 0x1b2334).setDepth(0);
      this.mapMissingPlaceholder = addFallbackPlaceholder(this, {
        x: playableBounds.centerX,
        y: playableBounds.centerY,
        width: Math.max(80, Math.min(300, playableBounds.width - 32)),
        height: Math.max(56, Math.min(130, playableBounds.height - 24)),
        label: 'missing asset\nmap background',
        depth: 1,
      });

      return fallbackBounds;
    }

    this.mapMissingPlaceholder?.destroy();
    this.mapMissingPlaceholder = null;

    this.mapTextureKey = textureKey;

    const texture = this.textures.get(textureKey).getSourceImage();
    const imageWidth = texture.width;
    const imageHeight = texture.height;
    const scale = Math.max(playableBounds.width / imageWidth, playableBounds.height / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = playableBounds.centerX - (width / 2);
    const y = playableBounds.centerY - (height / 2);

    if (this.mapBackgroundImage && (!this.mapBackgroundImage.scene || !this.mapBackgroundImage.active)) {
      console.log('[MapScene] recreate background (destroyed ref)');
      this.mapBackgroundImage = null;
    }

    if (!this.mapBackgroundImage) {
      this.mapBackgroundImage = this.add.image(playableBounds.centerX, playableBounds.centerY, textureKey)
        .setOrigin(0.5, 0.5)
        .setDepth(0);
    }

    this.mapBackgroundImage
      .setTexture(textureKey)
      .setPosition(playableBounds.centerX, playableBounds.centerY)
      .setScale(scale);

    if (this.mapBackgroundOverlay && (!this.mapBackgroundOverlay.scene || !this.mapBackgroundOverlay.active)) {
      this.mapBackgroundOverlay = null;
    }

    if (!this.mapBackgroundOverlay) {
      this.mapBackgroundOverlay = this.add.rectangle(playableBounds.centerX, playableBounds.centerY, playableBounds.width, playableBounds.height, 0x000000, 0.12)
        .setDepth(1);
    }

    this.mapBackgroundOverlay
      .setPosition(playableBounds.centerX, playableBounds.centerY)
      .setSize(playableBounds.width, playableBounds.height);

    return { x, y, width, height, scale };
  }

  mapToScreen(x, y) {
    const logicalWidth = this.mapLogicalBounds?.width ?? this.mapBounds?.width ?? 1;
    const logicalHeight = this.mapLogicalBounds?.height ?? this.mapBounds?.height ?? 1;

    return {
      x: this.mapBounds.x + ((x / logicalWidth) * this.mapBounds.width),
      y: this.mapBounds.y + ((y / logicalHeight) * this.mapBounds.height),
    };
  }

  renderNodes(map) {
    if (!map?.nodes?.length) {
      return;
    }

    map.nodes.forEach((node) => {
      if (node.hidden) {
        return;
      }

      const point = this.mapToScreen(node.x, node.y);
      const textureKey = `node-${node.type}`;
      const marker = this.renderNodeMarker(point.x, point.y, node, textureKey);

      marker.on('pointerdown', () => this.onNodePressed(node));

      this.nodeMarkers.set(node.id, marker);
      this.applyNodeMarkerState(node.id);
    });
  }

  renderNodeMarker(x, y, node, textureKey) {
    const nodeType = node?.type;
    const hitOffset = NODE_HIT_AREA_SIZE / 2;
    const hitRect = new Phaser.Geom.Rectangle(-hitOffset, -hitOffset, NODE_HIT_AREA_SIZE, NODE_HIT_AREA_SIZE);

    if (textureExists(this, textureKey)) {
      return this.add.image(x, y, textureKey)
        .setDisplaySize(NODE_MARKER_SIZE, NODE_MARKER_SIZE)
        .setDepth(10)
        .setInteractive(hitRect, Phaser.Geom.Rectangle.Contains)
        .setData('baseScale', 1)
        .setData('nodeType', nodeType)
        .setData('nodeId', node?.id);
    }

    const marker = addFallbackPlaceholder(this, {
      x,
      y,
      width: NODE_MARKER_SIZE,
      height: NODE_MARKER_SIZE,
      label: nodeType?.slice(0, 2)?.toUpperCase() ?? '?',
      depth: 10,
    }).setSize(NODE_MARKER_SIZE, NODE_MARKER_SIZE)
      .setData('baseScale', 1)
      .setData('nodeType', nodeType)
      .setData('nodeId', node?.id);

    marker.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains);
    return marker;
  }

  renderHeroMarker() {
    const currentNode = this.mapById.get(GameState.currentNodeId);
    if (!currentNode) {
      return;
    }

    const point = this.mapToScreen(currentNode.x, currentNode.y);
    this.heroMarker = this.add.circle(point.x, point.y, 5, 0x4de3ff, 1)
      .setStrokeStyle(2, 0x0d2c36)
      .setDepth(15);
  }

  onNodePressed(node) {
    this.selectNode(node);

    if (this.isMoving) {
      this.closeInspectPanel();
      this.showFeedback('Moving...');
      return;
    }

    if (node.id === GameState.currentNodeId) {
      this.closeInspectPanel();
      this.showFeedback('Already here');
      return;
    }

    const currentNode = this.mapById.get(GameState.currentNodeId);
    const isNeighbor = Boolean(currentNode?.connections?.includes(node.id));

    if (!isNeighbor) {
      this.closeInspectPanel();
      this.showFeedback('Not connected');
      console.log(`[MapScene] Invalid move ${GameState.currentNodeId} -> ${node.id}: not connected`);
      return;
    }

    this.openInspectPanel(node);
  }

  applyNodeMarkerState(nodeId) {
    const marker = this.nodeMarkers.get(nodeId);
    if (!marker) {
      return;
    }

    const node = this.nodeDataById.get(nodeId);
    const runtime = ensureNodeRuntime(nodeId);
    const isClearedNode = node && (node.type === NODE_TYPES.BATTLE || node.type === NODE_TYPES.PORTAL) && runtime?.cleared;
    const isConsumedNode = node && (node.type === NODE_TYPES.RESOURCE || node.type === NODE_TYPES.BEACON) && runtime?.consumed;

    const alpha = (isClearedNode || isConsumedNode) ? 0.45 : 1;
    const tint = isConsumedNode ? 0x808080 : (isClearedNode ? 0x98b0cc : 0xffffff);

    if (typeof marker.setTint === 'function') {
      marker.setTint(tint);
    }

    if (typeof marker.iterate === 'function') {
      marker.iterate((child) => {
        if (typeof child?.setFillStyle === 'function') {
          child.setFillStyle(isConsumedNode ? 0x4f4f4f : (isClearedNode ? 0x6e8298 : 0x667892));
        }
      });
    }

    marker.setAlpha(alpha);
  }

  moveHeroTo(targetNode) {
    if (!this.heroMarker) {
      return;
    }

    const target = this.mapToScreen(targetNode.x, targetNode.y);
    this.isMoving = true;
    this.closeInspectPanel();

    this.tweens.add({
      targets: this.heroMarker,
      x: target.x,
      y: target.y,
      duration: 220,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.isMoving = false;
        GameState.currentNodeId = targetNode.id;
        markNodeState(targetNode.id, {
          discovered: true,
          visited: true,
        });
        GameState.turnCounter += 1;
        this.updateHud();

        this.showFeedback(`Moved to ${targetNode.id}`);
        console.log(`[MapScene] Move complete: currentNode=${GameState.currentNodeId}, turn=${GameState.turnCounter}`);
        this.handleNodeArrival(targetNode);
      },
    });
  }

  handleNodeArrival(node) {
    if (!node) {
      return;
    }

    switch (node.type) {
      case NODE_TYPES.CASTLE:
        this.router.goTo(SCENES.CASTLE);
        return;
      case NODE_TYPES.BATTLE:
        if (isNodeCleared(node.id)) {
          this.showStubOverlay('Battle already cleared.');
          return;
        }

        setPendingTransition({
          type: NODE_TYPES.BATTLE,
          sourceNodeId: node.id,
        });
        this.router.goTo(SCENES.BATTLE);
        return;
      case NODE_TYPES.PORTAL:
        if (isNodeCleared(node.id)) {
          this.showStubOverlay('Portal guardian already defeated.');
          return;
        }

        setPendingTransition({
          type: NODE_TYPES.PORTAL,
          sourceNodeId: node.id,
        });
        this.router.goTo(SCENES.BATTLE);
        return;
      case NODE_TYPES.EVENT:
        this.showStubOverlay('Something strange happens.');
        return;
      case NODE_TYPES.RESOURCE:
        if (isNodeConsumed(node.id)) {
          this.showStubOverlay('Resources already collected.');
          return;
        }

        this.showStubOverlay('You found resources.', () => {
          markNodeState(node.id, { consumed: true });
          this.applyNodeMarkerState(node.id);
        });
        return;
      case NODE_TYPES.BEACON:
        if (isNodeConsumed(node.id)) {
          this.showStubOverlay('Beacon already activated.');
          return;
        }

        this.showStubOverlay('Beacon activated.', () => {
          markNodeState(node.id, { consumed: true });
          this.applyNodeMarkerState(node.id);
          this.router.goTo(SCENES.CASTLE);
        });
        return;
      default:
        return;
    }
  }

  refreshNodeMarkerStates() {
    this.nodeMarkers?.forEach((_marker, nodeId) => {
      this.applyNodeMarkerState(nodeId);
    });
  }

  clearTransientUi() {
    this.closeInspectPanel();

    if (this.stubOverlayContainer) {
      this.stubOverlayContainer.destroy(true);
      this.stubOverlayContainer = null;
    }

    this.selectedNodeId = null;
    this.nodeMarkers?.forEach((marker) => {
      this.applyNodeMarkerSelection(marker, false);
    });

    this.setDebugSelectedNode('');
    this.setDebugLastAction('');
  }

  showStubOverlay(message, onClose) {
    if (this.stubOverlayContainer) {
      this.stubOverlayContainer.destroy(true);
      this.stubOverlayContainer = null;
    }

    const { width, height } = this.scale;
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45)
      .setDepth(30)
      .setInteractive();

    const panel = this.add.rectangle(width / 2, height / 2, 300, 120, 0x202a3f, 0.98)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(31);

    const label = this.add.text(width / 2, height / 2 - 20, message, {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '15px',
      align: 'center',
      wordWrap: { width: 260 },
    }).setOrigin(0.5).setDepth(32);

    const closeButton = this.add.rectangle(width / 2, height / 2 + 28, 120, 34, 0x2d8cff)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(32)
      .setInteractive({ useHandCursor: true });

    const closeLabel = this.add.text(width / 2, height / 2 + 28, 'Close', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(33);

    const close = () => {
      this.stubOverlayContainer?.destroy(true);
      this.stubOverlayContainer = null;
      onClose?.();
    };

    closeButton.on('pointerover', () => closeButton.setFillStyle(0x4da0ff));
    closeButton.on('pointerout', () => closeButton.setFillStyle(0x2d8cff));
    closeButton.on('pointerdown', close);

    this.stubOverlayContainer = this.add.container(0, 0, [
      backdrop,
      panel,
      label,
      closeButton,
      closeLabel,
    ]).setDepth(30);
  }

  getNodeInspectCopy(nodeType) {
    const copy = NODE_INSPECT_COPY[nodeType];
    if (copy) {
      return copy;
    }

    const fallbackLabel = nodeType ? `${nodeType.slice(0, 1).toUpperCase()}${nodeType.slice(1)}` : 'Node';
    return {
      abbr: nodeType?.slice(0, 2)?.toUpperCase() ?? '??',
      label: fallbackLabel,
      action: 'Enter node',
    };
  }

  openInspectPanel(node) {
    if (!node || this.isMoving) {
      return;
    }

    this.closeInspectPanel();

    const inspectCopy = this.getNodeInspectCopy(node.type);
    const { width, height } = this.scale;
    const panelWidth = 280;
    const panelHeight = 148;
    const panelX = width / 2;
    const panelY = height / 2;
    const buttonY = panelY + 45;

    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.24)
      .setDepth(26);

    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x182336, 0.98)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(27);

    const title = this.add.text(panelX, panelY - 42, inspectCopy.label, {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '17px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(28);

    const details = this.add.text(panelX, panelY - 4, [
      `Node ${node.id}`,
      '',
      `${inspectCopy.action}?`,
    ].join('\n'), {
      color: '#d7e5ff',
      fontFamily: 'Arial',
      fontSize: '13px',
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(28);

    const enterButton = this.add.rectangle(panelX - 50, buttonY, 84, 30, 0x3f7fe3)
      .setStrokeStyle(1, 0xe7f0ff)
      .setDepth(28)
      .setInteractive({ useHandCursor: true });

    const enterLabel = this.add.text(panelX - 50, buttonY, 'Enter', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(29);

    const cancelButton = this.add.rectangle(panelX + 50, buttonY, 84, 30, 0x3f4d64)
      .setStrokeStyle(1, 0xd5deeb)
      .setDepth(28)
      .setInteractive({ useHandCursor: true });

    const cancelLabel = this.add.text(panelX + 50, buttonY, 'Cancel', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(29);

    this.inspectTargetNodeId = node.id;
    this.inspectSubmitLocked = false;

    const cancelInspect = () => {
      this.showFeedback(`Inspect cancelled for ${node.id}`);
      this.closeInspectPanel();
    };

    const enterNode = () => {
      if (this.inspectSubmitLocked || this.isMoving) {
        return;
      }

      const latestNode = this.mapById.get(this.inspectTargetNodeId);
      const currentNode = this.mapById.get(GameState.currentNodeId);
      const isNeighbor = Boolean(latestNode && currentNode?.connections?.includes(latestNode.id));

      if (!latestNode || latestNode.id === GameState.currentNodeId || !isNeighbor) {
        this.showFeedback('Node is no longer valid');
        this.closeInspectPanel();
        return;
      }

      this.inspectSubmitLocked = true;
      this.showFeedback(`Entering ${latestNode.id}`);
      this.moveHeroTo(latestNode);
    };

    enterButton.on('pointerover', () => enterButton.setFillStyle(0x4a8df6));
    enterButton.on('pointerout', () => enterButton.setFillStyle(0x3f7fe3));
    cancelButton.on('pointerover', () => cancelButton.setFillStyle(0x4b5b74));
    cancelButton.on('pointerout', () => cancelButton.setFillStyle(0x3f4d64));

    enterButton.on('pointerdown', enterNode);
    cancelButton.on('pointerdown', cancelInspect);

    this.inspectOverlayContainer = this.add.container(0, 0, [
      backdrop,
      panel,
      title,
      details,
      enterButton,
      enterLabel,
      cancelButton,
      cancelLabel,
    ]).setDepth(26);

    this.showFeedback(`Inspecting ${node.id}`);
  }

  closeInspectPanel() {
    if (this.inspectOverlayContainer) {
      this.inspectOverlayContainer.destroy(true);
      this.inspectOverlayContainer = null;
    }

    this.inspectTargetNodeId = null;
    this.inspectSubmitLocked = false;
  }

  selectNode(node) {
    if (this.selectedNodeId) {
      const prev = this.nodeMarkers.get(this.selectedNodeId);
      this.applyNodeMarkerSelection(prev, false);
    }

    const marker = this.nodeMarkers.get(node.id);
    this.applyNodeMarkerSelection(marker, true);
    this.selectedNodeId = node.id;

    const mapBiome = GameState.data.map?.biome ?? 'unknown';
    const visibility = node.hidden ? 'hidden' : 'visible';
    const connections = node.connections?.join(', ') ?? 'none';

    const message = [
      `id: ${node.id}`,
      `type: ${node.type}`,
      `region: ${node.region}`,
      `biome: ${mapBiome}`,
      `visibility: ${visibility}`,
      `connections: ${connections}`,
    ].join(' | ');

    this.setDebugSelectedNode(`${node.id} (${node.type})`);
    this.setDebugLastAction(`Selected ${node.id}`);
    console.log(`[MapScene] ${message}`);
  }

  applyNodeMarkerSelection(marker, selected) {
    if (!marker) {
      return;
    }

    const baseScale = marker.getData?.('baseScale') ?? 1;
    marker.setScale(selected ? baseScale * 1.25 : baseScale);

    if (typeof marker.setStrokeStyle === 'function') {
      marker.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : 0x2b2b2b);
      return;
    }

    if (typeof marker.iterate !== 'function') {
      return;
    }

    marker.iterate((child) => {
      if (typeof child?.setStrokeStyle === 'function') {
        child.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : 0x596273);
      }
    });
  }

  showFeedback(message) {
    this.setDebugLastAction(message || '');
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = Boolean(enabled);
    this.syncDebugPanel();
  }

  setDebugSelectedNode(message) {
    this.debugState.selectedNode = message ? `selected node: ${message}` : 'selected node: —';
    this.syncDebugPanel();
  }

  setDebugLastAction(message) {
    this.debugState.lastAction = message ? `last action: ${message}` : 'last action: —';
    this.syncDebugPanel();
  }

  syncDebugPanel() {
    this.debugState.scene = `scene: ${this.scene.key}`;
    this.debugState.mode = 'ui mode: map';
    this.debugState.currentNode = `current node: ${GameState.currentNodeId ?? '—'}`;

    const pendingTransition = GameState.pendingTransition
      ? `${GameState.pendingTransition.type} (${GameState.pendingTransition.sourceNodeId})`
      : '—';
    this.debugState.pendingTransition = `pending transition: ${pendingTransition}`;

    if (typeof window === 'undefined' || !window.gameUi?.setDebugPanel) {
      return;
    }

    window.gameUi.setDebugPanel(this.debugState);
  }

  handleShutdown() {
    this.clearTransientUi();
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.scale.off('resize', this.handleResize, this);

    if (this.layoutRetryTimer) {
      window.clearTimeout(this.layoutRetryTimer);
      this.layoutRetryTimer = null;
    }

    const destroyIfAlive = (obj) => {
      if (obj?.scene) {
        obj.destroy();
      }
    };

    destroyIfAlive(this.mapBackgroundImage);
    destroyIfAlive(this.mapBackgroundOverlay);

    this.mapBackgroundImage = null;
    this.mapBackgroundOverlay = null;
    this.mapBounds = null;
  }

  handleResize(gameSize) {
    const viewport = this.getSafeViewportSize(gameSize);
    if (!viewport) {
      return;
    }

    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;

    this.layoutMapBackground(viewportWidth, viewportHeight);

    const mapNodes = GameState.data?.map?.nodes ?? [];
    mapNodes.forEach((node) => {
      const marker = this.nodeMarkers.get(node.id);
      if (!marker) {
        return;
      }

      const point = this.mapToScreen(node.x, node.y);
      marker.setPosition(point.x, point.y);
    });

    const currentNode = this.mapById?.get(GameState.currentNodeId);
    if (this.heroMarker && currentNode) {
      const point = this.mapToScreen(currentNode.x, currentNode.y);
      this.heroMarker.setPosition(point.x, point.y);
    }

  }

  updateHud() {
    if (typeof window === 'undefined' || !window.gameUi?.updateMapHud) {
      return;
    }

    window.gameUi.updateMapHud({
      turn: GameState.turnCounter,
      hp: HERO_HP_STUB,
      level: HERO_LEVEL_STUB,
    });
  }
}

import { SceneRouter } from './src/SceneRouter';

(() => {
  const overlay = document.getElementById('ui-overlay');
  const panel = document.getElementById('context-panel');
  const topBar = document.querySelector('.top-bar');
  const statusChips = Array.from(document.querySelectorAll('.status-chip'));
  const modeButtons = Array.from(document.querySelectorAll('.mode-btn[data-mode]'));
  const panelContents = Array.from(document.querySelectorAll('[data-panel-content]'));
  const castlePanelTitle = document.getElementById('castle-panel-title');
  const castlePanelBody = document.getElementById('castle-panel-body');
  const castlePanelBuildList = document.getElementById('castle-panel-build-list');
  const debugToggleButton = document.querySelector('[data-action="toggle-debug"]');
  const mapDebugPanel = document.getElementById('map-debug-panel');
  const debugFields = {
    scene: document.querySelector('[data-debug-field="scene"]'),
    mode: document.querySelector('[data-debug-field="mode"]'),
    currentNode: document.querySelector('[data-debug-field="currentNode"]'),
    selectedNode: document.querySelector('[data-debug-field="selectedNode"]'),
    pendingTransition: document.querySelector('[data-debug-field="pendingTransition"]'),
    lastAction: document.querySelector('[data-debug-field="lastAction"]'),
  };

  const routeableModes = new Set(['map', 'castle', 'battle']);

  const state = {
    activeMode: 'map',
    panelOpen: false,
    panelView: 'context',
    debugEnabled: false,
    debug: {
      scene: 'scene: MapScene',
      mode: 'ui mode: map',
      currentNode: 'current node: —',
      selectedNode: 'selected node: —',
      pendingTransition: 'pending transition: —',
      lastAction: 'last action: —',
    },
  };


  function renderDebugToggle() {
    if (!debugToggleButton) return;
    debugToggleButton.dataset.debugEnabled = String(state.debugEnabled);
    debugToggleButton.textContent = state.debugEnabled ? 'Debug ON' : 'Debug OFF';
    debugToggleButton.classList.toggle('ui-btn--primary', state.debugEnabled);
  }

  function renderDebugPanel() {
    if (!mapDebugPanel) return;

    const isVisible = state.debugEnabled && state.activeMode === 'map';
    mapDebugPanel.hidden = !isVisible;
    mapDebugPanel.setAttribute('aria-hidden', String(!isVisible));

    debugFields.scene && (debugFields.scene.textContent = state.debug.scene || 'scene: —');
    debugFields.mode && (debugFields.mode.textContent = state.debug.mode || 'ui mode: —');
    debugFields.currentNode && (debugFields.currentNode.textContent = state.debug.currentNode || 'current node: —');
    debugFields.selectedNode && (debugFields.selectedNode.textContent = state.debug.selectedNode || 'selected node: —');
    debugFields.pendingTransition && (debugFields.pendingTransition.textContent = state.debug.pendingTransition || 'pending transition: —');
    debugFields.lastAction && (debugFields.lastAction.textContent = state.debug.lastAction || 'last action: —');
  }

  function setDebugEnabled(enabled) {
    state.debugEnabled = Boolean(enabled);
    renderDebugToggle();
    renderDebugPanel();
  }

  function updateDebugPanel(payload = {}) {
    state.debug = {
      ...state.debug,
      ...payload,
    };
    renderDebugPanel();
  }

  function getRouter() {
    const game = window.__PORTAL_GAME;
    if (!game) {
      return null;
    }

    return new SceneRouter(game);
  }

  function renderPanelContent() {
    panelContents.forEach((section) => {
      const key = section.dataset.panelContent;
      if (state.panelView === 'hero') {
        section.hidden = key !== 'hero';
        return;
      }

      section.hidden = key !== state.activeMode;
    });

    panel.dataset.view = state.panelView;
  }

  function setPanelOpen(isOpen) {
    state.panelOpen = isOpen;
    panel.dataset.open = String(isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
  }

  function showHint(message) {
    updateDebugPanel({ lastAction: message ? `last action: ${message}` : 'last action: —' });
  }

  function resetMapUi() {
    setPanelView('context');
    setPanelOpen(false);

    const game = window.__PORTAL_GAME;
    const mapScene = game?.scene?.getScene?.('MapScene');
    mapScene?.clearTransientUi?.();
  }

  function returnToMap() {
    const game = window.__PORTAL_GAME;
    const battleScene = game?.scene?.isActive?.('BattleScene')
      ? game?.scene?.getScene?.('BattleScene')
      : null;

    if (battleScene?.returnToMap) {
      resetMapUi();
      battleScene.returnToMap();
      showHint('Tap a node to inspect.');
      return;
    }

    setMode('map', {
      routingOptions: {
        force: true,
        forceRestart: true,
        beforeMapReturn: () => {
          resetMapUi();
        },
        afterMapReturn: () => {
          const currentGame = window.__PORTAL_GAME;
          const mapScene = currentGame?.scene?.getScene?.('MapScene');
          mapScene?.ensureInputReady?.();
        },
      },
    });
    showHint('Tap a node to inspect.');
  }

  function routeToMode(mode, options = {}) {
    if (!routeableModes.has(mode)) {
      if (mode !== 'hero') {
        console.log(`[UI] scene routing unavailable for ${mode}`);
      }
      return;
    }

    const router = getRouter();
    if (!router) {
      console.log(`[UI] scene routing unavailable for ${mode}`);
      return;
    }

    router.goTo(mode, options);
  }

  function setMode(mode, options = {}) {
    if (!routeableModes.has(mode) && mode !== 'hero') {
      return;
    }

    state.activeMode = mode;
    overlay.dataset.mode = mode;
    updateTopBarDensity(mode);

    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === mode);
    });

    if (!options.skipRouting) {
      routeToMode(mode, options.routingOptions);
    }

    if (state.panelView === 'context') {
      renderPanelContent();
    }

    renderDebugPanel();
  }

  function setPanelView(view) {
    state.panelView = view;
    renderPanelContent();
  }

  function updateTopBarDensity(mode = state.activeMode) {
    const isCompactMode = mode === 'map' || mode === 'castle';
    topBar?.classList.toggle('top-bar--compact', isCompactMode);
  }

  function updateTopBar({ turn, hp, level }) {
    if (statusChips[0]) statusChips[0].textContent = `Turn ${turn}`;
    if (statusChips[1]) statusChips[1].textContent = `HP ${hp}`;
    if (statusChips[2]) statusChips[2].textContent = `Lv ${level}`;
  }


  const castlePanelContentByType = {
    build: {
      title: 'Build Panel',
      body: `Available buildings:
- Barracks
- Tavern
- Chapel`,
    },
    building: {
      title: 'Building Panel',
      body: `BARRACKS Level 1
Actions:
- Recruit units
- Upgrade building`,
    },
  };

  const contextActionLabels = {
    map: {
      inspect: '[UI] Map Inspect',
      move: '[UI] Map Move',
    },
    castle: {
      build: '[UI] Castle Build',
      leave: '[UI] Castle Leave',
    },
  };


  function openCastlePanel(panelType = 'build', payload = {}) {
    const panelContent = castlePanelContentByType[panelType] ?? castlePanelContentByType.build;
    const nextTitle = payload.title ?? panelContent.title;
    const nextBody = payload.body ?? panelContent.body;

    if (castlePanelTitle) {
      castlePanelTitle.textContent = nextTitle;
    }

    if (castlePanelBody) {
      castlePanelBody.textContent = nextBody;
    }

    if (castlePanelBuildList) {
      castlePanelBuildList.replaceChildren();
      const buildings = Array.isArray(payload.buildings) ? payload.buildings : [];
      buildings.forEach((building) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `ui-btn ${building.built ? '' : 'ui-btn--primary'}`.trim();
        button.dataset.action = 'castle-build';
        button.dataset.buildingId = building.buildingId;
        button.disabled = Boolean(building.built);
        button.textContent = building.built
          ? `${building.label} — Built`
          : `Build ${building.label}`;
        castlePanelBuildList.appendChild(button);
      });
    }

    if (state.activeMode !== 'castle') {
      setMode('castle', { skipRouting: true });
    }

    setPanelView('context');
    setPanelOpen(true);
  }

  function bindActions() {
    document.body.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      const action = trigger.dataset.action;
      if (action === 'set-mode' && trigger.dataset.mode) {
        const mode = trigger.dataset.mode;

        if (mode === 'map') {
          returnToMap();
          return;
        }

        setMode(mode);

        if (mode === 'castle') {
          resetMapUi();
          showHint('Castle mode');
          return;
        }

        if (mode === 'hero') {
          setPanelView('hero');
          setPanelOpen(true);
          return;
        }

        setPanelView('context');
        return;
      }

      if (action === 'open-panel') {
        const panelView = trigger.dataset.panelView ?? 'context';
        setPanelView(panelView);
        setPanelOpen(true);
        return;
      }

      if (action === 'close-panel') {
        setPanelOpen(false);
        return;
      }

      if (action === 'context') {
        const contextAction = trigger.dataset.contextAction;
        const message = contextActionLabels[state.activeMode]?.[contextAction] ?? `[UI] ${state.activeMode} ${contextAction}`;
        console.log(message);
        return;
      }

      if (action === 'start-battle') {
        console.log('[UI] Map Engage: Start Battle (stub)');
        routeToMode('battle');
        return;
      }

      if (action === 'toggle-debug') {
        const next = !state.debugEnabled;
        setDebugEnabled(next);
        const game = window.__PORTAL_GAME;
        const mapScene = game?.scene?.getScene?.('MapScene');
        mapScene?.setDebugEnabled?.(next);
        return;
      }

      if (action === 'castle-build') {
        const buildingId = trigger.dataset.buildingId;
        if (buildingId) {
          window.dispatchEvent(new CustomEvent('portal:castle-build', {
            detail: { buildingId },
          }));
        }
        return;
      }

      if (action === 'settings') {
        window.portalFullscreen?.toggle?.();
      }
    });
  }

  bindActions();
  setMode('map', { skipRouting: true });
  setPanelView('context');
  setPanelOpen(false);
  updateTopBar({ turn: 0, hp: 100, level: 1 });
  updateTopBarDensity('map');
  renderDebugToggle();
  renderDebugPanel();

  window.gameUi = {
    setMode: (mode) => setMode(mode, { skipRouting: true }),
    openSheet: () => {
      setPanelView('context');
      setPanelOpen(true);
    },
    closeSheet: () => setPanelOpen(false),
    openHero: () => {
      setPanelView('hero');
      setPanelOpen(true);
    },
    openCastlePanel,
    updateMapHud: updateTopBar,
    showHint,
    resetMapUi,
    returnToMap,
    setDebugPanel: updateDebugPanel,
    setDebugEnabled: (enabled) => {
      setDebugEnabled(enabled);
      const game = window.__PORTAL_GAME;
      const mapScene = game?.scene?.getScene?.('MapScene');
      mapScene?.setDebugEnabled?.(Boolean(enabled));
    },
    isDebugEnabled: () => state.debugEnabled,
  };
})();

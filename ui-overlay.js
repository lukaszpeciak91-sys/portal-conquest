import { SceneRouter } from './src/SceneRouter';

(() => {
  const overlay = document.getElementById('ui-overlay');
  const panel = document.getElementById('context-panel');
  const statusChips = Array.from(document.querySelectorAll('.status-chip'));
  const modeButtons = Array.from(document.querySelectorAll('.mode-btn[data-mode]'));
  const panelContents = Array.from(document.querySelectorAll('[data-panel-content]'));

  const routeableModes = new Set(['map', 'castle']);

  const state = {
    activeMode: 'map',
    panelOpen: false,
    panelView: 'context',
  };

  function renderPanelContent() {
    panelContents.forEach((section) => {
      const key = section.dataset.panelContent;
      if (state.panelView === 'objectives') {
        section.hidden = key !== 'objectives';
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
    const hint = document.querySelector('.hint-line');
    if (!hint) return;
    hint.textContent = message;
  }

  function resetMapUi() {
    setPanelView('context');
    setPanelOpen(false);

    const game = window.__PORTAL_GAME;
    const mapScene = game?.scene?.getScene?.('MapScene');
    mapScene?.clearTransientUi?.();
  }

  function routeToMode(mode) {
    const game = window.__PORTAL_GAME;

    if (!game?.scene || !routeableModes.has(mode)) {
      if (mode !== 'objectives') {
        console.log(`[UI] scene routing unavailable for ${mode}`);
      }
      return;
    }

    const router = new SceneRouter(game.scene);
    router.goTo(mode);
  }

  function setMode(mode, options = {}) {
    if (!routeableModes.has(mode) && mode !== 'objectives') {
      return;
    }

    state.activeMode = mode;
    overlay.dataset.mode = mode;

    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === mode);
    });

    if (!options.skipRouting) {
      routeToMode(mode);
    }

    if (state.panelView === 'context') {
      renderPanelContent();
    }
  }

  function setPanelView(view) {
    state.panelView = view;
    renderPanelContent();
  }

  function updateTopBar({ turn, hp, level }) {
    if (statusChips[0]) statusChips[0].textContent = `Turn ${turn}`;
    if (statusChips[1]) statusChips[1].textContent = `HP ${hp}`;
    if (statusChips[2]) statusChips[2].textContent = `Lv ${level}`;
  }

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

  function bindActions() {
    document.body.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      const action = trigger.dataset.action;
      if (action === 'set-mode' && trigger.dataset.mode) {
        const mode = trigger.dataset.mode;
        setMode(mode);

        if (mode === 'map') {
          resetMapUi();
          showHint('Tap a node to inspect.');
          return;
        }

        if (mode === 'castle') {
          resetMapUi();
          showHint('Castle mode');
          return;
        }

        if (mode === 'objectives') {
          setPanelView('objectives');
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

  window.gameUi = {
    setMode: (mode) => setMode(mode, { skipRouting: true }),
    openSheet: () => {
      setPanelView('context');
      setPanelOpen(true);
    },
    closeSheet: () => setPanelOpen(false),
    openObjectives: () => {
      setPanelView('objectives');
      setPanelOpen(true);
    },
    updateMapHud: updateTopBar,
    showHint,
    resetMapUi,
  };
})();

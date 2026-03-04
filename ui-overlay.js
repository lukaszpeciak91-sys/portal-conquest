(() => {
  const overlay = document.getElementById('ui-overlay');
  const panel = document.getElementById('context-panel');
  const statusChips = Array.from(document.querySelectorAll('.status-chip'));
  const modeButtons = Array.from(document.querySelectorAll('.mode-btn[data-mode]'));
  const panelContents = Array.from(document.querySelectorAll('[data-panel-content]'));

  const modeToScene = {
    map: 'MapScene',
    battle: 'BattleScene',
    castle: 'CastleScene',
  };

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

  function routeToMode(mode) {
    const game = window.__PORTAL_GAME;
    const sceneKey = modeToScene[mode];

    if (!game?.scene || !sceneKey) {
      console.log(`[UI] scene routing unavailable for ${mode}`);
      return;
    }

    const target = game.scene.getScene(sceneKey);
    if (!target) {
      console.log(`[UI] scene missing: ${sceneKey}`);
      return;
    }

    game.scene.start(sceneKey);
  }

  function setMode(mode, options = {}) {
    if (!modeToScene[mode]) {
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
    battle: {
      skills: '[UI] Battle Skills',
      'end-turn': '[UI] Battle End Turn',
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
        setMode(trigger.dataset.mode);
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

      if (action === 'settings') {
        console.log('[UI] Settings');
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
  };
})();

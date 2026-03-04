(() => {
  const overlay = document.getElementById('ui-overlay');
  const huds = Array.from(document.querySelectorAll('.hud[data-hud]'));
  const sheet = document.getElementById('bottom-sheet');
  const sheetTitle = document.getElementById('sheet-title');
  const mapHudChips = Array.from(document.querySelectorAll('.hud[data-hud="map"] .hud__group:last-child .hud__chip'));

  function syncViewportHeight() {
    document.documentElement.style.setProperty('--page-height', `${window.innerHeight}px`);
  }

  function setMode(mode) {
    overlay.dataset.mode = mode;
    huds.forEach((hud) => {
      hud.hidden = hud.dataset.hud !== mode;
    });

    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
    sheetTitle.textContent = `${modeLabel} panel`;
  }

  function setSheetOpen(isOpen) {
    sheet.dataset.open = String(isOpen);
    sheet.setAttribute('aria-hidden', String(!isOpen));
  }

  function updateMapHud({ turn, hp, level }) {
    if (mapHudChips[0]) {
      mapHudChips[0].textContent = `Turn: ${turn}`;
    }

    if (mapHudChips[1]) {
      mapHudChips[1].textContent = `HP: ${hp} | Lv: ${level}`;
    }
  }

  function bindActions() {
    document.body.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      const action = trigger.dataset.action;
      if (action === 'open-sheet') setSheetOpen(true);
      if (action === 'close-sheet') setSheetOpen(false);
      if (action === 'set-mode' && trigger.dataset.mode) {
        setMode(trigger.dataset.mode);
      }
    });
  }

  window.addEventListener('resize', syncViewportHeight);

  syncViewportHeight();
  bindActions();
  setMode('map');
  setSheetOpen(false);

  updateMapHud({ turn: 0, hp: 100, level: 1 });

  window.gameUi = {
    setMode,
    openSheet: () => setSheetOpen(true),
    closeSheet: () => setSheetOpen(false),
    updateMapHud,
  };
})();

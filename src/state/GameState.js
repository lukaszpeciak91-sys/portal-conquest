/**
 * Central runtime state for the current app session.
 */
export const GameState = {
  currentScene: 'MapScene',
  runSeed: null,
  isRunInitialized: false,
  currentNodeId: null,
  turnCounter: 0,
  nodeRuntime: {},
  pendingTransition: null,
  closedPortals: 0,
  data: {
    map: null,
    config: null,
    faction: null,
  },
};

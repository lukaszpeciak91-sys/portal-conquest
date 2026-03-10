import { GameState } from './GameState';

function createEmptyNodeState() {
  return {
    discovered: false,
    visited: false,
    cleared: false,
    consumed: false,
  };
}

export function getStartNodeId(map) {
  const castleNode = map?.nodes?.find((node) => node.type === 'castle');
  return castleNode?.id ?? map?.nodes?.[0]?.id ?? null;
}

export function clearPendingTransition() {
  GameState.pendingTransition = null;
}

export function setPendingTransition(transition) {
  GameState.pendingTransition = transition
    ? {
      type: transition.type,
      sourceNodeId: transition.sourceNodeId,
    }
    : null;
}

export function consumePendingTransition() {
  const transition = GameState.pendingTransition;
  clearPendingTransition();
  return transition;
}

export function ensureNodeRuntime(nodeId) {
  if (!nodeId) {
    return null;
  }

  if (!GameState.nodeRuntime[nodeId]) {
    GameState.nodeRuntime[nodeId] = createEmptyNodeState();
  }

  return GameState.nodeRuntime[nodeId];
}

export function markNodeState(nodeId, flags = {}) {
  const runtime = ensureNodeRuntime(nodeId);
  if (!runtime) {
    return;
  }

  Object.entries(flags).forEach(([key, value]) => {
    if (typeof value === 'boolean' && key in runtime) {
      runtime[key] = value;
    }
  });
}

export function isNodeConsumed(nodeId) {
  const runtime = ensureNodeRuntime(nodeId);
  return Boolean(runtime?.consumed);
}

export function isNodeCleared(nodeId) {
  const runtime = ensureNodeRuntime(nodeId);
  return Boolean(runtime?.cleared);
}

export function initializeRunState() {
  const map = GameState.data.map;

  if (GameState.isRunInitialized) {
    return;
  }

  GameState.nodeRuntime = {};
  GameState.buildings = {
    human: {
      barracks: 1,
    },
  };
  clearPendingTransition();

  const startNodeId = getStartNodeId(map);
  GameState.currentNodeId = startNodeId;

  if (startNodeId) {
    markNodeState(startNodeId, {
      discovered: true,
      visited: true,
    });
  }

  GameState.isRunInitialized = true;
}

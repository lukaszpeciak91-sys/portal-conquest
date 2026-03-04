import mapData from '../data/maps/map01.json';
import configData from '../data/config/mvp.json';
import factionData from '../data/factions/faction01.json';
import { GameState } from './GameState';

let hasLoaded = false;

/**
 * Loads static JSON data into GameState once per app boot.
 * @returns {typeof GameState}
 */
export function loadGameData() {
  if (hasLoaded) {
    return GameState;
  }

  GameState.data.map = mapData;
  GameState.data.config = configData;
  GameState.data.faction = factionData;

  if (!GameState.currentNodeId) {
    const castleNode = mapData.nodes.find((node) => node.type === 'castle');
    GameState.currentNodeId = castleNode?.id ?? mapData.nodes[0]?.id ?? null;
  }

  if (GameState.currentNodeId) {
    GameState.discoveredNodes.add(GameState.currentNodeId);
  }

  hasLoaded = true;
  console.log('Loaded map01.json');

  return GameState;
}

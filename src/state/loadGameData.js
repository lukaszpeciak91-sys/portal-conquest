import mapData from '../data/maps/map01.json';
import configData from '../data/config/mvp.json';
import factionData from '../data/factions/faction01.json';
import { GameState } from './GameState';
import { initializeRunState } from './runtimeState';

let hasLoaded = false;

/**
 * Loads static JSON data into GameState once per app boot.
 * @returns {typeof GameState}
 */
export function loadGameData() {
  if (!hasLoaded) {
    GameState.data.map = mapData;
    GameState.data.config = configData;
    GameState.data.faction = factionData;

    hasLoaded = true;
    console.log('Loaded map01.json');
  }

  initializeRunState();
  return GameState;
}

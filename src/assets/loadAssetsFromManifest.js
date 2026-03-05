import manifest from '../data/assets/asset-manifest.json';

const loadErrorHookedByScene = new WeakSet();

function normalizePath(path) {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  return `${baseUrl}${String(path ?? '').replace(/^\//, '')}`;
}

function ensureLoadErrorHook(scene) {
  if (loadErrorHookedByScene.has(scene)) {
    return;
  }

  scene.load.on('loaderror', (fileObj) => {
    const key = fileObj?.key ?? 'unknown';
    const src = fileObj?.src ?? 'unknown';
    console.warn(`[AssetLoader] Failed to load asset key="${key}" src="${src}"; scene will continue with fallback rendering.`);
  });

  loadErrorHookedByScene.add(scene);
}

export function loadAssetsFromManifest(scene, entries = []) {
  if (!scene?.load || !Array.isArray(entries)) {
    return;
  }

  ensureLoadErrorHook(scene);

  entries.forEach((entry) => {
    const key = entry?.key;
    const path = entry?.path;

    if (!key || !path) {
      return;
    }

    scene.load.image(key, normalizePath(path));
  });
}

export default manifest;

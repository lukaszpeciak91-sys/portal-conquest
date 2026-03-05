const DEFAULT_WARNING_PREFIX = '[ASSET WARNING]';

function warnMissingTexture(scene, textureKey) {
  if (!scene || !textureKey) {
    return;
  }

  if (!scene.__missingTextureWarnings) {
    scene.__missingTextureWarnings = new Set();
  }

  if (scene.__missingTextureWarnings.has(textureKey)) {
    return;
  }

  scene.__missingTextureWarnings.add(textureKey);
  console.warn(`${DEFAULT_WARNING_PREFIX} Missing texture: ${textureKey}`);
}

export function textureExists(scene, textureKey) {
  const exists = Boolean(scene?.textures?.exists(textureKey));

  if (!exists) {
    warnMissingTexture(scene, textureKey);
  }

  return exists;
}

export function addFallbackPlaceholder(scene, {
  x,
  y,
  width = 96,
  height = 96,
  label = 'missing asset',
  depth = 5,
  alpha = 0.95,
} = {}) {
  const container = scene.add.container(x, y).setDepth(depth);
  const rect = scene.add.rectangle(0, 0, width, height, 0x222222, alpha)
    .setStrokeStyle(2, 0x596273);
  const text = scene.add.text(0, 0, label, {
    color: '#ffffff',
    fontFamily: 'Arial',
    fontSize: '12px',
    align: 'center',
    wordWrap: { width: Math.max(60, width - 8) },
  }).setOrigin(0.5);

  container.add([rect, text]);

  return container;
}


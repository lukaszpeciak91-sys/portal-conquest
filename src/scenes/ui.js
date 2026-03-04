export function addDebugHeader(scene, title, subtitle) {
  scene.add.text(16, 16, title, {
    color: '#ffffff',
    fontFamily: 'Arial',
    fontSize: '28px',
    fontStyle: 'bold',
  });

  scene.add.text(16, 52, subtitle, {
    color: '#d0d0d0',
    fontFamily: 'Arial',
    fontSize: '16px',
  });
}

export function addButton(scene, x, y, label, onClick) {
  const width = 280;
  const height = 48;

  const button = scene.add
    .rectangle(x, y, width, height, 0x2d8cff)
    .setStrokeStyle(2, 0xffffff)
    .setInteractive({ useHandCursor: true });

  const text = scene.add.text(x, y, label, {
    color: '#ffffff',
    fontFamily: 'Arial',
    fontSize: '18px',
  });
  text.setOrigin(0.5);

  button.on('pointerover', () => button.setFillStyle(0x4da0ff));
  button.on('pointerout', () => button.setFillStyle(0x2d8cff));
  button.on('pointerdown', onClick);

  return { button, text };
}

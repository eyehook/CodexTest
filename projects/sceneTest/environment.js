import * as T from "three";
export function createEnvironment(scene, renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#999";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#777";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillRect(64, 64, 64, 64);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.anisotropy = 4;
  const floor = new T.Mesh(
    new T.PlaneGeometry(30, 30),
    new T.MeshStandardMaterial({ map: texture, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = floor.receiveShadow = true;
  scene.add(floor);
  // Bake a high-contrast neutral studio once. Window mullions, strip lights
  // and dark flags give curved metal clear features to reflect, without adding
  // geometry or lights to the visible test environment.
  const studio = new T.Scene();
  studio.background = new T.Color(0x303030);
  const room = new T.Mesh(
    new T.BoxGeometry(10, 8, 10),
    new T.MeshBasicMaterial({ color: 0x505050, side: T.BackSide }),
  );
  studio.add(room);
  const card = (x, y, z, width, height, color, brightness = 1) => {
    const material = new T.MeshBasicMaterial({
      color: new T.Color(color).multiplyScalar(brightness),
      side: T.DoubleSide,
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    return mesh;
  };
  // Front-facing window gives user-created metallic objects structured reflections.
  const frame = card(0, 1.2, 4.15, 4, 2.65, 0x151515);
  frame.rotation.set(0, Math.PI, 0);
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 3; column++) {
      const pane = card(
        (column - 1) * 1.2,
        0.62 + row * 1.15,
        4.1,
        1.04,
        0.98,
        0xffffff,
        row === 0 ? 2.4 : 3.4,
      );
      pane.rotation.set(0, Math.PI, 0);
    }
  }
  card(-4, 0.8, 0.6, 0.38, 4.6, 0xffffff, 4);
  card(3.8, 0.5, 1.6, 0.65, 3.8, 0xffffff, 2.5);
  card(0, 3.8, -1.2, 3.6, 2, 0xffffff, 2);
  card(3.5, 0.2, -2.5, 1.8, 4, 0x111111);
  const studioFloor = card(0, -3.9, 0, 10, 10, 0x202020);
  studioFloor.rotation.set(-Math.PI / 2, 0, 0);
  const pmrem = new T.PMREMGenerator(renderer);
  const result = pmrem.fromScene(studio, 0.04, 0.1, 30);
  scene.environment = result.texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  studio.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return result;
}

import * as THREE from "../../forest/vendor/three.module.js";
import { TableHandle } from "./TableHandle.mjs";
import { Settings } from "./Settings.mjs?v=ratings-2";
import { ChessBoard } from "./ChessBoard.mjs?v=capture-flight-1";
import { EngineController } from "./EngineController.mjs?v=ratings-2";
import { GameController } from "./GameController.mjs?v=ratings-2";
import { InputController } from "./InputController.mjs";
import { TableControls } from "./TableControls.mjs";
import { ProceduralAvatar } from "./ProceduralAvatar.mjs";
import { OpponentAnimator } from "./OpponentAnimator.mjs?v=capture-flight-1";
const $ = (id) => document.getElementById(id);
const settings = new Settings();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x29383f);
const camera = new THREE.PerspectiveCamera(43, 1, 0.02, 20);
camera.position.set(0.45, 0.65, 1.05);
camera.lookAt(0, 0.1, -0.15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
$("viewport").append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xfff4df, 0x566878, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(-2, 4, 3);
scene.add(sun);
const anchor = new THREE.Group();
scene.add(anchor);
const world = new THREE.Group();
anchor.add(world);
const board = new ChessBoard(world);
const ui = new TableControls(world);
ui.root.visible = false;
const avatar = new ProceduralAvatar(world);
const opponent = new OpponentAnimator(board, avatar);
let engineReady = false;
const engine = new EngineController({
  onStatus: (text) => {
    $("engine").textContent = text;
    engineReady = engine.ready;
    refreshEnter();
  },
});
const game = new GameController({
  board,
  engine,
  opponent,
  onChange: (state) => {
    engineReady = engine.ready;
    refreshEnter();
    $("game-status").textContent = state.message;
    $("game-status").dataset.playerColor = state.playerColor;
    $("player-side").textContent =
      `Playing ${state.playerColor === "w" ? "White" : "Black"}`;
    $("game-status").dataset.phase = state.phase;
    $("game-status").dataset.fen = state.game.fen();
    for (const key of ["height", "distance", "offset"])
      $(key).disabled =
        ["moving", "grabbing"].includes(state.phase) || !!tableHandle.active;
    ui.update(state.message, state.phase === "promotion");
    $("promotion").hidden = state.phase !== "promotion";
  },
});
function applyPosition(persist = true) {
  world.position.set(
    settings.offset,
    renderer.xr.isPresenting ? settings.height : 0,
    renderer.xr.isPresenting ? -settings.distance : 0,
  );
  if (persist) settings.save();
  for (const key of ["height", "distance", "offset"]) {
    $(key).value = settings[key];
    $(key).disabled =
      ["moving", "grabbing"].includes(game.phase) || !!tableHandle.active;
  }
  $("height-value").value = `${Math.round(-settings.height * 100)} cm`;
  $("distance-value").value = `${Math.round(settings.distance * 100)} cm`;
}
function action(a) {
  if (a === "restart") void game.restart(settings.elo, settings.side);
  else if (["q", "r", "b", "n"].includes(a)) game.promote(a);
  else {
    if (["moving", "grabbing"].includes(game.phase) || tableHandle.active)
      return;
    if (a === "height+")
      settings.height = Math.min(-0.1, settings.height + 0.025);
    if (a === "height-")
      settings.height = Math.max(-0.65, settings.height - 0.025);
    if (a === "near")
      settings.distance = Math.max(0.45, settings.distance - 0.025);
    if (a === "far") settings.distance = Math.min(1, settings.distance + 0.025);
    applyPosition();
  }
}
const tableHandle = new TableHandle({
  parent: world,
  settings,
  canGrab: () => !["moving", "grabbing", "thinking"].includes(game.phase),
  onMove: () => applyPosition(false),
  onEnd: () => applyPosition(),
});
const input = new InputController({
  renderer,
  scene,
  camera,
  board,
  ui,
  game,
  tableHandle,
  onAction: action,
});
$("side").value = settings.side;
$("side").onchange = () => {
  settings.side = $("side").value;
  settings.save();
  void game.restart(settings.elo, settings.side);
};
$("elo").value = settings.elo;
$("elo").onchange = () => {
  settings.elo = Number($("elo").value);
  settings.save();
  void game.restart(settings.elo, settings.side);
};
for (const key of ["height", "distance", "offset"])
  $(key).oninput = () => {
    if (tableHandle.active) return;
    settings[key] = Number($(key).value);
    applyPosition();
  };
$("restart").onclick = () => action("restart");
document
  .querySelectorAll("[data-promotion]")
  .forEach(
    (button) => (button.onclick = () => game.promote(button.dataset.promotion)),
  );
let xrSupported = false,
  starting = false,
  needsAnchor = false;
function refreshEnter() {
  $("enter").disabled =
    !xrSupported ||
    !engineReady ||
    starting ||
    !["player", "over"].includes(game.phase);
  $("enter").textContent = xrSupported ? "Enter VR" : "WebXR unavailable";
}
try {
  xrSupported =
    !!navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr"));
  $("xr-status").textContent = xrSupported
    ? "Quest controllers · seated play"
    : "Use Quest Browser over HTTPS or USB localhost for VR. Desktop play is available.";
} catch (e) {
  $("xr-status").textContent = e.message;
}
refreshEnter();
$("enter").onclick = async () => {
  starting = true;
  refreshEnter();
  try {
    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local"],
    });
    await renderer.xr.setSession(session);
  } catch (e) {
    $("xr-status").textContent = `Could not start VR: ${e.message}`;
  } finally {
    starting = false;
    refreshEnter();
  }
};
renderer.xr.addEventListener("sessionstart", () => {
  needsAnchor = true;
  ui.root.visible = true;
  applyPosition();
});
renderer.xr.addEventListener("sessionend", () => {
  game.interrupt();
  ui.root.visible = false;
  anchor.position.set(0, 0, 0);
  anchor.rotation.set(0, 0, 0);
  camera.position.set(0.45, 0.65, 1.05);
  camera.lookAt(0, 0.1, -0.15);
  applyPosition();
});
const resize = () => {
  const view = $("viewport");
  camera.aspect = view.clientWidth / view.clientHeight;
  camera.fov = camera.aspect < 1.2 ? 55 : 43; // Keep both capture trays in narrow desktop previews.
  camera.updateProjectionMatrix();
  renderer.setSize(view.clientWidth, view.clientHeight);
};
new ResizeObserver(resize).observe($("viewport"));
resize();
applyPosition();
let previous = 0;
let lastDiagnostics = 0;
renderer.setAnimationLoop((time, frame) => {
  const dt = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
  previous = time;
  let tracked = true;
  if (frame) {
    const reference = renderer.xr.getReferenceSpace(),
      pose = frame.getViewerPose(reference);
    tracked = !!pose && renderer.xr.getSession().visibilityState === "visible";
    if (needsAnchor && pose) {
      const p = pose.transform.position,
        q = pose.transform.orientation;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        new THREE.Quaternion(q.x, q.y, q.z, q.w),
      );
      anchor.position.set(p.x, p.y, p.z);
      anchor.rotation.y = Math.atan2(-forward.x, -forward.z);
      needsAnchor = false;
    }
    input.update(frame, reference, tracked);
  }
  if (tracked) {
    board.update(dt);
    opponent.update(dt);
  }
  renderer.render(scene, camera);
  if (time - lastDiagnostics > 1000) {
    lastDiagnostics = time;
    $("viewport").dataset.calls = renderer.info.render.calls;
    $("viewport").dataset.triangles = renderer.info.render.triangles;
  }
});
void game.restart(settings.elo, settings.side);
// Read-only diagnostics for desktop/headset inspection.
globalThis.chessDiagnostics = () => ({
  fen: game.game.fen(),
  phase: game.phase,
  playerColor: game.playerColor,
  animation: opponent.state,
  engineReady: engine.ready,
  engineElo: engine.elo,
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
});

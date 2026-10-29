import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../shared/vendor/three-r180/three.module.js";
import { TableHandle } from "../../projects/chess/src/TableHandle.mjs";
import { InputController } from "../../projects/chess/src/InputController.mjs";
import {
  ChessBoard,
  squarePosition,
} from "../../projects/chess/src/ChessBoard.mjs";
import { GameController } from "../../projects/chess/src/GameController.mjs";
import { Settings, effectiveElo } from "../../projects/chess/src/Settings.mjs";
import {
  HAND_RADIUS,
  COLUMN_HEIGHT,
  columnIntersects,
  squareUnder,
} from "../../projects/chess/src/HandInteraction.mjs";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function fixture() {
  const scene = new THREE.Scene(),
    world = new THREE.Group();
  scene.add(world);
  world.position.set(0.2, -0.3, -0.7);
  world.rotation.y = 0.7;
  const board = new ChessBoard(world);
  const engine = {
    dispose() {},
    async initialize() {},
    bestMove: () => new Promise(() => {}),
  };
  const game = new GameController({
    board,
    engine,
    opponent: { cancel() {}, async movePiece() {} },
  });
  await game.restart(1500);
  const controllers = [new THREE.Group(), new THREE.Group()],
    handlers = {},
    session = { visibilityState: "visible" },
    actions = [];
  const renderer = {
    xr: {
      isPresenting: true,
      getController: (i) => controllers[i],
      getSession: () => session,
      addEventListener() {},
    },
    domElement: { addEventListener: (type, fn) => (handlers[type] = fn) },
  };
  const input = new InputController({
    renderer,
    scene,
    camera: new THREE.PerspectiveCamera(),
    board,
    game,
    ui: { root: { visible: true }, targets: [] },
    onAction: (a) => actions.push(a),
  });
  const points = [new THREE.Vector3(2, 1, 0), new THREE.Vector3(-2, 1, 0)];
  const sources = controllers.map((controller, i) => {
    const source = {
      gripSpace: { i },
      gamepad: { buttons: [{ value: 0 }, { value: 0 }] },
    };
    controller.dispatchEvent({ type: "connected", data: source });
    return source;
  });
  let lost = -1;
  const frame = {
    getPose: (space) => {
      if (space.i === lost) return null;
      world.updateMatrixWorld(true);
      const p = world.localToWorld(points[space.i].clone());
      return { transform: { position: p } };
    },
  };
  const update = (visible = true) => input.update(frame, {}, visible);
  const move = (i, square, y = 0.1) => {
    points[i].copy(squarePosition(square));
    points[i].y = y;
    update();
  };
  const press = (i, button, value) => {
    sources[i].gamepad.buttons[button].value = value;
    update();
  };
  update();
  return {
    input,
    game,
    board,
    controllers,
    sources,
    points,
    session,
    actions,
    move,
    press,
    update,
    lose: (i) => {
      lost = i;
      update();
    },
    handlers,
    world,
    renderer,
  };
}
test("sphere/finite square column intersection includes radius at 6 inches and corners", () => {
  const p = squarePosition("e2");
  p.y = COLUMN_HEIGHT + HAND_RADIUS;
  assert.ok(columnIntersects(p, "e2"));
  p.y += 0.0001;
  assert.ok(!columnIntersects(p, "e2"));
  p.copy(squarePosition("e2"));
  p.y = 0.1;
  p.x += 0.03 + HAND_RADIUS * 0.8;
  p.z += 0.03 + HAND_RADIUS * 0.8;
  assert.ok(!columnIntersects(p, "e2"));
  p.z -= HAND_RADIUS * 0.8;
  assert.ok(columnIntersects(p, "e2"));
  for (const square of ["a1", "h1", "a8", "h8", "e4"])
    assert.equal(squareUnder(squarePosition(square)), square);
  assert.equal(squareUnder(new THREE.Vector3(0.3, 1, 0)), null);
});
for (const button of [0, 1])
  test(`hand ${button}: hover, pickup, carry and legal release with ${button ? "grip" : "trigger"}`, async () => {
    const f = await fixture(),
      i = button;
    f.move(i, "e2");
    assert.ok(f.board.interaction.hovered.has("e2"));
    assert.equal(f.input.hands[i].sphere.material.opacity, 0.5);
    assert.equal(f.board.pieces.get("e2").material, f.board.hoverMaterial);
    f.press(i, button, 1);
    assert.equal(f.game.phase, "grabbing");
    assert.ok(f.input.held);
    assert.ok(f.input.hands.every((h) => h.controller.children.length === 0));
    f.move(i, "e4", 0.25);
    assert.equal(f.board.interaction.over, "e4");
    assert.ok(f.board.interaction.valid);
    assert.equal(f.game.game.get("e2").type, "p");
    assert.ok(f.board.pieces.get("e2").position.y > 0.1);
    f.press(i, button, 0);
    await tick();
    assert.equal(f.game.game.get("e4").color, "w");
    assert.equal(f.game.phase, "thinking");
    assert.equal(f.input.held, null);
  });
test("illegal/offboard drops return to origin, and other hand cannot take held piece", async () => {
  const f = await fixture();
  f.move(0, "e2");
  f.press(0, 0, 1);
  f.move(1, "d2");
  f.press(1, 1, 1);
  assert.equal(f.input.held.from, "e2");
  f.move(0, "e5");
  assert.equal(f.board.interaction.valid, false);
  f.press(0, 0, 0);
  assert.equal(f.game.phase, "player");
  assert.ok(
    f.board.pieces.get("e2").position.distanceTo(squarePosition("e2")) < 1e-9,
  );
  f.press(1, 1, 0);
  f.move(1, "d2");
  f.press(1, 1, 1);
  f.points[1].x = 2;
  f.update();
  f.press(1, 1, 0);
  assert.equal(f.game.game.history().length, 0);
});
test("combined buttons release only after both are released; held buttons do not regrab", async () => {
  const f = await fixture();
  f.move(0, "e2");
  f.press(0, 0, 1);
  f.press(0, 1, 1);
  f.press(0, 0, 0);
  assert.ok(f.input.held);
  f.move(0, "e4");
  f.press(0, 1, 0);
  await tick();
  assert.equal(f.game.game.get("e4").color, "w");
});
for (const loss of [
  "viewer",
  "hidden",
  "pose",
  "disconnect",
  "restart",
  "buttons",
])
  test(`${loss} cancels held piece without a move or ghost regrab`, async () => {
    const f = await fixture();
    f.move(0, "e2");
    f.press(0, 0, 1);
    f.move(0, "e4");
    if (loss === "buttons") {
      f.sources[0].gamepad = null;
      f.update();
    }
    if (loss === "viewer") f.update(false);
    if (loss === "hidden") {
      f.session.visibilityState = "hidden";
      f.update();
    }
    if (loss === "pose") f.lose(0);
    if (loss === "disconnect")
      f.controllers[0].dispatchEvent({ type: "disconnected" });
    if (loss === "restart") {
      await f.game.restart(1500);
      f.update();
    }
    assert.equal(f.input.held, null);
    assert.equal(f.game.game.history().length, 0);
    assert.ok(f.board.pieces.has("e2"));
    f.session.visibilityState = "visible";
    f.update();
    assert.equal(f.input.held, null);
  });
test("VR controls require physical proximity and a fresh button press, with no rays", async () => {
  const f = await fixture();
  f.input.ray.intersectObjects = () => {
    throw Error("VR must not raycast");
  };
  f.press(0, 0, 1);
  assert.equal(f.actions.length, 0);
  f.press(0, 0, 0);
  const button = { userData: { action: "restart" } };
  f.input.ui.touchTarget = () => button;
  f.press(0, 0, 1);
  f.update();
  assert.deepEqual(f.actions, ["restart"]);
  f.press(0, 0, 0);
  f.press(0, 1, 1);
  assert.deepEqual(f.actions, ["restart", "restart"]);
  f.press(0, 1, 0);
  f.move(0, "e2");
  f.press(0, 0, 1);
  assert.equal(f.game.phase, "grabbing");
  assert.equal(f.actions.length, 2);
  assert.ok(
    f.controllers.every((controller) => controller.children.length === 0),
  );
});
test("Black pieces and out-of-range columns cannot be picked up", async () => {
  const f = await fixture();
  f.move(0, "e7");
  f.press(0, 0, 1);
  assert.equal(f.input.held, null);
  f.press(0, 0, 0);
  f.move(0, "e2", 0.2);
  f.press(0, 0, 1);
  assert.equal(f.input.held, null);
});
test("promotion stays at dropped square pending menu choice and commits only once", async () => {
  const f = await fixture();
  f.game.game.load("7k/P7/8/8/8/8/8/7K w - - 0 1");
  f.board.sync(f.game.game);
  f.move(0, "a7");
  f.press(0, 1, 1);
  f.move(0, "a8");
  f.press(0, 1, 0);
  assert.equal(f.game.phase, "promotion");
  assert.equal(f.game.game.get("a7").type, "p");
  assert.ok(
    f.board.pieces.get("a7").position.distanceTo(squarePosition("a8")) < 1e-9,
  );
  f.game.promote("n");
  await tick();
  assert.equal(f.game.game.get("a8").type, "n");
  assert.equal(f.game.phase, "over");
});
test("unavailable storage and malformed advertised range are safe", () => {
  const s = new Settings({
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  });
  assert.equal(s.elo, 1500);
  assert.doesNotThrow(() => s.save());
  assert.throws(() => effectiveElo(1500, {}));
});
test("player capture, en passant and castling settle before committing once", async () => {
  for (const [fen, from, to, captured] of [
    ["4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4", "d5", "d5"],
    ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5", "d6", "d5"],
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1", "g1", null],
  ]) {
    const f = await fixture();
    f.game.game.load(fen);
    f.board.sync(f.game.game);
    const victim = captured ? f.board.pieces.get(captured) : null;
    f.move(0, from);
    f.press(0, 1, 1);
    f.move(0, to);
    f.press(0, 1, 0);
    if (captured)
      assert.equal(
        f.game.game.history().length,
        0,
        "capture must land before commit",
      );
    let rookInFlight = false;
    for (let frame = 0; frame < 150; frame++) {
      f.board.update(1 / 72);
      if (from === "e1" && f.board.pieces.get("h1")?.position.y > 0.01) {
        rookInFlight = true;
        assert.equal(f.game.game.history().length, 0, "castling waits for rook landing");
        assert.equal(f.game.phase, "moving");
      }
      await Promise.resolve();
    }
    if (from === "e1") assert.ok(rookInFlight);
    await tick();
    assert.ok(f.game.game.get(to));
    assert.equal(f.game.game.history().length, 1);
    assert.ok(
      f.board.pieces.get(to).position.distanceTo(squarePosition(to)) < 1e-9,
    );
    if (victim) {
      assert.equal(victim.parent, null);
      assert.equal(f.board.capturedPieces.length, 1);
      assert.equal(f.board.capturedPieces[0].parent, f.board.capturedRoot);
    }
    if (from === "e1") assert.equal(f.game.game.get("f1").type, "r");
  }
});

for (const ending of ["release", "disconnect", "viewer", "restart"])
  test(`table handle ${ending}: exclusive ownership, stable drag and persistence`, async () => {
    const f = await fixture();
    let saves = 0;
    const settings = { height: -0.3, distance: 0.7, offset: 0.2 };
    const handle = new TableHandle({
      parent: f.world,
      settings,
      canGrab: () => !["grabbing", "moving", "thinking"].includes(f.game.phase),
      onMove: () => {
        f.world.position.y = settings.height;
        f.world.position.z = -settings.distance;
      },
      onEnd: () => saves++,
    });
    f.input.tableHandle = handle;
    f.points[0].set(0, -0.015, 0.345);
    f.update();
    assert.equal(f.input.hands[0].axes.visible, false);
    f.press(0, 1, 1);
    assert.equal(handle.active.owner, f.input.hands[0]);
    assert.equal(f.input.hands[0].axes.visible, true);
    assert.equal(f.input.hands[0].sphere.visible, false);
    assert.equal(f.input.held, null);
    f.move(1, "e2");
    f.press(1, 0, 1);
    assert.equal(f.input.held, null);
    const start = f.world.localToWorld(f.points[0].clone()),
      end = start.clone().add(new THREE.Vector3(0, 0.05, 0.1));
    for (let i = 0; i < 3; i++) {
      f.world.updateMatrixWorld(true);
      f.points[0].copy(f.world.worldToLocal(end.clone()));
      f.update();
    }
    assert.ok(Math.abs(settings.height + 0.25) < 1e-10);
    assert.ok(Math.abs(settings.distance - 0.6) < 1e-10);
    assert.equal(saves, 0);
    if (ending === "release") {
      f.world.updateMatrixWorld(true);
      f.points[0].copy(f.world.worldToLocal(end.clone()));
      f.press(0, 1, 0);
    }
    if (ending === "disconnect")
      f.controllers[0].dispatchEvent({ type: "disconnected" });
    if (ending === "viewer") f.update(false);
    if (ending === "restart") {
      await f.game.restart(1500);
      f.update();
    }
    assert.equal(handle.active, null);
    assert.equal(f.input.hands[0].axes.visible, false);
    assert.equal(saves, 1);
    assert.equal(f.game.game.history().length, 0);
  });
function attachPositioner(f) {
  let saves = 0;
  const handle = new TableHandle({
    parent: f.world,
    settings: { height: -0.3, distance: 0.7, offset: 0.2 },
    canGrab: () => f.game.phase === "player",
    onMove() {},
    onEnd: () => saves++,
  });
  f.input.tableHandle = handle;
  return { handle, saves: () => saves };
}
test("air positioning requires grip and ends on grip release with trigger held", async () => {
  const f = await fixture(),
    p = attachPositioner(f);
  f.press(0, 0, 1);
  assert.equal(p.handle.active, null);
  f.press(0, 1, 1);
  assert.equal(p.handle.active.owner, f.input.hands[0]);
  assert.equal(f.input.hands[0].axes.children.length, 6);
  f.press(0, 1, 0);
  assert.equal(p.handle.active, null);
  assert.equal(f.input.hands[0].axes.visible, false);
  assert.equal(f.input.hands[0].sphere.visible, true);
  assert.equal(p.saves(), 1);
});
test("piece columns reserve grip and leaving with grip held does not reposition", async () => {
  const f = await fixture(),
    p = attachPositioner(f);
  f.move(0, "e7");
  f.press(0, 1, 1);
  assert.equal(p.handle.active, null);
  f.points[0].set(2, 1, 0);
  f.update();
  assert.equal(p.handle.active, null);
  f.press(0, 1, 0);
  f.move(0, "e2");
  f.press(0, 1, 1);
  assert.equal(f.input.held.from, "e2");
  assert.equal(p.handle.active, null);
});
test("tabletop controls take priority over open-space grip", async () => {
  const f = await fixture(),
    p = attachPositioner(f);
  f.input.ui.touchTarget = () => ({ userData: { action: "restart" } });
  f.press(0, 1, 1);
  assert.equal(p.handle.active, null);
  assert.deepEqual(f.actions, ["restart"]);
});

for (const color of ["w", "b"])
  for (const type of ["q", "r", "b", "n"])
    test(`floating promotion ${color} ${type}: grabs without committing and commits on release`, async () => {
      const f = await fixture();
      f.game.playerColor = color;
      f.board.setPlayerColor(color);
      f.game.game.load(
        color === "w"
          ? "7k/P7/8/8/8/8/8/7K w - - 0 1"
          : "k7/8/8/8/8/8/p7/7K b - - 0 1",
      );
      f.board.sync(f.game.game);
      const from = color === "w" ? "a7" : "a2",
        to = color === "w" ? "a8" : "a1";
      f.game.beginGrab(from);
      f.game.dropGrab(to);
      assert.equal(f.game.phase, "promotion");
      assert.equal(f.board.promotionPanel.visible, true);
      assert.equal(f.board.promotionChoices.length, 4);
      const choice = f.board.promotionChoices.find(
        (p) => p.userData.promotion === type,
      );
      assert.equal(choice.material, f.board.materials[color]);
      f.board.root.updateWorldMatrix(true, true);
      const worldPoint = f.board.root.localToWorld(
        choice.position.clone().add(new THREE.Vector3(0, 0.04, 0)),
      );
      f.points[0].copy(f.world.worldToLocal(worldPoint));
      f.update();
      f.press(0, 1, 1);
      assert.equal(f.input.held.promotion, type);
      assert.equal(
        choice.material,
        color === "w" ? f.board.hoverMaterial : f.board.blackHoverMaterial,
      );
      assert.equal(f.game.game.get(from).type, "p");
      f.points[0].y += 0.2;
      f.update();
      assert.ok(choice.position.distanceTo(choice.userData.home) > 0.01);
      const releasePosition = choice.position.clone();
      f.press(0, 1, 0);
      assert.equal(f.game.phase, "moving");
      assert.equal(f.board.pieces.has(from), false);
      assert.equal(choice.parent, f.board.root);
      assert.ok(choice.position.distanceTo(releasePosition) < 1e-9);
      for (let i = 0; i < 40; i++) {
        f.board.update(1 / 72);
        await Promise.resolve();
      }
      await tick();
      assert.equal(f.game.game.get(to).type, type);
      assert.equal(f.board.promotionPanel.visible, false);
      assert.equal(f.input.held, null);
    });
test("lost promotion hand returns choice without committing and restart removes tray", async () => {
  const f = await fixture();
  f.game.game.load("7k/P7/8/8/8/8/8/7K w - - 0 1");
  f.board.sync(f.game.game);
  f.game.beginGrab("a7");
  f.game.dropGrab("a8");
  const piece = f.board.promotionChoices[0];
  assert.ok(
    f.input.beginPromotion(f.input.hands[0], piece, piece.position.clone()),
  );
  piece.position.x += 0.1;
  f.lose(0);
  assert.equal(f.input.held, null);
  assert.ok(piece.position.equals(piece.userData.home));
  assert.equal(f.game.phase, "promotion");
  assert.equal(f.game.game.get("a7").type, "p");
  await f.game.restart(1500);
  assert.equal(f.board.promotionPanel.visible, false);
});
test("capture promotion tray waits for victim flight and pawn landing", async () => {
  const f = await fixture();
  f.game.game.load("1r5k/P7/8/8/8/8/8/7K w - - 0 1");
  f.board.sync(f.game.game);
  f.game.beginGrab("a7");
  f.game.dropGrab("b8");
  assert.equal(f.game.phase, "moving");
  assert.equal(f.board.promotionPanel.visible, false);
  for (let i = 0; i < 180 && f.game.phase !== "promotion"; i++) {
    f.board.update(1 / 72);
    await Promise.resolve();
  }
  assert.equal(f.game.phase, "promotion");
  assert.ok(
    f.board.pieces.get("a7").position.distanceTo(squarePosition("b8")) < 1e-9,
  );
  assert.equal(f.board.promotionPanel.visible, true);
});

test("releasing over promotion tray cancels selection and eases choice back to slot", async () => {
  const f = await fixture();
  f.game.game.load("7k/P7/8/8/8/8/8/7K w - - 0 1");
  f.board.sync(f.game.game);
  f.game.beginGrab("a7");
  f.game.dropGrab("a8");
  const piece = f.board.promotionChoices[0];
  f.input.beginPromotion(f.input.hands[0], piece, piece.position.clone());
  piece.position.x += 0.03;
  f.input.release();
  assert.equal(f.game.phase, "promotion");
  assert.equal(f.game.game.get("a7").type, "p");
  assert.equal(f.board.pieces.get("a7").parent, f.board.root);
  assert.equal(piece.userData.returning, true);
  assert.ok(piece.position.distanceTo(piece.userData.home) > 0.02);
  for (let i = 0; i < 20; i++) {
    f.board.update(1 / 72);
    await Promise.resolve();
  }
  assert.equal(piece.userData.returning, false);
  assert.ok(piece.position.equals(piece.userData.home));
  assert.equal(f.board.promotionPanel.visible, true);
});
test("restart during promotion glide restores tray meshes and prevents stale promotion", async () => {
  const f = await fixture();
  f.game.game.load("7k/P7/8/8/8/8/8/7K w - - 0 1");
  f.board.sync(f.game.game);
  f.game.beginGrab("a7");
  f.game.dropGrab("a8");
  const piece = f.board.promotionChoices[0];
  f.input.beginPromotion(f.input.hands[0], piece, piece.position.clone());
  piece.position.y += 0.2;
  f.input.release();
  f.board.update(0.05);
  await f.game.restart(1500);
  await tick();
  assert.equal(f.game.game.get("a7").type, "p");
  assert.equal(f.game.game.get("a8").type, "r");
  assert.equal(piece.parent, f.board.promotionPanel);
  assert.equal(f.board.promotionPanel.visible, false);
  assert.equal(f.game.game.history().length, 0);
});

test("gaze exposes only a currently valid held piece and clears on release or tracking loss", async () => {
  const f = await fixture();
  assert.equal(f.input.getHeldPiece(), null);
  f.move(0, "e2");
  f.press(0, 0, 1);
  assert.equal(f.input.getHeldPiece(), f.board.pieces.get("e2"));
  f.move(0, "e4");
  f.press(0, 0, 0);
  assert.equal(f.input.getHeldPiece(), null);
  const cancelled = await fixture();
  cancelled.move(0, "d2");
  cancelled.press(0, 1, 1);
  cancelled.lose(0);
  assert.equal(cancelled.input.getHeldPiece(), null);
  const stale = await fixture();
  stale.move(0, "e2");
  stale.press(0, 0, 1);
  stale.game.epoch++;
  assert.equal(stale.input.getHeldPiece(), null);
});

for (const hand of [0, 1]) {
  test(`A/X hold on hand ${hand} is read independently of grip/trigger and clears on tracking loss`, async () => {
    const f = await fixture();
    for (const source of f.sources) {
      source.gamepad.mapping = "xr-standard";
      source.gamepad.buttons[4] = { value: 0 };
    }
    f.press(hand, 4, 1);
    assert.equal(f.input.isBestMoveHintHeld(), true);
    assert.equal(f.input.held, null);
    f.press(1 - hand, 4, 1); f.press(hand, 4, 0);
    assert.equal(f.input.isBestMoveHintHeld(), true);
    f.press(1 - hand, 4, 0); assert.equal(f.input.isBestMoveHintHeld(), false);
    f.press(hand, 4, 1); f.lose(hand);
    assert.equal(f.input.isBestMoveHintHeld(), false);
  });
}
test("hint hold ignores other mappings and clears when hidden or reset", async () => {
  const f = await fixture();
  f.sources[0].gamepad.buttons[4] = { value: 1 };
  f.update(); assert.equal(f.input.isBestMoveHintHeld(), false);
  f.sources[0].gamepad.mapping = "xr-standard";
  f.update(); assert.equal(f.input.isBestMoveHintHeld(), true);
  f.update(false); assert.equal(f.input.isBestMoveHintHeld(), false);
  f.update(); assert.equal(f.input.isBestMoveHintHeld(), true);
  f.input.reset(); assert.equal(f.input.isBestMoveHintHeld(), false);
});

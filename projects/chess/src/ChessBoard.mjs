import { knightGeometry } from "./KnightGeometry.mjs?v=edited-knight-1";
import * as THREE from "../../forest/vendor/three.module.js";
import { mergeGeometries } from "../../forest/vendor/BufferGeometryUtils.js";
import { Motion } from "./Motion.mjs";
export const CELL = 0.06;
export function squarePosition(square) {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error("Invalid square");
  return new THREE.Vector3(
    (square.charCodeAt(0) - 97 - 3.5) * CELL,
    0,
    (3.5 - (Number(square[1]) - 1)) * CELL,
  );
}
export const squareName = (i) =>
  `${String.fromCharCode(97 + (i % 8))}${1 + Math.floor(i / 8)}`;
function pieceGeometry(type) {
  if (type === "n") return knightGeometry().rotateY(Math.PI / 2);
  const parts = [];
  function add(g, x = 0, y = 0, z = 0, rz = 0) {
    g.rotateZ(rz);
    g.translate(x, y, z);
    parts.push(g.toNonIndexed());
    g.dispose();
  }
  const cylinder = (a, b, h, y) =>
    add(new THREE.CylinderGeometry(a, b, h, 10), 0, y);
  cylinder(0.02, 0.023, 0.009, 0.0045);
  cylinder(0.014, 0.019, 0.008, 0.013);
  cylinder(0.008, 0.014, 0.029, 0.0315);
  cylinder(0.014, 0.009, 0.006, 0.049);
  if (type === "p") add(new THREE.SphereGeometry(0.013, 10, 6), 0, 0.063);
  if (type === "r") {
    cylinder(0.019, 0.015, 0.017, 0.06);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      add(
        new THREE.BoxGeometry(0.012, 0.012, 0.012),
        Math.cos(a) * 0.012,
        0.074,
        Math.sin(a) * 0.012,
      );
    }
  }
  if (type === "b") {
    add(new THREE.SphereGeometry(0.014, 8, 6), 0, 0.064);
    add(new THREE.ConeGeometry(0.011, 0.025, 8), 0, 0.079);
  }
  if (type === "q") {
    cylinder(0.013, 0.009, 0.026, 0.065);
    cylinder(0.019, 0.011, 0.017, 0.085);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      add(
        new THREE.SphereGeometry(0.004, 6, 4),
        Math.cos(a) * 0.014,
        0.097,
        Math.sin(a) * 0.014,
      );
    }
  }
  if (type === "k") {
    cylinder(0.013, 0.009, 0.033, 0.069);
    add(new THREE.BoxGeometry(0.006, 0.025, 0.006), 0, 0.098);
    add(new THREE.BoxGeometry(0.023, 0.006, 0.006), 0, 0.101);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}
export class ChessBoard {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.pieces = new Map();
    this.capturedPieces = [];
    // Trays share the table frame, so side selection rotates only the playing board.
    this.capturedRoot = new THREE.Group();
    parent.add(this.capturedRoot);
    this.motion = new Motion();
    this.generation = 0;
    this.captureTask = null;
    this.capturePhase = "idle";
    this.geometries = Object.fromEntries(
      ["p", "r", "n", "b", "q", "k"].map((t) => [t, pieceGeometry(t)]),
    );
    this.materials = {
      w: new THREE.MeshStandardMaterial({ color: 0xeee5cb, roughness: 0.6 }),
      b: new THREE.MeshStandardMaterial({ color: 0x28343c, roughness: 0.5 }),
    };
    this.hoverMaterial = this.materials.w.clone();
    this.hoverMaterial.emissive.setHex(0x99651c);
    this.hoverMaterial.emissiveIntensity = 0.65;
    this.blackHoverMaterial = this.materials.b.clone();
    this.blackHoverMaterial.emissive.setHex(0x99651c);
    this.blackHoverMaterial.emissiveIntensity = 0.65;
    this.interaction = { hovered: new Set(), over: null, valid: false };
    this.squares = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CELL, 0.008, CELL),
      new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      64,
    );
    this.squares.userData.board = true;
    this.root.add(this.squares);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 64; i++) {
      const p = squarePosition(squareName(i));
      matrix.makeTranslation(p.x, -0.004, p.z);
      this.squares.setMatrixAt(i, matrix);
    }
    this.frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.53, 0.03, 0.53),
      new THREE.MeshStandardMaterial({ color: 0x674d36 }),
    );
    this.frame.position.y = -0.023;
    this.root.add(this.frame);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.055, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x3c4545 }),
    );
    table.position.y = -0.067;
    this.root.add(table);
    const trayGeometry = new THREE.BoxGeometry(0.14, 0.01, 0.45);
    const trayMaterial = new THREE.MeshStandardMaterial({
      color: 0x50605e,
      roughness: 0.9,
    });
    for (const x of [-0.53, 0.53]) {
      const tray = new THREE.Mesh(trayGeometry, trayMaterial);
      tray.position.set(x, -0.034, 0);
      this.capturedRoot.add(tray);
    }
    this.highlight({
      game: { isCheck: () => false },
      last: null,
      selected: null,
    });
  }
  setPlayerColor(color) {
    this.root.rotation.y = color === "b" ? Math.PI : 0;
    this.root.updateWorldMatrix(true, true);
  }
  setInteraction({ hovered = [], over = null, valid = false } = {}) {
    const key = `${[...hovered].sort().join(",")}:${over}:${valid}`;
    if (key === this.interactionKey) return;
    this.interactionKey = key;
    this.interaction = { hovered: new Set(hovered), over, valid };
    if (this.highlightState) this.highlight(this.highlightState);
  }
  placeHeld(move) {
    this.removeCapture(move);
    const piece = this.pieces.get(move.from);
    if (piece) {
      piece.position.copy(squarePosition(move.to));
      if (move.captured) piece.position.y = 0.26;
    }
  }
  squareToWorld(square) {
    return this.root.localToWorld(squarePosition(square));
  }
  sync(game) {
    this.motion.cancel();
    ++this.generation;
    this.captureTask = null;
    this.capturePhase = "idle";
    for (const piece of this.capturedPieces) piece.removeFromParent();
    this.capturedPieces = [];
    // Rebuild from committed history, not missing starting pieces: promotions and
    // custom FENs must not create fictitious captures, and cancelled moves roll back.
    for (const move of game.history({ verbose: true })) {
      if (!move.captured) continue;
      const color = move.color === "w" ? "b" : "w";
      this.addCaptured(
        new THREE.Mesh(this.geometries[move.captured], this.materials[color]),
        color,
        move.captured,
      );
    }
    this.interactionKey = null;
    this.interaction = { hovered: new Set(), over: null, valid: false };
    for (const piece of this.pieces.values()) piece.removeFromParent();
    this.pieces.clear();
    for (const row of game.board())
      for (const piece of row)
        if (piece) {
          const mesh = new THREE.Mesh(
            this.geometries[piece.type],
            this.materials[piece.color],
          );
          mesh.position.copy(squarePosition(piece.square));
          mesh.userData.square = piece.square;
          mesh.userData.color = piece.color;
          mesh.userData.type = piece.type;
          this.pieces.set(piece.square, mesh);
          this.root.add(mesh);
        }
  }
  highlight(state) {
    this.highlightState = state;
    const { game, last, selected } = state;
    for (const [square, piece] of this.pieces) {
      piece.material =
        this.interaction.hovered.has(square) || square === selected
          ? piece.userData.color === "w"
            ? this.hoverMaterial
            : this.blackHoverMaterial
          : this.materials[piece.userData.color];
    }
    const legal = new Set(
      selected
        ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
        : [],
    );
    let checkSquare = null;
    if (game.isCheck())
      for (const row of game.board())
        for (const p of row)
          if (p?.type === "k" && p.color === game.turn())
            checkSquare = p.square;
    for (let i = 0; i < 64; i++) {
      const sq = squareName(i);
      const light = ((i % 8) + Math.floor(i / 8)) % 2 === 1;
      let color = light ? 0xd9d1b9 : 0x607571;
      if (last && (sq === last.from || sq === last.to)) color = 0x9caa64;
      if (legal.has(sq)) color = 0x67bd9e;
      if (sq === selected) color = 0xe9ba59;
      if (sq === checkSquare) color = 0xd96659;
      if (sq === this.interaction.over)
        color = this.interaction.valid ? 0x32e6a3 : 0xe67255;
      this.squares.setColorAt(i, new THREE.Color(color));
    }
    this.squares.instanceColor.needsUpdate = true;
  }
  addCaptured(piece, color, type) {
    const index = this.capturedPieces.filter(
      (p) => p.userData.color === color,
    ).length;
    piece.userData = { captured: true, color, type };
    piece.material = this.materials[color];
    piece.position.set(
      (color === "w" ? -1 : 1) * (0.5 + Math.floor(index / 8) * 0.06),
      -0.029,
      -0.182 + (index % 8) * 0.052,
    );
    piece.quaternion.identity();
    piece.scale.set(1, 1, 1);
    this.capturedRoot.add(piece);
    this.capturedPieces.push(piece);
  }
  removeCapture(move) {
    if (!move.captured) return Promise.resolve(true);
    const square = move.flags.includes("e")
      ? `${move.to[0]}${move.from[1]}`
      : move.to;
    const target = this.pieces.get(square);
    if (!target) return this.captureTask ?? Promise.resolve(true);
    this.pieces.delete(square);
    // Preserve the existing victim mesh and its world pose throughout the flight.
    this.capturedRoot.updateWorldMatrix(true, true);
    this.capturedRoot.attach(target);
    const start = target.position.clone(),
      rotation = target.quaternion.clone();
    this.addCaptured(target, target.userData.color, move.captured);
    const landing = target.position.clone();
    target.position.copy(start);
    target.quaternion.copy(rotation);
    this.captureTask = this.flyCapture(
      target,
      start,
      landing,
      rotation,
      this.generation,
    );
    return this.captureTask;
  }
  async flyCapture(piece, start, landing, rotation, generation) {
    const high = Math.max(start.y, landing.y) + 0.127; // Five inches of vertical clearance.
    const raised = start.clone();
    raised.y = high;
    const above = landing.clone();
    above.y = high;
    const stage = async (phase, from, to, seconds) => {
      if (generation !== this.generation) return false;
      this.capturePhase = phase;
      const complete = await this.motion.tween(seconds, (t) => {
        piece.position.lerpVectors(from, to, t);
        if (phase === "landing")
          piece.quaternion.slerpQuaternions(
            rotation,
            new THREE.Quaternion(),
            t,
          );
      });
      return complete && generation === this.generation;
    };
    if (!(await stage("lifting", start, raised, 0.22))) return false;
    if (!(await stage("carrying", raised, above, 0.5))) return false;
    if (!(await stage("landing", above, landing, 0.24))) return false;
    this.capturePhase = "idle";
    return true;
  }
  async finishPlacement(move) {
    if (!move.captured) return;
    const generation = this.generation;
    if (!(await this.captureTask) || generation !== this.generation) return;
    const piece = this.pieces.get(move.from);
    if (!piece) return;
    const from = piece.position.clone(),
      to = squarePosition(move.to);
    await this.motion.tween(0.22, (t) =>
      piece.position.lerpVectors(from, to, t),
    );
  }
  async animateMove(move) {
    const piece = this.pieces.get(move.from);
    if (!piece) throw new Error("Missing source piece");
    const generation = this.generation;
    if (!(await this.removeCapture(move)) || generation !== this.generation)
      return;
    const from = piece.position.clone(),
      to = squarePosition(move.to);
    await this.motion.tween(0.35, (t) => {
      piece.position.lerpVectors(from, to, t);
      piece.position.y = Math.sin(t * Math.PI) * 0.15;
    });
  }
  update(dt) {
    this.motion.update(dt);
  }
}

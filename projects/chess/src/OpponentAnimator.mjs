import * as THREE from "../../forest/vendor/three.module.js";
import { Motion } from "./Motion.mjs";
import { squarePosition } from "./ChessBoard.mjs";
export class OpponentAnimator {
  constructor(board, avatar) {
    this.board = board;
    this.avatar = avatar;
    this.motion = new Motion();
    this.generation = 0;
    this.state = "rest";
  }
  update(dt) {
    this.motion.update(dt);
  }
  cancel() {
    ++this.generation;
    this.motion.cancel();
    this.board.motion.cancel();
    this.avatar.reset();
    this.state = "rest";
  }
  async movePiece(move) {
    const generation = this.generation;
    if (
      !(await this.board.removeCapture(move)) ||
      generation !== this.generation
    )
      return;
    if (!(await this.carry(move.from, move.to, generation))) return;
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.from[1],
        kingSide = move.flags.includes("k");
      if (
        !(await this.carry(
          `${kingSide ? "h" : "a"}${rank}`,
          `${kingSide ? "f" : "d"}${rank}`,
          generation,
        ))
      )
        return;
    }
    this.state = "return";
    await this.travel(this.avatar.restTarget, 0.45, generation);
    if (generation === this.generation) this.state = "rest";
  }
  async travel(target, seconds, generation) {
    const start = this.avatar.getHandPosition();
    const ok = await this.motion.tween(seconds, (t) => {
      this.avatar.setHandTarget(start.clone().lerp(target, t));
    });
    return ok && generation === this.generation;
  }
  async carry(from, to, generation) {
    const piece = this.board.pieces.get(from);
    if (!piece) throw new Error(`Missing piece at ${from}`);
    const box = new THREE.Box3().setFromObject(piece);
    const grip = Math.max(0.04, (box.max.y - box.min.y) * 0.85);
    const target = (square, height) => {
      const p = squarePosition(square);
      p.y = height;
      return this.board.root.localToWorld(p);
    };
    const sourceHigh = target(from, grip + 0.24),
      sourceLow = target(from, grip),
      destHigh = target(to, grip + 0.24),
      destLow = target(to, grip);
    const arm = this.avatar.closestArm?.(sourceLow);
    if (arm !== undefined && arm !== this.avatar.activeArm) {
      // Finish returning the previous arm before switching (also during castling).
      if (!(await this.travel(this.avatar.restTarget, 0.3, generation)))
        return false;
      this.avatar.selectArm(arm);
    }
    this.state = "reach";
    if (!(await this.travel(sourceHigh, 0.4, generation))) return false;
    this.state = "lower";
    if (!(await this.travel(sourceLow, 0.25, generation))) return false;
    // Object3D.attach preserves world transform; the hand stays upright during transport.
    this.avatar.attachment.updateWorldMatrix(true, true);
    this.avatar.attachment.attach(piece);
    this.state = "lift";
    if (!(await this.travel(sourceHigh, 0.25, generation))) return false;
    this.state = "carry";
    if (!(await this.travel(destHigh, 0.6, generation))) return false;
    this.state = "place";
    if (!(await this.travel(destLow, 0.25, generation))) return false;
    this.board.root.attach(piece);
    piece.position.copy(squarePosition(to));
    piece.quaternion.identity();
    piece.scale.set(1, 1, 1);
    this.board.pieces.delete(from);
    this.board.pieces.set(to, piece);
    piece.userData.square = to;
    this.state = "clear";
    return this.travel(destHigh, 0.25, generation);
  }
}

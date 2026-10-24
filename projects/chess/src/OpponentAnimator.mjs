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
  update(dt, playerPiece = null) {
    this.motion.update(dt);
    const piece = this.lookPiece ?? playerPiece;
    if (piece) {
      if (!piece.geometry.boundingBox) piece.geometry.computeBoundingBox();
      const center = piece.geometry.boundingBox.getCenter(new THREE.Vector3());
      this.avatar.setLookTarget?.(piece.localToWorld(center));
    } else this.avatar.setLookTarget?.(null);
  }
  cancel() {
    this.lookPiece = null;
    this.avatar.setLookTarget?.(null);
    ++this.generation;
    this.motion.cancel();
    this.board.motion.cancel();
    this.avatar.reset();
    this.state = "rest";
  }
  async movePiece(move) {
    const generation = this.generation;
    if (!(await this.carry(move.from, move.to, generation, move))) return;
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
    this.lookPiece = null;
    this.avatar.setLookTarget?.(null);
    this.state = "return";
    await this.travel(this.avatar.restTarget, 0.45, generation);
    if (generation === this.generation) this.state = "rest";
    // Any final capture settling happens only after the arm has returned normally.
    if (generation === this.generation) await this.board.captureTask;
  }
  async pinch(amount, generation) {
    if (!this.avatar.setPinch) return true;
    const start = this.avatar.arms[this.avatar.activeArm].pinch;
    this.state = amount ? "pinch" : "release";
    const ok = await this.motion.tween(0.16, (t) =>
      this.avatar.setPinch(start + (amount - start) * t),
    );
    return ok && generation === this.generation;
  }
  async travel(
    target,
    seconds,
    generation,
    onProgress = () => {},
    arcHeight = 0.08,
  ) {
    const start = this.avatar.getHandPosition();
    const ok = await this.motion.tween(seconds, (t) => {
      const point = start.clone().lerp(target, t);
      point.y += 4 * arcHeight * t * (1 - t);
      this.avatar.setHandTarget(point);
      onProgress(t);
    });
    return ok && generation === this.generation;
  }
  async carry(from, to, generation, move = null) {
    const piece = this.board.pieces.get(from);
    if (!piece) throw new Error(`Missing piece at ${from}`);
    const box = new THREE.Box3().setFromObject(piece);
    const height = box.max.y - box.min.y;
    const grip = this.avatar.setPinch
      ? Math.max(0.025, height - 0.003)
      : Math.max(0.04, height * 0.85);
    this.avatar.prepareGrip?.(piece);
    const target = (square, height) => {
      const p = squarePosition(square);
      p.y = height;
      return this.board.root.localToWorld(p);
    };
    const sourceLow = target(from, grip),
      destLow = target(to, grip);
    const arm = this.avatar.closestArm?.(sourceLow);
    if (arm !== undefined && arm !== this.avatar.activeArm) {
      // Completed moves already return to rest. Repeating an arched return
      // makes the old hand lift before the correct hand starts reaching.
      // Only an in-progress multi-piece move (castling) needs this return.
      if (this.state !== "rest") {
        this.state = "return";
        if (!(await this.travel(this.avatar.restTarget, 0.3, generation)))
          return false;
      }
      this.avatar.selectArm(arm);
    }
    piece.geometry.computeBoundingBox();
    this.lookPiece = piece;
    this.state = "reach";
    if (!(await this.travel(sourceLow, 0.55, generation))) return false;
    if (!(await this.pinch(1, generation))) return false;
    this.avatar.attachment.updateWorldMatrix(true, true);
    this.avatar.attachment.attach(piece);
    this.state = "carry";
    let capture = null;
    // One uninterrupted arch joins pickup and placement, including descent.
    if (
      !(await this.travel(
        destLow,
        0.9,
        generation,
        (t) => {
          if (t >= 0.85) this.state = "place";
          if (move?.captured && !capture && t >= 0.85)
            capture = this.board.removeCapture(move);
        },
        0.18,
      ))
    )
      return false;
    this.board.root.attach(piece);
    piece.position.copy(squarePosition(to));
    piece.quaternion.identity();
    piece.scale.set(1, 1, 1);
    this.board.pieces.delete(from);
    this.board.pieces.set(to, piece);
    piece.userData.square = to;
    if (!(await this.pinch(0, generation))) return false;
    return true;
  }
}

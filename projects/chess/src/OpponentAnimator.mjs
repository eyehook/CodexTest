import * as THREE from "../../../shared/vendor/three-r180/three.module.js";
import { Motion } from "./Motion.mjs?v=shared-r180-1";
import { squarePosition } from "./ChessBoard.mjs?v=shared-r180-1";
export class OpponentAnimator {
  constructor(board, avatar, { random = Math.random } = {}) {
    this.board = board;
    this.avatar = avatar;
    this.random = random;
    this.motion = new Motion();
    this.generation = 0;
    this.state = "rest";
  }
  update(dt, playerPiece = null, keepBoardGaze = false, idleGaze = false, playerHead = null) {
    this.motion.update(dt);
    const piece = this.lookPiece ?? playerPiece;
    if (piece) {
      this.idleGaze = null;
      if (!piece.geometry.boundingBox) piece.geometry.computeBoundingBox();
      const center = piece.geometry.boundingBox.getCenter(new THREE.Vector3());
      this.boardLookTarget = piece.localToWorld(center);
      this.avatar.setLookTarget?.(this.boardLookTarget);
    } else if (keepBoardGaze) {
      this.idleGaze = null;
      // Bridge player placement and engine thinking without looking back up.
      this.avatar.setLookTarget?.(
        this.boardLookTarget ?? this.board.root.localToWorld(new THREE.Vector3()),
      );
    } else if (idleGaze && this.state === "rest") {
      this.updateIdleGaze(dt, playerHead);
    } else {
      this.idleGaze = null;
      this.boardLookTarget = null;
      this.avatar.setLookTarget?.(null);
    }
  }
  updateIdleGaze(dt, playerHead = null) {
    const dwell = () => 3 + this.random() * 3;
    if (!this.idleGaze) this.idleGaze = { piece: null, remaining: dwell() };
    const gaze = this.idleGaze;
    gaze.remaining -= Math.min(0.05, Math.max(0, dt));
    // Both colors are eligible; captured pieces are outside this map.
    const pieces = [...this.board.pieces.values()];
    if (gaze.remaining <= 0) {
      if (gaze.piece) gaze.piece = null;
      else {
        const candidates = pieces.filter((piece) => piece !== this.lastIdlePiece);
        const choices = candidates.length ? candidates : pieces;
        gaze.piece = choices[Math.floor(this.random() * choices.length)] ?? null;
        this.lastIdlePiece = gaze.piece;
      }
      gaze.remaining = dwell();
    }
    if (gaze.piece && !pieces.includes(gaze.piece)) gaze.piece = null;
    if (gaze.piece) {
      const piece = gaze.piece;
      if (!piece.geometry.boundingBox) piece.geometry.computeBoundingBox();
      this.boardLookTarget = piece.localToWorld(
        piece.geometry.boundingBox.getCenter(new THREE.Vector3()),
      );
    } else this.boardLookTarget = null;
    // A slower response gives idle glances a relaxed transition in both directions.
    this.avatar.setLookTarget?.(gaze.piece ? this.boardLookTarget : playerHead, 1.5);
  }
  cancel() {
    this.idleGaze = null;
    this.lastIdlePiece = null;
    this.boardLookTarget = null;
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
    // Pawns always slide; other pieces slide only to adjacent squares.
    const adjacent = Math.max(
      Math.abs(to.charCodeAt(0) - from.charCodeAt(0)),
      Math.abs(Number(to[1]) - Number(from[1])),
    ) === 1;
    if (
      !(await this.travel(
        destLow,
        adjacent ? 0.5 : 0.9,
        generation,
        (t) => {
          if (t >= 0.85) this.state = "place";
          if (move?.captured && !capture && t >= 0.85)
            capture = this.board.removeCapture(move);
        },
        adjacent || move?.piece === "p" ? 0 : 0.18,
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

import * as THREE from "../../../shared/vendor/three-r180/three.module.js";
import { squareName } from "./ChessBoard.mjs?v=shared-r180-1";
import {
  HAND_RADIUS,
  inPieceVolume,
  nearestPiece,
  squareUnder,
  buttonDown,
} from "./HandInteraction.mjs?v=shared-r180-1";
export class InputController {
  constructor({
    renderer,
    scene,
    camera,
    board,
    ui,
    game,
    tableHandle = null,
    onAction,
  }) {
    Object.assign(this, {
      renderer,
      scene,
      camera,
      board,
      ui,
      game,
      tableHandle,
      onAction,
    });
    this.ray = new THREE.Raycaster();
    this.held = null;
    const geometry = new THREE.SphereGeometry(HAND_RADIUS, 12, 8);
    this.hands = [0, 1].map((i) => {
      const controller = renderer.xr.getController(i);
      scene.add(controller);
      const sphere = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x83e3c4,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      sphere.visible = false;
      scene.add(sphere);
      const axes = new THREE.Group();
      for (const [direction, color] of [
        [new THREE.Vector3(1, 0, 0), 0xf06060],
        [new THREE.Vector3(0, 1, 0), 0x70df80],
        [new THREE.Vector3(0, 0, 1), 0x65aaff],
      ])
        for (const sign of [-1, 1]) {
          axes.add(
            new THREE.ArrowHelper(
              direction.clone().multiplyScalar(sign),
              new THREE.Vector3(),
              0.085,
              color,
              0.022,
              0.014,
            ),
          );
        }
      axes.visible = false;
      scene.add(axes);
      const hand = {
        axes,
        controller,
        sphere,
        source: null,
        tracked: false,
        armed: false,
        trigger: false,
        grip: false,
        hover: null,
        hint: false,
      };
      controller.addEventListener("connected", (e) => {
        this.loseHand(hand);
        hand.source = e.data;
        hand.armed = false;
      });
      controller.addEventListener("disconnected", () => {
        hand.source = null;
        this.loseHand(hand);
      });
      return hand;
    });
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => this.pointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.pointerMove(e));
    canvas.addEventListener("pointerup", (e) => this.pointerUp(e));
    canvas.addEventListener("pointercancel", () => this.cancelHeld());
    canvas.addEventListener("lostpointercapture", () => {
      if (this.held?.owner === "mouse") this.cancelHeld();
    });
    renderer.xr.addEventListener?.("sessionend", () => this.reset());
    renderer.xr.addEventListener?.("sessionstart", () => this.reset());
  }
  cancelHeld() {
    this.tableHandle?.end();
    if (this.held?.promotion) this.board.resetPromotionChoice(this.held.piece);
    this.held = null;
    this.board.highlightPromotionReturn?.(false);
    this.board.highlightPromotion?.();
    this.game.cancelGrab();
    this.board.setInteraction();
  }
  reset() {
    this.cancelHeld();
    for (const hand of this.hands) {
      hand.armed = false;
      hand.tracked = false;
      hand.hint = false;
      hand.sphere.visible = false;
      hand.axes.visible = false;
      hand.hover = null;
    }
  }
  loseHand(hand) {
    if (this.tableHandle?.active?.owner === hand) this.tableHandle.end();
    hand.axes.visible = false;
    hand.controlHover = null;
    if (this.held?.owner === hand) this.cancelHeld();
    hand.tracked = false;
    hand.hint = false;
    hand.armed = false;
    hand.hover = null;
    hand.sphere.visible = false;
    hand.axes.visible = false;
  }
  checkHeld() {
    if (
      this.tableHandle?.active &&
      (this.tableHandle.active.epoch !== this.game.epoch ||
        !this.tableHandle.canGrab())
    )
      this.tableHandle.end();
    if (
      this.held &&
      (this.game.epoch !== this.held.epoch ||
        (this.held.promotion
          ? this.game.phase !== "promotion"
          : this.game.phase !== "grabbing" ||
            this.board.pieces.get(this.held.from) !== this.held.piece))
    ) {
      if (this.held.promotion) this.board.resetPromotionChoice(this.held.piece);
      this.held = null;
      this.board.setInteraction();
    }
  }
  isBestMoveHintHeld() {
    return this.hands.some((hand) => hand.tracked && hand.hint);
  }
  getHeldPiece() {
    this.checkHeld();
    return this.held?.piece ?? null;
  }
  beginPromotion(owner, piece, point) {
    if (
      this.held ||
      this.tableHandle?.active ||
      this.game.phase !== "promotion"
    )
      return false;
    this.held = {
      owner,
      piece,
      promotion: piece.userData.promotion,
      epoch: this.game.epoch,
      offset: piece.position.clone().sub(point),
    };
    return true;
  }
  begin(owner, from, point) {
    if (this.held || this.tableHandle?.active || !this.game.beginGrab(from))
      return false;
    const piece = this.board.pieces.get(from);
    this.held = {
      owner,
      from,
      piece,
      epoch: this.game.epoch,
      offset: piece.position.clone().sub(point),
      legal: new Set(
        this.game.game.moves({ square: from, verbose: true }).map((m) => m.to),
      ),
    };
    return true;
  }
  carry(point) {
    this.checkHeld();
    if (!this.held) return;
    this.held.piece.position.copy(point).add(this.held.offset);
    this.held.piece.position.y = Math.max(0, this.held.piece.position.y);
    if (this.held.promotion) {
      this.board.highlightPromotionReturn?.(
        this.board.onPromotionTray(this.held.piece),
      );
      return;
    }
    const over = squareUnder(this.held.piece.position);
    const valid = !!over && this.held.legal.has(over);
    this.board.setInteraction({ over, valid });
  }
  release() {
    this.checkHeld();
    if (!this.held) return;
    if (this.held.promotion) {
      const { piece, promotion } = this.held;
      this.held = null;
      this.board.highlightPromotionReturn?.(false);
      this.board.highlightPromotion?.();
      if (this.board.onPromotionTray(piece)) {
        void this.board.returnPromotionChoice(piece);
      } else this.game.promote(promotion, piece);
      return;
    }
    const over = squareUnder(this.held.piece.position);
    this.held = null;
    this.board.setInteraction();
    this.game.dropGrab(over);
  }
  localPoint(world) {
    this.board.root.updateWorldMatrix(true, false);
    return this.board.root.worldToLocal(world.clone());
  }
  update(frame, referenceSpace, viewerTracked = true) {
    this.checkHeld();
    const visible =
      viewerTracked &&
      this.renderer.xr.getSession()?.visibilityState === "visible";
    for (const hand of this.hands) {
      const source = hand.source;
      const pose =
        visible &&
        source?.gripSpace &&
        frame?.getPose(source.gripSpace, referenceSpace);
      if (!pose || !source.gamepad?.buttons[0] || !source.gamepad?.buttons[1]) {
        this.loseHand(hand);
        continue;
      }
      hand.tracked = true;
      hand.hint = source.gamepad.mapping === "xr-standard" && buttonDown(source.gamepad.buttons[4], hand.hint);
      hand.sphere.visible = true;
      const p = pose.transform.position;
      hand.sphere.position.set(p.x, p.y, p.z);
      const point = this.localPoint(hand.sphere.position);
      const trigger = buttonDown(source.gamepad?.buttons[0], hand.trigger);
      const grip = buttonDown(source.gamepad?.buttons[1], hand.grip);
      const previouslyDown = hand.trigger || hand.grip;
      const down = trigger || grip;
      hand.hover =
        this.held || this.tableHandle?.active
          ? null
          : nearestPiece(point, this.game);
      hand.promotionHover =
        !this.held &&
        !this.tableHandle?.active &&
        this.game.phase === "promotion"
          ? this.board.promotionHit?.(hand.sphere.position)
          : null;
      hand.controlHover =
        !this.held && !this.tableHandle?.active
          ? this.ui.touchTarget?.(hand.sphere.position)
          : null;
      if (hand.armed) {
        if (this.tableHandle?.active?.owner === hand) {
          this.tableHandle.move(hand.sphere.position);
          if (!grip) this.tableHandle.end();
        } else if (this.held?.owner === hand) {
          this.carry(point);
          if (!down && previouslyDown) this.release();
        } else if (
          !this.held &&
          !this.tableHandle?.active &&
          ((down && !previouslyDown) || (grip && !hand.grip))
        ) {
          if (hand.promotionHover && down && !previouslyDown)
            this.beginPromotion(hand, hand.promotionHover, point);
          else if (hand.hover && down && !previouslyDown)
            this.begin(hand, hand.hover, point);
          else if (hand.controlHover && down && !previouslyDown)
            this.onAction(hand.controlHover.userData.action);
          else if (
            this.game.phase !== "promotion" &&
            grip &&
            !hand.grip &&
            !hand.controlHover &&
            !inPieceVolume(point, this.game) &&
            this.tableHandle?.canGrab()
          ) {
            this.tableHandle.begin(hand, hand.sphere.position, this.game.epoch);
            this.board.setInteraction();
          }
        }
      }
      // Reconnect/tracking recovery consumes current buttons; a fresh press is required.
      hand.armed = true;
      hand.trigger = trigger;
      hand.grip = grip;
    }
    this.board.highlightPromotionReturn?.(
      !!this.held?.promotion && this.board.onPromotionTray(this.held.piece),
    );
    this.board.highlightPromotion?.(
      this.held?.promotion
        ? [this.held.piece]
        : this.held
          ? []
          : this.hands
              .filter((h) => h.tracked && h.promotionHover)
              .map((h) => h.promotionHover),
    );
    this.ui.highlight?.(
      this.hands.filter((h) => h.tracked).map((h) => h.controlHover),
    );
    if (!this.held)
      this.board.setInteraction({
        hovered: this.hands
          .filter((h) => h.tracked && h.hover)
          .map((h) => h.hover),
      });
    for (const hand of this.hands) {
      const repositioning =
        hand.tracked && this.tableHandle?.active?.owner === hand;
      hand.sphere.visible = hand.tracked && !repositioning;
      hand.axes.visible = !!repositioning;
      if (repositioning) {
        hand.axes.position.copy(hand.sphere.position);
        this.tableHandle.parent.parent.getWorldQuaternion(hand.axes.quaternion);
      }
      hand.sphere.material.color.setHex(
        this.held?.owner === hand || this.tableHandle?.active?.owner === hand
          ? 0xe9ba59
          : hand.hover || hand.promotionHover || hand.controlHover
            ? 0xffd57c
            : 0x83e3c4,
      );
    }
  }
  pointerRay(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
  }
  pointerPoint(e) {
    this.pointerRay(e);
    this.board.root.updateWorldMatrix(true, false);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0).transformDirection(
        this.board.root.matrixWorld,
      ),
      this.board.squareToWorld("e4"),
    );
    const p = this.ray.ray.intersectPlane(plane, new THREE.Vector3());
    return p ? this.localPoint(p) : null;
  }
  pointerDown(e) {
    if (this.renderer.xr.isPresenting || e.button !== 0) return;
    this.checkHeld();
    this.pointerRay(e);
    const control = this.ray.intersectObjects(
      this.ui.pointerTargets?.() ?? [],
      false,
    )[0];
    if (control) {
      this.onAction(control.object.userData.action);
      return;
    }
    const hit = this.ray.intersectObjects(
      [...this.board.pieces.values(), this.board.squares],
      false,
    )[0];
    const square =
      hit?.object.userData.square ??
      (hit?.instanceId !== undefined ? squareName(hit.instanceId) : null);
    const point = this.pointerPoint(e);
    if (square && point && this.begin("mouse", square, point)) {
      this.pointerId = e.pointerId;
      this.renderer.domElement.setPointerCapture?.(e.pointerId);
    }
  }
  pointerMove(e) {
    if (this.renderer.xr.isPresenting) return;
    this.checkHeld();
    if (this.held?.owner !== "mouse" || e.pointerId !== this.pointerId) return;
    const point = this.pointerPoint(e);
    if (point) {
      this.carry(point);
      if (this.held) this.held.piece.position.y = 0.08;
    }
  }
  pointerUp(e) {
    if (
      this.renderer.xr.isPresenting ||
      this.held?.owner !== "mouse" ||
      e.pointerId !== this.pointerId
    )
      return;
    const point = this.pointerPoint(e);
    if (point) {
      this.carry(point);
      this.release();
    } else this.cancelHeld();
    this.renderer.domElement.releasePointerCapture?.(e.pointerId);
  }
}

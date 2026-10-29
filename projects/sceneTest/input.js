import * as T from "three";
const origin = new T.Vector3(),
  direction = new T.Vector3(),
  rotation = new T.Matrix4(),
  head = new T.Vector3(),
  forward = new T.Vector3(),
  right = new T.Vector3(),
  axis = new T.Vector3(0, 1, 0),
  delta = new T.Vector3();
export class Input {
  constructor(app) {
    this.app = app;
    this.raycaster = new T.Raycaster();
    this.hands = [];
    this.grabs = new Map();
    this.targets = [];
    this.hits = [];
    this.keys = new Set();
    for (let i = 0; i < 2; i++) {
      const controller = app.renderer.xr.getController(i),
        grip = app.renderer.xr.getControllerGrip(i);
      app.rig.add(controller, grip);
      // The sphere marks the exact origin used for near pickup and attachment.
      const gripMarker = new T.Mesh(
        new T.SphereGeometry(0.035, 16, 12),
        new T.MeshBasicMaterial({ color: 0x59cfff, toneMapped: false }),
      );
      grip.add(gripMarker);
      const ray = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(),
          new T.Vector3(0, 0, -1),
        ]),
        new T.LineBasicMaterial({
          color: 0xb5bfcc,
          toneMapped: false,
          depthTest: false,
        }),
      );
      ray.scale.z = 6;
      ray.renderOrder = 1000;
      controller.add(ray);
      controller.visible = grip.visible = false;
      const hand = {
        index: i,
        controller,
        grip,
        ray,
        source: null,
        trigger: false,
        buttons: [],
        hit: null,
        dragUI: null,
      };
      this.hands.push(hand);
      controller.addEventListener("connected", (e) => {
        hand.source = e.data;
        gripMarker.material.color.set(
          e.data.handedness === "left" ? 0x59cfff : 0xffb56b,
        );
      });
      controller.addEventListener("disconnected", () => {
        this.endGrab(hand);
        hand.source = null;
        controller.visible = grip.visible = false;
        hand.trigger = false;
        hand.dragUI = null;
      });
      controller.addEventListener("selectstart", () => {
        if (hand.source?.handedness !== "right" || !controller.visible) return;
        hand.trigger = true;
        this.aim(hand);
        if (hand.hit?.ui) {
          app.ui.activate(hand.hit.ui);
          if (hand.hit.ui.control.kind === "slider")
            hand.dragUI = { index: hand.hit.ui.index, row: hand.hit.ui.row };
        } else if (hand.hit?.record) {
          app.interaction.select(hand.hit.record.data.id);
          app.ui.refresh();
        }
      });
      controller.addEventListener("selectend", () => {
        hand.trigger = false;
        hand.dragUI = null;
        app.ui.refresh();
      });
      controller.addEventListener("squeezestart", () => {
        if (!controller.visible) return;
        this.aim(hand);
        this.beginGrab(hand);
      });
      controller.addEventListener("squeezeend", () => this.endGrab(hand));
    }
    addEventListener("keydown", (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (!e.repeat) {
        if (e.code === "KeyY") app.ui.toggle();
        if (e.code === "KeyB" || e.code === "Escape") {
          app.interaction.select(null);
          app.ui.refresh();
        }
      }
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => {
      this.keys.clear();
      this.releaseAll();
    });
    this.setupDesktop();
  }
  aim(hand) {
    const a = this.app,
      c = hand.controller;
    c.updateWorldMatrix(true, false);
    origin.setFromMatrixPosition(c.matrixWorld);
    rotation.extractRotation(c.matrixWorld);
    direction.set(0, 0, -1).applyMatrix4(rotation).normalize();
    this.raycaster.set(origin, direction);
    this.raycaster.far = 8;
    const targets = this.targets;
    targets.length = 0;
    for (const r of a.lights.records.values())
      targets.push(r.root.userData.handle);
    if (a.ui.group.visible) {
      for (const p of a.ui.panels) targets.push(p.mesh);
      for (const p of a.ui.prototypes) targets.push(p.userData.handle);
    }
    a.scene.updateMatrixWorld(true);
    this.hits.length = 0;
    const hit = this.raycaster.intersectObjects(targets, false, this.hits)[0];
    hand.hit = hit
      ? {
          distance: hit.distance,
          record: hit.object.userData.record,
          prototype: hit.object.userData.prototype,
          ui: a.ui.hit(hit),
        }
      : null;
    const interactive =
      hand.hit &&
      (hand.hit.record ||
        hand.hit.prototype ||
        ["slider", "toggle", "button", "select"].includes(
          hand.hit.ui?.control.kind,
        ));
    hand.ray.material.color.set(interactive ? 0x59cfff : 0xb5bfcc);
    hand.ray.scale.z = hit ? Math.max(0.04, hit.distance) : 6;
    if (hand.hit?.record) hand.hit.record.hovered = true;
    if (
      hand.trigger &&
      hand.dragUI &&
      hand.hit?.ui?.index === hand.dragUI.index &&
      hand.hit.ui.row === hand.dragUI.row
    )
      a.ui.activate(hand.hit.ui, true);
  }
  beginGrab(hand) {
    const a = this.app;
    if (this.grabs.has(hand)) return;
    // Prefer a near handle, then use the same visible ray as selection.
    hand.grip.getWorldPosition(origin);
    let nearest = null,
      best = 0.18;
    const handles = a.lights.handles();
    if (a.ui.group.visible)
      handles.push(...a.ui.prototypes.map((p) => p.userData.handle));
    for (const handle of handles) {
      handle.getWorldPosition(direction);
      const dist = direction.distanceTo(origin);
      if (dist < best) {
        best = dist;
        nearest = handle.userData;
      }
    }
    const target = nearest || hand.hit;
    if (!target) return;
    let record = target.record;
    if (target.prototype) {
      record = a.lights.create(target.prototype);
      const proto = a.ui.prototypes.find(
        (p) => p.userData.prototype === target.prototype,
      );
      proto.getWorldPosition(record.root.position);
      proto.getWorldQuaternion(record.root.quaternion);
    }
    if (!record || !a.interaction.beginGrab(hand, record.data.id)) {
      if (target.prototype && record) a.lights.remove(record.data.id);
      return;
    }
    // Attach computes inverse(controller world) * object world, preserving both offsets.
    hand.grip.updateWorldMatrix(true, false);
    record.root.updateWorldMatrix(true, false);
    hand.grip.attach(record.root);
    this.grabs.set(hand, record);
    a.ui.refresh();
  }
  endGrab(hand) {
    const r = this.grabs.get(hand);
    if (r) {
      this.app.scene.attach(r.root);
      r.data.position = r.root.position.toArray();
      r.data.rotation = r.root.quaternion.toArray();
      this.grabs.delete(hand);
    }
    this.app.interaction.endGrab(hand);
  }
  releaseAll() {
    for (const hand of this.hands) {
      this.endGrab(hand);
      hand.trigger = false;
      hand.dragUI = null;
      hand.buttons = [];
    }
    this.keys.clear();
    this.desktopDrag = null;
    this.app.interaction.endGrab("mouse");
  }
  update(dt, frame) {
    const a = this.app,
      session = a.renderer.xr.getSession();
    const active =
      !!frame && session?.visibilityState === "visible" && !!a.viewerPose;
    for (const r of a.lights.records.values()) r.hovered = false;
    if (a.renderer.xr.isPresenting) {
      for (const h of this.hands) {
        const source = h.source;
        const tracked =
          active &&
          source &&
          !!frame.getPose(
            source.targetRaySpace,
            a.renderer.xr.getReferenceSpace(),
          );
        const gripTracked =
          tracked &&
          source.gripSpace &&
          !!frame.getPose(source.gripSpace, a.renderer.xr.getReferenceSpace());
        h.controller.visible = !!tracked;
        h.grip.visible = !!gripTracked;
        if (!tracked || !gripTracked) {
          this.endGrab(h);
          h.dragUI = null;
          h.trigger = false;
        }
        if (!tracked) continue;
        this.aim(h);
        const buttons = source.gamepad?.buttons || [];
        const secondary = !!buttons[5]?.pressed;
        if (secondary && !h.buttons[5]) {
          if (source.handedness === "right") {
            a.interaction.select(null);
            a.ui.refresh();
          }
          if (source.handedness === "left") a.ui.toggle();
        }
        h.buttons[5] = secondary;
      }
      if (active) {
        const left = this.hands.find((h) => h.source?.handedness === "left"),
          r = this.hands.find((h) => h.source?.handedness === "right");
        const la = left?.source.gamepad?.axes,
          ra = r?.source.gamepad?.axes;
        this.move(la?.[2] || 0, la?.[3] || 0, ra?.[2] || 0, dt);
      }
    } else {
      if (this.desktopHover && a.lights.records.has(this.desktopHover.data.id))
        this.desktopHover.hovered = true;
      this.move(
        (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
        (this.keys.has("KeyS") ? 1 : 0) - (this.keys.has("KeyW") ? 1 : 0),
        (this.keys.has("ArrowRight") ? 1 : 0) -
          (this.keys.has("ArrowLeft") ? 1 : 0),
        dt,
      );
    }
  }
  move(x, z, turn, dt) {
    const a = this.app,
      dead = (v) => (Math.abs(v) > 0.15 ? v : 0);
    x = dead(x);
    z = dead(z);
    turn = dead(turn);
    const view = a.viewCamera();
    view.getWorldPosition(head);
    if (turn) {
      const angle = -turn * 1.1 * dt;
      delta
        .copy(a.rig.position)
        .sub(head)
        .applyAxisAngle(axis, angle)
        .add(head);
      a.rig.position.x = delta.x;
      a.rig.position.z = delta.z;
      a.rig.rotation.y += angle;
      a.rig.updateMatrixWorld(true);
    }
    view.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, axis).normalize();
    const length = Math.max(1, Math.hypot(x, z));
    a.rig.position
      .addScaledVector(right, (x / length) * 1.3 * dt)
      .addScaledVector(forward, (-z / length) * 1.3 * dt);
  }
  setupDesktop() {
    const a = this.app,
      canvas = a.renderer.domElement;
    const pointer = new T.Vector2(),
      plane = new T.Plane(),
      point = new T.Vector3(),
      offset = new T.Vector3();
    const cast = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(pointer, a.camera);
      this.raycaster.far = 50;
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (a.renderer.xr.isPresenting || e.button !== 0) return;
      cast(e);
      const hit = this.raycaster.intersectObjects(a.lights.handles(), false)[0];
      if (!hit) return;
      const r = hit.object.userData.record;
      a.interaction.select(r.data.id);
      a.interaction.beginGrab("mouse", r.data.id);
      a.camera.getWorldDirection(direction);
      r.root.getWorldPosition(point);
      plane.setFromNormalAndCoplanarPoint(direction, point);
      this.raycaster.ray.intersectPlane(plane, offset);
      offset.sub(point);
      this.desktopDrag = { record: r, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      a.ui.refresh();
    });
    canvas.addEventListener("pointermove", (e) => {
      cast(e);
      if (this.desktopDrag) {
        const drag = this.desktopDrag;
        if (e.shiftKey) {
          drag.record.root.rotateY((e.clientX - drag.x) * 0.01);
          drag.record.root.rotateX((e.clientY - drag.y) * 0.01);
        } else if (this.raycaster.ray.intersectPlane(plane, point))
          drag.record.root.position.copy(point).sub(offset);
        drag.x = e.clientX;
        drag.y = e.clientY;
      } else {
        for (const r of a.lights.records.values()) r.hovered = false;
        const hit = this.raycaster.intersectObjects(
          a.lights.handles(),
          false,
        )[0];
        this.desktopHover = hit?.object.userData.record || null;
        if (hit) hit.object.userData.record.hovered = true;
      }
    });
    const release = () => {
      this.desktopDrag = null;
      a.interaction.endGrab("mouse");
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);
  }
}

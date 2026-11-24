import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges, buttonValue} from '../../shared/xr/input.mjs';
import {ControllerPointer, createPointerLine} from '../../shared/xr/pointer.mjs';

const WIDTH = 640;
const HEIGHT = 616;
const ROW_TOP = 110;
const ROW_HEIGHT = 62;
const Y_BUTTON = 5;

function joint(frame, hand, name, space) {
  const item = hand.get(name);
  return item ? frame.getJointPose(item, space)?.transform : undefined;
}

export class LiftMenu {
  constructor(rig, groups) {
    this.groups = groups;
    this.areas = Object.keys(groups);
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.context = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.43 * HEIGHT / WIDTH),
      new THREE.MeshBasicMaterial({map: this.texture, toneMapped: false, depthTest: false, depthWrite: false}));
    this.panel.renderOrder = 1000;
    this.ray = new THREE.Object3D();
    this.line = createPointerLine({color: 0xb7e8ff, renderOrder: 1001});
    this.line.material.depthWrite = false;
    this.ray.add(this.line);
    rig.add(this.panel, this.ray);
    this.pointer = new ControllerPointer({far: 2});
    const markerGeometry = new THREE.CapsuleGeometry(0.032, 0.055, 4, 10);
    markerGeometry.rotateX(Math.PI / 2);
    const markerMaterial = new THREE.MeshBasicMaterial({color: 0x92979e});
    this.hands = {
      left: new THREE.Mesh(markerGeometry, markerMaterial),
      right: new THREE.Mesh(markerGeometry, markerMaterial),
    };
    rig.add(this.hands.left, this.hands.right);
    this.buttons = new ButtonEdges();
    this.left = null;
    this.headUp = new THREE.Vector3();
    this.towardHead = new THREE.Vector3();
    this.panelRotation = new THREE.Matrix4();
    this.area = null;
    this.hover = -1;
    this.hide();
  }

  close() {
    this.opened = false;
    this.panel.visible = false;
    this.line.visible = false;
    this.right = null;
    this.armed = false;
    this.pinching = false;
  }

  hide() {
    this.close();
    this.hands.left.visible = false;
    this.hands.right.visible = false;
    this.left = null;
    this.buttons.reset();
  }

  open() {
    this.area = null;
    this.draw(-1);
    this.opened = true;
  }

  updateHand(frame, space, source, marker) {
    const grip = source?.hand ? joint(frame, source.hand, 'middle-finger-metacarpal', space)
      : source?.gripSpace && frame.getPose(source.gripSpace, space)?.transform;
    marker.visible = !!grip;
    if (grip) {
      marker.position.copy(grip.position);
      marker.quaternion.copy(grip.orientation);
    }
    return !!grip;
  }

  get visible() { return this.panel.visible; }

  draw(hover) {
    const canvas = this.context;
    const rows = this.area ? ['‹ All areas', ...this.groups[this.area].map(lift => lift.name)] : this.areas;
    canvas.fillStyle = '#132936';
    canvas.fillRect(0, 0, WIDTH, HEIGHT);
    canvas.fillStyle = '#fff';
    canvas.font = '600 39px system-ui';
    canvas.fillText(this.area ?? 'Lift destinations', 28, 51);
    canvas.fillStyle = '#b9d7e9';
    canvas.font = '24px system-ui';
    canvas.fillText(this.area ? 'Choose a lift' : 'Choose a resort area', 28, 87);
    for (const [i, label] of rows.entries()) {
      const y = ROW_TOP + i * ROW_HEIGHT;
      canvas.fillStyle = i === hover ? '#b7e8ff' : '#234658';
      canvas.fillRect(22, y, WIDTH - 44, ROW_HEIGHT - 5);
      canvas.fillStyle = i === hover ? '#102632' : '#f4fbff';
      canvas.font = '600 28px system-ui';
      canvas.textBaseline = 'middle';
      canvas.fillText(label, 39, y + (ROW_HEIGHT - 5) / 2);
      canvas.textBaseline = 'alphabetic';
    }
    this.hover = hover;
    this.texture.needsUpdate = true;
  }

  update(frame, space, sources, viewer) {
    let left, right;
    for (const source of sources) {
      if (source.handedness === 'left') left = source;
      if (source.handedness === 'right' && source.targetRayMode === 'tracked-pointer') right = source;
    }
    const leftTracked = this.updateHand(frame, space, left, this.hands.left);
    this.updateHand(frame, space, right, this.hands.right);

    const buttonSource = leftTracked && left.gamepad ? left : null;
    if (buttonSource !== this.left) this.buttons.reset();
    if (buttonSource && this.buttons.sample(buttonSource, Y_BUTTON, buttonSource !== this.left).pressed) {
      if (this.opened) this.close();
      else this.open();
    }
    this.left = buttonSource;
    this.panel.visible = this.opened && leftTracked;
    if (!this.visible) {
      this.line.visible = false;
      this.right = null;
      return;
    }

    const handPosition = this.hands.left.position;
    this.headUp.set(0, 1, 0).applyQuaternion(viewer.orientation);
    this.towardHead.copy(viewer.position).sub(handPosition).normalize();
    this.panel.position.copy(handPosition)
      .addScaledVector(this.headUp, 0.055)
      .addScaledVector(this.towardHead, 0.015);
    this.panelRotation.lookAt(viewer.position, this.panel.position, this.headUp);
    this.panel.quaternion.setFromRotationMatrix(this.panelRotation);
    this.panel.updateWorldMatrix(true, false);

    const aim = right && frame.getPose(right.targetRaySpace, space)?.transform;
    if (!aim) {
      this.line.visible = false;
      this.right = null;
      if (this.hover !== -1) this.draw(-1);
      return;
    }
    if (right !== this.right) {
      this.right = right;
      this.armed = false;
      this.pinching = false;
    }
    this.ray.position.copy(aim.position);
    this.ray.quaternion.copy(aim.orientation);
    const hit = this.pointer.cast(this.ray, this.panel);
    const y = hit?.uv ? (1 - hit.uv.y) * HEIGHT : -1;
    const row = Math.floor((y - ROW_TOP) / ROW_HEIGHT);
    const count = this.area ? this.groups[this.area].length + 1 : this.areas.length;
    const overRow = row >= 0 && row < count && (y - ROW_TOP) % ROW_HEIGHT < ROW_HEIGHT - 5
      && hit.uv.x > 22 / WIDTH && hit.uv.x < 1 - 22 / WIDTH;
    const hover = overRow ? row : -1;
    this.line.visible = true;
    this.line.scale.z = hit?.distance ?? 0.8;
    if (hover !== this.hover) this.draw(hover);

    let down = buttonValue(right) > 0.55;
    if (right.hand) {
      const index = joint(frame, right.hand, 'index-finger-tip', space);
      const thumb = joint(frame, right.hand, 'thumb-tip', space);
      if (!index || !thumb) {
        this.armed = false;
        return;
      }
      const a = index.position;
      const b = thumb.position;
      this.pinching = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < (this.pinching ? 0.035 : 0.023);
      down = this.pinching;
    }
    if (!down) {
      this.armed = true;
      return;
    }
    if (!this.armed) return;
    this.armed = false;
    if (hover < 0) return;
    if (!this.area || hover === 0) {
      this.area = this.area ? null : this.areas[hover];
      this.draw(-1);
      return;
    }
    const lift = this.groups[this.area][hover - 1];
    this.close();
    return lift;
  }
}

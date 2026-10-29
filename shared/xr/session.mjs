// Frame-scoped state only; projects retain ownership of requesting/ending sessions.
export class XRFrameState {
  constructor() { this.reset(); }
  reset() {
    this.session = null; this.pose = null; this.frame = null; this.referenceSpace = null;
    this.active = false; this.firstTracked = false; this.resumed = false;
    this.changed = false; this.hasTracked = false;
  }
  update(session, frame, referenceSpace, hidden = false) {
    this.changed = session !== this.session;
    const wasActive = !this.changed && this.active;
    if (this.changed) this.hasTracked = false;
    this.session = session; this.frame = frame; this.referenceSpace = referenceSpace;
    this.pose = !hidden && session?.visibilityState === 'visible' && frame && referenceSpace
      ? frame.getViewerPose(referenceSpace) : null;
    this.active = !hidden && (!session || !!this.pose);
    this.firstTracked = !!this.pose && !this.hasTracked;
    this.resumed = this.active && !wasActive;
    if (this.pose) this.hasTracked = true;
    return this;
  }
  isTracked(space) {
    return !!(this.session && this.active && space && this.frame?.getPose(space, this.referenceSpace));
  }
}

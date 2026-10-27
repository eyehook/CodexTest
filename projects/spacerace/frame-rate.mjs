// Average animation-loop cadence over half-second windows, including slow frames.
// In XR this counts app frames, not individual eyes or compositor-reprojected frames.
export class FrameRate {
  constructor() { this.reset(); }
  reset() { this.elapsed=0; this.frames=0; this.value=null; }
  sample(seconds) {
    if (!(seconds>0) || !Number.isFinite(seconds)) return;
    this.elapsed+=seconds; this.frames++;
    if(this.elapsed>=0.5) {
      this.value=this.frames/this.elapsed;
      this.elapsed=0; this.frames=0;
    }
  }
}

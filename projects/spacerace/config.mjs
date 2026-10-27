export const FT = 0.3048;
// Design values are feet and seconds; rendering and simulation use metres.
export const CONFIG = Object.freeze({
  targetFrameRate: 120, // Set null to use the browser default.
  initialSpeed: 0, maxSpeed: 300 * 5280 / 3600 * FT, acceleration: 60 * FT, deceleration: 100 * FT,
  maxParticles: 3000, fieldInnerRadius: 10 * FT, fieldRadius: 200 * FT, drawDistance: 500 * FT,
  rearBoundary: 20 * FT, minSize: 0.3 * FT, maxStreak: 10 * FT,
  densityCurve: [[0,200],[0.25,400],[0.5,800],[0.75,1500],[1,3000]],
  stretchExponent: 1.7, ringRadius: 20 * FT, ringSpacing: 200 * FT,
  whooshReach: 65 * FT, whooshFrequency: 350, whooshLowpass: 1200, whooshVolume: 0.325,
  ringCount: 5, // Extend the ring sequence independently of the particle draw distance.
  ringColor: 0x112233, ringThickness: 0.25 * FT,
});

// Visual trail reference only; independent of the XR refresh-rate request.
export const RING_WAKE_SEGMENTS = 8;
export const RING_WAKE_FRAME_COUNT = 12;
export const RING_WAKE_REFERENCE_HZ = 120;
export const RING_WAKE_ENABLED = true;

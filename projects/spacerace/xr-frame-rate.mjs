// A declined refresh request must never prevent entering VR.
export async function requestFrameRate(session, target) {
  if (typeof session.updateTargetFrameRate !== 'function' ||
      !session.supportedFrameRates ||
      !Array.from(session.supportedFrameRates).includes(target)) return false;
  try {
    await session.updateTargetFrameRate(target);
    return true;
  } catch {
    return false;
  }
}

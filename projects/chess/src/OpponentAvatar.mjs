// Replacement avatars implement this world-space contract, independent of chess rules.
export class OpponentAvatar {
  setHandTarget(_worldPosition) {
    throw new Error("Avatar must implement setHandTarget");
  }
  getHandPosition() {
    throw new Error("Avatar must implement getHandPosition");
  }
  reset() {
    throw new Error("Avatar must implement reset");
  }
  // Implementations expose attachment (Object3D) and restTarget (world-space Vector3).
}

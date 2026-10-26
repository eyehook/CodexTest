import { EngineController } from "./EngineController.mjs?v=two-ply-1";
export class CurrentEvaluation {
  constructor({ game, settings, getSharedScore = () => null, onChange = () => {}, createEngine = () => new EngineController() }) {
    Object.assign(this, { game, settings, getSharedScore, onChange, createEngine });
    this.generation = 0;
    this.key = null;
  }
  eligible() {
    return ["player", "grabbing"].includes(this.game.phase) &&
      this.game.game.turn() === this.game.playerColor && !this.game.game.isGameOver();
  }
  cancel(dispose = false) {
    ++this.generation; this.key = null;
    if (this.engine && (dispose || this.engine.busy || !this.engine.ready)) {
      this.engine.dispose(); this.engine = null;
    }
    if (dispose) this.cache = null;
  }
  current(key, generation) {
    return this.key === key && this.generation === generation && this.settings.showEvaluation && this.eligible() &&
      this.game.epoch === this.epoch && this.game.game.fen() === this.fen;
  }
  update() {
    const viewEpoch = `${this.game.epoch}:${this.game.playerColor}`;
    if (this.viewEpoch !== viewEpoch) {
      this.cancel(true); this.viewEpoch = viewEpoch; this.viewState = null;
    }
    if (!this.settings.showEvaluation || ["loading", "error"].includes(this.game.phase)) {
      if (this.key !== null) this.cancel();
      const hidden = `${this.settings.showEvaluation}:${this.game.phase}`;
      if (this.viewState !== hidden) { this.viewState = hidden; this.onChange(null); }
      return;
    }
    if (this.viewState !== "visible") {
      this.viewState = "visible"; this.onChange(this.cache?.score ?? null);
    }
    // Keep the last turn's needle throughout both move animations, opponent
    // thinking and game over. Only a playable new player turn requests a score.
    if (!this.eligible()) { if (this.key !== null) this.cancel(); return; }
    const fen = this.game.game.fen(), epoch = this.game.epoch;
    const key = `${epoch}:${fen}:${this.game.playerColor}`;
    if (this.key === key) return;
    this.cancel(); Object.assign(this, { key, fen, epoch });
    const generation = this.generation;
    if (this.cache?.key === key) return;
    this.pending = (async () => {
      try {
        let score = await this.getSharedScore(fen, epoch);
        if (!this.current(key, generation)) return;
        if (!score) {
          const engine = this.engine ??= this.createEngine();
          if (!engine.ready) await engine.initialize(1500);
          if (!this.current(key, generation)) return;
          score = await engine.scorePosition(fen);
        }
        if (!this.current(key, generation) || !score) return;
        this.cache = { key, score }; this.onChange(score);
      } catch {
        // Retain the previous turn's score if this update is unavailable.
      }
    })();
  }
}

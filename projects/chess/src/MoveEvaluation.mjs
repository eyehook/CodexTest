import { Chess } from "../vendor/chess/chess.mjs";
import { EngineController } from "./EngineController.mjs?v=two-ply-1";
import { moveEvaluationDelta, moveDeltaLabel, playerScoreRank } from "./Evaluation.mjs?v=neutral-zero-1";
export const moveToken = (move) => move.from + move.to + (move.promotion ?? "");

// One independent analysis per player-turn position; pickup only selects cached hints.
export class MoveEvaluation {
  constructor({ game, settings, getHeld, overlay, getHintHeld = () => false, onHint = () => {}, createEngine = () => new EngineController() }) {
    Object.assign(this, { game, settings, getHeld, overlay, getHintHeld, onHint, createEngine });
    this.generation = 0;
    this.key = null;
    this.cache = null;
    this.revision = 0;
    this.displayActive = true;
  }
  eligible() {
    return this.settings.evaluateMove && ["player", "grabbing"].includes(this.game.phase) &&
      this.game.game.turn() === this.game.playerColor && !this.game.game.isGameOver();
  }
  selection() {
    const held = this.getHeld();
    return this.settings.evaluateMove && this.game.phase === "grabbing" && held && !held.promotion
      ? held.from : null;
  }
  current(key, generation) {
    return this.key === key && this.generation === generation && this.eligible() &&
      this.game.epoch === this.epoch && this.game.game.fen() === this.fen;
  }
  setHint(square) {
    if (this.hintFrom === square) return;
    this.hintFrom = square;
    this.onHint(square);
  }
  baselineFor(fen, epoch) {
    const key = `${epoch}:${fen}`;
    if (this.boardBaseline?.key === key) return this.boardBaseline.score;
    if (this.cache?.key === key) return this.cache.baseline;
    return this.key === key ? this.baselinePending ?? null : null;
  }
  cancel(dispose = false) {
    ++this.generation;
    this.resolveBaseline?.(null);
    this.resolveBaseline = this.baselinePending = null;
    this.key = null;
    this.results = null;
    this.displayKey = null;
    this.overlay.clear();
    this.setHint(null);
    if (this.engine && (dispose || this.engine.busy || !this.engine.ready)) {
      this.engine.dispose();
      this.engine = null;
    }
    if (dispose) this.cache = this.boardBaseline = null;
  }
  render() {
    this.setHint(this.displayActive && this.eligible() && this.getHintHeld() && this.cache?.key === this.key
      ? this.cache.bestFrom ?? null : null);
    const from = this.displayActive ? this.selection() : null;
    const key = from ? `${from}:${this.revision}` : "hidden";
    if (key === this.displayKey) return;
    this.displayKey = key;
    if (!from) this.overlay.clear();
    else this.overlay.set(this.results?.get(from) ?? []);
  }
  update(active = true) {
    this.displayActive = active;
    if (!this.eligible()) { if (this.key) this.cancel(); return; }
    const fen = this.game.game.fen(), epoch = this.game.epoch;
    const key = `${epoch}:${fen}`;
    if (this.key === key) { this.render(); return; }
    this.cancel();
    Object.assign(this, { key, fen, epoch });
    const generation = this.generation;
    if (this.cache?.key === key) {
      this.results = this.cache.byPiece;
      ++this.revision;
      this.render();
      return;
    }
    const allMoves = this.game.game.moves({ verbose: true });
    this.render(); // Pending squares remain ordinary until their endpoint is scored.
    let baseline = null, resolveBaseline;
    this.baselinePending = new Promise((resolve) => { resolveBaseline = resolve; });
    this.resolveBaseline = resolveBaseline;
    const publish = (scores) => {
      if (!this.current(key, generation)) return;
      const byPiece = new Map();
      for (const move of allMoves) {
        if (!byPiece.has(move.from)) byPiece.set(move.from, []);
        const score = scores.get(moveToken(move));
        byPiece.get(move.from).push({
          square: move.to, promotion: move.promotion,
          delta: moveEvaluationDelta(baseline, score, this.game.playerColor),
          text: moveDeltaLabel(baseline, score, this.game.playerColor),
        });
      }
      this.results = byPiece;
      ++this.revision;
      this.render();
    };
    const engine = this.engine ??= this.createEngine();
    this.pending = (async () => {
      try {
        if (!engine.ready) await engine.initialize(1500);
        if (!this.current(key, generation)) return;
        baseline = await engine.scorePosition(fen);
        if (!this.current(key, generation)) { resolveBaseline(null); return; }
        this.boardBaseline = { key, score: baseline };
        resolveBaseline(baseline);
        const scores = new Map();
        if (baseline) {
          // This search chooses each opponent reply; its scores are NOT the
          // displayed endpoints. Score the actual resulting boards below.
          const lines = await engine.analyzeMoves(fen, allMoves.map(moveToken), { milliseconds: 1000 });
          if (!this.current(key, generation)) return;
          const terminalScore = (position) => position.isCheckmate()
            ? { type: "mate", value: position.turn() === "w" ? -1 : 1, fen: position.fen() }
            : position.isDraw() ? { type: "cp", value: 0, fen: position.fen() } : null;
          const endpointCache = new Map();
          for (const move of allMoves) {
            if (!this.current(key, generation)) return;
            const position = new Chess(fen);
            position.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
            let score = terminalScore(position);
            if (!score) {
              const token = lines.get(moveToken(move))?.reply;
              let reply = token ? position.moves({ verbose: true }).find((candidate) => moveToken(candidate) === token) : null;
              // A shallow/incomplete PV may omit the reply. Search that child
              // explicitly instead of treating a missing response as a pass.
              if (!reply) reply = await engine.bestMove(position.fen(), { analysis: true, depth: 4 });
              if (!this.current(key, generation)) return;
              position.move({ from: reply.from, to: reply.to, ...(reply.promotion ? { promotion: reply.promotion } : {}) });
              score = terminalScore(position);
            }
            if (!score) {
              const endpoint = position.fen();
              score = endpointCache.get(endpoint);
              if (!score) {
                score = await engine.scorePosition(endpoint);
                endpointCache.set(endpoint, score);
              }
            }
            if (!this.current(key, generation)) return;
            if (score) scores.set(moveToken(move), score);
            publish(scores);
          }
        }
        if (!this.current(key, generation)) return;
        publish(scores);
        // Keep a completed position even if Options is toggled or tracking changes.
        const best = [...scores.entries()].sort((a, b) =>
          playerScoreRank(b[1], this.game.playerColor) - playerScoreRank(a[1], this.game.playerColor))[0];
        this.cache = { key, baseline, byPiece: this.results, bestFrom: best?.[0].slice(0, 2) ?? null };
        this.render();
      } catch {
        resolveBaseline(null);
        // Failure is attempted only once for this position; never block normal play.
        if (this.current(key, generation)) {
          this.results = null;
          ++this.revision;
          this.render();
        }
      } finally {
        resolveBaseline(null); // Also settle shared-score readers after stale initialization.
      }
    })();
  }
}

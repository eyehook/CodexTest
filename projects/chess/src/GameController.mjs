import { Chess } from "../vendor/chess/chess.mjs";
export class GameController {
  constructor({ board, engine, opponent, onChange = () => {} }) {
    Object.assign(this, { board, engine, opponent, onChange });
    this.game = new Chess();
    this.epoch = 0;
    this.phase = "loading";
    this.selected = null;
    this.last = null;
    this.promotion = null;
  }
  notify(message) {
    this.message = message;
    this.board.highlight(this);
    this.onChange(this);
  }
  status() {
    if (this.game.isCheckmate())
      return `Checkmate · ${this.game.turn() === "w" ? "Black" : "White"} wins`;
    if (this.game.isStalemate()) return "Draw · stalemate";
    if (this.game.isThreefoldRepetition()) return "Draw · threefold repetition";
    if (this.game.isInsufficientMaterial())
      return "Draw · insufficient material";
    if (this.game.isDraw()) return "Draw · fifty-move rule";
    return `${this.game.turn() === "w" ? "Your turn · White" : "Black to move"}${this.game.isCheck() ? " · CHECK" : ""}`;
  }
  async restart(elo) {
    const epoch = ++this.epoch;
    this.opponent.cancel();
    this.engine.dispose();
    this.game.reset();
    this.selected = this.last = this.promotion = null;
    this.phase = "loading";
    this.board.sync(this.game);
    this.notify("Loading engine…");
    try {
      await this.engine.initialize(elo);
      if (epoch !== this.epoch) return;
      this.phase = "player";
      this.notify(this.status());
    } catch (error) {
      if (epoch === this.epoch) {
        this.phase = "error";
        this.notify(`Engine error: ${error.message}. Restart to retry.`);
      }
    }
  }
  select(square) {
    if (this.phase !== "player" || this.game.turn() !== "w") return;
    const moves = this.selected
      ? this.game
          .moves({ square: this.selected, verbose: true })
          .filter((m) => m.to === square)
      : [];
    if (moves.length) {
      if (moves.some((m) => m.promotion)) {
        this.promotion = { from: this.selected, to: square };
        this.phase = "promotion";
        this.notify("Choose promotion: Queen, Rook, Bishop, Knight");
      } else void this.play({ from: this.selected, to: square });
      return;
    }
    if (this.game.get(square)?.color === "w") {
      this.selected = square;
      this.notify(this.status());
    } else {
      this.selected = null;
      this.notify("Select a White piece, then a highlighted destination.");
    }
  }
  promote(piece) {
    if (this.phase === "promotion" && ["q", "r", "b", "n"].includes(piece)) {
      const move = { ...this.promotion, promotion: piece };
      this.promotion = null;
      void this.play(move);
    }
  }
  async transaction(request, animate) {
    const epoch = this.epoch;
    // Validate on a clone. The authoritative game commits only after animation.
    const clone = new Chess(this.game.fen());
    const move = clone.move(request);
    this.phase = "moving";
    this.selected = null;
    this.notify(
      `${move.color === "b" ? "Opponent" : "White"} moves ${move.san}`,
    );
    await animate(move);
    if (epoch !== this.epoch) return false;
    this.game.move(request);
    this.last = move;
    this.board.sync(this.game);
    return true;
  }
  async play(request) {
    const epoch = this.epoch;
    try {
      if (
        !(await this.transaction(request, (move) =>
          this.board.animateMove(move),
        ))
      )
        return;
      if (this.finish()) return;
      this.phase = "thinking";
      this.notify("Stockfish is thinking…");
      const reply = await this.engine.bestMove(this.game.fen());
      if (epoch !== this.epoch) return;
      if (
        !(await this.transaction(reply, (move) =>
          this.opponent.movePiece(move),
        ))
      )
        return;
      if (this.finish()) return;
      this.phase = "player";
      this.notify(this.status());
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.opponent.cancel();
      this.board.sync(this.game);
      this.phase = "error";
      this.notify(`Game paused: ${error.message}. Restart to retry.`);
    }
  }
  finish() {
    if (!this.game.isGameOver()) return false;
    this.phase = "over";
    this.notify(this.status());
    return true;
  }
  interrupt() {
    ++this.epoch;
    this.opponent.cancel();
    this.engine.dispose();
    this.board.sync(this.game);
    this.phase = "error";
    this.selected = this.promotion = null;
    this.notify("VR session ended. Restart to begin a new game.");
  }
}

import { Chess } from "../vendor/chess/chess.mjs";
import { resolveSide } from "./Settings.mjs?v=ratings-2";
export class GameController {
  constructor({
    board,
    engine,
    opponent,
    onChange = () => {},
    random = Math.random,
  }) {
    Object.assign(this, {
      board,
      engine,
      opponent,
      onChange,
      random,
    });
    this.game = new Chess();
    this.playerColor = "w";
    this.epoch = 0;
    this.phase = "loading";
    this.selected = null;
    this.last = null;
    this.promotion = null;
    this.promotionPlaced = false;
  }
  notify(message) {
    this.message = message;
    this.board.highlight(this);
    this.board.updatePromotion?.(this);
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
    return `${this.game.turn() === this.playerColor ? "Your turn" : "Opponent turn"} · ${this.game.turn() === "w" ? "White" : "Black"}${this.game.isCheck() ? " · CHECK" : ""}`;
  }
  async restart(elo, side = "white") {
    const epoch = ++this.epoch;
    this.opponent.cancel();
    this.engine.dispose();
    this.game.reset();
    this.playerColor = resolveSide(side, this.random);
    this.board.setPlayerColor?.(this.playerColor);
    this.selected = this.last = this.promotion = null;
    this.promotionPlaced = false;
    this.phase = "loading";
    this.board.sync(this.game);
    this.notify("Loading engine…");
    try {
      await this.engine.initialize(elo);
      if (epoch !== this.epoch) return;
      if (this.playerColor === "b") await this.computerTurn(epoch);
      else {
        if (epoch !== this.epoch) return;
        this.phase = "player";
        this.notify(this.status());
      }
    } catch (error) {
      if (epoch === this.epoch) {
        this.phase = "error";
        this.notify(`Engine error: ${error.message}. Restart to retry.`);
      }
    }
  }
  beginGrab(square) {
    if (
      this.phase !== "player" ||
      this.game.turn() !== this.playerColor ||
      this.game.get(square)?.color !== this.playerColor
    )
      return false;
    this.selected = square;
    this.phase = "grabbing";
    this.notify("Hold trigger or grip to carry; release over a legal square.");
    return true;
  }
  cancelGrab(message = this.status()) {
    if (this.phase !== "grabbing") return;
    this.phase = "player";
    this.selected = null;
    this.board.sync(this.game);
    this.notify(message);
  }
  dropGrab(square) {
    if (this.phase !== "grabbing") return false;
    const from = this.selected;
    const moves = this.game
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === square);
    if (!moves.length) {
      this.cancelGrab(
        "Invalid drop · piece returned. Pick up one of your pieces to try again.",
      );
      return false;
    }
    this.board.placeHeld?.(moves[0]);
    if (moves.some((move) => move.promotion)) {
      this.promotion = { from, to: square };
      this.promotionPlaced = true;
      const show = () => {
        this.phase = "promotion";
        this.notify("Grab a promotion piece, then release to choose it.");
      };
      if (moves[0].captured && this.board.finishPlacement) {
        const epoch = this.epoch;
        this.phase = "moving";
        this.notify("Placing pawn…");
        void this.board.finishPlacement(moves[0]).then(() => {
          if (epoch === this.epoch && this.phase === "moving") show();
        });
      } else show();
    } else void this.play({ from, to: square }, { placed: true });
    return true;
  }
  promote(piece, promotionPiece = null) {
    if (this.phase === "promotion" && ["q", "r", "b", "n"].includes(piece)) {
      const move = { ...this.promotion, promotion: piece };
      this.promotion = null;
      void this.play(move, { placed: this.promotionPlaced, promotionPiece });
      this.promotionPlaced = false;
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
      `${move.color === this.playerColor ? "You play" : "Opponent plays"} ${move.san}`,
    );
    await animate(move);
    if (epoch !== this.epoch) return false;
    this.game.move(request);
    this.last = move;
    this.board.sync(this.game);
    return true;
  }
  async play(request, { placed = false, promotionPiece = null } = {}) {
    const epoch = this.epoch;
    try {
      if (
        !(await this.transaction(request, (move) =>
          promotionPiece
            ? this.board.animatePromotion(move, promotionPiece)
            : placed
              ? (this.board.finishPlacement?.(move) ?? Promise.resolve())
              : this.board.animateMove(move),
        ))
      )
        return;
      if (this.finish()) return;
      await this.computerTurn(epoch);
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.opponent.cancel();
      this.board.sync(this.game);
      this.phase = "error";
      this.notify(`Game paused: ${error.message}. Restart to retry.`);
    }
  }
  async computerTurn(epoch) {
    if (epoch !== this.epoch) return;
    this.phase = "thinking";
    this.notify("Stockfish is thinking…");
    const reply = await this.engine.bestMove(this.game.fen());
    if (epoch !== this.epoch) return;
    if (
      !(await this.transaction(reply, (move) => this.opponent.movePiece(move)))
    )
      return;
    if (this.finish()) return;
    if (epoch !== this.epoch) return;
    this.phase = "player";
    this.notify(this.status());
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
    this.promotionPlaced = false;
    this.notify("VR session ended. Restart to begin a new game.");
  }
}

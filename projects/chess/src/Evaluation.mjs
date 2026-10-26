// UCI search scores use side-to-move perspective; keep engine results White-relative.
export function parseEvaluation(line, fen) {
  if (!line.startsWith("info ") || /\b(?:lowerbound|upperbound)\b/.test(line))
    return null;
  const multipv = line.match(/\bmultipv (\d+)/);
  if (multipv && multipv[1] !== "1") return null;
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  if (!score || !Number.isFinite(Number(score[2]))) return null;
  return {
    type: score[1],
    value:
      Number(score[2]) === 0
        ? 0
        : Number(score[2]) * (fen.split(" ")[1] === "w" ? 1 : -1),
    fen,
  };
}
export function opponentEvaluation(score, playerColor) {
  if (!score) return null;
  return {
    ...score,
    value: score.value === 0 ? 0 : score.value * (playerColor === "w" ? -1 : 1),
  };
}
export function expressionAmount(score) {
  if (!score || !Number.isFinite(score.value)) return 0;
  if (score.type === "mate") return Math.sign(score.value);
  const pawns = score.value / 100;
  if (Math.abs(pawns) <= 0.2) return 0;
  // A small near-equal band stays flat; larger advantages curve gradually.
  return Math.sign(pawns) * Math.tanh(Math.max(0, Math.abs(pawns) - 0.2) / 3);
}

// MultiPV lines are root-move scores, already including the opponent's best reply.
export function parseMoveEvaluation(line, fen) {
  if (!/^info /.test(line) || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pv = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/);
  const depth = line.match(/\bdepth (\d+)/);
  if (!score || !pv || !depth) return null;
  const value = Number(score[2]) * (fen.split(" ")[1] === "w" ? 1 : -1);
  const reply = line.match(/\bpv [a-h][1-8][a-h][1-8][qrbn]?\s+([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/)?.[1];
  return { move: pv[1], ...(reply ? { reply } : {}), depth: Number(depth[1]), type: score[1], value: value || 0, fen };
}
export function playerScoreRank(score, color) {
  const value = score.value * (color === "w" ? 1 : -1);
  return score.type === "mate"
    ? Math.sign(value) * (1000000 - Math.abs(value))
    : value;
}
export function moveDeltaLabel(before, after, color) {
  if (!before || !after) return "?";
  const sign = color === "w" ? 1 : -1;
  if (after.type === "mate")
    return `${after.value * sign < 0 ? "-" : ""}M${Math.abs(after.value)}`;
  if (before.type === "mate")
    return before.value * sign > 0 ? "Mate lost" : "Escapes mate";
  const change = ((after.value - before.value) * sign) / 100;
  if (Math.abs(change) <= 0.1) return "0.0"; // Match the white tile band.
  const delta = Math.round(change * 10) / 10;
  return `${delta > 0 ? "+" : ""}${(delta || 0).toFixed(1)}`;
}

export function moveEvaluationDelta(before, after, color) {
  if (!before || !after) return null;
  const sign = color === "w" ? 1 : -1;
  if (before.type === "cp" && after.type === "cp")
    return ((after.value - before.value) * sign) / 100;
  // Treat retaining the same mate outcome as neutral, losing/escaping it as
  // a saturated bad/good result. Never pretend mate distance is a pawn value.
  const outcome = (score) => score.type === "mate" ? Math.sign(score.value * sign) : 0;
  const change = outcome(after) - outcome(before);
  return change === 0 ? 0 : Math.sign(change) * Infinity;
}

// Stockfish's eval trace is already White-relative and expressed in pawns.
export function parseStaticEvaluation(line, fen) {
  const match = line.match(/^Final evaluation\s+([+-]?\d+(?:\.\d+)?)\s+\(white side\)/);
  if (!match || line.includes("invalid position")) return null;
  return { type: "cp", value: Math.round(Number(match[1]) * 100) || 0, fen };
}

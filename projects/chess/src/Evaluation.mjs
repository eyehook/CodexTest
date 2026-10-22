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

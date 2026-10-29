import { CELL, squarePosition } from "./ChessBoard.mjs?v=shared-r180-1";
export const HAND_RADIUS = 0.0254;
export const COLUMN_HEIGHT = 0.1524;
export function columnIntersects(center, square, radius = HAND_RADIUS) {
  const p = squarePosition(square);
  const dx = Math.max(Math.abs(center.x - p.x) - CELL / 2, 0);
  const dy = Math.max(-center.y, center.y - COLUMN_HEIGHT, 0);
  const dz = Math.max(Math.abs(center.z - p.z) - CELL / 2, 0);
  return dx * dx + dy * dy + dz * dz <= radius * radius + 1e-12;
}
export function squareUnder(point) {
  const file = Math.floor(point.x / CELL + 4);
  const rank = Math.floor(4 - point.z / CELL);
  if (
    point.x < -4 * CELL ||
    point.x >= 4 * CELL ||
    point.z <= -4 * CELL ||
    point.z > 4 * CELL ||
    file < 0 ||
    file > 7 ||
    rank < 0 ||
    rank > 7
  )
    return null;
  return `${String.fromCharCode(97 + file)}${rank + 1}`;
}
export function nearestPiece(center, game, radius = HAND_RADIUS) {
  let best = null,
    distance = Infinity;
  if (game.phase !== "player" || game.game.turn() !== game.playerColor)
    return null;
  for (const row of game.game.board())
    for (const piece of row) {
      if (!piece || !columnIntersects(center, piece.square, radius)) continue;
      const p = squarePosition(piece.square);
      const d = (p.x - center.x) ** 2 + (p.z - center.z) ** 2;
      if (d < distance) {
        best = piece.square;
        distance = d;
      }
    }
  return best;
}
export function buttonDown(button, wasDown) {
  return (
    !!button && (button.pressed || (button.value ?? 0) > (wasDown ? 0.15 : 0.6))
  );
}

// Reserve occupied piece columns for pickup, regardless of color or game phase.
export function inPieceVolume(center, game) {
  return game.game
    .board()
    .some((row) =>
      row.some((piece) => piece && columnIntersects(center, piece.square)),
    );
}

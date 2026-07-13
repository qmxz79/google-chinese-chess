import { Piece, getPieceName } from "./chess-engine";

interface ChessPieceProps {
  piece: Piece;
  isSelected?: boolean;
  isValidTarget?: boolean;
  size: number;
  ghost?: boolean;
  slideStyle?: React.CSSProperties;
}

export default function ChessPiece({
  piece,
  isSelected = false,
  isValidTarget = false,
  size,
  ghost = false,
  slideStyle,
}: ChessPieceProps) {
  const isRed = piece.side === "red";

  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(16, size * 0.44),
    color: isRed ? "#b91c1c" : "#1f1308",
    background: isRed
      ? "radial-gradient(circle at 35% 30%, #f6d488, #d39b36 58%, #875118)"
      : "radial-gradient(circle at 35% 30%, #f3dda8, #bd9542 58%, #644011)",
    borderColor: isSelected ? "#facc15" : isRed ? "#7f1d1d" : "#3a2610",
    boxShadow: isSelected
      ? "0 0 0 3px rgba(250,204,21,.7), 0 8px 18px rgba(0,0,0,.42)"
      : isValidTarget
        ? "0 0 0 2px rgba(250,204,21,.55), 0 6px 14px rgba(0,0,0,.35)"
        : "0 5px 12px rgba(0,0,0,.35), inset 0 1px 2px rgba(255,255,255,.35)",
  };

  if (ghost) {
    return (
      <div
        className="chess-piece piece-ghost"
        style={style}
        aria-hidden
      >
        <span className="piece-ring" />
        <span className="piece-text">{getPieceName(piece)}</span>
      </div>
    );
  }

  return (
    <span
      className={`chess-piece ${slideStyle ? "piece-sliding" : ""}`}
      style={slideStyle ? { ...style, ...slideStyle } : style}
      aria-label={`${piece.side === "red" ? "红方" : "黑方"}${getPieceName(piece)}`}
    >
      <span className="piece-ring" />
      <span className="piece-text">{getPieceName(piece)}</span>
    </span>
  );
}

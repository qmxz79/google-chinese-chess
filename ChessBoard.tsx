import ChessPiece from "./ChessPiece";
import { GameState, Position } from "./chess-engine";

interface ChessBoardProps {
  gameState: GameState;
  onCellClick: (pos: Position) => void;
  boardSize: number;
  pieceSize: number;
  moveGhost: Position | null;
  lastMove: { from: Position; to: Position } | null;
  showCheckFlash: boolean;
  showWinOverlay: boolean;
  flipped?: boolean;
}

export default function ChessBoard({
  gameState,
  onCellClick,
  boardSize,
  pieceSize,
  moveGhost,
  lastMove,
  showCheckFlash,
  showWinOverlay,
  flipped = false,
}: ChessBoardProps) {
  const cellSize = boardSize / 9;
  const boardHeight = cellSize * 10;
  const padding = cellSize / 2;
  const mapDisplayToBoard = (row: number, col: number): Position =>
    flipped ? { row: 9 - row, col: 8 - col } : { row, col };
  const mapBoardToDisplay = (row: number, col: number): Position =>
    flipped ? { row: 9 - row, col: 8 - col } : { row, col };

  const isSelected = (row: number, col: number) =>
    gameState.selectedPos?.row === row && gameState.selectedPos?.col === col;
  const isValidMove = (row: number, col: number) =>
    gameState.validMoves.some((move) => move.row === row && move.col === col);
  const isKingInCheck = (row: number, col: number) => {
    const piece = gameState.board[row][col];
    return Boolean(gameState.isCheck && piece?.type === "K" && piece.side === gameState.currentTurn);
  };

  const lines = [];
  for (let row = 0; row < 10; row++) {
    const y = padding + row * cellSize;
    lines.push(<line key={`h-${row}`} x1={padding} y1={y} x2={padding + 8 * cellSize} y2={y} />);
  }
  for (let col = 0; col < 9; col++) {
    const x = padding + col * cellSize;
    if (col === 0 || col === 8) {
      lines.push(<line key={`v-${col}`} x1={x} y1={padding} x2={x} y2={padding + 9 * cellSize} />);
    } else {
      lines.push(<line key={`v-${col}-top`} x1={x} y1={padding} x2={x} y2={padding + 4 * cellSize} />);
      lines.push(<line key={`v-${col}-bottom`} x1={x} y1={padding + 5 * cellSize} x2={x} y2={padding + 9 * cellSize} />);
    }
  }

  const palaceLines = [
    [3, 0, 5, 2],
    [5, 0, 3, 2],
    [3, 7, 5, 9],
    [5, 7, 3, 9],
  ];
  palaceLines.forEach(([x1, y1, x2, y2], index) => {
    lines.push(
      <line
        key={`palace-${index}`}
        x1={padding + x1 * cellSize}
        y1={padding + y1 * cellSize}
        x2={padding + x2 * cellSize}
        y2={padding + y2 * cellSize}
      />
    );
  });

  return (
    <div
      className="board"
      style={{ width: boardSize, height: boardHeight }}
      role="grid"
      aria-label="中国象棋棋盘"
    >
      <svg className="board-lines" width={boardSize} height={boardHeight} viewBox={`0 0 ${boardSize} ${boardHeight}`}>
        <g stroke="#5b3416" strokeWidth="1.35" strokeLinecap="round">
          {lines}
        </g>
        <text
          x={boardSize / 2}
          y={boardHeight / 2 + cellSize * 0.12}
          textAnchor="middle"
          fill="#684019"
          fontSize={Math.max(17, cellSize * 0.36)}
          fontWeight="700"
        >
          楚河　汉界
        </text>
      </svg>

      {showCheckFlash && (
        <div className="check-flash-overlay" key={Date.now()}>
          <span className="check-flash-text">将军</span>
        </div>
      )}

      {showWinOverlay && gameState.winner && (
        <div className="win-overlay">
          <span className="win-text">
            {gameState.winner === "red" ? "红方胜！" : "黑方胜！"}
          </span>
        </div>
      )}

      {Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 9 }, (_, col) => {
          const boardPos = mapDisplayToBoard(row, col);
          const piece = gameState.board[boardPos.row][boardPos.col];
          const isGhost = moveGhost?.row === boardPos.row && moveGhost?.col === boardPos.col;
          const isSlideTarget = lastMove?.to.row === boardPos.row && lastMove?.to.col === boardPos.col && piece;
          const selected = isSelected(boardPos.row, boardPos.col);
          const validTarget = isValidMove(boardPos.row, boardPos.col);
          const x = padding + col * cellSize;
          const y = padding + row * cellSize;

          const slideStyle =
            isSlideTarget && lastMove
              ? ({
                  "--slide-x": `${
                    (mapBoardToDisplay(lastMove.from.row, lastMove.from.col).col -
                      mapBoardToDisplay(lastMove.to.row, lastMove.to.col).col) *
                    cellSize
                  }px`,
                  "--slide-y": `${
                    (mapBoardToDisplay(lastMove.from.row, lastMove.from.col).row -
                      mapBoardToDisplay(lastMove.to.row, lastMove.to.col).row) *
                    cellSize
                  }px`,
                } as React.CSSProperties)
              : undefined;

          return (
            <button
              key={`${row}-${col}`}
              className="board-cell"
              onClick={() => onCellClick(boardPos)}
              style={{
                left: x - pieceSize / 2,
                top: y - pieceSize / 2,
                width: pieceSize,
                height: pieceSize,
              }}
              aria-label={`${row + 1}行${col + 1}列`}
            >
              {validTarget && !piece && !isGhost && <span className="move-dot" />}
              {validTarget && piece && !isGhost && <span className="capture-ring" />}
              {isKingInCheck(boardPos.row, boardPos.col) && <span className="check-ring" />}
              {isGhost && <span className="ghost-ring" />}
              {piece && (
                <ChessPiece
                  piece={piece}
                  isSelected={selected}
                  isValidTarget={validTarget}
                  size={pieceSize}
                  slideStyle={slideStyle}
                />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

export type PieceType = "K" | "A" | "B" | "N" | "R" | "C" | "P";
export type Side = "red" | "black";

export interface Piece {
  type: PieceType;
  side: Side;
  id: string;
}

export type Board = (Piece | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  captured?: Piece;
}

export interface GameState {
  board: Board;
  currentTurn: Side;
  selectedPos: Position | null;
  validMoves: Position[];
  isCheck: boolean;
  isCheckmate: boolean;
  winner: Side | null;
  moveHistory: Move[];
  capturedPieces: { red: Piece[]; black: Piece[] };
  positionCounts: Record<string, number>;
}

const PIECE_NAMES: Record<`${PieceType}_${Side}`, string> = {
  K_red: "帅",
  K_black: "将",
  A_red: "仕",
  A_black: "士",
  B_red: "相",
  B_black: "象",
  N_red: "马",
  N_black: "马",
  R_red: "车",
  R_black: "车",
  C_red: "炮",
  C_black: "炮",
  P_red: "兵",
  P_black: "卒",
};

export function getPieceName(piece: Piece): string {
  return PIECE_NAMES[`${piece.type}_${piece.side}`];
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const place = (row: number, col: number, type: PieceType, side: Side, id: string) => {
    board[row][col] = { type, side, id };
  };

  place(0, 0, "R", "black", "bR1");
  place(0, 1, "N", "black", "bN1");
  place(0, 2, "B", "black", "bB1");
  place(0, 3, "A", "black", "bA1");
  place(0, 4, "K", "black", "bK");
  place(0, 5, "A", "black", "bA2");
  place(0, 6, "B", "black", "bB2");
  place(0, 7, "N", "black", "bN2");
  place(0, 8, "R", "black", "bR2");
  place(2, 1, "C", "black", "bC1");
  place(2, 7, "C", "black", "bC2");
  [0, 2, 4, 6, 8].forEach((col, index) => place(3, col, "P", "black", `bP${index + 1}`));

  place(9, 0, "R", "red", "rR1");
  place(9, 1, "N", "red", "rN1");
  place(9, 2, "B", "red", "rB1");
  place(9, 3, "A", "red", "rA1");
  place(9, 4, "K", "red", "rK");
  place(9, 5, "A", "red", "rA2");
  place(9, 6, "B", "red", "rB2");
  place(9, 7, "N", "red", "rN2");
  place(9, 8, "R", "red", "rR2");
  place(7, 1, "C", "red", "rC1");
  place(7, 7, "C", "red", "rC2");
  [0, 2, 4, 6, 8].forEach((col, index) => place(6, col, "P", "red", `rP${index + 1}`));

  return board;
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row <= 9 && col >= 0 && col <= 8;
}

function isInPalace(row: number, col: number, side: Side): boolean {
  return col >= 3 && col <= 5 && (side === "red" ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
}

function isRedSide(row: number): boolean {
  return row >= 5;
}

function findKing(board: Board, side: Side): Position | null {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece?.type === "K" && piece.side === side) return { row, col };
    }
  }
  return null;
}

function getRawMoves(board: Board, pos: Position): Position[] {
  const piece = board[pos.row]?.[pos.col];
  if (!piece) return [];

  const moves: Position[] = [];
  const { row, col } = pos;
  const add = (nextRow: number, nextCol: number) => {
    if (!isInBounds(nextRow, nextCol)) return;
    const target = board[nextRow][nextCol];
    if (!target || target.side !== piece.side) moves.push({ row: nextRow, col: nextCol });
  };

  switch (piece.type) {
    case "K":
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (isInPalace(nextRow, nextCol, piece.side)) add(nextRow, nextCol);
      });
      break;
    case "A":
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (isInPalace(nextRow, nextCol, piece.side)) add(nextRow, nextCol);
      });
      break;
    case "B":
      [[-2, -2], [-2, 2], [2, -2], [2, 2]].forEach(([dr, dc]) => {
        const nextRow = row + dr;
        const nextCol = col + dc;
        const eyeRow = row + dr / 2;
        const eyeCol = col + dc / 2;
        if (!isInBounds(nextRow, nextCol)) return;
        if (piece.side === "red" && !isRedSide(nextRow)) return;
        if (piece.side === "black" && isRedSide(nextRow)) return;
        if (board[eyeRow][eyeCol]) return;
        add(nextRow, nextCol);
      });
      break;
    case "N":
      [
        [-2, -1, -1, 0],
        [-2, 1, -1, 0],
        [2, -1, 1, 0],
        [2, 1, 1, 0],
        [-1, -2, 0, -1],
        [1, -2, 0, -1],
        [-1, 2, 0, 1],
        [1, 2, 0, 1],
      ].forEach(([dr, dc, lr, lc]) => {
        if (board[row + lr]?.[col + lc]) return;
        add(row + dr, col + dc);
      });
      break;
    case "R":
    case "C":
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        let nextRow = row + dr;
        let nextCol = col + dc;
        let screen = false;
        while (isInBounds(nextRow, nextCol)) {
          const target = board[nextRow][nextCol];
          if (piece.type === "R") {
            if (target) {
              if (target.side !== piece.side) moves.push({ row: nextRow, col: nextCol });
              break;
            }
            moves.push({ row: nextRow, col: nextCol });
          } else if (!screen) {
            if (target) screen = true;
            else moves.push({ row: nextRow, col: nextCol });
          } else if (target) {
            if (target.side !== piece.side) moves.push({ row: nextRow, col: nextCol });
            break;
          }
          nextRow += dr;
          nextCol += dc;
        }
      });
      break;
    case "P": {
      const forward = piece.side === "red" ? -1 : 1;
      add(row + forward, col);
      const crossedRiver = piece.side === "red" ? row < 5 : row >= 5;
      if (crossedRiver) {
        add(row, col - 1);
        add(row, col + 1);
      }
      break;
    }
  }

  return moves;
}

function kingsFace(board: Board): boolean {
  const redKing = findKing(board, "red");
  const blackKing = findKing(board, "black");
  if (!redKing || !blackKing || redKing.col !== blackKing.col) return false;

  for (let row = blackKing.row + 1; row < redKing.row; row++) {
    if (board[row][redKing.col]) return false;
  }
  return true;
}

export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return true;
  if (kingsFace(board)) return true;

  const opponent: Side = side === "red" ? "black" : "red";
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece?.side !== opponent) continue;
      if (getRawMoves(board, { row, col }).some((move) => move.row === king.row && move.col === king.col)) {
        return true;
      }
    }
  }
  return false;
}

function applyMove(board: Board, from: Position, to: Position): Board {
  const nextBoard = board.map((line) => [...line]);
  nextBoard[to.row][to.col] = nextBoard[from.row][from.col];
  nextBoard[from.row][from.col] = null;
  return nextBoard;
}

function boardSignature(board: Board, currentTurn: Side): string {
  return [
    currentTurn,
    ...board.map((row) =>
      row
        .map((piece) => (piece ? `${piece.side[0]}${piece.type}` : "."))
        .join("")
    ),
  ].join("|");
}

function wouldRepeatCheckViolation(state: GameState, from: Position, to: Position): boolean {
  const piece = state.board[from.row]?.[from.col];
  if (!piece) return false;

  const nextBoard = applyMove(state.board, from, to);
  const nextTurn: Side = state.currentTurn === "red" ? "black" : "red";
  if (!isInCheck(nextBoard, nextTurn)) return false;

  const signature = boardSignature(nextBoard, nextTurn);
  const seenCount = state.positionCounts[signature] ?? 0;
  return seenCount >= 3;
}

export function getValidMoves(board: Board, pos: Position): Position[] {
  const piece = board[pos.row]?.[pos.col];
  if (!piece) return [];
  return getRawMoves(board, pos).filter((to) => !isInCheck(applyMove(board, pos, to), piece.side));
}

export function getValidMovesForState(state: GameState, pos: Position): Position[] {
  return getValidMoves(state.board, pos).filter((to) => !wouldRepeatCheckViolation(state, pos, to));
}

export function isCheckmate(board: Board, side: Side): boolean {
  if (!isInCheck(board, side)) return false;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece?.side === side && getValidMoves(board, { row, col }).length > 0) return false;
    }
  }
  return true;
}

export function makeMove(state: GameState, from: Position, to: Position): GameState {
  const piece = state.board[from.row]?.[from.col];
  if (!piece) return state;
  const legal = getValidMovesForState(state, from).some((move) => move.row === to.row && move.col === to.col);
  if (!legal) return state;
  if (wouldRepeatCheckViolation(state, from, to)) return state;

  const captured = state.board[to.row][to.col] || undefined;
  const board = applyMove(state.board, from, to);
  const currentTurn: Side = state.currentTurn === "red" ? "black" : "red";
  const isCheck = isInCheck(board, currentTurn);
  const isCheckmateState = isCheckmate(board, currentTurn);
  const capturedPieces = {
    red: [...state.capturedPieces.red],
    black: [...state.capturedPieces.black],
  };

  if (captured) capturedPieces[captured.side].push(captured);

  const nextSignature = boardSignature(board, currentTurn);
  const positionCounts = {
    ...state.positionCounts,
    [nextSignature]: (state.positionCounts[nextSignature] ?? 0) + 1,
  };

  return {
    board,
    currentTurn,
    selectedPos: null,
    validMoves: [],
    isCheck,
    isCheckmate: isCheckmateState,
    winner: isCheckmateState ? state.currentTurn : null,
    moveHistory: [...state.moveHistory, { from, to, captured }],
    capturedPieces,
    positionCounts,
  };
}

export function createInitialGameState(): GameState {
  const board = createInitialBoard();
  const initialSignature = boardSignature(board, "red");
  return {
    board,
    currentTurn: "red",
    selectedPos: null,
    validMoves: [],
    isCheck: false,
    isCheckmate: false,
    winner: null,
    moveHistory: [],
    capturedPieces: { red: [], black: [] },
    positionCounts: { [initialSignature]: 1 },
  };
}

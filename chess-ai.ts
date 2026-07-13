import {
  GameState,
  PieceType,
  Position,
  Side,
  getValidMovesForState,
  makeMove,
} from "./chess-engine";

export type Difficulty = "easy" | "medium" | "hard";

interface CandidateMove {
  from: Position;
  to: Position;
  score: number;
}

const PIECE_VALUES: Record<PieceType, number> = {
  K: 10000,
  A: 200,
  B: 200,
  N: 400,
  R: 900,
  C: 450,
  P: 120,
};

const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  easy: 2,
  medium: 6,
  hard: 9,
};

const MAX_SEARCH_MS = 5000;
const CHECK_BONUS = 650;
const CHECKMATE_SCORE = 100000;

function opponent(side: Side): Side {
  return side === "red" ? "black" : "red";
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function pieceValue(type: PieceType | undefined): number {
  return type ? PIECE_VALUES[type] : 0;
}

function positionWeight(row: number, col: number, side: Side): number {
  const center = 10 - (Math.abs(col - 4) + Math.abs(row - 4.5));
  const advanced = side === "red" ? 9 - row : row;
  const palacePressure = col >= 3 && col <= 5 ? 4 : 0;
  return center * 2 + advanced * 1.3 + palacePressure;
}

function isCapture(state: GameState, move: CandidateMove): boolean {
  return Boolean(state.board[move.to.row][move.to.col]);
}

function allMoves(state: GameState, side: Side): CandidateMove[] {
  const moves: CandidateMove[] = [];

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row][col];
      if (piece?.side !== side) continue;

      for (const to of getValidMovesForState(state, { row, col })) {
        const captured = state.board[to.row][to.col];
        moves.push({
          from: { row, col },
          to,
          score: pieceValue(captured?.type) * 10 + positionWeight(to.row, to.col, side),
        });
      }
    }
  }

  return moves.sort((a, b) => b.score - a.score);
}

function tacticalMoves(state: GameState, side: Side): CandidateMove[] {
  const moves: CandidateMove[] = [];

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row][col];
      if (piece?.side !== side) continue;

      for (const to of getValidMovesForState(state, { row, col })) {
        const move: CandidateMove = {
          from: { row, col },
          to,
          score: pieceValue(state.board[to.row][to.col]?.type) * 10 + positionWeight(to.row, to.col, side),
        };
        const next = makeMove(state, move.from, move.to);
        if (isCapture(state, move) || next.isCheck) {
          move.score += next.isCheck ? CHECK_BONUS : 0;
          moves.push(move);
        }
      }
    }
  }

  return moves.sort((a, b) => b.score - a.score);
}

function evaluate(state: GameState, aiSide: Side): number {
  if (state.winner === aiSide) return CHECKMATE_SCORE + state.moveHistory.length;
  if (state.winner) return -CHECKMATE_SCORE - state.moveHistory.length;

  let score = 0;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row][col];
      if (!piece) continue;
      const val = pieceValue(piece.type) + positionWeight(row, col, piece.side);
      score += piece.side === aiSide ? val : -val;
    }
  }

  if (state.isCheck) score += state.currentTurn === aiSide ? -350 : 450;
  return score;
}

let searchDeadline = 0;

function isTimeUp(): boolean {
  return performance.now() >= searchDeadline;
}

function quiescence(state: GameState, alpha: number, beta: number, aiSide: Side): number {
  if (state.winner) return evaluate(state, aiSide);
  if (isTimeUp()) return evaluate(state, aiSide);

  const standPat = evaluate(state, aiSide);
  if (state.currentTurn === aiSide) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    const moves = tacticalMoves(state, aiSide);
    for (let i = 0; i < moves.length; i++) {
      const next = makeMove(state, moves[i].from, moves[i].to);
      const score = quiescence(next, alpha, beta, aiSide);
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
      if (isTimeUp()) break;
    }
    return alpha;
  }

  if (standPat <= alpha) return alpha;
  if (standPat < beta) beta = standPat;

  const moves = tacticalMoves(state, opponent(aiSide));
  for (let i = 0; i < moves.length; i++) {
    const next = makeMove(state, moves[i].from, moves[i].to);
    const score = quiescence(next, alpha, beta, aiSide);
    if (score < beta) beta = score;
    if (alpha >= beta) break;
    if (isTimeUp()) break;
  }
  return beta;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiSide: Side
): number {
  if (depth === 0 || state.winner) return quiescence(state, alpha, beta, aiSide);
  if (isTimeUp()) return evaluate(state, aiSide);

  const side = maximizing ? aiSide : opponent(aiSide);
  const moves = allMoves(state, side);
  if (moves.length === 0) return evaluate(state, aiSide);

  if (maximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      const next = makeMove(state, moves[i].from, moves[i].to);
      const score = minimax(next, depth - 1, alpha, beta, false, aiSide);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
      if (isTimeUp()) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < moves.length; i++) {
      const next = makeMove(state, moves[i].from, moves[i].to);
      const score = minimax(next, depth - 1, alpha, beta, true, aiSide);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
      if (isTimeUp()) break;
    }
    return minEval;
  }
}

function searchRoot(
  state: GameState,
  depth: number,
  aiSide: Side
): { move: { from: Position; to: Position } | null; completed: boolean } {
  const moves = allMoves(state, aiSide);
  if (moves.length === 0) return { move: null, completed: true };

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const next = makeMove(state, move.from, move.to);
    const score = minimax(next, depth - 1, -Infinity, Infinity, false, aiSide);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (isTimeUp()) {
      return { move: { from: bestMove.from, to: bestMove.to }, completed: false };
    }
  }

  return { move: { from: bestMove.from, to: bestMove.to }, completed: true };
}

function searchBestMove(state: GameState, difficulty: Difficulty, aiSide: Side): { from: Position; to: Position } | null {
  const maxDepth = DIFFICULTY_DEPTH[difficulty];
  searchDeadline = performance.now() + MAX_SEARCH_MS;

  let bestMove: { from: Position; to: Position } | null = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (isTimeUp()) break;

    const result = searchRoot(state, depth, aiSide);
    if (!result.move) return null;

    if (result.completed || bestMove === null) {
      bestMove = result.move;
    }

    if (!result.completed) break;
  }

  return bestMove;
}

export function getAIMove(
  state: GameState,
  difficulty: Difficulty,
  aiSide: Side
): { from: Position; to: Position } | null {
  if (state.currentTurn !== aiSide) return null;
  return searchBestMove(state, difficulty, aiSide);
}

export async function getAIMoveWithDelay(
  state: GameState,
  difficulty: Difficulty,
  aiSide: Side
): Promise<{ from: Position; to: Position } | null> {
  if (state.currentTurn !== aiSide) return null;

  const delay = difficulty === "easy" ? 180 : difficulty === "medium" ? 320 : 520;
  await new Promise((resolve) => window.setTimeout(resolve, delay));
  await yieldToBrowser();

  const maxDepth = DIFFICULTY_DEPTH[difficulty];
  searchDeadline = performance.now() + MAX_SEARCH_MS;

  let bestMove: { from: Position; to: Position } | null = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (isTimeUp()) break;

    const result = searchRoot(state, depth, aiSide);
    if (!result.move) return null;

    if (result.completed || bestMove === null) {
      bestMove = result.move;
    }

    if (!result.completed) break;
    if (depth % 2 === 1) await yieldToBrowser();
  }

  return bestMove;
}

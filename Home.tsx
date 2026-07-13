import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Difficulty, getAIMoveWithDelay } from "./chess-ai";
import ChessBoard from "./ChessBoard";
import {
  GameState,
  Piece,
  Position,
  createInitialGameState,
  getPieceName,
  getValidMovesForState,
  makeMove,
} from "./chess-engine";
import GameModeSelector, { GameMode } from "./GameModeSelector";
import { createRoom, fetchRoomState, getStoredRoomToken, joinRoom, RoomSession, sendRoomMove, setStoredRoomToken } from "./room-api";
import { useSound } from "./useSound";

function useViewportBoardSize() {
  const [size, setSize] = useState(420);

  useEffect(() => {
    const update = () => {
      const widthLimit = window.innerWidth - 32;
      const heightLimit = Math.floor((window.innerHeight - 210) * 0.9);
      const byHeight = Math.floor((heightLimit / 10) * 9);
      setSize(Math.max(288, Math.min(540, widthLimit, byHeight || widthLimit)));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return size;
}

function CapturedPieces({ pieces }: { pieces: Piece[] }) {
  if (pieces.length === 0) return <span className="empty-text">暂无</span>;

  return (
    <div className="captured-pieces">
      {pieces.map((piece, index) => (
        <span key={`${piece.id}-${index}`} className={piece.side === "red" ? "red-text" : "black-text"}>
          {getPieceName(piece)}
        </span>
      ))}
    </div>
  );
}

function PlayerPanel({
  title,
  pieces,
  active,
  inCheck,
  isAI,
}: {
  title: string;
  pieces: Piece[];
  active: boolean;
  inCheck: boolean;
  isAI?: boolean;
}) {
  return (
    <section className={`panel player-panel ${active ? "active" : ""}`}>
      <div className="panel-title">
        <span>{title}</span>
        {isAI && <small>AI</small>}
        {inCheck && <small className="danger">将军</small>}
      </div>
      <div className="panel-subtitle">已吃棋子</div>
      <CapturedPieces pieces={pieces} />
    </section>
  );
}

function MoveHistory({ moves }: { moves: GameState["moveHistory"] }) {
  return (
    <section className="panel history-panel">
      <div className="panel-title">棋谱</div>
      {moves.length === 0 ? (
        <span className="empty-text">暂无记录</span>
      ) : (
        <ol>
          {moves.slice(-10).map((move, index) => (
            <li key={index}>
              {move.from.row + 1},{move.from.col + 1} → {move.to.row + 1},{move.to.col + 1}
              {move.captured ? ` 吃${getPieceName(move.captured)}` : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function modeName(mode: GameMode | null) {
  switch (mode) {
    case "pvp":
      return "双人对战";
    case "pve-easy":
      return "人机简单";
    case "pve-medium":
      return "人机中等";
    case "pve-hard":
      return "人机困难";
    default:
      return "请选择模式";
  }
}

function modeDifficulty(mode: GameMode): Difficulty {
  if (mode === "pve-easy") return "easy";
  if (mode === "pve-medium") return "medium";
  return "hard";
}

function roomModeLabel(room: RoomSession | null, mode: GameMode | null) {
  if (room) return "与好友一起玩";
  return modeName(mode);
}

function roomTurnLabel(room: RoomSession | null, state: GameState, isRoomBusy: boolean, isAIThinking: boolean) {
  if (state.winner) {
    return `${state.winner === "red" ? "红方" : "黑方"}胜利`;
  }
  if (room) {
    if (isRoomBusy) return "房间同步中";
    return state.currentTurn === room.side ? "轮到你走" : "等待好友落子";
  }
  if (isAIThinking) return "AI 思考中";
  return `${state.currentTurn === "red" ? "红方" : "黑方"}行棋`;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [friendRoom, setFriendRoom] = useState<RoomSession | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isRoomBusy, setIsRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [moveGhost, setMoveGhost] = useState<Position | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null);
  const [showCheckFlash, setShowCheckFlash] = useState(false);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const boardSize = useViewportBoardSize();
  const pieceSize = useMemo(() => Math.floor((boardSize / 9) * 0.82), [boardSize]);
  const { playPickup, playPlace, playCheck, playWin, bgmOn, toggleBgm } = useSound();

  const flashTimerRef = useRef<number | null>(null);
  const roomRevisionRef = useRef(0);
  const roomPollRef = useRef<number | null>(null);
  const moveGhostTimerRef = useRef<number | null>(null);

  const clearMoveGhost = useCallback(() => {
    if (moveGhostTimerRef.current !== null) {
      window.clearTimeout(moveGhostTimerRef.current);
      moveGhostTimerRef.current = null;
    }
    setMoveGhost(null);
  }, []);

  const showMoveGhostFor = useCallback(
    (from: Position) => {
      clearMoveGhost();
      setMoveGhost(from);
      moveGhostTimerRef.current = window.setTimeout(() => {
        moveGhostTimerRef.current = null;
        setMoveGhost(null);
      }, 6000);
    },
    [clearMoveGhost]
  );

  const triggerCheckFlash = useCallback(() => {
    setShowCheckFlash(true);
    playCheck();
    if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setShowCheckFlash(false), 1600);
  }, [playCheck]);

  const triggerWin = useCallback(() => {
    setShowWinOverlay(true);
    playWin();
  }, [playWin]);

  const isFriendMode = friendRoom !== null;
  const isAIMode = gameMode !== null && gameMode !== "pvp" && !isFriendMode;
  const isModePickerOpen = !gameMode && !friendRoom;
  const boardFlipped = friendRoom?.side === "black";
  const redCheck = gameState.isCheck && gameState.currentTurn === "red";
  const blackCheck = gameState.isCheck && gameState.currentTurn === "black";

  const applyMoveTransition = useCallback(
    (nextState: GameState, movedFrom?: Position | null) => {
      if (movedFrom) {
        showMoveGhostFor(movedFrom);
        playPlace();
      } else {
        clearMoveGhost();
      }
      if (nextState.isCheck) triggerCheckFlash();
      if (nextState.winner) triggerWin();
      setGameState(nextState);
    },
    [clearMoveGhost, playPlace, showMoveGhostFor, triggerCheckFlash, triggerWin]
  );

  const clearRoomRoute = useCallback(() => {
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const leaveFriendRoom = useCallback(() => {
    if (roomPollRef.current !== null) {
      window.clearInterval(roomPollRef.current);
      roomPollRef.current = null;
    }
    roomRevisionRef.current = 0;
    setFriendRoom(null);
    setIsRoomBusy(false);
    setRoomError(null);
    setGameState(createInitialGameState());
    setIsAIThinking(false);
    clearMoveGhost();
    setLastMove(null);
    setShowCheckFlash(false);
    setShowWinOverlay(false);
    clearRoomRoute();
  }, [clearMoveGhost, clearRoomRoute]);

  const startFriendPlay = useCallback(async () => {
    setRoomError(null);
    setIsRoomBusy(true);
    try {
      const result = await createRoom();
      setStoredRoomToken(result.session.code, result.session.token);
      roomRevisionRef.current = result.session.revision;
      setFriendRoom(result.session);
      setGameMode(null);
      setGameState(result.state);
      setLastMove(result.lastMove ? { from: result.lastMove.from, to: result.lastMove.to } : null);
      clearMoveGhost();
      setShowCheckFlash(false);
      setShowWinOverlay(false);
      setIsAIThinking(false);
      clearRoomRoute();
      window.history.replaceState({}, "", `${window.location.pathname}?room=${encodeURIComponent(result.session.code)}`);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRoomBusy(false);
    }
  }, [clearMoveGhost, clearRoomRoute]);

  const copyRoomLink = useCallback(async () => {
    if (!friendRoom) return;
    await window.navigator.clipboard.writeText(friendRoom.shareUrl);
  }, [friendRoom]);

  const restart = useCallback(() => {
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (isFriendMode) {
      leaveFriendRoom();
      return;
    }
    setGameState(createInitialGameState());
    setIsAIThinking(false);
    clearMoveGhost();
    setLastMove(null);
    setShowCheckFlash(false);
    setShowWinOverlay(false);
  }, [clearMoveGhost, isFriendMode, leaveFriendRoom]);

  const chooseMode = useCallback(
    (mode: GameMode) => {
      if (isFriendMode) leaveFriendRoom();
      setGameMode(mode);
      restart();
    },
    [isFriendMode, leaveFriendRoom, restart]
  );

  useEffect(() => {
    if (gameMode !== "pve-hard" && gameMode !== "pve-medium" && gameMode !== "pve-easy") return;
    if (gameState.currentTurn !== "black" || gameState.winner) return;

    let cancelled = false;
    setIsAIThinking(true);

    getAIMoveWithDelay(gameState, modeDifficulty(gameMode), "black")
      .then((move) => {
        if (cancelled || !move) return;
        const next = makeMove(gameState, move.from, move.to);
        setLastMove({ from: move.from, to: move.to });
        applyMoveTransition(next, move.from);
      })
      .catch((error) => {
        console.error("AI move failed", error);
      })
      .finally(() => {
        if (!cancelled) setIsAIThinking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyMoveTransition, gameMode, gameState, gameState.currentTurn, gameState.moveHistory.length, gameState.winner]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room")?.trim().toUpperCase();
    if (!roomCode) return;

    let cancelled = false;
    setIsRoomBusy(true);
    setRoomError(null);

    void (async () => {
      try {
        const storedToken = getStoredRoomToken(roomCode);
        const result = await joinRoom(roomCode, storedToken);
        if (cancelled) return;
        setStoredRoomToken(result.session.code, result.session.token);
        roomRevisionRef.current = result.session.revision;
        setFriendRoom(result.session);
        setGameMode(null);
        setGameState(result.state);
        setLastMove(result.lastMove ? { from: result.lastMove.from, to: result.lastMove.to } : null);
        clearMoveGhost();
        setShowCheckFlash(false);
        setShowWinOverlay(false);
      } catch (error) {
        if (!cancelled) {
          setRoomError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setIsRoomBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearMoveGhost]);

  useEffect(() => {
    if (!friendRoom) {
      if (roomPollRef.current !== null) {
        window.clearInterval(roomPollRef.current);
        roomPollRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const syncRoom = async () => {
      try {
        const result = await fetchRoomState(friendRoom.code, friendRoom.token);
        if (cancelled) return;
        setRoomError(null);
        if (result.session.revision !== roomRevisionRef.current) {
          roomRevisionRef.current = result.session.revision;
          setFriendRoom(result.session);
          setGameState(result.state);
          setLastMove(result.lastMove ? { from: result.lastMove.from, to: result.lastMove.to } : null);
          if (result.lastMove) {
            showMoveGhostFor(result.lastMove.from);
            playPlace();
          } else {
            clearMoveGhost();
          }
          if (result.state.isCheck) triggerCheckFlash();
          if (result.state.winner) triggerWin();
        }
      } catch (error) {
        if (!cancelled) {
          setRoomError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void syncRoom();
    roomPollRef.current = window.setInterval(() => {
      void syncRoom();
    }, 1500);

    return () => {
      cancelled = true;
      if (roomPollRef.current !== null) {
        window.clearInterval(roomPollRef.current);
        roomPollRef.current = null;
      }
    };
  }, [clearMoveGhost, friendRoom, playPlace, showMoveGhostFor, triggerCheckFlash, triggerWin]);

  const handleCellClick = useCallback(
    (pos: Position) => {
      if (gameState.winner || isAIThinking || isRoomBusy) return;
      if (!gameMode && !friendRoom) return;
      if (friendRoom && gameState.currentTurn !== friendRoom.side) return;
      if (isAIMode && gameState.currentTurn === "black") return;

      const piece = gameState.board[pos.row][pos.col];

      if (gameState.selectedPos) {
        const canMove = gameState.validMoves.some((move) => move.row === pos.row && move.col === pos.col);
        if (canMove) {
          if (friendRoom) {
            void (async () => {
              setIsRoomBusy(true);
              try {
                const selectedPos = gameState.selectedPos!;
                const result = await sendRoomMove(friendRoom.code, friendRoom.token, selectedPos, pos);
                setStoredRoomToken(result.session.code, result.session.token);
                roomRevisionRef.current = result.session.revision;
                setFriendRoom(result.session);
                setLastMove(result.lastMove ? { from: result.lastMove.from, to: result.lastMove.to } : { from: selectedPos, to: pos });
                applyMoveTransition(result.state, selectedPos);
              } catch (error) {
                setRoomError(error instanceof Error ? error.message : String(error));
              } finally {
                setIsRoomBusy(false);
              }
            })();
            return;
          }

          const next = makeMove(gameState, gameState.selectedPos, pos);
          setLastMove({ from: gameState.selectedPos, to: pos });
          applyMoveTransition(next, gameState.selectedPos);
          return;
        }
      }

      if (piece?.side === gameState.currentTurn) {
        playPickup();
        setGameState({
          ...gameState,
          selectedPos: pos,
          validMoves: getValidMovesForState(gameState, pos),
        });
      } else {
        setGameState({ ...gameState, selectedPos: null, validMoves: [] });
      }
    },
    [applyMoveTransition, friendRoom, gameMode, gameState, isAIMode, isAIThinking, isRoomBusy, playPickup]
  );

  const undo = useCallback(() => {
    if (friendRoom) return;
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    const undoCount = isAIMode ? 2 : 1;
    const history = gameState.moveHistory.slice(0, Math.max(0, gameState.moveHistory.length - undoCount));
    let next = createInitialGameState();
    for (const move of history) next = makeMove(next, move.from, move.to);
    clearMoveGhost();
    setShowCheckFlash(false);
    setShowWinOverlay(false);
    setGameState(next);
  }, [clearMoveGhost, friendRoom, gameState.moveHistory, isAIMode]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
      if (roomPollRef.current !== null) window.clearInterval(roomPollRef.current);
      if (moveGhostTimerRef.current !== null) window.clearTimeout(moveGhostTimerRef.current);
    };
  }, []);

  return (
    <main className={`app-shell ${isModePickerOpen ? "mode-picker-open" : ""}`}>
      <header className="game-header">
        <div>
          <h1>中国象棋</h1>
          <p>{roomModeLabel(friendRoom, gameMode)}</p>
        </div>
        <div className="header-actions">
          <a className="ghost-button" href="/">
            返回主页
          </a>
          <button
            className={`ghost-button bgm-toggle ${bgmOn ? "bgm-on" : ""}`}
            onClick={toggleBgm}
            aria-label={bgmOn ? "关闭背景音乐" : "开启背景音乐"}
          >
            {bgmOn ? "♫ 音乐开" : "♫ 音乐关"}
          </button>
          <button className="ghost-button" onClick={friendRoom ? leaveFriendRoom : () => setGameMode(null)}>
            切换模式
          </button>
        </div>
      </header>

      {friendRoom && (
        <section className="room-bar">
          <div className="panel room-card">
            <div className="room-meta">
              <span>
                房间码 <strong>{friendRoom.code}</strong>
              </span>
              <span>
                你的执子 <strong>{friendRoom.side === "red" ? "红方" : "黑方"}</strong>
              </span>
              {roomError && <span className="danger">{roomError}</span>}
            </div>
            <div className="room-link-row">
              <input readOnly value={friendRoom.shareUrl} />
              <button className="primary-button" onClick={() => void copyRoomLink()}>
                复制链接
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="game-layout">
        <aside className="side-column">
          <PlayerPanel
            title="黑方"
            pieces={gameState.capturedPieces.black}
            active={gameState.currentTurn === "black" && !gameState.winner}
            inCheck={blackCheck}
            isAI={isAIMode}
          />
          <MoveHistory moves={gameState.moveHistory} />
        </aside>

        <section className="board-wrap" aria-busy={isAIThinking || isRoomBusy}>
          <ChessBoard
            gameState={gameState}
            onCellClick={handleCellClick}
            boardSize={boardSize}
            pieceSize={pieceSize}
            moveGhost={moveGhost}
            lastMove={lastMove}
            showCheckFlash={showCheckFlash}
            showWinOverlay={showWinOverlay}
            flipped={boardFlipped}
          />
        </section>

        <aside className="side-column">
          <PlayerPanel
            title="红方"
            pieces={gameState.capturedPieces.red}
            active={gameState.currentTurn === "red" && !gameState.winner}
            inCheck={redCheck}
          />
          <section className="panel status-panel">
            <div className="panel-subtitle">当前状态</div>
            <strong>{roomTurnLabel(friendRoom, gameState, isRoomBusy, isAIThinking)}</strong>
            <div className="actions">
              {friendRoom ? (
                <>
                  <button onClick={() => void copyRoomLink()} disabled={isRoomBusy}>
                    复制链接
                  </button>
                  <button onClick={leaveFriendRoom}>离开房间</button>
                </>
              ) : (
                <>
                  <button onClick={undo} disabled={gameState.moveHistory.length === 0 || isAIThinking}>
                    悔棋
                  </button>
                  <button onClick={restart}>重开</button>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showWinOverlay && gameState.winner && (
        <div className="modal-backdrop" onClick={restart}>
          <section className="mode-dialog win-dialog">
            <h2>{gameState.winner === "red" ? "红方胜利" : "黑方胜利"}</h2>
            <p>共 {Math.ceil(gameState.moveHistory.length / 2)} 回合</p>
            <button className="primary-button" onClick={restart}>
              再来一局
            </button>
          </section>
        </div>
      )}

      {!gameMode && !friendRoom && (
        <GameModeSelector onSelectMode={chooseMode} onStartFriendPlay={() => void startFriendPlay()} />
      )}
    </main>
  );
}

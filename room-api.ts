import { createInitialGameState, GameState, Position } from "./chess-engine";

export type RoomSide = "red" | "black";

export interface RoomSnapshot {
  code: string;
  createdAt: number;
  updatedAt: number;
  revision: number;
  side: RoomSide | null;
  players: { red: boolean; black: boolean };
  state: GameState & { lastMove?: { from: Position; to: Position; captured?: unknown; startedAt?: number } | null };
}

export interface RoomSession {
  code: string;
  token: string;
  side: RoomSide;
  revision: number;
  shareUrl: string;
}

interface ApiResponse<T> {
  ok: boolean;
  error?: string;
  token?: string;
  side?: RoomSide;
  finished?: boolean;
  room?: RoomSnapshot;
  state?: RoomSnapshot["state"];
  tokenSide?: RoomSide | null;
}

const API_ROOT = `${import.meta.env.BASE_URL}api`;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `request_failed_${response.status}`);
  }

  return data as T;
}

export function makeRoomShareUrl(code: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("room", code);
  url.searchParams.delete("token");
  return url.toString();
}

export function getStoredRoomToken(code: string): string | null {
  return window.localStorage.getItem(`chinese-chess-room-token:${code}`);
}

export function setStoredRoomToken(code: string, token: string): void {
  window.localStorage.setItem(`chinese-chess-room-token:${code}`, token);
}

export function normalizeRoomState(state: RoomSnapshot["state"] | undefined): GameState {
  const base = createInitialGameState();
  if (!state) return base;

  return {
    ...base,
    board: Array.isArray(state.board) ? state.board : base.board,
    currentTurn: state.currentTurn === "black" ? "black" : "red",
    selectedPos: null,
    validMoves: [],
    isCheck: Boolean(state.isCheck),
    isCheckmate: Boolean(state.isCheckmate),
    winner: state.winner === "red" || state.winner === "black" ? state.winner : null,
    moveHistory: Array.isArray(state.moveHistory) ? state.moveHistory : [],
    capturedPieces: {
      red: Array.isArray(state.capturedPieces?.red) ? state.capturedPieces.red : [],
      black: Array.isArray(state.capturedPieces?.black) ? state.capturedPieces.black : [],
    },
    positionCounts:
      state.positionCounts && typeof state.positionCounts === "object"
        ? state.positionCounts
        : base.positionCounts,
  };
}

export async function createRoom(): Promise<{ session: RoomSession; state: GameState; lastMove: RoomSnapshot["state"]["lastMove"] }> {
  const response = await requestJson<ApiResponse<unknown>>("/rooms/create", { method: "POST" });
  if (!response.room || !response.token || !response.side || !response.state) {
    throw new Error("bad_room_response");
  }

  const session: RoomSession = {
    code: response.room.code,
    token: response.token,
    side: response.side,
    revision: response.room.revision,
    shareUrl: makeRoomShareUrl(response.room.code),
  };

  return {
    session,
    state: normalizeRoomState(response.state),
    lastMove: response.state.lastMove ?? null,
  };
}

export async function joinRoom(code: string, token?: string | null): Promise<{ session: RoomSession; state: GameState; lastMove: RoomSnapshot["state"]["lastMove"] }> {
  const response = await requestJson<ApiResponse<unknown>>("/rooms/join", {
    method: "POST",
    body: JSON.stringify({ code, token: token || null }),
  });

  if (!response.room || !response.token || !response.side || !response.state) {
    throw new Error("bad_room_response");
  }

  const session: RoomSession = {
    code: response.room.code,
    token: response.token,
    side: response.side,
    revision: response.room.revision,
    shareUrl: makeRoomShareUrl(response.room.code),
  };

  return {
    session,
    state: normalizeRoomState(response.state),
    lastMove: response.state.lastMove ?? null,
  };
}

export async function fetchRoomState(code: string, token: string): Promise<{ session: RoomSession; state: GameState; lastMove: RoomSnapshot["state"]["lastMove"] }> {
  const response = await requestJson<ApiResponse<unknown>>(`/rooms/${encodeURIComponent(code)}/state?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });

  if (!response.room || !response.state) {
    throw new Error("bad_room_response");
  }

  const side = response.tokenSide;
  if (!side) {
    throw new Error("unauthorized");
  }

  const session: RoomSession = {
    code: response.room.code,
    token,
    side,
    revision: response.room.revision,
    shareUrl: makeRoomShareUrl(response.room.code),
  };

  return {
    session,
    state: normalizeRoomState(response.state),
    lastMove: response.state.lastMove ?? null,
  };
}

export async function sendRoomMove(
  code: string,
  token: string,
  from: Position,
  to: Position
): Promise<{ session: RoomSession; state: GameState; lastMove: RoomSnapshot["state"]["lastMove"]; finished: boolean }> {
  const response = await requestJson<ApiResponse<unknown>>(`/rooms/${encodeURIComponent(code)}/move`, {
    method: "POST",
    body: JSON.stringify({ token, from, to }),
  });

  if (!response.room || !response.state || !response.side) {
    throw new Error("bad_room_response");
  }

  const session: RoomSession = {
    code: response.room.code,
    token,
    side: response.side,
    revision: response.room.revision,
    shareUrl: makeRoomShareUrl(response.room.code),
  };

  return {
    session,
    state: normalizeRoomState(response.state),
    lastMove: response.state.lastMove ?? null,
    finished: Boolean(response.finished),
  };
}

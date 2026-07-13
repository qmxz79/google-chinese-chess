const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = "/home/qmxz/chinese-chess-data";
const resultFile = path.join(dataDir, "game-results.jsonl");
const roomFile = path.join(dataDir, "rooms.json");
fs.mkdirSync(dataDir, { recursive: true });

function send(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(body);
}

function readJsonFile(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function randomCode() {
  return `FR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function randomToken() {
  return crypto.randomBytes(16).toString("hex");
}

function createInitialBoard() {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const place = (row, col, type, side, id) => {
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

function isInBounds(row, col) {
  return row >= 0 && row <= 9 && col >= 0 && col <= 8;
}

function isInPalace(row, col, side) {
  return col >= 3 && col <= 5 && (side === "red" ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
}

function isRedSide(row) {
  return row >= 5;
}

function findKing(board, side) {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.type === "K" && piece.side === side) return { row, col };
    }
  }
  return null;
}

function getRawMoves(board, pos) {
  const piece = board[pos.row] && board[pos.row][pos.col];
  if (!piece) return [];

  const moves = [];
  const { row, col } = pos;
  const add = (nextRow, nextCol) => {
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
        if (board[row + lr] && board[row + lr][col + lc]) return;
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

function applyMove(board, from, to) {
  const nextBoard = board.map((line) => line.slice());
  nextBoard[to.row][to.col] = nextBoard[from.row][from.col];
  nextBoard[from.row][from.col] = null;
  return nextBoard;
}

function kingsFace(board) {
  const redKing = findKing(board, "red");
  const blackKing = findKing(board, "black");
  if (!redKing || !blackKing || redKing.col !== blackKing.col) return false;
  for (let row = blackKing.row + 1; row < redKing.row; row++) {
    if (board[row][redKing.col]) return false;
  }
  return true;
}

function isInCheck(board, side) {
  const king = findKing(board, side);
  if (!king) return true;
  if (kingsFace(board)) return true;
  const enemy = side === "red" ? "black" : "red";
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (!piece || piece.side !== enemy) continue;
      if (getRawMoves(board, { row, col }).some((move) => move.row === king.row && move.col === king.col)) return true;
    }
  }
  return false;
}

function boardSignature(board, currentTurn) {
  return [
    currentTurn,
    ...board.map((row) => row.map((piece) => (piece ? `${piece.side[0]}${piece.type}` : ".")).join("")),
  ].join("|");
}

function createInitialState() {
  const board = createInitialBoard();
  const signature = boardSignature(board, "red");
  return {
    board,
    currentTurn: "red",
    selectedPos: null,
    validMoves: [],
    isCheck: false,
    isCheckmate: false,
    winner: null,
    moveHistory: [],
    lastMove: null,
    capturedPieces: { red: [], black: [] },
    positionCounts: { [signature]: 1 },
  };
}

function wouldRepeatCheckViolation(state, from, to) {
  const piece = state.board[from.row] && state.board[from.row][from.col];
  if (!piece) return false;

  const nextBoard = applyMove(state.board, from, to);
  const nextTurn = state.currentTurn === "red" ? "black" : "red";
  if (!isInCheck(nextBoard, nextTurn)) return false;

  const signature = boardSignature(nextBoard, nextTurn);
  const seenCount = state.positionCounts && state.positionCounts[signature] ? state.positionCounts[signature] : 0;
  return seenCount >= 3;
}

function getValidMoves(board, pos) {
  const piece = board[pos.row] && board[pos.row][pos.col];
  if (!piece) return [];
  return getRawMoves(board, pos).filter((to) => !isInCheck(applyMove(board, pos, to), piece.side));
}

function getValidMovesForState(state, pos) {
  return getValidMoves(state.board, pos).filter((to) => !wouldRepeatCheckViolation(state, pos, to));
}

function isCheckmate(board, side) {
  if (!isInCheck(board, side)) return false;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.side === side && getValidMoves(board, { row, col }).length > 0) return false;
    }
  }
  return true;
}

function makeMove(state, from, to) {
  const piece = state.board[from.row] && state.board[from.row][from.col];
  if (!piece) return state;
  const legal = getValidMovesForState(state, from).some((move) => move.row === to.row && move.col === to.col);
  if (!legal) return state;
  if (wouldRepeatCheckViolation(state, from, to)) return state;

  const captured = state.board[to.row][to.col] || null;
  const board = applyMove(state.board, from, to);
  const currentTurn = state.currentTurn === "red" ? "black" : "red";
  const check = isInCheck(board, currentTurn);
  const mate = isCheckmate(board, currentTurn);
  const capturedPieces = {
    red: state.capturedPieces.red.slice(),
    black: state.capturedPieces.black.slice(),
  };
  if (captured) capturedPieces[captured.side].push(captured);

  const signature = boardSignature(board, currentTurn);
  const positionCounts = {
    ...(state.positionCounts || {}),
    [signature]: ((state.positionCounts && state.positionCounts[signature]) || 0) + 1,
  };

  return {
    board,
    currentTurn,
    selectedPos: null,
    validMoves: [],
    isCheck: check,
    isCheckmate: mate,
    winner: mate ? state.currentTurn : null,
    moveHistory: state.moveHistory.concat([{ from, to, captured }]),
    lastMove: { from, to, captured, startedAt: Date.now() },
    capturedPieces,
    positionCounts,
  };
}

function normalizeState(state) {
  const base = createInitialState();
  if (!state || typeof state !== "object") return base;
  return {
    board: Array.isArray(state.board) ? state.board : base.board,
    currentTurn: state.currentTurn === "black" ? "black" : "red",
    selectedPos: null,
    validMoves: [],
    isCheck: Boolean(state.isCheck),
    isCheckmate: Boolean(state.isCheckmate),
    winner: state.winner === "red" || state.winner === "black" ? state.winner : null,
    moveHistory: Array.isArray(state.moveHistory) ? state.moveHistory : [],
    lastMove: state.lastMove || null,
    capturedPieces: {
      red: Array.isArray(state.capturedPieces && state.capturedPieces.red) ? state.capturedPieces.red : [],
      black: Array.isArray(state.capturedPieces && state.capturedPieces.black) ? state.capturedPieces.black : [],
    },
    positionCounts:
      state.positionCounts && typeof state.positionCounts === "object" ? state.positionCounts : base.positionCounts,
  };
}

function loadRooms() {
  const rooms = readJsonFile(roomFile, {});
  for (const [code, room] of Object.entries(rooms)) {
    room.code = room.code || code;
    room.createdAt = Number(room.createdAt || Date.now());
    room.updatedAt = Number(room.updatedAt || room.createdAt);
    room.revision = Number(room.revision || 0);
    room.players = room.players || {};
    room.players.red = room.players.red || null;
    room.players.black = room.players.black || null;
    room.state = normalizeState(room.state);
    room.resultRecorded = Boolean(room.resultRecorded);
  }
  return rooms;
}

function saveRooms(rooms) {
  writeJsonFile(roomFile, rooms);
}

function findSideByToken(room, token) {
  if (!token) return null;
  if (room.players.red && room.players.red.token === token) return "red";
  if (room.players.black && room.players.black.token === token) return "black";
  return null;
}

function snapshotRoom(room, token) {
  const side = findSideByToken(room, token);
  return {
    code: room.code,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    revision: room.revision,
    side,
    players: {
      red: Boolean(room.players.red),
      black: Boolean(room.players.black),
    },
    state: room.state,
  };
}

function appendGameResult(room) {
  if (!room.state.winner || room.resultRecorded) return;
  const record = {
    receivedAt: new Date().toISOString(),
    game: "chinese-chess",
    platform: "wechat-minigame",
    mode: "friend",
    winner: room.state.winner,
    moves: room.state.moveHistory.length,
    endedAt: Date.now(),
    roomCode: room.code,
  };
  fs.appendFileSync(resultFile, `${JSON.stringify(record)}\n`);
  room.resultRecorded = true;
}

function createRoom() {
  const rooms = loadRooms();
  let code = randomCode();
  while (rooms[code]) code = randomCode();
  const token = randomToken();
  const room = {
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: 0,
    players: {
      red: { token, joinedAt: Date.now() },
      black: null,
    },
    state: createInitialState(),
    resultRecorded: false,
  };
  rooms[code] = room;
  saveRooms(rooms);
  return { room, token, side: "red" };
}

function joinRoom(code, token) {
  const rooms = loadRooms();
  const room = rooms[code];
  if (!room) return { error: "room_not_found", code: 404 };

  const existingSide = findSideByToken(room, token);
  if (existingSide) {
    room.updatedAt = Date.now();
    saveRooms(rooms);
    return { room, token, side: existingSide };
  }

  if (!room.players.red) {
    room.players.red = { token: token || randomToken(), joinedAt: Date.now() };
    room.updatedAt = Date.now();
    room.revision += 1;
    saveRooms(rooms);
    return { room, token: room.players.red.token, side: "red" };
  }

  if (!room.players.black) {
    room.players.black = { token: token || randomToken(), joinedAt: Date.now() };
    room.updatedAt = Date.now();
    room.revision += 1;
    saveRooms(rooms);
    return { room, token: room.players.black.token, side: "black" };
  }

  return { error: "room_full", code: 409 };
}

function handleMove(code, token, from, to) {
  const rooms = loadRooms();
  const room = rooms[code];
  if (!room) return { error: "room_not_found", code: 404 };

  const side = findSideByToken(room, token);
  if (!side) return { error: "unauthorized", code: 403 };
  if (room.state.winner) return { room, side, ok: true, finished: true };
  if (room.state.currentTurn !== side) return { error: "not_your_turn", code: 409 };
  if (!from || !to || !isInBounds(from.row, from.col) || !isInBounds(to.row, to.col)) {
    return { error: "bad_move", code: 400 };
  }

  const nextState = makeMove(room.state, from, to);
  if (nextState === room.state) return { error: "illegal_move", code: 400 };

  room.state = nextState;
  room.updatedAt = Date.now();
  room.revision += 1;
  appendGameResult(room);
  rooms[code] = room;
  saveRooms(rooms);
  return { room, side, ok: true };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = url.pathname;

  if (req.method === "OPTIONS") return send(res, 204, {});
  if (pathname === "/health") return send(res, 200, { ok: true });

  if (pathname === "/results/latest" && req.method === "GET") {
    const lines = fs.existsSync(resultFile)
      ? fs.readFileSync(resultFile, "utf8").trim().split("\n").filter(Boolean)
      : [];
    const latest = lines
      .slice(-20)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return send(res, 200, { ok: true, count: lines.length, latest });
  }

  if (pathname === "/stats" && req.method === "GET") {
    const lines = fs.existsSync(resultFile)
      ? fs.readFileSync(resultFile, "utf8").trim().split("\n").filter(Boolean)
      : [];
    const stats = { total: 0, byMode: {}, byWinner: {} };
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        stats.total += 1;
        stats.byMode[item.mode || "unknown"] = (stats.byMode[item.mode || "unknown"] || 0) + 1;
        stats.byWinner[item.winner || "unknown"] = (stats.byWinner[item.winner || "unknown"] || 0) + 1;
      } catch {}
    }
    return send(res, 200, { ok: true, stats });
  }

  if (pathname === "/rooms/create" && req.method === "POST") {
    const { room, token, side } = createRoom();
    return send(res, 200, { ok: true, token, side, room: snapshotRoom(room, token), state: room.state });
  }

  if (pathname === "/rooms/join" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const code = String(data.code || "").trim().toUpperCase();
        const token = String(data.token || "").trim() || null;
        if (!code) return send(res, 400, { ok: false, error: "missing_code" });
        const result = joinRoom(code, token);
        if (result.error) return send(res, result.code, { ok: false, error: result.error });
        return send(res, 200, {
          ok: true,
          token: result.token,
          side: result.side,
          room: snapshotRoom(result.room, result.token),
          state: result.room.state,
        });
      } catch {
        return send(res, 400, { ok: false, error: "bad_json" });
      }
    });
    return;
  }

  const roomStateMatch = pathname.match(/^\/rooms\/([A-Z0-9-]+)\/state$/i);
  if (roomStateMatch && req.method === "GET") {
    const code = roomStateMatch[1].toUpperCase();
    const rooms = loadRooms();
    const room = rooms[code];
    if (!room) return send(res, 404, { ok: false, error: "room_not_found" });
    const token = String(url.searchParams.get("token") || "").trim();
    return send(res, 200, { ok: true, tokenSide: findSideByToken(room, token), room: snapshotRoom(room, token), state: room.state });
  }

  const moveMatch = pathname.match(/^\/rooms\/([A-Z0-9-]+)\/move$/i);
  if (moveMatch && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const code = moveMatch[1].toUpperCase();
        const token = String(data.token || "").trim();
        const result = handleMove(code, token, data.from, data.to);
        if (result.error) return send(res, result.code, { ok: false, error: result.error });
        return send(res, 200, {
          ok: true,
          side: result.side,
          finished: Boolean(result.finished),
          room: snapshotRoom(result.room, token),
          state: result.room.state,
        });
      } catch {
        return send(res, 400, { ok: false, error: "bad_json" });
      }
    });
    return;
  }

  if (pathname === "/game-result" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const record = {
          receivedAt: new Date().toISOString(),
          game: data.game || "chinese-chess",
          platform: data.platform || "wechat-minigame",
          mode: data.mode || "unknown",
          winner: data.winner || null,
          moves: Number(data.moves || 0),
          endedAt: Number(data.endedAt || Date.now()),
        };
        fs.appendFileSync(resultFile, `${JSON.stringify(record)}\n`);
        send(res, 200, { ok: true });
      } catch {
        send(res, 400, { ok: false, error: "bad_json" });
      }
    });
    return;
  }

  return send(res, 404, { error: "not_found" });
});

server.listen(8788, "127.0.0.1");

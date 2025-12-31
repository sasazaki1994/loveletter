import fs from "node:fs";
import path from "node:path";

const ENDPOINT = "http://127.0.0.1:7242/ingest/626d8311-d9b8-4b3a-a814-b7fe6f7c1648";
const sessionId = "debug-session";
const runId = process.env.DEBUG_RUN_ID || "pre-fix";

function post(hypothesisId, location, message, data) {
  // #region agent log
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

const target = path.join(process.cwd(), "components", "lobby", "room-lobby.tsx");
const src = fs.readFileSync(target, "utf8");

const hasSetUserCall = /\bsetUser\s*\(/.test(src);
const hasUserState = /\bconst\s*\[\s*user\s*,\s*setUser\s*\]\s*=\s*useState\b/.test(src);
const hasUserRead = /\buser\b/.test(src);
const userStateMatchIndex = src.search(/\bconst\s*\[\s*user\s*,\s*setUser\s*\]\s*=\s*useState\b/);

post(
  "H1",
  "scripts/debug-scan-room-lobby-user.mjs:scan",
  "RoomLobby user state scan summary",
  { file: "components/lobby/room-lobby.tsx", hasSetUserCall, hasUserState, hasUserRead, userStateMatchIndex }
);

if (hasSetUserCall && !hasUserState) {
  const idx = src.search(/\bsetUser\s*\(/);
  const context = src.slice(Math.max(0, idx - 80), Math.min(src.length, idx + 120));
  post(
    "H1",
    "scripts/debug-scan-room-lobby-user.mjs:missing",
    "setUser() is used but user state is not declared via useState",
    { firstSetUserIndex: idx, context }
  );
}

const setUserDecls = Array.from(src.matchAll(/\b(setUser)\b(?!\s*\()/g)).length;
post(
  "H2",
  "scripts/debug-scan-room-lobby-user.mjs:counts",
  "Identifier occurrence counts (rough)",
  { setUserIdentifierCount: setUserDecls }
);








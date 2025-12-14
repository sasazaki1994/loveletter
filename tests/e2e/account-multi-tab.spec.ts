import { test, expect, waitForGameUI } from "./fixtures";

function randLabel(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function waitForServerStateWithContext(
  request: any,
  roomId: string,
  playerId?: string,
  timeoutMs = 20000,
) {
  const start = Date.now();
  for (;;) {
    const url = new URL("/api/game/state", "http://localhost");
    url.searchParams.set("roomId", roomId);
    if (playerId) url.searchParams.set("playerId", playerId);
    const res = await request.get(url.pathname + url.search);
    if (res.status() === 200) {
      const json = await res.json();
      if (json?.state) return json;
    }
    if (Date.now() - start > timeoutMs) throw new Error("Server state not ready");
    await new Promise((r) => setTimeout(r, 500));
  }
}

test.describe.configure({ mode: "serial" });

test("アカウント + 同一ブラウザ(同一cookie)で2タブ参加→開始→両方UI表示", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext();

  // 1) サインアップ（context.request はcookieを同一browser contextに共有できる）
  const username = randLabel("e2e_user");
  const password = "password_password_123";
  const rSignup = await ctx.request.post("/api/auth/signup", {
    data: { username, password },
  });
  expect(rSignup.ok()).toBeTruthy();

  // 2) ルーム作成（ログイン済みなので playerToken は返らない想定）
  const hostNick = "HostAcct";
  const rCreate = await ctx.request.post("/api/room/create-human", {
    data: { nickname: hostNick },
  });
  expect(rCreate.ok()).toBeTruthy();
  const hostInfo = (await rCreate.json()) as { roomId: string; shortId?: string; playerId: string; playerToken?: string };
  expect(hostInfo.roomId).toBeTruthy();
  expect(hostInfo.playerId).toBeTruthy();
  expect(hostInfo.playerToken).toBeFalsy();

  // 3) 同一contextで別プレイヤーとして参加
  const guestNick = "GuestAcct";
  const rJoin = await ctx.request.post("/api/room/join", {
    data: { roomId: hostInfo.shortId ?? hostInfo.roomId, nickname: guestNick },
  });
  expect(rJoin.ok()).toBeTruthy();
  const guestInfo = (await rJoin.json()) as { roomId: string; playerId: string; playerToken?: string };
  expect(guestInfo.playerId).toBeTruthy();
  expect(guestInfo.playerToken).toBeFalsy();

  // 4) 2タブ（同一cookie）にそれぞれ sessionStorage を注入してゲームページへ
  const pageA = await ctx.newPage();
  await pageA.addInitScript(([roomId, playerId, nickname]) => {
    window.sessionStorage.setItem("llr:session", JSON.stringify({ roomId, playerId, nickname }));
  }, [hostInfo.roomId, hostInfo.playerId, hostNick]);
  await pageA.goto(`${baseURL}/game/${hostInfo.roomId}`);

  const pageB = await ctx.newPage();
  await pageB.addInitScript(([roomId, playerId, nickname]) => {
    window.sessionStorage.setItem("llr:session", JSON.stringify({ roomId, playerId, nickname }));
  }, [guestInfo.roomId, guestInfo.playerId, guestNick]);
  await pageB.goto(`${baseURL}/game/${hostInfo.roomId}`);

  // 5) ホスト開始（account mode: cookieで所有確認、X-Player-Id必須）
  const rStart = await ctx.request.post("/api/room/start", {
    headers: {
      "Content-Type": "application/json",
      "X-Player-Id": hostInfo.playerId,
    },
    data: { roomId: hostInfo.roomId },
  });
  expect(rStart.ok()).toBeTruthy();

  // 6) 両方の視点で state が取得でき、ゲームUIが表示される
  const sHost = await waitForServerStateWithContext(ctx.request, hostInfo.roomId, hostInfo.playerId, 20000);
  expect(sHost?.state?.id).toBeTruthy();

  const sGuest = await waitForServerStateWithContext(ctx.request, hostInfo.roomId, guestInfo.playerId, 20000);
  expect(sGuest?.state?.id).toBeTruthy();

  await waitForGameUI(pageA, 20000);
  await waitForGameUI(pageB, 20000);

  // 7) アクションが通る（token無し・cookie所有で認可されること）
  const gameId = sHost.state.id as string;
  const rAction = await ctx.request.post("/api/game/action", {
    headers: {
      "Content-Type": "application/json",
      "X-Player-Id": hostInfo.playerId,
    },
    data: {
      gameId,
      roomId: hostInfo.roomId,
      playerId: hostInfo.playerId,
      type: "resign",
    },
  });
  expect(rAction.ok()).toBeTruthy();

  await ctx.close();
});



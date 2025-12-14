import { test, expect, waitForGameUI, waitForServerState } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("2人対戦: 参加→開始→双方同期", async ({ browser, request, baseURL }) => {
  // 1) ホスト作成（API）
  const resCreate = await request.post("/api/room/create-human", {
    data: { nickname: "HostE2E" },
  });
  const hostInfo = await resCreate.json();
  expect(resCreate.ok()).toBeTruthy();

  // 2) 参加者ジョイン（API）
  const resJoin = await request.post("/api/room/join", {
    data: { roomId: hostInfo.shortId ?? hostInfo.roomId, nickname: "GuestE2E" },
  });
  const guestInfo = await resJoin.json();
  expect(resJoin.ok()).toBeTruthy();

  // 3) ホストがゲーム開始（API）
  const resStart = await request.post("/api/room/start", {
    headers: {
      "X-Player-Id": hostInfo.playerId,
      "X-Player-Token": hostInfo.playerToken,
      "Content-Type": "application/json",
    },
    data: { roomId: hostInfo.roomId },
  });
  expect(resStart.ok()).toBeTruthy();

  // 4) 2ブラウザで同一ルームへ遷移
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await pageA.addInitScript(([roomId, playerId, nickname, token, shortId]) => {
    window.sessionStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }),
    );
  }, [hostInfo.roomId, hostInfo.playerId, "HostE2E", hostInfo.playerToken, hostInfo.shortId]);
  await pageA.goto(`${baseURL}/game/${hostInfo.roomId}`);
  // Fallback: セッション未検出なら後から注入してリロード
  if (await pageA.getByText('セッション未検出').isVisible().catch(() => false)) {
    await pageA.evaluate(([roomId, playerId, nickname, token, shortId]) => {
      sessionStorage.setItem('llr:session', JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }));
    }, [hostInfo.roomId, hostInfo.playerId, 'HostE2E', hostInfo.playerToken, hostInfo.shortId]);
    await pageA.reload();
  }
  await waitForServerState(request, hostInfo.roomId, { id: hostInfo.playerId, token: hostInfo.playerToken }, 20000);

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.addInitScript(([roomId, playerId, nickname, token, shortId]) => {
    window.sessionStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }),
    );
  }, [guestInfo.roomId, guestInfo.playerId, "GuestE2E", guestInfo.playerToken, guestInfo.shortId]);
  await pageB.goto(`${baseURL}/game/${hostInfo.roomId}`);
  if (await pageB.getByText('セッション未検出').isVisible().catch(() => false)) {
    await pageB.evaluate(([roomId, playerId, nickname, token, shortId]) => {
      sessionStorage.setItem('llr:session', JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }));
    }, [guestInfo.roomId, guestInfo.playerId, 'GuestE2E', guestInfo.playerToken, guestInfo.shortId]);
    await pageB.reload();
  }
  await waitForServerState(request, hostInfo.roomId, { id: guestInfo.playerId, token: guestInfo.playerToken }, 20000);

  // 5) 最低限、URLが正しく遷移している
  await expect(pageA).toHaveURL(new RegExp(`/game/${hostInfo.roomId}$`));
  await expect(pageB).toHaveURL(new RegExp(`/game/${hostInfo.roomId}$`));

  // 初手はSeat0(ホスト)のはず（サーバ状態で検証）
  const s = await waitForServerState(request, hostInfo.roomId, { id: hostInfo.playerId, token: hostInfo.playerToken }, 20000);
  expect(s?.state?.activePlayerId).toBe(hostInfo.playerId);

  await ctxA.close();
  await ctxB.close();
});



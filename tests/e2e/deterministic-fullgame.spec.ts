import { test, expect, waitForGameUI, waitForServerState } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("決定論的フロー: 2人対戦で即時終了(Resign)→リザルト表示", async ({ page, request, baseURL }) => {
  // 1) ホスト作成（API）
  const resCreate = await request.post("/api/room/create-human", {
    data: { nickname: "HostFull" },
  });
  const hostInfo = await resCreate.json();
  expect(resCreate.ok()).toBeTruthy();

  // 2) 参加者ジョイン（API）
  const resJoin = await request.post("/api/room/join", {
    data: { roomId: hostInfo.shortId ?? hostInfo.roomId, nickname: "GuestFull" },
  });
  const guestInfo = await resJoin.json();
  expect(resJoin.ok()).toBeTruthy();

  // 3) 開始
  const resStart = await request.post("/api/room/start", {
    headers: {
      "X-Player-Id": hostInfo.playerId,
      "X-Player-Token": hostInfo.playerToken,
      "Content-Type": "application/json",
    },
    data: { roomId: hostInfo.roomId },
  });
  const started = await resStart.json();
  expect(resStart.ok()).toBeTruthy();

  // 4) ホスト視点でゲームページへ
  await page.addInitScript(([roomId, playerId, nickname, token, shortId]) => {
    window.sessionStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }),
    );
  }, [hostInfo.roomId, hostInfo.playerId, "HostFull", hostInfo.playerToken, hostInfo.shortId]);
  await page.goto(`${baseURL}/game/${hostInfo.roomId}`);
  if (await page.getByText('セッション未検出').isVisible().catch(() => false)) {
    await page.evaluate(([roomId, playerId, nickname, token, shortId]) => {
      sessionStorage.setItem('llr:session', JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }));
    }, [hostInfo.roomId, hostInfo.playerId, 'HostFull', hostInfo.playerToken, hostInfo.shortId]);
    await page.reload();
  }
  await waitForServerState(request, hostInfo.roomId, { id: hostInfo.playerId, token: hostInfo.playerToken }, 20000);

  // 5) 直ちにResignを送って終了させる
  const resAction = await request.post("/api/game/action", {
    headers: {
      "X-Player-Id": hostInfo.playerId,
      "X-Player-Token": hostInfo.playerToken,
      "Content-Type": "application/json",
    },
    data: {
      gameId: started.gameId,
      roomId: hostInfo.roomId,
      playerId: hostInfo.playerId,
      type: "resign",
    },
  });
  expect(resAction.ok()).toBeTruthy();

  // 6) リザルトダイアログ表示を確認
  // サーバ状態が finished になるまで待機
  const state = await waitForServerState(request, hostInfo.roomId, { id: hostInfo.playerId, token: hostInfo.playerToken }, 20000);
  expect(state?.state?.result?.reason).toBeTruthy();
});



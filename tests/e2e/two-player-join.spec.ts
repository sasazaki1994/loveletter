import { test, expect } from "./fixtures";

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
    window.localStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }),
    );
  }, [hostInfo.roomId, hostInfo.playerId, "HostE2E", hostInfo.playerToken, hostInfo.shortId]);
  await pageA.goto(`${baseURL}/game/${hostInfo.roomId}`);

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.addInitScript(([roomId, playerId, nickname, token, shortId]) => {
    window.localStorage.setItem(
      "llr:session",
      JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }),
    );
  }, [guestInfo.roomId, guestInfo.playerId, "GuestE2E", guestInfo.playerToken, guestInfo.shortId]);
  await pageB.goto(`${baseURL}/game/${hostInfo.roomId}`);

  // 5) 双方でターンバナー/フェーズが表示される
  await expect(pageA.getByText(/の手番|待機中/)).toBeVisible({ timeout: 15000 });
  await expect(pageB.getByText(/の手番|待機中/)).toBeVisible({ timeout: 15000 });

  // 初手はSeat0(ホスト)のはず → 双方で同じアクティブプレイヤー名が見える
  await expect(pageA.getByText(/HostE2E の手番/)).toBeVisible();
  await expect(pageB.getByText(/HostE2E の手番/)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});



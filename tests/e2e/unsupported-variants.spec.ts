import { test, expect, createBotRoomViaAPI, fetchStateForPlayer } from './fixtures';

test('unsupported variants are hidden in UI and ignored by API', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText(/Insight/i)).toHaveCount(0);
  await expect(page.getByText(/Standoff/i)).toHaveCount(0);
  await expect(page.getByText(/Ambush/i)).toHaveCount(0);

  const created = await createBotRoomViaAPI(request, `V_${Date.now()}`, {
    variants: ['insight', 'standoff', 'ambush'],
  });
  const state = await fetchStateForPlayer(request, created.roomId, created.playerId);
  const visible = [...(state.hand ?? []), ...(state.discardPile ?? []), ...(state.revealedSetupCards ?? [])];
  expect(visible).not.toContain('insight');
  expect(visible).not.toContain('standoff');
  expect(visible).not.toContain('ambush');
});

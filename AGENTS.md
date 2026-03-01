## Cursor Cloud specific instructions

### Overview

Love Letter Reverie — Next.js 14 (App Router) + PostgreSQL のブラウザ対応マルチプレイヤーカードゲーム。
フロント・バックエンドが単一 Next.js プロセスで動作し、SSE + HTTP ポーリングでリアルタイム同期。

### Services

| Service | Required | Notes |
|---------|----------|-------|
| PostgreSQL 16 | Yes | `DATABASE_URL` を `.env` / `.env.local` に設定 |
| Next.js dev server | Yes | `pnpm dev` (port 3000) |

### Key commands

See `package.json` scripts for the full list. Highlights:

- **Lint**: `pnpm lint`
- **Typecheck**: `pnpm typecheck`
- **Build**: `pnpm build`
- **Dev server**: `pnpm dev`
- **DB push**: `pnpm db:push` (reads `DATABASE_URL` from `.env` via `dotenv/config`)
- **E2E tests**: `pnpm e2e:test` (requires Playwright chromium: `npx playwright install chromium --with-deps`)
- **Monkey tests**: `pnpm monkey:test`

### Gotchas

- `drizzle.config.ts` uses `import "dotenv/config"` which loads `.env` (not `.env.local`). When running `pnpm db:push` / `db:migrate` / `db:generate`, ensure `DATABASE_URL` is in `.env` or exported in the shell.
- Next.js itself reads `.env.local`, so both `.env` and `.env.local` may be needed, or export the var in the shell.
- pnpm 10.20.0 may warn about ignored build scripts for `esbuild` and `unrs-resolver`. Next.js works despite this warning (uses fallback); if native speed is needed, add `pnpm.onlyBuiltDependencies` to `package.json`.
- E2E tests use port 3100 (configured in `playwright.config.ts`). The dev server for manual testing uses port 3000.
- Local PostgreSQL connection uses `ssl: false` automatically when the URL does not contain `.neon.`.

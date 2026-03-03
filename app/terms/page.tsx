import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/ads/cookie-settings-button";

export const metadata: Metadata = {
  title: "利用規約 | Love Letter Reverie",
  description: "Love Letter Reverie の利用規約",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--color-text)]">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">利用規約</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">最終更新日: 2026-03-03</p>
      </div>

      <section className="space-y-4">
        <p className="leading-relaxed text-[var(--color-text-muted)]">
          本規約は、本サービス「Love Letter Reverie」（以下「本サービス」）の利用条件を定めるものです。
          本サービスを利用することにより、利用者は本規約に同意したものとみなします。
        </p>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">1. サービス内容</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本サービスは、ブラウザ上で動作するカードゲームを提供します。運営者は、事前の通知なく
            サービス内容の変更、追加、または停止を行う場合があります。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">2. アカウント</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>利用者はアカウント情報を自己の責任で管理するものとします。</li>
            <li>アカウントの不正使用により生じた損害について、運営者は一切の責任を負いません。</li>
            <li>運営者は、不正利用が疑われるアカウントを停止・削除することがあります。</li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">3. 禁止事項</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>不正な手段によるゲームへの介入やチート行為</li>
            <li>他の利用者への妨害・迷惑行為</li>
            <li>サーバーに過度の負荷をかける行為</li>
            <li>本サービスの逆コンパイル・リバースエンジニアリング</li>
            <li>法令または公序良俗に反する行為</li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">4. 広告の表示</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本サービスでは、第三者配信の広告サービスを利用する場合があります。
            広告の表示にあたり、Cookie 等を使用して利用者の情報を取得する場合があります。
            詳細は
            <Link className="mx-1 underline underline-offset-2" href="/privacy">
              プライバシーポリシー
            </Link>
            をご確認ください。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">5. 知的財産権</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本サービスに関するすべてのコンテンツ（テキスト、画像、ソースコード等）の知的財産権は、
            運営者または正当な権利者に帰属します。無断転載・複製を禁じます。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">6. 免責事項</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>本サービスは「現状のまま」提供されます。運営者は、サービスの完全性、正確性、安全性について保証しません。</li>
            <li>本サービスの利用により生じた損害について、運営者は法令で許容される範囲で一切の責任を負いません。</li>
            <li>サーバー障害、メンテナンス等による一時的なサービス停止については免責とします。</li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">7. 規約の変更</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            運営者は、必要に応じて本規約を変更することがあります。変更後の規約は、
            本ページに掲載した時点で効力を生じるものとします。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">8. お問い合わせ</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本規約に関するお問い合わせは、以下の連絡先にて受け付けます。
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            メール:{" "}
            <a
              className="underline underline-offset-2"
              href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@example.com"}`}
            >
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@example.com"}
            </a>
          </p>
        </div>

        <div className="flex gap-4 pt-2 text-sm text-[var(--color-text-muted)]">
          <Link className="underline underline-offset-2" href="/privacy">
            プライバシーポリシー
          </Link>
          <Link className="underline underline-offset-2" href="/">
            トップに戻る
          </Link>
          <CookieSettingsButton />
        </div>
      </section>
    </main>
  );
}

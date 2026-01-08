import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Love Letter Reverie",
  description: "Love Letter Reverie のプライバシーポリシー",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--color-text)]">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">プライバシーポリシー</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">最終更新日: 2026-01-08</p>
      </div>

      <section className="space-y-4">
        <p className="leading-relaxed text-[var(--color-text-muted)]">
          本アプリ（「Love Letter Reverie」）は、サービス提供・改善および広告配信のために、利用者の情報を取り扱います。
          本ページは、その方針を説明するものです。
        </p>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">1. 収集する情報</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>
              <span className="text-[var(--color-text)]">アカウント/識別情報</span>
              : ログイン等の機能を提供する場合、ユーザーID、セッション識別子等。
            </li>
            <li>
              <span className="text-[var(--color-text)]">利用状況</span>: ページ閲覧、操作履歴、エラー情報、端末/ブラウザ情報、IPアドレス等。
            </li>
            <li>
              <span className="text-[var(--color-text)]">Cookie 等</span>: セッション維持、不正防止、広告配信/計測のための Cookie または類似技術。
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">2. 利用目的</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>本サービスの提供、維持、保護、改善</li>
            <li>不正利用の検知・防止、セキュリティ確保</li>
            <li>広告の配信、配信結果の測定および最適化</li>
            <li>お問い合わせ対応</li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">3. 広告配信（Google AdSense）について</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            当サイトは第三者配信の広告サービス（Google AdSense）を利用することがあります。Google を含む第三者配信事業者は、
            Cookie 等を使用して、利用者のアクセス情報に基づき広告を配信する場合があります。
          </p>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            Google による広告での Cookie の取り扱いについては、Google のポリシーをご確認ください。
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>
              Google の広告に関するポリシー:{" "}
              <a
                className="underline underline-offset-2"
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noreferrer"
              >
                policies.google.com/technologies/ads
              </a>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">4. Cookie の管理</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            利用者はブラウザ設定により Cookie を無効化できます。ただし、Cookie を無効化した場合、
            一部機能（ログイン維持等）が利用できないことがあります。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">5. 第三者提供</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。なお、広告配信・計測等のために
            第三者のサービスを利用する場合があり、その範囲で情報が処理されることがあります。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">6. お問い合わせ</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本ポリシーに関するお問い合わせは、運営者の連絡手段（フォーム/メール等）にて受け付けます。
            現時点で窓口が未整備の場合は、公開時に追記してください。
          </p>
        </div>

        <div className="pt-2 text-sm text-[var(--color-text-muted)]">
          <Link className="underline underline-offset-2" href="/">
            トップに戻る
          </Link>
        </div>
      </section>
    </main>
  );
}


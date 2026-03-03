import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Love Letter Reverie",
  description: "Love Letter Reverie のプライバシーポリシー",
};

export default function PrivacyPolicyPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@example.com";

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--color-text)]">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">プライバシーポリシー</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">最終更新日: 2026-03-03</p>
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
          <h2 className="font-heading text-xl font-semibold">3. データ処理の法的根拠</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            EU 一般データ保護規則（GDPR）その他の適用法令に基づき、以下の法的根拠に基づいてデータを処理します。
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>
              <span className="text-[var(--color-text)]">同意</span>
              : 広告配信用 Cookie の使用については、利用者の明示的な同意に基づきます。
            </li>
            <li>
              <span className="text-[var(--color-text)]">正当な利益</span>
              : サービスの提供・改善、セキュリティ確保のために必要な最小限のデータ処理。
            </li>
            <li>
              <span className="text-[var(--color-text)]">契約の履行</span>
              : アカウント管理やゲームプレイの提供に必要なデータ処理。
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">4. Cookie の種類と目的</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本サービスでは、以下の種類の Cookie を使用します。
          </p>
          <div className="mt-3 space-y-3">
            <div className="rounded-md bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">必須 Cookie（常時有効）</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                セッション維持（ログイン状態の保持）、プレイヤー識別、セキュリティ（CSRF防止等）に使用します。
                これらはサービスの基本機能に不可欠であり、無効化するとサービスを正常に利用できなくなる場合があります。
              </p>
            </div>
            <div className="rounded-md bg-[rgba(255,255,255,0.03)] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">広告 Cookie（同意が必要）</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Google AdSense 等の第三者広告サービスが、利用者の関心に基づいた広告を配信するために使用します。
                これらの Cookie は、利用者が Cookie 同意バナーで「同意する」を選択した場合にのみ有効になります。
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">5. 広告配信（Google AdSense）について</h2>
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
                rel="noopener noreferrer"
              >
                policies.google.com/technologies/ads
              </a>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">6. Cookie の管理とオプトアウト</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            利用者は以下の方法で Cookie の使用を管理できます。
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>
              <span className="text-[var(--color-text)]">Cookie 同意バナー</span>
              : 初回訪問時に表示されるバナーで「必須のみ」を選択すると、広告 Cookie を無効化できます。
            </li>
            <li>
              <span className="text-[var(--color-text)]">ブラウザ設定</span>
              : ブラウザの設定画面から Cookie を無効化・削除できます。ただし、必須 Cookie を無効化すると
              一部機能（ログイン維持等）が利用できなくなる場合があります。
            </li>
            <li>
              <span className="text-[var(--color-text)]">Google 広告設定</span>
              : Google のパーソナライズ広告をオプトアウトするには、以下のページを利用してください。
              <br />
              <a
                className="underline underline-offset-2"
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                adssettings.google.com
              </a>
            </li>
            <li>
              <span className="text-[var(--color-text)]">NAI オプトアウト</span>
              : Network Advertising Initiative のオプトアウトページ:
              <br />
              <a
                className="underline underline-offset-2"
                href="https://optout.networkadvertising.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                optout.networkadvertising.org
              </a>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">7. データの保持期間</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>
              <span className="text-[var(--color-text)]">セッション情報</span>
              : ゲームルームの有効期間中（最大60分の無操作で自動削除）。
            </li>
            <li>
              <span className="text-[var(--color-text)]">アカウント情報</span>
              : アカウント削除の申請を受領するまで保持します。
            </li>
            <li>
              <span className="text-[var(--color-text)]">広告関連データ</span>
              : Google AdSense が管理するデータの保持期間は、Google のポリシーに準じます。
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">8. 第三者提供</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。なお、広告配信・計測等のために
            第三者のサービスを利用する場合があり、その範囲で情報が処理されることがあります。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">9. 利用者の権利</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            GDPR その他の適用法令に基づき、利用者は以下の権利を有します。
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--color-text-muted)]">
            <li>自己の個人データへのアクセス権</li>
            <li>個人データの訂正・削除を求める権利</li>
            <li>データ処理の制限を求める権利</li>
            <li>データポータビリティの権利</li>
            <li>同意の撤回（広告 Cookie は Cookie 同意バナーで随時変更可能）</li>
          </ul>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            これらの権利を行使する場合は、下記のお問い合わせ先までご連絡ください。
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <h2 className="font-heading text-xl font-semibold">10. お問い合わせ</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-text-muted)]">
            本ポリシーに関するお問い合わせ、データに関する権利の行使は、以下の連絡先にて受け付けます。
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            メール:{" "}
            <a
              className="underline underline-offset-2"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
          </p>
        </div>

        <div className="flex gap-4 pt-2 text-sm text-[var(--color-text-muted)]">
          <Link className="underline underline-offset-2" href="/terms">
            利用規約
          </Link>
          <Link className="underline underline-offset-2" href="/">
            トップに戻る
          </Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import QRCode from "qrcode";
import { PrintButton } from "@/features/sites/print-button";
import { organizationLoginCode } from "@/features/workers/login-code";
import { WORKER_DAILY_STEPS, workerLoginUrl } from "@/features/workers/worker-invite";
import { requireSiteAdmin } from "@/lib/authz-guard";
import { getAppUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/** 作業員に渡す A4 1枚の案内。QR を読んで合言葉を入れれば始められる。 */
export default async function WorkerGuidePrintPage() {
  const workspace = await requireSiteAdmin();
  const loginCode = await organizationLoginCode(workspace.organizationId);

  if (!loginCode) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <p className="text-lg">先に、設定で「作業員ログインの合言葉」を決めてください。会社コードはそのときに作られます。</p>
        <Link href="/settings#passcode" className="text-lg font-bold underline">
          設定を開く
        </Link>
      </div>
    );
  }

  const loginUrl = workerLoginUrl(getAppUrl(), loginCode);
  const qrSvg = await QRCode.toString(loginUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="min-h-dvh bg-white text-gray-950">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-4 print:hidden">
        <Link href="/settings#passcode" className="text-base underline">
          設定へ戻る
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[210mm] px-[16mm] py-[12mm] print:p-0">
        <header className="border-b-4 border-gray-950 pb-3">
          <p className="text-base font-bold">{workspace.organizationName}</p>
          <h1 className="mt-1 text-3xl font-bold">現場アプリ「KENBEI」の始め方</h1>
        </header>

        <section className="mt-6 flex items-start gap-6">
          <div
            className="h-44 w-44 shrink-0 [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label="ログイン画面を開くQRコード"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <ol className="space-y-3 text-xl leading-relaxed">
            <li>
              <span className="font-bold">① スマホのカメラで左の QR を読む</span>
            </li>
            <li>
              <span className="font-bold">② 合言葉を入れて「入る」</span>
              <span className="mt-2 block rounded-lg border-2 border-gray-950 px-3 py-2 text-lg">
                合言葉：
              </span>
            </li>
            <li>
              <span className="font-bold">③ 自分の名前を選ぶ</span>
            </li>
          </ol>
        </section>

        <section className="mt-6 rounded-xl bg-gray-100 p-4 text-lg leading-relaxed print:bg-gray-100">
          <h2 className="font-bold">④ ホーム画面に追加（次からすぐ開けます）</h2>
          <p className="mt-1">iPhone：下の共有ボタン →「ホーム画面に追加」</p>
          <p>Android：右上の︙ →「ホーム画面に追加」</p>
          <p className="mt-1">追加したアプリを開き、設定 → 通知 を「オン」にすると、新しい予定がスマホに届きます。</p>
        </section>

        <section className="mt-6">
          <h2 className="text-2xl font-bold">毎日の使い方</h2>
          <ul className="mt-3 space-y-2 text-xl leading-relaxed">
            {WORKER_DAILY_STEPS.map((step) => (
              <li key={step}>・{step}</li>
            ))}
          </ul>
        </section>

        <footer className="mt-8 border-t-2 border-gray-300 pt-3 text-base leading-relaxed text-gray-700">
          <p>
            QR が読めないとき：{loginUrl}
          </p>
          <p>
            会社コード：<span className="font-bold tracking-widest">{loginCode}</span>
          </p>
          <p>困ったときは、会社の管理者に聞いてください。</p>
        </footer>
      </article>
    </div>
  );
}

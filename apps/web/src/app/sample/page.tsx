import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "日報の見本 | KENBEI",
  description: "KENBEIで作れる工事日報（A4・PDF）の見本です。",
};

/** Public example of a finished report, laid out like the real print page. */
const SAMPLE = {
  company: "サンプル建設株式会社",
  workOn: "2026-10-02",
  projectName: "〇〇邸 新築工事",
  author: "現場 太郎",
  weather: "天候: 晴れ",
  workerCount: 6,
  workLocation: "1F・2F 東面",
  partners: "〇〇設備、△△電気",
  body: "2F 給排水配管工事（東側）\n外壁下地の確認・是正指示（北面2か所）\n1F 電気配線 立会い",
  progress: "設備工事 60% / 外装工事 40%",
  safety: "朝礼・KY実施\n2F 開口部の養生を確認",
  issues: "北面 下地の一部に浮きあり。明日午前に是正予定",
  tomorrow: "北面 下地是正\n2F 配管 水圧試験",
};

function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-24 items-end rounded-sm bg-gradient-to-br from-slate-300 to-slate-400 p-2">
      <span className="rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-slate-700">{label}</span>
    </div>
  );
}

export default function SampleReportPage() {
  return (
    <div className="min-h-dvh bg-[var(--kb-paper)] py-6">
      <div className="mx-auto max-w-[210mm] px-4">
        <p className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="rounded-full bg-[var(--kb-accent-soft)] px-3 py-1 font-medium text-[var(--kb-accent)]">
            見本：KENBEIで作る工事日報（A4・PDF）
          </span>
          <Link href="/signup" className="font-medium text-[var(--kb-accent)] underline">
            14日間無料で試す →
          </Link>
        </p>
      </div>
      <div className="kb-elev mx-auto max-w-[210mm] bg-white px-8 py-8 text-zinc-900">
        <header className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-4">
          <div>
            <p className="text-sm">{SAMPLE.company}</p>
            <h1 className="mt-1 text-2xl font-semibold">工事日報</h1>
          </div>
          <div className="text-right text-sm">
            <p>{SAMPLE.workOn}</p>
            <p className="mt-1">{SAMPLE.projectName}</p>
            <p className="mt-1">{SAMPLE.author}</p>
          </div>
        </header>
        <div className="mt-4 flex h-48 items-end bg-gradient-to-br from-slate-300 to-slate-500 p-3">
          <span className="rounded bg-white/85 px-2 py-1 text-xs text-slate-700">現場写真（2F 東側 配管）</span>
        </div>
        <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <p>{SAMPLE.weather}</p>
          <p>作業人数: {SAMPLE.workerCount}</p>
          <p>作業箇所: {SAMPLE.workLocation}</p>
          <p>協力会社: {SAMPLE.partners}</p>
        </section>
        {(
          [
            ["作業内容", SAMPLE.body],
            ["進捗", SAMPLE.progress],
            ["安全事項", SAMPLE.safety],
            ["問題事項", SAMPLE.issues],
            ["翌日予定", SAMPLE.tomorrow],
          ] as const
        ).map(([label, text]) => (
          <section key={label} className="mt-6">
            <h2 className="text-sm font-semibold">{label}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text}</p>
          </section>
        ))}
        <section className="mt-6 grid grid-cols-3 gap-2">
          <PhotoPlaceholder label="外壁 北面 下地" />
          <PhotoPlaceholder label="1F 電気配線" />
          <PhotoPlaceholder label="2F 開口部 養生" />
        </section>
      </div>
      <p className="mx-auto mt-6 max-w-[210mm] px-4 text-center text-sm text-zinc-500">
        写真を撮って、作業にチェックして、書いて確定するだけ。このままPDFで元請けに送れます。
      </p>
    </div>
  );
}

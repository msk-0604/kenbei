"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import {
  disableWorkerPasscodeAction,
  getPasscodeStatusAction,
  revokeCrewSessionsAction,
  setPasscodeAction,
  type PasscodeKind,
} from "@/features/auth/passcode-actions";
import { WorkerInviteKit } from "@/features/workers/worker-invite-kit";

const CONFIG: Record<PasscodeKind, { title: string; description: string; label: string }> = {
  worker: {
    title: "作業員のログイン方法",
    description:
      "合言葉を決めると、作業員はメールアドレスやパスワードの代わりに、会社コードとこの合言葉でログインできます。会社の作業員全員が同じ合言葉を使います。",
    label: "新しい合言葉",
  },
  admin: {
    title: "管理者ログインの合言葉",
    description:
      "この合言葉を入れると、あなたのアカウント（管理者）でログインできます。メールアドレスとパスワードの代わりに使えます。",
    label: "新しい合言葉（管理者用）",
  },
};

export function PasscodeSettings({ kind, companyName = "" }: { kind: PasscodeKind; companyName?: string }) {
  const config = CONFIG[kind];
  const [passcode, setPasscode] = useState("");
  const [currentlySet, setCurrentlySet] = useState<boolean | null>(null);
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState("");
  const [disabling, setDisabling] = useState(false);

  async function handleDisable() {
    if (
      !window.confirm(
        "合言葉ログインをやめて、作業員は一人ずつメールアドレスで入るようにします。合言葉で入っている端末はすべてログアウトします。よろしいですか？",
      )
    ) {
      return;
    }
    setDisabling(true);
    setError("");
    setSuccess("");
    try {
      const result = await disableWorkerPasscodeAction();
      if (result.ok) {
        setCurrentlySet(false);
        setSuccess("合言葉ログインをやめました。作業員は「メンバーと会社の設定」からメールで招待してください。");
      } else {
        setError(result.error);
      }
    } catch {
      setError("合言葉ログインをやめられませんでした。もう一度お試しください。");
    } finally {
      setDisabling(false);
    }
  }

  async function handleRevoke() {
    if (
      !window.confirm(
        "合言葉でログインしている作業員の端末を、すべてログアウトさせます。作業員はもう一度、会社コードと合言葉で入り直します。よろしいですか？",
      )
    ) {
      return;
    }
    setRevoking(true);
    setRevokeMessage("");
    try {
      const result = await revokeCrewSessionsAction();
      setRevokeMessage(
        result.ok
          ? `${result.count}台の端末をログアウトさせました。端末によっては、切れるまで最大1時間かかります。`
          : result.error,
      );
    } catch {
      setRevokeMessage("ログアウトさせられませんでした。もう一度お試しください。");
    } finally {
      setRevoking(false);
    }
  }

  useEffect(() => {
    let active = true;
    void getPasscodeStatusAction()
      .then((status) => {
        if (!active) {
          return;
        }
        if (!status.ok) {
          setError(status.error);
          return;
        }
        setCurrentlySet(kind === "worker" ? status.worker : status.admin);
        setLoginCode(status.loginCode);
      })
      .catch(() => {
        if (active) {
          setCurrentlySet(null);
        }
      });
    return () => {
      active = false;
    };
  }, [kind]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await setPasscodeAction(kind, passcode);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("合言葉を設定しました。");
      setCurrentlySet(true);
      setLoginCode(result.loginCode);
      setPasscode("");
    } catch {
      setError("保存に失敗しました。通信を確認してもう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-navy-900" aria-hidden />
        <h2 className="text-base font-bold text-gray-600">{config.title}</h2>
      </div>
      {kind === "worker" ? (
        <div className="mb-4 space-y-3 text-base leading-relaxed text-gray-700">
          <p>作業員のログイン方法は、会社ごとに選べます。</p>
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
            <p className="font-bold text-emerald-900">① 一人ずつメールアドレスとパスワード（おすすめ・安全）</p>
            <p className="mt-1">
              作業員を一人ずつメールで招待します。スマホなら顔認証・指紋でも入れます。
              <Link href="/settings/members" className="ml-1 font-bold underline">
                メンバーを招待する
              </Link>
            </p>
          </div>
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2">
            <p className="font-bold text-amber-950">② みんなで同じ合言葉（かんたん）</p>
            <p className="mt-1">
              メールアドレスがなくても入れます。ただし、会社のみんなで同じ言葉を使うため、①より安全性が下がります。合言葉が会社の外にもれると、だれでも会社の予定や現場を見られてしまいます。
            </p>
          </div>
        </div>
      ) : null}
      <p className="mb-4 text-base leading-relaxed text-gray-600">
        {config.description}
        {currentlySet === true ? "（現在、設定済みです）" : currentlySet === false ? "（まだ設定されていません）" : ""}
      </p>
      {loginCode ? (
        <p className="mb-4 rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-lg text-blue-900">
          会社コード：<span className="text-2xl font-bold tracking-widest">{loginCode}</span>
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={config.label}
          id={`passcode-${kind}`}
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
          autoComplete="off"
          hint="4文字以上。ほかの会社の人に分からない言葉にしてください。"
        />
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-base text-red-700">{error}</p> : null}
        {success ? <p className="rounded-lg bg-green-50 px-3 py-2 text-base text-green-800">{success}</p> : null}
        <Button type="submit" fullWidth loading={loading}>
          合言葉を保存する
        </Button>
      </form>
      {kind === "worker" && currentlySet && loginCode ? <WorkerInviteKit loginCode={loginCode} companyName={companyName} /> : null}
      {kind === "worker" && currentlySet ? (
        <div className="mt-6 border-t-2 border-gray-100 pt-5">
          <p className="mb-3 text-base leading-relaxed text-gray-600">
            一人ずつメールアドレスで入る方法（①）に切り替えるときは、合言葉ログインをやめてください。
          </p>
          <Button type="button" variant="secondary" fullWidth loading={disabling} onClick={() => void handleDisable()}>
            合言葉ログインをやめる
          </Button>
        </div>
      ) : null}
      {kind === "worker" && currentlySet ? (
        <div className="mt-6 border-t-2 border-gray-100 pt-5">
          <p className="mb-3 text-base leading-relaxed text-gray-600">
            合言葉が知られてしまったときは、合言葉を変えてから下のボタンを押すと、今ログインしている作業員の端末も使えなくなります。
          </p>
          <Button type="button" variant="danger" fullWidth loading={revoking} onClick={() => void handleRevoke()}>
            作業員の端末をすべてログアウトさせる
          </Button>
          {revokeMessage ? <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-base text-gray-700">{revokeMessage}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  getPasscodeStatusAction,
  revokeCrewSessionsAction,
  setPasscodeAction,
  type PasscodeKind,
} from "@/features/auth/passcode-actions";

const CONFIG: Record<PasscodeKind, { title: string; description: string; label: string }> = {
  worker: {
    title: "作業員ログインの合言葉",
    description:
      "作業員はメールアドレスやパスワードの代わりに、会社コードとこの合言葉でログインできます。会社の作業員全員が同じ合言葉を使います。",
    label: "新しい合言葉",
  },
  admin: {
    title: "管理者ログインの合言葉",
    description:
      "この合言葉を入れると、あなたのアカウント（管理者）でログインできます。メールアドレスとパスワードの代わりに使えます。",
    label: "新しい合言葉（管理者用）",
  },
};

export function PasscodeSettings({ kind }: { kind: PasscodeKind }) {
  const config = CONFIG[kind];
  const [passcode, setPasscode] = useState("");
  const [currentlySet, setCurrentlySet] = useState<boolean | null>(null);
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeMessage, setRevokeMessage] = useState("");

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

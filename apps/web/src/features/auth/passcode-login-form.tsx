"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withTimeout } from "@/lib/client-errors";
import { passcodeLoginAction, type PasscodeKind } from "@/features/auth/passcode-actions";

const LOGIN_CODE_KEY = "kenbei-login-code";

export function readSavedLoginCode(): string {
  try {
    return window.localStorage.getItem(LOGIN_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveLoginCode(code: string) {
  try {
    window.localStorage.setItem(LOGIN_CODE_KEY, code);
  } catch {
    // 保存できなくてもログインは続ける
  }
}

/** 会社コードは最初の1回だけ。次からはこの端末が覚えているので、合言葉だけで入れる。 */
export function PasscodeLoginForm({
  kind = "worker",
  redirectHref = "/today",
  initialLoginCode = "",
}: {
  kind?: PasscodeKind;
  redirectHref?: string;
  initialLoginCode?: string;
}) {
  const router = useRouter();
  const [loginCode, setLoginCode] = useState(initialLoginCode);
  const [rememberedCode, setRememberedCode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialLoginCode) {
      return;
    }
    const saved = readSavedLoginCode();
    if (saved) {
      setLoginCode(saved);
      setRememberedCode(true);
    }
  }, [initialLoginCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await withTimeout(
        passcodeLoginAction({ loginCode, passcode, kind }),
        20000,
        "ログインがタイムアウトしました。通信環境を確認してください。",
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      saveLoginCode(loginCode.trim());
      router.replace(redirectHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-6 w-6 text-navy-900" aria-hidden />
        <h2 className="text-xl font-bold text-navy-950">
          {kind === "admin" ? "管理者の合言葉でログイン" : "合言葉でログイン"}
        </h2>
      </div>
      <p className="mb-4 text-lg text-gray-600">
        {kind === "admin" ? "管理者の合言葉を入れてください。" : "会社の合言葉を入れてください。"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {rememberedCode ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-lg text-gray-700">
              会社コード <span className="font-bold text-navy-950">{loginCode}</span>
            </p>
            <button
              type="button"
              className="tap-press min-h-12 rounded-xl border-2 border-gray-300 bg-white px-3 text-base font-bold text-gray-700"
              onClick={() => setRememberedCode(false)}
            >
              変える
            </button>
          </div>
        ) : (
          <Input
            label="会社コード（6桁の数字）"
            id="login-code"
            inputMode="numeric"
            autoComplete="off"
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            hint="管理者から教わった6桁の数字です。2回目からは入れなくて大丈夫です。"
            required
          />
        )}
        <Input
          label="合言葉"
          id="passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
          autoComplete="off"
        />

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-lg text-red-700">{error}</p> : null}

        <Button type="submit" fullWidth size="lg" loading={loading}>
          入る
        </Button>
      </form>
    </div>
  );
}

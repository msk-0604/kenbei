"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasscodeLoginForm, readSavedLoginCode } from "@/features/auth/passcode-login-form";
import { SignInForm } from "@/features/auth/sign-in-form";
import { cn } from "@/lib/cn";

type Mode = "passcode" | "email";

/**
 * ログインは2通り。
 * ・合言葉：会社コード＋会社の合言葉（作業員）／管理者の合言葉
 * ・メールアドレス：個人のアカウント（会社を作った人・招待された人）
 * この端末で合言葉ログインをしたことがあれば、最初から合言葉の画面を出す。
 */
export function LoginChooser({
  isAdmin,
  initialLoginCode,
  nextPath,
}: {
  isAdmin: boolean;
  initialLoginCode: string;
  nextPath?: string;
}) {
  const [mode, setMode] = useState<Mode>(isAdmin || initialLoginCode ? "passcode" : "email");

  useEffect(() => {
    if (!isAdmin && !initialLoginCode && readSavedLoginCode()) {
      setMode("passcode");
    }
  }, [isAdmin, initialLoginCode]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3" role="tablist" aria-label="ログインの方法">
        {(
          [
            ["passcode", "合言葉で入る"],
            ["email", "メールで入る"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "tap-press min-h-14 rounded-2xl border-2 text-lg font-bold",
              mode === value ? "border-navy-900 bg-navy-900 text-white" : "border-gray-300 bg-white text-gray-900",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "passcode" ? (
        <>
          <PasscodeLoginForm
            kind={isAdmin ? "admin" : "worker"}
            redirectHref={nextPath ?? (isAdmin ? "/sites" : "/today")}
            initialLoginCode={initialLoginCode}
          />
          <Link
            href={isAdmin ? "/login" : "/login?mode=admin"}
            className="block text-center text-base font-bold text-gray-600 underline"
          >
            {isAdmin ? "作業員の方はこちら" : "管理者の方はこちら"}
          </Link>
        </>
      ) : (
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-navy-950">メールアドレスでログイン</h2>
          <SignInForm nextPath={nextPath} />
          <p className="mt-4 text-base text-gray-600">
            <Link href="/forgot-password" className="underline">
              パスワードを忘れた
            </Link>
          </p>
          <p className="mt-4 text-base text-gray-600">
            初めての方は{" "}
            <Link
              href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
              className="font-bold text-navy-900 underline"
            >
              アカウント作成
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

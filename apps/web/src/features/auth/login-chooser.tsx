"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasscodeLoginForm, readSavedLoginCode } from "@/features/auth/passcode-login-form";
import { PasskeyLoginButton } from "@/features/auth/passkey-login-button";
import { SignInForm } from "@/features/auth/sign-in-form";
import { cn } from "@/lib/cn";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Mode = "passcode" | "email";

/**
 * ログインは、メールアドレスとパスワード（顔認証・指紋も）が基本。
 * 合言葉（会社コード＋会社の合言葉／管理者の合言葉）は、会社が選んだときだけ使う「かんたん」な方法。
 * 会社コード付きの URL で開いたとき、またはこの端末で合言葉ログインをしたことがあるときは、合言葉の画面を出す。
 */
export function LoginChooser({
  isAdmin,
  initialLoginCode,
  nextPath,
  signedOut = false,
}: {
  isAdmin: boolean;
  initialLoginCode: string;
  nextPath?: string;
  /** セッションが無効になって戻ってきた（端末に残ったトークンを消す） */
  signedOut?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(isAdmin || initialLoginCode ? "passcode" : "email");

  useEffect(() => {
    if (signedOut) {
      void createBrowserSupabaseClient()
        .auth.signOut({ scope: "local" })
        .catch(() => undefined);
    }
  }, [signedOut]);

  useEffect(() => {
    if (!isAdmin && !initialLoginCode && readSavedLoginCode()) {
      setMode("passcode");
    }
  }, [isAdmin, initialLoginCode]);

  return (
    <div className="space-y-5">
      {signedOut ? (
        <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-lg text-amber-950">
          ログインが切れました。もう一度ログインしてください。
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3" role="tablist" aria-label="ログインの方法">
        {(
          [
            ["email", "メールとパスワード"],
            ["passcode", "合言葉"],
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
          <PasscodeNotice isAdmin={isAdmin} />
          <Link
            href={isAdmin ? "/login" : "/login?mode=admin"}
            className="block text-center text-base font-bold text-gray-600 underline"
          >
            {isAdmin ? "作業員の方はこちら" : "管理者の方はこちら"}
          </Link>
        </>
      ) : (
        <div className="space-y-4">
          <PasskeyLoginButton nextPath={nextPath} />
          <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-bold text-navy-950">メールアドレスとパスワード</h2>
            <p className="mb-4 text-base text-gray-600">一人ずつのアカウントで入ります（おすすめ・安全）。</p>
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
        </div>
      )}
    </div>
  );
}

/** 合言葉の画面に出す注意書き（セキュリティ面） */
function PasscodeNotice({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div
      className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950"
      role="note"
    >
      <p className="font-bold">合言葉について（セキュリティ）</p>
      {isAdmin ? (
        <p className="mt-1">
          管理者の合言葉を知っている人は、管理者として会社のすべての情報を見たり変えたりできます。できるだけ、メールアドレスとパスワード（スマホなら顔認証）で入ってください。
        </p>
      ) : (
        <p className="mt-1">
          合言葉は会社のみんなで同じ言葉を使うため、一人ずつのメールアドレスとパスワードより安全性が下がります。合言葉が会社の外にもれると、だれでも会社の予定や現場を見られてしまいます。会社の外の人には教えないでください。
        </p>
      )}
    </div>
  );
}

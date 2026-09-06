"use client";

import { useMemo, useState, useTransition } from "react";
import {
  confirmationQuestion,
  formatFieldValue,
} from "@kensapo/domain";
import { confirmFieldAction, finishCaptureAction } from "@/features/capture/actions";
import type { CaptureFieldView } from "@/features/capture/queries";

export function ConfirmFlow({
  captureId,
  fields,
  graphApplied,
}: {
  captureId: string;
  fields: CaptureFieldView[];
  graphApplied: boolean;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const accepted = fields.filter(
    (field) => field.status === "auto_accepted" || field.status === "confirmed" || field.status === "corrected",
  );
  const pendingFields = fields.filter((field) => field.status === "pending" && !skipped.includes(field.id));
  const current = pendingFields[0];

  const acceptedSummary = useMemo(
    () =>
      accepted.map((field) => `${formatFieldValue(field.confirmedValue ?? field.proposedValue)}`).join(" / "),
    [accepted],
  );

  if (graphApplied) {
    return <p className="text-base text-zinc-600">この報告は確定済みです。</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {accepted.length > 0 ? (
        <section className="rounded-3xl bg-white p-4 text-sm leading-6 text-zinc-600 ring-1 ring-zinc-100">
          {acceptedSummary}
        </section>
      ) : null}

      {current ? (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <p className="text-xl font-medium leading-8">
            {confirmationQuestion(current.fieldKey, current.proposedValue)}
          </p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {correcting ? (
            <form
              className="mt-4 flex flex-col gap-3"
              action={(formData) => {
                formData.set("fieldId", current.id);
                formData.set("decision", "correct");
                start(async () => {
                  const result = await confirmFieldAction(formData);
                  if (result?.error) {
                    setError(result.error);
                  } else {
                    setCorrecting(false);
                    setCorrection("");
                  }
                });
              }}
            >
              <input
                name="correction"
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
                className="rounded-xl border border-zinc-200 px-4 text-base"
                placeholder="正しい内容"
              />
              <button type="submit" disabled={pending} className="rounded-2xl bg-zinc-900 font-medium text-white">
                保存
              </button>
            </form>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3">
              <button
                type="button"
                disabled={pending}
                className="rounded-2xl bg-zinc-900 font-medium text-white"
                onClick={() => {
                  const data = new FormData();
                  data.set("fieldId", current.id);
                  data.set("decision", "ok");
                  start(async () => {
                    const result = await confirmFieldAction(data);
                    if (result?.error) {
                      setError(result.error);
                    }
                  });
                }}
              >
                はい
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-2xl border border-zinc-200 bg-white font-medium"
                onClick={() => setCorrecting(true)}
              >
                修正
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-2xl text-zinc-500"
                onClick={() => setSkipped((ids) => [...ids, current.id])}
              >
                未確定
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <p className="text-base leading-6 text-zinc-700">確認できる項目は以上です。確定した内容だけ現場データに残します。</p>
          <button
            type="button"
            disabled={pending}
            className="mt-5 w-full rounded-2xl bg-zinc-900 font-medium text-white"
            onClick={() => {
              start(async () => {
                const result = await finishCaptureAction(captureId);
                if (result?.error) {
                  setError(result.error);
                }
              });
            }}
          >
            確定して残す
          </button>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </section>
      )}
    </div>
  );
}

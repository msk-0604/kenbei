"use client";

export function PrintButton() {
  return (
    <button type="button" className="ml-4 underline" onClick={() => window.print()}>
      印刷する
    </button>
  );
}

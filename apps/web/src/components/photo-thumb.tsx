"use client";

import { useState } from "react";

export function PhotoThumb({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={`flex items-center justify-center bg-zinc-100 text-sm text-zinc-400 ${className ?? "h-36"}`}>画像なし</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className ?? "h-36 w-full object-cover"} onError={() => setFailed(true)} />
  );
}

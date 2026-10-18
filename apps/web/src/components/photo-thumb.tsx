"use client";

import { useEffect, useRef, useState } from "react";

/** 写真のサムネイル。画面の外は読み込まず（lazy）、読み込めたらふわっと出す。 */
export function PhotoThumb({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // キャッシュから表示されたときは onLoad が先に終わっていることがあるので、最初に確かめる
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);
  if (failed) {
    return <div className={`flex items-center justify-center bg-zinc-100 text-sm text-zinc-400 ${className ?? "h-36"}`}>画像なし</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={`${className ?? "h-36 w-full object-cover"} bg-zinc-100 transition-opacity duration-300 ease-out ${loaded ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

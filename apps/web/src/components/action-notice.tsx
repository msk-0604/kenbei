"use client";

import { useEffect, useRef, useState } from "react";

export function ActionNotice({ children }: { children: string }) {
  if (!children) {
    return null;
  }
  return <p className="text-sm font-medium text-emerald-800">{children}</p>;
}

export function FormSuccessNotice({
  pending,
  error,
  message,
}: {
  pending: boolean;
  error?: string | null;
  message: string;
}) {
  const [show, setShow] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setShow(false);
      return;
    }
    if (wasPending.current && !error) {
      setShow(true);
      wasPending.current = false;
      const timer = window.setTimeout(() => setShow(false), 2800);
      return () => window.clearTimeout(timer);
    }
    wasPending.current = false;
  }, [pending, error]);

  if (!show) {
    return null;
  }
  return <ActionNotice>{message}</ActionNotice>;
}

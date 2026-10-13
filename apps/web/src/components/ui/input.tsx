"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = id ?? label;
  const isDate = props.type === "date";
  const hasList = Boolean(props.list);
  return (
    <section className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-lg font-bold text-gray-800"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          className={cn(
            "w-full rounded-2xl border-2 border-gray-300 bg-white px-5 py-5 text-xl leading-none text-gray-900 placeholder:text-gray-400 focus:border-navy-700 focus:outline-none focus:ring-4 focus:ring-navy-700/15",
            isDate && "py-4 text-lg",
            hasList && "pr-12",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/15",
            className
          )}
          {...props}
        />
        {hasList ? (
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        ) : null}
      </div>
      {hint && !error ? (
        <p className="text-base text-gray-500">{hint}</p>
      ) : null}
      {error ? <p className="text-base text-red-600">{error}</p> : null}
    </section>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = id ?? label;
  return (
    <section className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-lg font-bold text-gray-800"
      >
        {label}
      </label>
      <textarea
        id={fieldId}
        className={cn(
          "min-h-[160px] w-full resize-y rounded-2xl border-2 border-gray-300 bg-white px-5 py-5 text-xl text-gray-900 placeholder:text-gray-400 focus:border-navy-700 focus:outline-none focus:ring-4 focus:ring-navy-700/15",
          error && "border-red-500",
          className
        )}
        {...props}
      />
      {hint && !error ? (
        <p className="text-base text-gray-500">{hint}</p>
      ) : null}
      {error ? <p className="text-base text-red-600">{error}</p> : null}
    </section>
  );
}

/**
 * 候補をタップで選べる入力欄。ブラウザ標準のdatalistはiPhoneのSafariで
 * 候補が表示されないため、自前でタップ選択式の一覧を出す。
 */
export function ComboInput({
  label,
  error,
  hint,
  className,
  options,
  value,
  onChange,
  id,
  ...props
}: FieldProps & {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list">) {
  const fieldId = id ?? label;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const suggestions = options.filter((option) => option.includes(value));

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        ref.current &&
        e.target instanceof Node &&
        !ref.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <section className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-lg font-bold text-gray-800"
      >
        {label}
      </label>
      <div className="relative" ref={ref}>
        <input
          id={fieldId}
          className={cn(
            "w-full rounded-2xl border-2 border-gray-300 bg-white px-5 py-5 pr-12 text-xl leading-none text-gray-900 placeholder:text-gray-400 focus:border-navy-700 focus:outline-none focus:ring-4 focus:ring-navy-700/15",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/15",
            className
          )}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          {...props}
        />
        <ChevronDown
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        {open && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border-2 border-gray-300 bg-white shadow-lg">
            {suggestions.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className="flex min-h-14 w-full items-center px-4 text-left text-lg font-bold text-gray-950 active:bg-gray-100"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {hint && !error ? (
        <p className="text-base text-gray-500">{hint}</p>
      ) : null}
      {error ? <p className="text-base text-red-600">{error}</p> : null}
    </section>
  );
}

export function Select({
  label,
  error,
  children,
  className,
  id,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = id ?? label;
  return (
    <section className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-lg font-bold text-gray-800"
      >
        {label}
      </label>
      <select
        id={fieldId}
        className={cn(
          "w-full rounded-2xl border-2 border-gray-300 bg-white px-5 py-5 text-xl text-gray-900 focus:border-navy-700 focus:outline-none focus:ring-4 focus:ring-navy-700/15",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-base text-red-600">{error}</p> : null}
    </section>
  );
}

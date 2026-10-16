"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 disabled:bg-gray-300 disabled:text-gray-500",
  secondary:
    "bg-white text-navy-900 border-2 border-gray-300 hover:bg-gray-50 active:bg-gray-100",
  ghost:
    "bg-transparent text-navy-900 hover:bg-gray-100 border-2 border-transparent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-2 border-red-600",
};

const sizes: Record<Size, string> = {
  md: "min-h-[4rem] px-5 text-xl font-bold",
  lg: "min-h-[4.5rem] px-6 text-2xl font-bold",
};

export function Button({
  className,
  variant = "primary",
  size = "lg",
  loading,
  fullWidth,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "tap-press inline-flex items-center justify-center gap-2 rounded-2xl transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
      type={type}
    >
      {loading ? (
        <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

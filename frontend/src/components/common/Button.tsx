import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "glow";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#07090e] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none active:scale-[0.98]";

  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 text-white hover:brightness-110 shadow-lg shadow-indigo-500/20 border border-white/10 hover:shadow-indigo-500/35",
    glow:
      "bg-white text-slate-950 font-semibold hover:bg-slate-100 shadow-lg shadow-white/15 border border-white/30",
    secondary:
      "bg-white/7 hover:bg-white/12 text-slate-200 border border-white/10 hover:border-white/20 shadow-xs",
    outline:
      "border border-white/12 bg-transparent text-slate-300 hover:text-white hover:bg-white/6 hover:border-white/25",
    danger:
      "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 shadow-lg shadow-rose-500/10",
    ghost:
      "text-slate-400 hover:text-white hover:bg-white/6",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
};

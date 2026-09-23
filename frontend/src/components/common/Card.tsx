import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = "", glow = false, ...props }) => {
  return (
    <div
      className={`relative rounded-2xl border border-white/8 bg-[#0d111a]/85 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 ${
        glow ? "glow-primary border-indigo-500/30" : "hover:border-white/14 hover:bg-[#0f1420]/90"
      } ${className}`}
      {...props}
    >
      {/* Top subtle highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-t-2xl" />
      {children}
    </div>
  );
};

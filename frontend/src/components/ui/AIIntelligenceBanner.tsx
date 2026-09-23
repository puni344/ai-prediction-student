import React from 'react';
import { Sparkles, Brain, Cpu, ShieldCheck } from 'lucide-react';

interface AIIntelligenceBannerProps {
  title?: string;
  badge?: string;
  category?: 'diagnostic' | 'recommendation' | 'explanation' | 'strategic';
  strategy: string;
  confidence?: number;
  tags?: string[];
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const AIIntelligenceBanner: React.FC<AIIntelligenceBannerProps> = ({
  title = "AI Academic Intelligence",
  badge = "SYNTACTIC REASONING",
  category = "strategic",
  strategy,
  confidence = 99.8,
  tags = [],
  actionLabel,
  onAction,
  className = "",
}) => {
  const getBadgeColors = () => {
    switch (category) {
      case 'diagnostic':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'explanation':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'recommendation':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-cyan-950/30 p-5 backdrop-blur-xl shadow-xl shadow-indigo-950/20 ${className}`}>
      {/* Ambient Neural Glow */}
      <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 shadow-inner">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100 tracking-tight">{title}</span>
              <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded-full border ${getBadgeColors()}`}>
                {badge}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1 font-mono text-[11px] bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Confidence: <strong className="text-slate-200">{confidence}%</strong></span>
          </div>
        </div>
      </div>

      {/* Main Body / Strategy */}
      <div className="pt-3.5">
        <p className="text-sm text-slate-200 leading-relaxed font-normal">
          {strategy}
        </p>

        {/* Tags and Action */}
        {(tags.length > 0 || actionLabel) && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag, idx) => (
                <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                  #{tag}
                </span>
              ))}
            </div>

            {actionLabel && (
              <button
                onClick={onAction}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <span>{actionLabel}</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

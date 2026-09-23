import React from "react";
import { Clock, Coffee, BookOpen, Calendar, SlidersHorizontal, Sparkles } from "lucide-react";
import type { StudyPlanBlock } from "../../types";

interface StudyPlanTimetableProps {
  blocks: StudyPlanBlock[];
  availableMinutes: number;
  preferredStartTime: string;
  onMinutesChange: (minutes: number) => void;
  onStartTimeChange: (startTime: string) => void;
  loading?: boolean;
}

export const StudyPlanTimetable: React.FC<StudyPlanTimetableProps> = ({
  blocks,
  availableMinutes,
  preferredStartTime,
  onMinutesChange,
  onStartTimeChange,
  loading = false,
}) => {
  const totalStudyMinutes = (blocks || [])
    .filter((b) => !b.is_break)
    .reduce((acc, b) => acc + b.duration_minutes, 0);

  const totalBreakMinutes = (blocks || [])
    .filter((b) => b.is_break)
    .reduce((acc, b) => acc + b.duration_minutes, 0);

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl space-y-4">
      {/* Header with Constraints Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Deterministic Study Timetable
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Non-overlapping focus blocks with cognitive recovery intervals
          </p>
        </div>

        {/* Constraint Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1">
            <Clock className="h-3 w-3 text-slate-400" />
            <select
              value={availableMinutes}
              onChange={(e) => onMinutesChange(Number(e.target.value))}
              disabled={loading}
              className="bg-transparent text-xs text-slate-200 focus:outline-none font-mono cursor-pointer"
            >
              <option value={60} className="bg-slate-900 text-slate-200">60m (1h)</option>
              <option value={90} className="bg-slate-900 text-slate-200">90m (1.5h)</option>
              <option value={120} className="bg-slate-900 text-slate-200">120m (2h)</option>
              <option value={180} className="bg-slate-900 text-slate-200">180m (3h)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Start:</span>
            <input
              type="time"
              value={preferredStartTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              disabled={loading}
              className="bg-transparent text-xs text-slate-200 focus:outline-none font-mono cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Summary Stat Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs font-mono">
        <span className="text-slate-400">Total Duration:</span>
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-semibold">{totalStudyMinutes}m study</span>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold">{totalBreakMinutes}m rest</span>
          <span className="text-slate-600">·</span>
          <span className="text-white font-bold">{totalStudyMinutes + totalBreakMinutes}m total</span>
        </div>
      </div>

      {/* Timetable Blocks */}
      {!blocks || blocks.length === 0 ? (
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-6 text-center text-slate-400">
          <p className="text-xs">No blocks scheduled yet. Adjust constraints to generate your schedule.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {blocks.map((block, idx) => (
            <div
              key={`${block.start_time}-${idx}`}
              className={`flex items-center justify-between rounded-xl border p-3.5 transition-all duration-200 ${
                block.is_break
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                  : "border-slate-800/80 bg-slate-950/60 text-slate-200 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    block.is_break
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                  }`}
                >
                  {block.is_break ? <Coffee className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-white">
                    {block.activity}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {block.focus_area !== "Rest" ? `Focus: ${block.focus_area.replace(/_/g, " ")}` : "Rest & Cognitive Recovery"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right">
                <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span>{block.start_time} - {block.end_time}</span>
                </div>
                <span className="text-xs font-bold font-mono text-slate-300 w-10 text-right">
                  {block.duration_minutes}m
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

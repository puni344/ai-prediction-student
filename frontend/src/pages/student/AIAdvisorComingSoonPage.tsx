import React, { useState } from "react";
import { MessageSquareCode, Sparkles, Cpu, CheckCircle2, Terminal, Bot, User, ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "../../components/common/Card";
import { AIIntelligenceBanner } from "../../components/ui/AIIntelligenceBanner";

export const AIAdvisorComingSoonPage: React.FC = () => {
  const [activeQuery, setActiveQuery] = useState(0);

  const sampleQueries = [
    {
      user: "How can I raise my projected exam score above 90% without burning out?",
      ai: "Based on your CatBoost Shapley decomposition, previous_grade (+17.9 pts) already anchors your high score. However, sleep duration (7.5 hrs) is on the borderline. Increasing study efficiency by +1.5 hrs/day while maintaining 8 hrs sleep provides a net +4.8 pts boost without risking cognitive fatigue.",
      driver: "Study Efficiency & Sleep Optimization",
      impact: "+4.8 pts projected delta",
    },
    {
      user: "My attendance dipped to 74%. How urgently do I need to recover it?",
      ai: "Attendance is your primary deterministic risk trigger. Once attendance falls below 70%, the multi-model ensemble doubles risk index penalty (+22 pts). Attending the next 4 consecutive lectures will restore your standing to 82%, safely locking your profile in Low Risk tier.",
      driver: "Attendance Threshold Recovery",
      impact: "Prevents Moderate Risk downgrade",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Study Advisor & Copilot</h1>
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              Neural Core Preview
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Personalized prescriptive recommendations and interactive study guidance powered by TreeSHAP context embeddings.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-mono text-cyan-300">
          <Cpu className="h-3.5 w-3.5 animate-pulse" />
          <span>Scheduled: Phase 5 Integration</span>
        </div>
      </div>

      {/* AI Visual Identity Banner */}
      <AIIntelligenceBanner
        category="strategic"
        badge="NEURAL ADVISOR SPECIFICATION"
        title="Context-Aware Prescriptive Engine"
        strategy="The Phase 5 AI Study Advisor directly injects deterministic TreeSHAP attribution matrices into local LLM prompt contexts to synthesize personalized, clinically verified academic improvement roadmaps."
        tags={["TreeSHAPPromptContext", "DeterministicGuardrails", "AdaptiveTutoring"]}
        confidence={99.8}
      />

      {/* High-Tech Neural Terminal Simulator */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0e17] overflow-hidden shadow-2xl backdrop-blur-xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-white/8 bg-[#0e1320] px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="ml-3 font-mono text-xs text-slate-400">neural-advisor-copilot.v2 // status: preview_mode</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono text-cyan-300">LATENCY: 12ms</span>
          </div>
        </div>

        {/* Query Switcher Tabs */}
        <div className="flex border-b border-white/8 bg-black/40 px-5 pt-3 gap-3">
          {sampleQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setActiveQuery(idx)}
              className={`pb-2.5 text-xs font-mono transition-colors border-b-2 ${
                activeQuery === idx
                  ? "border-cyan-400 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Scenario #{idx + 1}: {q.driver}
            </button>
          ))}
        </div>

        {/* Simulated Conversation Feed */}
        <div className="p-6 space-y-5 min-h-[280px]">
          {/* User Message */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <User className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-none border border-white/8 bg-white/[0.04] p-4 text-xs text-slate-200 max-w-xl">
              <p className="leading-relaxed">{sampleQueries[activeQuery].user}</p>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Bot className="h-4 w-4" />
            </div>
            <div className="space-y-3 rounded-2xl rounded-tl-none border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-900/60 p-4 text-xs text-slate-200 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  AI ADVISOR SYNTHESIS
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {sampleQueries[activeQuery].impact}
                </span>
              </div>
              <p className="leading-relaxed text-slate-300">
                {sampleQueries[activeQuery].ai}
              </p>
            </div>
          </div>
        </div>

        {/* Terminal Input Bar (Interactive preview) */}
        <div className="border-t border-white/8 bg-black/50 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0e121b] px-4 py-2.5">
            <Terminal className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              readOnly
              value="Interactive query engine activates in Phase 5..."
              className="w-full bg-transparent text-xs text-slate-500 outline-none cursor-not-allowed font-mono"
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-white/5 px-2.5 py-1 rounded">
              Read Only
            </span>
          </div>
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-[#0d111a]/85 p-4 backdrop-blur-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 mb-2" />
          <h4 className="text-xs font-bold text-white">Personalized Study Regimens</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Dynamic schedules tailored to address specific feature vulnerabilities identified by SHAP.
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0d111a]/85 p-4 backdrop-blur-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 mb-2" />
          <h4 className="text-xs font-bold text-white">SHAP-Informed Tutoring</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Exact mathematical feature weights injected directly into counseling recommendations.
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0d111a]/85 p-4 backdrop-blur-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 mb-2" />
          <h4 className="text-xs font-bold text-white">Exam Readiness Assessments</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Adaptive quiz checkpoints providing real-time feedback on weak subject modules.
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0d111a]/85 p-4 backdrop-blur-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 mb-2" />
          <h4 className="text-xs font-bold text-white">Adaptive Counseling Workflows</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Proactive intervention triggers alerting faculty before midterm examination drops.
          </p>
        </div>
      </div>
    </div>
  );
};

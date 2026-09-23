import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Activity,
  BarChart3,
  Sliders,
  Layers,
  ArrowUpRight,
  Zap,
  GraduationCap,
  Building2,
  Users,
} from "lucide-react";
import { Button } from "../../components/common/Button";
import { Navbar } from "../../components/layout/Navbar";
import { TiltCard } from "../../components/ui/TiltCard";
import { SpotlightCard } from "../../components/ui/SpotlightCard";
import { RadialScoreMeter } from "../../components/ui/RadialScoreMeter";
import { RiskBadge } from "../../components/common/RiskBadge";

export const LandingPage: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const handleStudentClick = () => {
    if (isAuthenticated && role === "student") {
      navigate("/student/dashboard");
    } else {
      navigate("/student/login");
    }
  };

  const handleFacultyClick = () => {
    if (isAuthenticated && role === "faculty") {
      navigate("/faculty/dashboard");
    } else {
      navigate("/faculty/login");
    }
  };

  const handleAdminClick = () => {
    if (isAuthenticated && role === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/admin/login");
    }
  };

  // Interactive live simulator state in Hero preview!
  const [demoAttendance, setDemoAttendance] = useState(92);
  const [demoStudyHours, setDemoStudyHours] = useState(7.5);

  // Compute responsive mockup values based on sliders
  const calculatedScore = Math.min(
    Math.max(40 + (demoAttendance - 40) * 0.45 + demoStudyHours * 3.8, 35),
    98.5
  );
  const calculatedPassProb = calculatedScore >= 70 ? 0.99 : calculatedScore >= 50 ? 0.78 : 0.35;
  const calculatedRisk = calculatedScore >= 70 ? "LOW" : calculatedScore >= 50 ? "MODERATE" : "HIGH";

  return (
    <div className="min-h-screen bg-[#07090e] bg-grid-pattern text-slate-100 overflow-hidden relative selection:bg-indigo-500/30 selection:text-white">
      <Navbar />

      {/* Atmospheric Ambient Lighting Blobs */}
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-indigo-600/20 via-cyan-500/10 to-transparent blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute top-[700px] -left-64 w-[600px] h-[600px] bg-cyan-600/10 blur-[150px] rounded-full" />
      <div className="pointer-events-none absolute top-[1100px] -right-64 w-[700px] h-[700px] bg-violet-600/10 blur-[160px] rounded-full" />

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 sm:pt-28 sm:pb-36">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Version Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 backdrop-blur-xl shadow-lg shadow-indigo-500/10">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Academic Intelligence System  Multi-Model Ensembles  TreeSHAP</span>
            </div>

            {/* Headline */}
            <h1 className="mt-8 text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.06]">
              Predict Academic Trajectory with{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-200 bg-clip-text text-transparent">
                Explainable AI
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg max-w-2xl mx-auto">
              Empower students and faculty with authentic predictive intelligence. Combining Random Forest,
              XGBoost, and CatBoost with game-theoretic feature attributions for proactive academic counseling.
            </p>

            {/* CTAs: Exactly 3 primary entry points with identical UI component / structure */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row flex-wrap">
              {/* STUDENT CTA: purple → blue → cyan */}
              <button
                type="button"
                onClick={handleStudentClick}
                className="group relative flex items-center justify-between w-full sm:w-auto min-w-[250px] px-6 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 border border-white/20 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-[0.99] transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/15 border border-white/25 shadow-inner text-cyan-200">
                    <GraduationCap className="h-4.5 w-4.5" />
                  </span>
                  <span className="tracking-wide">Launch Student Lab</span>
                </div>
                <ArrowRight className="h-4 w-4 ml-3 shrink-0 text-white/80 group-hover:text-white group-hover:translate-x-1.5 transition-all duration-300" />
              </button>

              {/* FACULTY CTA: blue → cyan → teal */}
              <button
                type="button"
                onClick={handleFacultyClick}
                className="group relative flex items-center justify-between w-full sm:w-auto min-w-[250px] px-6 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 border border-white/20 shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-[0.99] transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/15 border border-white/25 shadow-inner text-teal-200">
                    <Users className="h-4.5 w-4.5" />
                  </span>
                  <span className="tracking-wide">Launch Faculty Lab</span>
                </div>
                <ArrowRight className="h-4 w-4 ml-3 shrink-0 text-white/80 group-hover:text-white group-hover:translate-x-1.5 transition-all duration-300" />
              </button>

              {/* INSTITUTION CTA: orange → pink → purple */}
              <button
                type="button"
                onClick={handleAdminClick}
                className="group relative flex items-center justify-between w-full sm:w-auto min-w-[250px] px-6 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 border border-white/20 shadow-xl shadow-pink-500/25 hover:shadow-pink-500/40 hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-[0.99] transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/15 border border-white/25 shadow-inner text-amber-200">
                    <Building2 className="h-4.5 w-4.5" />
                  </span>
                  <span className="tracking-wide">Institution Portal</span>
                </div>
                <ArrowRight className="h-4 w-4 ml-3 shrink-0 text-white/80 group-hover:text-white group-hover:translate-x-1.5 transition-all duration-300" />
              </button>
            </div>
          </div>

          {/* 3D FLOATING PRODUCT SHOWCASE (CINEMATIC WITH REAL-TIME SLIDERS) */}
          <div className="mt-16 sm:mt-24 max-w-5xl mx-auto relative">
            {/* Floating 3D Badge 1 - Top Left */}
            <div className="hidden lg:flex absolute -top-6 -left-8 z-30 items-center gap-2 rounded-2xl border border-emerald-500/40 bg-[#0d121c]/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl animate-float">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-emerald-300">Interactive Preview: TreeSHAP Attribution</span>
            </div>

            {/* Floating 3D Badge 2 - Top Right */}
            <div className="hidden lg:flex absolute -top-8 -right-8 z-30 items-center gap-2 rounded-2xl border border-indigo-500/40 bg-[#0d121c]/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Tri-Model Ensemble Consensus</span>
            </div>

            <TiltCard className="p-6 sm:p-8 border border-white/15 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-white/8 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-xs text-slate-400">academic-intelligence-core.py</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Deterministic Risk Calibrated
                </div>
              </div>

              {/* Showcase Grid */}
              <div className="grid gap-6 lg:grid-cols-12 items-center">
                {/* Radial Gauge Centerpiece */}
                <div className="lg:col-span-5 rounded-2xl border border-white/8 bg-[#0a0d16]/80 p-6 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Simulated Consensus Score
                  </span>
                  <RadialScoreMeter
                    score={calculatedScore}
                    passProbability={calculatedPassProb}
                    riskLevel={calculatedRisk}
                    size={180}
                  />
                  <div className="mt-4 flex items-center gap-2">
                    <RiskBadge level={calculatedRisk} />
                    <span className="text-xs font-semibold text-slate-300">
                      {(calculatedPassProb * 100).toFixed(0)}% Probability
                    </span>
                  </div>
                </div>

                {/* Interactive Sliders & TreeSHAP preview */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-[#0a0d16]/80 p-5">
                    <div className="flex items-center justify-between border-b border-white/8 pb-3 mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5" />
                        Interactive Scenario Sandbox
                      </span>
                      <span className="text-[11px] text-slate-500">Drag to test inference</span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                          <span>Attendance Rate</span>
                          <strong className="text-white font-mono">{demoAttendance}%</strong>
                        </div>
                        <input
                          type="range"
                          min="35"
                          max="100"
                          value={demoAttendance}
                          onChange={(e) => setDemoAttendance(Number(e.target.value))}
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                          <span>Daily Study Hours</span>
                          <strong className="text-white font-mono">{demoStudyHours} hrs/day</strong>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="14"
                          step="0.5"
                          value={demoStudyHours}
                          onChange={(e) => setDemoStudyHours(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Model Cross-Validation Strip */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Random Forest</span>
                      <p className="mt-1 text-base font-black text-white">{calculatedScore.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">XGBoost</span>
                      <p className="mt-1 text-base font-black text-white">{(calculatedScore * 0.98).toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">CatBoost</span>
                      <p className="mt-1 text-base font-black text-white">{(calculatedScore * 0.99).toFixed(1)}%</p>
                    </div>
                  </div>
                  {/* Demo Disclaimer */}
                  <p className="text-[10px] text-slate-400 text-center mt-3 font-mono leading-relaxed">
                    *Interactive demonstration of interface mechanics. Authoritative predictive inference with exact TreeSHAP attribution requires authenticated student profile execution.
                  </p>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* BENTO GRID CAPABILITIES */}
      <section className="py-24 border-t border-white/8 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Architectural Rigor
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Engineered for Exactness, Not Black-Box Guesswork
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Built upon peer-reviewed ensemble techniques, deterministic thresholds, and game-theoretic explainability.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SpotlightCard className="lg:col-span-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 mb-4 border border-indigo-500/30">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Triple-Model Consensus Engine</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Rather than relying on a single fallible model, our pipeline orchestrates Random Forest,
                XGBoost, and CatBoost in parallel. This eliminates single-architecture biases and yields calibrated
                exam score estimations with confidence metrics.
              </p>
            </SpotlightCard>

            <SpotlightCard>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 mb-4 border border-cyan-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">TreeSHAP Explainability</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                True Shapley additive explanations deconstruct every prediction into exact mathematical point contributions,
                revealing exactly what drives an individual student's score.
              </p>
            </SpotlightCard>

            <SpotlightCard>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 mb-4 border border-rose-500/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Deterministic Risk Classification</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Clear deterministic rules categorize students into LOW, MODERATE, or HIGH risk. Multi-threshold
                vulnerabilities guarantee that failing trajectories are never obscured.
              </p>
            </SpotlightCard>

            <SpotlightCard className="lg:col-span-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 mb-4 border border-emerald-500/30">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Faculty Cohort Command Center</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Institutional oversight with live cohort aggregation, departmental scatter plots (Attendance vs. Score,
                Study Hours vs. Score), searchable student directories, and prioritized intervention queues.
              </p>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/8 py-12 text-center text-xs text-slate-500">
        <p>Student Performance Prediction & Academic Intelligence System</p>
        <p className="mt-1 text-slate-600">
          FastAPI  SQLite  SQLAlchemy  React 19  Tailwind CSS  Random Forest  XGBoost  CatBoost  SHAP
        </p>
      </footer>
    </div>
  );
};

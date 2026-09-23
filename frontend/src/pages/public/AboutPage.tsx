import React from "react";
import { Link } from "react-router-dom";
import { Cpu, ShieldCheck, Sparkles, Database, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#07090e] bg-grid-pattern text-slate-100 relative">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Overview
        </Link>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            System Architecture & Methodology
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Empirical Machine Learning Foundation
          </h1>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            Our predictive platform uses authentic mathematical and ensemble techniques, avoiding synthetic approximations
            in favor of verifiable inference.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          <Card>
            <div className="flex items-center gap-3 border-b border-white/8 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Multi-Model Ensemble Framework</h3>
                <p className="text-xs text-slate-400">Random Forest, XGBoost & CatBoost Architectures</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Every simulation executes simultaneously across three distinct tree-based architectures. Random Forest provides
              robust bagging variance reduction, XGBoost provides gradient-boosted decision refinement, and CatBoost handles
              categorical interactions without synthetic distortion.
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3 border-b border-white/8 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">TreeSHAP Mathematical Explainability</h3>
                <p className="text-xs text-slate-400">Game-Theoretic Shapley Decomposition</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              TreeSHAP evaluates each student's features against population baseline expectations. By computing exact
              marginal contributions, the system quantifies the exact score differential (+/- points) introduced by study hours,
              attendance rates, and academic habits.
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3 border-b border-white/8 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Deterministic Multi-Tier Risk Logic</h3>
                <p className="text-xs text-slate-400">Zero Inconsistent Classifications</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Academic risk is classified deterministically: students with critical scores (&lt;40) or low attendance (&lt;60%)
              are immediately prioritized into the HIGH risk tier with actionable counseling recommendations.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

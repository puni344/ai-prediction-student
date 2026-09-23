import React, { useEffect, useState } from "react";
import { predictionService } from "../../services/api";
import { PredictionResponse } from "../../types";
import { Card } from "../../components/common/Card";
import { RiskBadge } from "../../components/common/RiskBadge";
import { TrendChart } from "../../components/charts/TrendChart";
import { LoadingState } from "../../components/common/LoadingState";
import { EmptyState } from "../../components/common/EmptyState";
import { TrendingUp, Clock } from "lucide-react";

export const ProgressPage: React.FC = () => {
  const [history, setHistory] = useState<PredictionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await predictionService.getHistory();
        setHistory(data);
      } catch {
        // Error
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading simulation history log..." />;
  }

  if (history.length === 0) {
    return (
      <EmptyState
        title="No Progress Recorded"
        description="Run predictions to start logging your trajectory."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Trajectory History</h1>
        <p className="mt-1 text-xs text-slate-400">
          Chronological simulation timeline and score trends.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <TrendingUp className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Score Trajectory</h2>
        </div>
        <div className="mt-4">
          <TrendChart data={history} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <Clock className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Simulation Log ({history.length})</h2>
        </div>

        <div className="mt-3 divide-y divide-white/6">
          {history.map((item, idx) => (
            <div key={item.id} className="flex items-center justify-between py-3 text-xs">
              <div>
                <span className="font-bold text-white">Simulation #{history.length - idx}</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {item.created_at ? new Date(item.created_at).toLocaleString() : "Recent"}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-black text-white">{item.predicted_score.toFixed(1)}%</span>
                <RiskBadge level={item.risk_level} showDot={false} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

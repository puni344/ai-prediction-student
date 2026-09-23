import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingState: React.FC<{ message?: string }> = ({
  message = "Loading real intelligence data...",
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-14 text-center">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 shadow-lg shadow-indigo-500/10">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-300">{message}</p>
    </div>
  );
};

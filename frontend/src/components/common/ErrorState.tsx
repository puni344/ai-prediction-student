import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string | any;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Evaluation Error",
  message,
  onRetry,
}) => {
  const displayMessage =
    typeof message === "string"
      ? message
      : (message?.message || message?.code || "An unexpected error occurred.");

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center backdrop-blur-md">
      <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
      <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs text-rose-300/90">{displayMessage}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="danger" size="sm" onClick={onRetry}>
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};

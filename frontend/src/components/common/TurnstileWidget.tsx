import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  memo,
} from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          appearance?: "always" | "execute" | "interaction-only";
          callback?: (token: string) => void;
          "error-callback"?: (errorCode: string) => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileWidgetRef {
  reset: () => void;
  getWidgetId: () => string | null;
  getStatus: () => TurnstileStatus;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  action?: string;
  onSuccess: (token: string) => void;
  onError?: (errorCode?: string) => void;
  onExpire?: () => void;
  theme?: "dark" | "light" | "auto";
  className?: string;
}

export type TurnstileStatus = "idle" | "verifying" | "verified" | "failed" | "expired" | "resetting";

export const TurnstileWidgetComponent = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  (
    {
      siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY,
      action = "student_signup",
      onSuccess,
      onError,
      onExpire,
      theme = "dark",
      className = "",
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const hasRenderedRef = useRef<boolean>(false);

    // Keep callback refs fresh without causing re-renders or widget recreation
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
      onSuccessRef.current = onSuccess;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    });

    const [status, setStatus] = useState<TurnstileStatus>("verifying");

    const doReset = useCallback(() => {
      if (!isMountedRef.current) return;
      console.log("[Turnstile Diagnostics] Requesting widget reset...");
      setStatus("verifying");
      if (widgetIdRef.current && window.turnstile && typeof window.turnstile.reset === "function") {
        try {
          window.turnstile.reset(widgetIdRef.current);
          console.log("[Turnstile Diagnostics] Widget reset called for ID:", widgetIdRef.current);
        } catch (err) {
          console.warn("[Turnstile Diagnostics] Failed to reset widget ID, re-rendering:", err);
          renderWidget();
        }
      } else {
        renderWidget();
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reset: doReset,
        getWidgetId: () => widgetIdRef.current,
        getStatus: () => status,
      }),
      [doReset, status]
    );

    const renderWidget = useCallback(() => {
      if (!isMountedRef.current || !containerRef.current) return;

      if (!window.turnstile || typeof window.turnstile.render !== "function") {
        return;
      }

      // If already rendered on this container, try reset first
      if (widgetIdRef.current) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setStatus("verifying");
          return;
        } catch (err) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {
            // Ignore cleanup error
          }
          widgetIdRef.current = null;
        }
      }

      try {
        containerRef.current.innerHTML = "";
        console.log("[Turnstile Diagnostics] Widget mounted: YES");

        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          size: "normal",
          appearance: "always",
          callback: (token: string) => {
            if (!isMountedRef.current) return;
            console.log("[Turnstile Diagnostics] Success callback: YES | Token present: YES");
            setStatus("verified");
            onSuccessRef.current?.(token);
          },
          "error-callback": (code: string) => {
            if (!isMountedRef.current) return;
            console.warn(`[Turnstile Diagnostics] Error callback code: ${code}`);
            setStatus("failed");
            onErrorRef.current?.(code);
          },
          "expired-callback": () => {
            if (!isMountedRef.current) return;
            console.log("[Turnstile Diagnostics] Expired callback: YES");
            // 1. Clear token in parent
            onExpireRef.current?.();
            // 2. Set user-facing status to Verifying...
            setStatus("verifying");
            // 3. Reset widget to obtain a fresh token automatically
            if (widgetIdRef.current && window.turnstile) {
              try {
                window.turnstile.reset(widgetIdRef.current);
              } catch (e) {
                renderWidget();
              }
            }
          },
          "timeout-callback": () => {
            if (!isMountedRef.current) return;
            console.warn("[Turnstile Diagnostics] Timeout callback: YES");
            setStatus("failed");
            onErrorRef.current?.("timeout");
          },
        });

        widgetIdRef.current = id;
        hasRenderedRef.current = true;
        setStatus("verifying");
      } catch (err) {
        console.error("[Turnstile Diagnostics] Render error:", err);
        setStatus("failed");
      }
    }, [siteKey, action, theme]);

    useEffect(() => {
      isMountedRef.current = true;

      if (window.turnstile && typeof window.turnstile.render === "function") {
        renderWidget();
      } else {
        const interval = setInterval(() => {
          if (window.turnstile && typeof window.turnstile.render === "function") {
            clearInterval(interval);
            if (isMountedRef.current && !widgetIdRef.current) {
              renderWidget();
            }
          }
        }, 100);

        const timeout = setTimeout(() => {
          clearInterval(interval);
          if (isMountedRef.current && !widgetIdRef.current) {
            setStatus("failed");
          }
        }, 10000);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      }

      return () => {
        isMountedRef.current = false;
        if (widgetIdRef.current && window.turnstile && typeof window.turnstile.remove === "function") {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {
            // Ignore cleanup error
          }
          widgetIdRef.current = null;
        }
      };
    }, [renderWidget]);

    if (!siteKey) {
      return (
        <div className="my-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Security verification is not configured.</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`my-4 rounded-xl border border-white/10 bg-[#0d111a] p-4 backdrop-blur-md shadow-lg ${className}`}>
        {/* Header with status badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span>Security Verification</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium">
            {(status === "verifying" || status === "resetting" || status === "idle" || status === "expired") && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Verifying...</span>
              </span>
            )}
            {status === "verified" && (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>✓ Verified</span>
              </span>
            )}
            {status === "failed" && (
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>✕ Verification failed. Please try again.</span>
              </span>
            )}
          </div>
        </div>

        {/* Turnstile Container */}
        <div className="flex flex-col items-center justify-center min-h-[65px] py-1">
          <div ref={containerRef} className="turnstile-container flex justify-center w-full" />

          {status === "failed" && (
            <button
              type="button"
              onClick={doReset}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);

TurnstileWidgetComponent.displayName = "TurnstileWidget";
export const TurnstileWidget = memo(TurnstileWidgetComponent);

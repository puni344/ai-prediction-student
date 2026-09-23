import React, { useState } from "react";
import { Bot, User, Copy, Check, ShieldCheck, Sparkles, Cpu } from "lucide-react";
import type { ChatMessage } from "../../types";

interface ChatMessageItemProps {
  message: ChatMessage;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and highlighted metrics.
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex to match **bold**, `code`, and *italic*
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith("**") && raw.endsWith("**")) {
      tokens.push(
        <strong key={match.index} className="font-semibold text-cyan-300">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      tokens.push(
        <code key={match.index} className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[11px] text-amber-300 border border-slate-700/60">
          {raw.slice(1, -1)}
        </code>
      );
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      tokens.push(
        <em key={match.index} className="italic text-slate-300">
          {raw.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }
  return tokens;
}

/**
 * Safe, zero-dependency Markdown renderer for academic advisor chat responses.
 */
export const SafeMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (currentList.length > 0 && listType) {
      if (listType === "ul") {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2 space-y-1.5 pl-4 list-disc marker:text-cyan-400">
            {currentList}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2 space-y-1.5 pl-4 list-decimal marker:text-cyan-400">
            {currentList}
          </ol>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      return;
    }

    // Headers: ###, ##, #
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${idx}`} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
          {parseInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${idx}`} className="mt-3 mb-1.5 text-sm font-bold text-white">
          {parseInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${idx}`} className="mt-3 mb-2 text-base font-bold text-white">
          {parseInline(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    // Bullet points: - , * , •
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      currentList.push(
        <li key={`li-${idx}`} className="text-xs sm:text-sm text-slate-200 leading-relaxed">
          {parseInline(itemText)}
        </li>
      );
      return;
    }

    // Numbered list: 1. , 2.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      currentList.push(
        <li key={`oli-${idx}`} className="text-xs sm:text-sm text-slate-200 leading-relaxed">
          {parseInline(numMatch[2])}
        </li>
      );
      return;
    }

    // Blockquote: >
    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          className="my-2 border-l-2 border-cyan-500/60 bg-cyan-950/20 px-3 py-1.5 text-xs italic text-cyan-200/90 rounded-r-lg"
        >
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Normal paragraph
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="my-1.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
        {parseInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Provider status formatting
  const getProviderStatusBadge = () => {
    if (message.ai_status === "live_gemini") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Gemini — Live</span>
        </span>
      );
    }
    if (message.ai_status === "deterministic_fallback") {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span>Deterministic Fallback</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
        <Sparkles className="h-2.5 w-2.5" />
        <span>Academic AI</span>
      </span>
    );
  };

  // Capability badge formatting
  const getCapabilityBadge = () => {
    if (!message.capability_used || message.capability_used === "GENERAL_CHAT") return null;
    const labels: Record<string, string> = {
      GENERATE_STUDY_PLAN: "Study Planner",
      GENERATE_RECOMMENDATIONS: "Priority Engine",
      EXPLAIN_PREDICTION: "Prediction Explainer",
      EXPLAIN_RISK: "Risk Explainer",
      EXPLAIN_SHAP: "Feature Drivers",
    };
    return (
      <span className="flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-slate-700/60">
        <Cpu className="h-2.5 w-2.5 text-cyan-400" />
        <span>{labels[message.capability_used] || message.capability_used}</span>
      </span>
    );
  };

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mt-0.5 shadow-sm shadow-cyan-950">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`relative max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 text-xs sm:text-sm shadow-md ${
          isUser
            ? "bg-cyan-600 text-white rounded-br-none shadow-cyan-950/40"
            : "bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none shadow-black/40"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">{message.content}</p>
        ) : (
          <SafeMarkdownRenderer content={message.content} />
        )}

        {/* Source-of-truth Verified Context Chips (Section 18) */}
        {!isUser && message.context_used && message.context_used.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Based on your data:</span>
            </span>
            {message.context_used.map((factor) => (
              <span
                key={factor}
                className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] font-mono text-cyan-300 border border-slate-700/50"
              >
                {factor.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Message Footer: Status + Capability + Timestamp + Copy */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/40 text-[10px] text-slate-400 font-mono">
          {!isUser ? (
            <div className="flex items-center gap-2">
              {getProviderStatusBadge()}
              {getCapabilityBadge()}
            </div>
          ) : (
            <span className="text-cyan-200/80">You</span>
          )}

          <div className="flex items-center gap-2">
            <span>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={handleCopy}
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:text-cyan-300"
              title="Copy message"
              aria-label="Copy message text"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300 mt-0.5">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};

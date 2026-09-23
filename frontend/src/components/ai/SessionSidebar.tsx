import React from "react";
import { MessageSquare, PlusCircle, Clock, Sparkles, Trash2 } from "lucide-react";
import type { ChatSession } from "../../types";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelectSession: (id: number) => void;
  onCreateSession: () => void;
  onClearHistory?: () => void;
  loading?: boolean;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onClearHistory,
  loading = false,
}) => {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800/90 bg-slate-900/70 backdrop-blur-xl p-4 shadow-xl">
      {/* Header with New Session Button */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Advisory Chats
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {sessions.length > 0 && onClearHistory && (
            <button
              onClick={onClearHistory}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Clear all chat history"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={onCreateSession}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
            title="Start a new chat session"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <MessageSquare className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">No previous sessions</p>
            <button
              onClick={onCreateSession}
              className="mt-3 text-xs text-cyan-400 hover:underline cursor-pointer"
            >
              Start first session
            </button>
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            return (
              <button
                key={sess.id}
                onClick={() => onSelectSession(sess.id)}
                className={`w-full text-left rounded-xl p-2.5 transition-all duration-200 flex flex-col gap-1 border cursor-pointer ${
                  isActive
                    ? "border-cyan-500/40 bg-cyan-950/30 text-white shadow-sm shadow-cyan-950"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate flex-1">
                    {sess.title || "Academic Advisory"}
                  </span>
                  {sess.message_count !== undefined && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] font-mono text-slate-400 shrink-0">
                      {sess.message_count} msgs
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <Clock className="h-2.5 w-2.5 text-slate-400" />
                  <span>
                    {new Date(sess.updated_at || sess.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono flex items-center justify-between">
        <span>Total: {sessions.length} sessions</span>
        {sessions.length > 0 && onClearHistory ? (
          <button
            onClick={onClearHistory}
            className="text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            Clear All
          </button>
        ) : (
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Isolated & Private
          </span>
        )}
      </div>
    </div>
  );
};

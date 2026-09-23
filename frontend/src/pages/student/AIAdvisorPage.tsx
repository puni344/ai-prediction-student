import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Trash2,
  Bot,
  Send,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  Target,
  Search,
  AlertTriangle,
  BookOpen,
  BarChart3,
  Brain,
  Plus,
} from "lucide-react";
import { chatService } from "../../services/api";
import { extractErrorMessage } from "../../utils/errors";
import { SessionSidebar } from "../../components/ai/SessionSidebar";
import { ChatMessageItem } from "../../components/ai/ChatMessageItem";
import type { ChatSession, ChatMessage } from "../../types";

const FAQ_QUESTIONS = [
  {
    id: "predicted_performance",
    label: "Predicted Performance",
    question: "What is my predicted performance?",
    icon: <Target className="h-4 w-4 text-cyan-400" />,
    color: "hover:border-cyan-500/50 hover:bg-cyan-500/10",
  },
  {
    id: "why_prediction",
    label: "Why This Prediction",
    question: "Why did I get this prediction?",
    icon: <Search className="h-4 w-4 text-indigo-400" />,
    color: "hover:border-indigo-500/50 hover:bg-indigo-500/10",
  },
  {
    id: "risk_factors",
    label: "Risk Factors",
    question: "What are my main risk factors?",
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    color: "hover:border-amber-500/50 hover:bg-amber-500/10",
  },
  {
    id: "what_to_improve",
    label: "What To Improve",
    question: "What should I improve first?",
    icon: <BookOpen className="h-4 w-4 text-emerald-400" />,
    color: "hover:border-emerald-500/50 hover:bg-emerald-500/10",
  },
  {
    id: "explain_factors",
    label: "Explain My Factors",
    question: "Explain my SHAP factors.",
    icon: <BarChart3 className="h-4 w-4 text-violet-400" />,
    color: "hover:border-violet-500/50 hover:bg-violet-500/10",
  },
  {
    id: "my_recommendations",
    label: "My Recommendations",
    question: "How are my learning recommendations generated?",
    icon: <Brain className="h-4 w-4 text-pink-400" />,
    color: "hover:border-pink-500/50 hover:bg-pink-500/10",
  },
];

export const AIAdvisorPage: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingHistory, setDeletingHistory] = useState<boolean>(false);

  const [showJumpToBottom, setShowJumpToBottom] = useState<boolean>(false);
  const isNearBottomRef = useRef<boolean>(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (smooth = true) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    setShowJumpToBottom(false);
  };

  const handleContainerScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 80;
    isNearBottomRef.current = nearBottom;
    setShowJumpToBottom(!nearBottom);
  };

  const loadSessions = async () => {
    try {
      const res = await chatService.getSessions();
      setSessions(res);
      if (res.length > 0 && !activeSessionId) {
        setActiveSessionId(res[0].id);
      }
    } catch (err) {
      console.error("Failed to load chat sessions", err);
    }
  };

  const loadMessages = async (sessionId: number) => {
    try {
      const msgs = await chatService.getMessages(sessionId);
      setMessages(msgs);
      setTimeout(() => scrollToBottom(false), 50);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || sendingMessage) return;

    const optimisticUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: activeSessionId || 0,
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInputMessage("");
    setChatError(null);
    setSendingMessage(true);

    setTimeout(() => scrollToBottom(true), 50);

    try {
      const newMsg = await chatService.sendMessage(textToSend, activeSessionId || undefined);
      if (!activeSessionId) {
        setActiveSessionId(newMsg.session_id);
        await loadSessions();
      }
      setMessages((prev) => [...prev, newMsg]);

      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 60);
      } else {
        setShowJumpToBottom(true);
      }
    } catch (err: any) {
      setChatError(extractErrorMessage(err, "We couldn't load your academic insight right now. Please try again."));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateNewSession = async () => {
    try {
      const newSession = await chatService.createSession("Academic Advisory Session");
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create chat session", err);
    }
  };

  const handleClearAllChats = async () => {
    try {
      setDeletingHistory(true);
      await chatService.clearHistory();
      setSessions([]);
      setMessages([]);
      setActiveSessionId(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error("Failed to clear chat history", err);
      setChatError("Failed to clear chat history. Please try again.");
    } finally {
      setDeletingHistory(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/8 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-400 shadow-md">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              AI ACADEMIC ADVISOR
            </h1>
            <p className="text-xs text-slate-400">
              Personalized academic guidance based on your verified data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
              title="Delete all chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Chat History</span>
            </button>
          )}
          <button
            onClick={handleCreateNewSession}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors cursor-pointer w-fit"
          >
            <Plus className="h-3.5 w-3.5 text-cyan-400" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN EXPERIENCE: Left Sessions Sidebar + Main Conversation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Sessions Navigation */}
        <div className="hidden lg:block lg:col-span-3 h-[780px]">
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onCreateSession={handleCreateNewSession}
            onClearHistory={() => setShowDeleteConfirm(true)}
          />
        </div>

        {/* CENTER / MAIN: AI Academic Advisor Conversation */}
        <div className="lg:col-span-9 flex flex-col h-[780px] rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl relative">
          {/* Main Panel Header with 6 Primary FAQ Question Chips */}
          <div className="border-b border-white/8 p-4 sm:p-5 bg-slate-950/60 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select a Question to Get Guidance
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">
                Verified Academic Data
              </span>
            </div>

            {/* 6 Primary Supported Question Cards/Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FAQ_QUESTIONS.map((faq) => (
                <button
                  key={faq.id}
                  type="button"
                  onClick={() => handleSendMessage(faq.question)}
                  disabled={sendingMessage}
                  className={`group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/4 p-2.5 text-left transition-all cursor-pointer ${faq.color} disabled:opacity-50`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                    {faq.icon}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                    {faq.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Messages Viewport */}
          <div
            ref={messagesContainerRef}
            onScroll={handleContainerScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-xl">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Select a question above to begin
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
                    Choose one of the six primary questions above to receive instant,
                    deterministic academic guidance based on your verified performance data.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessageItem key={msg.id} message={msg} />
              ))
            )}

            {sendingMessage && (
              <div className="flex items-start gap-3 animate-fadeIn">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-none bg-slate-900 border border-white/10 px-4 py-3 text-xs text-slate-300 flex items-center gap-2.5 shadow-md">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-slate-400 text-xs">Analyzing your verified academic data...</span>
                </div>
              </div>
            )}
          </div>

          {/* Floating Jump to Latest Button */}
          {showJumpToBottom && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-24 right-6 z-20 flex items-center gap-1.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-sm transition-all border border-cyan-400/40 cursor-pointer"
            >
              <span>New response ↓</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Error Bar */}
          {chatError && (
            <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 text-xs text-rose-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>{chatError}</span>
              </div>
              <button
                onClick={() => setChatError(null)}
                className="text-[11px] underline hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Controlled Question Composer */}
          <div className="border-t border-white/8 p-3.5 bg-slate-950/80 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Select a question above or enter an academic inquiry..."
                  maxLength={500}
                  className="w-full rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  disabled={sendingMessage}
                />
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || sendingMessage}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white transition-all hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 shadow-md shadow-cyan-950/40 cursor-pointer"
                title="Send inquiry"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-1.5 text-[10px] text-slate-500 px-1">
              Select any of the 6 supported advisor questions above to receive instant guidance.
            </p>
          </div>
        </div>
      </div>
      {/* Delete All Chats Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0d121c] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/25">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete all chat history?</h3>
                <p className="text-xs text-slate-400">Permanently remove saved advisory conversations</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently remove your saved AI Advisor conversations. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingHistory}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl border border-white/10 hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllChats}
                disabled={deletingHistory}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-lg shadow-rose-950/50 cursor-pointer flex items-center gap-1.5"
              >
                {deletingHistory ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Delete All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
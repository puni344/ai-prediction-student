import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, LogOut, User as UserIcon, Menu, X, Shield, Cpu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../common/Button";

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/8 bg-[#07090e]/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Subtle top light sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="flex items-center gap-3">
        {isAuthenticated && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white transition-colors lg:hidden"
            aria-label="Toggle Navigation"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
        <Link to="/" className="group flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-indigo-600/30 to-cyan-500/20 shadow-lg shadow-indigo-500/15 transition-transform duration-300 group-hover:scale-105">
            <Cpu className="h-5 w-5 text-indigo-400 group-hover:text-cyan-300 transition-colors" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white group-hover:text-slate-100">
                StudentPredict
              </span>
              <span className="hidden rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 sm:inline-block">
                AI Intelligence
              </span>
            </div>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-white">{user.full_name}</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {user.role}
                </span>
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 shadow-inner">
              <UserIcon className="h-4 w-4" />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-slate-300 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5 sm:mr-1.5 text-slate-400" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Link to="/about">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                Platform
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

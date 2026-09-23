import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  User,
  Activity,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  MessageSquareCode,
  Settings,
  Users,
  BarChart3,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();

  const studentLinks: NavItem[] = [
    { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student/profile", label: "Profile & Attributes", icon: User },
    { to: "/student/prediction", label: "Simulation Lab", icon: Activity },
    { to: "/student/results", label: "Latest Outcome", icon: FileCheck2 },
    { to: "/student/explainability", label: "TreeSHAP Explainability", icon: Sparkles },
    { to: "/student/risk-analysis", label: "Risk Diagnosis", icon: AlertTriangle },
    { to: "/student/performance-analysis", label: "Performance Analysis", icon: BarChart3 },
    { to: "/student/timetable", label: "My Study Timetable", icon: Calendar },
    {
      to: "/student/ai-advisor",
      label: "AI Study Advisor",
      icon: MessageSquareCode,
      badge: "Preview",
    },
    { to: "/student/settings", label: "Settings", icon: Settings },
  ];

  const adminLinks: NavItem[] = [
    { to: "/admin/dashboard", label: "Institutional Overview", icon: LayoutDashboard },
    { to: "/admin/students", label: "Student Management", icon: Users },
    { to: "/admin/faculty", label: "Faculty Management", icon: ShieldCheck },
    { to: "/admin/calendar", label: "Academic Calendar", icon: Calendar },
  ];

  const facultyLinks: NavItem[] = [
    { to: "/faculty/dashboard", label: "Cohort Intelligence", icon: LayoutDashboard },
    { to: "/faculty/students", label: "Student Directory", icon: Users },
    { to: "/faculty/performance-analysis", label: "Performance Analysis", icon: BarChart3 },
    { to: "/faculty/analytics", label: "Department Analytics", icon: TrendingUp },
    { to: "/faculty/risk-monitor", label: "Early Warning Risk", icon: ShieldCheck },
    { to: "/faculty/settings", label: "Settings", icon: Settings },
  ];

  const links = role === "admin" ? adminLinks : role === "faculty" ? facultyLinks : studentLinks;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-md lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 border-r border-white/8 bg-[#0a0d15]/95 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col justify-between p-4">
          <div className="space-y-1.5">
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {role === "admin" ? "Institutional Administration" : role === "faculty" ? "Faculty Command Center" : "Student Intelligence Console"}
              </p>
            </div>
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "border-l-2 border-indigo-400 bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent text-white shadow-xs"
                        : "text-slate-400 hover:bg-white/4 hover:text-slate-200"
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-indigo-400" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded-md border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Model Status Card */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-3.5 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Ensemble Online
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Random Forest  XGBoost  CatBoost with exact TreeSHAP attributions.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

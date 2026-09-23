import React from "react";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { User, ShieldCheck, Lock, Bell, Sparkles, CheckCircle2 } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Account Settings</h1>
        <p className="mt-1 text-xs text-slate-400">
          Manage your account security, profile preferences, and platform privacy settings.
        </p>
      </div>

      {/* Identity & Profile Overview */}
      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <User className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Student Account Identity</h2>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Full Name</span>
            <strong className="text-white font-medium">{user?.full_name || "Not specified"}</strong>
          </div>
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Email Address</span>
            <strong className="text-white font-medium">{user?.email}</strong>
          </div>
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Account Type</span>
            <span className="text-emerald-400 font-semibold uppercase tracking-wider">
              {user?.role === "student" ? "Verified Student" : user?.role}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Authentication Method</span>
            <span className="text-slate-300 font-medium capitalize">
              {user?.auth_provider || "Standard Secure Login"}
            </span>
          </div>
        </div>
      </Card>

      {/* Account Security */}
      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Account & Data Security</h2>
        </div>
        <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            Your student account is protected by cryptographic password encryption and secure session tokens.
            All academic predictions and timetable schedules are private to your account and accessible only
            by you and authorized department faculty.
          </p>
          <div className="pt-2 flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>End-to-End Account Protection Active</span>
          </div>
        </div>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <Bell className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Notification Preferences</h2>
        </div>
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-white/4">
            <div>
              <p className="font-semibold text-white">Daily Performance Snapshot Updates</p>
              <p className="text-slate-400 text-[11px]">Receive notification when your 09:00 AM daily prediction is generated</p>
            </div>
            <span className="text-indigo-400 font-semibold text-[11px] bg-indigo-500/10 px-2 py-1 rounded">Enabled</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/4">
            <div>
              <p className="font-semibold text-white">Academic Calendar & Holiday Alerts</p>
              <p className="text-slate-400 text-[11px]">Instant updates on institution-wide holidays and schedule revisions</p>
            </div>
            <span className="text-indigo-400 font-semibold text-[11px] bg-indigo-500/10 px-2 py-1 rounded">Enabled</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

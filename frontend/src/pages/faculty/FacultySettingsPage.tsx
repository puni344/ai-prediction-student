import React from "react";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/common/Card";
import { Settings, Shield, User, Building } from "lucide-react";

export const FacultySettingsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Faculty Command Settings</h1>
        <p className="mt-1 text-xs text-slate-400">Department configuration and account credentials.</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <User className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Faculty Credentials</h2>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Faculty Name:</span>
            <strong className="text-white">{user?.full_name}</strong>
          </div>
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Institutional Email:</span>
            <strong className="text-white">{user?.email}</strong>
          </div>
          <div className="flex justify-between py-2 border-b border-white/4">
            <span className="text-slate-400">Authorization Level:</span>
            <strong className="text-cyan-400 uppercase">{user?.role}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <Building className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Departmental Scope</h2>
        </div>
        <p className="mt-3 text-xs text-slate-300 leading-relaxed">
          Assigned to cross-departmental cohort oversight. Real-time inference queries the institutional SQLite database.
        </p>
      </Card>
    </div>
  );
};

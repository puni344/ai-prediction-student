import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#07090e] bg-grid-pattern text-slate-100">
      {/* Atmospheric ambient glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-indigo-500/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[500px] h-[350px] bg-cyan-500/5 blur-[120px] rounded-full" />

      <div className="shrink-0 z-40">
        <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} isSidebarOpen={sidebarOpen} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="relative z-10 flex-1 h-[calc(100vh-4rem)] overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

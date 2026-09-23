import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import { LoadingState } from "../components/common/LoadingState";

interface RoleProtectedRouteProps {
  allowedRoles: UserRole[];
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ allowedRoles }) => {
  const { role, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#07090e]">
        <LoadingState message="Verifying permissions..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (location.pathname.startsWith("/admin")) {
      return <Navigate to="/admin/login" replace />;
    }
    if (location.pathname.startsWith("/faculty")) {
      return <Navigate to="/faculty/login" replace />;
    }
    return <Navigate to="/student/login" replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    if (role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (role === "faculty") {
      return <Navigate to="/faculty/dashboard" replace />;
    }
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Outlet />;
};

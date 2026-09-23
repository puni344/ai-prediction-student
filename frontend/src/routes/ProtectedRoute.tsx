import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/common/LoadingState";

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isEmailVerified, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#07090e]">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // If token exists but email is not verified, redirect to verify-email
    if (user && !isEmailVerified) {
      return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email)}`} replace />;
    }
    // Direct unauthenticated users to the role-specific login page
    if (location.pathname.startsWith("/admin")) {
      return <Navigate to="/admin/login" replace />;
    }
    if (location.pathname.startsWith("/faculty")) {
      return <Navigate to="/faculty/login" replace />;
    }
    return <Navigate to="/student/login" replace />;
  }

  return <Outlet />;
};

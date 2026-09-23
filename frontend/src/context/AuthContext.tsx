import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { authService } from "../services/api";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isLoading: boolean;
  login: (token: string, role: UserRole) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [role, setRole] = useState<UserRole | null>(
    (localStorage.getItem("role") as UserRole) || null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setUser(null);
      setRole(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authService.getMe();
      const normRole = userData.role ? (userData.role.toLowerCase() as UserRole) : null;
      setUser({ ...userData, role: normRole || (userData.role as UserRole) });
      setRole(normRole);
    } catch (err: any) {
      // If unverified or invalid token, clear session
      if (err.response?.status === 403 && err.response?.data?.detail === "EMAIL_NOT_VERIFIED") {
        console.warn("User email not verified");
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setToken(null);
        setUser(null);
        setRole(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (newToken: string, userRole: UserRole) => {
    const normRole = userRole ? (userRole.toLowerCase() as UserRole) : userRole;
    localStorage.setItem("token", newToken);
    localStorage.setItem("role", normRole);
    setToken(newToken);
    setRole(normRole);
    await refreshUser();
  };

  const logout = () => {
    const currentRole = role;
    const currentPath = window.location.pathname;
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setToken(null);
    setUser(null);
    setRole(null);
    if (currentRole === "admin" || currentPath.startsWith("/admin")) {
      window.location.href = "/admin/login";
    } else if (currentRole === "faculty" || currentPath.startsWith("/faculty")) {
      window.location.href = "/faculty/login";
    } else {
      window.location.href = "/student/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!token && !!user && (user.is_email_verified !== false),
        isEmailVerified: user ? user.is_email_verified !== false : false,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

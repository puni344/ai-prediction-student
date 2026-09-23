import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { AlertCircle } from "lucide-react";
import { GoogleProfileCompletionModal } from "./GoogleProfileCompletionModal";

interface GoogleSignInButtonProps {
  buttonText?: string;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  buttonText = "Continue with Google",
  onError,
}) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!googleClientId) return;

    const initializeGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "filled_black",
            size: "large",
            width: 360,
            text: buttonText === "Register with Google" ? "signup_with" : "signin_with",
            shape: "rectangular",
          });
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          initializeGoogle();
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [googleClientId, buttonText]);

  const handleCredentialResponse = async (response: any) => {
    const idToken = response.credential;
    if (!idToken) {
      onError?.("No credential received from Google.");
      return;
    }

    setIsLoading(true);
    setConfigError(null);

    try {
      // Send REAL Google ID token to FastAPI backend for strict validation
      const data = await authService.googleAuth({ id_token: idToken });
      await login(data.access_token, data.role);

      if (data.requires_profile_completion || !data.profile_complete) {
        setUserEmail(data.role);
        setShowProfileModal(true);
      } else {
        if (data.role === "faculty") {
          navigate("/faculty/dashboard");
        } else {
          navigate("/student/dashboard");
        }
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Google authentication failed.";
      setConfigError(detail);
      onError?.(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualClick = () => {
    if (!googleClientId) {
      const msg = "Google Sign-In is not configured. Please specify VITE_GOOGLE_CLIENT_ID in your environment.";
      setConfigError(msg);
      onError?.(msg);
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      const msg = "Google Identity Services SDK is still loading. Please try again in a moment.";
      setConfigError(msg);
      onError?.(msg);
    }
  };

  return (
    <div className="w-full">
      {configError && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{configError}</span>
        </div>
      )}

      {googleClientId ? (
        <div ref={googleBtnRef} className="w-full flex justify-center overflow-hidden rounded-xl" />
      ) : (
        <button
          type="button"
          onClick={handleManualClick}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/5 py-2.5 px-4 text-xs font-semibold text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-sm cursor-pointer"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isLoading ? "Authenticating..." : buttonText}</span>
        </button>
      )}

      <GoogleProfileCompletionModal
        isOpen={showProfileModal}
        userEmail={userEmail}
      />
    </div>
  );
};

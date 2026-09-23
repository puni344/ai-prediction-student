import React from "react";
import { useLocation } from "react-router-dom";
import { StudentLoginForm } from "../../components/auth/StudentLoginForm";
import { StudentRegisterForm } from "../../components/auth/StudentRegisterForm";

interface StudentAuthPageProps {
  initialView?: "login" | "register";
}

export const StudentAuthPage: React.FC<StudentAuthPageProps> = ({ initialView }) => {
  const location = useLocation();
  const isRegister =
    initialView === "register" ||
    location.pathname.includes("/register") ||
    location.pathname.includes("/signup");

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-[#07090e] bg-grid-pattern px-4 py-12 sm:px-6 lg:px-8 text-slate-100 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/10 blur-[130px] rounded-full" />
      <div className="relative z-10">
        {isRegister ? <StudentRegisterForm /> : <StudentLoginForm />}
      </div>
    </div>
  );
};

import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entra en tu cuenta de ELI para acceder a tus conversaciones.",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <LoginForm />
    </div>
  );
}

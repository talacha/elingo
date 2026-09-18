import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Registrarse",
  description: "Crea una cuenta para guardar tus conversaciones con ELI.",
};

export default function SignupPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <SignupForm />
    </div>
  );
}

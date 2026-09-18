import type { Metadata } from "next";
import { ProfileForm } from "@/components/auth/ProfileForm";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Edita el perfil de la alumna.",
};

export default function ProfilePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <ProfileForm />
    </div>
  );
}

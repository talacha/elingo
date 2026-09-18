import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Administración",
  description: "Dashboard de administración.",
};

export default function AdminPage() {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-8">
      <AdminDashboard />
    </div>
  );
}

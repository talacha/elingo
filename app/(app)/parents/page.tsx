import type { Metadata } from "next";
import { ParentsDashboard } from "@/components/parents/ParentsDashboard";

export const metadata: Metadata = {
  title: "Área de padres",
  description: "Accede a la configuración y el progreso de tu hijo o hija.",
};

export default function ParentsPage() {
  return (
    <div className="min-h-[calc(100vh-200px)]">
      <ParentsDashboard />
    </div>
  );
}

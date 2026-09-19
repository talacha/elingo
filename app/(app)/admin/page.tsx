import { redirect } from "next/navigation";

/** /admin no tiene contenido propio: cada sección vive en su ruta. */
export default function AdminIndexPage() {
  redirect("/admin/users");
}

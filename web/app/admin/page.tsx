import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/rate-limit";
import { notFound } from "next/navigation";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const { userId } = await requireAuth();

  if (!isAdmin(userId)) {
    notFound();
  }

  return <AdminClient />;
}

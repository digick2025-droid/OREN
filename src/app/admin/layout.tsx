import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/admin/guard";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return (
    <div className="min-h-dvh bg-surface">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

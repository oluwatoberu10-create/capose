import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentCommissions, agents, enquiries, orders } from "@/db/schema";
import { AdminShell } from "@/components/admin/shell";
import { pageAdmin } from "@/server/auth";
import { getSite } from "@/server/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await pageAdmin();
  const [site, [o], [e], [a], [c]] = await Promise.all([
    getSite(),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(enquiries).where(eq(enquiries.status, "new")),
    db.select({ n: sql<number>`count(*)::int` }).from(agents).where(eq(agents.status, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(agentCommissions).where(eq(agentCommissions.status, "pending")),
  ]);
  return (
    <AdminShell user={{ name: admin.name, role: admin.role }} permissions={admin.permissions} siteName={site.name}
      counts={{ pendingOrders: o.n, newEnquiries: e.n, pendingAgents: a.n, pendingCommissions: c.n }}>
      {children}
    </AdminShell>
  );
}

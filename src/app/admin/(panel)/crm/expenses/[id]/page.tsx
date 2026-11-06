import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { ExpenseForm } from "@/components/admin/expense-form";
import { Notice, PageHeader, Section } from "@/components/ui";
import { pageAdmin } from "@/server/auth";
import { vehicleOptions } from "@/server/services/vehicles";

export const metadata = { title: "Edit expense" };

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin("finance");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[e], vehicleList] = await Promise.all([db.select().from(expenses).where(eq(expenses.id, id)).limit(1), vehicleOptions()]);
  if (!e) notFound();
  return (
    <>
      <PageHeader title={e.title} subtitle="Edit expense" back={{ href: "/admin/crm/expenses", label: "Expenses" }} />
      {e.payoutId ? <Notice tone="info">This expense was created automatically by a commission payout. Manage it from Payouts.</Notice> : (
        <Section className="max-w-3xl">
          {e.receiptPath && <p className="mb-4 text-sm"><a href={`/api/admin/receipts/${e.id}`} target="_blank" className="text-gold underline">Open current receipt ↗</a></p>}
          <ExpenseForm key={e.updatedAt.toISOString()} initial={e} vehicles={vehicleList} />
        </Section>
      )}
    </>
  );
}

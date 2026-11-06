import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, vehicleColors, vehicles } from "@/db/schema";
import { SaleForm, type SaleInitial } from "@/components/admin/sale-form";
import { Notice, PageHeader } from "@/components/ui";
import { pageAdmin } from "@/server/auth";
import { agentOptions } from "@/server/services/sales";
import { vehicleOptions } from "@/server/services/vehicles";

export const metadata = { title: "Record sale" };
const isId = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s);

export default async function NewSale({ searchParams }: { searchParams: Promise<{ order?: string; vehicle?: string; customer?: string }> }) {
  await pageAdmin("finance");
  const sp = await searchParams;
  const [vehicleList, colors, agentList] = await Promise.all([
    vehicleOptions(),
    db.select({ id: vehicleColors.id, vehicleId: vehicleColors.vehicleId, name: vehicleColors.name, stockQuantity: vehicleColors.stockQuantity }).from(vehicleColors).orderBy(asc(vehicleColors.position)),
    agentOptions(),
  ]);

  const initial: SaleInitial = {};
  let orderRef: string | null = null;
  const prefillVehicle = (id: string | null | undefined) => {
    const v = vehicleList.find((x) => x.id === id);
    if (!v) return;
    initial.vehicleId = v.id;
    initial.sellingPrice = v.discountPrice && v.discountPrice < v.price ? v.discountPrice : v.price;
    initial.acquisitionCost = v.purchaseCost + v.additionalExpenses;
  };

  if (isId(sp.order)) {
    const [o] = await db.select({ o: orders, c: customers }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(eq(orders.id, sp.order!)).limit(1);
    if (o) {
      const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, o.o.id)).limit(1);
      orderRef = o.o.reference;
      Object.assign(initial, { orderId: o.o.id, customerName: o.c.name, customerPhone: o.c.phone, customerEmail: o.c.email, agentId: o.o.agentId });
      prefillVehicle(item?.vehicleId);
      if (item) { initial.colorId = item.colorId; initial.sellingPrice = item.unitPrice; initial.vehicleTitle = item.vehicleTitle; }
    }
  }
  if (isId(sp.vehicle)) prefillVehicle(sp.vehicle);
  if (isId(sp.customer)) {
    const [c] = await db.select().from(customers).where(eq(customers.id, sp.customer!)).limit(1);
    if (c) Object.assign(initial, { customerName: c.name, customerPhone: c.phone, customerEmail: c.email });
  }
  const [veh] = initial.vehicleId ? await db.select({ stock: vehicles.stockQuantity }).from(vehicles).where(eq(vehicles.id, initial.vehicleId)).limit(1) : [];

  return (
    <>
      <PageHeader title="Record sale" back={{ href: "/admin/crm/sales", label: "Sales records" }} subtitle="For cars paid by transfer, cash, POS or any method — online payment is not required." />
      {veh && veh.stock === 0 && <div className="mb-4"><Notice tone="warn">This vehicle shows 0 units in stock. Recording the sale won&apos;t reduce stock below zero.</Notice></div>}
      <SaleForm initial={initial} vehicles={vehicleList} colors={colors} agents={agentList} orderRef={orderRef} />
    </>
  );
}

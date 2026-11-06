"use server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { expenses, orders, vehicleAcquisitions, vehicleColors, vehicles } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { acquisitionTotal, perUnitCost } from "@/lib/finance";
import { requireAdmin } from "@/server/auth";
import { deleteStored, MAX_RECEIPT_BYTES, saveFile, sniff } from "@/server/storage";
import {
  addSalePayment, approveCommission, createSale, deletePayout, deleteSale, deleteSalePayment, recordPayout, setCommissionStatus, updateSale,
} from "@/server/services/sales";
import { formObject, PAYMENT_METHODS, run, UserError, zBool, zDate, zId, zInt, zMoney, zOptId, zOptText, zPhone, zText, zOptEmail } from "./util";

/* ── acquisitions ─────────────────────────────────────────────────────── */

const acqSchema = z.object({
  id: z.string().optional(), vehicleId: zOptId,
  brand: zText("Brand", 60), model: zText("Model", 80), year: zInt("Year", 1950, new Date().getFullYear() + 2),
  stockNumber: zOptText(40), purchaseDate: zDate("Purchase date"), units: zInt("Units", 1, 1000),
  purchasePrice: zMoney("Purchase price", { required: true, min: 1 }), seller: zOptText(120),
  additionalPurchaseExpenses: zMoney("Additional purchase expenses"), transportCost: zMoney("Transportation"),
  customsCost: zMoney("Customs"), repairsCost: zMoney("Repairs"), otherExpenses: zMoney("Other expenses"),
  notes: zOptText(4000), syncVehicle: zBool,
});

/** Pushes the per-unit acquisition cost onto the linked listing so profit and commissions use it. */
async function syncVehicleCost(vehicleId: string) {
  const [latest] = await db.select().from(vehicleAcquisitions).where(eq(vehicleAcquisitions.vehicleId, vehicleId)).orderBy(desc(vehicleAcquisitions.purchaseDate), desc(vehicleAcquisitions.createdAt)).limit(1);
  if (!latest) return;
  const units = Math.max(1, latest.units);
  await db.update(vehicles).set({
    purchaseCost: perUnitCost(latest.purchasePrice, units),
    additionalExpenses: perUnitCost(latest.totalCost - latest.purchasePrice, units),
  }).where(eq(vehicles.id, vehicleId));
}

export async function saveAcquisition(_: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const r = await run(async () => {
    await requireAdmin("finance");
    const { id, syncVehicle, ...v } = acqSchema.parse(formObject(fd));
    const totalCost = acquisitionTotal(v);
    if (v.vehicleId) {
      const [exists] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, v.vehicleId)).limit(1);
      if (!exists) throw new UserError("Linked vehicle not found.");
    }
    let previousVehicle: string | null = null;
    if (id) {
      const [before] = await db.select({ vehicleId: vehicleAcquisitions.vehicleId }).from(vehicleAcquisitions).where(eq(vehicleAcquisitions.id, zId.parse(id))).limit(1);
      if (!before) throw new UserError("Record not found.");
      previousVehicle = before.vehicleId;
      await db.update(vehicleAcquisitions).set({ ...v, totalCost }).where(eq(vehicleAcquisitions.id, id));
    } else {
      const [row] = await db.insert(vehicleAcquisitions).values({ ...v, totalCost }).returning({ id: vehicleAcquisitions.id });
      createdId = row.id;
    }
    if (v.vehicleId && syncVehicle) await syncVehicleCost(v.vehicleId);
    if (previousVehicle && previousVehicle !== v.vehicleId) await syncVehicleCost(previousVehicle);
    return id ? "Acquisition record saved." : undefined;
  });
  if (createdId) redirect(`/admin/crm/acquisitions?saved=1`);
  return r;
}

export async function deleteAcquisition(_: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const r = await run(async () => {
    await requireAdmin("finance");
    const id = zId.parse(fd.get("id"));
    const [a] = await db.delete(vehicleAcquisitions).where(eq(vehicleAcquisitions.id, id)).returning();
    if (a?.vehicleId) await syncVehicleCost(a.vehicleId);
    done = true;
  });
  if (done) redirect("/admin/crm/acquisitions?deleted=1");
  return r;
}

/* ── sales ────────────────────────────────────────────────────────────── */

const saleSchema = z.object({
  id: z.string().optional(),
  vehicleId: zOptId, vehicleTitle: z.string().optional().transform((s) => s?.trim() ?? ""), colorId: zOptId,
  customerName: zText("Customer name", 120), customerPhone: zPhone, customerEmail: zOptEmail,
  orderId: zOptId, agentId: zOptId, saleDate: zDate("Sale date"),
  sellingPrice: zMoney("Selling price", { required: true, min: 1 }), discount: zMoney("Discount"), additionalIncome: zMoney("Additional income"),
  acquisitionCost: zMoney("Acquisition cost"), saleExpenses: zMoney("Sale expenses"),
  paymentMethod: z.enum(PAYMENT_METHODS), notes: zOptText(4000),
  amountReceived: zMoney("Amount received"), deductStock: zBool,
}).refine((s) => s.vehicleId || s.vehicleTitle, { message: "Choose a vehicle or describe it.", path: ["vehicleId"] })
  .refine((s) => s.discount <= s.sellingPrice + s.additionalIncome, { message: "Discount can't exceed the sale amount.", path: ["discount"] });

export async function saveSale(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const r = await run(async () => {
    await requireAdmin("finance");
    const { id, amountReceived, deductStock, ...s } = saleSchema.parse(formObject(fd));
    let vehicleTitle = s.vehicleTitle;
    if (s.vehicleId) {
      const [v] = await db.select({ title: vehicles.title }).from(vehicles).where(eq(vehicles.id, s.vehicleId)).limit(1);
      if (!v) throw new UserError("Vehicle not found.");
      vehicleTitle = v.title;
      if (s.colorId) {
        const [c] = await db.select({ vid: vehicleColors.vehicleId, name: vehicleColors.name }).from(vehicleColors).where(eq(vehicleColors.id, s.colorId)).limit(1);
        if (!c || c.vid !== s.vehicleId) throw new UserError("That colour doesn't belong to the chosen vehicle.");
        vehicleTitle = `${v.title} — ${c.name}`;
      }
    } else if (s.colorId) s.colorId = null;
    if (s.orderId) {
      const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, s.orderId)).limit(1);
      if (!o) s.orderId = null;
    }
    const input = { ...s, vehicleTitle };
    if (id) {
      await updateSale(zId.parse(id), input);
      return "Sale updated. Commission recalculated.";
    }
    const total = Math.max(0, s.sellingPrice - s.discount + s.additionalIncome);
    if (amountReceived > total) return { ok: false, message: "Amount received is more than the sale amount.", errors: { amountReceived: "Can't exceed the sale amount." } };
    const sale = await createSale(input, { initialPayment: amountReceived, deductStock });
    dest = `/admin/crm/sales/${sale.id}?created=1`;
  });
  if (dest) redirect(dest);
  return r;
}

export async function removeSale(_: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const r = await run(async () => {
    await requireAdmin("finance");
    await deleteSale(zId.parse(fd.get("id")));
    done = true;
  });
  if (done) redirect("/admin/crm/sales?deleted=1");
  return r;
}

const paymentSchema = z.object({
  saleId: zId, amount: zMoney("Amount", { required: true, min: 1 }), paidOn: zDate("Date"),
  method: z.enum(PAYMENT_METHODS), reference: zOptText(120), notes: zOptText(500),
});

export async function recordSalePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("finance");
    const { saleId, ...p } = paymentSchema.parse(formObject(fd));
    await addSalePayment(saleId, p);
    return "Payment recorded.";
  });
}

export async function removeSalePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("finance");
    await deleteSalePayment(zId.parse(fd.get("id")));
    return "Payment removed.";
  });
}

/* ── expenses ─────────────────────────────────────────────────────────── */

const CATEGORIES = ["vehicle_purchase", "transportation", "repairs", "customs", "marketing", "office", "staff", "agent_commissions", "maintenance", "other"] as const;
const expenseSchema = z.object({
  id: z.string().optional(), title: zText("Title", 160), category: z.enum(CATEGORIES, { message: "Choose a category." }),
  amount: zMoney("Amount", { required: true, min: 1 }), spentOn: zDate("Date"), description: zOptText(2000), vehicleId: zOptId,
  removeReceipt: zBool,
});

export async function saveExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("finance");
    const { id, removeReceipt, ...v } = expenseSchema.parse(formObject(fd));
    const file = fd.get("receipt");
    let receipt: { receiptPath: string; receiptName: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: "Receipt is larger than 4 MB.", errors: { receipt: "Max 4 MB." } };
      const buf = Buffer.from(await file.arrayBuffer());
      const t = sniff(buf);
      if (!t) return { ok: false, message: "Receipts must be a PDF, JPG, PNG or WebP file.", errors: { receipt: "Unsupported file type." } };
      receipt = { receiptPath: await saveFile("private", "receipts", buf, t.ext), receiptName: file.name.slice(0, 120) };
    }
    if (id) {
      const [before] = await db.select().from(expenses).where(eq(expenses.id, zId.parse(id))).limit(1);
      if (!before) throw new UserError("Expense not found.");
      if (before.payoutId) throw new UserError("This expense was created by a commission payout. Edit or delete the payout instead.");
      const clear = removeReceipt || receipt;
      await db.update(expenses).set({ ...v, ...(receipt ?? {}), ...(removeReceipt && !receipt ? { receiptPath: null, receiptName: null } : {}) }).where(eq(expenses.id, id));
      if (clear && before.receiptPath) await deleteStored("private", before.receiptPath);
      return "Expense updated.";
    }
    await db.insert(expenses).values({ ...v, ...(receipt ?? {}) });
    return "Expense recorded.";
  });
}

export async function deleteExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("finance");
    const id = zId.parse(fd.get("id"));
    const [e] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!e) throw new UserError("Expense not found.");
    if (e.payoutId) throw new UserError("This expense belongs to a commission payout. Delete the payout instead.");
    await db.delete(expenses).where(eq(expenses.id, id));
    if (e.receiptPath) await deleteStored("private", e.receiptPath);
    return "Expense deleted.";
  });
}

/* ── commissions & payouts ────────────────────────────────────────────── */

export async function commissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin("agents");
    // Approving or cancelling money owed is a financial decision.
    await requireAdmin("finance");
    const id = zId.parse(fd.get("id"));
    const op = z.enum(["approve", "cancel", "reopen"]).parse(fd.get("op"));
    if (op === "approve") { await approveCommission(id, admin.userId); return "Commission approved."; }
    await setCommissionStatus(id, op === "cancel" ? "cancelled" : "pending");
    return op === "cancel" ? "Commission cancelled." : "Commission moved back to pending.";
  });
}

const payoutSchema = z.object({
  agentId: zId, commissionIds: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v ? (Array.isArray(v) ? v : [v]) : [])).pipe(z.array(z.string().uuid())),
  paidOn: zDate("Payment date"), method: z.enum(PAYMENT_METHODS), reference: zOptText(120), notes: zOptText(1000),
});

export async function savePayout(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("finance");
    const v = payoutSchema.parse(formObject(fd));
    await recordPayout(v);
    return "Payout recorded and commissions marked paid.";
  });
}

export async function removePayout(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("finance");
    await deletePayout(zId.parse(fd.get("id")));
    return "Payout deleted. Its commissions are back to approved.";
  });
}

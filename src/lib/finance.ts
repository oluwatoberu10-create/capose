/**
 * Every money rule in the platform, as pure functions.
 *
 * Profit model (the single source of truth — see docs/FINANCE.md):
 *
 *   Sale amount          = selling price − discount + additional income
 *   Net vehicle profit   = sale amount − acquisition cost of the unit − sale expenses
 *   Agent commission     = 10% × net vehicle profit   (only when profit > 0)
 *   Period net profit    = Σ net vehicle profit of sales in period − operating expenses in period
 *
 * Acquisition costs (purchase price, transport, customs, repairs recorded on the
 * acquisition record) reach profit exactly once: through the sale's
 * `acquisitionCost`, which is the per-unit total of the acquisition record.
 * Operating expenses (the Expenses page) are a separate ledger and are only
 * deducted at the period level, never per vehicle.
 */

export const COMMISSION_RATE_PERCENT = 10;

const nonNeg = (n: number | null | undefined) => Math.max(0, Math.round(Number(n ?? 0)));

export type AcquisitionCosts = {
  purchasePrice: number;
  additionalPurchaseExpenses?: number | null;
  transportCost?: number | null;
  customsCost?: number | null;
  repairsCost?: number | null;
  otherExpenses?: number | null;
};

/** Total Acquisition Cost = Purchase Price + all recorded acquisition expenses. */
export function acquisitionTotal(a: AcquisitionCosts): number {
  return nonNeg(a.purchasePrice) + nonNeg(a.additionalPurchaseExpenses) + nonNeg(a.transportCost)
    + nonNeg(a.customsCost) + nonNeg(a.repairsCost) + nonNeg(a.otherExpenses);
}

/** Cost of one unit when an acquisition record covers several identical cars. */
export function perUnitCost(totalCost: number, units: number): number {
  return Math.round(nonNeg(totalCost) / Math.max(1, Math.round(units || 1)));
}

export type SaleFigures = {
  sellingPrice: number;
  discount?: number | null;
  additionalIncome?: number | null;
  acquisitionCost?: number | null;
  saleExpenses?: number | null;
};

/** What the customer owes for the sale. */
export function saleAmount(s: SaleFigures): number {
  return Math.max(0, nonNeg(s.sellingPrice) - nonNeg(s.discount) + nonNeg(s.additionalIncome));
}

/** Net Vehicle Profit = sale amount − acquisition cost − additional sale expenses. May be negative. */
export function netVehicleProfit(s: SaleFigures): number {
  return saleAmount(s) - nonNeg(s.acquisitionCost) - nonNeg(s.saleExpenses);
}

/** Gross margin before sale-specific expenses (sale amount − acquisition cost). */
export function grossVehicleProfit(s: SaleFigures): number {
  return saleAmount(s) - nonNeg(s.acquisitionCost);
}

/** 10% of net profit, rounded to the nearest Naira. Zero when there is no positive profit. */
export function commissionFor(profit: number, ratePercent = COMMISSION_RATE_PERCENT): number {
  if (!(profit > 0)) return 0;
  return Math.round((profit * ratePercent) / 100);
}

export type SalePaymentStatus = "unpaid" | "partially_paid" | "fully_paid";

export function salePaymentStatus(total: number, received: number): SalePaymentStatus {
  if (received <= 0) return total <= 0 ? "fully_paid" : "unpaid";
  return received >= total ? "fully_paid" : "partially_paid";
}

export function outstanding(total: number, received: number): number {
  return Math.max(0, total - received);
}

/* ── stock → availability ─────────────────────────────────────────────── */

export type Availability = "available" | "reserved" | "sold" | "out_of_stock";

/**
 * Status derived from stock counts when the admin has not overridden it.
 * Units in stock → Available. None left → Out of Stock (spec: "when stock
 * reaches zero, automatically mark the vehicle as Out of Stock"), except that a
 * car whose only remaining unit is held for a buyer shows as Reserved.
 */
export function deriveAvailability(stock: number, reserved: number): Availability {
  if (stock > 0) return "available";
  if (reserved > 0) return "reserved";
  return "out_of_stock";
}

export function effectiveAvailability(v: { availability: Availability; availabilityOverride: boolean; stockQuantity: number; reservedQuantity: number }): Availability {
  return v.availabilityOverride ? v.availability : deriveAvailability(v.stockQuantity, v.reservedQuantity);
}

/** Only Available cars can be ordered online. */
export function isOrderable(a: Availability): boolean {
  return a === "available";
}

/** Public price: the discount price when it is set and lower than the selling price. */
export function publicPrice(v: { price: number; discountPrice?: number | null }): { price: number; was: number | null } {
  if (v.discountPrice && v.discountPrice > 0 && v.discountPrice < v.price) return { price: v.discountPrice, was: v.price };
  return { price: v.price, was: null };
}

/** Expected profit shown to admins on a listing (before any sale). */
export function expectedProfit(v: { price: number; discountPrice?: number | null; purchaseCost: number; additionalExpenses: number }): number {
  return publicPrice(v).price - nonNeg(v.purchaseCost) - nonNeg(v.additionalExpenses);
}

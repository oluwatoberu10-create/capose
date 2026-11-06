/**
 * Database schema.
 *
 * Money is stored as whole Naira in BIGINT columns (no floats anywhere). Every
 * table that can hold demo rows has an `is_demo` flag so `npm run demo:remove`
 * (or Admin → Settings → Remove demo data) can delete exactly that data.
 *
 * Internal cost fields (purchase cost, acquisition records, sales, expenses,
 * commissions) are only ever read by server code behind an admin permission
 * check — the browser never talks to the database directly.
 */
import { sql } from "drizzle-orm";
import {
  bigint, boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const money = (name?: string) => (name ? bigint(name, { mode: "number" }) : bigint({ mode: "number" }));
const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/* ── enums ─────────────────────────────────────────────────────────────── */

export const userRole = pgEnum("user_role", ["admin", "agent"]);
export const adminRole = pgEnum("admin_role", ["owner", "manager", "sales"]);
export const userStatus = pgEnum("user_status", ["active", "disabled"]);
export const agentStatus = pgEnum("agent_status", ["pending", "approved", "suspended"]);
export const vehicleCondition = pgEnum("vehicle_condition", ["brand_new", "foreign_used", "nigerian_used"]);
export const availability = pgEnum("availability", ["available", "reserved", "sold", "out_of_stock"]);
export const imageKind = pgEnum("image_kind", ["front", "rear", "side", "interior", "dashboard", "engine", "other"]);
export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "processing", "completed", "cancelled"]);
export const orderPaymentStatus = pgEnum("order_payment_status", ["pending", "paid", "failed", "refunded"]);
export const paymentMethod = pgEnum("payment_method", ["bank_transfer", "cash", "pos", "online", "other"]);
export const expenseCategory = pgEnum("expense_category", [
  "vehicle_purchase", "transportation", "repairs", "customs", "marketing", "office",
  "staff", "agent_commissions", "maintenance", "other",
]);
export const commissionStatus = pgEnum("commission_status", ["pending", "approved", "paid", "cancelled"]);
export const enquiryKind = pgEnum("enquiry_kind", ["contact", "vehicle_info"]);
export const enquiryStatus = pgEnum("enquiry_status", ["new", "handled"]);
export const notifyStatus = pgEnum("notify_status", ["waiting", "notified"]);

/* ── identity ──────────────────────────────────────────────────────────── */

/** Login identity shared by admins and agents ("profiles"). Public customers never have one. */
export const users = pgTable("users", {
  id: id(),
  email: text().notNull(),
  name: text().notNull(),
  phone: text(),
  passwordHash: text().notNull(),
  role: userRole().notNull(),
  status: userStatus().notNull().default("active"),
  lastLoginAt: timestamp({ withTimezone: true }),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`)]);

export const admins = pgTable("admins", {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  role: adminRole().notNull().default("manager"),
  createdAt: createdAt(),
});

export const agents = pgTable("agents", {
  id: id(),
  userId: uuid().notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  referralCode: text().notNull().unique(),
  status: agentStatus().notNull().default("pending"),
  approvedAt: timestamp({ withTimezone: true }),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("agents_status_idx").on(t.status)]);

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/* ── inventory ─────────────────────────────────────────────────────────── */

export type CustomSpec = { label: string; value: string };

export const vehicles = pgTable("vehicles", {
  id: id(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  brand: text().notNull(),
  model: text().notNull(),
  year: integer().notNull(),
  description: text().notNull().default(""),
  vin: text(),
  stockNumber: text().notNull().unique(),
  category: text().notNull().default(""),
  condition: vehicleCondition().notNull(),
  /** Effective status shown publicly. Recomputed from stock unless `availabilityOverride`. */
  availability: availability().notNull().default("available"),
  availabilityOverride: boolean().notNull().default(false),
  featured: boolean().notNull().default(false),
  published: boolean().notNull().default(true),

  price: money().notNull(),
  originalPrice: money(),
  discountPrice: money(),
  /** Admin only. Per unit. Kept in sync with the linked acquisition record when one exists. */
  purchaseCost: money().notNull().default(0),
  additionalExpenses: money().notNull().default(0),

  engineType: text(),
  engineCapacity: text(),
  horsepower: integer(),
  transmission: text(),
  driveType: text(),
  fuelType: text(),
  mileage: integer(),
  exteriorColor: text(),
  interiorColor: text(),
  doors: integer(),
  seats: integer(),
  bodyType: text(),
  steering: text(),
  dimensions: text(),
  customSpecs: jsonb().$type<CustomSpec[]>().notNull().default([]),

  stockQuantity: integer().notNull().default(1),
  reservedQuantity: integer().notNull().default(0),
  soldQuantity: integer().notNull().default(0),

  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("vehicles_brand_idx").on(t.brand),
  index("vehicles_availability_idx").on(t.availability),
  index("vehicles_price_idx").on(t.price),
  index("vehicles_created_idx").on(t.createdAt),
]);

export const vehicleColors = pgTable("vehicle_colors", {
  id: id(),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  name: text().notNull(),
  hex: text().notNull().default("#888888"),
  /** null = stock not tracked per colour. */
  stockQuantity: integer(),
  position: integer().notNull().default(0),
}, (t) => [index("vehicle_colors_vehicle_idx").on(t.vehicleId)]);

export const vehicleImages = pgTable("vehicle_images", {
  id: id(),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  colorId: uuid().references(() => vehicleColors.id, { onDelete: "set null" }),
  url: text().notNull(),
  kind: imageKind().notNull().default("other"),
  position: integer().notNull().default(0),
  isFeatured: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("vehicle_images_vehicle_idx").on(t.vehicleId)]);

export const vehicleFeatures = pgTable("vehicle_features", {
  id: id(),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  name: text().notNull(),
}, (t) => [index("vehicle_features_vehicle_idx").on(t.vehicleId)]);

/* ── customers & orders ────────────────────────────────────────────────── */

export const customers = pgTable("customers", {
  id: id(),
  name: text().notNull(),
  phone: text().notNull(),
  /** Digits only, used to match repeat customers. */
  phoneKey: text().notNull(),
  email: text(),
  source: text().notNull().default("order"),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("customers_phone_idx").on(t.phoneKey), index("customers_name_idx").on(t.name)]);

export const customerNotes = pgTable("customer_notes", {
  id: id(),
  customerId: uuid().notNull().references(() => customers.id, { onDelete: "cascade" }),
  body: text().notNull(),
  authorId: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("customer_notes_customer_idx").on(t.customerId)]);

export const orders = pgTable("orders", {
  id: id(),
  reference: text().notNull().unique(),
  /** Unguessable token used in the customer's confirmation link. */
  accessToken: text().notNull().unique(),
  customerId: uuid().notNull().references(() => customers.id, { onDelete: "restrict" }),
  status: orderStatus().notNull().default("pending"),
  paymentStatus: orderPaymentStatus().notNull().default("pending"),
  /** Set once a provider (paystack, flutterwave, bank_transfer …) is integrated. */
  paymentProvider: text(),
  paymentReference: text(),
  subtotal: money().notNull(),
  total: money().notNull(),
  message: text(),
  agentId: uuid().references(() => agents.id, { onDelete: "set null" }),
  referralCode: text(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("orders_status_idx").on(t.status),
  index("orders_customer_idx").on(t.customerId),
  index("orders_agent_idx").on(t.agentId),
  index("orders_created_idx").on(t.createdAt),
]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid().notNull().references(() => orders.id, { onDelete: "cascade" }),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  colorId: uuid().references(() => vehicleColors.id, { onDelete: "set null" }),
  vehicleTitle: text().notNull(),
  colorName: text(),
  quantity: integer().notNull(),
  unitPrice: money().notNull(),
  lineTotal: money().notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_vehicle_idx").on(t.vehicleId)]);

/* ── CRM / finance ─────────────────────────────────────────────────────── */

export const vehicleAcquisitions = pgTable("vehicle_acquisitions", {
  id: id(),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  brand: text().notNull(),
  model: text().notNull(),
  year: integer().notNull(),
  stockNumber: text(),
  purchaseDate: date({ mode: "string" }).notNull(),
  units: integer().notNull().default(1),
  purchasePrice: money().notNull(),
  seller: text(),
  additionalPurchaseExpenses: money().notNull().default(0),
  transportCost: money().notNull().default(0),
  customsCost: money().notNull().default(0),
  repairsCost: money().notNull().default(0),
  otherExpenses: money().notNull().default(0),
  /** purchasePrice + every expense column above. Stored for reporting, recomputed on every save. */
  totalCost: money().notNull(),
  notes: text(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("acq_vehicle_idx").on(t.vehicleId), index("acq_date_idx").on(t.purchaseDate)]);

export const sales = pgTable("sales", {
  id: id(),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  vehicleTitle: text().notNull(),
  colorId: uuid().references(() => vehicleColors.id, { onDelete: "set null" }),
  /** True when recording the sale took one unit out of stock (restored if the sale is deleted). */
  stockDeducted: boolean().notNull().default(false),
  customerId: uuid().references(() => customers.id, { onDelete: "set null" }),
  customerName: text().notNull(),
  customerPhone: text().notNull(),
  customerEmail: text(),
  orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
  agentId: uuid().references(() => agents.id, { onDelete: "set null" }),
  saleDate: date({ mode: "string" }).notNull(),
  sellingPrice: money().notNull(),
  discount: money().notNull().default(0),
  additionalIncome: money().notNull().default(0),
  /** Cost of the unit sold (from its acquisition record), snapshotted so later edits are deliberate. */
  acquisitionCost: money().notNull().default(0),
  /** Costs of this sale only (delivery, registration …). Never also entered as an expense. */
  saleExpenses: money().notNull().default(0),
  paymentMethod: paymentMethod().notNull().default("bank_transfer"),
  notes: text(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("sales_date_idx").on(t.saleDate),
  index("sales_vehicle_idx").on(t.vehicleId),
  index("sales_agent_idx").on(t.agentId),
  index("sales_customer_idx").on(t.customerId),
]);

export const salePayments = pgTable("sale_payments", {
  id: id(),
  saleId: uuid().notNull().references(() => sales.id, { onDelete: "cascade" }),
  amount: money().notNull(),
  paidOn: date({ mode: "string" }).notNull(),
  method: paymentMethod().notNull(),
  reference: text(),
  notes: text(),
  createdAt: createdAt(),
}, (t) => [index("sale_payments_sale_idx").on(t.saleId), index("sale_payments_date_idx").on(t.paidOn)]);

export const commissionPayouts = pgTable("commission_payouts", {
  id: id(),
  agentId: uuid().notNull().references(() => agents.id, { onDelete: "restrict" }),
  amount: money().notNull(),
  paidOn: date({ mode: "string" }).notNull(),
  method: paymentMethod().notNull().default("bank_transfer"),
  reference: text(),
  notes: text(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("payouts_agent_idx").on(t.agentId)]);

export const expenses = pgTable("expenses", {
  id: id(),
  title: text().notNull(),
  category: expenseCategory().notNull(),
  amount: money().notNull(),
  spentOn: date({ mode: "string" }).notNull(),
  description: text(),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  /** Path under the private uploads directory; served only to admins. */
  receiptPath: text(),
  receiptName: text(),
  /** Set when the row was created automatically by recording a commission payout. */
  payoutId: uuid().unique().references(() => commissionPayouts.id, { onDelete: "cascade" }),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("expenses_date_idx").on(t.spentOn), index("expenses_category_idx").on(t.category), index("expenses_vehicle_idx").on(t.vehicleId)]);

export const referrals = pgTable("referrals", {
  id: id(),
  agentId: uuid().notNull().references(() => agents.id, { onDelete: "cascade" }),
  referralCode: text().notNull(),
  customerId: uuid().references(() => customers.id, { onDelete: "set null" }),
  orderId: uuid().unique().references(() => orders.id, { onDelete: "cascade" }),
  saleId: uuid().unique().references(() => sales.id, { onDelete: "set null" }),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("referrals_agent_idx").on(t.agentId)]);

/** Visits that arrived through an agent link ("referral activity"). */
export const referralVisits = pgTable("referral_visits", {
  id: id(),
  agentId: uuid().notNull().references(() => agents.id, { onDelete: "cascade" }),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  path: text().notNull(),
  createdAt: createdAt(),
}, (t) => [index("referral_visits_agent_idx").on(t.agentId, t.createdAt)]);

export const agentCommissions = pgTable("agent_commissions", {
  id: id(),
  agentId: uuid().notNull().references(() => agents.id, { onDelete: "cascade" }),
  saleId: uuid().notNull().unique().references(() => sales.id, { onDelete: "cascade" }),
  /** Net vehicle profit the commission was calculated from. */
  profitAmount: money().notNull(),
  ratePercent: integer().notNull().default(10),
  amount: money().notNull(),
  status: commissionStatus().notNull().default("pending"),
  approvedAt: timestamp({ withTimezone: true }),
  approvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  payoutId: uuid().references(() => commissionPayouts.id, { onDelete: "set null" }),
  paidAt: timestamp({ withTimezone: true }),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("commissions_agent_idx").on(t.agentId), index("commissions_status_idx").on(t.status)]);

/* ── public interactions ───────────────────────────────────────────────── */

/** Agents' saved listings. Public visitors save to localStorage instead. */
export const savedListings = pgTable("saved_listings", {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("saved_listings_uq").on(t.userId, t.vehicleId)]);

/** "Notify me when available" requests. */
export const customerNotifications = pgTable("customer_notifications", {
  id: id(),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  name: text().notNull(),
  phone: text().notNull(),
  email: text(),
  status: notifyStatus().notNull().default("waiting"),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("notifications_vehicle_idx").on(t.vehicleId)]);

/** Contact form and "Request more information" submissions. */
export const enquiries = pgTable("enquiries", {
  id: id(),
  kind: enquiryKind().notNull(),
  vehicleId: uuid().references(() => vehicles.id, { onDelete: "set null" }),
  name: text().notNull(),
  phone: text(),
  email: text(),
  message: text().notNull(),
  status: enquiryStatus().notNull().default("new"),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
}, (t) => [index("enquiries_status_idx").on(t.status, t.createdAt)]);

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: updatedAt(),
});

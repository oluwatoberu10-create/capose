import "server-only";

/**
 * Payment provider seam.
 *
 * Online payment is intentionally DISABLED. Orders are created with
 * payment status "pending" and only an admin can mark one as paid.
 *
 * To integrate a provider later (e.g. Paystack):
 *   1. implement `initialize` (create a transaction, return the hosted
 *      checkout URL) and `verifyWebhook` (check the signature header with the
 *      secret key from an environment variable — never ship keys to the browser);
 *   2. add a webhook route that calls `verifyWebhook` and, on success, sets
 *      orders.payment_status = 'paid' and orders.payment_reference;
 *   3. flip `enabled` to read from an env var such as PAYSTACK_SECRET_KEY.
 * The checkout page already lists providers from `paymentProviders()` and
 * the order record already has payment_provider / payment_reference columns.
 */
export type PaymentInit = { orderId: string; reference: string; amount: number; email: string | null; phone: string };

export interface PaymentProvider {
  id: "paystack" | "flutterwave" | "bank_transfer";
  name: string;
  description: string;
  enabled: boolean;
  initialize(input: PaymentInit): Promise<{ redirectUrl: string } | { instructions: string }>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<{ reference: string; paid: boolean } | null>;
}

const notEnabled = async (): Promise<never> => {
  throw new Error("Online payment is not enabled yet.");
};

const providers: PaymentProvider[] = [
  { id: "paystack", name: "Paystack", description: "Card, bank and USSD payments", enabled: false, initialize: notEnabled, verifyWebhook: notEnabled },
  { id: "flutterwave", name: "Flutterwave", description: "Card, bank transfer and mobile money", enabled: false, initialize: notEnabled, verifyWebhook: notEnabled },
  { id: "bank_transfer", name: "Bank transfer", description: "Pay directly into the dealership account", enabled: false, initialize: notEnabled, verifyWebhook: notEnabled },
];

/** Safe to send to the browser: no keys, just what to display. */
export function paymentProviders() {
  return providers.map(({ id, name, description, enabled }) => ({ id, name, description, enabled }));
}

export function onlinePaymentEnabled(): boolean {
  return providers.some((p) => p.enabled);
}

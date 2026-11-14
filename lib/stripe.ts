import Stripe from "stripe";

/** Stripe in test mode only. Without a test key the app uses the labelled demo checkout. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) return null; // never live keys
  return new Stripe(key);
}

export const checkoutMode = () => (stripeClient() ? "stripe" : "demo") as "stripe" | "demo";

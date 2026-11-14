import { CONFIG } from "@/lib/config";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = stripeClient();
  if (!stripe) return Response.json({ mode: "demo" }); // client shows the demo checkout form
  const origin = process.env.APP_URL || new URL(req.url).origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd", unit_amount: Math.round(CONFIG.PRICE_MONTHLY_USD * 100), recurring: { interval: "month" },
          product_data: { name: "Chek Plus" },
        },
      }],
      success_url: `${origin}/unlock/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/unlock`,
    });
    return Response.json({ mode: "stripe", url: session.url });
  } catch (e) {
    console.error("checkout failed", e);
    return Response.json({ error: "Checkout is unavailable right now. Try again." }, { status: 502 });
  }
}

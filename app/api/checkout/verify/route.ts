import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("session_id");
  const stripe = stripeClient();
  if (!stripe || !id) return Response.json({ unlocked: false });
  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    return Response.json({ unlocked: s.payment_status === "paid" });
  } catch {
    return Response.json({ unlocked: false });
  }
}

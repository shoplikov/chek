"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { store } from "@/lib/store";
import { Card, Spinner } from "@/components/ui";

export default function SuccessPage() {
  return <Suspense fallback={null}><Success /></Suspense>;
}

function Success() {
  const params = useSearchParams();
  const [state, setState] = useState<"checking" | "ok" | "failed">("checking");
  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) { setState(store.unlocked() ? "ok" : "failed"); return; }
    fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json()).then(j => { if (j.unlocked) { store.setUnlocked(true); setState("ok"); } else setState("failed"); })
      .catch(() => setState("failed"));
  }, [params]);
  const last = typeof window !== "undefined" ? store.lastId() : null;

  return (
    <Card className="text-center">
      {state === "checking" && <p className="flex items-center justify-center gap-2"><Spinner /> Confirming your payment…</p>}
      {state === "ok" && (
        <>
          <h1 className="text-xl font-semibold">Unlocked.</h1>
          <p className="mt-1 text-sm text-muted">All findings, the proven-savings breakdown and your inflation history are now visible in this browser.</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            {last && <Link href={`/result?id=${encodeURIComponent(last)}`} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white">Back to your receipt</Link>}
            <Link href="/history" className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium">History</Link>
          </div>
        </>
      )}
      {state === "failed" && (<><h1 className="text-xl font-semibold">We couldn&apos;t confirm the payment.</h1><Link href="/unlock" className="mt-3 inline-block underline text-sm">Try again</Link></>)}
    </Card>
  );
}

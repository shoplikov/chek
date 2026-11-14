import { getCatalog } from "@/lib/catalog";
import HistoryClient from "@/components/HistoryClient";

export const dynamic = "force-static";

export default function HistoryPage() {
  const { cpi } = getCatalog().bls;
  return <HistoryClient cpi={cpi.months} cpiId={cpi.id} />;
}

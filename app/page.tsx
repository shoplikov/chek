import { listSamples } from "@/lib/samples";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-static";

export default function Home() {
  const samples = listSamples().map(({ id, title, subtitle, file }) => ({ id, title, subtitle, file }));
  return <HomeClient samples={samples} />;
}

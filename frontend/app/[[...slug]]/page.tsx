import App from "@/App";
import { getBootstrapData } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function CatchAllPage() {
  const initialData = await getBootstrapData();

  return <App initialData={initialData} />;
}

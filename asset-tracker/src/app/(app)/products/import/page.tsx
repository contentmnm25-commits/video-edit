import { redirect } from "next/navigation";
import { ImportForm } from "@/components/product-forms";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/domain";
import { activeChannels } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user, "manage_catalog")) redirect("/products");
  const [channels, template] = await Promise.all([activeChannels(), getSetting("assetTemplate")]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Import products from CSV"
        description="Load your whole catalogue at once: SKUs, listing IDs per channel, and creative slots."
      />
      <ImportForm channels={channels.map((c) => ({ id: c.id, name: c.name, idLabel: c.idLabel }))} template={template} />
    </div>
  );
}

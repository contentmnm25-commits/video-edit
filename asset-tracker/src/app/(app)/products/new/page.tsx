import { redirect } from "next/navigation";
import { NewProductForm } from "@/components/product-forms";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/domain";
import { activeChannels } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const user = await requireUser();
  if (!can(user, "manage_catalog")) redirect("/products");
  const [channels, template] = await Promise.all([activeChannels(), getSetting("assetTemplate")]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add product" description="Its creative slots are created for you, so designers can start uploading straight away." />
      <NewProductForm channels={channels.map((c) => ({ id: c.id, name: c.name, idLabel: c.idLabel }))} template={template} />
    </div>
  );
}

import { fetchNotificationRoutes } from "@/lib/api";
import { AlertWizard } from "../../AlertWizard";

export const metadata = { title: "New event alert" };

export default async function CreateEventAlertPage() {
  const data = await fetchNotificationRoutes();
  return (
    <AlertWizard catalog={data.catalog} channels={data.channels} />
  );
}

/**
 * Redirect /dashboard → intelligence overview.
 */
import { redirect } from "next/navigation";

export default function DashboardIndexPage() {
  redirect("/dashboard/intelligence");
}

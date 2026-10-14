import { redirect } from "next/navigation";

export const metadata = { title: "Menu" };

/** Workspace links live in the sidebar and the phone menu. This path stays as a bookmark. */
export default function MenuPage() {
  redirect("/");
}

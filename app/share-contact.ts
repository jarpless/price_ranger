"use server";

import { redirect } from "next/navigation";

import { clip } from "@/lib/form";
import { deliverShareNote } from "@/lib/share";

export async function contactAboutPrice(formData: FormData) {
  const token = clip(formData.get("token"), 80);
  const name = clip(formData.get("name"), 80);
  const message = clip(formData.get("message"), 1000);
  const result = await deliverShareNote(token, { name, message });
  if (result === "missing") redirect("/");
  redirect(`/p/${encodeURIComponent(token)}?sent=${result}`);
}

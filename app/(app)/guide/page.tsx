import { redirect } from "next/navigation";

/** /guide without an id is not a price. Send the seller home. */
export default function GuideIndex() {
  redirect("/");
}

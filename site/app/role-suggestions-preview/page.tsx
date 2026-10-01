import { notFound } from "next/navigation";
import RoleSuggestionsPreview from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RoleSuggestionsPreview />;
}

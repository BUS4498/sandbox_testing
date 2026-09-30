import { requireChatGPTUser } from "@/app/chatgpt-auth";
import OwnerVerifyForm from "./owner-verify-form";

export const dynamic = "force-dynamic";

export default async function OwnerVerifyPage() {
  await requireChatGPTUser("/owner-verify");
  return <OwnerVerifyForm />;
}

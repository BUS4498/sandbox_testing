import { requireChatGPTUser } from "@/app/chatgpt-auth";
import DeskClient from "@/app/desk-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireChatGPTUser("/");
  return <DeskClient />;
}

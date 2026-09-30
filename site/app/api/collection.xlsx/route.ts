import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getStudentSetup, listOpportunities } from "@/lib/hosted/store";
import { createCollectionWorkbook } from "@/lib/hosted/xlsx";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in to download the private collection.", { status: 401 });
  try {
    const [records, setup] = await Promise.all([listOpportunities(user.userId), getStudentSetup(user.userId)]);
    const workbook = createCollectionWorkbook(records, setup);
    const body = new ArrayBuffer(workbook.byteLength);
    new Uint8Array(body).set(workbook);
    return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="internship_pipeline.xlsx"', "Cache-Control": "no-store, private" } });
  } catch {
    return new Response("The spreadsheet could not be generated from the private collection.", { status: 503 });
  }
}

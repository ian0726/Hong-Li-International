import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../lib/product-store";

const DEFAULT_CONTACT_EMAIL = "sales@ianautostore.com";

export async function GET() {
  try {
    await ensureDatabase();
    const row = await runtime.DB.prepare("SELECT value FROM app_meta WHERE key = 'contact_email'").first();
    return Response.json({ contactEmail: String(row?.value || DEFAULT_CONTACT_EMAIL) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "讀取聯絡設定失敗" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const payload = await request.json() as { contactEmail?: string };
    const contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return Response.json({ error: "請輸入有效的 Email" }, { status: 400 });
    }
    await runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('contact_email',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .bind(contactEmail).run();
    return Response.json({ contactEmail });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "儲存聯絡設定失敗" }, { status: 500 });
  }
}

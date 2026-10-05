import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../lib/product-store";

const DEFAULT_CONTACT_EMAIL = "sales@ianautostore.com";
const DEFAULT_INQUIRY_SUBJECT = "我想購買";
const DEFAULT_INQUIRY_BODY = `姓名：

電話：

地址：

購買品項：

車款：

年份：

我們將有專人與您確認訂單，謝謝`;

export async function GET() {
  try {
    await ensureDatabase();
    const rows = await runtime.DB.prepare("SELECT key,value FROM app_meta WHERE key IN ('contact_email','inquiry_email_subject','inquiry_email_body')").all();
    const settings = Object.fromEntries(rows.results.map((row)=>[String(row.key),String(row.value)]));
    const catalog = await runtime.DB.prepare("SELECT id FROM documents WHERE id=1").first();
    return Response.json({
      catalogAvailable: Boolean(catalog),
      contactEmail: settings.contact_email || DEFAULT_CONTACT_EMAIL,
      inquiryEmailSubject: settings.inquiry_email_subject || DEFAULT_INQUIRY_SUBJECT,
      inquiryEmailBody: settings.inquiry_email_body || DEFAULT_INQUIRY_BODY,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "讀取聯絡設定失敗" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const payload = await request.json() as { contactEmail?: string; inquiryEmailSubject?: string; inquiryEmailBody?: string };
    const contactEmail = String(payload.contactEmail || "").trim().toLowerCase();
    const inquiryEmailSubject = String(payload.inquiryEmailSubject || "").trim();
    const inquiryEmailBody = String(payload.inquiryEmailBody || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return Response.json({ error: "請輸入有效的 Email" }, { status: 400 });
    }
    if (!inquiryEmailSubject) return Response.json({ error: "請輸入預設 Email 主旨" }, { status: 400 });
    if (!inquiryEmailBody) return Response.json({ error: "請輸入預設 Email 內容" }, { status: 400 });
    await runtime.DB.batch([
      runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('contact_email',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(contactEmail),
      runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('inquiry_email_subject',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(inquiryEmailSubject),
      runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('inquiry_email_body',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(inquiryEmailBody),
    ]);
    return Response.json({ contactEmail, inquiryEmailSubject, inquiryEmailBody });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "儲存聯絡設定失敗" }, { status: 500 });
  }
}

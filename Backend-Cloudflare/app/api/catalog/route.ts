import { ensureDatabase, runtime } from "../../../lib/product-store";

export async function GET() {
  await ensureDatabase();
  const document = await runtime.DB.prepare("SELECT * FROM documents WHERE id = 1").first();
  if (!document) return Response.json({ error: "尚未上傳品項總覽 PDF" }, { status: 404 });
  const object = await runtime.BUCKET.get(String(document.file_key));
  if (!object) return Response.json({ error: "PDF 檔案不存在" }, { status: 404 });
  const headers = new Headers({ "content-type": "application/pdf", "content-disposition": `inline; filename="${encodeURIComponent(String(document.name))}"` });
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

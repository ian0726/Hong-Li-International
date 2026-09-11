import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../lib/product-store";

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") || "image");
    if (!(file instanceof File)) return Response.json({ error: "請選擇檔案" }, { status: 400 });
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if ((kind === "catalog" && !isPdf) || (kind !== "catalog" && !isImage)) {
      return Response.json({ error: kind === "catalog" ? "僅支援 PDF" : "僅支援圖片格式" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "檔案不可超過 10MB" }, { status: 400 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = `${kind}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    await runtime.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    if (kind === "catalog") {
      await ensureDatabase();
      const previous = await runtime.DB.prepare("SELECT file_key FROM documents WHERE id = 1").first();
      await runtime.DB.prepare(`INSERT INTO documents (id,name,file_key,size,updated_at) VALUES (1,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,file_key=excluded.file_key,size=excluded.size,updated_at=excluded.updated_at`)
        .bind(file.name,key,file.size,new Date().toISOString()).run();
      if (previous?.file_key) await runtime.BUCKET.delete(String(previous.file_key));
      return Response.json({ url: "/api/catalog", name: file.name });
    }
    return Response.json({ url: `/api/files?key=${encodeURIComponent(key)}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "上傳失敗" }, { status: 500 });
  }
}

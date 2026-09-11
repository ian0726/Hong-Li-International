import { requireAdmin, unauthorized } from "../../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../../lib/product-store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const { id } = await params;
    const payload = await request.json() as { name?: string; defaultImageUrl?: string | null };
    const current = await runtime.DB.prepare("SELECT name,default_image_url FROM categories WHERE id = ?").bind(Number(id)).first();
    if (!current) return Response.json({ error: "找不到分類" }, { status: 404 });
    const name = payload.name === undefined ? String(current.name) : String(payload.name).trim();
    const defaultImageUrl = payload.defaultImageUrl === undefined
      ? String(current.default_image_url || "")
      : String(payload.defaultImageUrl || "").trim();
    if (!name) return Response.json({ error: "請輸入商品分類名稱" }, { status: 400 });
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare("UPDATE categories SET name=?,default_image_url=?,updated_at=? WHERE id=?").bind(name,defaultImageUrl,now,Number(id)),
      runtime.DB.prepare("UPDATE products SET category=?,updated_at=? WHERE category=?").bind(name,now,String(current.name)),
    ]);
    return Response.json({ category: { id:Number(id), name, defaultImageUrl } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新分類失敗";
    return Response.json({ error: message.includes("UNIQUE") ? "此分類已存在" : message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return unauthorized();
  await ensureDatabase();
  const { id } = await params;
  const current = await runtime.DB.prepare(`SELECT c.name,COUNT(p.id) AS product_count
    FROM categories c LEFT JOIN products p ON p.category=c.name WHERE c.id=? GROUP BY c.id,c.name`).bind(Number(id)).first();
  if (!current) return Response.json({ error: "找不到分類" }, { status: 404 });
  if (Number(current.product_count)) {
    return Response.json({ error: `此分類仍有 ${Number(current.product_count)} 筆商品，請先移動或刪除商品` }, { status: 409 });
  }
  await runtime.DB.prepare("DELETE FROM categories WHERE id=?").bind(Number(id)).run();
  return Response.json({ ok:true });
}

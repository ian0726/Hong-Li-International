import { requireAdmin, unauthorized } from "../../../../lib/admin-auth";
import { ensureDatabase, mapProduct, normalizeProduct, runtime } from "../../../../lib/product-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabase();
  const { id } = await params;
  const row = await runtime.DB.prepare(`SELECT p.*,c.default_image_url FROM products p
    LEFT JOIN categories c ON c.name=p.category WHERE p.id = ?`).bind(Number(id)).first();
  return row ? Response.json({ product: mapProduct(row) }) : Response.json({ error: "找不到商品" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const { id } = await params;
    const data = normalizeProduct(await request.json());
    const now=new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE products SET
        name=?,category=?,series=?,brand=?,model=?,year=?,sku=?,barcode=?,description=?,accent=?,image_url=?,image_urls=?,video_urls=?,updated_at=? WHERE id=?`)
        .bind(data.name,data.category,data.series,data.brand.toUpperCase(),data.model,data.year,data.sku,data.barcode,data.description,data.accent,data.imageUrl,JSON.stringify(data.imageUrls),JSON.stringify(data.videoUrls),now,Number(id)),
      runtime.DB.prepare("INSERT OR IGNORE INTO categories (name,created_at,updated_at) VALUES (?,?,?)").bind(data.category,now,now),
      runtime.DB.prepare("INSERT OR IGNORE INTO brands (name,created_at,updated_at) VALUES (?,?,?)").bind(data.brand.toUpperCase(),now,now),
    ]);
    const row=await runtime.DB.prepare(`SELECT p.*,c.default_image_url FROM products p
      LEFT JOIN categories c ON c.name=p.category WHERE p.id=?`).bind(Number(id)).first();
    return row ? Response.json({ product: mapProduct(row) }) : Response.json({ error: "找不到商品" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新商品失敗";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return unauthorized();
  await ensureDatabase();
  const { id } = await params;
  const row = await runtime.DB.prepare("SELECT image_url FROM products WHERE id=?").bind(Number(id)).first();
  if (!row) return Response.json({ error: "找不到商品" }, { status: 404 });
  await runtime.DB.prepare("DELETE FROM products WHERE id=?").bind(Number(id)).run();
  return Response.json({ ok: true });
}

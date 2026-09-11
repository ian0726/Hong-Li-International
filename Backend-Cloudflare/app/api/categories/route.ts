import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../lib/product-store";

function mapCategory(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name),
    defaultImageUrl: row.default_image_url ? String(row.default_image_url) : "",
    productCount: Number(row.product_count || 0),
  };
}

export async function GET() {
  try {
    await ensureDatabase();
    const result = await runtime.DB.prepare(`SELECT c.id,c.name,c.default_image_url,COUNT(p.id) AS product_count
      FROM categories c LEFT JOIN products p ON p.category = c.name
      GROUP BY c.id,c.name,c.default_image_url ORDER BY c.id ASC`).all();
    return Response.json({ categories: result.results.map(mapCategory) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "讀取分類失敗" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const payload = await request.json() as { name?: string };
    const name = String(payload.name || "").trim();
    if (!name) return Response.json({ error: "請輸入商品分類名稱" }, { status: 400 });
    const now = new Date().toISOString();
    await runtime.DB.prepare("INSERT INTO categories (name,created_at,updated_at) VALUES (?,?,?)").bind(name,now,now).run();
    const row = await runtime.DB.prepare("SELECT id,name,default_image_url FROM categories WHERE name=?").bind(name).first();
    return Response.json({ category: mapCategory({ ...row, product_count:0 }) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增分類失敗";
    return Response.json({ error: message.includes("UNIQUE") ? "此分類已存在" : message }, { status: 400 });
  }
}

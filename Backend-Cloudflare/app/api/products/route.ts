import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, mapProduct, normalizeProduct, runtime } from "../../../lib/product-store";

export async function GET() {
  try {
    await ensureDatabase();
    const result = await runtime.DB.prepare(`SELECT p.*,c.default_image_url
      FROM products p LEFT JOIN categories c ON c.name=p.category ORDER BY p.id ASC`).all();
    return Response.json({ products: result.results.map(mapProduct) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "讀取商品失敗" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const data = normalizeProduct(await request.json());
    const now = new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO products
        (name,category,series,brand,model,year,sku,barcode,description,accent,image_url,image_urls,video_urls,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(data.name,data.category,data.series,data.brand.toUpperCase(),data.model,data.year,data.sku,data.barcode,data.description,data.accent,data.imageUrl,JSON.stringify(data.imageUrls),JSON.stringify(data.videoUrls),now,now),
      runtime.DB.prepare("INSERT OR IGNORE INTO categories (name,created_at,updated_at) VALUES (?,?,?)").bind(data.category,now,now),
      runtime.DB.prepare("INSERT OR IGNORE INTO brands (name,created_at,updated_at) VALUES (?,?,?)").bind(data.brand.toUpperCase(),now,now),
    ]);
    const result=await runtime.DB.prepare(`SELECT p.*,c.default_image_url FROM products p
      LEFT JOIN categories c ON c.name=p.category WHERE p.sku=? ORDER BY p.id DESC LIMIT 1`).bind(data.sku).first();
    return Response.json({ product: mapProduct(result) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增商品失敗";
    return Response.json({ error: message }, { status: 400 });
  }
}

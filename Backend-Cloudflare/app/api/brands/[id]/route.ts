import { requireAdmin, unauthorized } from "../../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../../lib/product-store";

export async function PATCH(request: Request,{ params }:{ params:Promise<{ id:string }> }) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const { id }=await params;
    const payload=await request.json() as { name?:string };
    const name=String(payload.name || "").trim().toUpperCase();
    if (!name) return Response.json({ error:"請輸入品牌名稱" },{ status:400 });
    const current=await runtime.DB.prepare("SELECT name FROM brands WHERE id=?").bind(Number(id)).first();
    if (!current) return Response.json({ error:"找不到品牌" },{ status:404 });
    const now=new Date().toISOString();
    await runtime.DB.batch([
      runtime.DB.prepare("UPDATE brands SET name=?,updated_at=? WHERE id=?").bind(name,now,Number(id)),
      runtime.DB.prepare("UPDATE products SET brand=?,updated_at=? WHERE UPPER(brand)=?").bind(name,now,String(current.name)),
    ]);
    return Response.json({ brand:{ id:Number(id),name } });
  } catch (error) {
    const message=error instanceof Error ? error.message : "更新品牌失敗";
    return Response.json({ error:message.includes("UNIQUE") ? "此品牌已存在" : message },{ status:400 });
  }
}

export async function DELETE(request: Request,{ params }:{ params:Promise<{ id:string }> }) {
  if (!(await requireAdmin(request))) return unauthorized();
  await ensureDatabase();
  const { id }=await params;
  const current=await runtime.DB.prepare(`SELECT b.name,COUNT(p.id) AS product_count FROM brands b
    LEFT JOIN products p ON UPPER(p.brand)=b.name WHERE b.id=? GROUP BY b.id,b.name`).bind(Number(id)).first();
  if (!current) return Response.json({ error:"找不到品牌" },{ status:404 });
  if (Number(current.product_count)) return Response.json({ error:`此品牌仍有 ${Number(current.product_count)} 筆商品，請先移動或刪除商品` },{ status:409 });
  await runtime.DB.prepare("DELETE FROM brands WHERE id=?").bind(Number(id)).run();
  return Response.json({ ok:true });
}

import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../lib/product-store";

function mapBrand(row: Record<string,unknown>) {
  return { id:Number(row.id),name:String(row.name),productCount:Number(row.product_count || 0) };
}

export async function GET() {
  await ensureDatabase();
  const result=await runtime.DB.prepare(`SELECT b.id,b.name,COUNT(p.id) AS product_count
    FROM brands b LEFT JOIN products p ON UPPER(p.brand)=b.name
    GROUP BY b.id,b.name ORDER BY b.name ASC`).all();
  return Response.json({ brands:result.results.map(mapBrand) });
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    const payload=await request.json() as { name?:string };
    const name=String(payload.name || "").trim().toUpperCase();
    if (!name) return Response.json({ error:"請輸入品牌名稱" },{ status:400 });
    const now=new Date().toISOString();
    await runtime.DB.prepare("INSERT INTO brands (name,created_at,updated_at) VALUES (?,?,?)").bind(name,now,now).run();
    const row=await runtime.DB.prepare("SELECT id,name FROM brands WHERE name=?").bind(name).first();
    return Response.json({ brand:{ id:Number(row?.id),name:String(row?.name),productCount:0 } },{ status:201 });
  } catch (error) {
    const message=error instanceof Error ? error.message : "新增品牌失敗";
    return Response.json({ error:message.includes("UNIQUE") ? "此品牌已存在" : message },{ status:400 });
  }
}

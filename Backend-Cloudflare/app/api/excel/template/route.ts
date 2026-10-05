import { buildCatalogTemplate } from "../../../../lib/excel-catalog";
import { requireAdmin, unauthorized } from "../../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../../lib/product-store";

export async function GET(request:Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const result=await runtime.DB.prepare("SELECT name FROM categories ORDER BY id ASC").all();
    const categories=result.results.map((row)=>String(row.name));
    const bytes=buildCatalogTemplate(categories);
    return new Response(bytes,{
      headers:{
        "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition":`attachment; filename="Hongli-Product-Import-Template.xlsx"`,
        "cache-control":"no-store",
      },
    });
  } catch (error) {
    return Response.json({error:error instanceof Error?error.message:"Excel 版型下載失敗"},{status:500});
  }
}

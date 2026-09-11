import { buildCatalogWorkbook } from "../../../../lib/excel-catalog";
import { requireAdmin, unauthorized } from "../../../../lib/admin-auth";
import { ensureDatabase, mapProduct, runtime } from "../../../../lib/product-store";

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const result=await runtime.DB.prepare("SELECT * FROM products ORDER BY id ASC").all();
    const records=result.results.map(mapProduct);
    const bytes=buildCatalogWorkbook(records);
    const date=new Date().toISOString().slice(0,10);
    const fileName=`Ian-Auto-Store-Catalog-${date}.xlsx`;
    return new Response(bytes,{
      headers:{
        "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition":`attachment; filename="${fileName}"`,
        "cache-control":"no-store",
      },
    });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "Excel 匯出失敗" },{ status:500 });
  }
}

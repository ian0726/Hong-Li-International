import { extractWorkbookImages, parseCatalogWorkbook } from "../../../lib/excel-catalog";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../lib/product-store";

const excelType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const [document,version]=await Promise.all([
      runtime.DB.prepare("SELECT name,size,updated_at FROM documents WHERE id=2").first(),
      runtime.DB.prepare("SELECT value FROM app_meta WHERE key='excel_version'").first(),
    ]);
    return Response.json({
      fileName:document ? String(document.name) : null,
      size:document ? Number(document.size) : 0,
      updatedAt:document ? String(document.updated_at) : null,
      version:Number(version?.value || 1),
    });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "讀取 Excel 版本失敗" },{ status:500 });
  }
}

export async function POST(request: Request) {
  const uploadedKeys:string[]=[];
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    await ensureDatabase();
    const form=await request.formData();
    const file=form.get("file");
    if (!(file instanceof File)) return Response.json({ error:"請選擇 Excel 檔案" },{ status:400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error:"目前僅支援 .xlsx 檔案" },{ status:400 });
    if (file.size > 25 * 1024 * 1024) return Response.json({ error:"Excel 檔案不可超過 25MB" },{ status:400 });

    const buffer=await file.arrayBuffer();
    const stamp=Date.now();
    const embedded=extractWorkbookImages(buffer);
    const imageEntries=embedded.map((image,index)=>{
      const extension=image.name.split(".").pop()?.toLowerCase() || "png";
      const key=`excel-images/${stamp}/image-${String(index + 1).padStart(2,"0")}.${extension}`;
      return { ...image,key,url:`/api/files?key=${encodeURIComponent(key)}` };
    });
    const records=parseCatalogWorkbook(buffer,imageEntries.length ? imageEntries.map((item)=>item.url) : undefined);
    for (const image of imageEntries) {
      await runtime.BUCKET.put(image.key,image.bytes,{ httpMetadata:{ contentType:image.contentType } });
      uploadedKeys.push(image.key);
    }
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
    const workbookKey=`excel/${stamp}-${crypto.randomUUID()}-${safeName}`;
    await runtime.BUCKET.put(workbookKey,buffer,{ httpMetadata:{ contentType:excelType } });
    uploadedKeys.push(workbookKey);

    const previous=await runtime.DB.prepare("SELECT file_key FROM documents WHERE id=2").first();
    const currentVersion=await runtime.DB.prepare("SELECT value FROM app_meta WHERE key='excel_version'").first();
    const nextVersion=Number(currentVersion?.value || 0) + 1;
    const now=new Date().toISOString();
    const statements=[
      runtime.DB.prepare("DELETE FROM products"),
      runtime.DB.prepare("DELETE FROM sqlite_sequence WHERE name='products'"),
      ...records.map((row)=>runtime.DB.prepare(`INSERT INTO products
        (name,category,series,brand,model,year,sku,barcode,description,accent,image_url,image_urls,video_urls,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(row.name,row.category,row.series,row.brand,row.model,row.year,row.sku,row.barcode,row.description,row.accent,row.imageUrl || null,JSON.stringify(row.imageUrls || []),JSON.stringify(row.videoUrls || []),now,now)),
      ...[...new Set(records.map((row)=>row.category))].map((name)=>runtime.DB.prepare(
        "INSERT OR IGNORE INTO categories (name,created_at,updated_at) VALUES (?,?,?)"
      ).bind(name,now,now)),
      ...[...new Set(records.map((row)=>row.brand.toUpperCase()))].map((name)=>runtime.DB.prepare(
        "INSERT OR IGNORE INTO brands (name,created_at,updated_at) VALUES (?,?,?)"
      ).bind(name,now,now)),
      runtime.DB.prepare(`INSERT INTO documents (id,name,file_key,size,updated_at) VALUES (2,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,file_key=excluded.file_key,size=excluded.size,updated_at=excluded.updated_at`)
        .bind(file.name,workbookKey,file.size,now),
      runtime.DB.prepare(`INSERT INTO app_meta (key,value) VALUES ('excel_version',?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(String(nextVersion)),
    ];
    await runtime.DB.batch(statements);
    const previousKey=previous?.file_key ? String(previous.file_key) : "";
    if (previousKey && !previousKey.startsWith("seed://")) await runtime.BUCKET.delete(previousKey);
    return Response.json({ fileName:file.name,version:nextVersion,updatedAt:now,productCount:records.length,imageCount:embedded.length });
  } catch (error) {
    for (const key of uploadedKeys) {
      try { await runtime.BUCKET.delete(key); } catch { /* best-effort cleanup */ }
    }
    return Response.json({ error:error instanceof Error ? error.message : "Excel 匯入失敗" },{ status:400 });
  }
}

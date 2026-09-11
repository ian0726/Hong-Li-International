import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import type { ProductRecord } from "./product-store";

const accents = ["#f97316","#fb923c","#ea580c","#fdba74","#c2410c","#ff8a1f"];
const valueText = (value: unknown) => value === null || value === undefined ? "" : String(value).replaceAll("_x0005_","\n").replaceAll("\u0005","\n").trim();
const cleanYear = (value: unknown) => valueText(value).replaceAll("~","–").replace(/'$/,"");
const urlList = (value: unknown) => [...new Set(valueText(value).split(/[\n,，]+/).map((item)=>item.trim()).filter(Boolean))].slice(0,20);
const imageUrlList = (value: unknown) => urlList(value).map((rawUrl)=>{
  try {
    const url=new URL(rawUrl);
    if (url.hostname === "drive.google.com") {
      const id=url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
    }
  } catch { /* keep the original value so the admin can correct it */ }
  return rawUrl;
});

type InputProduct = Omit<ProductRecord,"id"|"createdAt"|"updatedAt">;
type WorkbookImage = { name:string; contentType:string; bytes:Uint8Array };

function sheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  return sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet,{ header:1, defval:"", raw:true }) : [];
}

function product(input: Partial<InputProduct>, index: number, imageUrls: string[]): InputProduct {
  const category = valueText(input.category);
  const brand = valueText(input.brand).toUpperCase();
  const model = valueText(input.model);
  if (!category || !brand || !model) {
    throw new Error(`第 ${index + 1} 筆資料缺少商品分類、品牌或車型`);
  }
  const year = cleanYear(input.year) || "未指定";
  const sku = valueText(input.sku) || "未提供";
  const name = valueText(input.name) || `${category} ${brand} ${model}`;
  const listedImages=imageUrlList(input.imageUrls?.length ? input.imageUrls.join(",") : input.imageUrl);
  const productImages=listedImages.length ? listedImages : imageUrls[index] ? [imageUrls[index]] : [];
  const productVideos=urlList(input.videoUrls?.join(","));
  return {
    category, series:valueText(input.series) || "標準版", brand, model, year, sku,
    barcode:valueText(input.barcode), name,
    description:valueText(input.description) || `${category}，適用 ${brand} ${model}${year === "未指定" ? "" : ` ${year}`}。`,
    accent:valueText(input.accent) || accents[index % accents.length],
    imageUrl:productImages[0] || null,
    imageUrls:productImages,
    videoUrls:productVideos,
  };
}

function parseMaster(workbook: XLSX.WorkBook, imageUrls: string[]) {
  const sheet = workbook.Sheets["商品總表"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{ defval:"", raw:true })
    .filter((row)=>Object.values(row).some((value)=>valueText(value)));
  return rows.map((row,index) => product({
    category:row["商品種類"], series:row["商品系列"], brand:row["品牌"],
    model:row["車型"], year:row["年份"], name:row["商品名稱"],
    sku:row["貨品編號"], barcode:row["國際條碼"], description:row["產品規格介紹"],
    imageUrls:imageUrlList(row["圖片網址"]), videoUrls:urlList(row["影片網址"]),
  },index,imageUrls));
}

function parseOriginal(workbook: XLSX.WorkBook, imageUrls: string[]) {
  const records: InputProduct[] = [];
  const phone = sheetRows(workbook,"手機底座車種表");
  let brand = "";
  for (let rowIndex=2; rowIndex<phone.length; rowIndex++) {
    const row = phone[rowIndex];
    const first = valueText(row[0]);
    if (first && !valueText(row[3])) { brand=first.split(/\s+/)[0].toUpperCase(); continue; }
    if (!valueText(row[3])) continue;
    if (valueText(row[1])) brand=valueText(row[1]).split(/\s+/)[0].toUpperCase();
    const name=valueText(row[6]);
    let model=valueText(row[4]);
    if (!model) model=name.replace(/^.*?BENZ\s+/i,"").replace(/\s+\d{2}[-–].*$/,"").replace(/E級/i,"E-Class / CLS / GT / E Coupe");
    records.push(product({
      category:"手機底座",series:first || "底座款",brand,model,year:row[5],
      sku:row[3],barcode:row[2],name,
      description:`${first || "底座款"}專車專用手機支架，適用 ${brand} ${model} ${cleanYear(row[5])}。`,
    },records.length,imageUrls));
  }

  const shades = sheetRows(workbook,"遮陽板車種表");
  brand="";
  for (let rowIndex=3; rowIndex<shades.length; rowIndex++) {
    const row=shades[rowIndex];
    if (valueText(row[1])) brand=valueText(row[1]).toUpperCase();
    const rawModel=valueText(row[2]);
    if (!rawModel) continue;
    let year=cleanYear(row[3]);
    if (!year) {
      const inferred=rawModel.match(/(?:~?\d{4}|\d{4})\s*[~–-]\s*(?:\d{4}|迄今)?$/i);
      year=inferred ? cleanYear(inferred[0]) : "";
    }
    let model=rawModel.replace(new RegExp(`^${brand}\\s*`,"i"),"").trim();
    model=model.replace(/\s+(?:~?\d{2,4}(?:\s*[~–-]\s*(?:\d{2,4}|迄今)?)?|\d{4})$/i,"").trim();
    const sku=valueText(row[4]);
    records.push(product({
      category:"遮陽板",series:valueText(row[0]) || "標準版",brand,model,year,sku,barcode:"",
      name:`專用高密合度遮陽板 ${brand} ${model}`,
      description:`專用高密合度遮陽板，適用 ${brand} ${model}（${year}），規格代碼 ${sku}。`,
    },records.length,imageUrls));
  }

  const filters=sheetRows(workbook,"冷氣濾網車種表");
  for (let rowIndex=2; rowIndex<filters.length; rowIndex++) {
    const row=filters[rowIndex];
    if (!valueText(row[2])) continue;
    const parts=valueText(row[4]).split("\n").map((part)=>part.trim()).filter(Boolean);
    const sku=parts[0];
    const reference=parts.slice(1).join(" / ");
    brand=valueText(row[1]).toUpperCase();
    const model=valueText(row[2]);
    const year=cleanYear(row[3]);
    records.push(product({
      category:"冷氣濾網",series:valueText(row[0]) || "標準版",brand,model,year,sku,barcode:"",
      name:`DF 抑菌抗病毒冷氣濾網 ${brand} ${model}`,
      description:`DF 抑菌抗病毒冷氣濾網，適用 ${brand} ${model} ${year}。${reference ? ` OE 參考號：${reference}。` : ""}`,
    },records.length,imageUrls));
  }
  return records;
}

export function extractWorkbookImages(buffer: ArrayBuffer): WorkbookImage[] {
  try {
    const archive=unzipSync(new Uint8Array(buffer));
    return Object.entries(archive).filter(([name])=>/^xl\/media\/[^/]+\.(png|jpe?g|webp)$/i.test(name))
      .sort(([a],[b])=>a.localeCompare(b,undefined,{ numeric:true }))
      .map(([name,bytes])=>{
        const extension=name.split(".").pop()?.toLowerCase();
        const contentType=extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
        return { name:name.split("/").pop() || "image",contentType,bytes };
      });
  } catch {
    return [];
  }
}

export function parseCatalogWorkbook(buffer: ArrayBuffer, imageUrls: string[] = []) {
  const workbook=XLSX.read(buffer,{ type:"array" });
  const fromMaster=parseMaster(workbook,imageUrls);
  const records=fromMaster.length ? fromMaster : parseOriginal(workbook,imageUrls);
  if (!records.length) throw new Error("找不到可匯入的商品資料，請使用原始車種表或後台匯出的 Excel 格式");
  if (records.length > 5000) throw new Error("單次最多匯入 5,000 筆商品");
  return records;
}

export function buildCatalogWorkbook(records: ProductRecord[]) {
  const workbook=XLSX.utils.book_new();
  const headers=["商品種類","商品系列","品牌","車型","年份","商品名稱","貨品編號","國際條碼","產品規格介紹","圖片網址","影片網址"];
  const rows=records.map((row)=>[
    row.category,row.series,row.brand,row.model,row.year,row.name,row.sku,row.barcode,row.description,
    (row.imageUrls?.length ? row.imageUrls : row.imageUrl ? [row.imageUrl] : []).join(", "),
    (row.videoUrls || []).join(", "),
  ]);
  const master=XLSX.utils.aoa_to_sheet([headers,...rows]);
  master["!cols"]=[{wch:14},{wch:14},{wch:14},{wch:24},{wch:14},{wch:46},{wch:20},{wch:20},{wch:58},{wch:42},{wch:42}];
  master["!autofilter"]={ ref:`A1:K${rows.length + 1}` };
  XLSX.utils.book_append_sheet(workbook,master,"商品總表");
  for (const category of [...new Set(records.map((row)=>row.category))]) {
    const categoryRows=rows.filter((_,index)=>records[index].category === category);
    const sheet=XLSX.utils.aoa_to_sheet([headers,...categoryRows]);
    sheet["!cols"]=master["!cols"];
    sheet["!autofilter"]={ ref:`A1:K${categoryRows.length + 1}` };
    XLSX.utils.book_append_sheet(workbook,sheet,category.slice(0,31));
  }
  return XLSX.write(workbook,{ type:"array",bookType:"xlsx",compression:true }) as ArrayBuffer;
}

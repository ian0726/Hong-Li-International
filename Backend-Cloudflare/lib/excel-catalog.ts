import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import { parseWiperSpecification, serializeWiperSpecification, type ProductRecord } from "./product-store";
import { sortProducts } from "./product-sort";

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

export const catalogHeaders=["商品系列","品牌","車型","年份","商品名稱","貨品編號","國際條碼","產品規格介紹","雨刷位置","雨刷尺寸","雨刷接頭","雨刷數量","雨刷規格圖片網址","雨刷規格影片網址","圖片網址","影片網址"];
const catalogColumns=[{wch:14},{wch:14},{wch:24},{wch:14},{wch:46},{wch:20},{wch:20},{wch:58},{wch:16},{wch:20},{wch:20},{wch:16},{wch:42},{wch:42},{wch:42},{wch:42}];
const ignoredSheetNames=new Set(["使用說明","填寫說明","商品總表"]);

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
  const wiperSpecImages=category === "雨刷" ? imageUrlList(input.wiperSpecImageUrls?.join(",")) : [];
  const wiperSpecVideos=category === "雨刷" ? urlList(input.wiperSpecVideoUrls?.join(",")) : [];
  const structuredWiperSpec=parseWiperSpecification(input.wiperSpec);
  const wiperSpec=Object.values(structuredWiperSpec).some(Boolean) ? structuredWiperSpec : parseWiperSpecification(input.wiperSpecification);
  return {
    category, series:valueText(input.series) || "標準版", brand, model, year, sku,
    barcode:valueText(input.barcode), name,
    description:valueText(input.description) || `${category}，適用 ${brand} ${model}${year === "未指定" ? "" : ` ${year}`}。`,
    wiperSpecification:category === "雨刷" ? serializeWiperSpecification(wiperSpec) : "",
    wiperSpec:category === "雨刷" ? wiperSpec : parseWiperSpecification(""),
    wiperSpecImageUrls:wiperSpecImages,
    wiperSpecVideoUrls:wiperSpecVideos,
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
    category:valueText(row["商品種類"]), series:valueText(row["商品系列"]), brand:valueText(row["品牌"]),
    model:valueText(row["車型"]), year:valueText(row["年份"]), name:valueText(row["商品名稱"]),
    sku:valueText(row["貨品編號"]), barcode:valueText(row["國際條碼"]), description:valueText(row["產品規格介紹"]),
    wiperSpecification:valueText(row["雨刷規格說明"]),
    wiperSpec:{
      position:valueText(row["雨刷位置"]),
      size:valueText(row["雨刷尺寸"]),
      connector:valueText(row["雨刷接頭"]),
      quantity:valueText(row["雨刷數量"]),
    },
    wiperSpecImageUrls:imageUrlList(valueText(row["雨刷規格圖片網址"])),
    wiperSpecVideoUrls:urlList(valueText(row["雨刷規格影片網址"])),
    imageUrls:imageUrlList(valueText(row["圖片網址"])), videoUrls:urlList(valueText(row["影片網址"])),
  },index,imageUrls));
}

function categoryFromSheet(name:string,rows:unknown[][]) {
  const title=valueText(rows[0]?.[0]);
  if (title.endsWith("｜商品資料")) return title.slice(0,-5).trim();
  return name.replace(/\s*[｜|]\s*商品資料\s*$/," ").trim();
}

function parseCategorySheets(workbook:XLSX.WorkBook,imageUrls:string[]) {
  const records:InputProduct[]=[];
  for (const sheetName of workbook.SheetNames) {
    if (ignoredSheetNames.has(sheetName)) continue;
    const rows=sheetRows(workbook,sheetName);
    const headerIndex=rows.slice(0,10).findIndex((row)=>{
      const cells=row.map(valueText);
      return ["品牌","車型"].every((header)=>cells.includes(header));
    });
    if (headerIndex<0) continue;
    const headers=rows[headerIndex].map(valueText);
    const category=categoryFromSheet(sheetName,rows);
    for (let rowIndex=headerIndex+1;rowIndex<rows.length;rowIndex++) {
      const values=rows[rowIndex];
      if (!values.some((value)=>valueText(value))) continue;
      const row=Object.fromEntries(headers.map((header,index)=>[header,values[index]]));
      try {
        records.push(product({
          category:valueText(row["商品種類"])||category,
          series:valueText(row["商品系列"]),brand:valueText(row["品牌"]),model:valueText(row["車型"]),year:valueText(row["年份"]),name:valueText(row["商品名稱"]),
          sku:valueText(row["貨品編號"]),barcode:valueText(row["國際條碼"]),description:valueText(row["產品規格介紹"]),
          wiperSpecification:valueText(row["雨刷規格說明"]),
          wiperSpec:{
            position:valueText(row["雨刷位置"]),size:valueText(row["雨刷尺寸"]),
            connector:valueText(row["雨刷接頭"]),quantity:valueText(row["雨刷數量"]),
          },
          wiperSpecImageUrls:imageUrlList(valueText(row["雨刷規格圖片網址"])),
          wiperSpecVideoUrls:urlList(valueText(row["雨刷規格影片網址"])),
          imageUrls:imageUrlList(valueText(row["圖片網址"])),videoUrls:urlList(valueText(row["影片網址"])),
        },records.length,imageUrls));
      } catch (error) {
        const reason=error instanceof Error ? error.message.replace(/^第 \d+ 筆資料/,"資料") : "資料格式錯誤";
        throw new Error(`「${sheetName}」第 ${rowIndex+1} 列${reason}`);
      }
    }
  }
  return records;
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
      category:"手機底座",series:first || "底座款",brand,model,year:valueText(row[5]),
      sku:valueText(row[3]),barcode:valueText(row[2]),name,
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
  const fromCategories=fromMaster.length ? [] : parseCategorySheets(workbook,imageUrls);
  const records=fromMaster.length ? fromMaster : fromCategories.length ? fromCategories : parseOriginal(workbook,imageUrls);
  if (!records.length) throw new Error("找不到可匯入的商品資料，請使用後台下載的固定版型，並將商品填入對應的分類工作表");
  if (records.length > 5000) throw new Error("單次最多匯入 5,000 筆商品");
  return records;
}

function uniqueCategories(categories:string[],records:ProductRecord[]) {
  return [...new Set([...categories,...records.map((row)=>row.category)].map(valueText).filter(Boolean))];
}

function safeSheetName(category:string,used:Set<string>) {
  const base=category.replace(/[\\/?*\[\]:]/g,"-").trim().slice(0,31)||"未命名分類";
  let name=base;
  let suffix=2;
  while (used.has(name)) {
    const tail=`-${suffix++}`;
    name=`${base.slice(0,31-tail.length)}${tail}`;
  }
  used.add(name);
  return name;
}

function recordRow(row:ProductRecord) {
  const spec=parseWiperSpecification(row.wiperSpec||row.wiperSpecification);
  return [
    row.series,row.brand,row.model,row.year,row.name,row.sku,row.barcode,row.description,spec.position,spec.size,spec.connector,spec.quantity,
    (row.wiperSpecImageUrls||[]).join(", "),(row.wiperSpecVideoUrls||[]).join(", "),
    (row.imageUrls?.length?row.imageUrls:row.imageUrl?[row.imageUrl]:[]).join(", "),(row.videoUrls||[]).join(", "),
  ];
}

function appendInstructions(workbook:XLSX.WorkBook,categories:string[]) {
  const rows=[
    ["閎麗國際有限公司｜商品資料固定版型"],
    ["填寫規則"],
    ["1. 每個商品分類使用一個獨立工作表；工作表名稱就是商品分類。"],
    ["2. 必填欄位只有「品牌」與「車型」；商品分類由工作表名稱自動判斷。"],
    ["3. 多張圖片或影片網址請用逗號分隔；圖片空白時使用後台的分類預設圖片。"],
    ["4. 雨刷規格欄位只需在「雨刷」工作表填寫，其他分類可留白。"],
    ["5. 可以直接在表格最後一列下方貼上新商品；請勿修改欄位名稱或刪除標題列。"],
    ["6. 新增或修改商品後不必手動搬動資料列；上傳時系統會依品牌、車型、年份與 SKU 自動排序，同品牌同車型會排在一起。"],
    [],
    ["目前商品分類",...categories],
  ];
  const sheet=XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"]=[{wch:92},...categories.map(()=>({wch:18}))];
  XLSX.utils.book_append_sheet(workbook,sheet,"使用說明");
}

function appendCategorySheet(workbook:XLSX.WorkBook,category:string,records:ProductRecord[],used:Set<string>) {
  const sorted=sortProducts(records);
  const rows=[[`${category}｜商品資料`],["必填：品牌、車型。可直接新增或修改；上傳後系統會自動將相同品牌與車型排在一起。"],catalogHeaders,...sorted.map(recordRow)];
  const sheet=XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"]=catalogColumns;
  sheet["!merges"]=[XLSX.utils.decode_range(`A1:P1`),XLSX.utils.decode_range(`A2:P2`)];
  sheet["!autofilter"]={ref:`A3:P${Math.max(rows.length,3)}`};
  XLSX.utils.book_append_sheet(workbook,sheet,safeSheetName(category,used));
}

export function buildCatalogWorkbook(records: ProductRecord[], categoryNames:string[] = []) {
  const workbook=XLSX.utils.book_new();
  const categories=uniqueCategories(categoryNames,records);
  appendInstructions(workbook,categories);
  const used=new Set(["使用說明"]);
  for (const category of categories) appendCategorySheet(workbook,category,records.filter((row)=>row.category===category),used);
  return XLSX.write(workbook,{ type:"array",bookType:"xlsx",compression:true }) as ArrayBuffer;
}

export function buildCatalogTemplate(categoryNames:string[]) {
  return buildCatalogWorkbook([],categoryNames.length?categoryNames:["手機底座","遮陽板","冷氣濾網","雨刷"]);
}

import { env } from "cloudflare:workers";
import catalogSeed from "./catalog-seed.json";

export type ProductRecord = {
  id: number; name: string; category: string; series: string; brand: string; model: string;
  year: string; sku: string; barcode: string; description: string;
  accent: string; imageUrl?: string | null; imageUrls?: string[]; videoUrls?: string[];
  defaultImageUrl?: string | null; createdAt?: string; updatedAt?: string;
};

type Row = Record<string, unknown>;
type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: () => Promise<Row | null>;
  all: () => Promise<{ results: Row[] }>;
  run: () => Promise<unknown>;
};
type Database = {
  prepare: (query: string) => Statement;
  batch: (statements: Statement[]) => Promise<unknown>;
};
type StoredObject = {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata: (headers: Headers) => void;
};
type Bucket = {
  put: (key: string, value: ArrayBuffer | Uint8Array, options?: unknown) => Promise<unknown>;
  get: (key: string) => Promise<StoredObject | null>;
  delete: (key: string) => Promise<unknown>;
};
type Runtime = { DB: Database; BUCKET: Bucket };
export const runtime = env as unknown as Runtime;

const CATALOG_VERSION = "hong-li-international-xlsx-v1";
const seeds = catalogSeed as ProductRecord[];
const initialCategoryImages: Record<string,string> = {
  "手機底座":"/category-defaults/phone-mount.jpg",
  "冷氣濾網":"/category-defaults/cabin-filter.jpg",
};

function parseUrlList(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.map((item)=>String(item).trim()).filter(Boolean))].slice(0,20);
  if (!value) return [];
  const text=String(value).trim();
  if (!text) return [];
  try {
    const parsed=JSON.parse(text);
    if (Array.isArray(parsed)) return parseUrlList(parsed);
  } catch { /* accept comma-separated legacy input */ }
  return [...new Set(text.split(/[\n,，]+/).map((item)=>item.trim()).filter(Boolean))].slice(0,20);
}

function normalizeImageUrl(rawUrl:string) {
  try {
    const url=new URL(rawUrl);
    if (url.hostname === "drive.google.com") {
      const id=url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
    }
  } catch { /* keep the original value so the admin can correct it */ }
  return rawUrl;
}

export async function ensureDatabase() {
  if (!runtime.DB) throw new Error("資料庫尚未連線");
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      series TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT NOT NULL,
      description TEXT NOT NULL,
      accent TEXT NOT NULL DEFAULT '#f97316',
      image_url TEXT,
      image_urls TEXT NOT NULL DEFAULT '[]',
      video_urls TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      file_key TEXT NOT NULL,
      size INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    runtime.DB.prepare("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      default_image_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS products_fit_idx ON products (brand, model, year, category)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions (user_id, expires_at)"),
  ]);
  const version = await runtime.DB.prepare("SELECT value FROM app_meta WHERE key = 'catalog_version'").first();
  if (String(version?.value || "") !== CATALOG_VERSION) {
    const now = new Date().toISOString();
    await runtime.DB.prepare("DELETE FROM products").run();
    await runtime.DB.prepare("DELETE FROM sqlite_sequence WHERE name = 'products'").run();
    await runtime.DB.batch(seeds.map((row) => runtime.DB.prepare(
      "INSERT INTO products (name,category,series,brand,model,year,sku,barcode,description,accent,image_url,image_urls,video_urls,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(row.name,row.category,row.series,row.brand,row.model,row.year,row.sku,row.barcode,row.description,row.accent,row.imageUrl || null,JSON.stringify(row.imageUrls || []),JSON.stringify(row.videoUrls || []),now,now)));
    const categoryNames = [...new Set(seeds.map((row) => row.category))];
    await runtime.DB.batch(categoryNames.map((name) => runtime.DB.prepare(
      "INSERT OR IGNORE INTO categories (name,created_at,updated_at) VALUES (?,?,?)"
    ).bind(name,now,now)));
    await runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('catalog_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(CATALOG_VERSION).run();
    await runtime.DB.prepare("INSERT OR IGNORE INTO app_meta (key,value) VALUES ('excel_version','1')").run();
    await runtime.DB.prepare(`INSERT OR IGNORE INTO documents (id,name,file_key,size,updated_at)
      VALUES (2,'(試做)專用底座車種表.xlsx','seed://catalog',0,?)`).bind(now).run();
  }
  const repairTime = new Date().toISOString();
  await runtime.DB.batch([
    runtime.DB.prepare(`INSERT OR IGNORE INTO categories (name,created_at,updated_at)
      SELECT DISTINCT category,?,? FROM products WHERE TRIM(category) <> ''`).bind(repairTime,repairTime),
    runtime.DB.prepare(`INSERT OR IGNORE INTO brands (name,created_at,updated_at)
      SELECT DISTINCT UPPER(brand),?,? FROM products WHERE TRIM(brand) <> ''`).bind(repairTime,repairTime),
    runtime.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(repairTime),
  ]);
  const legacyCleanup = await runtime.DB.prepare("SELECT value FROM app_meta WHERE key='legacy_product_images_cleanup_v1'").first();
  if (!legacyCleanup) {
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE products SET image_url=NULL,updated_at=? WHERE image_url IN (
        '/product-images/image1.png','/product-images/image2.png','/product-images/image3.png',
        '/product-images/image4.png','/product-images/image5.png','/product-images/image6.png'
      )`).bind(repairTime),
      runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('legacy_product_images_cleanup_v1','done')"),
    ]);
  }
  const imageDefaultsSeeded = await runtime.DB.prepare("SELECT value FROM app_meta WHERE key='category_default_images_v1'").first();
  if (!imageDefaultsSeeded) {
    await runtime.DB.batch([
      ...Object.entries(initialCategoryImages).map(([name,url])=>runtime.DB.prepare(
        "UPDATE categories SET default_image_url=?,updated_at=? WHERE name=? AND TRIM(default_image_url)=''"
      ).bind(url,repairTime,name)),
      runtime.DB.prepare("INSERT INTO app_meta (key,value) VALUES ('category_default_images_v1','done')"),
    ]);
  }
}

export function mapProduct(row: Row): ProductRecord {
  const imageUrls=parseUrlList(row.image_urls);
  const legacyImage=row.image_url ? String(row.image_url) : null;
  if (!imageUrls.length && legacyImage) imageUrls.push(legacyImage);
  return {
    id: Number(row.id), name: String(row.name), category: String(row.category), series: String(row.series || ""), brand: String(row.brand),
    model: String(row.model), year: String(row.year), sku: String(row.sku), barcode: String(row.barcode),
    description: String(row.description), accent: String(row.accent), imageUrl: imageUrls[0] || legacyImage,
    imageUrls, videoUrls: parseUrlList(row.video_urls),
    defaultImageUrl: row.default_image_url ? String(row.default_image_url) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined, updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function normalizeProduct(input: Partial<ProductRecord>) {
  const required = ["category","brand","model"] as const;
  const labels={ category:"商品分類",brand:"品牌",model:"車型" } as const;
  for (const key of required) if (!String(input[key] ?? "").trim()) throw new Error(`${labels[key]}為必填欄位`);
  const category=String(input.category).trim();
  const brand=String(input.brand).trim();
  const model=String(input.model).trim();
  const year=String(input.year || "").trim() || "未指定";
  const imageUrls=parseUrlList(input.imageUrls?.length ? input.imageUrls : input.imageUrl).map(normalizeImageUrl);
  const videoUrls=parseUrlList(input.videoUrls);
  return {
    name: String(input.name || "").trim() || `${category} ${brand.toUpperCase()} ${model}`, category, series: String(input.series || "").trim() || "標準版",
    brand, model, year, sku: String(input.sku || "").trim() || "未提供",
    barcode: String(input.barcode || "").trim(), description: String(input.description || "").trim() || `${category}，適用 ${brand.toUpperCase()} ${model}${year === "未指定" ? "" : ` ${year}`}。`,
    accent: String(input.accent || "#f97316").trim(),
    imageUrl: imageUrls[0] || null,
    imageUrls,
    videoUrls,
  };
}

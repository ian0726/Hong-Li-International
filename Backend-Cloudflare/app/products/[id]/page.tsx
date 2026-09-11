import type { Metadata } from "next";
import Link from "next/link";
import { ensureDatabase, mapProduct, runtime } from "../../../lib/product-store";
import ProductMediaCarousel from "../../components/product-media-carousel";

async function getProduct(id: string) {
  await ensureDatabase();
  const row = await runtime.DB.prepare(`SELECT p.*,c.default_image_url FROM products p
    LEFT JOIN categories c ON c.name=p.category WHERE p.id = ?`).bind(Number(id)).first();
  return row ? mapProduct(row) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "找不到商品｜閎麗國際有限公司", robots: { index: false } };
  const title = `${product.name}｜${product.brand} ${product.model}｜閎麗國際有限公司`;
  const description = `${product.brand} ${product.model} ${product.year} 適用。SKU：${product.sku}。${product.description}`;
  const resolvedImage = product.imageUrls?.[0] || product.imageUrl || product.defaultImageUrl;
  const image = resolvedImage ? [{ url: resolvedImage, alt: product.name }] : [];
  return {
    title, description,
    openGraph: { title, description, images: image },
    twitter: { card: resolvedImage ? "summary_large_image" : "summary", title, description, images: image },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return <main className="detail-state"><h1>找不到商品</h1><Link href="/">返回產品中心</Link></main>;
  const images=product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : product.defaultImageUrl ? [product.defaultImageUrl] : [];
  const videos=product.videoUrls || [];
  return (
    <main className="product-detail">
      <header className="detail-header"><Link className="detail-brand" href="/"><b>閎麗國際有限公司</b></Link><Link href="/">← 返回產品中心</Link></header>
      <section className="detail-hero">
        <div className="detail-media" style={{ "--detail-accent":product.accent } as React.CSSProperties}><ProductMediaCarousel images={images} videos={videos} name={product.name} fallback={<><span className="detail-orbit"/><strong>{product.category === "冷氣濾網" ? "PM" : product.category.slice(0,2)}</strong><small>PRODUCT / {String(product.id).padStart(3,"0")}</small></>}/></div>
        <div className="detail-copy"><p className="eyebrow dark"><span /> {product.category.toUpperCase()}</p><div className="detail-tags"><span>{product.series}</span><span>{product.brand}</span><span>{product.model}</span><span>{product.year}</span></div><h1>{product.name}</h1><p className="detail-description">{product.description}</p><a className="button primary" href="mailto:sales@ianautostore.com">詢問此項產品 <i>↗</i></a></div>
      </section>
      <section className="spec-section"><div><p className="eyebrow dark"><span /> PRODUCT DATA</p><h2>產品規格</h2></div><dl><div><dt>汽車廠牌</dt><dd>{product.brand}</dd></div><div><dt>車款型號</dt><dd>{product.model}</dd></div><div><dt>適用年份</dt><dd>{product.year || "依原始資料"}</dd></div><div><dt>產品分類／系列</dt><dd>{product.category}／{product.series}</dd></div><div><dt>廠商報價 SKU</dt><dd><code>{product.sku}</code></dd></div><div><dt>國際條碼 EAN</dt><dd><code>{product.barcode || "未提供"}</code></dd></div></dl></section>
      <section className="detail-cta"><h2>需要完整產品清單？</h2><p>下載最新品項總覽，或聯絡我們取得經銷合作資料。</p><div><a className="button primary" href="/api/catalog" target="_blank">查看品項總覽 PDF <i>↗</i></a><a className="button outline-dark" href="mailto:sales@ianautostore.com">聯絡業務</a></div></section>
    </main>
  );
}

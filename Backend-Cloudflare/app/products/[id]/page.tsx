import type { Metadata } from "next";
import { inquiryLink } from "../../../lib/inquiry";
import Link from "next/link";
import { ensureDatabase, mapProduct, runtime, type ProductRecord } from "../../../lib/product-store";
import ProductMediaCarousel from "../../components/product-media-carousel";
import AutoFitTitle from "../../components/auto-fit-title";

const DEFAULT_CONTACT_EMAIL="sales@ianautostore.com";
const DEFAULT_INQUIRY_SUBJECT="我想購買";
const DEFAULT_INQUIRY_BODY=`姓名：

電話：

地址：

購買品項：

車款：

年份：

我們將有專人與您確認訂單，謝謝`;

async function getProduct(id:string) {
  await ensureDatabase();
  const row=await runtime.DB.prepare(`SELECT p.*,c.default_image_url FROM products p
    LEFT JOIN categories c ON c.name=p.category WHERE p.id = ?`).bind(Number(id)).first();
  return row ? mapProduct(row) : null;
}

async function getInquirySettings() {
  await ensureDatabase();
  const rows=await runtime.DB.prepare("SELECT key,value FROM app_meta WHERE key IN ('contact_email','inquiry_email_subject','inquiry_email_body')").all();
  const values=Object.fromEntries(rows.results.map((row)=>[String(row.key),String(row.value)]));
  return {
    email:values.contact_email||DEFAULT_CONTACT_EMAIL,
    subject:values.inquiry_email_subject||DEFAULT_INQUIRY_SUBJECT,
    body:values.inquiry_email_body||DEFAULT_INQUIRY_BODY,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id }=await params;
  const product=await getProduct(id);
  if (!product) return { title:"找不到商品｜閎麗國際有限公司",robots:{ index:false } };
  const title=`${product.name}｜${product.brand} ${product.model}｜閎麗國際有限公司`;
  const description=`${product.brand} ${product.model} ${product.year} 適用。SKU：${product.sku}。${product.description}`;
  const resolvedImage=product.imageUrls?.[0]||product.imageUrl||product.defaultImageUrl;
  const image=resolvedImage ? [{ url:resolvedImage,alt:product.name }] : [];
  return {
    title,description,
    openGraph:{ title,description,images:image },
    twitter:{ card:resolvedImage?"summary_large_image":"summary",title,description,images:image },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }=await params;
  const [product,settings]=await Promise.all([getProduct(id),getInquirySettings()]);
  if (!product) return <main className="detail-state"><h1>找不到商品</h1><Link href="/">返回產品中心</Link></main>;
  const images=product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : product.defaultImageUrl ? [product.defaultImageUrl] : [];
  const mainImage=images[0];
  const supplementaryImages=images.slice(1);
  const videos=product.videoUrls||[];
  const wiperSpecImages=product.wiperSpecImageUrls||[];
  const wiperSpecVideos=product.wiperSpecVideoUrls||[];
  const mailto=inquiryLink(settings,product);
  const fallback=<><span className="detail-orbit"/><strong>{product.category==="冷氣濾網"?"PM":product.category==="雨刷"?"W":product.category.slice(0,2)}</strong><small>PRODUCT / {String(product.id).padStart(3,"0")}</small></>;

  return <main className="product-detail">
    <header className="detail-header"><Link className="detail-brand" href="/"><b>閎麗國際有限公司</b></Link><Link href="/">← 返回產品中心</Link></header>
    <section className="detail-intro">
      <p className="eyebrow dark"><span/> {product.category.toUpperCase()}</p>
      <div className="detail-tags"><span>{product.series}</span><span>{product.brand}</span><span>{product.model}</span><span>{product.year}</span></div>
      <AutoFitTitle as="h1" maxSize={56} mobileMaxSize={34} minSize={12}>{product.name}</AutoFitTitle>
      <div className="detail-intro-bottom"><p>{product.description}</p><a className="button primary" href={mailto}>詢問此項產品 <i>↗</i></a></div>
    </section>
    <section className="primary-media-section" aria-label="主要圖片">
      <div className="primary-media-frame" style={{ "--detail-accent":product.accent } as React.CSSProperties}>
        <ProductMediaCarousel images={mainImage?[mainImage]:[]} videos={[]} name={product.name} fallback={fallback}/>
      </div>
    </section>
    {product.category==="雨刷"&&<section className="wiper-spec-section">
      <div><p className="eyebrow dark"><span/> WIPER SPECIFICATION</p><h2>規格說明</h2></div>
      <dl className="wiper-spec-table"><div><dt>安裝位置</dt><dd>{product.wiperSpec?.position||"未設定"}</dd></div><div><dt>雨刷尺寸</dt><dd>{product.wiperSpec?.size||"未設定"}</dd></div><div><dt>接頭規格</dt><dd>{product.wiperSpec?.connector||"未設定"}</dd></div><div><dt>包裝數量</dt><dd>{product.wiperSpec?.quantity||"未設定"}</dd></div></dl>
    </section>}
    {product.category==="雨刷"&&(wiperSpecImages.length>0||wiperSpecVideos.length>0)&&<section className="wiper-spec-media-section" aria-label="雨刷規格圖片與影片">
      {wiperSpecImages.length>0&&<div className="wiper-spec-media-frame"><ProductMediaCarousel images={wiperSpecImages} videos={[]} name={`${product.name} 規格圖片`}/></div>}
      {wiperSpecVideos.length>0&&<div className="wiper-spec-media-frame video"><ProductMediaCarousel images={[]} videos={wiperSpecVideos} name={`${product.name} 規格影片`}/></div>}
    </section>}
    {supplementaryImages.length>0&&<section className="detail-gallery-section">
      <div className="detail-gallery-frame"><ProductMediaCarousel images={supplementaryImages} videos={[]} name={`${product.name} 補充圖片`}/></div>
    </section>}
    {videos.length>0&&<section className="detail-video-section">
      <div className="detail-video-frame"><ProductMediaCarousel images={[]} videos={videos} name={`${product.name} 商品影片`}/></div>
    </section>}
    <section className="spec-section"><div><p className="eyebrow dark"><span/> PRODUCT DATA</p><h2>產品資料</h2></div><dl><div><dt>汽車廠牌</dt><dd>{product.brand}</dd></div><div><dt>車款型號</dt><dd>{product.model}</dd></div><div><dt>適用年份</dt><dd>{product.year||"依原始資料"}</dd></div><div><dt>產品分類／系列</dt><dd>{product.category}／{product.series}</dd></div><div><dt>廠商報價 SKU</dt><dd><code>{product.sku}</code></dd></div><div><dt>國際條碼 EAN</dt><dd><code>{product.barcode||"未提供"}</code></dd></div></dl></section>
    <section className="detail-cta"><h2>需要完整產品清單？</h2><p>下載最新品項總覽，或聯絡我們取得經銷合作資料。</p><div><a className="button primary" href="/api/catalog" target="_blank">查看品項總覽 PDF <i>↗</i></a><a className="button outline-dark" href={mailto}>聯絡業務</a></div></section>
  </main>;
}

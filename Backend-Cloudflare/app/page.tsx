"use client";

import { useEffect, useMemo, useState } from "react";
import catalogSeed from "../lib/catalog-seed.json";

type Product = {
  id: number; name: string; category: string; series: string; brand: string; model: string;
  year: string; sku: string; barcode: string; description: string; accent: string; imageUrl?: string | null;
  imageUrls?: string[]; videoUrls?: string[]; defaultImageUrl?: string | null;
};

const seedProducts = catalogSeed as Product[];
function vehicleIndex(items:Product[]) {
  return items.reduce<Record<string,Record<string,string[]>>>((map,item)=>{
    map[item.brand]??={};
    map[item.brand][item.model]??=[];
    if(!map[item.brand][item.model].includes(item.year))map[item.brand][item.model].push(item.year);
    return map;
  },{});
}

function ProductVisual({ product }: { product: Product }) {
  const glyph: Record<string, string> = { 手機底座: "M", 遮陽板: "UV", 雨刷: "W", 冷氣濾網: "PM" };
  const resolvedImage = product.imageUrls?.[0] || product.imageUrl || product.defaultImageUrl;
  return (
    <div className="product-visual" style={{ "--product-accent": product.accent } as React.CSSProperties}>
      {resolvedImage && <img className="uploaded-product-image" src={resolvedImage} alt={product.name} />}
      <div className="visual-grid" /><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
      {!resolvedImage && <span className="visual-glyph">{glyph[product.category] || product.category.slice(0,2)}</span>}
      <span className="visual-label">AUTO FIT / {product.id.toString().padStart(2, "0")}</span>
    </div>
  );
}

export default function Home() {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("全部商品");
  const [series, setSeries] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [contactEmail, setContactEmail] = useState("sales@ianautostore.com");
  const categories = useMemo(() => ["全部商品", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const seriesOptions = useMemo(() => Array.from(new Set(products.map((product) => product.series).filter(Boolean))), [products]);
  const brands = useMemo(() => vehicleIndex(products), [products]);
  const productScopedProducts=useMemo(()=>series?products.filter((item)=>item.series===series):products,[series,products]);
  const productBrands=useMemo(()=>vehicleIndex(productScopedProducts),[productScopedProducts]);
  const models = brand ? Object.keys(brands[brand] || {}) : [];
  const years = brand && model ? brands[brand]?.[model] || [] : [];
  const productModels=brand ? Object.keys(productBrands[brand] || {}) : [];
  const productYears=brand&&model ? productBrands[brand]?.[model] || [] : [];
  useEffect(() => {
    fetch("/api/products").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (Array.isArray(data.products) && data.products.length) setProducts(data.products); })
      .catch(() => undefined);
    fetch("/api/settings").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (data.contactEmail) setContactEmail(String(data.contactEmail)); })
      .catch(() => undefined);
  }, []);
  const filtered = useMemo(() => products.filter((item) =>
    (!brand || item.brand === brand) && (!model || item.model === model) &&
    (!year || item.year === year) && (category === "全部商品" || item.category === category) && (!series || item.series === series)
  ), [brand, model, year, category, series, products]);
  const hasSearchFilter = Boolean(brand || model || year || category !== "全部商品" || series);
  function reset() { setBrand(""); setModel(""); setYear(""); setCategory("全部商品"); setSeries(""); }
  function searchProducts() {
    if (!hasSearchFilter) return;
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function resetAndReturn() {
    reset();
    window.setTimeout(() => document.getElementById("finder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="閎麗國際有限公司首頁"><span className="brand-wordmark"><b>閎麗國際有限公司</b><small>HONG LI INTERNATIONAL</small></span></a>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="開啟選單"><span /><span /></button>
        <nav className={menuOpen ? "open" : ""}>
          <a href="#finder" onClick={() => setMenuOpen(false)}>產品查找</a>
          <a href="#catalog" onClick={() => setMenuOpen(false)}>產品系列</a>
          <a href="#advantages" onClick={() => setMenuOpen(false)}>合作優勢</a>
          <a href="/api/catalog" target="_blank">品項總覽 PDF</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>聯絡我們</a>
          <a className="admin-link" href="/admin">管理後台 ↗</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy reveal">
          <p className="eyebrow"><span /> A LOCAL COUPLE IN TAIWAN</p>
          <h1>用心挑選，把實在帶給每一段旅程。</h1>
          <p className="hero-description">我們是一對在地臺灣夫妻，親自比較規格、挑選真正好用的汽車配件。少一點話術，多一點用心，讓每位合作夥伴都能用實在的價格，找到值得信賴的商品。</p>
          <div className="hero-actions">
            <a className="button primary" href="#finder">幫我找到適合商品 <i>↓</i></a>
            <a className="button ghost" href="#advantages">認識我們的堅持</a>
          </div>
        </div>
        <a className="scroll-cue" href="#finder"><span>SCROLL TO EXPLORE</span><i>↓</i></a>
      </section>

      <section className="finder section-pad" id="finder">
        <div className="section-heading finder-heading"><div><p className="eyebrow dark"><span /> PRODUCT FINDER</p><h2>找到真正適合的商品</h2></div></div>
        <div className="finder-modes"><div className="finder-panel">
          <div className="finder-mode-title"><span>01</span><h3>依車輛搜尋</h3></div>
          <div className="finder-fields">
            <label><span>廠牌 / MAKE</span><select value={brand} onChange={(e) => { setSeries(""); setBrand(e.target.value); setModel(""); setYear(""); }}><option value="">選擇汽車廠牌</option>{Object.keys(brands).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className={!brand ? "disabled" : ""}><span>型號 / MODEL</span><select value={model} disabled={!brand} onChange={(e) => { setSeries(""); setModel(e.target.value); setYear(""); }}><option value="">選擇車款型號</option>{models.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className={!model ? "disabled" : ""}><span>年份 / YEAR</span><select value={year} disabled={!model} onChange={(e) => { setSeries(""); setYear(e.target.value); }}><option value="">選擇適用年份</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>商品 / PRODUCT</span><select value={category} onChange={(e) => { setSeries(""); setCategory(e.target.value); }}><option value="全部商品">全部商品</option>{categories.filter((item)=>item !== "全部商品").map((item)=><option key={item}>{item}</option>)}</select></label>
            <button className="search-button" onClick={searchProducts} disabled={!hasSearchFilter}>搜尋商品 <span>↓</span></button>
          </div>
          <p className="finder-guidance"><span aria-hidden="true">i</span> 先選廠牌，再依序縮小車型、年份與商品。</p>
        </div><div className="finder-panel">
          <div className="finder-mode-title"><span>02</span><h3>依產品搜尋</h3></div>
          <div className="finder-fields">
            <label><span>商品系列 / SERIES</span><select value={series} onChange={(e)=>{setSeries(e.target.value);setCategory("全部商品");setBrand("");setModel("");setYear("");}}><option value="">全部商品系列</option>{seriesOptions.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label><span>廠牌 / MAKE</span><select value={brand} onChange={(e)=>{setBrand(e.target.value);setModel("");setYear("");}}><option value="">選擇汽車廠牌</option>{Object.keys(productBrands).map((item)=><option key={item}>{item}</option>)}</select></label>
            <label className={!brand?"disabled":""}><span>型號 / MODEL</span><select value={model} disabled={!brand} onChange={(e)=>{setModel(e.target.value);setYear("");}}><option value="">選擇車款型號</option>{productModels.map((item)=><option key={item}>{item}</option>)}</select></label>
            <label className={!model?"disabled":""}><span>年份 / YEAR</span><select value={year} disabled={!model} onChange={(e)=>setYear(e.target.value)}><option value="">選擇適用年份</option>{productYears.map((item)=><option key={item}>{item}</option>)}</select></label>
            <button className="search-button" onClick={searchProducts} disabled={!hasSearchFilter}>搜尋商品 <span>↓</span></button>
          </div>
          <p className="finder-guidance"><span aria-hidden="true">i</span> 先選 Excel 第二欄的商品系列，例如底座款或螢幕款，再查看適用車型。</p>
        </div></div>
      </section>

      <section className="catalog section-pad" id="catalog">
        <div className="section-heading catalog-heading"><div><p className="eyebrow dark"><span /> PRODUCT RANGE</p><h2>{brand ? `${brand} ${model}` : series || "全部產品資料"}</h2></div><div className="catalog-tools"><p>{year ? `適用年份 ${year}` : `共 ${filtered.length} 筆符合資料`}</p><button onClick={resetAndReturn}>↺ 重設搜尋</button></div></div>
        <div className="category-tabs" role="tablist">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">
          {filtered.map((product) => <article className="product-card" key={product.id}><ProductVisual product={product} /><div className="product-content"><div className="product-tags"><span>{product.category}</span><span>{product.series}</span><span>{product.year || "年份依原表"}</span></div><h3>{product.name}</h3><p>{product.brand} {product.model}・{product.sku}</p><a href={`/products/${product.id}`}>查看產品細節 <span>↗</span></a></div></article>)}
          {!filtered.length && <div className="empty-state"><span>⌕</span><h3>目前沒有符合條件的產品</h3><p>請重設搜尋條件，再選擇其他車型。</p><button onClick={resetAndReturn}>重設搜尋</button></div>}
        </div>
      </section>

      <section className="advantages section-pad" id="advantages">
        <div className="advantage-intro"><p className="eyebrow"><span /> BUILT FOR BUSINESS</p><h2>為長期合作，<br />做好每一個細節。</h2></div>
        <div className="advantage-list">
          <article><span>01</span><div><h3>清楚的產品資料</h3><p>完整車型、年份、SKU 與國際條碼，讓採購與庫存管理更順暢。</p></div></article>
          <article><span>02</span><div><h3>快速的選品效率</h3><p>分層篩選直達相容商品，縮短搜尋與確認規格所需時間。</p></div></article>
          <article><span>03</span><div><h3>彈性的合作支援</h3><p>支援經銷、批發與專案採購，提供適合不同市場的產品組合。</p></div></article>
        </div>
      </section>

      <section className="contact section-pad" id="contact"><p className="eyebrow dark"><span /> START A CONVERSATION</p><h2>正在尋找合適的汽車零配件？</h2><p>告訴我們你的市場與需求，我們會提供適合的產品資料與合作建議。</p><a className="button primary" href={`mailto:${contactEmail}`}>聯絡業務團隊 <i>↗</i></a></section>
      <footer><a className="brand" href="#top"><span className="brand-wordmark"><b>閎麗國際有限公司</b><small>HONG LI INTERNATIONAL</small></span></a><p>專業汽車零配件供應・台灣</p><span>© 2026 閎麗國際有限公司</span></footer>
    </main>
  );
}

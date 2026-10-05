import { useEffect, useMemo, useState } from "react";
import catalogSeed from "./data/catalog-seed.json";

import AutoFitTitle from "./AutoFitTitle";
import ArrowIcon from "./ArrowIcon";
import ProductDetail from "./ProductDetail";
import { DEFAULT_INQUIRY_BODY, inquiryLink, type InquirySettings, type Product } from "./catalog";
import { DEPLOYED_API_ORIGIN } from "./api-config";

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || DEPLOYED_API_ORIGIN).replace(/\/$/, "");
const seedProducts = catalogSeed as Product[];

function assetUrl(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/") && API_BASE) return `${API_BASE}${path}`;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function vehicleIndex(items: Product[]) {
  return items.reduce<Record<string, Record<string, string[]>>>((map, item) => {
    map[item.brand] ??= {};
    map[item.brand][item.model] ??= [];
    if (!map[item.brand][item.model].includes(item.year)) map[item.brand][item.model].push(item.year);
    return map;
  }, {});
}

function ProductVisual({ product }: { product: Product }) {
  const glyph: Record<string, string> = { 手機底座: "M", 遮陽板: "UV", 雨刷: "W", 冷氣濾網: "PM" };
  const resolvedImage = product.imageUrls?.[0] || product.imageUrl || product.defaultImageUrl;
  return <div className="product-visual" style={{ "--product-accent": product.accent } as React.CSSProperties}>
    {resolvedImage && <img className="uploaded-product-image" src={assetUrl(resolvedImage)} alt={product.name} />}
    <div className="visual-grid" /><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
    {!resolvedImage && <span className="visual-glyph">{glyph[product.category] || product.category.slice(0, 2)}</span>}
    <span className="visual-label">AUTO FIT / {product.id.toString().padStart(2, "0")}</span>
  </div>;
}

export default function App() {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("全部商品");
  const [series, setSeries] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(API_BASE ? [] : seedProducts);
  const [settings,setSettings] = useState<InquirySettings>({email:"sales@ianautostore.com",subject:"我想購買",body:DEFAULT_INQUIRY_BODY});
  const [loadError,setLoadError] = useState("");
  const [loading,setLoading] = useState(Boolean(API_BASE));
  const [reload,setReload] = useState(0);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    if (!API_BASE) return;
    const controller=new AbortController();
    setLoading(true);setLoadError("");
    async function load() {
      try {
        const responses=await Promise.all([fetch(`${API_BASE}/api/products`,{signal:controller.signal}),fetch(`${API_BASE}/api/settings`,{signal:controller.signal})]);
        if(responses.some(response=>!response.ok)) throw new Error("商品服務暫時無法連線，請稍後重試。");
        const [catalog,contact]=await Promise.all(responses.map(response=>response.json()));
        if(!Array.isArray(catalog.products)||!contact.contactEmail) throw new Error("商品資料載入失敗，請重試。");
        setProducts(catalog.products);
        setSettings({email:String(contact.contactEmail),subject:String(contact.inquiryEmailSubject||"我想購買"),body:String(contact.inquiryEmailBody||DEFAULT_INQUIRY_BODY),catalogAvailable:Boolean(contact.catalogAvailable)});
      } catch(error) {
        if(!controller.signal.aborted) setLoadError(error instanceof Error?error.message:"商品資料載入失敗");
      } finally { if(!controller.signal.aborted) setLoading(false); }
    }
    void load();return ()=>controller.abort();
  }, [reload]);

  useEffect(() => {
    const openFromHash = () => {
      const match = window.location.hash.match(/^#product-(\d+)$/);
      if (!match) { setSelected(null); return; }
      const product = products.find((item) => item.id === Number(match[1]));
      setSelected(product || null);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [products]);

  const categories = useMemo(() => ["全部商品", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const seriesOptions = useMemo(() => Array.from(new Set(products.map((product) => product.series).filter(Boolean))), [products]);
  const brands = useMemo(() => vehicleIndex(products), [products]);
  const productScopedProducts = useMemo(() => series ? products.filter((item) => item.series === series) : products, [series, products]);
  const productBrands = useMemo(() => vehicleIndex(productScopedProducts), [productScopedProducts]);
  const models = brand ? Object.keys(brands[brand] || {}) : [];
  const years = brand && model ? brands[brand]?.[model] || [] : [];
  const productModels = brand ? Object.keys(productBrands[brand] || {}) : [];
  const productYears = brand && model ? productBrands[brand]?.[model] || [] : [];
  const filtered = useMemo(() => products.filter((item) => (!brand || item.brand === brand) && (!model || item.model === model) && (!year || item.year === year) && (category === "全部商品" || item.category === category) && (!series || item.series === series)), [brand, model, year, category, series, products]);
  const hasSearchFilter = Boolean(brand || model || year || category !== "全部商品" || series);

  function reset() { setBrand(""); setModel(""); setYear(""); setCategory("全部商品"); setSeries(""); }
  function searchProducts() { if (hasSearchFilter) document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function resetAndReturn() { reset(); window.setTimeout(() => document.getElementById("finder")?.scrollIntoView({ behavior: "smooth" }), 50); }
  function closeDetail() { setSelected(null); history.replaceState(null, "", `${location.pathname}${location.search}#top`); }
  if (selected) return <ProductDetail product={selected} settings={settings} onBack={closeDetail} assetUrl={assetUrl} apiBase={API_BASE} />;

  return <main>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="閎麗國際有限公司首頁"><span className="brand-wordmark"><b>閎麗國際有限公司</b><small>HONG LI INTERNATIONAL</small></span></a>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="開啟選單"><span /><span /></button>
      <nav className={menuOpen ? "open" : ""}><a href="#finder">產品查找</a><a href="#catalog">產品系列</a><a href="#advantages">合作優勢</a>{API_BASE && settings.catalogAvailable && <a href={`${API_BASE}/api/catalog`} target="_blank" rel="noreferrer">品項總覽 PDF</a>}<a href="#contact">聯絡我們</a>{API_BASE && <a className="admin-link" href={`${API_BASE}/admin`} target="_blank" rel="noreferrer">管理後台 <ArrowIcon /></a>}</nav>
    </header>
    <section className="hero" id="top" style={{ backgroundImage: `url(${assetUrl("/hero-interior.jpg")})` }}><div className="hero-copy reveal"><p className="eyebrow"><span /> A LOCAL COUPLE IN TAIWAN</p><h1>用心挑選，把實在帶給每一段旅程。</h1><p className="hero-description">我們是一對在地臺灣夫妻，親自比較規格、挑選真正好用的汽車配件。少一點話術，多一點用心，讓每位合作夥伴都能用實在的價格，找到值得信賴的商品。</p><div className="hero-actions"><a className="button primary" href="#finder">幫我找到適合商品 <i>↓</i></a><a className="button ghost" href="#advantages">認識我們的堅持</a></div></div><a className="scroll-cue" href="#finder"><span>SCROLL TO EXPLORE</span><i>↓</i></a></section>
    <section className="finder section-pad" id="finder"><div className="section-heading finder-heading"><div><p className="eyebrow dark"><span /> PRODUCT FINDER</p><h2>找到真正適合的商品</h2></div></div><div className="finder-modes">
      <div className="finder-panel"><div className="finder-mode-title"><span>01</span><h3>依車輛搜尋</h3></div><div className="finder-fields"><label><span>廠牌 / MAKE</span><select value={brand} onChange={(event) => { setSeries(""); setBrand(event.target.value); setModel(""); setYear(""); }}><option value="">選擇汽車廠牌</option>{Object.keys(brands).map((item) => <option key={item}>{item}</option>)}</select></label><label className={!brand ? "disabled" : ""}><span>型號 / MODEL</span><select value={model} disabled={!brand} onChange={(event) => { setSeries(""); setModel(event.target.value); setYear(""); }}><option value="">選擇車款型號</option>{models.map((item) => <option key={item}>{item}</option>)}</select></label><label className={!model ? "disabled" : ""}><span>年份 / YEAR</span><select value={year} disabled={!model} onChange={(event) => { setSeries(""); setYear(event.target.value); }}><option value="">選擇適用年份</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>商品 / PRODUCT</span><select value={category} onChange={(event) => { setSeries(""); setCategory(event.target.value); }}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><button className="search-button" disabled={!hasSearchFilter} onClick={searchProducts}>搜尋商品 <span>↓</span></button></div><p className="finder-guidance"><span>i</span> 任選一項條件即可搜尋，不需要全部填寫。</p></div>
      <div className="finder-panel"><div className="finder-mode-title"><span>02</span><h3>依產品搜尋</h3></div><div className="finder-fields"><label><span>商品系列 / SERIES</span><select value={series} onChange={(event) => { setSeries(event.target.value); setCategory("全部商品"); setBrand(""); setModel(""); setYear(""); }}><option value="">全部商品系列</option>{seriesOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>廠牌 / MAKE</span><select value={brand} onChange={(event) => { setBrand(event.target.value); setModel(""); setYear(""); }}><option value="">選擇汽車廠牌</option>{Object.keys(productBrands).map((item) => <option key={item}>{item}</option>)}</select></label><label className={!brand ? "disabled" : ""}><span>型號 / MODEL</span><select value={model} disabled={!brand} onChange={(event) => { setModel(event.target.value); setYear(""); }}><option value="">選擇車款型號</option>{productModels.map((item) => <option key={item}>{item}</option>)}</select></label><label className={!model ? "disabled" : ""}><span>年份 / YEAR</span><select value={year} disabled={!model} onChange={(event) => setYear(event.target.value)}><option value="">選擇適用年份</option>{productYears.map((item) => <option key={item}>{item}</option>)}</select></label><button className="search-button" disabled={!hasSearchFilter} onClick={searchProducts}>搜尋商品 <span>↓</span></button></div><p className="finder-guidance"><span>i</span> 選擇商品系列，例如底座款或螢幕款，再查看適用車型。</p></div>
    </div></section>
    <section className="catalog section-pad" id="catalog"><div className="section-heading catalog-heading"><div><p className="eyebrow dark"><span /> PRODUCT RANGE</p><h2>{brand ? `${brand} ${model}` : series || "全部產品資料"}</h2></div><div className="catalog-tools"><p>{year ? `適用年份 ${year}` : `共 ${filtered.length} 筆符合資料`}</p><button onClick={resetAndReturn}>↺ 重設搜尋</button></div></div><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="product-grid">{loading&&<div className="empty-state" role="status">正在載入商品…</div>}{loadError&&<div className="empty-state" role="alert"><p>{loadError}</p><button onClick={()=>setReload(value=>value+1)}>重新載入</button></div>}{!loading&&!loadError&&filtered.map((product) => <a className="product-card" href={`#product-${product.id}`} key={product.id} aria-label={`${product.name}｜${product.brand} ${product.model}｜查看產品細節`}><ProductVisual product={product} /><div className="product-content"><div className="product-tags"><span>{product.category}</span>{product.series && <span>{product.series}</span>}<span>{product.year || "年份依原表"}</span></div><AutoFitTitle as="h3" maxSize={26} mobileMaxSize={24} minSize={10}>{product.name}</AutoFitTitle><p>{product.brand} {product.model}・{product.sku}</p><div className="product-card-action">查看產品細節 <ArrowIcon /></div></div></a>)}{!loading && !loadError && !filtered.length && <div className="empty-state"><span>⌕</span><h3>目前沒有符合條件的產品</h3><p>請重設搜尋條件，再選擇其他車型。</p><button onClick={resetAndReturn}>重設搜尋</button></div>}</div></section>
    <section className="advantages section-pad" id="advantages"><div className="advantage-intro"><p className="eyebrow"><span /> BUILT FOR BUSINESS</p><h2>為長期合作，<br />做好每一個細節。</h2></div><div className="advantage-list"><article><span>01</span><div><h3>清楚的產品資料</h3><p>完整車型、年份、SKU 與國際條碼，讓採購與庫存管理更順暢。</p></div></article><article><span>02</span><div><h3>快速的選品效率</h3><p>分層篩選直達相容商品，縮短搜尋與確認規格所需時間。</p></div></article><article><span>03</span><div><h3>彈性的合作支援</h3><p>支援經銷、批發與專案採購，提供適合不同市場的產品組合。</p></div></article></div></section>
    <section className="contact section-pad" id="contact"><p className="eyebrow dark"><span /> START A CONVERSATION</p><h2>正在尋找合適的汽車零配件？</h2><p>告訴我們你的市場與需求，我們會提供適合的產品資料與合作建議。</p><a className="button primary" href={inquiryLink(settings)}>聯絡業務團隊 <ArrowIcon /></a></section>
    <footer><a className="brand" href="#top"><span className="brand-wordmark"><b>閎麗國際有限公司</b><small>HONG LI INTERNATIONAL</small></span></a><p>專業汽車零配件供應・台灣</p><span>© 2026 閎麗國際有限公司</span></footer>
  </main>;
}

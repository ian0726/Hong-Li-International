import { useLayoutEffect } from "react";
import AutoFitTitle from "./AutoFitTitle";
import ArrowIcon from "./ArrowIcon";
import { inquiryLink, type Product, type InquirySettings } from "./catalog";

function videoEmbed(raw:string) {
  try {
    const url=new URL(raw),host=url.hostname.toLowerCase();
    if(host==="youtu.be") return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if(host==="youtube.com"||host.endsWith(".youtube.com")) {
      const id=url.searchParams.get("v")||url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      return id?`https://www.youtube.com/embed/${id}`:null;
    }
    if(host==="vimeo.com"||host.endsWith(".vimeo.com")) {
      const id=url.pathname.match(/\/(\d+)/)?.[1];
      return id?`https://player.vimeo.com/video/${id}`:null;
    }
  } catch { /* show an ordinary link for other sources */ }
  return null;
}

function MediaStack({images=[],videos=[],name,assetUrl}:{images?:string[];videos?:string[];name:string;assetUrl:(url?:string|null)=>string}) {
  return <div className="media-stack">
    {images.map((url,index)=><img key={`${url}-${index}`} src={assetUrl(url)} alt={`${name} ${index+1}`} loading="lazy"/>)}
    {videos.map((url,index)=>{
      const resolved=assetUrl(url),embed=videoEmbed(resolved),title=`${name} ${index+1}`;
      return <div className="media-stack-video" key={`${url}-${index}`}>
        {embed?<iframe src={embed} title={title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
          :/\.(mp4|webm|ogg|mov)([?#].*)?$/i.test(resolved)||resolved.includes("/api/files?")?<video src={resolved} controls playsInline preload="metadata" aria-label={title}/>
          :<a href={resolved} target="_blank" rel="noreferrer">開啟影片 <ArrowIcon /></a>}
      </div>;
    })}
  </div>;
}

export default function ProductDetail({product,settings,onBack,assetUrl,apiBase}:{product:Product;settings:InquirySettings;onBack:()=>void;assetUrl:(url?:string|null)=>string;apiBase:string}) {
  const images=product.imageUrls?.length?product.imageUrls:product.imageUrl?[product.imageUrl]:product.defaultImageUrl?[product.defaultImageUrl]:[];
  const mailto=inquiryLink(settings,product);
  const wiper=product.category==="雨刷";
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [product.id]);
  return <main className="product-detail">
    <header className="detail-header"><button className="detail-brand" onClick={onBack}><b>閎麗國際有限公司</b></button><button onClick={onBack}>← 返回產品中心</button></header>
    <section className="detail-intro"><p className="eyebrow dark"><span/>{product.category}</p>
      <div className="detail-tags">{[product.series,product.brand,product.model,product.year].filter(Boolean).map((item,index)=><span key={index}>{item}</span>)}</div>
      <AutoFitTitle as="h1" maxSize={56} mobileMaxSize={34} minSize={12}>{product.name}</AutoFitTitle>
      <div className="detail-intro-bottom"><p>{product.description}</p><a className="button primary" href={mailto}>詢問此項產品 <ArrowIcon /></a></div>
    </section>
    {images.length>0&&<section className="primary-media-section"><div className="primary-media-frame"><MediaStack images={images.slice(0,1)} name={product.name} assetUrl={assetUrl}/></div></section>}
    {wiper&&<section className="wiper-spec-section"><div><p className="eyebrow dark"><span/>WIPER SPECIFICATION</p><h2>規格說明</h2></div>
      <dl className="wiper-spec-table">{[["安裝位置",product.wiperSpec?.position],["雨刷尺寸",product.wiperSpec?.size],["接頭規格",product.wiperSpec?.connector],["包裝數量",product.wiperSpec?.quantity]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"未設定"}</dd></div>)}</dl>
    </section>}
    {wiper&&Boolean(product.wiperSpecImageUrls?.length||product.wiperSpecVideoUrls?.length)&&<section className="wiper-spec-media-section"><MediaStack images={product.wiperSpecImageUrls} videos={product.wiperSpecVideoUrls} name={product.name} assetUrl={assetUrl}/></section>}
    {images.length>1&&<section className="detail-gallery-section"><MediaStack images={images.slice(1)} name={product.name} assetUrl={assetUrl}/></section>}
    {Boolean(product.videoUrls?.length)&&<section className="detail-video-section"><MediaStack videos={product.videoUrls} name={product.name} assetUrl={assetUrl}/></section>}
    <section className="spec-section"><div><p className="eyebrow dark"><span/>PRODUCT DATA</p><h2>產品資料</h2></div><dl>
      {[["汽車廠牌",product.brand],["車款型號",product.model],["適用年份",product.year||"未指定"],["產品分類／系列",`${product.category}／${product.series}`],["廠商報價 SKU",product.sku||"未提供"],["國際條碼 EAN",product.barcode||"未提供"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></section>
    <section className="detail-cta"><h2>需要完整產品清單？</h2><p>下載最新品項總覽，或聯絡我們取得經銷合作資料。</p><div>{apiBase&&settings.catalogAvailable&&<a className="button primary" href={`${apiBase}/api/catalog`} target="_blank" rel="noreferrer">查看品項總覽 PDF <ArrowIcon /></a>}<a className="button outline-dark" href={mailto}>聯絡業務</a></div></section>
  </main>;
}

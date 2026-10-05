export type WiperSpec = { position:string; size:string; connector:string; quantity:string };
export type Product = {
  id:number; name:string; category:string; series:string; brand:string; model:string;
  year:string; sku:string; barcode:string; description:string; accent:string;
  imageUrl?:string|null; imageUrls?:string[]; videoUrls?:string[]; defaultImageUrl?:string|null;
  wiperSpec?:WiperSpec; wiperSpecImageUrls?:string[]; wiperSpecVideoUrls?:string[];
};

export type InquirySettings = { email:string; subject:string; body:string };
export const DEFAULT_INQUIRY_BODY = `姓名：

電話：

地址：

購買品項：

車款：

年份：

我們將有專人與您確認訂單，謝謝`;

export function inquiryLink(settings:InquirySettings, product?:Product) {
  let body=settings.body.replaceAll("{{商品名稱}}",product?.name||"")
    .replaceAll("{{車款}}",product?.model||"").replaceAll("{{年份}}",product?.year||"");
  if (product) {
    const details:[string,string][]=[
      ["購買品項",product.name],["商品分類",product.category],["商品系列",product.series],
      ["汽車廠牌",product.brand],["車款",product.model],["年份",product.year||"未指定"],
      ["廠商報價 SKU",product.sku||"未提供"],["國際條碼 EAN",product.barcode||"未提供"],
    ];
    if(product.category==="雨刷") details.push(
      ["安裝位置",product.wiperSpec?.position||"未設定"],["雨刷尺寸",product.wiperSpec?.size||"未設定"],
      ["接頭規格",product.wiperSpec?.connector||"未設定"],["包裝數量",product.wiperSpec?.quantity||"未設定"],
    );
    const missing:string[]=[];
    for(const [label,value] of details) {
      const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      const line=new RegExp(`^${escaped}[ \\t]*[：:][ \\t]*[^\\r\\n]*`,"m");
      if(line.test(body)) body=body.replace(line,()=>`${label}：${value}`);
      else missing.push(`${label}：${value}`);
    }
    if(missing.length) {
      const closing="我們將有專人與您確認訂單，謝謝";
      const position=body.indexOf(closing);
      body=position>=0 ? `${body.slice(0,position).trimEnd()}\n\n${missing.join("\n")}\n\n${body.slice(position)}`
        :`${body.trimEnd()}\n\n${missing.join("\n")}`;
    }
  }
  return `mailto:${settings.email}?subject=${encodeURIComponent(settings.subject)}&body=${encodeURIComponent(body)}`;
}

"use client";
import {useState} from "react";
import {imageSource} from "../../lib/image-source";
export default function ProductImage({src,alt=""}:{src:string;alt?:string}){
  return <Preview key={src} src={src} alt={alt}/>;
}
function Preview({src,alt}:{src:string;alt:string}){
  const [failed,setFailed]=useState(false);
  if(failed)return <span role="img" aria-label="圖片無法讀取" title="圖片無法讀取：請確認連結公開或直接上傳圖片" style={{fontSize:12,color:"#9a3412"}}>圖片無法讀取</span>;
  return <img src={imageSource(src)} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}

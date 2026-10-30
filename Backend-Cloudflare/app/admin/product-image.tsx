"use client";
import {useState} from "react";
import {imageSource} from "../../lib/image-source";
export default function ProductImage({src,alt=""}:{src:string;alt?:string}){
  return <Preview key={src} src={src} alt={alt}/>;
}
function Preview({src,alt}:{src:string;alt:string}){
  const [failed,setFailed]=useState(false);
  if(failed)return <span aria-hidden="true" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%",minHeight:40,background:"#f3f4f6",color:"#c5c9cf",borderRadius:8}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg></span>;
  return <img src={imageSource(src)} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}

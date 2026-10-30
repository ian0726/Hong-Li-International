import {useState,type ImgHTMLAttributes} from "react";
type Props=ImgHTMLAttributes<HTMLImageElement>&{fallbackSources?:string[]};
export default function ProductImage(props:Props){
  return <ImageWithStatus key={[props.src,...(props.fallbackSources||[])].join("|")} {...props}/>;
}
function ImageWithStatus({fallbackSources=[],...props}:Props){
  const sources=[...new Set([props.src,...fallbackSources].filter(Boolean))];
  const [sourceIndex,setSourceIndex]=useState(0);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  if(failed)return <span className="image-unavailable" role="status"><span>圖片暫時無法顯示</span>{!props.className?.includes("uploaded-product-image")&&<button type="button" onClick={()=>{setSourceIndex(0);setAttempt(attempt+1);setFailed(false);}}>重新載入</button>}</span>;
  return <img {...props} key={attempt+"-"+sourceIndex} src={sources[sourceIndex]} loading={props.loading||"lazy"} referrerPolicy="no-referrer" onError={()=>{if(sourceIndex+1<sources.length)setSourceIndex(sourceIndex+1);else setFailed(true);}}/>;
}

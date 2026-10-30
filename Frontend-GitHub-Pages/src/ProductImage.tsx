import {useState,type ImgHTMLAttributes} from "react";
type Props=ImgHTMLAttributes<HTMLImageElement>&{fallbackSources?:string[]};
export default function ProductImage(props:Props){
  return <ImageWithStatus key={[props.src,...(props.fallbackSources||[])].join("|")} {...props}/>;
}
function ImageWithStatus({fallbackSources=[],...props}:Props){
  const sources=[...new Set([props.src,...fallbackSources].filter(Boolean))];
  const [sourceIndex,setSourceIndex]=useState(0);
  const [failed,setFailed]=useState(false);
  if(failed||!sources.length)return null;
  return <img {...props} key={sourceIndex} src={sources[sourceIndex]} loading={props.loading||"lazy"} referrerPolicy="no-referrer" onError={()=>{if(sourceIndex+1<sources.length)setSourceIndex(sourceIndex+1);else setFailed(true);}}/>;
}

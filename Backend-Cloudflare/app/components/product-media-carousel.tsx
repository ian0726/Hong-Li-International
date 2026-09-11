"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type MediaItem = { type:"image"|"video"; url:string };

function embedUrl(rawUrl:string) {
  try {
    const url=new URL(rawUrl);
    if (url.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.includes("youtube.com")) {
      const id=url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes("vimeo.com")) {
      const id=url.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { return null; }
  return null;
}

function isDirectVideo(url:string) {
  return /\.(?:mp4|webm|ogg|mov)(?:[?#].*)?$/i.test(url) || url.startsWith("/api/files?");
}

export default function ProductMediaCarousel({images,videos,name,fallback}:{images:string[];videos:string[];name:string;fallback?:ReactNode}) {
  const items=useMemo<MediaItem[]>(()=>[
    ...images.filter(Boolean).map((url)=>({type:"image" as const,url})),
    ...videos.filter(Boolean).map((url)=>({type:"video" as const,url})),
  ],[images,videos]);
  const [active,setActive]=useState(0);
  useEffect(()=>setActive((current)=>Math.min(current,Math.max(items.length-1,0))),[items.length]);
  const item=items[active];
  function move(direction:number){setActive((current)=>(current+direction+items.length)%items.length);}

  return <div className="media-carousel">
    <div className="media-stage">
      {!item && fallback}
      {item?.type==="image"&&<img src={item.url} alt={`${name}－圖片 ${active+1}`}/>} 
      {item?.type==="video"&&<VideoSlide url={item.url} title={`${name}－影片 ${active+1}`}/>} 
      {items.length>1&&<><button type="button" className="media-arrow previous" onClick={()=>move(-1)} aria-label="上一個媒體">‹</button><button type="button" className="media-arrow next" onClick={()=>move(1)} aria-label="下一個媒體">›</button></>}
    </div>
    {items.length>1&&<div className="media-dots" aria-label={`第 ${active+1} 個，共 ${items.length} 個`}>{items.map((entry,index)=><button type="button" key={`${entry.type}-${entry.url}-${index}`} className={index===active?"active":""} onClick={()=>setActive(index)} aria-label={`顯示第 ${index+1} 個${entry.type==="image"?"圖片":"影片"}`}/>)}</div>}
  </div>;
}

function VideoSlide({url,title}:{url:string;title:string}) {
  const embedded=embedUrl(url);
  if (embedded) return <iframe src={embedded} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>;
  if (isDirectVideo(url)) return <video src={url} controls playsInline preload="metadata" aria-label={title}/>;
  return <div className="video-link-card"><span>VIDEO</span><a href={url} target="_blank" rel="noreferrer">開啟影片 ↗</a></div>;
}

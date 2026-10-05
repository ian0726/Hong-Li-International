import type { ReactNode } from "react";

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
  const cleanImages=images.filter(Boolean);
  const cleanVideos=videos.filter(Boolean);
  return <div className="media-stack">
    {!cleanImages.length&&!cleanVideos.length&&<div className="media-fallback">{fallback}</div>}
    {cleanImages.map((url,index)=><img key={`${url}-${index}`} src={url} alt={`${name}－圖片 ${index+1}`}/>)}
    {cleanVideos.map((url,index)=><div className="media-video" key={`${url}-${index}`}><VideoSlide url={url} title={`${name}－影片 ${index+1}`}/></div>)}
  </div>;
}

function VideoSlide({url,title}:{url:string;title:string}) {
  const embedded=embedUrl(url);
  if (embedded) return <iframe src={embedded} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>;
  if (isDirectVideo(url)) return <video src={url} controls playsInline preload="metadata" aria-label={title}/>;
  return <div className="video-link-card"><span>VIDEO</span><a href={url} target="_blank" rel="noreferrer">開啟影片 ↗</a></div>;
}

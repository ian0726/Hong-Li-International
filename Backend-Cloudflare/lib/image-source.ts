export function imageSource(source:string, origin=""):string {
  try { const url=new URL(source); if(["reurl.cc","drive.google.com","docs.google.com"].includes(url.hostname)) return origin+"/api/image?url="+encodeURIComponent(source); } catch {}
  return source;
}
export function displayImages(value:unknown, origin:string):unknown {
  if(Array.isArray(value)) return value.map(item=>displayImages(item,origin));
  if(value && typeof value==="object") return Object.fromEntries(Object.entries(value).map(([key,item])=>{
    if(["imageUrl","defaultImageUrl"].includes(key)&&typeof item==="string") return [key,imageSource(item,origin)];
    if(["imageUrls","wiperSpecImageUrls"].includes(key)&&Array.isArray(item)) return [key,item.map(url=>typeof url==="string"?imageSource(url,origin):url)];
    return [key,displayImages(item,origin)];
  }));
  return value;
}

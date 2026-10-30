const MAX_BYTES=12*1024*1024;
function checkedUrl(value:string):URL {
  const u=new URL(value);
  const allowed=u.hostname==="reurl.cc"||u.hostname==="drive.google.com"||u.hostname==="docs.google.com"||u.hostname.endsWith(".googleusercontent.com");
  if(u.protocol!=="https:"||u.username||u.password||u.port||!allowed) throw new Error("Unsupported image source. Upload the original image instead.");
  return u;
}
function driveImage(u:URL):URL {
  if(!["drive.google.com","docs.google.com"].includes(u.hostname)) return u;
  const id=u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1]||u.searchParams.get("id");
  if(!id||!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid Google Drive image link.");
  const target=new URL("https://drive.google.com/thumbnail");
  target.searchParams.set("id",id); target.searchParams.set("sz","w1600");
  const resourceKey=u.searchParams.get("resourcekey");if(resourceKey)target.searchParams.set("resourcekey",resourceKey);
  return target;
}
async function limitedBody(response:Response, max:number):Promise<Uint8Array<ArrayBuffer>> {
  if(Number(response.headers.get("content-length")||0)>max) throw new Error("Image exceeds the size limit.");
  const reader=response.body?.getReader();if(!reader)throw new Error("Empty image response.");
  const chunks:Uint8Array[]=[];let size=0;
  try { for(;;){ const part=await reader.read();if(part.done)break;size+=part.value.length;
    if(size>max)throw new Error("Image exceeds the size limit.");chunks.push(part.value);
  }} finally {await reader.cancel();}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}return body;
}
export async function resolveImage(source:string):Promise<Response> {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try {
    let current=checkedUrl(source);const seen=new Set<string>();
    for(let hop=0;hop<8;hop++){
      if(current.pathname!=="/thumbnail")current=driveImage(current);
      current=checkedUrl(current.href);if(seen.has(current.href))throw new Error("Image redirect loop.");seen.add(current.href);
      const response=await fetch(current.href,{redirect:"manual",signal:controller.signal,headers:{"Accept":"image/avif,image/webp,image/*;q=0.9,text/html;q=0.5"}});
      if([301,302,303,307,308].includes(response.status)){
        const next=response.headers.get("location");await response.body?.cancel();
        if(!next)throw new Error("Missing redirect target.");current=checkedUrl(new URL(next,current).href);continue;
      }
      if(!response.ok){await response.body?.cancel();throw new Error("Image is unavailable or not publicly shared ("+response.status+").");}
      const type=(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
      if(["image/jpeg","image/png","image/webp","image/gif","image/avif"].includes(type)){
        const bytes=await limitedBody(response,MAX_BYTES);if(!bytes.length)throw new Error("Empty image.");
        return new Response(bytes,{headers:{"Content-Type":type,"Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":"*"}});
      }
      if(current.hostname==="reurl.cc"&&type==="text/html"){
        const html=new TextDecoder().decode(await limitedBody(response,512*1024));
        const tag=html.match(/<input\b[^>]*\bid=["']target["'][^>]*>/i)?.[0];
        const target=tag?.match(/\bvalue=["']([^"']+)["']/i)?.[1];
        if(!target)throw new Error("Short link has no available image target.");
        current=checkedUrl(target.replace(/&amp;/g,"&"));continue;
      }
      await response.body?.cancel();throw new Error("The link returned a web page, not an image. Check sharing permissions or upload the image.");
    }
    throw new Error("Too many image redirects.");
  } finally {clearTimeout(timer);}
}
export async function imageResponse(request:Request):Promise<Response>{
  if(!["GET","HEAD"].includes(request.method))return new Response(null,{status:405,headers:{Allow:"GET, HEAD"}});
  try {const source=new URL(request.url).searchParams.get("url");if(!source||source.length>4096)throw new Error("Invalid image URL.");
    const response=await resolveImage(source);return request.method==="HEAD"?new Response(null,{headers:response.headers}):response;
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load image."},{status:422,headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"*"}});}
}

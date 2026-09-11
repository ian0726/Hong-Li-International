"use client";

type Props={
  kind:"image"|"video";
  urls:string[];
  onChange:(urls:string[])=>void;
  onUpload?:(files:FileList)=>void;
};

export default function MediaUrlEditor({kind,urls,onChange,onUpload}:Props){
  const noun=kind==="image"?"圖片":"影片";
  function update(index:number,value:string){onChange(urls.map((url,itemIndex)=>itemIndex===index?value:url));}
  function remove(index:number){onChange(urls.filter((_,itemIndex)=>itemIndex!==index));}
  return <div className="media-url-editor">
    <div className="media-url-list">{urls.map((url,index)=><div className="media-url-row" key={`${kind}-${index}`}>
      <span className="media-order">{String(index+1).padStart(2,"0")}</span>
      {kind==="image"&&url?<img src={url} alt=""/>:<span className="media-kind">{kind==="image"?"IMG":"VIDEO"}</span>}
      <input type="url" value={url} onChange={(event)=>update(index,event.target.value)} placeholder={`貼上${noun}網址`}/>
      <button type="button" className="media-remove" onClick={()=>remove(index)} aria-label={`刪除第 ${index+1} 個${noun}`}>刪除</button>
    </div>)}</div>
    {!urls.length&&<div className="media-url-empty">目前沒有商品{noun}</div>}
    <div className="media-url-actions"><button type="button" className="admin-secondary" onClick={()=>onChange([...urls,""])}>＋ 新增{noun}連結</button>{kind==="image"&&onUpload&&<label className="admin-secondary upload-pill"><input type="file" accept="image/*" multiple onChange={(event)=>{if(event.target.files?.length)onUpload(event.target.files);event.currentTarget.value="";}}/>上傳圖片</label>}</div>
  </div>;
}

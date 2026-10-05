import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import XLSX from "xlsx";

test("isolated Workers database, authentication, media and Excel import/export", {timeout:60000}, async()=>{
  const directory=fileURLToPath(new URL("../dist/server",import.meta.url));
  const walk=(path)=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(path,entry.name)):/\.m?js$/.test(entry.name)?[join(path,entry.name)]:[]);
  const files=walk(directory).sort((a,b)=>Number(b===join(directory,"index.js"))-Number(a===join(directory,"index.js")));
  const runtime=new Miniflare({
    modules:files.map(path=>({type:"ESModule",path,contents:readFileSync(path,"utf8")})),
    compatibilityDate:"2026-05-22",compatibilityFlags:["nodejs_compat"],
    assets:{directory:fileURLToPath(new URL("../dist/client",import.meta.url)),binding:"ASSETS",routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
    d1Databases:{DB:"isolated-test-catalog"},r2Buckets:{BUCKET:"isolated-test-files"},
    bindings:{ADMIN_SETUP_KEY:"local-integration-setup"},
  });
  let cookie="";
  const request=async(path,options={})=>{
    const input=new Request(`https://test.example${path}`,{...options,headers:{...(cookie?{cookie}:{}),...options.headers}});
    return runtime.dispatchFetch(input.url,{method:input.method,headers:Object.fromEntries(input.headers),body:input.method==="GET"||input.method==="HEAD"?undefined:await input.arrayBuffer()});
  };
  const post=(path,data)=>request(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
  try {
    const initial=await Promise.all([request("/api/products"),request("/api/products"),request("/api/settings")]);
    initial.forEach(response=>assert.equal(response.status,200));
    assert.equal(initial[0].headers.get("access-control-allow-origin"),"*");
    const originalCount=(await initial[0].json()).products.length;
    assert.ok(originalCount>0);
    assert.equal((await post("/api/products",{category:"手機底座",brand:"AUDI",model:"Q5"})).status,401);
    assert.equal((await post("/api/auth/setup",{username:"test-admin",password:"local-test-password"})).status,403);
    const setup=await post("/api/auth/setup",{username:"test-admin",password:"local-test-password",setupKey:"local-integration-setup"});
    assert.equal(setup.status,201,await setup.clone().text());
    cookie=setup.headers.get("set-cookie").split(";")[0];
    assert.equal((await post("/api/auth/setup",{username:"other-admin",password:"local-test-password",setupKey:"local-integration-setup"})).status,409);
    const created=await post("/api/products",{category:"手機底座",brand:"AUDI",model:"Q5"});
    assert.equal(created.status,201,await created.clone().text());
    assert.equal((await created.json()).product.model,"Q5");
    const database=await runtime.getD1Database("DB");
    await database.prepare("UPDATE app_meta SET value='older-build' WHERE key='catalog_version'").run();
    assert.equal((await (await request("/api/products")).json()).products.length,originalCount+1);
    const workbook=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["品牌","車型"],["AUDI","Q5"],["AUDI","Q5"]]),"手機底座");
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([["品牌","車型","雨刷位置","雨刷尺寸","雨刷接頭","雨刷數量","圖片網址"],["BMW","X3","後擋","350 mm","16 mm","1 支","https://example.com/1.png,https://example.com/2.png"]]),"雨刷");
    const form=new FormData();
    form.append("file",new Blob([XLSX.write(workbook,{bookType:"xlsx",type:"buffer"})]),"test-catalog.xlsx");
    const imported=await request("/api/excel",{method:"POST",body:form});
    assert.equal(imported.status,200,await imported.clone().text());
    assert.equal((await imported.json()).productCount,3);
    const importedProducts=(await (await request("/api/products")).json()).products;
    assert.equal(importedProducts.filter(item=>item.model==="Q5").length,2);
    assert.equal(importedProducts.find(item=>item.category==="手機底座").imageUrls.length,0);
    const wiper=importedProducts.find(item=>item.category==="雨刷");
    assert.equal(wiper.wiperSpec.connector,"16 mm");
    assert.equal(wiper.imageUrls.length,2);
    const detail=await request(`/products/${wiper.id}`);
    assert.equal(detail.status,200);
    const html=await detail.text();
    assert.match(html,/閎麗國際有限公司/);assert.match(html,/規格說明/);assert.match(html,/16 mm/);
    const exported=await request("/api/excel/export");
    assert.equal(exported.status,200);
    const parsed=XLSX.read(await exported.arrayBuffer());
    assert.ok(parsed.SheetNames.includes("手機底座"));assert.ok(parsed.SheetNames.includes("雨刷"));
    const uploadForm=new FormData();
    uploadForm.append("file",new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=","base64")],{type:"image/png"}),"test.png");
    uploadForm.append("kind","image");
    const uploaded=await request("/api/uploads",{method:"POST",body:uploadForm});
    assert.equal(uploaded.status,200,await uploaded.clone().text());
    const media=await uploaded.json();
    assert.equal((await request(media.url)).status,200);
    await request("/api/auth/logout",{method:"POST"});
    cookie="";
    assert.equal((await request("/api/excel/export")).status,401);
    const loggedIn=await post("/api/auth/login",{username:"test-admin",password:"local-test-password"});
    assert.equal(loggedIn.status,200);
  } finally {await runtime.dispose();}
});

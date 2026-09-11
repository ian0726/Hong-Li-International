# 閎麗國際有限公司後台與 API

這是閎麗國際有限公司的完整後台版本，包含：

- 商品、分類、汽車品牌新增／編輯／刪除
- 商品圖片上傳
- Excel 整批匯入、版本顯示與匯出
- 品項總覽 PDF 上傳
- 管理員帳號與密碼管理
- 聯絡業務 Email 設定
- 公開商品 API，供 GitHub Pages 前台讀取

## 為什麼後台不能直接放在 GitHub Pages

GitHub Pages 只提供靜態 HTML、CSS 與 JavaScript 託管，不能執行登入、資料庫、Excel 更新與圖片上傳等伺服器功能。因此這個 Repository 放在 GitHub 保存程式碼，實際後台部署至 Cloudflare Workers，資料使用 D1，檔案使用 R2。

## 1. 安裝與登入

```bash
npm install
npx wrangler login
```

## 2. 建立資料庫與檔案空間

```bash
npx wrangler d1 create hong-li-international-db
npx wrangler r2 bucket create hong-li-international-files
```

將 D1 指令回傳的 `database_id` 填入 `wrangler.jsonc`，取代：

```text
00000000-0000-4000-8000-000000000000
```

## 3. 建立資料表

```bash
npm run deploy:database
```

## 4. 本機開發與部署

```bash
npm run dev
npm run deploy
```

部署完成後，Cloudflare 會提供類似以下網址：

```text
https://hong-li-international-backend.<你的帳號>.workers.dev
```

第一次開啟 `/admin` 時，系統會要求建立第一個管理員帳號與密碼。

## 5. 連接 GitHub Pages 前台

將 Worker 網址填入前台 Repository 的 `VITE_API_BASE_URL`。公開讀取 API 已允許跨網域存取；後台修改功能仍需登入並在 Worker 網域內操作。

## GitHub Repository

可直接把此資料夾全部內容上傳至獨立 Repository，例如：

```text
hong-li-international-backend
```

再到 Cloudflare Dashboard 的 Workers & Pages 連接該 GitHub Repository，或在本機執行 `npm run deploy`。

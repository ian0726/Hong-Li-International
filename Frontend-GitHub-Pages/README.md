# 閎麗國際有限公司前台（GitHub Pages）

這是可直接部署到 GitHub Pages 的前台版本，包含響應式首頁、兩種商品搜尋、多圖片／影片商品詳情及聯絡按鈕。

## 本機啟動

```bash
npm install
npm run dev
```

## 連接後台

1. 複製 `.env.example` 為 `.env`。
2. 將 `VITE_API_BASE_URL` 改成後台 Cloudflare Worker 網址。
3. 在 GitHub Repository 的 **Settings → Secrets and variables → Actions → Variables** 新增同名變數。

沒有設定後台網址時，網站會使用內附的 Excel 商品資料，仍可正常瀏覽與篩選。

## 發布 GitHub Pages

1. 建立新的 GitHub Repository 並上傳此資料夾全部內容。
2. 到 **Settings → Pages**，將 Source 設為 **GitHub Actions**。
3. 推送到 `main` 後會自動建置與發布。

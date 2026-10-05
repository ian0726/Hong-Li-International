# 閎麗國際有限公司

前台：https://ian0726.github.io/Hong-Li-International/

後台：https://hong-li-international-backend.ianyang-0726.workers.dev/admin

`Frontend-GitHub-Pages` 為靜態前台；`Backend-Cloudflare` 為管理後台、API、D1 資料庫與 R2 檔案空間。

請以儲存庫內目前的資料夾為準；既有 ZIP 是之前版本的備份。

前台由根目錄 `.github/workflows/deploy-pages.yml` 自動部署。更新 `main` 的前台檔案後，請到 GitHub Actions 確認部署成功。

商品、圖片、影片、分類及 Email 在後台更新後，前台重新整理即可讀到最新資料。

後台程式更新時，在 `Backend-Cloudflare` 資料夾執行：

```powershell
npm.cmd ci
npx.cmd wrangler login
npm.cmd run deploy:database
npm.cmd run deploy
```

資料庫 migration 只會套用尚未執行的版本；程式重新部署不會覆蓋已儲存的商品。

Excel 以商品分類分 Sheet，Sheet 名稱就是商品分類；品牌、車型為必填，其餘欄位可留白。後台可下載固定版型或匯出目前資料。Excel 上傳會整批取代商品資料，請先匯出備份；上傳前會檢查格式，成功後依分類、品牌、車型、年份與 SKU 排序。

多個圖片或影片網址可用逗號分隔，商品頁會直列顯示。沒有商品圖片時使用後台設定的分類預設圖片。

管理員帳號由新 Cloudflare 後台獨立管理。首次設定碼、密碼、Cloudflare Token 與登入 Session 不得上傳 GitHub。

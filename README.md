# 旅途 — 旅遊行程規劃 PWA

一款完全離線可用的旅遊行程規劃 App，支援 PWA 安裝至手機主畫面。

## 功能

- 多行程管理（新增 / 編輯 / 刪除）
- 每日行程分頁（Day 1, 2, 3...）
- 行程項目：時間、地點、類型、地址、備註
- 拖曳 + ↑↓ 按鈕排序
- Google Maps 一鍵開啟地點
- 備忘清單（行李 / 待辦）
- 完全離線可用（Service Worker + localStorage）
- 手機優化 UI

## 部署到 GitHub Pages

### 方法一：GitHub Actions（推薦）

1. 將此資料夾推送到 GitHub repo
2. 到 repo Settings → Pages
3. Source 選 **GitHub Actions**
4. Push 到 main branch 即自動部署

```bash
git init
git add .
git commit -m "init: 旅途 travel app"
git remote add origin https://github.com/你的帳號/travel-app.git
git push -u origin main
```

### 方法二：手動 gh-pages

```bash
git init
git checkout -b gh-pages
git add .
git commit -m "deploy"
git push origin gh-pages
```

然後在 Settings → Pages 選 gh-pages branch。

## 本地開發

```bash
# 使用任意 HTTP server 即可
npx serve .
# 或
python3 -m http.server 8080
```

> 注意：Service Worker 需要 HTTPS 或 localhost 才能啟用。

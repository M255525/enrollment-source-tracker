# enrollment-source-tracker — 招生成效追蹤

辦訓單位／講師用：每個招生管道一條專屬報名連結＋QR（Google 表單預先填入／`?src=`／UTM）→ 匯入報名名單（CSV／xlsx／貼上）→ 各管道報名數、報名率、每位報名成本、錄取／繳費／到課漏斗、每日累積 vs 進度線、截止前能否額滿、規則式建議。多個招生班別。

2026-11-18 建立。使用者從「辦訓單位方向」第二輪清單挑第 15 項；規格由 Claude 決定；無序號。**2026-11-18 已上線** <https://m255525.github.io/enrollment-source-tracker/>（使用者自己 `gh repo create … --push`；Claude 開 Pages、補 master 部署規則、workflow_dispatch 一次成功）。線上 `ET_BASE=https://m255525.github.io/enrollment-source-tracker/ python tools/e2e_et.py` 37 項全過。已加程式牆與 github-dashboard `REPO_META`、AI 工具導航（`subsidy` 情境）。本機預覽 port **8895**。上線改版要升 `service-worker.js` 的 `CACHE_NAME`。

## 為什麼沒有點擊統計
純靜態網站沒有後端、無法做轉址計數；點擊數由使用者從 FB／LINE 後台抄進來（選填）。追蹤靠「連結帶來源代碼 → 報名表存下來 → 匯入時歸戶」。若日後要自動計點擊，需要另做 Cloudflare Worker 轉址（未做）。

## 檔案
- `data.js`：純函式引擎（`window.ET`，node 可 require）。
  - `PRESETS` 15 個常用管道（code、名稱、自填關鍵字 regex）；`addPreset` 不重複加；`normalize` 管道代碼 `slug` 成英數且不重複、**報名列只保留 `{t, src, how, st, k}` 五欄**。
  - `detectPrefill(url)`：找出值是 TEST（或只有一個 entry）的 `entry.xxx`；`link(c, ch)` 依 mode 產生專屬連結（gform 補 `usp=pp_url`）。
  - 匯入：`parseCSV`（引號、Tab、BOM）、`parseTime`（Google 表單「上午／下午」、ISO、民國年、美式、中文年月日、Excel 序號）、`guessCols`（時間／來源／自填／狀態／去重鍵 Email>電話>身分證>姓名）、`statusOf`（錄取／繳費／到課／取消關鍵字）、`importRows`（去重鍵用 FNV `hash`，重複者狀態取較後進度、取消優先）。
  - `attribute`：來源代碼優先（by link）→ 自填對到管道名稱或關鍵字（by self；不在清單＝other）→ unknown。
  - `analyze(c, today)`：每管道 reg/adm/paid/att/cancel、報名率、cpr／cpa、發布後 3 天報名數；每日累積；預測（最近 7 天平均速度 × 剩餘天數）；`insights` 規則（最多、最划算、點擊 ≥50 且報名率 <2%、花錢 0 報名、發布帶動前 3、未知 ≥20%、有到課資料時到課率 <50%、額滿預估）。`summaryCsv`、`sample(today)`（固定亂數、日期跟著今天，**範例沒有「到課」狀態**，因為還在招生中）。
- `io.js`：`zipStore`（複製自 course-poster-maker）＋自寫 `readXlsx`（中央目錄＋`DecompressionStream('deflate-raw')`，讀第一個工作表）。
- `app.js`：畫面。localStorage `et.` 前綴：`camps`（`[{id, c}]`）、`cur`、`step`、`fs`、`fold`、`warnSeen`、`marquee`。**匯入時的原始表格只在記憶體 `IMP`，預覽把去重欄顯示成 ●●●，匯入後丟棄**。CSV 先用 UTF-8 讀、出現 � 就改 big5。圖表自繪 SVG：長條圖（單色、末端圓角、直接標數值）、累積折線＋橘色虛線進度線＋▲發布日、十字線提示；配色依 dataviz skill 參考色（藍 #2A78D6、橘 #EB6834），刻度 `niceMax`＋`divs` 保證整數。QR 用 cdnjs qrcodejs，卡片含管道名與班別名，可下載 PNG、ZIP（含連結清單.txt）、列印一覽。測試掛鉤 `window._et`（`setToday` 可固定今天）。
- 畫面：明亮白板方格紙（和講師三工具的深色區隔）。

## 驗證
- 改 `data.js` 跑 `node tools/test_engine.mjs`（50 項）。
- `python tools/e2e_et.py [輸出資料夾]`（先開 8895；線上版設 `ET_BASE`）：openpyxl 產生假 Google 表單 xlsx＋CSV（含重複、取消、自填）。警語、五件套、範例分析、兩種滑鼠提示、CSV、新班別、自動找來源題、預設／自訂管道、QR 彈窗＋**jsQR 掃得出專屬連結**、QR ZIP、欄位自動對應、預覽不露個資、**localStorage 與備份都沒有姓名 Email 電話**、去重狀態升級、自填歸戶、每位報名成本、xlsx 取代匯入、貼上、列印、切換班別、⚙、點空白不開設定、375px、無 console 錯誤。2026-11-18 全過（37 項）。
- 真實 Google 表單預先填入連結、big5 編碼 CSV 未實測。

## 標準配備
跑馬燈（不可關）、⚙ 常用設定（收合：顯示、💾 備份與還原、📘 範例、清除全部資料、關於本工具）、首訪警語＋頁面入口、`manual.html#creator`（改 `tools/manual_body.html` 後跑 `python tools/build_manual.py`）、PWA（`tools/make_icons.py`；上線改版升 `service-worker.js` 的 `CACHE_NAME`）、訪客計數器 `m255525.enrollmentsourcetracker`。無序號。

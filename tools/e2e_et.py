# 端對端測試：先開 8895（或設 ET_BASE 測線上版），python tools/e2e_et.py [輸出資料夾]
# 會用 openpyxl 產生一份假的 Google 表單回覆 xlsx 與 CSV 來測匯入（姓名電話全部虛構）。
import asyncio, io, os, sys, tempfile, zipfile
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
from playwright.async_api import async_playwright

BASE = os.environ.get('ET_BASE', 'http://localhost:8895/').rstrip('/') + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
os.makedirs(OUT, exist_ok=True)
R = []
def ok(c, m):
    R.append(bool(c)); print(('✓ ' if c else '✗ ') + m)

HEAD = ['時間戳記', '姓名', '電子郵件地址', '行動電話', '您從哪裡得知本課程？', '來源代碼', '錄取狀態']
ROWS = [
    ['2026/11/3 下午 2:15:30', '測試甲', 'a@example.com', '0900000001', '', 'fbpage', '已錄取'],
    ['2026/11/3 下午 3:00:00', '測試乙', 'b@example.com', '0900000002', '', 'fbpage', '已繳費'],
    ['2026/11/4 上午 9:10:00', '測試丙', 'c@example.com', '0900000003', '', 'lineoa', ''],
    ['2026/11/5 上午 11:00:00', '測試丁', 'd@example.com', '0900000004', '朋友介紹', '', ''],
    ['2026/11/6 下午 8:00:00', '測試戊', 'e@example.com', '0900000005', '在 FB 粉專看到', '', '取消報名'],
    ['2026/11/7 上午 10:00:00', '測試甲', 'A@example.com', '0900000001', '', 'fbpage', '已報到'],
]
def make_files():
    csvp = os.path.join(OUT, 'reg.csv')
    with open(csvp, 'w', encoding='utf-8-sig', newline='') as f:
        import csv; w = csv.writer(f); w.writerow(HEAD); w.writerows(ROWS)
    xp = os.path.join(OUT, 'reg.xlsx')
    try:
        import openpyxl
        wb = openpyxl.Workbook(); ws = wb.active; ws.append(HEAD)
        for r in ROWS: ws.append(r)
        wb.save(xp)
    except ImportError:
        xp = None
    return csvp, xp

async def main():
    csvp, xp = make_files()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'visitor-badge' not in m.text and 'script.google' not in m.text else None)
        await pg.goto(BASE + 'index.html'); await pg.wait_for_timeout(1200)
        ok(await pg.is_visible('#modal.show') and '使用警語' in await pg.inner_text('#modalBox'), '首訪跳出使用警語')
        await pg.click('[data-act="close"]')
        foot = await pg.inner_html('.foot2')
        ok(all(k in foot for k in ['manual.html', '#creator', 'data-act="warn"', 'visitor-badge']), '頁尾五件套入口')
        ok(len(await pg.query_selector_all('.kpi')) == 4 and len(await pg.query_selector_all('svg.chart')) == 3, '首訪載入範例分析（4 個數字、3 張圖）')
        ok(await pg.locator('.ins li.bad').count() >= 1, '範例有來不及額滿的提醒')
        # 滑鼠提示
        await pg.hover('svg.chart rect[data-line]', position={'x': 250, 'y': 100}); await pg.wait_for_timeout(200)
        ok(await pg.is_visible('#tip') and '累積' in await pg.inner_text('#tip'), '趨勢圖滑鼠提示')
        await pg.hover('svg.chart g[data-tip] >> nth=0'); await pg.wait_for_timeout(200)
        ok('報名' in await pg.inner_text('#tip'), '長條圖滑鼠提示')
        async with pg.expect_download() as d: await pg.click('[data-act="csv"]')
        t = open(await (await d.value).path(), encoding='utf-8-sig').read()
        ok(t.startswith('管道,代碼') and '合計' in t, '下載 CSV')

        # 新班別與設定
        await pg.click('[data-act="newCamp"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate('window._et.CAMPS.length') == 2, '新增班別')
        await pg.fill('[data-c="name"]', '測試班 第 1 期')
        await pg.fill('[data-c="url"]', 'https://docs.google.com/forms/d/e/TESTFORM/viewform?usp=pp_url&entry.555=&entry.777=TEST')
        await pg.wait_for_timeout(400)
        ok('entry.777' in await pg.inner_text('#detect'), '自動找出來源題參數')
        await pg.click('[data-preset="flyer"]'); await pg.wait_for_timeout(200)
        ok(await pg.locator('#chBody tr').count() == 5, '加入預設管道')
        await pg.click('[data-act="customCh"]'); await pg.fill('#cName', '里長廣播'); await pg.fill('#cCode', 'Village!'); await pg.click('[data-act="customOk"]'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("window._et.C.channels.some(c=>c.code==='village')"), '自訂管道代碼清理成英數')
        links = await pg.evaluate("window._et.C.channels.map(c=>ET.link(window._et.C,c))")
        ok(all('entry.777=' in u for u in links) and 'entry.777=fbpage' in links[0], '每個管道一條專屬連結')
        await pg.locator('#chBody tr').first.locator('[data-ch="cost"]').fill('1200')
        await pg.click('[data-qr="0"]'); await pg.wait_for_timeout(1500)
        ok(await pg.is_visible('.qrbig img'), 'QR code 彈窗')
        got = await pg.evaluate('''async () => {
          if(!window.jsQR) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
          const im = document.querySelector('.qrbig img'); await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, c.width, c.height); return r ? r.data : null; }''')
        ok(got and 'entry.777=fbpage' in got, 'QR 用 jsQR 掃得出專屬連結 ' + str(got)[:90])
        await pg.click('#modalBox [data-act="close"]')
        async with pg.expect_download() as d: await pg.click('[data-act="zipQr"]')
        zp = await (await d.value).path(); z = zipfile.ZipFile(zp)
        ok(len([n for n in z.namelist() if n.endswith('.png')]) == 6 and '連結清單.txt' in z.namelist(), 'QR ZIP（6 張＋連結清單）' + str(z.namelist()[:3]))
        # 匯入 CSV
        await pg.click('[data-step="import"]'); await pg.wait_for_timeout(200)
        await pg.set_input_files('[data-file="reg"]', csvp); await pg.wait_for_timeout(500)
        cols = await pg.evaluate('window._et.IMP.cols')
        ok(cols == {'t': 0, 'src': 5, 'how': 4, 'st': 6, 'key': 2}, '自動對應欄位 ' + str(cols))
        pv = await pg.inner_text('#impBox')
        ok('測試甲' not in pv and 'a@example.com' not in pv and '●●●' in pv, '預覽不顯示姓名與 Email')
        ok('可以匯入 5 筆' in pv and '重複 1 筆' in pv, '預覽統計（5 筆、重複 1）')
        await pg.click('[data-act="doImport"]'); await pg.wait_for_timeout(500)
        st = await pg.evaluate("JSON.stringify(window._et.CAMPS)")
        ok('測試甲' not in st and 'example.com' not in st and '0900000001' not in st, 'localStorage 沒有姓名、Email、電話')
        ls = await pg.evaluate("localStorage.getItem('et.camps')")
        ok('測試甲' not in ls and '測試丁' not in ls and '@' not in ls and '09000' not in ls, '存檔內容沒有個資')
        a = await pg.evaluate("(()=>{const a=ET.analyze(window._et.C, Date.now());return a.list.map(b=>[b.code,b.reg,b.adm,b.paid,b.att,b.cancel])})()")
        fb = [x for x in a if x[0] == 'fbpage'][0]
        ok(fb[1] == 2 and fb[4] == 1, 'fbpage 2 人、重複的那位狀態升級為到課 ' + str(fb))
        ok([x for x in a if x[0] == 'friend'][0][1] == 1, '自填「朋友介紹」→親友推薦')
        ok([x for x in a if x[0] == 'fbpage'][0][5] == 1, '自填 FB 粉專且取消→算在 fbpage 取消')
        ok(await pg.evaluate('window._et.C.channels[0].cost') == '1200', '花費有存')
        rep = await pg.inner_text('#body')
        ok('600 元' in rep, '每位報名成本 1200÷2＝600 元')
        await pg.screenshot(path=os.path.join(OUT, 'report.png'), full_page=True)

        # 匯入 xlsx（取代）
        if xp:
            await pg.click('[data-step="import"]'); await pg.wait_for_timeout(200)
            await pg.set_input_files('[data-file="reg"]', xp); await pg.wait_for_timeout(800)
            ok(await pg.evaluate('window._et.IMP && window._et.IMP.body.length') == 6, '讀取 xlsx 6 列')
            await pg.select_option('[data-impmode]', 'replace'); await pg.wait_for_timeout(200)
            await pg.click('[data-act="doImport"]'); await pg.wait_for_timeout(400)
            ok(await pg.evaluate('window._et.C.rows.length') == 5, 'xlsx 取代匯入 5 筆')
        # 貼上
        await pg.click('[data-step="import"]'); await pg.click('[data-act="pasteReg"]')
        await pg.fill('#regBox', '時間戳記\t來源代碼\n2026/11/8 上午 9:00:00\tflyer\n2026/11/8 上午 9:30:00\tflyer')
        await pg.click('[data-act="pasteRegOk"]'); await pg.wait_for_timeout(300)
        ok('可以匯入 2 筆' in await pg.inner_text('#impBox'), '貼上表格')
        await pg.click('[data-act="cancelImp"]')

        # 列印、切換班別、⚙
        await pg.click('[data-step="report"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("window.print=()=>{}")
        await pg.click('[data-act="printRep"]'); await pg.wait_for_timeout(300)
        ok('招生成效報告' in await pg.inner_text('#printArea'), '列印報告內容')
        await pg.emulate_media(media='print'); await pg.pdf(path=os.path.join(OUT, 'report.pdf'), format='A4', print_background=True); await pg.emulate_media(media='screen')
        await pg.select_option('#campSel', index=1); await pg.wait_for_timeout(300)
        ok('AI 工具入門' in await pg.evaluate('window._et.C.name'), '切換回範例班別')
        await pg.click('[data-act="settings"]')
        s = await pg.inner_text('#modalBox')
        ok(all(k in s for k in ['顯示', '備份與還原', '範例', '清除全部資料', '關於本工具']), '⚙ 收合區塊齊全')
        ok(await pg.evaluate("document.querySelectorAll('.set-sec[open]').length") == 0, '⚙ 預設收合')
        await pg.click('[data-sec="bak"] > summary')
        async with pg.expect_download() as d: await pg.click('[data-act="backup"]')
        bk = open(await (await d.value).path(), encoding='utf-8').read()
        ok('example.com' not in bk and '測試甲' not in bk and '"camps"' in bk, '備份不含個資')
        await pg.click('#modalBox [data-act="close"]')
        await pg.click('.foot2'); await pg.wait_for_timeout(150)
        ok(not await pg.is_visible('#modal.show'), '點空白處不會開設定')

        # 手機
        await pg.set_viewport_size({'width': 375, 'height': 812}); await pg.wait_for_timeout(300)
        ok(await pg.evaluate('document.documentElement.scrollWidth') <= 375, '375px 分析頁無橫向捲動')
        await pg.click('[data-step="setup"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate('document.documentElement.scrollWidth') <= 375, '375px 設定頁無橫向捲動')
        await pg.screenshot(path=os.path.join(OUT, 'mobile_setup.png'), full_page=True)
        ok(not errs, '無 console 錯誤 ' + '; '.join(errs[:3]))
        await b.close()
    print(f'\n{sum(R)}/{len(R)} 通過，輸出在 {OUT}')
    sys.exit(0 if all(R) else 1)

asyncio.run(main())

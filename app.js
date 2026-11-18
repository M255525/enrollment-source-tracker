/* 招生成效追蹤：畫面
   localStorage（et. 前綴）：camps（[{id, c}]，c 是一個招生班別：設定、管道、已匯入的報名列——只有時間／來源／得知管道／狀態／去重雜湊）、cur、step、fs、fold、warnSeen、marquee。
   匯入時讀到的原始名單（含姓名電話）只放在記憶體 IMP，匯入完就丟掉。 */
(function(){
'use strict';
var E = window.ET, IO = window.ETIO;
var PFX = 'et.';
var $ = function(id){ return document.getElementById(id); };
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
var TODAY = null; // 測試用
function today(){ return TODAY == null ? Date.now() : TODAY; }

/* ---------- 狀態 ---------- */
var firstRun = !lsGet('camps');
var CAMPS = lsJson('camps', []).filter(function(x){ return x && x.id; }).map(function(x){ return {id:x.id, c:E.normalize(x.c)}; });
var CUR = lsGet('cur');
var STEP = lsGet('step') || 'setup';
var IMP = null;
function camp(){ var x = CAMPS.filter(function(y){ return y.id === CUR; })[0]; return x ? x.c : null; }
function S(){ return camp(); }
function save(){ if(!lsSet('camps', JSON.stringify(CAMPS))) toast('瀏覽器空間不足，這次的變更沒有存到'); lsSet('cur', CUR || ''); }
function newId(){ return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
function addCamp(c){ var id = newId(); CAMPS.unshift({id:id, c:E.normalize(c)}); CUR = id; save(); }

var toastT;
function toast(s){ var t = document.querySelector('.toast'); if(!t){ t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = s; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function(){ t.hidden = true; }, 2800); }
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); }
function closeModal(){ $('modal').classList.remove('show'); }
function download(blob, name){ var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function safeName(s){ return String(s || '招生').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30) || '招生'; }
function copyText(t, msg){
  function fb(){ var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); }
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(fb); else fb();
  toast(msg || '已複製');
}
function md(d){ return d ? d.slice(5).replace('-', '/') : ''; }

/* ---------- QR ---------- */
var qrLib = null;
function loadQRLib(){
  if(window.QRCode) return Promise.resolve();
  if(!qrLib) qrLib = new Promise(function(ok, no){ var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = ok; s.onerror = function(){ qrLib = null; no(new Error('QR 元件載入失敗（需要網路）')); }; document.head.appendChild(s); });
  return qrLib;
}
async function qrCard(text, label, sub){
  await loadQRLib();
  var box = $('qrTmp'); box.innerHTML = '';
  new window.QRCode(box, {text:text, width:600, height:600, colorDark:'#000000', colorLight:'#FFFFFF', correctLevel:window.QRCode.CorrectLevel.M});
  var q = box.querySelector('canvas'), cv = document.createElement('canvas'); cv.width = 680; cv.height = 800;
  var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 680, 800); x.imageSmoothingEnabled = false; x.drawImage(q, 40, 40, 600, 600);
  x.fillStyle = '#0B0B0B'; x.textAlign = 'center'; x.font = '900 40px "Noto Sans TC","Microsoft JhengHei",sans-serif'; x.fillText(label || '', 340, 712);
  x.fillStyle = '#52514E'; x.font = '500 26px "Noto Sans TC","Microsoft JhengHei",sans-serif'; x.fillText(sub || '', 340, 760);
  return cv;
}

/* ---------- 外框 ---------- */
var STEPS = [['setup', '1', '設定與專屬連結'], ['import', '2', '匯入報名資料'], ['report', '3', '成效分析']];
function render(){
  var c = S();
  var h = '<div class="top"><h1><span class="logo" aria-hidden="true"><i></i><i></i><i></i></span><span>招生成效追蹤 <small>每個管道一條專屬連結・匯入報名名單・看哪裡最有效</small></span></h1>' +
    '<a class="ibtn" href="manual.html">📖 操作手冊</a><button class="ibtn" type="button" data-act="settings" aria-label="常用設定">⚙</button></div>' +
    '<p class="warn-line">報名名單只取時間、來源與狀態，姓名電話不會存下來；資料只在這台瀏覽器。<button type="button" data-act="warn">⚠ 使用警語</button></p>' +
    '<div class="campbar"><label class="small" for="campSel"><b>招生班別</b></label><select id="campSel" data-camp>' + CAMPS.map(function(x){ return '<option value="' + x.id + '"' + (x.id === CUR ? ' selected' : '') + '>' + esc(x.c.name || '（未命名班別）') + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn sm" data-act="newCamp">＋ 新班別</button><button type="button" class="btn sm" data-act="dupCamp">複製這班的管道</button><button type="button" class="btn sm red" data-act="delCamp">刪除這班</button></div>' +
    '<div class="steps" role="tablist">' + STEPS.map(function(s){ return '<button type="button" class="step" role="tab" data-step="' + s[0] + '" aria-selected="' + (STEP === s[0]) + '"><b>' + s[1] + '</b>' + s[2] + '</button>'; }).join('') + '</div>' +
    '<div id="body"></div>' + footer();
  $('app').innerHTML = h;
  if(STEP === 'import') renderImport(); else if(STEP === 'report') renderReport(); else renderSetup();
}
function footer(){
  return '<footer class="foot2">👤 創作者 Mark Tsai（蔡豐全）<a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a><br><a href="manual.html">📖 操作手冊</a><a href="manual.html#creator">👤 創作者資訊</a><a href="#" data-act="warn">⚠ 使用警語</a>' +
    (standalone ? '' : '<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.enrollmentsourcetracker" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
}

/* ---------- ① 設定與專屬連結 ---------- */
function detectHtml(c){
  if(c.mode !== 'gform') return '';
  if(!c.url.trim()) return '<span class="detect bad">還沒貼上預先填入的連結</span>';
  var d = E.detectPrefill(c.url);
  if(c.param) return '<span class="detect ok">✔ 來源題參數：' + esc(c.param) + '</span>';
  return d ? '<span class="detect ok">✔ 找到來源題參數：' + esc(d.param) + '</span>' : '<span class="detect bad">找不到填了 TEST 的那一題，請照左邊步驟重新取得連結</span>';
}
function chRow(ch, i, c){
  var url = E.link(c, ch);
  return '<tr data-ci="' + i + '"><td><input data-ch="n" value="' + esc(ch.n) + '" aria-label="管道名稱" style="min-width:9rem"></td><td><span class="code">' + esc(ch.code) + '</span></td>' +
    '<td><input class="w6" data-ch="cost" inputmode="numeric" value="' + esc(ch.cost) + '" placeholder="0" aria-label="花費"></td>' +
    '<td><input class="w5" data-ch="clicks" inputmode="numeric" value="' + esc(ch.clicks) + '" placeholder="選填" aria-label="點擊數"></td>' +
    '<td><input class="w8" type="date" data-ch="post" value="' + esc(ch.post) + '" aria-label="發布日期"></td>' +
    '<td style="white-space:nowrap"><button type="button" class="mini" data-copy="' + i + '" title="複製專屬連結" aria-label="複製「' + esc(ch.n) + '」專屬連結"' + (url ? '' : ' disabled') + '>📋</button> <button type="button" class="mini" data-qr="' + i + '" title="QR code" aria-label="「' + esc(ch.n) + '」QR code"' + (url ? '' : ' disabled') + '>▦</button> <button type="button" class="mini" data-delch="' + i + '" title="刪除" aria-label="刪除「' + esc(ch.n) + '」">✕</button></td></tr>';
}
function renderSetup(){
  var c = S();
  var used = {}; c.channels.forEach(function(x){ used[x.code] = 1; });
  var h = '<div class="grid">' +
    '<div class="card c12"><h2>這一期招生</h2><div class="row r4"><label class="fld">班別名稱<input data-c="name" value="' + esc(c.name) + '" placeholder="例：AI 工具入門 第 3 期"></label>' +
      '<label class="fld">目標人數<input data-c="target" inputmode="numeric" value="' + esc(c.target) + '" placeholder="30"></label>' +
      '<label class="fld">開始招生<input type="date" data-c="start" value="' + esc(c.start) + '"></label>' +
      '<label class="fld">報名截止<input type="date" data-c="deadline" value="' + esc(c.deadline) + '"></label></div></div>' +
    '<div class="card c4"><h2>報名網址</h2><div class="seg" role="group" aria-label="追蹤方式">' + [['gform', 'Google 表單'], ['src', '一般網址 ?src='], ['utm', 'UTM 參數']].map(function(m){ return '<button type="button" data-mode="' + m[0] + '" aria-pressed="' + (c.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      (c.mode === 'gform' ? '<div class="howto" style="margin-top:.6rem"><b>Google 表單這樣設定（只要一次）：</b><ol><li>報名表加一題<b>簡答</b>「來源代碼」（可以放在最後一題，標示「請勿修改」）。</li><li>表單右上角 <b>⋮</b> →「<b>取得預先填入的連結</b>」。</li><li>在「來源代碼」那題填 <b>TEST</b>，其他題空白 →「取得連結」→「複製連結」。</li><li>貼到下面。每個管道的連結會自動把 TEST 換成自己的代碼。</li></ol></div>' :
        c.mode === 'src' ? '<p class="small" style="margin:.6rem 0 0">報名網址後面會加上 <span class="code">?src=代碼</span>。適合自己的報名系統或官網：請請網站管理員把 src 存進報名資料，匯出時就會有「來源」欄。</p>' :
        '<p class="small" style="margin:.6rem 0 0">加上 <span class="code">utm_source</span>／<span class="code">utm_medium</span>／<span class="code">utm_campaign</span>，網站有裝 Google Analytics 就能在 GA 看到各管道流量；報名資料要有 utm_source 欄才能在這裡統計。</p>') +
      '<label class="fld" style="margin-top:.6rem">' + (c.mode === 'gform' ? '預先填入的連結' : '報名網址') + '<textarea data-c="url" rows="3" placeholder="https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&entry.123456=TEST">' + esc(c.url) + '</textarea></label>' +
      '<div style="margin-top:.4rem" id="detect">' + detectHtml(c) + '</div></div>' +
    '<div class="card c8"><h2>招生管道<span class="r">' + c.channels.length + ' 個</span></h2>' +
      '<div class="chips" style="margin-bottom:.6rem">' + E.PRESETS.map(function(p){ return '<button type="button" class="chip" data-preset="' + p.code + '"' + (used[p.code] ? ' disabled' : '') + '>＋ ' + esc(p.n) + '</button>'; }).join('') + '<button type="button" class="chip" data-act="customCh">＋ 自訂管道</button></div>' +
      (c.channels.length ? '<div class="tw"><table class="t"><thead><tr><th>管道</th><th>代碼</th><th>花費（元）</th><th>點擊數</th><th>發布日</th><th></th></tr></thead><tbody id="chBody">' + c.channels.map(function(ch, i){ return chRow(ch, i, c); }).join('') + '</tbody></table></div>' +
        '<p class="small" style="margin-top:.4rem">點擊數請從各平台後台抄（FB 洞察報告「連結點擊」、LINE 官方帳號「訊息點擊」、Google 表單沒有點擊數可留空）。發布日用來看貼文發出後幾天內帶來多少報名。</p>' +
        '<div class="stack" style="margin-top:.6rem"><button type="button" class="btn pri" data-act="copyAll">📋 複製全部連結</button><button type="button" class="btn" data-act="zipQr">📦 下載全部 QR（ZIP）</button><button type="button" class="btn" data-act="printQr">🖨 列印 QR 一覽</button></div>'
      : '<div class="empty">點上面的管道加入，例如「FB 粉絲專頁」「LINE 官方帳號」「實體傳單」。</div>') + '</div>' +
    '</div>';
  $('body').innerHTML = h;
}

/* ---------- ② 匯入 ---------- */
var COLNAMES = [['t', '報名時間 *'], ['src', '來源代碼（專屬連結帶入）'], ['how', '從哪裡得知（學員自填）'], ['st', '狀態（錄取／繳費／到課）'], ['key', '去重用（Email 或電話）']];
function renderImport(){
  var c = S();
  var h = '<div class="grid"><div class="card c5"><h2>讀取報名名單</h2>' +
    '<p class="small">Google 表單：回覆 →「在試算表中查看」→ 檔案 → 下載 → <b>CSV</b> 或 <b>xlsx</b>。其他報名系統匯出的 CSV／xlsx 也可以。</p>' +
    '<div class="stack" style="margin:.6rem 0"><label class="btn pri" style="cursor:pointer">📂 選擇檔案（CSV／xlsx）<input type="file" accept=".csv,.tsv,.txt,.xlsx" data-file="reg" hidden></label><button type="button" class="btn" data-act="pasteReg">📋 貼上表格</button></div>' +
    '<div class="howto"><b>🔒 個資處理</b>：檔案只在你的瀏覽器裡讀，<b>不會上傳</b>。匯入後只保留「報名時間、來源代碼、從哪裡得知、狀態」，以及 Email／電話換算的一串雜湊碼（用來去掉重複報名，看不出原本是誰），姓名、電話、Email 都不會存下來。</div>' +
    '<p class="small" style="margin-top:.6rem">目前這班已有 <b>' + c.rows.length + '</b> 筆報名' + (c.imported ? '（' + esc(c.imported) + '）' : '') + '。' + (c.rows.length ? ' <button type="button" class="btn sm red" data-act="clearRows">清除報名資料</button>' : '') + '</p></div>' +
    '<div class="card c7" id="impBox">' + (IMP ? impHtml() : '<h2>欄位對應</h2><div class="empty">讀入檔案後，會在這裡自動找出「時間、來源、得知管道、狀態」各是哪一欄，你可以再改。</div>') + '</div></div>';
  $('body').innerHTML = h;
}
function impHtml(){
  var head = IMP.head, cols = IMP.cols, sample = IMP.body.slice(0, 5);
  var opts = function(k){ return '<option value="-1">（沒有）</option>' + head.map(function(hh, i){ return '<option value="' + i + '"' + (cols[k] === i ? ' selected' : '') + '>' + esc(hh || '第 ' + (i + 1) + ' 欄') + '</option>'; }).join(''); };
  var r = E.importRows(IMP.body, cols, {existing:IMP.mode === 'merge' ? S().rows : []});
  return '<h2>欄位對應<span class="r">' + esc(IMP.name) + '・' + IMP.body.length + ' 列</span></h2><div class="row r2">' + COLNAMES.map(function(x){ return '<label class="fld">' + x[1] + '<select data-col="' + x[0] + '">' + opts(x[0]) + '</select></label>'; }).join('') +
    '<label class="fld">匯入方式<select data-impmode><option value="merge"' + (IMP.mode === 'merge' ? ' selected' : '') + '>合併到現有資料（去掉重複）</option><option value="replace"' + (IMP.mode === 'replace' ? ' selected' : '') + '>取代現有資料</option></select></label></div>' +
    '<div class="tw pv" style="margin-top:.6rem"><table class="t"><thead><tr><th>報名時間</th><th>來源代碼</th><th>得知管道</th><th>狀態</th><th>去重</th></tr></thead><tbody>' +
      sample.map(function(row){ var t = E.parseTime(row[cols.t]); return '<tr><td>' + (t == null ? '<span style="color:var(--bad)">讀不懂：' + esc(row[cols.t]) + '</span>' : esc(E.ymd(t) + ' ' + new Date(t).toTimeString().slice(0, 5))) + '</td><td>' + esc(cols.src >= 0 ? row[cols.src] : '') + '</td><td>' + esc(cols.how >= 0 ? row[cols.how] : '') + '</td><td>' + (cols.st >= 0 ? E.ST[E.statusOf(row[cols.st])] : '報名') + '</td><td>' + (cols.key >= 0 && String(row[cols.key] || '').trim() ? '●●●' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="small" style="margin-top:.4rem">可以匯入 <b>' + r.rows.length + '</b> 筆' + (r.dup ? '，重複 ' + r.dup + ' 筆會合併' : '') + (r.skipped ? '，<span style="color:var(--bad)">' + r.skipped + ' 列讀不到時間會略過</span>' : '') + '。</p>' +
    '<div class="stack" style="margin-top:.5rem"><button type="button" class="btn pri" data-act="doImport"' + (cols.t < 0 || !r.rows.length ? ' disabled' : '') + '>✔ 匯入並看分析</button><button type="button" class="btn" data-act="cancelImp">取消</button></div>';
}
function loadTable(table, name){
  if(!table || table.length < 2){ toast('檔案裡沒有資料列'); return; }
  var head = table[0].map(function(x){ return String(x == null ? '' : x).trim(); }), body = table.slice(1);
  IMP = {name:name, head:head, body:body, cols:E.guessCols(head), mode:S().rows.length ? 'merge' : 'replace'};
  // 來源欄沒抓到時，找值剛好是管道代碼的欄
  if(IMP.cols.src < 0){ var codes = {}; S().channels.forEach(function(x){ codes[x.code] = 1; }); head.forEach(function(_, i){ if(IMP.cols.src < 0 && i !== IMP.cols.t && body.some(function(r){ return codes[String(r[i] || '').trim().toLowerCase()]; })) IMP.cols.src = i; }); }
  STEP = 'import'; lsSet('step', STEP); render();
}

/* ---------- ③ 分析：圖表 ---------- */
function roundEnd(x, y, w, h, r){ r = Math.min(r, h / 2, w); return 'M' + x + ',' + y + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 -' + r + ',' + r + 'h-' + (w - r) + 'z'; }
function niceMax(v){ if(v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p, steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; for(var i = 0; i < steps.length; i++) if(n <= steps[i] + 1e-9) return steps[i] * p; return 10 * p; }
function divs(max){ var c = [4, 5, 3, 6, 2]; for(var i = 0; i < c.length; i++) if(Math.abs(max / c[i] - Math.round(max / c[i])) < 1e-9) return c[i]; return 4; } // 刻度要整數
function hbar(items, unit){
  if(!items.length) return '<div class="empty">沒有資料</div>';
  var W = 640, L = 168, R = 70, rowH = 30, H = items.length * rowH + 26, max = niceMax(Math.max.apply(null, items.map(function(x){ return x.v; })) || 1), sx = (W - L - R) / max;
  var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(items.map(function(x){ return x.l + ' ' + x.v + unit; }).join('、')) + '"><g class="grid">';
  var nd = divs(max); for(var k = 0; k <= nd; k++){ var gx = L + max / nd * k * sx; g += '<line x1="' + gx + '" x2="' + gx + '" y1="0" y2="' + (H - 22) + '"/><text x="' + gx + '" y="' + (H - 6) + '" text-anchor="middle">' + E.fmt(max / nd * k) + '</text>'; }
  g += '</g>';
  items.forEach(function(x, i){
    var y = i * rowH + 6, w = Math.max(x.v ? 2 : 0, x.v * sx);
    g += '<g data-tip="' + esc(x.tip) + '"><rect class="hit" x="0" y="' + (y - 4) + '" width="' + W + '" height="' + rowH + '"/><text class="lbl" x="' + (L - 8) + '" y="' + (y + 14) + '" text-anchor="end">' + esc(x.l.length > 12 ? x.l.slice(0, 11) + '…' : x.l) + '</text>' +
      (w ? '<path class="bar' + (x.dim ? ' dim' : '') + '" d="' + roundEnd(L, y, w, 20, 4) + '"/>' : '') + '<text class="lbl num" x="' + (L + w + 6) + '" y="' + (y + 14) + '">' + esc(x.vl != null ? x.vl : E.fmt(x.v)) + '</text></g>';
  });
  return g + '<line class="axis" x1="' + L + '" x2="' + L + '" y1="0" y2="' + (H - 22) + '"/></svg>';
}
var LINE = null;
function lineChart(a, c){
  var days = a.days; if(days.length < 2) return '<div class="empty">報名資料累積兩天以上才會畫趨勢</div>';
  var target = E.num(c.target), dl = E.parseYmd(c.deadline), t0 = days[0].t, t1 = Math.max(days[days.length - 1].t, dl || 0);
  var W = 640, H = 260, L = 40, R = 16, T = 12, B = 30, maxY = niceMax(Math.max(target, days[days.length - 1].acc) * 1.05 || 1);
  var X = function(t){ return L + (t - t0) / Math.max(1, t1 - t0) * (W - L - R); }, Y = function(v){ return T + (1 - v / maxY) * (H - T - B); };
  var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="累積報名人數，目前 ' + days[days.length - 1].acc + ' 人' + (target ? '，目標 ' + target + ' 人' : '') + '"><g class="grid">';
  var nd = divs(maxY); for(var k = 0; k <= nd; k++){ var v = maxY / nd * k; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + E.fmt(v) + '</text>'; }
  g += '</g>';
  var n = Math.round((t1 - t0) / E.DAY), step = Math.max(1, Math.ceil(n / 6));
  for(var d = 0; d <= n; d += step){ var tt = t0 + d * E.DAY; g += '<text x="' + X(tt) + '" y="' + (H - 10) + '" text-anchor="middle">' + md(E.ymd(tt)) + '</text>'; }
  if(target && dl != null) g += '<line x1="' + X(t0) + '" y1="' + Y(0) + '" x2="' + X(dl) + '" y2="' + Y(target) + '" stroke="var(--s2)" stroke-width="2" stroke-dasharray="6 5"/><text x="' + (X(dl) - 4) + '" y="' + (Y(target) - 6) + '" text-anchor="end" class="lbl">目標 ' + target + '</text>';
  g += '<polyline fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" points="' + days.map(function(x){ return X(x.t).toFixed(1) + ',' + Y(x.acc).toFixed(1); }).join(' ') + '"/>';
  var last = days[days.length - 1];
  g += '<circle cx="' + X(last.t) + '" cy="' + Y(last.acc) + '" r="4.5" fill="var(--s1)" stroke="#fff" stroke-width="2"/><text class="lbl" x="' + (X(last.t) + 8) + '" y="' + (Y(last.acc) - 8) + '">' + last.acc + ' 人</text>';
  days.forEach(function(x){ if(x.posts.length){ var px = X(x.t); g += '<path d="M' + (px - 5) + ',' + (H - B + 1) + 'l5,-8l5,8z" fill="var(--ink)"/>'; } });
  g += '<g id="xh" style="display:none"><line id="xhl" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink2)" stroke-width="1"/><circle id="xhc" r="5" fill="var(--s1)" stroke="#fff" stroke-width="2"/></g>';
  g += '<rect data-line="1" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + (H - B) + '" fill="transparent"/>';
  LINE = {days:days, X:X, Y:Y, W:W, L:L, R:R, target:target, t0:t0, dl:dl};
  return g + '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/></svg>' +
    '<div class="legend"><span><i style="background:var(--s1)"></i>實際累積報名</span>' + (target && dl != null ? '<span><i style="background:repeating-linear-gradient(90deg,var(--s2) 0 6px,transparent 6px 10px)"></i>照進度應達人數</span>' : '') + '<span>▲ 管道發布日</span></div>';
}
function fbar(b){
  var tot = b.reg || 1, seg = [[b.att, '#0E4A8F', '到課'], [b.paid - b.att, '#2A78D6', '繳費'], [b.adm - b.paid, '#7FB0EA', '錄取'], [b.reg - b.adm, '#C9DDF5', '只報名']];
  return '<div class="fb" data-tip="' + esc(b.n + '\n報名 ' + b.reg + '・錄取 ' + b.adm + '・繳費 ' + b.paid + '・到課 ' + b.att + (b.cancel ? '・取消 ' + b.cancel : '')) + '">' + seg.filter(function(s){ return s[0] > 0; }).map(function(s){ return '<i style="width:' + (s[0] / tot * 100) + '%;background:' + s[1] + '"></i>'; }).join('') + '</div>';
}
var ICON = {ok:'✓', warn:'!', bad:'✕', tip:'i'};
function reportHtml(c, a, printMode){
  var tot = a.tot, fc = a.fc, target = E.num(c.target);
  var kp = '<div class="kpis">' +
    '<div class="kpi"><div class="l">報名人數</div><div class="v">' + tot.reg + '<small>人</small></div><div class="s">' + (tot.cancel ? '另有取消 ' + tot.cancel + ' 人' : '不含取消') + '</div></div>' +
    '<div class="kpi"><div class="l">目標達成</div><div class="v">' + (target ? Math.round(tot.reg / target * 100) + '<small>%</small>' : '—') + '</div>' + (target ? '<div class="meter"><i style="width:' + Math.min(100, tot.reg / target * 100) + '%"></i></div><div class="s">目標 ' + target + ' 人' + (fc && !fc.closed ? '・剩 ' + fc.left + ' 天' : '') + '</div>' : '<div class="s">在 ① 填目標人數</div>') + '</div>' +
    '<div class="kpi"><div class="l">每位報名成本</div><div class="v">' + (tot.cost && tot.reg ? E.fmt(tot.cost / tot.reg) + '<small>元</small>' : '—') + '</div><div class="s">總花費 ' + E.fmt(tot.cost) + ' 元</div></div>' +
    '<div class="kpi"><div class="l">知道來源的報名</div><div class="v">' + (tot.reg ? Math.round((tot.reg - tot.unknown) / tot.reg * 100) + '<small>%</small>' : '—') + '</div><div class="s">專屬連結 ' + tot.link + '・自填 ' + tot.self + '・未知 ' + tot.unknown + '</div></div></div>';
  var named = a.list.filter(function(b){ return b.reg || b.code !== 'other'; });
  var regItems = named.slice().sort(function(x, y){ return y.reg - x.reg; }).map(function(b){ return {l:b.n, v:b.reg, dim:b.code === 'unknown' || b.code === 'other', tip:b.n + '\n報名 ' + b.reg + ' 人（' + (E.pct(b.reg, tot.reg) || 0) + '%）\n專屬連結 ' + b.link + '・自填 ' + b.self + (b.rate != null ? '\n報名率 ' + b.rate + '%（點擊 ' + E.fmt(b.clicks) + '）' : '')}; });
  var costItems = a.list.filter(function(b){ return b.cpr != null; }).sort(function(x, y){ return x.cpr - y.cpr; }).map(function(b){ return {l:b.n, v:b.cpr, vl:E.fmt(b.cpr) + ' 元', tip:b.n + '\n花費 ' + E.fmt(b.cost) + ' 元 ÷ 報名 ' + b.reg + ' 人\n＝每位 ' + E.fmt(b.cpr) + ' 元' + (b.cpa != null ? '\n每位到課 ' + E.fmt(b.cpa) + ' 元' : '')}; });
  var tbl = '<div class="tw"><table class="t funnel"><thead><tr><th>管道</th><th class="n">花費</th><th class="n">點擊</th><th class="n">報名</th><th class="n">報名率</th>' + (a.hasStatus ? '<th class="n">錄取</th><th class="n">繳費</th><th class="n">到課</th><th class="n">取消</th>' : '') + '<th class="n">每位報名成本</th>' + (a.hasStatus ? '<th>報名後的狀態</th>' : '') + '</tr></thead><tbody>' +
    a.list.map(function(b){ return '<tr><td>' + esc(b.n) + '</td><td class="n">' + (b.cost ? E.fmt(b.cost) : '—') + '</td><td class="n">' + (b.hasClicks ? E.fmt(b.clicks) : '—') + '</td><td class="n"><b>' + b.reg + '</b></td><td class="n">' + (b.rate == null ? '—' : b.rate + '%') + '</td>' +
      (a.hasStatus ? '<td class="n">' + b.adm + '</td><td class="n">' + b.paid + '</td><td class="n">' + b.att + '</td><td class="n">' + b.cancel + '</td>' : '') + '<td class="n">' + (b.cpr == null ? '—' : E.fmt(b.cpr) + ' 元') + '</td>' + (a.hasStatus ? '<td class="bar">' + fbar(b) + '</td>' : '') + '</tr>'; }).join('') +
    '</tbody><tfoot><tr><td>合計</td><td class="n">' + (tot.cost ? E.fmt(tot.cost) : '—') + '</td><td class="n">' + (tot.clicks ? E.fmt(tot.clicks) : '—') + '</td><td class="n">' + tot.reg + '</td><td class="n"></td>' + (a.hasStatus ? '<td class="n">' + tot.adm + '</td><td class="n">' + tot.paid + '</td><td class="n">' + tot.att + '</td><td class="n">' + tot.cancel + '</td>' : '') + '<td class="n">' + (tot.cost && tot.reg ? E.fmt(tot.cost / tot.reg) + ' 元' : '—') + '</td>' + (a.hasStatus ? '<td></td>' : '') + '</tr></tfoot></table></div>' +
    (a.hasStatus ? '<div class="legend">' + [['#0E4A8F', '到課'], ['#2A78D6', '繳費'], ['#7FB0EA', '錄取'], ['#C9DDF5', '只報名']].map(function(x){ return '<span><i style="background:' + x[0] + ';height:10px;width:10px"></i>' + x[1] + '</span>'; }).join('') + '</div>' : '');
  return (printMode ? '<h1>' + esc(c.name || '招生') + ' 招生成效報告</h1><p class="small">' + esc(E.ymd(today())) + ' 產出・' + esc(c.imported || '') + '</p>' : '') +
    '<div class="grid"><div class="c12">' + kp + '</div>' +
    '<div class="card c5"><h2>重點與建議</h2><ul class="ins">' + a.insights.map(function(x){ return '<li class="' + x.lv + '"><span class="ic" aria-hidden="true">' + ICON[x.lv] + '</span><span>' + esc(x.t) + '</span></li>'; }).join('') + '</ul></div>' +
    '<div class="card c7"><h2>累積報名' + (fc ? '<span class="r">預估截止時 ' + fc.proj + ' 人</span>' : '') + '</h2>' + lineChart(a, c) + '</div>' +
    '<div class="card c6"><h2>各管道報名人數</h2>' + hbar(regItems, ' 人') + '</div>' +
    '<div class="card c6"><h2>每位報名成本<span class="r">只列有填花費的管道</span></h2>' + (costItems.length ? hbar(costItems, ' 元') : '<div class="empty">在 ① 填各管道的花費（廣告費、印刷費），就能比較哪個管道最划算。</div>') + '</div>' +
    '<div class="card c12"><h2>管道明細</h2>' + tbl + '</div></div>';
}
function renderReport(){
  var c = S(), a = E.analyze(c, today());
  $('body').innerHTML = reportHtml(c, a) + '<div class="stack" style="margin-top:.8rem"><button type="button" class="btn pri" data-act="printRep">🖨 列印報告</button><button type="button" class="btn" data-act="csv">⬇ 下載 CSV</button><button type="button" class="btn" data-act="copySum">📋 複製摘要</button></div>';
}
function summaryText(){
  var c = S(), a = E.analyze(c, today());
  return (c.name || '招生') + ' 招生成效（' + E.ymd(today()) + '）\n報名 ' + a.tot.reg + ' 人' + (E.num(c.target) ? '／目標 ' + E.num(c.target) + ' 人' : '') + (a.tot.cost ? '，總花費 ' + E.fmt(a.tot.cost) + ' 元' : '') + '\n\n' +
    a.list.filter(function(b){ return b.reg; }).sort(function(x, y){ return y.reg - x.reg; }).map(function(b){ return '・' + b.n + '：' + b.reg + ' 人' + (b.cpr != null ? '（每位 ' + E.fmt(b.cpr) + ' 元）' : ''); }).join('\n') +
    '\n\n' + a.insights.map(function(x){ return '- ' + x.t; }).join('\n');
}

/* ---------- 提示框 ---------- */
document.addEventListener('mousemove', function(e){
  var tip = $('tip'), ln = e.target.closest && e.target.closest('[data-line]');
  if(ln && LINE){
    var svg = ln.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    var best = LINE.days[0], bd = 1e9; LINE.days.forEach(function(x){ var dx = Math.abs(LINE.X(x.t) - p.x); if(dx < bd){ bd = dx; best = x; } });
    var xh = svg.querySelector('#xh'); xh.style.display = ''; var X = LINE.X(best.t), Y = LINE.Y(best.acc);
    svg.querySelector('#xhl').setAttribute('x1', X); svg.querySelector('#xhl').setAttribute('x2', X); svg.querySelector('#xhc').setAttribute('cx', X); svg.querySelector('#xhc').setAttribute('cy', Y);
    var should = LINE.target && LINE.dl != null ? Math.round(LINE.target * Math.min(1, (best.t - LINE.t0) / Math.max(1, LINE.dl - LINE.t0))) : null;
    showTip(e, '<b>' + md(best.d) + '</b>當天 ' + best.n + ' 人・累積 ' + best.acc + ' 人' + (should != null ? '<br>照進度應有 ' + should + ' 人' : '') + (best.posts.length ? '<br>▲ 發布：' + esc(best.posts.join('、')) : ''));
    return;
  }
  document.querySelectorAll('#xh').forEach(function(x){ x.style.display = 'none'; });
  var el = e.target.closest && e.target.closest('[data-tip]');
  document.querySelectorAll('.chart g.hov').forEach(function(g){ if(g !== el) g.classList.remove('hov'); });
  if(!el){ tip.style.display = 'none'; return; }
  if(el.tagName === 'g') el.classList.add('hov');
  var lines = el.getAttribute('data-tip').split('\n');
  showTip(e, '<b>' + esc(lines[0]) + '</b>' + lines.slice(1).map(esc).join('<br>'));
});
function showTip(e, html){ var tip = $('tip'); tip.innerHTML = html; tip.style.display = 'block'; var w = tip.offsetWidth, h = tip.offsetHeight, x = e.clientX + 14, y = e.clientY + 14; if(x + w > innerWidth - 8) x = e.clientX - w - 14; if(y + h > innerHeight - 8) y = e.clientY - h - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
document.addEventListener('scroll', function(){ $('tip').style.display = 'none'; }, true);

/* ---------- 設定與動作 ---------- */
var WARN_HTML = '<h2>⚠ 使用警語</h2><ul>' +
  '<li>報名名單含個人資料。檔案只在這台瀏覽器裡讀取、<b>不會上傳</b>；匯入後只保留報名時間、來源、得知管道、狀態，以及無法還原的去重雜湊碼。<b>原始名單請依個資法妥善保管</b>，用完的下載檔記得刪除。</li>' +
  '<li>來源代碼是放在連結裡的，學員轉傳連結時會沿用原本的代碼，所以統計是「從哪個連結報名」，不一定是真正最早看到的管道；學員自填的得知管道也可能不準。數字請當作趨勢參考。</li>' +
  '<li>點擊數、花費要自己從各平台後台與帳單抄進來；預估能不能額滿只依最近 7 天的報名速度推算，不代表實際結果。</li>' +
  '<li>Google 表單的「來源代碼」題，學員看得到也改得到，請標示「請勿修改」。</li>' +
  '<li>範例資料全部虛構。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="stack"><button type="button" class="btn pri" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function openSettings(){
  var xl = lsGet('fs') === 'xl';
  var h = '<div class="top"><h2 style="flex:1 1 0">⚙ 常用設定</h2><button type="button" class="btn sm" data-act="foldall">全部展開／收合</button></div>' +
    sec('view', '顯示', xl ? '大字' : '標準字', '<div class="stack"><button type="button" class="btn sm' + (xl ? '' : ' pri') + '" data-setfs="m">標準字</button><button type="button" class="btn sm' + (xl ? ' pri' : '') + '" data-setfs="xl">大字</button></div>') +
    sec('bak', '💾 備份與還原', CAMPS.length + ' 個班別', '<p class="small">備份檔包含所有班別的設定、管道與已匯入的報名列（不含姓名電話）。</p><div class="stack"><button type="button" class="btn" data-act="backup">⬇ 下載備份</button><label class="btn" style="cursor:pointer">⬆ 讀取備份<input type="file" accept=".json,application/json" data-file="backup" hidden></label></div>') +
    sec('ex', '📘 範例', '', '<p class="small">載入一個虛構的招生班別（8 個管道、40 多筆報名），看看分析長什麼樣子。</p><div class="stack"><button type="button" class="btn" data-act="loadSample">載入範例班別</button></div>') +
    sec('wipe', '🧹 清除全部資料', '', '<p class="small">刪除所有班別、管道與報名資料。</p><div class="stack"><button type="button" class="btn red" data-act="wipeAll">清除全部資料</button></div>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a></p><div class="stack"><a class="btn" href="manual.html">📖 操作手冊</a><a class="btn" href="manual.html#creator">👤 創作者資訊</a><button type="button" class="btn" data-act="warn">⚠ 使用警語</button>' +
      (standalone ? '' : '<button type="button" class="btn" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.enrollmentsourcetracker" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="stack"><button type="button" class="btn pri" data-act="close">關閉</button></div>';
  openModal(h);
  var open = lsJson('fold', []);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function applyView(){ document.documentElement.dataset.fs = lsGet('fs') === 'xl' ? 'xl' : 'm'; }
function install(){
  if(window._dp){ window._dp.prompt(); window._dp = null; return; }
  openModal('<h2>📲 加入主畫面</h2><ul><li><b>電腦（Chrome／Edge）</b>：網址列右邊的安裝圖示。</li><li><b>iPhone／iPad（Safari）</b>：「分享」→「加入主畫面」。</li><li><b>Android（Chrome）</b>：右上角「⋮」→「安裝應用程式」。</li></ul><div class="stack"><button type="button" class="btn pri" data-act="close">知道了</button></div>');
}
function confirmBox(title, body, act, label){ openModal('<h2>' + title + '</h2><p>' + body + '</p><div class="stack"><button type="button" class="btn red" data-act="' + act + '">' + (label || '確定') + '</button><button type="button" class="btn" data-act="close">取消</button></div>'); }
async function allQr(){
  var c = S(), out = [];
  for(var i = 0; i < c.channels.length; i++){ var ch = c.channels[i], u = E.link(c, ch); if(!u) continue; var cv = await qrCard(u, ch.n, c.name); out.push({ch:ch, url:u, cv:cv}); }
  return out;
}

var ACT = {
  close:closeModal, warn:showWarn, settings:openSettings, install:install,
  foldall:function(){ var ds = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(ds, function(d){ return !d.open; }); ds.forEach(function(d){ d.open = any; }); saveFold(); },
  newCamp:function(){ var b = E.blank(); b.name = '新的招生班別'; ['fbpage', 'lineoa', 'web', 'friend'].forEach(function(k){ E.addPreset(b, k); }); addCamp(b); STEP = 'setup'; lsSet('step', STEP); render(); toast('已新增班別，先填名稱與報名網址'); },
  dupCamp:function(){ var c = S(), b = E.blank(); b.name = (c.name || '班別') + '（下一期）'; b.url = c.url; b.mode = c.mode; b.param = c.param; b.target = c.target; b.channels = c.channels.map(function(x){ return {code:x.code, n:x.n, cost:'', clicks:'', post:''}; }); addCamp(b); STEP = 'setup'; lsSet('step', STEP); render(); toast('已複製管道到新班別，花費與點擊已清空'); },
  delCamp:function(){ confirmBox('刪除「' + esc(S().name || '這個班別') + '」？', '這個班別的設定、管道與報名資料都會刪掉。', 'delCampOk', '刪除'); },
  delCampOk:function(){ CAMPS = CAMPS.filter(function(x){ return x.id !== CUR; }); if(!CAMPS.length){ var b = E.blank(); b.name = '新的招生班別'; CAMPS.push({id:newId(), c:b}); } CUR = CAMPS[0].id; save(); closeModal(); render(); toast('已刪除'); },
  customCh:function(){ openModal('<h2>＋ 自訂管道</h2><label class="fld">管道名稱<input id="cName" maxlength="40" placeholder="例：里長廣播、廟口看板"></label><label class="fld">代碼（英文或數字，會出現在連結裡）<input id="cCode" maxlength="16" placeholder="例：temple"></label><div class="stack"><button type="button" class="btn pri" data-act="customOk">加入</button><button type="button" class="btn" data-act="close">取消</button></div>'); setTimeout(function(){ $('cName').focus(); }, 30); },
  customOk:function(){ var n = $('cName').value.trim(), code = E.slug($('cCode').value) || 'ch' + (S().channels.length + 1); if(!n){ toast('請填管道名稱'); return; } if(S().channels.some(function(x){ return x.code === code; })){ toast('代碼「' + code + '」已經用過'); return; } var ch = E.blankChannel(); ch.n = n; ch.code = code; S().channels.push(ch); save(); closeModal(); renderSetup(); },
  copyAll:function(){ var c = S(), t = c.channels.map(function(ch){ var u = E.link(c, ch); return u ? ch.n + '\n' + u : ''; }).filter(Boolean).join('\n\n'); if(!t){ toast('還沒有可以用的連結，請先設定報名網址'); return; } copyText(t, '已複製 ' + c.channels.length + ' 條專屬連結'); },
  zipQr:async function(){ try{ toast('產生 QR 中…'); var qs = await allQr(); if(!qs.length){ toast('還沒有可以用的連結'); return; } var files = []; for(var i = 0; i < qs.length; i++){ var b = await new Promise(function(ok){ qs[i].cv.toBlob(ok, 'image/png'); }); files.push({name:(i + 1) + '_' + safeName(qs[i].ch.n) + '.png', data:new Uint8Array(await b.arrayBuffer())}); } files.push({name:'連結清單.txt', data:qs.map(function(q){ return q.ch.n + '（' + q.ch.code + '）\r\n' + q.url; }).join('\r\n\r\n')}); download(IO.zipStore(files), safeName(S().name) + '_專屬連結QR.zip'); toast('已下載 ' + qs.length + ' 張 QR'); }catch(e){ toast(e.message); } },
  printQr:async function(){ try{ var qs = await allQr(); if(!qs.length){ toast('還沒有可以用的連結'); return; } $('printArea').innerHTML = '<h1>' + esc(S().name || '招生') + '　各管道專屬報名 QR</h1><div class="qrs">' + qs.map(function(q){ return '<div><img src="' + q.cv.toDataURL('image/png') + '" alt=""><br>' + esc(q.ch.n) + '</div>'; }).join('') + '</div>'; setTimeout(function(){ window.print(); }, 150); }catch(e){ toast(e.message); } },
  pasteReg:function(){ openModal('<h2>📋 貼上表格</h2><p class="small">從 Google 試算表或 Excel 選取整個表格（含第一列標題）複製，貼在下面。</p><textarea id="regBox"></textarea><div class="stack"><button type="button" class="btn pri" data-act="pasteRegOk">讀取</button><button type="button" class="btn" data-act="close">取消</button></div>'); },
  pasteRegOk:function(){ var t = $('regBox').value; closeModal(); loadTable(E.parseCSV(t), '貼上的表格'); },
  cancelImp:function(){ IMP = null; renderImport(); },
  doImport:function(){ if(!IMP) return; var c = S(), r = E.importRows(IMP.body, IMP.cols, {existing:IMP.mode === 'merge' ? c.rows : []}); c.rows = (IMP.mode === 'merge' ? c.rows.concat(r.rows) : r.rows).sort(function(a, b){ return a.t - b.t; }); c.imported = IMP.name + '，' + E.ymd(Date.now()) + ' 匯入'; IMP = null; save(); STEP = 'report'; lsSet('step', STEP); render(); toast('已匯入 ' + r.rows.length + ' 筆' + (r.dup ? '（合併重複 ' + r.dup + ' 筆）' : '') + '，原始名單沒有存下來'); },
  clearRows:function(){ confirmBox('清除這班的報名資料？', '管道設定會保留，只刪掉已匯入的 ' + S().rows.length + ' 筆報名。', 'clearRowsOk', '清除'); },
  clearRowsOk:function(){ S().rows = []; S().imported = ''; save(); closeModal(); renderImport(); },
  printRep:function(){ var c = S(); $('printArea').innerHTML = reportHtml(c, E.analyze(c, today()), true); setTimeout(function(){ window.print(); }, 120); },
  csv:function(){ var c = S(); download(new Blob(['﻿' + E.summaryCsv(c, E.analyze(c, today()))], {type:'text/csv;charset=utf-8'}), safeName(c.name) + '_招生成效.csv'); toast('已下載 CSV'); },
  copySum:function(){ copyText(summaryText(), '已複製摘要，可以貼到 LINE 或會議紀錄'); },
  backup:function(){ download(new Blob([JSON.stringify({app:'enrollment-source-tracker', v:1, camps:CAMPS}, null, 1)], {type:'application/json'}), '招生成效追蹤_備份.json'); toast('已下載備份'); },
  loadSample:function(){ addCamp(E.sample(today())); closeModal(); STEP = 'report'; lsSet('step', STEP); render(); toast('已載入範例班別（虛構）'); },
  wipeAll:function(){ confirmBox('清除全部資料？', '所有班別、管道與報名資料都會刪除，不能復原。', 'wipeOk', '全部清除'); },
  wipeOk:function(){ ['camps', 'cur', 'step', 'fold'].forEach(lsDel); var b = E.blank(); b.name = '新的招生班別'; CAMPS = [{id:newId(), c:b}]; CUR = CAMPS[0].id; STEP = 'setup'; IMP = null; save(); closeModal(); render(); toast('已清除'); }
};

document.addEventListener('click', function(e){
  var t = e.target.closest('[data-act],[data-step],[data-mode],[data-preset],[data-copy],[data-qr],[data-delch],[data-setfs]');
  if(!t || t.disabled) return;
  if(t.tagName === 'A' && t.getAttribute('href') === '#') e.preventDefault();
  var d = t.dataset, c = S();
  if(d.act && ACT[d.act]){ e.preventDefault(); ACT[d.act](); return; }
  if(d.step){ STEP = d.step; lsSet('step', STEP); render(); return; }
  if(d.mode){ c.mode = d.mode; save(); renderSetup(); return; }
  if(d.preset){ E.addPreset(c, d.preset); save(); renderSetup(); return; }
  if(d.copy){ var ch = c.channels[+d.copy], u = E.link(c, ch); if(u) copyText(u, '已複製「' + ch.n + '」的專屬連結'); return; }
  if(d.qr){ var q = c.channels[+d.qr], qu = E.link(c, q); if(!qu) return; qrCard(qu, q.n, c.name).then(function(cv){ var src = cv.toDataURL('image/png'); openModal('<h2>▦ ' + esc(q.n) + '</h2><div class="qrbig"><img src="' + src + '" alt="' + esc(q.n) + ' 的 QR code"><p class="small" style="word-break:break-all">' + esc(qu) + '</p></div><p class="small">適合印在傳單、海報上。印出來後請用手機實際掃一次，確認會開到報名表、而且來源代碼有帶進去。</p><div class="stack"><button type="button" class="btn pri" id="qrDl">⬇ 下載 PNG</button><button type="button" class="btn" data-copy="' + d.qr + '">📋 複製連結</button><button type="button" class="btn" data-act="close">關閉</button></div>'); $('qrDl').onclick = function(){ cv.toBlob(function(b){ download(b, safeName(q.n) + '_QR.png'); }); }; }).catch(function(err){ toast(err.message); }); return; }
  if(d.delch){ var k = +d.delch; if(!t.dataset.sure){ t.dataset.sure = '1'; t.textContent = '確定?'; t.style.borderColor = 'var(--bad)'; setTimeout(function(){ if(t.isConnected){ delete t.dataset.sure; t.textContent = '✕'; t.style.borderColor = ''; } }, 3000); return; } c.channels.splice(k, 1); save(); renderSetup(); return; }
  if(d.setfs){ lsSet('fs', d.setfs); applyView(); openSettings(); return; }
});
var dT;
document.addEventListener('input', function(e){
  var t = e.target, c = S();
  if(t.dataset.c){ var k = t.dataset.c; c[k] = t.value; if(k === 'url'){ c.param = ''; var dp = E.detectPrefill(c.url); if(dp) c.param = dp.param; } if(k === 'name'){ var o = document.querySelector('#campSel option[value="' + CUR + '"]'); if(o) o.textContent = t.value || '（未命名班別）'; } save(); clearTimeout(dT); dT = setTimeout(function(){ if(k === 'url' || k === 'name'){ var dd = $('detect'); if(dd) dd.innerHTML = detectHtml(c); var tb = $('chBody'); if(tb) tb.innerHTML = c.channels.map(function(ch, i){ return chRow(ch, i, c); }).join(''); } }, 250); return; }
  if(t.dataset.ch){ var tr = t.closest('tr'), ch = c.channels[+tr.dataset.ci]; ch[t.dataset.ch] = t.value; save(); return; }
});
document.addEventListener('change', function(e){
  var t = e.target;
  if(t.hasAttribute('data-camp')){ CUR = t.value; IMP = null; save(); render(); return; }
  if(t.dataset.col && IMP){ IMP.cols[t.dataset.col] = +t.value; $('impBox').innerHTML = impHtml(); return; }
  if(t.hasAttribute('data-impmode') && IMP){ IMP.mode = t.value; $('impBox').innerHTML = impHtml(); return; }
  if(t.dataset.file === 'reg' && t.files && t.files[0]){
    var f = t.files[0]; t.value = '';
    if(/\.xlsx$/i.test(f.name)) f.arrayBuffer().then(IO.readXlsx).then(function(tb){ loadTable(tb, f.name); }).catch(function(err){ toast('讀不懂：' + err.message); });
    else { var fr = new FileReader(); fr.onload = function(){ var txt = fr.result; if(/�/.test(txt.slice(0, 2000))){ var f2 = new FileReader(); f2.onload = function(){ loadTable(E.parseCSV(f2.result), f.name); }; f2.readAsText(f, 'big5'); return; } loadTable(E.parseCSV(txt), f.name); }; fr.readAsText(f, 'utf-8'); }
    return;
  }
  if(t.dataset.file === 'backup' && t.files && t.files[0]){
    var fb = new FileReader();
    fb.onload = function(){ try{ var j = JSON.parse(fb.result); if(!j || !Array.isArray(j.camps)) throw new Error('不是這個工具的備份檔'); var n = 0; j.camps.forEach(function(x){ if(x && x.c){ CAMPS.push({id:newId(), c:E.normalize(x.c)}); n++; } }); if(n) CUR = CAMPS[CAMPS.length - 1].id; save(); closeModal(); render(); toast('已讀入 ' + n + ' 個班別'); }catch(err){ toast('讀不懂：' + err.message); } };
    fb.readAsText(t.files[0]); t.value = '';
  }
});
$('modal').addEventListener('click', function(e){ if(e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && $('modal').classList.contains('show')) closeModal(); });
window.addEventListener('afterprint', function(){ $('printArea').innerHTML = ''; });

/* ---------- 跑馬燈（工作區共用公告，不可關） ---------- */
function initMarquee(){
  var URL_ = "https://script.google.com/macros/s/AKfycbwKX0DNNbY8y4nf90BFTHtxgfqJcHHcZasRrgycl4QAe52_hkjMWSkYk4xOsqU-JPCROw/exec";
  var REFRESH = 20 * 60 * 1000, bar = $('marqueeBar'), track = $('marqueeTrack'), lastKey = null;
  function appendText(c, text){ var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, li = 0, m; while((m = re.exec(text))){ if(m.index > li) c.appendChild(document.createTextNode(text.slice(li, m.index))); var a = document.createElement('a'); a.href = m[2]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'inherit'; a.style.textDecoration = 'underline'; c.appendChild(a); li = re.lastIndex; } if(li < text.length) c.appendChild(document.createTextNode(text.slice(li))); }
  function renderM(items){
    if(!items || !items.length) return;
    var k = JSON.stringify(items); if(k === lastKey) return; lastKey = k; track.innerHTML = '';
    var fr = document.createDocumentFragment();
    function pass(){ items.forEach(function(it, i){ if(i > 0) fr.appendChild(document.createTextNode('　★　')); appendText(fr, String(it)); }); }
    pass(); fr.appendChild(document.createTextNode('　★　')); pass(); track.appendChild(fr);
    bar.classList.add('show'); document.body.classList.add('has-marquee');
    track.style.animationDuration = Math.max(track.scrollWidth / 2 / 60, 12) + 's';
  }
  function fetchM(){ fetch(URL_, {method:'POST', body:JSON.stringify({serial:''})}).then(function(r){ return r.json(); }).then(function(d){ if(d && Array.isArray(d.marquee) && d.marquee.length){ lsSet('marquee', JSON.stringify(d.marquee)); renderM(d.marquee); } }).catch(function(){}); }
  renderM(lsJson('marquee', [])); fetchM(); setInterval(fetchM, REFRESH);
}

window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window._dp = e; });
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(function(){});

applyView();
if(firstRun || !CAMPS.length){ CAMPS = []; addCamp(E.sample(today())); STEP = 'report'; lsSet('step', STEP); }
if(!camp()){ CUR = CAMPS[0].id; save(); }
if(['setup', 'import', 'report'].indexOf(STEP) < 0) STEP = 'setup';
render(); initMarquee();
if(!lsGet('warnSeen')){ showWarn(); lsSet('warnSeen', '1'); }
window._et = {get C(){ return S(); }, get CAMPS(){ return CAMPS; }, get IMP(){ return IMP; }, ACT:ACT, loadTable:loadTable, render:render, setToday:function(t){ TODAY = t; render(); }};
})();

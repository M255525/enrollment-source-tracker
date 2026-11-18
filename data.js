/* 招生成效追蹤：純函式引擎（瀏覽器掛 window.ET，node 可 require）。
 * 報名名單匯入後只保留「日期、來源、得知管道、狀態、去重用雜湊」，姓名電話不存。改了這個檔要跑 node tools/test_engine.mjs */
(function(root){
'use strict';

var DAY = 86400000;
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function str(v){ return v == null ? '' : String(v); }
function cut(s, n){ return Array.from(str(s)).slice(0, n).join(''); }
function num(v){ var n = parseFloat(str(v).replace(/[,，\s$＄元]/g, '')); return isFinite(n) && n >= 0 ? n : 0; }
function fmt(n){ return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function pct(a, b){ return b ? Math.round(a / b * 1000) / 10 : null; }
function pad(n){ return (n < 10 ? '0' : '') + n; }
function ymd(t){ var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function dayStart(t){ var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function parseYmd(s){ var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str(s).trim()); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; }

/* ---------- 管道 ---------- */
var PRESETS = [
  {code:'fbpage', n:'FB 粉絲專頁', kw:'粉專|粉絲專頁|fb粉|臉書粉|facebook page'},
  {code:'fbgroup', n:'FB 社團', kw:'社團|fb群|臉書社團|group'},
  {code:'fbad', n:'FB／IG 廣告', kw:'廣告|贊助|ads?\\b|sponsored'},
  {code:'ig', n:'Instagram', kw:'instagram|\\big\\b|哀居'},
  {code:'lineoa', n:'LINE 官方帳號', kw:'line\\s*官方|官方帳號|line@|lineoa'},
  {code:'linegroup', n:'LINE 群組', kw:'line\\s*群|群組|line'},
  {code:'web', n:'官方網站', kw:'官網|網站|網頁|website'},
  {code:'edm', n:'Email 電子報', kw:'電子報|email|e-mail|mail|edm|信件'},
  {code:'gov', n:'台灣就業通／在職訓練網', kw:'就業通|在職訓練網|ojt|taiwanjobs|勞動部|勞發署|產投'},
  {code:'flyer', n:'實體傳單', kw:'傳單|dm|文宣'},
  {code:'poster', n:'海報', kw:'海報|公告欄|布告欄'},
  {code:'partner', n:'合作單位', kw:'合作|協會|公會|學校|社大|社區大學|商會'},
  {code:'friend', n:'親友／舊生推薦', kw:'朋友|親友|同事|家人|介紹|推薦|舊生|學長|學姊|口碑'},
  {code:'search', n:'Google 搜尋', kw:'google|搜尋|谷歌|search'},
  {code:'yt', n:'YouTube', kw:'youtube|yt|影片'}
];
function slug(s){ return str(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16); }
function blankChannel(){ return {code:'', n:'', cost:'', clicks:'', post:''}; }
function blank(){ return {name:'', url:'', mode:'gform', param:'', target:'', deadline:'', start:'', channels:[], rows:[], imported:''}; }
function normalize(c){
  var b = blank();
  if(!c || typeof c !== 'object') return b;
  ['name', 'url', 'param', 'imported'].forEach(function(k){ b[k] = cut(c[k], k === 'url' ? 2000 : 120); });
  b.mode = {gform:1, src:1, utm:1}[c.mode] ? c.mode : 'gform';
  b.target = c.target === '' || c.target == null ? '' : String(Math.round(num(c.target)));
  ['deadline', 'start'].forEach(function(k){ b[k] = parseYmd(c[k]) != null ? str(c[k]) : ''; });
  if(Array.isArray(c.channels)) b.channels = c.channels.slice(0, 30).map(function(x){ var n = blankChannel(); x = x || {}; n.code = slug(x.code) || 'ch'; n.n = cut(x.n, 40); n.cost = x.cost === '' || x.cost == null ? '' : String(num(x.cost)); n.clicks = x.clicks === '' || x.clicks == null ? '' : String(Math.round(num(x.clicks))); n.post = parseYmd(x.post) != null ? str(x.post) : ''; return n; });
  var seen = {};
  b.channels.forEach(function(x){ var k = x.code, i = 2; while(seen[x.code]) x.code = k + (i++); seen[x.code] = 1; });
  if(Array.isArray(c.rows)) b.rows = c.rows.slice(0, 5000).filter(function(r){ return r && typeof r.t === 'number'; }).map(function(r){ return {t:r.t, src:cut(r.src, 40), how:cut(r.how, 60), st:{reg:1, adm:1, paid:1, att:1, cancel:1}[r.st] ? r.st : 'reg', k:cut(r.k, 16)}; });
  return b;
}
function addPreset(c, code){
  var p = PRESETS.filter(function(x){ return x.code === code; })[0]; if(!p) return c;
  if(c.channels.some(function(x){ return x.code === code; })) return c;
  var n = blankChannel(); n.code = p.code; n.n = p.n; c.channels.push(n); return c;
}

/* ---------- 追蹤連結 ---------- */
/* Google 表單「取得預先填入的連結」：使用者在來源題填 TEST，這裡找出值是 TEST 的 entry.xxx 參數 */
function detectPrefill(url){
  var u; try{ u = new URL(str(url).trim()); }catch(e){ return null; }
  var found = null, entries = [];
  u.searchParams.forEach(function(v, k){ if(/^entry\.\d+$/.test(k)){ entries.push(k); if(/^(test|測試|xxx|來源|src|source)$/i.test(v.trim())) found = k; } });
  if(!found && entries.length === 1) found = entries[0];
  if(!found) return null;
  return {param:found, isForm:/docs\.google\.com\/forms|forms\.gle/.test(u.href)};
}
function link(c, ch){
  var base = str(c.url).trim(); if(!base || !ch) return '';
  var u; try{ u = new URL(base); }catch(e){ return ''; }
  if(c.mode === 'gform'){
    var p = c.param || (detectPrefill(base) || {}).param; if(!p) return '';
    u.searchParams.set(p, ch.code);
    if(!u.searchParams.has('usp')) u.searchParams.set('usp', 'pp_url');
  } else if(c.mode === 'utm'){
    u.searchParams.set('utm_source', ch.code); u.searchParams.set('utm_medium', /ad$/.test(ch.code) ? 'cpc' : /flyer|poster/.test(ch.code) ? 'print' : 'social');
    u.searchParams.set('utm_campaign', slug(c.name) || 'course');
  } else u.searchParams.set('src', ch.code);
  return u.href;
}

/* ---------- 匯入 ---------- */
function parseCSV(text){
  text = str(text).replace(/^\uFEFF/, '');
  var tab = text.indexOf('\t') >= 0 && text.split('\n')[0].indexOf('\t') >= 0, sep = tab ? '\t' : ',';
  var rows = [], row = [], cur = '', q = false;
  for(var i = 0; i < text.length; i++){
    var ch = text[i];
    if(q){ if(ch === '"'){ if(text[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
    else if(ch === '"' && cur === '') q = true;
    else if(ch === sep){ row.push(cur); cur = ''; }
    else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if(row.some(function(x){ return x.trim(); })) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if(row.some(function(x){ return x.trim(); })) rows.push(row);
  return rows;
}
/* Google 表單時間戳記：「2026/11/3 下午 2:15:30」「2026-11-03 14:15:30」「11/3/2026 14:15」、民國年、Excel 序號 */
function parseTime(v){
  if(typeof v === 'number' && v > 20000 && v < 80000){ var b = new Date(1899, 11, 30), whole = Math.floor(v); return new Date(b.getFullYear(), b.getMonth(), b.getDate() + whole).getTime() + Math.round((v - whole) * DAY); } // Excel 日期序號
  var s = str(v).trim(); if(!s) return null;
  if(/^\d{5}(\.\d+)?$/.test(s)) return parseTime(+s);
  var pm = /下午|pm/i.test(s), am = /上午|am/i.test(s);
  s = s.replace(/上午|下午|am|pm/ig, ' ').replace(/[年月]/g, '/').replace(/日/g, ' ').replace(/\s+/g, ' ').trim();
  var m = /^(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s), y, mo, d;
  if(!m) return null;
  if(+m[1] > 31){ y = +m[1]; mo = +m[2]; d = +m[3]; } else { mo = +m[1]; d = +m[2]; y = +m[3]; }
  if(y < 1000) y += 1911;
  if(mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  var h = m[4] ? +m[4] : 0; if(pm && h < 12) h += 12; if(am && h === 12) h = 0;
  return new Date(y, mo - 1, d, h, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0).getTime();
}
var COLS = {
  t:/時間戳記|timestamp|報名時間|填寫時間|提交時間|日期|時間/i,
  src:/來源代碼|來源|代碼|src|utm_source|source|管道代碼/i,
  how:/從哪|得知|如何知道|哪裡知道|訊息來源|消息來源|資訊來源/i,
  st:/狀態|錄取|繳費|報到|出席|結果|備註/i,
  key:/e-?mail|電子郵件|信箱|手機|電話|身分證|姓名|name/i
};
function guessCols(head){
  var r = {t:-1, src:-1, how:-1, st:-1, key:-1};
  head.forEach(function(h, i){ h = str(h);
    if(r.how < 0 && COLS.how.test(h)) { r.how = i; return; }
    if(r.t < 0 && COLS.t.test(h)) { r.t = i; return; }
    if(r.src < 0 && COLS.src.test(h)) { r.src = i; return; }
    if(r.st < 0 && COLS.st.test(h)) { r.st = i; return; }
  });
  var best = -1, rank = 99;
  head.forEach(function(h, i){ h = str(h); var k = /e-?mail|電子郵件|信箱/i.test(h) ? 0 : /手機|電話/.test(h) ? 1 : /身分證/.test(h) ? 2 : /姓名|name/i.test(h) ? 3 : 99; if(k < rank){ rank = k; best = i; } });
  r.key = best;
  return r;
}
function statusOf(v){
  v = str(v);
  if(/取消|放棄|退費|退訓|未錄取|不錄取|候補未/.test(v)) return 'cancel';
  if(/結訓|到課|出席|報到|已上課/.test(v)) return 'att';
  if(/已繳|繳費|付款|已付/.test(v)) return 'paid';
  if(/錄取|正取|通過/.test(v)) return 'adm';
  return 'reg';
}
var ST = {reg:'報名', adm:'錄取', paid:'繳費', att:'到課', cancel:'取消'};
var ST_RANK = {reg:1, adm:2, paid:3, att:4, cancel:0};
function hash(s){ var h = 2166136261; s = str(s).trim().toLowerCase().replace(/[\s-]/g, ''); for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
/* rows → {rows:[{t,src,how,st,k}], skipped, dup}；只留下這五個欄位 */
function importRows(table, cols, opt){
  opt = opt || {};
  var out = [], skipped = 0, dup = 0, seen = {};
  (opt.existing || []).forEach(function(r){ if(r.k) seen[r.k] = r; });
  table.forEach(function(r){
    var t = parseTime(r[cols.t]);
    if(t == null){ skipped++; return; }
    var k = cols.key >= 0 && str(r[cols.key]).trim() ? hash(r[cols.key]) : '';
    var row = {t:t, src:cols.src >= 0 ? cut(str(r[cols.src]).trim(), 40) : '', how:cols.how >= 0 ? cut(str(r[cols.how]).trim(), 60) : '', st:cols.st >= 0 ? statusOf(r[cols.st]) : 'reg', k:k};
    if(k && seen[k]){ dup++; var o = seen[k]; if(ST_RANK[row.st] > ST_RANK[o.st] || row.st === 'cancel') o.st = row.st; if(!o.src && row.src) o.src = row.src; return; }
    if(k) seen[k] = row;
    out.push(row);
  });
  return {rows:out, skipped:skipped, dup:dup};
}

/* ---------- 歸戶：每筆報名算到哪個管道 ---------- */
function matchHow(how, channels){
  var h = str(how).toLowerCase(); if(!h) return '';
  for(var i = 0; i < channels.length; i++){ var c = channels[i]; if(c.n && h.indexOf(c.n.toLowerCase()) >= 0) return c.code; }
  var hits = [];
  PRESETS.forEach(function(p){ if(new RegExp(p.kw, 'i').test(h)) hits.push(p.code); });
  for(var j = 0; j < hits.length; j++) if(channels.some(function(c){ return c.code === hits[j]; })) return hits[j];
  return hits.length ? 'other' : '';
}
/* 優先用連結帶進來的來源代碼（追蹤），其次用學員自填的「從哪裡得知」（自填），都沒有就是「未知」 */
function attribute(row, channels){
  var s = str(row.src).trim().toLowerCase();
  if(s){
    var c = channels.filter(function(x){ return x.code === slug(s) || x.n.toLowerCase() === s; })[0];
    if(c) return {ch:c.code, by:'link'};
  }
  var m = matchHow(row.how, channels);
  if(m) return {ch:m, by:'self'};
  if(s){ var m2 = matchHow(s, channels); if(m2) return {ch:m2, by:'self'}; }
  return {ch:'unknown', by:''};
}

/* ---------- 分析 ---------- */
function analyze(c, today){
  today = today == null ? Date.now() : today;
  var chs = c.channels, by = {}, order = chs.map(function(x){ return x.code; }).concat(['other', 'unknown']);
  order.forEach(function(k){ var ch = chs.filter(function(x){ return x.code === k; })[0]; by[k] = {code:k, n:ch ? ch.n : k === 'other' ? '其他（自填但不在清單）' : '未知來源', cost:ch ? num(ch.cost) : 0, clicks:ch ? num(ch.clicks) : 0, hasClicks:!!(ch && ch.clicks !== ''), post:ch ? ch.post : '', reg:0, adm:0, paid:0, att:0, cancel:0, link:0, self:0, first:null, days:{}}; });
  var valid = c.rows.filter(function(r){ return r.st !== 'cancel'; });
  c.rows.forEach(function(r){
    var a = attribute(r, chs), b = by[a.ch];
    if(r.st === 'cancel'){ b.cancel++; return; }
    b.reg++; if(ST_RANK[r.st] >= 2) b.adm++; if(ST_RANK[r.st] >= 3) b.paid++; if(r.st === 'att') b.att++;
    if(a.by === 'link') b.link++; else if(a.by === 'self') b.self++;
    if(b.first == null || r.t < b.first) b.first = r.t;
    var d = ymd(r.t); b.days[d] = (b.days[d] || 0) + 1;
  });
  var list = order.map(function(k){ var b = by[k];
    b.rate = b.hasClicks ? pct(b.reg, b.clicks) : null;
    b.cpr = b.cost && b.reg ? Math.round(b.cost / b.reg) : null;
    b.cpa = b.cost && b.att ? Math.round(b.cost / b.att) : null;
    var p = parseYmd(b.post); b.after3 = 0;
    if(p != null) Object.keys(b.days).forEach(function(d){ var t = parseYmd(d); if(t >= p && t < p + 3 * DAY) b.after3 += b.days[d]; });
    return b;
  }).filter(function(b){ return b.reg || b.cancel || chs.some(function(x){ return x.code === b.code; }); });
  var tot = {reg:valid.length, adm:0, paid:0, att:0, cancel:c.rows.length - valid.length, cost:0, clicks:0, link:0, self:0, unknown:by.unknown.reg};
  list.forEach(function(b){ tot.adm += b.adm; tot.paid += b.paid; tot.att += b.att; tot.cost += b.cost; tot.clicks += b.hasClicks ? b.clicks : 0; tot.link += b.link; tot.self += b.self; });
  var hasStatus = c.rows.some(function(r){ return r.st !== 'reg'; });
  // 每日與累積
  var ts = valid.map(function(r){ return r.t; }), t0 = parseYmd(c.start), dl = parseYmd(c.deadline);
  if(t0 == null && ts.length) t0 = dayStart(Math.min.apply(null, ts));
  var t1 = Math.max(ts.length ? dayStart(Math.max.apply(null, ts)) : 0, Math.min(dayStart(today), dl != null ? dl : dayStart(today)));
  var days = [];
  if(t0 != null && t1 >= t0 && (t1 - t0) / DAY <= 400){
    var acc = 0, cnt = {};
    valid.forEach(function(r){ var d = ymd(r.t); cnt[d] = (cnt[d] || 0) + 1; });
    for(var t = t0; t <= t1; t += DAY){ t = dayStart(t + 3 * 3600000); var d = ymd(t); acc += cnt[d] || 0; days.push({d:d, t:t, n:cnt[d] || 0, acc:acc, posts:chs.filter(function(x){ return x.post === d; }).map(function(x){ return x.n; })}); }
  }
  // 預測
  var target = num(c.target), fc = null;
  if(target && dl != null){
    var left = Math.max(0, Math.round((dl - dayStart(today)) / DAY)), recent = days.slice(-7), pace = recent.length ? recent.reduce(function(a, x){ return a + x.n; }, 0) / recent.length : 0;
    var need = Math.max(0, target - tot.reg), proj = Math.round(tot.reg + pace * left);
    fc = {target:target, left:left, need:need, pace:Math.round(pace * 10) / 10, proj:proj, perDay:left ? Math.round(need / left * 10) / 10 : need, ok:proj >= target, done:tot.reg >= target, closed:dayStart(today) > dl};
  }
  return {list:list, tot:tot, days:days, fc:fc, hasStatus:hasStatus, insights:insights(list, tot, fc, hasStatus)};
}
function insights(list, tot, fc, hasStatus){
  var r = [], named = list.filter(function(b){ return b.code !== 'unknown' && b.code !== 'other'; });
  if(!tot.reg) return [{lv:'tip', t:'還沒有報名資料。先把各管道的專屬連結發出去，有人報名後再到「② 匯入報名資料」讀進來。'}];
  var top = named.slice().sort(function(a, b){ return b.reg - a.reg; })[0];
  if(top && top.reg) r.push({lv:'ok', t:'報名最多的是「' + top.n + '」：' + top.reg + ' 人，占 ' + pct(top.reg, tot.reg) + '%。'});
  var costed = named.filter(function(b){ return b.cpr != null; }).sort(function(a, b){ return a.cpr - b.cpr; });
  if(costed.length >= 2) r.push({lv:'ok', t:'每位報名成本最低的是「' + costed[0].n + '」（' + fmt(costed[0].cpr) + ' 元），最高的是「' + costed[costed.length - 1].n + '」（' + fmt(costed[costed.length - 1].cpr) + ' 元）。'});
  named.filter(function(b){ return b.cost > 0 && b.reg === 0; }).forEach(function(b){ r.push({lv:'warn', t:'「' + b.n + '」花了 ' + fmt(b.cost) + ' 元，還沒有任何報名，建議檢查連結或換素材。'}); });
  named.filter(function(b){ return b.hasClicks && b.clicks >= 50 && b.rate != null && b.rate < 2; }).forEach(function(b){ r.push({lv:'warn', t:'「' + b.n + '」有 ' + fmt(b.clicks) + ' 次點擊但報名率只有 ' + b.rate + '%：點進來的人沒報名，可能是報名頁太長、費用或資格說明不清楚。'}); });
  named.filter(function(b){ return b.post && b.after3 >= 3; }).sort(function(a, b){ return b.after3 - a.after3; }).slice(0, 3).forEach(function(b){ r.push({lv:'ok', t:'「' + b.n + '」' + b.post.slice(5).replace('-', '/') + ' 發布後 3 天內帶來 ' + b.after3 + ' 人報名。'}); });
  var unk = list.filter(function(b){ return b.code === 'unknown'; })[0];
  if(unk && pct(unk.reg, tot.reg) >= 20) r.push({lv:'warn', t:'有 ' + pct(unk.reg, tot.reg) + '% 的報名不知道從哪裡來。建議每個管道都用專屬連結，報名表加一題「從哪裡得知本課程」。'});
  if(hasStatus && tot.reg){
    var low = tot.att ? named.filter(function(b){ return b.reg >= 5 && pct(b.att, b.reg) < 50; }) : [];
    low.forEach(function(b){ r.push({lv:'warn', t:'「' + b.n + '」報名 ' + b.reg + ' 人、到課只有 ' + b.att + ' 人（' + pct(b.att, b.reg) + '%），這個管道的報名者流失較多，可以加強課前提醒。'}); });
  }
  if(fc){
    if(fc.done) r.push({lv:'ok', t:'已達到目標 ' + fc.target + ' 人' + (fc.closed ? '' : '，可以開始收備取名單') + '。'});
    else if(fc.closed) r.push({lv:'warn', t:'報名已截止，差 ' + fc.need + ' 人達標。'});
    else if(fc.ok) r.push({lv:'ok', t:'照最近 7 天每天 ' + fc.pace + ' 人的速度，截止前預估會有 ' + fc.proj + ' 人，可以達標。'});
    else r.push({lv:'bad', t:'照最近 7 天每天 ' + fc.pace + ' 人的速度，截止前預估只有 ' + fc.proj + ' 人；還差 ' + fc.need + ' 人，剩 ' + fc.left + ' 天，每天要 ' + fc.perDay + ' 人。建議加推報名最多或成本最低的管道。'});
  }
  return r;
}
function summaryCsv(c, a){
  var q = function(v){ v = str(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var out = [['管道', '代碼', '花費', '點擊', '報名', '報名率%', '錄取', '繳費', '到課', '取消', '每位報名成本', '每位到課成本', '追蹤連結歸戶', '自填歸戶'].join(',')];
  a.list.forEach(function(b){ out.push([q(b.n), b.code, b.cost || '', b.hasClicks ? b.clicks : '', b.reg, b.rate == null ? '' : b.rate, b.adm, b.paid, b.att, b.cancel, b.cpr == null ? '' : b.cpr, b.cpa == null ? '' : b.cpa, b.link, b.self].join(',')); });
  out.push(['合計', '', a.tot.cost || '', a.tot.clicks || '', a.tot.reg, '', a.tot.adm, a.tot.paid, a.tot.att, a.tot.cancel, a.tot.cost && a.tot.reg ? Math.round(a.tot.cost / a.tot.reg) : '', '', a.tot.link, a.tot.self].join(','));
  return out.join('\r\n');
}

/* ---------- 範例（虛構，用固定亂數產生） ---------- */
function rng(seed){ return function(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
function sample(today){
  var c = blank();
  c.name = 'AI 工具入門 第 3 期'; c.mode = 'gform';
  c.url = 'https://docs.google.com/forms/d/e/EXAMPLE-FORM-ID/viewform?usp=pp_url&entry.1234567890=TEST';
  c.param = 'entry.1234567890'; c.target = '55';
  var base = dayStart(today == null ? Date.now() : today) - 18 * DAY;
  c.start = ymd(base); c.deadline = ymd(base + 30 * DAY);
  var spec = [['fbpage', 0, 160, 2, 7], ['fbgroup', 0, 70, 6, 5], ['fbad', 3000, 620, 9, 8], ['lineoa', 0, 90, 4, 6], ['gov', 0, '', 0, 4], ['flyer', 800, '', 1, 2], ['partner', 0, 40, 12, 4], ['friend', 0, '', '', 5]];
  spec.forEach(function(s){ addPreset(c, s[0]); var ch = c.channels[c.channels.length - 1]; ch.cost = s[1] ? String(s[1]) : ''; ch.clicks = s[2] === '' ? '' : String(s[2]); ch.post = s[3] === '' ? '' : ymd(base + s[3] * DAY); });
  var r = rng(7), rows = [], hows = {friend:['朋友介紹', '同事推薦', '舊生'], gov:['在職訓練網']};
  spec.forEach(function(s){
    for(var i = 0; i < s[4]; i++){
      var d = Math.min(18, (s[3] === '' ? 3 + Math.floor(r() * 14) : s[3]) + Math.floor(r() * r() * 6)), t = base + d * DAY + (9 + Math.floor(r() * 12)) * 3600000 + Math.floor(r() * 60) * 60000;
      var viaLink = s[0] !== 'friend' && r() < .8, st = r(), stat = st < .07 ? 'cancel' : st < .45 ? 'paid' : st < .7 ? 'adm' : 'reg'; // 還沒開課，沒有「到課」
      rows.push({t:t, src:viaLink ? s[0] : '', how:viaLink ? '' : (hows[s[0]] ? hows[s[0]][Math.floor(r() * hows[s[0]].length)] : PRESETS.filter(function(p){ return p.code === s[0]; })[0].n), st:stat, k:'x' + rows.length});
    }
  });
  for(var u = 0; u < 3; u++) rows.push({t:base + (6 + u * 4) * DAY + 3600000 * 15, src:'', how:'', st:'reg', k:'u' + u});
  c.rows = rows.sort(function(a, b){ return a.t - b.t; });
  c.imported = '範例資料（虛構）';
  return c;
}

var api = {DAY:DAY, clone:clone, num:num, fmt:fmt, pct:pct, ymd:ymd, parseYmd:parseYmd, PRESETS:PRESETS, slug:slug, blank:blank, blankChannel:blankChannel, normalize:normalize, addPreset:addPreset,
  detectPrefill:detectPrefill, link:link, parseCSV:parseCSV, parseTime:parseTime, guessCols:guessCols, statusOf:statusOf, ST:ST, hash:hash, importRows:importRows,
  matchHow:matchHow, attribute:attribute, analyze:analyze, summaryCsv:summaryCsv, sample:sample};
if(typeof module !== 'undefined' && module.exports) module.exports = api;
else root.ET = api;
})(this);

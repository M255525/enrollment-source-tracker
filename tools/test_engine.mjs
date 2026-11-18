// 引擎測試：node tools/test_engine.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const E = require('../data.js');
let pass = 0, fail = 0;
function ok(c, msg){ if(c) pass++; else { fail++; console.log('✗ ' + msg); } }
const D = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();

// 時間解析
const t = s => { const v = E.parseTime(s); return v == null ? null : new Date(v); };
ok(t('2026/11/3 下午 2:15:30').getHours() === 14, 'Google 表單下午');
ok(t('2026/11/3 上午 12:05:00').getHours() === 0, '上午 12 點＝0 點');
ok(t('2026/11/3 下午 12:30:00').getHours() === 12, '下午 12 點＝12 點');
ok(t('2026-11-03 14:15:30').getMinutes() === 15, 'ISO 格式');
ok(t('115/11/3 9:05').getFullYear() === 2026, '民國年');
ok(t('11/3/2026 9:05').getMonth() === 10 && t('11/3/2026 9:05').getDate() === 3, '美式月日年');
ok(t('2026年11月3日 9:05').getDate() === 3, '中文年月日');
ok(t(46329.5).getFullYear() === 2026 && t(46329.5).getHours() === 12, 'Excel 序號 ' + t(46329.5));
ok(t('46329') && t('46329').getFullYear() === 2026, 'Excel 序號字串');
ok(E.parseTime('') === null && E.parseTime('亂打') === null && E.parseTime('2026/13/40') === null, '讀不懂回 null');

// CSV
const csv = E.parseCSV('﻿時間戳記,姓名,"從哪裡得知, 本課程",來源代碼\r\n2026/11/3 下午 2:15:30,王小明,"朋友介紹，""很推""",fbpage\r\n\r\n2026/11/4 上午 9:00:00,李大華,,lineoa\n');
ok(csv.length === 3 && csv[0][2] === '從哪裡得知, 本課程' && csv[1][2] === '朋友介紹，"很推"', 'CSV 引號與逗號 ' + JSON.stringify(csv[1]));
ok(E.parseCSV('a\tb\n1\t2').length === 2 && E.parseCSV('a\tb\n1\t2')[1][1] === '2', 'Tab 分隔');

// 欄位猜測
const g = E.guessCols(['時間戳記', '姓名', '電子郵件地址', '手機', '您從哪裡得知本課程？', '來源代碼', '錄取狀態']);
ok(g.t === 0 && g.how === 4 && g.src === 5 && g.st === 6 && g.key === 2, '欄位猜測 ' + JSON.stringify(g));
ok(E.guessCols(['Timestamp', 'Name', 'Phone', 'utm_source']).src === 3, '英文欄名');

// 狀態
ok(['已錄取', '已繳費', '已報到', '取消報名', '', '備取未錄取'].map(E.statusOf).join() === 'adm,paid,att,cancel,reg,cancel', '狀態判讀');

// 匯入、去重、只保留五欄
const table = csv.slice(1).concat([['2026/11/5 上午 10:00:00', '王小明', '', 'fbpage']]);
const im = E.importRows(table, {t:0, src:3, how:2, st:-1, key:1});
ok(im.rows.length === 2 && im.dup === 1, '依去重欄合併重複');
ok(Object.keys(im.rows[0]).sort().join() === 'how,k,src,st,t', '只保留五個欄位');
ok(!JSON.stringify(im.rows).includes('王小明') && !JSON.stringify(im.rows).includes('李大華'), '姓名不會存下來');
const im2 = E.importRows([['2026/11/6 9:00', 'x', '', 'fbpage', '已繳費']], {t:0, src:3, how:-1, st:4, key:1}, {existing:im.rows.concat([{t:1, src:'', how:'', st:'reg', k:E.hash('x')}])});
ok(im2.rows.length === 0 && im2.dup === 1, '合併到既有資料時去重');
ok(E.importRows([['壞時間', 'a']], {t:0, src:-1, how:-1, st:-1, key:-1}).skipped === 1, '讀不到時間略過');

// 追蹤連結
const pre = 'https://docs.google.com/forms/d/e/1FAIpQ/viewform?usp=pp_url&entry.111=&entry.222=TEST';
ok(E.detectPrefill(pre).param === 'entry.222', '找出填 TEST 的參數');
ok(E.detectPrefill('https://docs.google.com/forms/d/e/x/viewform?entry.9=abc').param === 'entry.9', '只有一個 entry 時直接用');
ok(E.detectPrefill('https://docs.google.com/forms/d/e/x/viewform?entry.1=a&entry.2=b') === null, '多個 entry 又沒填 TEST 找不到');
ok(E.detectPrefill('not a url') === null, '不是網址');
const c = E.blank(); c.url = pre; c.name = 'AI 入門 3'; E.addPreset(c, 'fbpage'); E.addPreset(c, 'flyer'); E.addPreset(c, 'fbpage');
ok(c.channels.length === 2, '同一個預設管道不重複加');
ok(E.link(c, c.channels[0]).includes('entry.222=fbpage') && E.link(c, c.channels[0]).includes('usp=pp_url'), 'Google 表單連結 ' + E.link(c, c.channels[0]));
c.mode = 'src'; c.url = 'https://example.com/apply?id=7'; ok(E.link(c, c.channels[1]) === 'https://example.com/apply?id=7&src=flyer', '?src= 連結');
c.mode = 'utm'; const u = new URL(E.link(c, c.channels[1])); ok(u.searchParams.get('utm_source') === 'flyer' && u.searchParams.get('utm_medium') === 'print' && u.searchParams.get('utm_campaign') === 'ai3', 'UTM 連結 ' + u.href);
c.url = ''; ok(E.link(c, c.channels[0]) === '', '沒網址不產生');

// 歸戶
const chs = c.channels;
ok(E.attribute({src:'fbpage', how:'朋友'}, chs).by === 'link', '有來源代碼優先');
ok(E.attribute({src:'', how:'在 FB 粉專看到'}, chs).ch === 'fbpage', '自填對到管道');
ok(E.attribute({src:'', how:'朋友介紹'}, chs).ch === 'other', '自填但不在清單→其他');
ok(E.attribute({src:'', how:''}, chs).ch === 'unknown', '都沒有→未知');
ok(E.attribute({src:'FBPAGE', how:''}, chs).ch === 'fbpage', '代碼大小寫');

// 分析與範例
const now = D(2026, 11, 18);
const s = E.sample(now), a = E.analyze(s, now);
const sum = a.list.reduce((x, b) => x + b.reg, 0);
ok(sum === a.tot.reg, '各管道加總等於總報名 ' + sum + '/' + a.tot.reg);
ok(a.tot.reg > 30 && a.tot.cancel >= 1, '範例有足夠資料');
ok(a.fc && a.fc.target === 55 && a.fc.left === 12 && !a.fc.done, '範例預測 ' + JSON.stringify(a.fc));
ok(a.days.length >= 15 && a.days[a.days.length - 1].acc === a.tot.reg, '每日累積');
ok(a.insights.some(x => x.lv === 'bad' && /還差/.test(x.t)), '來不及額滿的提醒');
ok(a.insights.some(x => /報名率只有/.test(x.t)), '點擊多報名少的提醒');
ok(a.list.find(b => b.code === 'fbad').cpr === Math.round(3000 / a.list.find(b => b.code === 'fbad').reg), '每位報名成本');
ok(!a.insights.some(x => /到課/.test(x.t)), '還沒開課不提醒到課');
ok(E.summaryCsv(s, a).split('\r\n').length === a.list.length + 2, 'CSV 摘要行數');
ok(JSON.stringify(E.sample(now)) === JSON.stringify(E.sample(now)), '範例可重現');
const e0 = E.analyze(E.blank(), now); ok(e0.tot.reg === 0 && e0.insights[0].lv === 'tip', '空資料');
// 已達標、已截止
const s2 = E.clone(s); s2.target = '10'; ok(E.analyze(s2, now).insights.some(x => /已達到目標/.test(x.t)), '已達標');
const s3 = E.clone(s); s3.deadline = E.ymd(now - 2 * E.DAY); ok(E.analyze(s3, now).fc.closed, '已截止');
// 花錢沒報名
const s4 = E.clone(s); s4.channels.push({code:'yt', n:'YouTube', cost:'500', clicks:'', post:''}); ok(E.analyze(s4, now).insights.some(x => /YouTube」花了 500 元/.test(x.t)), '花錢沒報名提醒');

// normalize 防呆
const z = E.normalize({mode:'x', target:'abc', deadline:'2026/1/1', channels:[{code:'FB Page!', n:'a'}, {code:'fbpage', n:'b'}], rows:[{t:'x'}, {t:5, st:'zz', name:'王小明'}]});
ok(z.mode === 'gform' && z.target === '0' && z.deadline === '' && z.channels[0].code === 'fbpage' && z.channels[1].code === 'fbpage2', 'normalize 管道代碼不重複 ' + JSON.stringify(z.channels));
ok(z.rows.length === 1 && z.rows[0].st === 'reg' && !('name' in z.rows[0]), 'normalize 報名列只留白名單欄位');

console.log(`通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);

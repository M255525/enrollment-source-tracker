/* 招生成效追蹤：檔案讀寫。zipStore（store 模式打包 QR 圖）複製自 行銷內容工具/course-poster-maker/zip.js；
 * readXlsx 自寫：讀 zip 中央目錄 → DecompressionStream('deflate-raw') 解壓 → 解析第一個工作表，回傳二維陣列（字串）。 */
(function (root) {
'use strict';

/* ---------- zip ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b){ let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files, type){
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  files.forEach((f) => {
    const nm = enc.encode(f.name), d = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + d.length;
  });
  const cs = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), {type: type || 'application/zip'});
}

/* ---------- xlsx 讀取 ---------- */
async function unzip(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('不是有效的 xlsx 檔');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    files[name] = {method, csize, lo};
    p += 46 + nl + el + cl;
  }
  return {files, async text(name){
    const f = files[name]; if (!f) return null;
    const start = f.lo + 30 + dv.getUint16(f.lo + 26, true) + dv.getUint16(f.lo + 28, true), data = u8.subarray(start, start + f.csize);
    if (f.method === 0) return dec.decode(data);
    if (typeof DecompressionStream === 'undefined') throw new Error('這個瀏覽器不支援解壓縮，請改存成 CSV');
    return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }};
}
function colIdx(ref){ const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
async function readXlsx(buf){
  const z = await unzip(buf), xml = s => new DOMParser().parseFromString(s, 'application/xml');
  let sheet = 'xl/worksheets/sheet1.xml';
  const wb = await z.text('xl/workbook.xml'), rels = await z.text('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName('sheet')[0], rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    Array.from(xml(rels).getElementsByTagName('Relationship')).forEach(r => { if (r.getAttribute('Id') === rid) { const t = r.getAttribute('Target'); sheet = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); } });
  }
  const ssx = await z.text('xl/sharedStrings.xml'), ss = ssx ? Array.from(xml(ssx).getElementsByTagName('si')).map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join('')) : [];
  const sx = await z.text(sheet); if (!sx) throw new Error('讀不到工作表');
  const out = [];
  Array.from(xml(sx).getElementsByTagName('row')).forEach(row => {
    const r = [];
    Array.from(row.getElementsByTagName('c')).forEach((c, i) => {
      const ci = colIdx(c.getAttribute('r')), t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 's') val = ss[+(v && v.textContent)] || '';
      else if (t === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map(x => x.textContent).join('');
      else val = v ? v.textContent : '';
      r[ci >= 0 ? ci : i] = val;
    });
    for (let k = 0; k < r.length; k++) if (r[k] == null) r[k] = '';
    if (r.some(x => String(x).trim())) out.push(r);
  });
  return out;
}

root.ETIO = {zipStore, crc32, readXlsx};
if (typeof module === 'object' && module.exports) module.exports = root.ETIO;
})(typeof window !== 'undefined' ? window : globalThis);

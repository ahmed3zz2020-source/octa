/* ══════════════════════════════════════════════════════════════
  📗 xlsx.js — مولّد Excel حقيقي في المتصفح (بلا مكتبات)
  ──────────────────────────────────────────────────────────────
  🎯 السبب: التصدير القديم كان CSV عربي مفصول بـ« , » ⇒ Excel
     العربي بيفتحه كملف عمود واحد (ملخبط) والترميز بيتكسر.
  ⭐ هنا بنكتب .xlsx حقيقي (OOXML) ⇒ العربي + الاتجاه + الألوان
     + الأعمدة + عدة أوراق.
  ⚙️ ZIPSTORE (بلا ضغط) ⇒ سريع وبسيط، وExcel بيفتحه عادي.
  ══════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';

  /* ─── CRC32 ─── */
  var T = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [], i, cc;
    for (i = 0; i < s.length; i++) {
      cc = s.charCodeAt(i);
      if (cc < 0x80) out.push(cc);
      else if (cc < 0x800) out.push(0xC0 | (cc >> 6), 0x80 | (cc & 0x3F));
      else if (cc >= 0xD800 && cc <= 0xDBFF && i + 1 < s.length) {
        var c2 = s.charCodeAt(i + 1);
        out.push(0xF0 | ((cc & 0x7) >> 2), 0x80 | ((cc >> 4) & 0x3F), 0x80 | ((cc >> 10) & 0x3F));
        out.push(0x80 | ((c2 & 0x7) >> 2), 0x80 | ((c2 >> 4) & 0x3F), 0x80 | (c2 & 0x3F));
        i++;
      } else out.push(0xE0 | (cc >> 12), 0x80 | ((cc >> 6) & 0x3F), 0x80 | (cc & 0x3F));
    }
    return new Uint8Array(out);
  }

  /* ─── ZIP (store) ─── */
  function zip(files) {
    var parts = [], central = [], offset = 0;
    var d = new Date();
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    for (var i = 0; i < files.length; i++) {
      var name = utf8(files[i].name), data = files[i].data;
      var crc = crc32(data);
      var lh = [].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0), u16(0),
        u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0));
      parts.push(new Uint8Array(lh), name, data);
      var ch = [].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0),
        u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
      central.push(new Uint8Array(ch), name);
      offset += lh.length + name.length + data.length;
    }
    var cdSize = 0, i2;
    for (i2 = 0; i2 < central.length; i2++) cdSize += central[i2].length;
    var end = [].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length),
      u32(cdSize), u32(offset), u16(0));
    return new Blob(parts.concat(central, [new Uint8Array(end)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function colName(n) {
    var s = '';
    n++;
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  /* ─── styles: 0 عادي · 1 عنوان · 2 نص · 3 رقم · 4 كاشف · 5 تلت ─── */
  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="4">' +
      '<font><sz val="11"/><name val="Arial"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
      '<font><sz val="10"/><color rgb="FF1B2733"/><name val="Arial"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF0B1F33"/><name val="Arial"/></font>' +
      '</fonts>' +
      '<fills count="4">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF132C47"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F7FA"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFD6DEE8"/></left><right style="thin"><color rgb="FFD6DEE8"/></right>' +
      '<top style="thin"><color rgb="FFD6DEE8"/></top><bottom style="thin"><color rgb="FFD6DEE8"/></bottom><diagonal/></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6">' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  /* sheet: {name, cols:[{w}], rows:[[{v,s}]] , freeze:{r,c}} */
  function sheetXml(sh) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    x += '<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>';
    x += '<sheetViews><sheetView rightToLeft="1" workbookViewId="0" tabSelected="' + (sh.sel ? 1 : 0) + '">';
    if (sh.freeze) {
      var top = sh.freeze.r, left = sh.freeze.c;
      x += '<pane' + (top ? ' ySplit="' + top + '"' : '') + (left ? ' xSplit="' + left + '"' : '') +
        ' topLeftCell="' + colName(left) + (top + 1) + '" activePane="bottomRight" state="frozen"/>' +
        '<selection pane="bottomRight" activeCell="' + colName(left) + (top + 1) + '" sqref="' + colName(left) + (top + 1) + '"/>';
    }
    x += '</sheetView></sheetViews>';
    x += '<sheetFormatPr defaultRowHeight="15"/>';
    if (sh.cols && sh.cols.length) {
      x += '<cols>';
      for (var i = 0; i < sh.cols.length; i++)
        x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (sh.cols[i].w || 12) + '" customWidth="1"/>';
      x += '</cols>';
    }
    x += '<sheetData>';
    for (var r = 0; r < sh.rows.length; r++) {
      var row = sh.rows[r];
      x += '<row r="' + (r + 1) + '"' + (sh.headerRow === r ? ' ht="28" customHeight="1"' : '') + '>';
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (cell == null) continue;
        var v = (typeof cell === 'object') ? cell.v : cell;
        var st = (typeof cell === 'object' && cell.s != null) ? cell.s : 0;
        var ref = colName(c) + (r + 1);
        if (typeof v === 'number' && isFinite(v)) {
          x += '<c r="' + ref + '" s="' + st + '"><v>' + v + '</v></c>';
        } else {
          x += '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
        }
      }
      x += '</row>';
    }
    x += '</sheetData>';
    if (sh.autoFilter) x += '<autoFilter ref="' + sh.autoFilter + '"/>';
    x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
    x += '</worksheet>';
    return x;
  }

  function build(sheets, sheetNames) {
    var files = [];
    files.push({
      name: '[Content_Types].xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (s, i) {
          return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>')
    });
    files.push({
      name: '_rels/.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>')
    });
    files.push({
      name: 'xl/workbook.xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) {
          return '<sheet name="' + esc(sheetNames[i]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
        }).join('') +
        '</sheets></workbook>')
    });
    files.push({
      name: 'xl/_rels/workbook.xml.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>')
    });
    files.push({ name: 'xl/styles.xml', data: utf8(stylesXml()) });
    sheets.forEach(function (s, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(sheetXml(s)) });
    });
    return zip(files);
  }

  g.OCTA_XLSX = { build: build, sheetXml: sheetXml };
})(window);

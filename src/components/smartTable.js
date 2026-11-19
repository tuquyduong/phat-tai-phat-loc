// ============================================
// BẢNG THÔNG MINH cho Ghi chú — kiểu Excel, gọn cho điện thoại
//  • Hàng ∑ cuối bảng tự tính từng cột: Tổng / Trung bình / Đếm / Lớn nhất / Nhỏ nhất
//  • Cột công thức: Cột này = Cột A × Cột B (hoặc + − ÷), tự tính lại mỗi khi sửa số
//  • Hiểu số kiểu Việt: 12tr · 10,5tr · 500k · 1.200.000 · 2 tỷ · 1,5 triệu
// Cấu hình nằm trên bảng (attrs) nên được lưu cùng ghi chú, chia sẻ và sao lưu như chữ thường.
// ============================================
import { Extension } from '@tiptap/react'
import { Plugin, PluginKey, EditorState, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'

export const AGG = { sum: 'Tổng', avg: 'Trung bình', count: 'Đếm', max: 'Lớn nhất', min: 'Nhỏ nhất', none: 'Không tính' }
export const OPS = { '*': '×', '+': '+', '-': '−', '/': '÷' }
export const colName = i => String.fromCharCode(65 + i)            // 0 → A

// ---- Đọc số kiểu Việt Nam ----
const UNIT = [[/^(t[ỷy]|ty)$/, 1e9], [/^(tr|tri[ệe]u|m)$/, 1e6], [/^(k|ng[hà]n|ngh[ìi]n)$/, 1e3], [/^(đ|d|vnd|vnđ)?$/, 1]]
export function parseNum(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/^∑\s*/, '')
  if (!s) return null
  const m = s.match(/^([+-]?[\d.,\s]+)\s*([a-zđỷệìà]*)\.?$/i)
  if (!m) return null
  let n = m[1].replace(/\s/g, '')
  const u = UNIT.find(([re]) => re.test(m[2]))
  if (!u) return null
  // "1.200.000" = nghìn; "10,5" = thập phân; "1,200,000" = nghìn
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) n = n.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3}){2,}$/.test(n)) n = n.replace(/,/g, '')
  else n = n.replace(',', '.')
  const v = Number(n)
  return Number.isFinite(v) ? v * u[1] : null
}
// Ghi số theo kiểu đa số ô trong cột đang dùng (tr / k / đầy đủ)
export function fmtNum(v, style) {
  if (v === null || !Number.isFinite(v)) return ''
  const r = (x, d) => Number(x.toFixed(d)).toLocaleString('vi-VN')
  if (style === 'ty' && Math.abs(v) >= 1e8) return r(v / 1e9, 2) + ' tỷ'
  if ((style === 'tr' || style === 'ty') && Math.abs(v) >= 1e5) return r(v / 1e6, 2) + 'tr'
  if (style === 'k' && Math.abs(v) >= 1e2) return r(v / 1e3, 1) + 'k'
  return r(v, Math.abs(v) < 100 && v % 1 ? 2 : 0)
}
// Kết quả tính ra ghi đầy đủ có dấu chấm (1.745.000); chỉ khi đa số ô số trong cột ghi kiểu "tr"/"tỷ" mới ghi kiểu tr
const styleOf = texts => {
  let tr = 0, all = 0
  texts.forEach(t => { const s = String(t).toLowerCase(); if (parseNum(s) === null) return; all++; if (/t[ỷy]|tr|tri/.test(s)) tr++ })
  return all && tr * 2 > all ? 'tr' : 'full'
}
function agg(fn, nums) {
  const v = nums.filter(x => x !== null)
  if (fn === 'none') return null
  if (fn === 'count') return v.length
  if (!v.length) return null
  if (fn === 'sum') return v.reduce((a, b) => a + b, 0)
  if (fn === 'avg') return v.reduce((a, b) => a + b, 0) / v.length
  if (fn === 'max') return Math.max(...v)
  if (fn === 'min') return Math.min(...v)
  return null
}

// ---- Bảng: thêm cấu hình ∑ và công thức cột ----
export const SmartTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      totals: { default: false, parseHTML: el => el.getAttribute('data-totals') === '1', renderHTML: a => a.totals ? { 'data-totals': '1' } : {} },
      agg: { default: {}, parseHTML: el => { try { return JSON.parse(el.getAttribute('data-agg') || '{}') } catch { return {} } }, renderHTML: a => Object.keys(a.agg || {}).length ? { 'data-agg': JSON.stringify(a.agg) } : {} },
      calc: { default: {}, parseHTML: el => { try { return JSON.parse(el.getAttribute('data-calc') || '{}') } catch { return {} } }, renderHTML: a => Object.keys(a.calc || {}).length ? { 'data-calc': JSON.stringify(a.calc) } : {} },
    }
  },
})
export const SmartRow = TableRow.extend({
  addAttributes() {
    return { ...this.parent?.(), sum: { default: false, parseHTML: el => el.getAttribute('data-sum') === '1', renderHTML: a => a.sum ? { 'data-sum': '1' } : {} } }
  },
})

// Đặt chữ cho một ô (giữ nguyên nếu đã đúng)
function setCellText(tr, schema, cellPos, cell, text) {
  if (cell.textContent === text) return
  const para = schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
  tr.replaceWith(tr.mapping.map(cellPos + 1), tr.mapping.map(cellPos + cell.nodeSize - 1), para)
}

// Tính lại mọi bảng có ∑ hoặc cột công thức
function recompute(state) {
  const { schema } = state
  let tr = null
  state.doc.descendants((table, tpos) => {
    if (table.type.name !== 'table') return
    const { totals, agg: aggCfg = {}, calc = {} } = table.attrs
    let hasSum = false; table.forEach(r => { if (r.attrs.sum) hasSum = true })
    if (!totals && !Object.keys(calc).length && !hasSum) return false   // tắt ∑ thì vẫn phải dọn hàng ∑ cũ
    tr = tr || state.tr
    const rows = []; table.forEach((row, off) => rows.push({ row, pos: tpos + 1 + off }))
    const nCols = rows[0]?.row.childCount || 0
    const isHead = r => r.row.firstChild?.type.name === 'tableHeader'
    let body = rows.filter(r => !r.row.attrs.sum && !isHead(r))
    // 1) Cột công thức: Cột = A op B cho từng hàng
    Object.entries(calc).forEach(([ci, f]) => {
      const c = +ci; if (c >= nCols) return
      const colTexts = i => body.map(r => r.row.childCount > i ? r.row.child(i).textContent : '')
      const st = f.op === '*' || f.op === '/' ? 'full' : styleOf([...colTexts(f.a), ...colTexts(f.b)])
      body.forEach(r => {
        let cellPos = r.pos + 1, k = 0, cell = null, a = null, b = null, texts = []
        r.row.forEach((cl, o) => { const t = cl.textContent; texts.push(t); if (k === c) { cell = cl; cellPos = r.pos + 1 + o }; k++ })
        a = parseNum(texts[f.a]); b = parseNum(texts[f.b])
        let v = null
        if (a !== null && b !== null) v = f.op === '*' ? a * b : f.op === '+' ? a + b : f.op === '-' ? a - b : b ? a / b : null
        if (cell) setCellText(tr, schema, cellPos, cell, v === null ? '' : fmtNum(v, st))
      })
    })
    // 2) Hàng ∑
    let sumRow = rows.find(r => r.row.attrs.sum)
    if (totals && sumRow && sumRow !== rows[rows.length - 1]) {
      tr.delete(tr.mapping.map(sumRow.pos), tr.mapping.map(sumRow.pos + sumRow.row.nodeSize)); sumRow = null
    }
    if (totals && !sumRow) {
      const cells = Array.from({ length: nCols }, () => schema.nodes.tableCell.create(null, schema.nodes.paragraph.create()))
      tr.insert(tr.mapping.map(tpos + table.nodeSize - 1), schema.nodes.tableRow.create({ sum: true }, cells))
    } else if (!totals && sumRow) {
      tr.delete(tr.mapping.map(sumRow.pos), tr.mapping.map(sumRow.pos + sumRow.row.nodeSize))
    }
    return false
  })
  return tr
}

// Sau khi ghi giá trị công thức, bảng đã đổi → điền hàng ∑ lần nữa trên bản mới nhất
function fillTotals(state) {
  const { schema } = state
  let tr = null
  state.doc.descendants((table, tpos) => {
    if (table.type.name !== 'table' || !table.attrs.totals) return table.type.name === 'table' ? false : undefined
    const cfg = table.attrs.agg || {}
    const rows = []; table.forEach((row, off) => rows.push({ row, pos: tpos + 1 + off }))
    const sum = rows.find(r => r.row.attrs.sum); if (!sum) return false
    const body = rows.filter(r => !r.row.attrs.sum && r.row.firstChild?.type.name !== 'tableHeader')
    sum.row.forEach((cell, off, ci) => {
      const texts = body.map(r => r.row.childCount > ci ? r.row.child(ci).textContent : '')
      const nums = texts.map(parseNum)
      const fn = cfg[ci] || (ci === 0 ? 'label' : nums.some(x => x !== null) ? 'sum' : 'none')
      let text = ''
      if (fn === 'label') text = '∑ Tổng'
      else { const v = agg(fn, nums); text = v === null ? '' : (fn === 'count' ? v + ' mục' : fmtNum(fn === 'avg' ? Math.round(v) : v, styleOf(texts))) }
      tr = tr || state.tr
      setCellText(tr, schema, sum.pos + 1 + off, cell, text)
    })
    return false
  })
  return tr && tr.docChanged ? tr : null
}

// Một lượt tính đầy đủ: công thức cột → hàng ∑ (tính trên bản nháp riêng để không chạy lồng plugin)
function fullPass(state) {
  const t1 = recompute(state)
  const s1 = t1 && t1.docChanged ? EditorState.create({ schema: state.schema, doc: t1.doc }) : state
  const t2 = fillTotals(s1)
  if (!t1?.docChanged && !t2) return null
  const tr = t1 && t1.docChanged ? t1 : state.tr
  if (t2) t2.steps.forEach(st => tr.step(st))
  return tr.setMeta('smartCalc', true).setMeta('addToHistory', false)   // không vào lịch sử hoàn tác
}

// Thêm hàng cuối (trước hàng ∑) / thêm cột cuối cho bảng ở vị trí tpos — dùng cho nút dưới bảng
function appendRow(view, tpos) {
  const { state } = view, table = state.doc.nodeAt(tpos); if (!table) return
  const { schema } = state
  let at = tpos + table.nodeSize - 1, ref = table.lastChild
  if (ref?.attrs.sum) { at -= ref.nodeSize; ref = table.childCount > 1 ? table.child(table.childCount - 2) : ref }
  const cells = []; ref.forEach(c => cells.push(schema.nodes.tableCell.create({ colwidth: c.attrs.colwidth }, schema.nodes.paragraph.create())))
  const tr = state.tr.insert(at, schema.nodes.tableRow.create(null, cells))
  view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(at + 3))).scrollIntoView()); view.focus()
}
function appendCol(view, tpos) {
  const { state } = view, table = state.doc.nodeAt(tpos); if (!table) return
  const { schema } = state, tr = state.tr
  let rp = tpos + 1, firstCell = null
  table.forEach(row => {
    const end = rp + row.nodeSize - 1
    const head = row.firstChild?.type.name === 'tableHeader'
    const cell = (head ? schema.nodes.tableHeader : schema.nodes.tableCell).create(null, schema.nodes.paragraph.create())
    tr.insert(tr.mapping.map(end), cell)
    if (firstCell === null) firstCell = tr.mapping.map(end) - cell.nodeSize
    rp += row.nodeSize
  })
  view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(firstCell + 2))).scrollIntoView()); view.focus()
}
function toggleTotals(view, tpos) {
  const table = view.state.doc.nodeAt(tpos); if (!table) return
  view.dispatch(view.state.tr.setNodeMarkup(tpos, undefined, { ...table.attrs, totals: !table.attrs.totals }))
}
function tableButtons(view, getPos, totals) {
  const box = document.createElement('div')
  box.className = 'tbl-add'; box.contentEditable = 'false'
  const mk = (label, fn, on) => {
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = label
    if (on) b.className = 'on'
    const run = e => { e.preventDefault(); e.stopPropagation(); const p = getPos(); if (p !== undefined) fn(view, p) }
    b.addEventListener('mousedown', e => e.preventDefault())
    b.addEventListener('click', run)
    box.appendChild(b); return b
  }
  mk('＋ Hàng', appendRow); mk('＋ Cột', appendCol); mk(totals ? '∑ Đang tính tổng' : '∑ Tính tổng', toggleTotals, totals)
  return box
}

function decos(state, editable) {
  const out = []
  state.doc.descendants((table, tpos) => {
    if (table.type.name !== 'table') return
    const calc = table.attrs.calc || {}
    const body = []; table.forEach(r => { if (!r.attrs.sum && r.firstChild?.type.name !== 'tableHeader') body.push(r) })
    const n = table.firstChild?.childCount || 0
    const numCol = Array.from({ length: n }, (_, c) => {
      const t = body.map(r => r.childCount > c ? r.child(c).textContent.trim() : '').filter(Boolean)
      return calc[c] || (t.length && t.filter(x => parseNum(x) !== null).length * 2 >= t.length)
    })
    if (editable) {
      const after = tpos + table.nodeSize, totals = !!table.attrs.totals
      out.push(Decoration.widget(after, view => tableButtons(view, () => tpos, totals),
        { side: -1, key: 'tb-' + tpos + '-' + totals, stopEvent: () => true, ignoreSelection: true }))
    }
    let rp = tpos + 1
    table.forEach(row => {
      let cp = rp + 1, k = 0
      row.forEach(cell => {
        const cls = [numCol[k] && 'num', calc[k] && !row.attrs.sum && cell.type.name !== 'tableHeader' && 'calc'].filter(Boolean).join(' ')
        const wd = table.firstChild?.childCount > k ? table.firstChild.child(k).attrs.colwidth?.[0] : null   // độ rộng theo ô tiêu đề
        const at = { ...(cls ? { class: cls } : {}), ...(wd ? { style: `width:${wd}px;min-width:${wd}px;max-width:${wd}px` } : {}) }
        if (cls || wd) out.push(Decoration.node(cp, cp + cell.nodeSize, at))
        cp += cell.nodeSize; k++
      })
      rp += row.nodeSize
    })
    return false
  })
  return DecorationSet.create(state.doc, out)
}

export const SmartCalc = Extension.create({
  name: 'smartCalc',
  // Mở ghi chú có sẵn bảng → tính ngay (không chờ sửa chữ)
  onCreate() { const tr = fullPass(this.editor.state); if (tr) this.editor.view.dispatch(tr) },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('smartCalc'),
      editor: this.editor,
      appendTransaction(trs, _o, state) {
        if (!trs.some(t => t.docChanged) || trs.some(t => t.getMeta('smartCalc'))) return null
        return fullPass(state)
      },
      props: { decorations(state) { return decos(state, this.spec.editor?.isEditable ?? true) } },
    })]
  },
})

// ---- Lệnh tiện dụng cho thanh công cụ ----
export function tableInfo(editor) {
  const { $from } = editor.state.selection
  let tableDepth = -1, col = -1
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d)
    if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && col < 0) col = $from.index(d - 1)
    if (n.type.name === 'table') { tableDepth = d; break }
  }
  if (tableDepth < 0) return null
  const table = $from.node(tableDepth), pos = $from.before(tableDepth)
  const head = []; table.firstChild?.forEach(c => head.push(c.textContent.trim()))
  return { table, pos, col, head, attrs: table.attrs }
}
export function setTableAttrs(editor, patch) {
  const info = tableInfo(editor); if (!info) return
  editor.chain().command(({ tr }) => { tr.setNodeMarkup(info.pos, undefined, { ...info.attrs, ...patch }); return true }).run()
}

// ============ TUỲ CHỈNH HÀNG / CỘT ============
// Cấu hình ∑ và công thức gắn theo SỐ THỨ TỰ cột → khi chèn / xoá / đổi chỗ cột phải dời theo.
function remapCols(attrs, map) {            // map: chỉ số cũ → chỉ số mới (null = cột bị xoá)
  const agg = {}, calc = {}
  Object.entries(attrs.agg || {}).forEach(([k, v]) => { const n = map(+k); if (n !== null) agg[n] = v })
  Object.entries(attrs.calc || {}).forEach(([k, f]) => {
    const n = map(+k), a = map(f.a), b = map(f.b)
    if (n !== null && a !== null && b !== null) calc[n] = { ...f, a, b }
  })
  return { ...attrs, agg, calc }
}
const runCmd = (editor, name) => editor.chain().focus()[name]().run()

// Thêm/xoá cột và dời cấu hình trong CÙNG một giao dịch — để công thức không kịp chạy trên cột đã lệch
const withAttrs = (ti, attrs) => ({ tr }) => { const n = tr.doc.nodeAt(ti.pos); if (n?.type.name === 'table') tr.setNodeMarkup(ti.pos, undefined, { ...n.attrs, ...attrs }); return true }
export function addCol(editor, side) {       // side: 'left' | 'right'
  const ti = tableInfo(editor); if (!ti || ti.col < 0) return
  const at = side === 'left' ? ti.col : ti.col + 1
  editor.chain().focus()[side === 'left' ? 'addColumnBefore' : 'addColumnAfter']().command(withAttrs(ti, remapCols(ti.attrs, i => i >= at ? i + 1 : i))).run()
}
export function delCol(editor) {
  const ti = tableInfo(editor); if (!ti || ti.col < 0) return
  const c = ti.col
  if ((ti.table.firstChild?.childCount || 0) <= 1) { runCmd(editor, 'deleteTable'); return }
  editor.chain().focus().deleteColumn().command(withAttrs(ti, remapCols(ti.attrs, i => i === c ? null : i > c ? i - 1 : i))).run()
}
export function addRow(editor, side) {       // side: 'above' | 'below'
  const ti = tableInfo(editor); if (!ti) return
  const { $from } = editor.state.selection
  let rowIdx = -1
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'tableRow') { rowIdx = $from.index(d - 1); break }
  const row = ti.table.child(rowIdx)
  const isHead = row.firstChild?.type.name === 'tableHeader'
  if (row.attrs.sum && side === 'below') side = 'above'           // không thêm dưới hàng ∑
  if (isHead && side === 'above') side = 'below'                  // không thêm trên hàng tiêu đề
  runCmd(editor, side === 'above' ? 'addRowBefore' : 'addRowAfter')
  // hàng mới thêm dưới tiêu đề phải là hàng thường
  const t2 = tableInfo(editor); if (!t2) return
  const newIdx = side === 'above' ? rowIdx : rowIdx + 1
  const nr = t2.table.child(newIdx)
  if (nr && (nr.attrs.sum || nr.firstChild?.type.name === 'tableHeader')) {
    const { schema } = editor.state
    const cells = []; nr.forEach(c => cells.push(schema.nodes.tableCell.create({ colwidth: c.attrs.colwidth }, schema.nodes.paragraph.create())))
    let pos = t2.pos + 1; for (let i = 0; i < newIdx; i++) pos += t2.table.child(i).nodeSize
    editor.chain().command(({ tr }) => { tr.replaceWith(pos, pos + nr.nodeSize, schema.nodes.tableRow.create(null, cells)); return true }).run()
  }
}
export function delRow(editor) {
  const ti = tableInfo(editor); if (!ti) return
  const body = []; ti.table.forEach(r => { if (!r.attrs.sum && r.firstChild?.type.name !== 'tableHeader') body.push(r) })
  if (body.length <= 1) return 'last'
  runCmd(editor, 'deleteRow')
}
// Dựng lại cả bảng (đổi chỗ hàng / cột) rồi thay vào chỗ cũ
function rebuild(editor, fn) {
  const ti = tableInfo(editor); if (!ti) return
  const rows = []; ti.table.forEach(r => { const cells = []; r.forEach(c => cells.push(c)); rows.push({ attrs: r.attrs, cells }) })
  const out = fn(rows, ti); if (!out) return
  const { schema } = editor.state
  const table = schema.nodes.table.create(out.attrs || ti.attrs, out.rows.map(r => schema.nodes.tableRow.create(r.attrs, r.cells)))
  const sel = out.sel
  editor.chain().command(({ tr }) => {
    tr.replaceWith(ti.pos, ti.pos + ti.table.nodeSize, table)
    if (sel) { let p = ti.pos + 1; for (let i = 0; i < sel.row; i++) p += table.child(i).nodeSize
      const row = table.child(sel.row); p += 1; for (let j = 0; j < sel.col; j++) p += row.child(j).nodeSize
      tr.setSelection(editor.state.selection.constructor.near(tr.doc.resolve(p + 2))) }
    return true
  }).focus().run()
}
export function moveRow(editor, dir) {       // dir: -1 lên · +1 xuống
  rebuild(editor, (rows, ti) => {
    const { $from } = editor.state.selection
    let i = -1; for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'tableRow') { i = $from.index(d - 1); break }
    const j = i + dir, fixed = r => r.attrs.sum || r.cells[0]?.type.name === 'tableHeader'
    if (i < 0 || j < 0 || j >= rows.length || fixed(rows[i]) || fixed(rows[j])) return null
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
    return { rows, sel: { row: j, col: Math.max(0, ti.col) } }
  })
}
export function moveCol(editor, dir) {       // dir: -1 trái · +1 phải
  rebuild(editor, (rows, ti) => {
    const i = ti.col, j = i + dir, n = rows[0]?.cells.length || 0
    if (i < 0 || j < 0 || j >= n) return null
    rows.forEach(r => { [r.cells[i], r.cells[j]] = [r.cells[j], r.cells[i]] })
    return { rows, attrs: remapCols(ti.attrs, k => k === i ? j : k === j ? i : k), sel: { row: 0, col: j } }
  })
}
export const WIDTHS = [['Hẹp', 70], ['Vừa', 110], ['Rộng', 170], ['Tự động', null]]
export function setColWidth(editor, w) {
  const ti = tableInfo(editor); if (!ti || ti.col < 0) return
  editor.chain().command(({ tr }) => {
    let rp = ti.pos + 1
    ti.table.forEach(row => {
      let cp = rp + 1, k = 0
      row.forEach(cell => { if (k === ti.col) tr.setNodeMarkup(cp, undefined, { ...cell.attrs, colwidth: w ? [w] : null }); cp += cell.nodeSize; k++ })
      rp += row.nodeSize
    })
    return true
  }).run()
}

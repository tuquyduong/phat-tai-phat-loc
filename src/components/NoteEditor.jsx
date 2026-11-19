// ============================================
// TRÌNH SOẠN GHI CHÚ (TipTap) — tải riêng khi mở Ghi chú
// Một thanh công cụ duy nhất bám mép trên bàn phím, đổi theo ngữ cảnh:
//   đang gõ   → Aa · • · 1. · ☑ · 🔑 · ↶ · ↷ (· ⏰ khi đứng ở dòng checklist)
//   bôi đen   → B · I · U · S · tô nền · màu chữ · ⌫
// Máy không báo chiều cao bàn phím → thanh tự lên trên cùng (không bao giờ bị che).
// Nói bằng nút 🎤 trên bàn phím iPhone (không có nút riêng).
// ============================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { SmartTable, SmartRow, SmartCalc, AGG, OPS, colName, tableInfo, setTableAttrs, addCol, delCol, addRow, delRow, moveRow, moveCol, setColWidth, WIDTHS } from './smartTable'
import Image from '@tiptap/extension-image'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'

const COLORS = [['Mặc định', null], ['Đỏ', '#dc2626'], ['Xanh', '#2563eb'], ['Lục', '#059669'], ['Cam', '#d97706'], ['Tím', '#7c3aed']]
const MARKS = [['#fde68a', 'Vàng'], ['#bbf7d0', 'Xanh'], ['#fbcfe8', 'Hồng']]
const cellP = t => ({ type: 'paragraph', ...(t ? { content: [{ type: 'text', text: t }] } : {}) })
const mkTable = (head, rows, attrs = {}) => ({ type: 'table', attrs, content: [
  { type: 'tableRow', content: head.map(h => ({ type: 'tableHeader', content: [cellP(h)] })) },
  ...rows.map(r => ({ type: 'tableRow', content: r.map(t => ({ type: 'tableCell', content: [cellP(t)] })) })),
] })
const TEMPLATES = [
  ['🧾 Chi tiêu · tự nhân & cộng', () => mkTable(['Mục', 'SL', 'Đơn giá', 'Thành tiền'], [['', '', '', ''], ['', '', '', ''], ['', '', '', '']],
    { totals: true, agg: { 1: 'sum', 2: 'none', 3: 'sum' }, calc: { 3: { a: 1, op: '*', b: 2 } } })],
  ['⚖️ So sánh báo giá', () => mkTable(['Hạng mục', 'Bên A', 'Bên B', 'Bên C'], [['', '', '', ''], ['', '', '', '']], { totals: true })],
  ['▦ Bảng trống 3×3', () => mkTable(['', '', ''], [['', '', ''], ['', '', '']])],
]
const SIZES = [['Nhỏ', '14px'], ['Vừa', null], ['Lớn', '21px'], ['Rất lớn', '27px']]

// Cỡ chữ cho đoạn bôi đen (4 cỡ cố định cho gọn)
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: { fontSize: {
      default: null, parseHTML: el => el.style.fontSize || null,
      renderHTML: a => a.fontSize ? { style: `font-size:${a.fontSize}` } : {} } } }]
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

// Dòng checklist nhớ AI đã tick (attr "by"): tick → by = người đang dùng, bỏ tick → xoá
const TaskBy = TaskItem.extend({
  addAttributes() {
    return { ...this.parent?.(), by: { default: null, parseHTML: el => el.getAttribute('data-by'), renderHTML: a => a.by ? { 'data-by': a.by } : {} } }
  },
})
const stampTicks = me => Extension.create({
  name: 'stampTicks',
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(trs, oldState, newState) {
        if (!trs.some(t => t.docChanged)) return null
        let tr = null
        newState.doc.descendants((node, pos) => {
          if (node.type.name !== 'taskItem') return
          const want = node.attrs.checked ? (node.attrs.by || me) : null
          if (node.attrs.by !== want) { tr = tr || newState.tr; tr.setNodeMarkup(pos, undefined, { ...node.attrs, by: want }) }
        })
        return tr
      },
    })]
  },
})

// Vị trí thanh công cụ, tính theo PHẦN MÀN HÌNH ĐANG NHÌN THẤY (visualViewport).
// iPhone: khi bàn phím mở và kéo xuống cuối ghi chú, vùng nhìn thấy trượt xuống trong trang —
// thanh phải bám theo đáy vùng đó (ngay trên bàn phím), không bám theo đầu/đáy trang.
// Chỉ khi máy không báo được bàn phím (vùng nhìn thấy gần bằng cả trang) mới đưa thanh lên đầu vùng nhìn thấy.
export function barPlace({ innerH, vvH, vvTop, focused, touch, topOffset }) {
  const bottom = Math.max(0, Math.round(innerH - vvH - vvTop))     // khoảng từ đáy trang lên đáy vùng nhìn thấy
  const noKb = focused && touch && vvH > innerH * 0.85              // đang gõ mà vùng nhìn thấy không bị bàn phím thu nhỏ
  return noKb ? { top: true, y: Math.max(topOffset, Math.round(vvTop)) } : { top: false, y: bottom }
}
function useBarPlace(focused, topOffset) {
  const [st, setSt] = useState({ top: false, y: 0 })
  useEffect(() => {
    const vv = window.visualViewport, touch = 'ontouchstart' in window
    const f = () => setSt(barPlace({ innerH: window.innerHeight, vvH: vv ? vv.height : window.innerHeight, vvTop: vv ? vv.offsetTop : 0, focused, touch, topOffset }))
    f(); const t = setTimeout(f, 700)
    vv?.addEventListener('resize', f); vv?.addEventListener('scroll', f); window.addEventListener('scroll', f, { passive: true })
    return () => { clearTimeout(t); vv?.removeEventListener('resize', f); vv?.removeEventListener('scroll', f); window.removeEventListener('scroll', f) }
  }, [focused, topOffset])
  return st
}

export function shrinkImage(file, max = 1024) {
  return new Promise((ok, fail) => {
    const img = new window.Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k)
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url)
      cv.toBlob(b => b ? ok(b) : fail(new Error('Không đọc được ảnh')), 'image/jpeg', 0.72)
    }
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('Không đọc được ảnh')) }
    img.src = url
  })
}
const blobToData = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b) })

// Công thức cột: Cột hiện tại = Cột A (× + − ÷) Cột B
function FxPick({ ti, colLabel, onApply }) {
  const cur = (ti.attrs.calc || {})[ti.col]
  const n = ti.table.firstChild?.childCount || 0
  const others = Array.from({ length: n }, (_, i) => i).filter(i => i !== ti.col)
  const [f, setF] = useState(cur || { a: others[0] ?? 0, op: '*', b: others[1] ?? others[0] ?? 0 })
  const sel = 'px-2 py-2 rounded-lg bg-gray-100 text-[14px] max-w-[38%]'
  return <div className="w-full">
    <p className="text-xs text-gray-500 mb-1.5 text-center">{colLabel(ti.col)} = </p>
    <div className="flex items-center justify-center gap-1.5">
      <select className={sel} value={f.a} onChange={e => setF({ ...f, a: +e.target.value })}>{others.map(i => <option key={i} value={i}>{colLabel(i)}</option>)}</select>
      <select className="px-2 py-2 rounded-lg bg-gray-100 text-[16px]" value={f.op} onChange={e => setF({ ...f, op: e.target.value })}>{Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select className={sel} value={f.b} onChange={e => setF({ ...f, b: +e.target.value })}>{others.map(i => <option key={i} value={i}>{colLabel(i)}</option>)}</select>
    </div>
    <div className="flex gap-1.5 mt-2">
      <button type="button" className="nb sm flex-1 !bg-purple-600 !text-white" onClick={() => onApply(f)}>Áp dụng</button>
      {cur && <button type="button" className="nb sm" onClick={() => onApply(null)}>Bỏ công thức</button>}
    </div>
  </div>
}

export default function NoteEditor({ doc, editable, me, names, autoFocus, onChange, onSecret, onMakeTask, onUploadImage, onReady, topOffset = 52 }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)
  const barTouch = useRef(0)
  const [pal, setPal] = useState(null)
  const [, setTick] = useState(0)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const force = () => { if (alive.current) setTick(x => x + 1) }
  const ext = useMemo(() => [
    StarterKit, Underline, Highlight.configure({ multicolor: true }), TextStyle, Color, FontSize,
    SmartTable.configure({ resizable: false }), SmartRow, TableHeader, TableCell, SmartCalc,
    Image.configure({ inline: false, allowBase64: true }),
    TaskList, TaskBy.configure({ nested: true, onReadOnlyChecked: () => false }), stampTicks(me),
    Placeholder.configure({ placeholder: 'Tiêu đề… rồi xuống dòng viết nội dung. Muốn nói: chạm 🎤 trên bàn phím' }),
    Link.configure({ autolink: true, linkOnPaste: true, openOnClick: !editable }),
  ], [me, editable])
  const cb = useRef(onChange); cb.current = onChange
  const editor = useEditor({
    extensions: ext, content: doc, editable,
    onUpdate: ({ editor }) => cb.current?.(editor.getJSON()),
    onSelectionUpdate: ({ editor }) => { force(); if (alive.current) { setPal(null); if (editor.view.hasFocus()) setFocused(true) } },
    onTransaction: () => force(),
    onFocus: () => { if (alive.current) setFocused(true) },
    // Rời ô soạn: ẩn thanh — trừ khi vừa chạm vào chính thanh công cụ (iPhone có thể rời ô khi chạm nút)
    onBlur: () => setTimeout(() => { if (alive.current && Date.now() - barTouch.current > 600) setFocused(!!document.activeElement?.closest?.('.ProseMirror, .note-bar')) }, 200),
  }, [ext])
  // Ghi chú mới: đặt con trỏ ngay trong lần chạm để bàn phím bật lên
  useLayoutEffect(() => { if (editor && autoFocus && editable) editor.commands.focus('end') }, [editor])
  useEffect(() => { if (editor && onReady) setTimeout(() => onReady(editor.getJSON()), 0) }, [editor])   // eslint-disable-line react-hooks/exhaustive-deps
  const { top, y } = useBarPlace(focused, topOffset)

  // Tên người tick hiện cạnh dòng checklist (người xem thấy "Bạn", con thấy "Bố Linh")
  const tickCss = useMemo(() => Object.entries(names).map(([k, n]) =>
    `.note-ed li[data-checked="true"][data-by="${k}"]>div::after{content:"✓ ${n}"}`).join('\n'), [names])

  if (!editor) return null
  const pickImage = async e => {
    const files = [...(e.target.files || [])]; e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      for (const f of files) {
        const small = await shrinkImage(f)
        const src = onUploadImage ? await onUploadImage(small) : await blobToData(small)
        editor.chain().focus().setImage({ src }).run()
      }
    } catch (err) { alert('Chưa thêm được ảnh: ' + err.message) }
    setBusy(false)
  }
  const c = () => editor.chain().focus()
  const on = (n, a) => editor.isActive(n, a) ? ' on' : ''
  const sel = !editor.state.selection.empty
  const inTask = editor.isActive('taskItem')
  const inTable = editor.isActive('table')
  const ti = inTable ? tableInfo(editor) : null
  const colLabel = i => (ti?.head?.[i] ? `${colName(i)} · ${ti.head[i]}` : 'Cột ' + colName(i))
  const curSize = editor.getAttributes('textStyle').fontSize || null
  const B = (label, fn, active, aria) => <button key={aria} type="button" className={'nb' + active} onMouseDown={e => e.preventDefault()} onClick={fn} aria-label={aria}>{label}</button>
  const taskText = () => { const { $from } = editor.state.selection; for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'taskItem') return $from.node(d).textContent.trim(); return '' }

  return <>
    <style>{tickCss}</style>
    {editable && top && (focused || pal) && <div style={{ height: pal ? 112 : 58 }} aria-hidden/>}
    <EditorContent editor={editor} className={'note-ed' + (editable ? '' : ' ro')}/>
    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickImage}/>
    {editable && (focused || pal) && <div className={'note-bar' + (top ? ' top' : '')} style={top ? { top: y } : { bottom: y }}
      onPointerDown={() => { barTouch.current = Date.now() }} onTouchStart={() => { barTouch.current = Date.now() }}>
      {pal && <div className="note-pal">
        {pal === 'hl' ? <>{MARKS.map(([col, n]) => <button key={col} type="button" className="nc" onMouseDown={e => e.preventDefault()} aria-label={'Tô ' + n}
            onClick={() => { c().toggleHighlight({ color: col }).run(); setPal(null) }} style={{ background: col, outline: editor.isActive('highlight', { color: col }) ? '3px solid #111' : 'none' }}/>)}
          <button type="button" className="nb sm" onMouseDown={e => e.preventDefault()} onClick={() => { c().unsetHighlight().run(); setPal(null) }}>Bỏ tô</button></>
        : pal === 'tbl' ? <div className="w-full flex flex-col gap-1.5">{TEMPLATES.map(([n, mk]) => (
            <button key={n} type="button" className="nb sm w-full text-left" onMouseDown={e => e.preventDefault()}
              onClick={() => { c().insertContent(mk()).run(); setPal(null) }}>{n}</button>))}</div>
        : pal === 'sum' && ti ? <div className="w-full">
            <p className="text-xs text-gray-500 mb-1.5 text-center">Hàng ∑ · {colLabel(ti.col)} tính:</p>
            <div className="flex flex-wrap gap-1.5 justify-center">{Object.entries(AGG).map(([k, n]) => (
              <button key={k} type="button" className={'nb sm' + ((ti.attrs.agg || {})[ti.col] === k ? ' on' : '')} onMouseDown={e => e.preventDefault()}
                onClick={() => { setTableAttrs(editor, { totals: true, agg: { ...(ti.attrs.agg || {}), [ti.col]: k } }); setPal(null) }}>{n}</button>))}
              <button type="button" className="nb sm" onMouseDown={e => e.preventDefault()} onClick={() => { setTableAttrs(editor, { totals: false }); setPal(null) }}>Tắt hàng ∑</button>
            </div></div>
        : pal === 'fx' && ti ? <FxPick ti={ti} colLabel={colLabel} onApply={f => { const calc = { ...(ti.attrs.calc || {}) }; if (f) calc[ti.col] = f; else delete calc[ti.col]; setTableAttrs(editor, { calc }); setPal(null) }}/>
        : pal === 'row' ? <><p className="ttl">Hàng đang chọn</p><div className="grp">
            {B('⬆️ Thêm hàng trên', () => { addRow(editor, 'above'); setPal(null) }, '', 'Thêm hàng trên')}
            {B('⬇️ Thêm hàng dưới', () => { addRow(editor, 'below'); setPal(null) }, '', 'Thêm hàng dưới')}
            {B('↑ Chuyển lên', () => moveRow(editor, -1), '', 'Chuyển hàng lên')}
            {B('↓ Chuyển xuống', () => moveRow(editor, 1), '', 'Chuyển hàng xuống')}
            {B('🗑 Xoá hàng', () => { if (delRow(editor) === 'last') alert('Bảng cần ít nhất 1 hàng — muốn bỏ hẳn thì bấm "Xoá cả bảng"'); setPal(null) }, '', 'Xoá hàng')}
            {B('🗑 Xoá cả bảng', () => { if (confirm('Xoá cả bảng?')) c().deleteTable().run(); setPal(null) }, '', 'Xoá bảng')}
          </div></>
        : pal === 'col' && ti ? <><p className="ttl">Cột đang chọn: <b>{colLabel(ti.col)}</b> · đổi tên: gõ thẳng vào ô tiêu đề</p><div className="grp">
            {B('⬅️ Thêm cột trái', () => { addCol(editor, 'left'); setPal(null) }, '', 'Thêm cột trái')}
            {B('➡️ Thêm cột phải', () => { addCol(editor, 'right'); setPal(null) }, '', 'Thêm cột phải')}
            {B('← Chuyển trái', () => moveCol(editor, -1), '', 'Chuyển cột trái')}
            {B('→ Chuyển phải', () => moveCol(editor, 1), '', 'Chuyển cột phải')}
          </div>
          <p className="ttl" style={{ marginTop: 6 }}>Độ rộng cột</p>
          <div className="flex gap-1.5 w-full">{WIDTHS.map(([n, w]) => {
            const cur = ti.table.firstChild?.child(ti.col)?.attrs.colwidth?.[0] || null
            return <button key={n} type="button" className={'nb sm flex-1' + (cur === w ? ' on' : '')} onMouseDown={e => e.preventDefault()} onClick={() => setColWidth(editor, w)}>{n}</button> })}</div>
          <div className="grp" style={{ marginTop: 6 }}>{B('🗑 Xoá cột', () => { delCol(editor); setPal(null) }, '', 'Xoá cột')}</div></>
        : pal === 'sz' ? SIZES.map(([n, v]) => <button key={n} type="button" className={'nb sm' + (curSize === v ? ' on' : '')} onMouseDown={e => e.preventDefault()}
            onClick={() => { v ? c().setFontSize(v).run() : c().unsetFontSize().run(); setPal(null) }} style={{ fontSize: v || '16px' }}>{n}</button>)
        : pal === 'co' ? COLORS.map(([n, col]) => <button key={n} type="button" className="nc" onMouseDown={e => e.preventDefault()} aria-label={'Màu ' + n}
            onClick={() => { col ? c().setColor(col).run() : c().unsetColor().run(); setPal(null) }} style={{ background: col || '#fff', border: col ? 0 : '2px solid #d1d5db' }}>{col ? '' : 'A'}</button>)
        : <>{[['Tiêu đề', 1], ['Đề mục', 2]].map(([n, l]) => <button key={n} type="button" className={'nb sm' + on('heading', { level: l })} onMouseDown={e => e.preventDefault()} onClick={() => { c().toggleHeading({ level: l }).run(); setPal(null) }}>{n}</button>)}
            <button type="button" className={'nb sm' + (editor.isActive('paragraph') ? ' on' : '')} onMouseDown={e => e.preventDefault()} onClick={() => { c().setParagraph().run(); setPal(null) }}>Chữ thường</button>
            {B('1.', () => { c().toggleOrderedList().run(); setPal(null) }, on('orderedList'), 'Đánh số')}
            {B('⇤', () => c().liftListItem(inTask ? 'taskItem' : 'listItem').run(), '', 'Lùi ra')}
            {B('⇥', () => c().sinkListItem(inTask ? 'taskItem' : 'listItem').run(), '', 'Thụt vào')}
            {B('↷', () => c().redo().run(), '', 'Làm lại')}</>}
      </div>}
      <div className="note-row">{sel ? <>
        {B(<b>B</b>, () => c().toggleBold().run(), on('bold'), 'Đậm')}
        {B(<i>I</i>, () => c().toggleItalic().run(), on('italic'), 'Nghiêng')}
        {B(<u>U</u>, () => c().toggleUnderline().run(), on('underline'), 'Gạch chân')}
        {B(<s>S</s>, () => c().toggleStrike().run(), on('strike'), 'Gạch ngang')}
        {B(<span className="note-hl">A</span>, () => setPal(pal === 'hl' ? null : 'hl'), pal === 'hl' || editor.isActive('highlight') ? ' on' : '', 'Tô nền')}
        {B(<span style={{ color: editor.getAttributes('textStyle').color || '#dc2626', fontWeight: 800 }}>A</span>, () => setPal(pal === 'co' ? null : 'co'), pal === 'co' ? ' on' : '', 'Màu chữ')}
        {B(<span className="note-sz">A<small>A</small></span>, () => setPal(pal === 'sz' ? null : 'sz'), pal === 'sz' || curSize ? ' on' : '', 'Cỡ chữ')}
        {B('⌫', () => c().unsetAllMarks().run(), '', 'Xoá định dạng')}
      </> : inTable ? <>
        {B(<span className="note-tb">☰<small>hàng</small></span>, () => setPal(pal === 'row' ? null : 'row'), pal === 'row' ? ' on' : '', 'Hàng')}
        {B(<span className="note-tb">▥<small>cột</small></span>, () => setPal(pal === 'col' ? null : 'col'), pal === 'col' ? ' on' : '', 'Cột')}
        {B(<span className="note-tb">∑<small>{ti?.attrs.totals ? 'tính' : 'tổng'}</small></span>, () => { if (!ti?.attrs.totals) setTableAttrs(editor, { totals: true }); else setPal(pal === 'sum' ? null : 'sum') }, ti?.attrs.totals ? ' on' : '', 'Tổng cuối bảng')}
        {B(<span className="note-tb">ƒx<small>công thức</small></span>, () => setPal(pal === 'fx' ? null : 'fx'), (ti?.attrs.calc || {})[ti?.col] ? ' on' : '', 'Công thức cột')}
        {B('↶', () => c().undo().run(), '', 'Hoàn tác')}
      </> : <>
        {B('Aa', () => setPal(pal === 'aa' ? null : 'aa'), pal === 'aa' ? ' on' : '', 'Kiểu chữ')}
        {B('☑', () => c().toggleTaskList().run(), on('taskList'), 'Checklist')}
        {B('•', () => c().toggleBulletList().run(), on('bulletList'), 'Gạch đầu dòng')}
        {B(<span className="note-tb">▦<small>bảng</small></span>, () => setPal(pal === 'tbl' ? null : 'tbl'), pal === 'tbl' ? ' on' : '', 'Chèn bảng')}
        {B(<span className="note-tb">{busy ? '⏳' : '📷'}<small>ảnh</small></span>, () => fileRef.current?.click(), '', 'Thêm ảnh')}
        {inTask && onMakeTask ? B('⏰', () => { const t = taskText(); if (t) onMakeTask(t) }, '', 'Tạo việc từ dòng này')
          : B('🔑', () => onSecret?.(), '', 'Thêm mật khẩu')}
        {B('↶', () => c().undo().run(), '', 'Hoàn tác')}
      </>}</div>
    </div>}
  </>
}

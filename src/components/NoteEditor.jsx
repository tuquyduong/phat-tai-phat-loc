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

const COLORS = [['Mặc định', null], ['Đỏ', '#dc2626'], ['Xanh', '#2563eb'], ['Lục', '#059669'], ['Cam', '#d97706'], ['Tím', '#7c3aed']]
const MARKS = [['#fde68a', 'Vàng'], ['#bbf7d0', 'Xanh'], ['#fbcfe8', 'Hồng']]

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

// Bàn phím: đo bằng visualViewport; đang gõ trên máy cảm ứng mà không đo được → đưa thanh lên trên
function useBarPlace(focused) {
  const [st, setSt] = useState({ kb: 0, top: false })
  useEffect(() => {
    const vv = window.visualViewport, touch = 'ontouchstart' in window
    const f = () => { const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0; setSt({ kb, top: focused && touch && kb < 80 }) }
    f(); const t = setTimeout(f, 700)
    vv?.addEventListener('resize', f); vv?.addEventListener('scroll', f)
    return () => { clearTimeout(t); vv?.removeEventListener('resize', f); vv?.removeEventListener('scroll', f) }
  }, [focused])
  return st
}

export default function NoteEditor({ doc, editable, me, names, autoFocus, onChange, onSecret, onMakeTask, topOffset = 52 }) {
  const [focused, setFocused] = useState(false)
  const [pal, setPal] = useState(null)
  const [, setTick] = useState(0)
  const alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const force = () => { if (alive.current) setTick(x => x + 1) }
  const ext = useMemo(() => [
    StarterKit, Underline, Highlight.configure({ multicolor: true }), TextStyle, Color,
    TaskList, TaskBy.configure({ nested: true, onReadOnlyChecked: () => false }), stampTicks(me),
    Placeholder.configure({ placeholder: 'Tiêu đề… rồi xuống dòng viết nội dung. Muốn nói: chạm 🎤 trên bàn phím' }),
    Link.configure({ autolink: true, linkOnPaste: true, openOnClick: !editable }),
  ], [me, editable])
  const cb = useRef(onChange); cb.current = onChange
  const editor = useEditor({
    extensions: ext, content: doc, editable,
    onUpdate: ({ editor }) => cb.current?.(editor.getJSON()),
    onSelectionUpdate: () => { force(); if (alive.current) setPal(null) },
    onTransaction: () => force(),
    onFocus: () => { if (alive.current) setFocused(true) },
    onBlur: () => setTimeout(() => { if (alive.current) setFocused(!!document.activeElement?.closest?.('.ProseMirror')) }, 150),
  }, [ext])
  // Ghi chú mới: đặt con trỏ ngay trong lần chạm để bàn phím bật lên
  useLayoutEffect(() => { if (editor && autoFocus && editable) editor.commands.focus('end') }, [editor])   // eslint-disable-line react-hooks/exhaustive-deps
  const { kb, top } = useBarPlace(focused)

  // Tên người tick hiện cạnh dòng checklist (người xem thấy "Bạn", con thấy "Bố Linh")
  const tickCss = useMemo(() => Object.entries(names).map(([k, n]) =>
    `.note-ed li[data-checked="true"][data-by="${k}"]>div::after{content:"✓ ${n}"}`).join('\n'), [names])

  if (!editor) return null
  const c = () => editor.chain().focus()
  const on = (n, a) => editor.isActive(n, a) ? ' on' : ''
  const sel = !editor.state.selection.empty
  const inTask = editor.isActive('taskItem')
  const B = (label, fn, active, aria) => <button key={aria} type="button" className={'nb' + active} onMouseDown={e => e.preventDefault()} onClick={fn} aria-label={aria}>{label}</button>
  const taskText = () => { const { $from } = editor.state.selection; for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'taskItem') return $from.node(d).textContent.trim(); return '' }

  return <>
    <style>{tickCss}</style>
    <EditorContent editor={editor} className={'note-ed' + (editable ? '' : ' ro')}/>
    {editable && <div className={'note-bar' + (top ? ' top' : '')} style={top ? { top: topOffset } : { bottom: kb }}>
      {pal && <div className="note-pal">
        {pal === 'hl' ? <>{MARKS.map(([col, n]) => <button key={col} type="button" className="nc" onMouseDown={e => e.preventDefault()} aria-label={'Tô ' + n}
            onClick={() => { c().toggleHighlight({ color: col }).run(); setPal(null) }} style={{ background: col, outline: editor.isActive('highlight', { color: col }) ? '3px solid #111' : 'none' }}/>)}
          <button type="button" className="nb sm" onMouseDown={e => e.preventDefault()} onClick={() => { c().unsetHighlight().run(); setPal(null) }}>Bỏ tô</button></>
        : pal === 'co' ? COLORS.map(([n, col]) => <button key={n} type="button" className="nc" onMouseDown={e => e.preventDefault()} aria-label={'Màu ' + n}
            onClick={() => { col ? c().setColor(col).run() : c().unsetColor().run(); setPal(null) }} style={{ background: col || '#fff', border: col ? 0 : '2px solid #d1d5db' }}>{col ? '' : 'A'}</button>)
        : <>{[['Tiêu đề', 1], ['Đề mục', 2]].map(([n, l]) => <button key={n} type="button" className={'nb sm' + on('heading', { level: l })} onMouseDown={e => e.preventDefault()} onClick={() => { c().toggleHeading({ level: l }).run(); setPal(null) }}>{n}</button>)}
            <button type="button" className={'nb sm' + (editor.isActive('paragraph') ? ' on' : '')} onMouseDown={e => e.preventDefault()} onClick={() => { c().setParagraph().run(); setPal(null) }}>Chữ thường</button>
            {B('⇤', () => c().liftListItem(inTask ? 'taskItem' : 'listItem').run(), '', 'Lùi ra')}
            {B('⇥', () => c().sinkListItem(inTask ? 'taskItem' : 'listItem').run(), '', 'Thụt vào')}</>}
      </div>}
      <div className="note-row">{sel ? <>
        {B(<b>B</b>, () => c().toggleBold().run(), on('bold'), 'Đậm')}
        {B(<i>I</i>, () => c().toggleItalic().run(), on('italic'), 'Nghiêng')}
        {B(<u>U</u>, () => c().toggleUnderline().run(), on('underline'), 'Gạch chân')}
        {B(<s>S</s>, () => c().toggleStrike().run(), on('strike'), 'Gạch ngang')}
        {B(<span className="note-hl">A</span>, () => setPal(pal === 'hl' ? null : 'hl'), pal === 'hl' || editor.isActive('highlight') ? ' on' : '', 'Tô nền')}
        {B(<span style={{ color: editor.getAttributes('textStyle').color || '#dc2626', fontWeight: 800 }}>A</span>, () => setPal(pal === 'co' ? null : 'co'), pal === 'co' ? ' on' : '', 'Màu chữ')}
        {B('⌫', () => c().unsetAllMarks().run(), '', 'Xoá định dạng')}
      </> : <>
        {B('Aa', () => setPal(pal === 'aa' ? null : 'aa'), pal === 'aa' ? ' on' : '', 'Kiểu chữ')}
        {B('•', () => c().toggleBulletList().run(), on('bulletList'), 'Gạch đầu dòng')}
        {B('1.', () => c().toggleOrderedList().run(), on('orderedList'), 'Đánh số')}
        {B('☑', () => c().toggleTaskList().run(), on('taskList'), 'Checklist')}
        {inTask && onMakeTask ? B('⏰', () => { const t = taskText(); if (t) onMakeTask(t) }, '', 'Tạo việc từ dòng này')
          : B('🔑', () => onSecret?.(), '', 'Thêm mật khẩu')}
        {B('↶', () => c().undo().run(), '', 'Hoàn tác')}
        {B('↷', () => c().redo().run(), '', 'Làm lại')}
      </>}</div>
    </div>}
  </>
}

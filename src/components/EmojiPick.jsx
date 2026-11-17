// Bảng chọn biểu tượng theo nhóm — dùng cho sổ Ghi chú và mục Thu Chi
import { useState } from 'react'

export const EMOJI_GROUPS = [
  ['⭐ Hay dùng', '📌 ⭐ 🔑 💼 🏠 🛒 💡 📿 🍜 💊 ✈️ 🎁 📚 🌿 ☕ 💰 ❤️ 🎯 📝 🔒'],
  ['👨‍👩‍👧 Gia đình', '👨‍👩‍👧‍👦 👩‍👧 👨‍👦 👶 🧒 👦 👧 👨 👩 👴 👵 🐣 🌙 ❤️ 💕 🎂 🎈 🏡 💍 🤱'],
  ['🍜 Ăn uống', '☕ 🍵 🧋 🥤 🍜 🍲 🍚 🍱 🍣 🥗 🥬 🍎 🍊 🍉 🍰 🍪 🍺 🍷 🥛 🥖 🍗 🦐 🥟 🍳'],
  ['💰 Tiền & mua sắm', '🛒 🛍️ 💰 💵 💳 🏦 🧾 📈 📉 🪙 💎 💍 👗 👕 👟 👜 💄 🧴 🎁 📦 🏷️ 🧧'],
  ['🚗 Đi lại', '🚗 🛵 🚕 🚌 ✈️ 🚆 🚢 ⛽ 🅿️ 🗺️ 🏖️ 🏨 🧳 ⛰️ 🌏 🚲 🛣️ 🎫'],
  ['🌿 Sức khoẻ & tâm linh', '💊 🏥 🩺 🌿 🍃 🧘 🏃 💪 🦷 👓 💉 🩹 🙏 📿 🪷 🕯️ 🌸 🛕 ⛩️ ☯️'],
  ['📚 Học & công việc', '📚 📖 ✏️ 🎓 💻 📱 🖥️ 🗂️ 📁 📝 📋 📊 🧪 🔬 🛠️ ⚙️ 💡 📞 ✉️ 🗓️ 🏪 🏭'],
  ['🏠 Nhà cửa', '🏠 🛋️ 🛏️ 🧹 🧺 🧼 🔌 💡 🚿 🪴 🐶 🐱 🐟 🐔 🔧 🔨 📺 📶 🔥 💧 🌡️ 🧯'],
  ['🎉 Khác', '🎵 🎬 🎮 ⚽ 🏸 🎨 📷 🔐 🔑 🌟 ✨ 🔥 🎯 ⏰ 🎉 🌈 ☀️ 🌧️ 🍀 🎀 ⚠️ ✅'],
].map(([name, list]) => [name, list.split(' ')])

export default function EmojiPick({ value, onChange }) {
  const [g, setG] = useState(0)
  return (
    <div className="mt-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {EMOJI_GROUPS.map(([name], i) => (
          <button key={name} type="button" onClick={() => setG(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${g === i ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{name}</button>))}
      </div>
      <div className="grid grid-cols-8 gap-1 mt-2">
        {EMOJI_GROUPS[g][1].map(e => (
          <button key={e} type="button" onClick={() => onChange(e)} aria-label={'Chọn ' + e}
            className={`aspect-square rounded-xl text-[22px] flex items-center justify-center ${value === e ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-gray-50 active:bg-gray-200'}`}>{e}</button>))}
      </div>
    </div>)
}

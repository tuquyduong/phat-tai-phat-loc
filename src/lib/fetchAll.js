// ============================================
// ĐỌC HẾT — Supabase chỉ trả tối đa 1.000 dòng mỗi lần đọc.
// build() trả về câu truy vấn mới (đã select, lọc, sắp xếp). Hàm này đọc lần lượt
// từng trang 1.000 dòng tới khi hết, thêm sắp xếp phụ theo id để giữa các trang
// không sót, không trùng. Dùng cho mọi bảng sẽ lớn dần theo thời gian.
// ============================================
const PAGE = 1000
export async function fetchAll(build) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < PAGE) return out
  }
}

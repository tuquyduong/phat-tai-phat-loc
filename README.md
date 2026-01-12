# 📦 Quản Lý Đơn Hàng

App theo dõi đơn hàng cá nhân với tính năng:
- ✅ Theo dõi đơn hàng theo khách
- ✅ Track tiến độ giao hàng (giao nhiều đợt)
- ✅ Lịch sử thanh toán (trả nhiều lần)
- ✅ Tổng hợp công nợ theo khách
- ✅ Filter theo tên/ngày
- ✅ Popup chi tiết
- ✅ Password bảo vệ

## 🚀 Hướng dẫn Setup

### Bước 1: Tạo Supabase Project

1. Vào [supabase.com](https://supabase.com) → **Start your project**
2. Đăng nhập GitHub
3. **New Project** → Đặt tên, chọn region gần (Singapore)
4. Đợi 2 phút để tạo xong

### Bước 2: Tạo Database

1. Vào **SQL Editor** (menu trái)
2. Copy toàn bộ nội dung file `supabase-setup.sql`
3. Paste vào editor → **Run**
4. Nếu muốn đổi password, sửa dòng cuối trước khi chạy:
   ```sql
   INSERT INTO settings (key, value) VALUES ('app_password', 'YOUR_PASSWORD');
   ```

### Bước 3: Lấy API Keys

1. Vào **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJhbGc...`

### Bước 4: Cấu hình App

1. Tạo file `.env` từ `.env.example`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Bước 5: Chạy Local

```bash
npm install
npm run dev
```

Mở http://localhost:3000

---

## 🌐 Deploy lên Render

### Option A: Static Site (Recommended)

1. Push code lên GitHub
2. Vào [render.com](https://render.com) → **New Static Site**
3. Connect GitHub repo
4. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
5. **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy!

### Option B: Replit Preview

1. Import GitHub repo vào Replit
2. Thêm Secrets (Environment Variables)
3. Run `npm install && npm run dev`

---

## 📱 Cách sử dụng

### Trang chính
- **Dashboard**: Thống kê nhanh (đơn đang xử lý, công nợ, ...)
- **Tabs**: Đang xử lý / Công nợ / Tất cả
- **Search**: Tìm theo tên khách hoặc sản phẩm
- **Filter**: Lọc theo khách hàng, ngày đặt

### Tạo đơn mới
1. Bấm nút **+** (góc phải dưới)
2. Chọn hoặc tạo khách hàng mới
3. Nhập sản phẩm, số lượng, đơn giá
4. Bấm **Tạo đơn hàng**

### Cập nhật đơn
1. Bấm vào card đơn hàng
2. Popup hiện chi tiết
3. **+ Giao hàng**: Thêm lần giao (số lượng + ngày)
4. **+ Thanh toán**: Thêm lần thanh toán (số tiền + ngày)
5. **Đánh dấu hoàn thành**: Khi xong hết

### Xem công nợ
1. Chọn tab **Công nợ**
2. Danh sách khách còn nợ, sắp theo số tiền nợ
3. Bấm mở rộng để xem chi tiết từng đơn

---

## 🗂 Cấu trúc Project

```
order-tracker/
├── src/
│   ├── components/
│   │   ├── Login.jsx        # Màn hình đăng nhập
│   │   ├── Dashboard.jsx    # Thống kê tổng quan
│   │   ├── OrderCard.jsx    # Card hiển thị đơn
│   │   ├── OrderDetail.jsx  # Popup chi tiết đơn
│   │   ├── CreateOrder.jsx  # Form tạo đơn mới
│   │   ├── DebtSummary.jsx  # Tổng hợp công nợ
│   │   └── Modal.jsx        # Component modal base
│   ├── lib/
│   │   ├── supabase.js      # Supabase client + API
│   │   └── helpers.js       # Format tiền, ngày, ...
│   ├── App.jsx              # Component chính
│   ├── main.jsx             # Entry point
│   └── index.css            # Styles
├── supabase-setup.sql       # SQL tạo database
├── .env.example             # Mẫu biến môi trường
└── package.json
```

---

## 🔒 Bảo mật

- Password lưu trong Supabase (bảng `settings`)
- Session lưu localStorage (browser)
- RLS enabled trên tất cả bảng
- Anon key chỉ cho phép CRUD cơ bản

---

## 🤖 Auto Wake-up (Chống Supabase Pause)

Project đã có sẵn GitHub Actions tự động ping Supabase mỗi 6 giờ.

**Setup (1 lần duy nhất):**

1. Push code lên GitHub
2. Vào repo → **Settings** → **Secrets and variables** → **Actions**
3. Thêm 2 secrets:
   - `VITE_SUPABASE_URL` = `https://xxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbG...`
4. Done! GitHub sẽ tự động giữ database sống

**Test thủ công:**
- Vào **Actions** tab → **Keep Supabase Alive** → **Run workflow**

---

## 🧹 Auto Cleanup

Để tự động xóa đơn cũ đã hoàn thành (>30 ngày):

1. Vào Supabase → **SQL Editor**
2. Chạy:
   ```sql
   SELECT cleanup_old_orders(30);
   ```

Hoặc setup pg_cron để chạy tự động hàng tuần.

---

## 📞 Support

Có vấn đề? Tạo Issue trên GitHub repo.

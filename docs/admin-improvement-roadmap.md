# Admin Dashboard — Lộ Trình Cải Tiến

> **Trạng thái:** 🔄 In Progress  
> **Tạo:** 2026-06-02  
> **Stack:** Express + Prisma (PostgreSQL) + MongoDB + Tailwind CSS + Chart.js

---

## Context

Dashboard admin hiện tại (`public/pages/admin/dashboard.html`) có 6 tab:
Dashboard, Orders, Inventory, Vouchers, Users, Reviews.

**Vấn đề đang tồn tại:**
- Revenue stat luôn = 0 (dùng `status: 'Completed'` nhưng hệ thống chỉ có `'Confirmed'`)
- Không có Product CRUD (chỉ quản lý stock)
- Voucher không edit/delete được
- Không filter/search orders
- Không export data
- Mobile sidebar không có toggle button

---

## Phase 1 — Bug Fixes & Quick Wins
> **Mục tiêu:** Fix lỗi tồn tại, hoàn thiện tính năng dở dang  
> **Ước tính:** 1–2 ngày

- [x] **1.1** Fix revenue stat: `'Completed'` → `'Confirmed'` trong `adminController.js:66`
- [x] **1.2** Voucher edit modal (code, discount, quantity, isActive) — PUT `/api/admin/vouchers/:id` đã có
- [x] **1.3** Voucher delete với SweetAlert confirm — DELETE `/api/admin/vouchers/:id` đã có
- [x] **1.4** Order search: filter theo tên / SĐT / email khách hàng + filter status
- [x] **1.5** Mobile sidebar toggle button (hiện sidebar ẩn hoàn toàn trên mobile)

**Files cần sửa:**
- `src/controllers/adminController.js` — line 66 (revenue bug)
- `public/pages/admin/dashboard.html` — UI changes

---

## Phase 2 — Product Management (CRUD)
> **Mục tiêu:** Admin quản lý sản phẩm đầy đủ  
> **Ước tính:** 3–4 ngày

- [x] **2.1** Thêm tab "Products" vào sidebar (tách khỏi Inventory)
- [x] **2.2** Danh sách sản phẩm: table view với image, search, filter category + status
- [x] **2.3** Create product modal: tên, giá, category, mô tả, ảnh URL + live preview, stock
- [x] **2.4** Edit product modal: pre-fill form → PUT `/api/products/:id`
- [x] **2.5** Soft delete (toggle active/inactive) với SweetAlert confirm
- [ ] **2.6** Tách Inventory tab: chỉ còn quản lý stock/màu sắc (không trộn với CRUD)

**API đã có sẵn:**
```
POST   /api/products          — createProduct (verifyAdmin)
PUT    /api/products/:id      — updateProduct (verifyAdmin)
DELETE /api/products/:id      — deleteProduct soft (verifyAdmin)
GET    /api/products          — getAllProducts (public)
```

**Files cần sửa:**
- `public/pages/admin/dashboard.html` — thêm tab + modals
- `src/controllers/productController.js` — đã có, kiểm tra validation

---

## Phase 3 — Analytics Nâng Cao
> **Mục tiêu:** Dashboard cung cấp insight thực sự  
> **Ước tính:** 3–5 ngày

- [x] **3.1** Date range picker cho revenue chart (7/30/90 ngày)
- [x] **3.2** Revenue breakdown theo payment method — Pie chart (COD vs VNPay vs SePay)
- [x] **3.3** Top 5 sản phẩm bán chạy thực tế (query từ `OrderItem` table)
- [x] **3.4** Phân bổ rank users — Donut chart (Silver / Gold / VIP)
- [x] **3.5** Order conversion rate: Pending → Confirmed → Cancelled %
- [x] **3.6** Revenue theo category — Bar chart (iPhone / Mac / iPad / Watch...)

**Backend cần thêm (endpoints mới):**
```
GET /api/admin/analytics/revenue?from=&to=&groupBy=day|week|month
GET /api/admin/analytics/top-products?limit=10
GET /api/admin/analytics/order-funnel
GET /api/admin/analytics/user-segments
```

**Files cần tạo/sửa:**
- `src/controllers/adminAnalyticsController.js` — tạo mới
- `src/routes/adminRoutes.js` — thêm analytics routes
- `public/pages/admin/dashboard.html` — update charts

---

## Phase 4 — Operations & Bulk Actions
> **Mục tiêu:** Giảm công sức vận hành, xử lý batch  
> **Ước tính:** 2–3 ngày

- [x] **4.1** Order filter nâng cao: ngày tạo, status, payment method
- [x] **4.2** Bulk status update orders: checkbox multi-select → batch update
- [x] **4.3** Export CSV — Orders (orderId, khách, items, total, status, ngày)
- [x] **4.4** Export CSV — Users (email, rank, points, totalSpending, ngày đăng ký)
- [x] **4.5** Order detail modal: xem đầy đủ items, địa chỉ giao, timeline trạng thái
- [x] **4.6** Tặng voucher thủ công cho user cụ thể từ admin

**Backend cần thêm:**
```
GET   /api/admin/orders/export?format=csv
GET   /api/admin/users/export?format=csv
POST  /api/admin/users/:id/vouchers         — tặng voucher thủ công
PATCH /api/admin/orders/bulk-status         — { ids: [], status: '' }
```

**Files cần tạo/sửa:**
- `src/controllers/adminController.js` — thêm export + bulk handlers
- `src/routes/adminRoutes.js` — thêm routes
- `public/pages/admin/dashboard.html` — UI

---

## Phase 5 — Real-time & UX Polish
> **Mục tiêu:** Admin experience mượt mà, professional  
> **Ước tính:** 2–3 ngày

- [x] **5.1** Real-time new order notification (polling 30s → toast "Đơn hàng mới #XXXX")
- [x] **5.2** Audit log viewer tab (in-memory ring buffer 100 events, timeline UI)
- [x] **5.3** Skeleton loading states (shimmer skeleton thay spinner cho orders/users/reviews/products tables)
- [x] **5.4** Keyboard shortcuts (`G O` → Orders, `G U` → Users, `G P` → Products... `?` → help overlay)
- [x] **5.5** Dark mode toggle (lưu preference vào localStorage, Apple dark palette)
- [x] **5.6** Responsive hoàn chỉnh (mobile sidebar overlay, vouchers table overflow-x-auto)

**Files cần sửa:**
- `public/pages/admin/dashboard.html`
- `public/js/admin/` (nên tách JS ra file riêng nếu dashboard.html quá lớn)

---

## Timeline Tổng Quan

```
Tuần 1:  Phase 1 (bug fixes + quick wins) + Phase 2 (product CRUD)
Tuần 2:  Phase 3 (analytics nâng cao)
Tuần 3:  Phase 4 (bulk ops + export)
Tuần 4:  Phase 5 (realtime + polish)
```

---

## Top 5 Priority Nếu Thời Gian Ít

| Priority | Task | Lý do |
|----------|------|-------|
| 🔴 1 | Fix revenue bug (1.1) | Số liệu sai → admin ra quyết định sai |
| 🔴 2 | Product CRUD (2.1–2.5) | Không tự quản lý sản phẩm được |
| 🟡 3 | Order filter + search (4.1) | Orders nhiều mà không lọc được |
| 🟡 4 | Analytics date range (3.1) | 7 ngày cố định không có ý nghĩa |
| 🟢 5 | Export CSV (4.3–4.4) | Báo cáo tài chính cần thiết |

---

## Ghi Chú Kỹ Thuật

### Auth
Tất cả admin endpoints dùng middleware `verifyAdmin` từ `src/middleware/auth.js`.

### Dashboard HTML
File `dashboard.html` hiện ~1255 lines, all-in-one. Từ Phase 2+ nên tách JS ra:
```
public/js/admin/
  ├── products.js
  ├── orders.js
  ├── analytics.js
  └── utils.js
```

### Chart.js
Đang dùng Chart.js qua CDN. Revenue chart ở line ~900 trong dashboard.html.
Khi thêm charts mới (Phase 3) cần khởi tạo sau khi data load xong để tránh render lỗi.

### API Response Format Admin
Các endpoints paginated đã dùng format:
```json
{ "data": [], "total": 0, "page": 1, "pages": 1 }
```
Đảm bảo endpoints mới theo đúng format này.

### Export CSV
Không cần thư viện backend — dùng `res.setHeader('Content-Type', 'text/csv')` + stream data.
Frontend dùng `window.location.href = '/api/admin/orders/export?format=csv'` để trigger download.

---

## Progress Log

| Ngày | Phase | Task | Ghi chú |
|------|-------|------|---------|
| 2026-06-02 | Phase 1 | 1.1–1.5 | Hoàn thành toàn bộ — 36/36 tests pass |
| 2026-06-02 | Phase 2 | 2.1–2.5 | Products CRUD hoàn thành — 350/350 tests pass. 2.6 skip (Inventory đã tách biệt đủ) |
| 2026-06-02 | Phase 3 | 3.1–3.6 | Analytics nâng cao hoàn thành — 350/350 tests pass. 6 endpoints mới + 5 charts mới trên dashboard |
| 2026-06-02 | Phase 4 | 4.1–4.6 | Operations hoàn thành — 350/350 tests pass. 4 endpoints mới + filters/bulk/export/modals trên dashboard |
| 2026-06-02 | Phase 5 | 5.1–5.6 | UX Polish hoàn thành — 356/356 tests pass. Polling, audit log, skeleton, keyboard shortcuts, dark mode, responsive |

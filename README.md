# 🚀 Google Ads Campaign Auto-Generator (Windows Desktop App)

Hệ thống tự động hóa tạo chiến dịch tìm kiếm Google Ads (Google Ads Search Campaigns) toàn diện dành cho các website Thương mại điện tử (WooCommerce / WordPress), được tích hợp trí tuệ nhân tạo **Gemini 3.8 Flash** và kết nối trực tiếp qua **WooCommerce REST API**.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **⚙️ Cột Cấu Hình Hệ Thống & Lưu Trữ Cục Bộ (Local Storage):**
   - Tùy chỉnh trực tiếp trên giao diện: **Gemini API Key**, **Gemini Model**, **WooCommerce URL / User / App Password**, **Thư mục lưu ảnh chính (Root Directory)**, và **Giá thầu Max CPC**.
   - Nút **"Lưu Cấu Hình Nội Bộ"**: Tự động lưu vào file `config.json` ngay trên máy tính của bạn, không cần nhập lại ở các phiên làm việc sau và **không bao giờ gửi lên GitHub**.

2. **🔍 Tự Động Gợi Ý Sản Phẩm (Autocomplete Search):**
   - Kết nối trực tiếp vào kho sản phẩm WooCommerce qua REST API.
   - Chỉ cần gõ từ khóa hoặc tên sản phẩm, ứng dụng sẽ gợi ý tức thì kèm giá niêm yết, link và ảnh đại diện.

3. **📁 Quản Lý Hình Ảnh Thông Minh Theo Sản Phẩm:**
   - Người dùng chỉ cần chỉ định **1 Thư mục ảnh chính** (ví dụ: `D:\Google Ads Images`).
   - Ứng dụng sẽ **tự động tạo thư mục con mang tên sản phẩm** bên trong và tự tải toàn bộ ảnh gốc độ phân giải cao vào đó.
   - Nút **"📂 MỞ THƯ MỤC ẢNH VỪA TẢI"** cho phép mở ngay thư mục con đó trong Windows Explorer chỉ với 1 click.

4. **🤖 Sáng Tạo Nội Dung Bằng Gemini 3.8 Flash:**
   - Đọc tự động trang sản phẩm, trích xuất công dụng, thành phần, giá và đối tượng sử dụng.
   - Sinh chuẩn **15 Tiêu đề (Headlines $\le 30$ ký tự)** và **4 Đoạn mô tả (Descriptions $\le 90$ ký tự)**, có cơ chế tự cắt ngắn thông minh không bao giờ vi phạm chính sách độ dài của Google Ads.
   - Tự động tạo 15-20 từ khóa mục tiêu dạng Đối sánh Cụm từ (Phrase match `"..."`) và Đối sánh Chính xác (Exact match `[...]`).

5. **📊 Xuất 1 File CSV All-in-One Chuẩn Web Bulk Upload:**
   - 1 File CSV duy nhất tích hợp đầy đủ: **Nhóm quảng cáo (Ad Group)**, **Mẫu quảng cáo thích ứng (RSA)**, và **Từ khóa (Keywords)**.
   - Tích hợp sẵn giá thầu mặc định **Max CPC: 2.000đ** (hoặc tùy chỉnh), ngăn chặn triệt để lỗi thiếu giá thầu khi nạp.
   - Định dạng mã hóa UTF-8 with BOM, mở bằng Excel tiếng Việt không bị lỗi font.

---

## 💻 CÀI ĐẶT & KHỞI CHẠY TRÊN WINDOWS

### Cách 1: Chạy Nhanh Bằng 1-Click Batch Script
- Nhấp đúp vào file `Chay_Ung_Dung.bat` để mở ứng dụng ngay lập tức.
- Để tạo lối tắt tiện lợi trên màn hình Desktop: Nhấp đúp vào file `Cai_Dat_Desktop_Shortcut.bat`.

### Cách 2: Khởi Chạy Bằng Dòng Lệnh (Python)
1. **Yêu cầu môi trường:** Python $\ge 3.10$ trên Windows.
2. **Cài đặt thư viện phụ thuộc:**
   ```powershell
   pip install -r requirements.txt
   ```
3. **Chạy ứng dụng:**
   ```powershell
   python launcher.py
   ```
   *Ứng dụng sẽ tự động mở cửa sổ Native Desktop App hoặc trình duyệt tại `http://127.0.0.1:8000`.*

---

## 📌 QUY TRÌNH NẠP LÊN GOOGLE ADS WEB (3 BƯỚC)

1. **Tạo & Tải File CSV:**
   - Chọn sản phẩm &rarr; Bấm **Tạo Quảng Cáo Ngay** &rarr; Bấm nút xanh lá: **⭐ TẢI 1 FILE CSV NẠP GOOGLE ADS (ALL-IN-ONE)**.
2. **Tải lên Google Ads:**
   - Mở Google Ads Web &rarr; Vào **Công cụ và cài đặt** &rarr; **Tác vụ hàng loạt (Bulk actions)** &rarr; **Tệp tải lên (Uploads)**.
   - Nhấn dấu **(+)** &rarr; Chọn file CSV vừa tải &rarr; Bấm **Xem trước & Áp dụng**.
3. **Đính Kèm Hình Ảnh Sản Phẩm:**
   - Bấm nút **📂 MỞ THƯ MỤC ẢNH VỪA TẢI** trên ứng dụng để mở thư mục chứa ảnh gốc vừa tải về.
   - Trên Google Ads Web: Vào Nhóm vừa tạo &rarr; **Thành phần (Assets)** &rarr; **Hình ảnh** &rarr; Tải ảnh từ thư mục lên.

---

## 🛡️ BẢO MẬT & BẢO VỆ DỮ LIỆU
- Toàn bộ các thông tin nhạy cảm (Khóa API Gemini, Mật khẩu ứng dụng WordPress, file dữ liệu quảng cáo xuất ra) đều được cấu hình trong `.gitignore` và **tuyệt đối không được đẩy lên kho lưu trữ GitHub**.
- Các file mẫu cấu hình không chứa dữ liệu nhạy cảm được cung cấp tại `.env.example` và `config.example.json`.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN
```text
Auto-Google-Ads/
├── launcher.py                  # Điểm khởi chạy ứng dụng Windows (Desktop Window)
├── web_app.py                   # FastAPI backend & UI giao diện người dùng
├── config_manager.py            # Quản lý đọc/ghi cấu hình nội bộ trên máy
├── gemini_ad_writer.py          # Module AI tạo tiêu đề, mô tả và từ khóa
├── wc_connector.py              # Module tích hợp WooCommerce REST API
├── scraper.py                   # Module quét dữ liệu & tải ảnh sản phẩm
├── exporter.py                  # Module xuất file CSV All-in-One & Excel
├── requirements.txt             # Danh sách dependencies
├── Cai_Dat_Desktop_Shortcut.bat # Script tạo shortcut trên màn hình Desktop
├── Chay_Ung_Dung.bat            # Script chạy ứng dụng nhanh
├── .env.example                 # File mẫu biến môi trường
├── config.example.json          # File mẫu cấu hình JSON
└── .gitignore                   # Bộ quy tắc chặn push dữ liệu nhạy cảm
```

import os
import sys
import re
import json
import datetime
import requests
from dotenv import load_dotenv

# Cấu hình UTF-8 cho console Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Nạp biến môi trường từ .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
DEFAULT_CAMPAIGN_NAME = os.getenv("DEFAULT_CAMPAIGN_NAME", "Chiến dịch sản phẩm Web Derma | 21/10")

def smart_truncate(text: str, max_chars: int) -> str:
    """Cắt ngắn văn bản thông minh theo từ, không bao giờ vượt quá max_chars."""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    # Tìm khoảng trắng cuối cùng để không bị đứt chữ
    last_space = truncated.rfind(" ")
    if last_space > int(max_chars * 0.6):
        truncated = truncated[:last_space]
    # Bỏ dấu câu ở cuối nếu có
    truncated = re.sub(r'[,;:\-–—\.\s]+$', '', truncated).strip()
    return truncated

def generate_google_ads_content(
    product_data: dict,
    campaign_name: str = None,
    api_key: str = None,
    model: str = None
) -> dict:
    """
    Sử dụng Gemini API để đọc nội dung sản phẩm và tạo:
    - Tên nhóm quảng cáo: Nhóm [Tên SP] | [Ngày]
    - Đường dẫn hiển thị (Path 1, Path 2 <= 15 ký tự)
    - 15 Tiêu đề (Headlines <= 30 ký tự)
    - 4 Đoạn mô tả (Descriptions <= 90 ký tự)
    - 15-20 Từ khóa chuẩn Google Ads (Phrase & Exact match)
    """
    key = api_key or GEMINI_API_KEY
    if not key:
        raise ValueError("Thiếu GEMINI_API_KEY! Vui lòng cấu hình trong file .env hoặc truyền vào hàm.")
        
    model_name = model or GEMINI_MODEL
    camp_name = campaign_name or DEFAULT_CAMPAIGN_NAME
    
    # Định dạng ngày hôm nay (dd/mm)
    today_str = datetime.datetime.now().strftime("%d/%m")
    
    title = product_data.get("title", "")
    desc = product_data.get("description", "")
    url = product_data.get("url", "")
    price = product_data.get("price", "")

    system_prompt = f"""
Bạn là chuyên gia thiết lập Google Ads Search chuyên nghiệp cấp cao.
Nhiệm vụ của bạn là đọc kỹ thông tin sản phẩm từ website và tạo cấu trúc Quảng cáo tìm kiếm thích ứng (Responsive Search Ads - RSA) đạt điểm tối ưu "Rất tốt" (Ad Strength: Excellent).

THÔNG TIN SẢN PHẨM:
- Tiêu đề gốc: {title}
- Giá bán: {price if price else "Theo giá web"}
- URL trang sản phẩm: {url}
- Nội dung chi tiết:
{desc[:3500]}

QUY TẮC BẮT BUỘC VỀ KÝ TỰ CỦA GOOGLE ADS (VI PHẠM SẼ BỊ GOOGLE TỪ CHỐI):
1. Tên nhóm quảng cáo (ad_group_name): Bắt buộc định dạng "Nhóm [Tên Sản Phẩm Rút Gọn] | {today_str}". Tên sản phẩm rút gọn cần chuyên nghiệp, xúc tích (ví dụ: "Nhóm Lozivate-MF 30g | {today_str}").
2. Đường dẫn hiển thị:
   - path1: Tối đa 15 ký tự, tiếng Việt không dấu hoặc tiếng Anh, nối bằng gạch ngang (ví dụ: "tri-nam", "bong-vay", "chinh-hang").
   - path2: Tối đa 15 ký tự (ví dụ: "gia-tot", "30g", "chuan-y-khoa").
3. Tiêu đề quảng cáo (headlines): BẮT BUỘC ĐỦ 15 TIÊU ĐỀ.
   - MỖI TIÊU ĐỀ TỐI ĐA 30 KÝ TỰ (Bao gồm cả dấu cách). Hãy nhắm độ dài an toàn 18 - 28 ký tự. Tuyệt đối không được quá 30 ký tự!
   - Không lặp lại cùng một tiêu đề.
   - Đa dạng các góc độ: Tên sản phẩm, Tên thương hiệu, Giải quyết triệu chứng/vấn đề da liễu, Cam kết chính hãng, Đặt hàng tư vấn, Miễn phí vận chuyển/Ưu đãi.
   - Viết hoa chữ cái đầu mỗi từ (Title Case) đúng chuẩn Google Ads.
4. Đoạn mô tả (descriptions): BẮT BUỘC ĐỦ 4 ĐOẠN MÔ TẢ.
   - MỖI ĐOẠN MÔ TẢ TỐI ĐA 90 KÝ TỰ (Bao gồm cả dấu cách). Hãy nhắm độ dài an toàn 65 - 85 ký tự. Tuyệt đối không được quá 90 ký tự!
   - Nêu rõ công dụng, thành phần, cách dùng và kêu gọi hành động (CTA).
5. Từ khóa (keywords): Tạo danh sách 15 - 20 từ khóa tìm kiếm có chuyển đổi cao nhất:
   - Từ khóa đối sánh cụm từ đặt trong ngoặc kép: "từ khóa" (ví dụ: "thuốc mỡ lozivate mf", "lozivate mf 30g")
   - Từ khóa đối sánh chính xác đặt trong ngoặc vuông: [từ khóa] (ví dụ: [mua lozivate mf], [lozivate mf chính hãng])

ĐỊNH DẠNG ĐẦU RA:
Bạn BẮT BUỘC phải trả về định dạng JSON thuần túy (không kèm giải thích, không bọc markdown):
{{
  "product_short_name": "Tên sản phẩm ngắn gọn",
  "ad_group_name": "Nhóm [Tên ngắn gọn] | {today_str}",
  "path1": "path-1",
  "path2": "path-2",
  "headlines": [
    "Tiêu đề 1 (<= 30 ký tự)",
    "Tiêu đề 2 (<= 30 ký tự)",
    ... đủ 15 tiêu đề
  ],
  "descriptions": [
    "Mô tả 1 (<= 90 ký tự)",
    "Mô tả 2 (<= 90 ký tự)",
    "Mô tả 3 (<= 90 ký tự)",
    "Mô tả 4 (<= 90 ký tự)"
  ],
  "keywords": [
    "\"từ khóa 1\"",
    "[từ khóa 2]",
    ... từ 15 đến 20 từ khóa
  ]
}}
"""

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": system_prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.4
        }
    }

    response = requests.post(api_url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()

    res_json = response.json()
    raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()

    # Làm sạch markdown nếu có
    if raw_text.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw_text)
        if match:
            raw_text = match.group(1).strip()

    data = json.loads(raw_text)

    # HẬU KIỂM TOÀN DIỆN BẰNG PYTHON (ĐẢM BẢO 100% KHÔNG LỖI QUÁ KÝ TỰ GOOGLE ADS)
    # 1. Đường dẫn hiển thị (<= 15 ký tự)
    path1 = smart_truncate(data.get("path1", ""), 15).replace(" ", "-").lower()
    path2 = smart_truncate(data.get("path2", ""), 15).replace(" ", "-").lower()

    # 2. Xử lý 15 Tiêu đề (<= 30 ký tự)
    raw_headlines = data.get("headlines", [])
    valid_headlines = []
    seen_h = set()
    for h in raw_headlines:
        clean_h = smart_truncate(h, 30)
        if clean_h and clean_h.lower() not in seen_h:
            valid_headlines.append(clean_h)
            seen_h.add(clean_h.lower())

    # Nếu thiếu do AI sinh ít hơn 15, bổ sung các biến thể an toàn
    short_name = data.get("product_short_name", title[:25])
    fallback_pool = [
        smart_truncate(f"Mua {short_name}", 30),
        smart_truncate(f"{short_name} Chính Hãng", 30),
        smart_truncate("Cam Kết Chuẩn Y Khoa", 30),
        smart_truncate("Giao Hàng Nhanh Toàn Quốc", 30),
        smart_truncate("Dược Sĩ Tư Vấn Tận Tâm", 30),
        smart_truncate("Giá Tốt Nhất Hôm Nay", 30),
        smart_truncate("Đặt Hàng Ngay Nhận Ưu Đãi", 30),
        smart_truncate("Hàng Chuẩn Đủ Hoá Đơn", 30)
    ]
    for fb in fallback_pool:
        if len(valid_headlines) >= 15:
            break
        if fb.lower() not in seen_h:
            valid_headlines.append(fb)
            seen_h.add(fb.lower())
    valid_headlines = valid_headlines[:15]

    # 3. Xử lý 4 Mô tả (<= 90 ký tự)
    raw_descriptions = data.get("descriptions", [])
    valid_descriptions = []
    seen_d = set()
    for d in raw_descriptions:
        clean_d = smart_truncate(d, 90)
        if clean_d and clean_d.lower() not in seen_d:
            valid_descriptions.append(clean_d)
            seen_d.add(clean_d.lower())

    fallback_desc_pool = [
        smart_truncate(f"Phân phối {short_name} chuẩn chính hãng. Đội ngũ dược sĩ tư vấn tận tình.", 90),
        smart_truncate("Đặt hàng online nhanh chóng, kiểm tra hàng trước khi thanh toán. Mua ngay!", 90),
        smart_truncate("Sản phẩm an toàn, rõ nguồn gốc xuất xứ, hỗ trợ cải thiện làn da hiệu quả.", 90),
        smart_truncate("Giao hàng tận nơi toàn quốc, hỗ trợ 24/7. Xem chi tiết và đặt hàng tại đây!", 90)
    ]
    for fd in fallback_desc_pool:
        if len(valid_descriptions) >= 4:
            break
        if fd.lower() not in seen_d:
            valid_descriptions.append(fd)
            seen_d.add(fd.lower())
    valid_descriptions = valid_descriptions[:4]

    # 4. Tên nhóm quảng cáo
    ad_group_name = data.get("ad_group_name", f"Nhóm {short_name} | {today_str}")
    if not ad_group_name.startswith("Nhóm "):
        ad_group_name = f"Nhóm {ad_group_name}"
    if "|" not in ad_group_name:
        ad_group_name = f"{ad_group_name} | {today_str}"

    return {
        "campaign_name": camp_name,
        "ad_group_name": ad_group_name,
        "product_short_name": short_name,
        "final_url": url,
        "path1": path1,
        "path2": path2,
        "headlines": valid_headlines,
        "descriptions": valid_descriptions,
        "keywords": data.get("keywords", []),
        "images": product_data.get("images", [])
    }

if __name__ == "__main__":
    from scraper import extract_product_data
    test_url = "https://khaihoanderma.com/product/lozivate-mf-30g-thuoc-mo-boi-da-day-sung-bong-vay/"
    print("1. Đang cào dữ liệu...")
    p_data = extract_product_data(test_url)
    print("2. Đang gọi Gemini 3.8 Flash tạo quảng cáo...")
    ad_res = generate_google_ads_content(p_data)
    print("\n--- KẾT QUẢ TẠO QUẢNG CÁO ---")
    print(f"Chiến dịch: {ad_res['campaign_name']}")
    print(f"Nhóm quảng cáo: {ad_res['ad_group_name']}")
    print(f"Đường dẫn: /{ad_res['path1']}/{ad_res['path2']}")
    print("\nTiêu đề (15):")
    for i, h in enumerate(ad_res['headlines'], 1):
        print(f" {i}. [{len(h)} ký tự] {h}")
    print("\nĐoạn mô tả (4):")
    for i, d in enumerate(ad_res['descriptions'], 1):
        print(f" {i}. [{len(d)} ký tự] {d}")
    print("\nTừ khóa:")
    for kw in ad_res['keywords'][:5]:
        print(f" - {kw}")

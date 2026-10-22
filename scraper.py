import os
import sys
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from PIL import Image
from io import BytesIO

# Cấu hình UTF-8 cho console Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def clean_filename(name: str) -> str:
    """Loại bỏ ký tự đặc biệt để tạo tên thư mục/file an toàn."""
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r'\s+', "_", clean.strip())
    return clean[:50]

def extract_product_data(url: str, output_dir: str = "output", custom_images_dir: str = None) -> dict:
    """
    Cào nội dung sản phẩm và ảnh từ đường dẫn URL.
    Trả về:
    {
        "url": url,
        "title": title,
        "description": text_content,
        "price": price,
        "images": [{"url": ..., "local_path": ..., "width": ..., "height": ..., "aspect_ratio": ...}]
    }
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
    
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    response.encoding = 'utf-8'
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 1. Trích xuất tiêu đề sản phẩm
    title = ""
    h1 = soup.find('h1')
    if h1:
        title = h1.get_text(strip=True)
    if not title:
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            title = og_title['content'].strip()
    if not title:
        title = soup.title.get_text(strip=True) if soup.title else "Sản phẩm"
        
    # Loại bỏ tên website trong title nếu có (ví dụ: " - Khải Hoàn Derma")
    title = re.split(r'[-–—|]\s*(?:Khải Hoàn|Khai Hoan|Website|Trang chủ)', title, flags=re.IGNORECASE)[0].strip()

    # 2. Trích xuất nội dung mô tả sản phẩm
    desc_parts = []
    
    # WooCommerce short desc
    short_desc = soup.find('div', class_=re.compile(r'woocommerce-product-details__short-description|product-short-description'))
    if short_desc:
        desc_parts.append(short_desc.get_text("\n", strip=True))
        
    # WooCommerce full desc / tab description
    full_desc = soup.find('div', id='tab-description') or soup.find('div', class_=re.compile(r'product-description|entry-content'))
    if full_desc:
        desc_parts.append(full_desc.get_text("\n", strip=True))
        
    # Meta description làm dự phòng
    meta_desc = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', property='og:description')
    if meta_desc and meta_desc.get('content'):
        desc_parts.append(meta_desc['content'].strip())
        
    # Nếu vẫn trống, lấy các đoạn văn bản chính
    if not desc_parts:
        for p in soup.find_all('p'):
            t = p.get_text(strip=True)
            if len(t) > 40:
                desc_parts.append(t)
                
    combined_desc = "\n\n".join(desc_parts)
    # Cắt gọn nếu quá dài để tối ưu token
    if len(combined_desc) > 4000:
        combined_desc = combined_desc[:4000]

    # 3. Trích xuất giá (nếu có)
    price = ""
    price_tag = soup.find('span', class_=re.compile(r'woocommerce-Price-amount|current-price|price'))
    if price_tag:
        price = price_tag.get_text(strip=True)

    # 4. Tìm kiếm và tải ảnh sản phẩm
    img_candidates = []
    
    # Ưu tiên og:image
    og_img = soup.find('meta', property='og:image')
    if og_img and og_img.get('content'):
        img_candidates.append(urljoin(url, og_img['content']))
        
    # Thư viện ảnh WooCommerce / gallery
    for img in soup.find_all('img'):
        src = (
            img.get('data-large_image') or 
            img.get('data-src') or 
            img.get('data-lazy-src') or 
            img.get('src')
        )
        if not src:
            continue
        full_src = urljoin(url, src)
        
        # Lọc bỏ ảnh rác, icon, logo, thanh toán
        lower_src = full_src.lower()
        if any(skip in lower_src for skip in ['logo', 'icon', 'banner', 'avatar', 'payment', 'star', 'badge', 'cart']):
            continue
            
        # Ưu tiên ảnh nằm trong wp-content/uploads hoặc images
        if 'wp-content/uploads' in lower_src or '/images/' in lower_src or '/products/' in lower_src:
            # Bỏ query params (ví dụ ?khdv=...)
            clean_url = full_src.split('?')[0]
            if clean_url not in img_candidates:
                img_candidates.append(clean_url)

    # Tạo thư mục tải ảnh riêng cho sản phẩm trong thư mục chính
    from config_manager import load_config
    cfg = load_config()
    root_dir = custom_images_dir.strip() if (custom_images_dir and custom_images_dir.strip()) else cfg.get("root_images_dir", os.path.join(output_dir, "images"))
    folder_name = clean_filename(title)
    images_dir = os.path.join(root_dir, folder_name)
    os.makedirs(images_dir, exist_ok=True)
    
    downloaded_images = []
    seen_hashes = set()
    
    for idx, img_url in enumerate(img_candidates[:8], start=1):
        try:
            r = requests.get(img_url, headers=headers, timeout=10)
            if r.status_code != 200:
                continue
                
            img_bytes = r.content
            img_hash = hash(img_bytes[:1024])
            if img_hash in seen_hashes:
                continue
            seen_hashes.add(img_hash)
            
            # Kiểm tra kích thước bằng PIL
            pil_img = Image.open(BytesIO(img_bytes))
            width, height = pil_img.size
            
            # Google Ads yêu cầu ảnh tối thiểu 300x300 cho logo/ảnh vuông
            if width < 250 or height < 250:
                continue
                
            ext = pil_img.format.lower() if pil_img.format else "jpg"
            if ext == "jpeg":
                ext = "jpg"
            elif ext == "webp":
                # Google Ads có thể cần JPEG/PNG hoặc webp, ta giữ nguyên hoặc save jpg
                ext = "jpg"
                pil_img = pil_img.convert("RGB")
                
            local_filename = f"image_{idx}_{width}x{height}.{ext}"
            local_path = os.path.join(images_dir, local_filename)
            
            if ext == "jpg":
                pil_img.save(local_path, "JPEG", quality=95)
            else:
                pil_img.save(local_path)
                
            ratio = round(width / height, 2)
            downloaded_images.append({
                "url": img_url,
                "local_path": os.path.abspath(local_path),
                "width": width,
                "height": height,
                "ratio": ratio,
                "type": "Square 1:1" if 0.9 <= ratio <= 1.1 else ("Landscape 1.91:1" if 1.7 <= ratio <= 2.1 else "Other")
            })
        except Exception as e:
            continue

    return {
        "url": url,
        "title": title,
        "description": combined_desc,
        "price": price,
        "images": downloaded_images
    }

if __name__ == "__main__":
    test_url = "https://khaihoanderma.com/product/lozivate-mf-30g-thuoc-mo-boi-da-day-sung-bong-vay/"
    print(f"Đang kiểm tra cào sản phẩm: {test_url}")
    data = extract_product_data(test_url)
    print(f"Tiêu đề: {data['title']}")
    print(f"Số ảnh hợp lệ tải về: {len(data['images'])}")
    for img in data['images']:
        print(f" - {img['local_path']} ({img['width']}x{img['height']}, {img['type']})")

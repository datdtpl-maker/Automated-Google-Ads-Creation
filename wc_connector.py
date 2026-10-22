import os
import sys
import re
import requests
from requests.auth import HTTPBasicAuth
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
from config_manager import load_config

# Cấu hình UTF-8
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_wc_settings():
    cfg = load_config()
    url = cfg.get("wp_url", "https://khaihoanderma.com").rstrip("/")
    user = cfg.get("wp_user", "admin")
    password = cfg.get("wp_app_password", "")
    return url, user, password

def get_auth(wp_user=None, wp_password=None):
    if wp_user and wp_password:
        return HTTPBasicAuth(wp_user, wp_password)
    _, user, password = get_wc_settings()
    return HTTPBasicAuth(user, password)

def clean_filename(name: str) -> str:
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r'\s+', "_", clean.strip())
    return clean[:60]

def search_products(keyword: str, limit: int = 10, wp_url: str = None, wp_user: str = None, wp_password: str = None) -> list:
    """
    Tìm kiếm sản phẩm theo tên qua WooCommerce REST API.
    Trả về danh sách gợi ý cho ô tìm kiếm autocomplete.
    """
    default_url, default_user, default_pass = get_wc_settings()
    target_url = (wp_url or default_url).rstrip("/")
    auth = HTTPBasicAuth(wp_user, wp_password) if (wp_user and wp_password) else HTTPBasicAuth(default_user, default_pass)

    if not keyword or len(keyword.strip()) < 1:
        endpoint = f"{target_url}/wp-json/wc/v3/products?per_page={limit}&status=publish"
    else:
        endpoint = f"{target_url}/wp-json/wc/v3/products?search={requests.utils.quote(keyword.strip())}&per_page={limit}&status=publish"

    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(endpoint, auth=auth, headers=headers, timeout=12)
        res.raise_for_status()
        products = res.json()
        
        results = []
        for p in products:
            price_val = p.get("price", "")
            price_str = f"{int(price_val):,}đ".replace(",", ".") if price_val and str(price_val).isdigit() else f"{price_val}đ" if price_val else ""
            
            thumb = ""
            images = p.get("images", [])
            if images and len(images) > 0:
                thumb = images[0].get("src", "")
                
            results.append({
                "id": p.get("id"),
                "name": p.get("name"),
                "slug": p.get("slug"),
                "permalink": p.get("permalink"),
                "price": price_str,
                "thumbnail": thumb
            })
        return results
    except Exception as e:
        print(f"Lỗi khi tìm kiếm sản phẩm: {e}")
        return []

def get_product_details_by_id(
    product_id: int, 
    output_dir: str = "output", 
    custom_images_dir: str = "",
    wp_url: str = None,
    wp_user: str = None,
    wp_password: str = None
) -> dict:
    """
    Lấy chi tiết sản phẩm trực tiếp từ WooCommerce REST API qua Product ID.
    Tải toàn bộ hình ảnh sản phẩm chất lượng cao về thư mục máy tính.
    """
    default_url, default_user, default_pass = get_wc_settings()
    target_url = (wp_url or default_url).rstrip("/")
    auth = HTTPBasicAuth(wp_user, wp_password) if (wp_user and wp_password) else HTTPBasicAuth(default_user, default_pass)

    endpoint = f"{target_url}/wp-json/wc/v3/products/{product_id}"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    res = requests.get(endpoint, auth=auth, headers=headers, timeout=15)
    res.raise_for_status()
    p = res.json()
    
    title = p.get("name", "Sản phẩm")
    permalink = p.get("permalink", "")
    
    # Làm sạch mô tả HTML
    raw_desc = p.get("description", "") or p.get("short_description", "")
    soup = BeautifulSoup(raw_desc, "html.parser")
    clean_desc = soup.get_text("\n", strip=True)
    if len(clean_desc) > 4000:
        clean_desc = clean_desc[:4000]
        
    price_val = p.get("price", "")
    price_str = f"{int(price_val):,}đ".replace(",", ".") if price_val and str(price_val).isdigit() else f"{price_val}đ" if price_val else ""

    # Xác định thư mục chính và thư mục con theo tên sản phẩm
    cfg = load_config()
    root_dir = custom_images_dir.strip() if (custom_images_dir and custom_images_dir.strip()) else cfg.get("root_images_dir", os.path.join(output_dir, "images"))
    folder_name = clean_filename(title)
    images_dir = os.path.join(root_dir, folder_name)
    os.makedirs(images_dir, exist_ok=True)
    
    downloaded_images = []
    seen_hashes = set()
    
    for idx, img_obj in enumerate(p.get("images", []), start=1):
        img_url = img_obj.get("src", "")
        if not img_url:
            continue
        try:
            r = requests.get(img_url, headers=headers, timeout=12)
            if r.status_code != 200:
                continue
            
            img_bytes = r.content
            img_hash = hash(img_bytes[:1024])
            if img_hash in seen_hashes:
                continue
            seen_hashes.add(img_hash)
            
            pil_img = Image.open(BytesIO(img_bytes))
            width, height = pil_img.size
            if width < 250 or height < 250:
                continue
                
            ext = pil_img.format.lower() if pil_img.format else "jpg"
            if ext in ["jpeg", "webp"]:
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
        except Exception:
            continue

    return {
        "url": permalink,
        "title": title,
        "description": clean_desc,
        "price": price_str,
        "images": downloaded_images,
        "images_dir": os.path.abspath(images_dir),
        "root_images_dir": os.path.abspath(root_dir)
    }

if __name__ == "__main__":
    print("Kiểm tra tìm kiếm sản phẩm 'Lozivate':")
    items = search_products("Lozivate", limit=3)
    for it in items:
        print(f" - [{it['id']}] {it['name']} ({it['price']}) -> {it['permalink']}")
    if items:
        print("\nKiểm tra lấy chi tiết sản phẩm đầu tiên:")
        details = get_product_details_by_id(items[0]['id'])
        print(f" Tiêu đề: {details['title']}")
        print(f" Giá: {details['price']}")
        print(f" Số ảnh tải về: {len(details['images'])}")
        print(f" Thư mục ảnh: {details['images_dir']}")

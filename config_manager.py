import os
import sys
import json
from dotenv import load_dotenv

# Cấu hình UTF-8 cho console Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

project_dir = os.path.dirname(os.path.abspath(__file__))
config_file = os.path.join(project_dir, "config.json")
env_file = os.path.join(project_dir, ".env")

# Tải trước biến môi trường từ .env nếu có
if os.path.exists(env_file):
    load_dotenv(env_file)

DEFAULT_CONFIG = {
    "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
    "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
    "wp_url": os.getenv("WP_URL", "https://khaihoanderma.com"),
    "wp_user": os.getenv("WP_USER", "admin"),
    "wp_app_password": os.getenv("WP_APP_PASSWORD", ""),
    "default_campaign_name": os.getenv("DEFAULT_CAMPAIGN_NAME", "Chiến dịch sản phẩm Web Derma | 22/10"),
    "max_cpc": int(os.getenv("MAX_CPC", "2000")),
    "root_images_dir": os.getenv("ROOT_IMAGES_DIR", os.path.join(project_dir, "output", "images"))
}

def load_config() -> dict:
    """Nạp cấu hình từ config.json, nếu chưa có thì khởi tạo từ mặc định."""
    config = dict(DEFAULT_CONFIG)
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                config.update(saved)
        except Exception as e:
            print(f"Lỗi khi đọc config.json: {e}")
    else:
        # Tự động tạo config.json lần đầu
        save_config(config)
    return config

def save_config(new_data: dict) -> dict:
    """Lưu cấu hình vào config.json và đồng bộ biến môi trường."""
    current = dict(DEFAULT_CONFIG)
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                current.update(json.load(f))
        except Exception:
            pass

    current.update(new_data)
    
    # Ép kiểu dữ liệu chuẩn
    if "max_cpc" in current:
        try:
            current["max_cpc"] = int(current["max_cpc"])
        except ValueError:
            current["max_cpc"] = 2000

    # Lưu file config.json cục bộ
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=4, ensure_ascii=False)

    # Đồng bộ biến môi trường đang chạy
    if current.get("gemini_api_key"):
        os.environ["GEMINI_API_KEY"] = str(current["gemini_api_key"])
    if current.get("gemini_model"):
        os.environ["GEMINI_MODEL"] = str(current["gemini_model"])
    if current.get("wp_url"):
        os.environ["WP_URL"] = str(current["wp_url"])
    if current.get("wp_user"):
        os.environ["WP_USER"] = str(current["wp_user"])
    if current.get("wp_app_password"):
        os.environ["WP_APP_PASSWORD"] = str(current["wp_app_password"])

    return current

if __name__ == "__main__":
    cfg = load_config()
    print("Cấu hình hiện tại:")
    for k, v in cfg.items():
        if "key" in k or "password" in k:
            masked = v[:6] + "..." + v[-4:] if len(v) > 10 else "***"
            print(f" - {k}: {masked}")
        else:
            print(f" - {k}: {v}")

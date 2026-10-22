import os
import sys
import argparse
import subprocess
from dotenv import load_dotenv

# Cấu hình UTF-8 cho console Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from scraper import extract_product_data
from gemini_ad_writer import generate_google_ads_content
from exporter import export_to_google_ads_files

def run_pipeline(url: str, campaign_name: str = None, output_dir: str = None):
    project_root = os.path.dirname(os.path.abspath(__file__))
    out_dir = output_dir or os.path.join(project_root, "output")
    os.makedirs(out_dir, exist_ok=True)
    
    print("\n" + "=" * 65)
    print("🚀 GOOGLE ADS AUTOMATION - GEMINI 3.8 FLASH")
    print("=" * 65)
    print(f"🔗 URL sản phẩm : {url}")
    if campaign_name:
        print(f"🎯 Chiến dịch   : {campaign_name}")
    
    # Bước 1: Cào thông tin & tải ảnh
    print("\n[Bước 1/3] Đang cào thông tin bài viết & tải ảnh sản phẩm từ website...")
    product_data = extract_product_data(url, output_dir=out_dir)
    print(f"  ✓ Tiêu đề nhận diện : {product_data['title']}")
    print(f"  ✓ Giá sản phẩm      : {product_data['price'] if product_data['price'] else 'Không có'}")
    print(f"  ✓ Số ảnh tải về     : {len(product_data['images'])} ảnh chuẩn kích thước")
    for img in product_data['images']:
        print(f"    - {os.path.basename(img['local_path'])} ({img['width']}x{img['height']}, {img['type']})")

    # Bước 2: Gọi Gemini 3.8 Flash sinh nội dung quảng cáo
    print("\n[Bước 2/3] Đang gọi Gemini 3.8 Flash sinh Tiêu đề, Mô tả & Từ khóa...")
    ad_data = generate_google_ads_content(product_data, campaign_name=campaign_name)
    print(f"  ✓ Tên nhóm mới     : {ad_data['ad_group_name']}")
    print(f"  ✓ Đường dẫn hiển thị: /{ad_data['path1']}/{ad_data['path2']}")
    print(f"  ✓ Số tiêu đề (15)  : Đã tối ưu (<= 30 ký tự/tiêu đề)")
    print(f"  ✓ Số mô tả (4)     : Đã tối ưu (<= 90 ký tự/mô tả)")
    print(f"  ✓ Số từ khóa       : {len(ad_data['keywords'])} từ khóa (Đối sánh cụm từ & chính xác)")

    # Bước 3: Xuất file dữ liệu
    print("\n[Bước 3/3] Đang xuất file Google Ads Editor & file Copy-Paste...")
    exported_files = export_to_google_ads_files(ad_data, output_dir=out_dir)
    print(f"  ✓ File CSV Ads      : {exported_files['ads_csv']}")
    print(f"  ✓ File CSV Keywords : {exported_files['keywords_csv']}")
    print(f"  ✓ File Excel Bundle : {exported_files['excel']}")
    print(f"  ✓ File Quick Copy   : {exported_files['quick_copy_txt']}")

    print("\n" + "=" * 65)
    print("✅ HOÀN TẤT THÀNH CÔNG!")
    print("=" * 65)
    print(f"📁 Thư mục kết quả: {out_dir}")
    print("\nCÁCH DÙNG TIẾP THEO:")
    print("1. Cách 1 (Nhanh nhất - Dán trực tiếp Web):")
    print(f"   Mở file '{exported_files['quick_copy_txt']}' copy từng dòng vào ô tạo Ads trên ads.google.com.")
    print("2. Cách 2 (Google Ads Editor):")
    print(f"   Mở Google Ads Editor -> Tài khoản -> Nhập -> Nạp file '{exported_files['ads_csv']}'.")
    print("=" * 65 + "\n")
    
    return exported_files

def main():
    parser = argparse.ArgumentParser(description="Tool tự động lên Camp Google Ads từ link sản phẩm")
    parser.add_argument("--url", type=str, help="Đường dẫn link sản phẩm/bài viết")
    parser.add_argument("--campaign", type=str, help="Tên chiến dịch Google Ads")
    parser.add_argument("--out", type=str, help="Thư mục xuất file")
    
    args = parser.parse_args()
    
    url = args.url
    if not url:
        print("--- CÔNG CỤ TỰ ĐỘNG TẠO NHÓM & QUẢNG CÁO GOOGLE ADS ---")
        url = input("Vui lòng nhập Link sản phẩm (bấm Enter để dùng link mặc định): ").strip()
        if not url:
            url = "https://khaihoanderma.com/product/lozivate-mf-30g-thuoc-mo-boi-da-day-sung-bong-vay/"
            
    campaign = args.campaign
    run_pipeline(url, campaign_name=campaign, output_dir=args.out)

if __name__ == "__main__":
    main()

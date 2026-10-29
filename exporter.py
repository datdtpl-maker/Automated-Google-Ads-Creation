import os
import sys
import re
import csv
import zipfile
import shutil
import pandas as pd

# Cấu hình UTF-8 cho console Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def export_to_google_ads_files(ad_data: dict, output_dir: str = "output", max_cpc: int = None) -> dict:
    """
    Xuất dữ liệu quảng cáo ra file CSV All-in-One chuẩn Google Ads Web và Excel/Text.
    """
    from config_manager import load_config
    if max_cpc is None:
        cfg = load_config()
        max_cpc = cfg.get("max_cpc", 2000)

    os.makedirs(output_dir, exist_ok=True)
    clean_name = re.sub(r'[\\/*?:"<>|]', "", ad_data["product_short_name"]).replace(" ", "_")[:30]
    
    # 1. Chuẩn bị dữ liệu Tạo Nhóm (Ad Group - dành cho Google Ads Web Bulk Upload)
    ad_group_row = {
        "Campaign": ad_data["campaign_name"],
        "Ad group": ad_data["ad_group_name"],
        "Campaign status": "Enabled",
        "Ad group status": "Enabled",
        "Max CPC": max_cpc
    }
    df_ad_group = pd.DataFrame([ad_group_row])
    ad_group_csv_path = os.path.join(output_dir, f"01_tao_nhom_{clean_name}.csv")
    df_ad_group.to_csv(ad_group_csv_path, index=False, encoding="utf-8-sig")

    # 2. Chuẩn bị dữ liệu Quảng cáo (Ads)
    ads_row = {
        "Campaign": ad_data["campaign_name"],
        "Ad Group": ad_data["ad_group_name"],
        "Ad type": "Responsive search ad",
        "Final URL": ad_data["final_url"],
        "Path 1": ad_data["path1"],
        "Path 2": ad_data["path2"],
    }
    for i in range(1, 16):
        h_val = ad_data["headlines"][i - 1] if i - 1 < len(ad_data["headlines"]) else ""
        ads_row[f"Headline {i}"] = h_val
        
    for i in range(1, 5):
        d_val = ad_data["descriptions"][i - 1] if i - 1 < len(ad_data["descriptions"]) else ""
        ads_row[f"Description {i}"] = d_val

    df_ads = pd.DataFrame([ads_row])
    
    # 3. Chuẩn bị dữ liệu Từ khóa (Keywords)
    kw_rows = []
    for raw_kw in ad_data.get("keywords", []):
        kw_clean = raw_kw.strip()
        criterion_type = "Broad"
        
        if kw_clean.startswith('"') and kw_clean.endswith('"'):
            criterion_type = "Phrase"
            kw_clean = kw_clean[1:-1].strip()
        elif kw_clean.startswith('[') and kw_clean.endswith(']'):
            criterion_type = "Exact"
            kw_clean = kw_clean[1:-1].strip()
            
        kw_rows.append({
            "Campaign": ad_data["campaign_name"],
            "Ad Group": ad_data["ad_group_name"],
            "Keyword": kw_clean,
            "Criterion Type": criterion_type
        })
        
    df_keywords = pd.DataFrame(kw_rows)
    
    # Xuất file ALL-IN-ONE (1 File CSV duy nhất chuẩn 100% Web Bulk Upload: Nhóm, Quảng Cáo, Từ Khóa)
    columns_all = [
        'Campaign', 'Campaign Type', 'Campaign status', 'Networks', 'Ad group', 'Ad group status', 'Max CPC',
        'Ad type', 'Final URL', 'Path 1', 'Path 2'
    ] + [f'Headline {i}' for i in range(1, 16)] + [f'Description {i}' for i in range(1, 5)] + [
        'Keyword', 'Criterion Type'
    ]
    all_in_one_rows = []

    # Dòng 1: Khởi tạo Nhóm (Ad Group) - Mặc định Max CPC
    row_ag = {col: '' for col in columns_all}
    row_ag['Campaign'] = ad_data["campaign_name"]
    row_ag['Campaign Type'] = 'Search'
    row_ag['Campaign status'] = 'Enabled'
    row_ag['Networks'] = 'Google search'
    row_ag['Ad group'] = ad_data["ad_group_name"]
    row_ag['Ad group status'] = 'Enabled'
    row_ag['Max CPC'] = max_cpc
    all_in_one_rows.append(row_ag)

    # Dòng 2: Khởi tạo Mẫu quảng cáo thích ứng (Responsive Search Ad)
    row_ad = {col: '' for col in columns_all}
    row_ad['Campaign'] = ad_data["campaign_name"]
    row_ad['Ad group'] = ad_data["ad_group_name"]
    row_ad['Ad type'] = 'Responsive search ad'
    row_ad['Final URL'] = ad_data["final_url"]
    row_ad['Path 1'] = ad_data["path1"]
    row_ad['Path 2'] = ad_data["path2"]
    for i in range(1, 16):
        h_val = ad_data["headlines"][i - 1] if i - 1 < len(ad_data["headlines"]) else ""
        row_ad[f'Headline {i}'] = h_val
    for i in range(1, 5):
        d_val = ad_data["descriptions"][i - 1] if i - 1 < len(ad_data["descriptions"]) else ""
        row_ad[f'Description {i}'] = d_val
    all_in_one_rows.append(row_ad)

    # Dòng 3..N: Khởi tạo các Từ khóa (Keywords) - Mặc định Max CPC
    for kw_item in kw_rows:
        row_kw = {col: '' for col in columns_all}
        row_kw['Campaign'] = ad_data["campaign_name"]
        row_kw['Ad group'] = ad_data["ad_group_name"]
        row_kw['Keyword'] = kw_item['Keyword']
        row_kw['Criterion Type'] = kw_item['Criterion Type']
        row_kw['Max CPC'] = max_cpc
        all_in_one_rows.append(row_kw)

    df_all_in_one = pd.DataFrame(all_in_one_rows)
    all_in_one_csv_path = os.path.join(output_dir, f"google_ads_all_in_one_{clean_name}.csv")
    df_all_in_one.to_csv(all_in_one_csv_path, index=False, encoding="utf-8-sig")

    # Tạo gói ZIP (nếu cần tham khảo)
    zip_path = os.path.join(output_dir, f"google_ads_editor_bundle_{clean_name}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(all_in_one_csv_path, arcname=f"google_ads_data_{clean_name}.csv")
        for img_info in ad_data.get("images", []):
            local_img = img_info.get("local_path")
            if local_img and os.path.exists(local_img):
                zipf.write(local_img, arcname=os.path.basename(local_img))
                zipf.write(local_img, arcname=os.path.basename(local_img))

    # Đường dẫn các file
    ad_group_csv_path = os.path.join(output_dir, f"01_tao_nhom_{clean_name}.csv")
    ads_csv_path = os.path.join(output_dir, f"02_quang_cao_{clean_name}.csv")
    kw_csv_path = os.path.join(output_dir, f"03_tu_khoa_{clean_name}.csv")
    excel_path = os.path.join(output_dir, f"google_ads_all_in_one_{clean_name}.xlsx")
    txt_path = os.path.join(output_dir, f"quick_copy_{clean_name}.txt")

    # Xuất CSV (UTF-8 with BOM để mở bằng Excel tiếng Việt không bị lỗi font)
    df_ad_group.to_csv(ad_group_csv_path, index=False, encoding="utf-8-sig")
    df_ads.to_csv(ads_csv_path, index=False, encoding="utf-8-sig")
    df_keywords.to_csv(kw_csv_path, index=False, encoding="utf-8-sig")

    # Xuất Excel 3 sheets chuẩn Google Ads
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        df_ad_group.to_excel(writer, sheet_name="Ad groups", index=False)
        df_ads.to_excel(writer, sheet_name="Ads", index=False)
        df_keywords.to_excel(writer, sheet_name="Keywords", index=False)

    # Xuất file Quick Copy Text
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write("   BẢN TÓM TẮT COPY-PASTE NHANH VÀO GOOGLE ADS WEB\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"1. CHIẾN DỊCH: {ad_data['campaign_name']}\n")
        f.write(f"2. NHÓM QUẢNG CÁO: {ad_data['ad_group_name']}\n")
        f.write(f"3. URL CUỐI CÙNG: {ad_data['final_url']}\n")
        f.write(f"4. ĐƯỜNG DẪN HIỂN THỊ: /{ad_data['path1']}/{ad_data['path2']}\n\n")
        
        f.write("-" * 40 + "\n")
        f.write("5. TIÊU ĐỀ (15 Tiêu đề - Tối đa 30 ký tự):\n")
        f.write("-" * 40 + "\n")
        for i, h in enumerate(ad_data["headlines"], start=1):
            f.write(f"Tiêu đề {i:02d} ({len(h):02d}/30 ký tự): {h}\n")
            
        f.write("\n" + "-" * 40 + "\n")
        f.write("6. ĐOẠN MÔ TẢ (4 Mô tả - Tối đa 90 ký tự):\n")
        f.write("-" * 40 + "\n")
        for i, d in enumerate(ad_data["descriptions"], start=1):
            f.write(f"Mô tả {i:02d} ({len(d):02d}/90 ký tự): {d}\n")
            
        f.write("\n" + "-" * 40 + "\n")
        f.write("7. TỪ KHÓA TÌM KIẾM (Keywords):\n")
        f.write("-" * 40 + "\n")
        for kw in ad_data.get("keywords", []):
            f.write(f"{kw}\n")
            
        f.write("\n" + "-" * 40 + "\n")
        f.write("8. HÌNH ẢNH SẢN PHẨM ĐÃ TẢI VỀ MÁY (Đính kèm Image Assets):\n")
        f.write("-" * 40 + "\n")
        for i, img in enumerate(ad_data.get("images", []), start=1):
            f.write(f"Ảnh {i} [{img['width']}x{img['height']} - {img['type']}]:\n  -> Đường dẫn file: {img['local_path']}\n")

    return {
        "editor_zip": zip_path,
        "all_in_one_csv": all_in_one_csv_path,
        "ad_group_csv": ad_group_csv_path,
        "ads_csv": ads_csv_path,
        "keywords_csv": kw_csv_path,
        "excel": excel_path,
        "quick_copy_txt": txt_path
    }

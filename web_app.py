import os
import sys
import re
import subprocess
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

# Cấu hình UTF-8
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config_manager import load_config, save_config
from scraper import extract_product_data
from gemini_ad_writer import generate_google_ads_content
from exporter import export_to_google_ads_files
from wc_connector import search_products, get_product_details_by_id

app = FastAPI(title="Google Ads Auto Generator")
project_dir = os.path.dirname(os.path.abspath(__file__))
output_dir = os.path.join(project_dir, "output")
os.makedirs(output_dir, exist_ok=True)

class ConfigRequest(BaseModel):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    wp_url: str = ""
    wp_user: str = ""
    wp_app_password: str = ""
    default_campaign_name: str = ""
    max_cpc: int = 2000
    root_images_dir: str = ""

class GenerateRequest(BaseModel):
    url: str = ""
    product_id: int = 0
    campaign_name: str = ""
    custom_images_dir: str = ""
    max_cpc: int = 2000

@app.get("/", response_class=HTMLResponse)
async def index():
    html_content = """
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Ads Campaign Auto-Generator | Native Windows App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .char-badge {
            font-size: 0.72rem;
            padding: 2px 6px;
            border-radius: 9999px;
            font-weight: 600;
        }
        .char-safe { background-color: #DEF7EC; color: #03543F; }
        .char-warn { background-color: #FEF08A; color: #713F12; }
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #F1F5F9; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
    </style>
</head>
<body class="bg-slate-100 min-h-screen text-slate-800 flex flex-col font-sans">
    <!-- Header -->
    <header class="bg-indigo-600 text-white shadow-md sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <i class="fa-brands fa-google text-2xl text-amber-300"></i>
                <div>
                    <h1 class="text-base sm:text-lg font-bold leading-tight">Google Ads Campaign Auto-Generator</h1>
                    <div class="text-[11px] text-indigo-200 flex items-center gap-2">
                        <span>Gemini 3.8 Flash &times; WooCommerce API</span>
                        <span class="inline-block w-1 h-1 rounded-full bg-indigo-300"></span>
                        <span class="text-emerald-300 font-medium">Native Windows Application</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <span id="conn_badge" class="text-xs bg-emerald-500/20 text-emerald-100 border border-emerald-400/30 px-3 py-1 rounded-full font-medium flex items-center">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Sẵn sàng hoạt động
                </span>
            </div>
        </div>
    </header>

    <!-- Main Container: 2-Column Responsive Layout -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <!-- Toast Notification -->
        <div id="toast" class="hidden fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-slate-700 transition">
            <i class="fa-solid fa-circle-check text-emerald-400 text-base" id="toast_icon"></i>
            <span id="toast_msg">Thông báo</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <!-- CỘT TRÁI: CẤU HÌNH HỆ THỐNG (Settings Column - 4 cols) -->
            <div class="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 sticky top-20">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 class="text-sm font-bold text-slate-900 flex items-center">
                        <i class="fa-solid fa-gears text-indigo-500 mr-2"></i> CẤU HÌNH HỆ THỐNG
                    </h2>
                    <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-semibold">Lưu nội bộ</span>
                </div>

                <div class="space-y-3.5 text-xs">
                    <!-- Gemini API Key -->
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span>Khóa Gemini API Key</span>
                            <span class="text-[10px] text-indigo-600 hover:underline cursor-pointer" onclick="openGeminiDoc()">Lấy key</span>
                        </label>
                        <div class="relative">
                            <input type="password" id="cfg_gemini_api_key" 
                                class="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                                placeholder="AQ.Ab8RN...">
                            <button type="button" onclick="togglePasswordVisibility('cfg_gemini_api_key', this)" 
                                class="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                                <i class="fa-regular fa-eye text-xs"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Gemini Model -->
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Mô hình AI Gemini</label>
                        <select id="cfg_gemini_model" class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 bg-white">
                            <option value="gemini-3.8-flash">gemini-3.8-flash (Tối ưu nhất - Siêu nhanh & Thông minh)</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                        </select>
                    </div>

                    <!-- Website URL -->
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Địa chỉ Website (WooCommerce URL)</label>
                        <input type="text" id="cfg_wp_url" 
                            class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://khaihoanderma.com">
                    </div>

                    <!-- WP User & App Password -->
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block font-semibold text-slate-700 mb-1">Tài khoản Web</label>
                            <input type="text" id="cfg_wp_user" 
                                class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                                placeholder="admin">
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-700 mb-1">Mật khẩu ứng dụng</label>
                            <div class="relative">
                                <input type="password" id="cfg_wp_app_password" 
                                    class="w-full pl-2.5 pr-8 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                                    placeholder="xxxx xxxx xxxx xxxx">
                                <button type="button" onclick="togglePasswordVisibility('cfg_wp_app_password', this)" 
                                    class="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600">
                                    <i class="fa-regular fa-eye text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Root Images Directory -->
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                            <span><i class="fa-solid fa-folder-tree text-amber-500 mr-1"></i> Thư mục ảnh chính (Root Directory)</span>
                        </label>
                        <div class="flex items-center space-x-1.5">
                            <input type="text" id="cfg_root_images_dir" 
                                class="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                                placeholder="D:\\Project Anti\\Auto-Google-Ads\\output\\images">
                            <button type="button" onclick="openRootFolder()" title="Mở thư mục chính trên máy tính" 
                                class="bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-2 rounded-lg text-slate-700">
                                <i class="fa-regular fa-folder-open text-xs"></i>
                            </button>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-1 italic">
                            * Tool tự động tạo thư mục con theo tên sản phẩm bên trong thư mục này.
                        </p>
                    </div>

                    <!-- Max CPC & Campaign Name -->
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block font-semibold text-slate-700 mb-1">Giá thầu CPC tối đa (VNĐ)</label>
                            <input type="number" id="cfg_max_cpc" 
                                class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-xs focus:ring-2 focus:ring-indigo-500"
                                value="2000" min="500" step="500">
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-700 mb-1">Chiến dịch mặc định</label>
                            <input type="text" id="cfg_default_campaign_name" 
                                class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                                value="Chiến dịch sản phẩm Web Derma | 22/10">
                        </div>
                    </div>

                    <!-- Nút Lưu Cấu Hình Nội Bộ -->
                    <div class="pt-2">
                        <button type="button" onclick="saveSystemConfig()" id="btn_save_config"
                            class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-xs flex items-center justify-center shadow transition duration-150">
                            <i class="fa-solid fa-floppy-disk mr-2 text-emerald-400"></i> LƯU CẤU HÌNH NỘI BỘ VÀO MÁY
                        </button>
                    </div>
                </div>
            </div>

            <!-- CỘT PHẢI: KHÔNG GIAN LÀM VIỆC TẠO QUẢNG CÁO (8 cols) -->
            <div class="lg:col-span-8 space-y-6">
                <!-- Card Input Sản Phẩm -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div class="flex items-center justify-between mb-2">
                        <h2 class="text-base font-bold text-slate-900 flex items-center">
                            <i class="fa-solid fa-magnifying-glass text-indigo-500 mr-2"></i> Chọn Sản Phẩm Để Lên Chiến Dịch Google Ads
                        </h2>
                        <span class="text-[11px] text-slate-500">Dữ liệu lấy tự động từ Web</span>
                    </div>
                    <p class="text-xs text-slate-500 mb-4">Gõ tên sản phẩm vào ô tìm kiếm &rarr; chọn từ danh sách gợi ý &rarr; bấm Tạo Quảng Cáo.</p>

                    <div class="space-y-4 mb-4">
                        <!-- Autocomplete Search Bar -->
                        <div class="relative">
                            <label class="block text-xs font-semibold text-slate-700 mb-1">TÌM KIẾM SẢN PHẨM (GÕ TÊN ĐỂ CHỌN NHANH)</label>
                            <div class="relative">
                                <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
                                <input type="text" id="product_search_input" oninput="onSearchInput(this.value)" onfocus="onSearchFocus()"
                                    class="w-full pl-10 pr-10 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium shadow-sm"
                                    placeholder="Gõ tên sản phẩm... ví dụ: Lozivate, Aze Fox, Munderm, kem bôi..." autocomplete="off">
                                <button id="btn_clear_search" onclick="clearSearch()" class="hidden absolute right-3.5 top-3 text-slate-400 hover:text-slate-600">
                                    <i class="fa-solid fa-circle-xmark text-lg"></i>
                                </button>
                            </div>

                            <!-- Dropdown Results -->
                            <div id="search_dropdown" class="hidden absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50 divide-y divide-slate-100">
                            </div>
                        </div>

                        <!-- Selected Product Banner (Visible when selected) -->
                        <div id="selected_product_card" class="hidden bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between">
                            <div class="flex items-center space-x-3.5">
                                <img id="selected_thumb" src="" class="w-14 h-14 rounded-lg object-cover border border-indigo-300 bg-white flex-shrink-0">
                                <div>
                                    <span class="text-[10px] bg-indigo-200 text-indigo-900 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Đã chọn sản phẩm</span>
                                    <h4 id="selected_title" class="text-sm font-bold text-slate-900 mt-0.5"></h4>
                                    <span id="selected_price" class="text-xs text-indigo-700 font-semibold"></span>
                                </div>
                            </div>
                            <button onclick="clearSelectedProduct()" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-medium shadow-sm">
                                <i class="fa-solid fa-rotate-left mr-1"></i> Đổi sản phẩm
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="md:col-span-2">
                                <label class="block text-xs font-semibold text-slate-600 mb-1">LINK SẢN PHẨM (TỰ ĐIỀN HOẶC DÁN LINK TÙY Ý)</label>
                                <input type="text" id="product_url" 
                                    class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono bg-slate-50 text-slate-700"
                                    placeholder="https://khaihoanderma.com/product/..." 
                                    value="https://khaihoanderma.com/product/lozivate-mf-30g-thuoc-mo-boi-da-day-sung-bong-vay/">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">TÊN CHIẾN DỊCH GOOGLE ADS</label>
                                <input type="text" id="campaign_name" 
                                    class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-medium"
                                    value="Chiến dịch sản phẩm Web Derma | 22/10">
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span class="text-xs text-slate-500 flex items-center">
                            <i class="fa-solid fa-circle-check text-emerald-500 mr-1.5"></i> Mặc định <strong>CPC: 2.000đ</strong> &bull; Tải ảnh gốc &bull; Gemini 3.8 Flash sinh 15 Tiêu đề & 4 Mô tả
                        </span>
                        <button onclick="generateAds()" id="btn_submit"
                            class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center shadow transition duration-150">
                            <i class="fa-solid fa-bolt mr-2 text-amber-300"></i> Tạo Quảng Cáo Ngay
                        </button>
                    </div>
                </div>

                <!-- Loading Indicator -->
                <div id="loading" class="hidden text-center py-12 bg-white rounded-xl border border-slate-200">
                    <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
                    <p class="mt-4 text-sm font-medium text-slate-700">Đang đồng bộ WooCommerce, tải ảnh gốc vào thư mục con và gọi Gemini 3.8 Flash xử lý...</p>
                    <p class="text-xs text-slate-400 mt-1">Quá trình này thường mất khoảng 5-10 giây.</p>
                </div>

                <!-- Result Container -->
                <div id="result_area" class="hidden space-y-6">
                    <!-- Action Bar & Meta -->
                    <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <span class="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Cấu trúc Google Ads đã sinh (CPC: 2.000đ)</span>
                            <h3 class="text-lg font-bold text-slate-900 mt-1 flex items-center" id="res_ad_group"></h3>
                            <p class="text-xs text-slate-600 mt-0.5">
                                Thuộc chiến dịch: <span class="font-medium text-slate-800" id="res_campaign"></span> | 
                                Đường dẫn hiển thị: <span class="font-mono text-indigo-700 font-semibold" id="res_paths"></span>
                            </p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <button onclick="downloadFile('all_in_one_csv')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center shadow-lg transition transform hover:-translate-y-0.5">
                                <i class="fa-solid fa-file-csv mr-2 text-base text-amber-300"></i> ⭐ TẢI 1 FILE CSV NẠP GOOGLE ADS (ALL-IN-ONE)
                            </button>
                            <button onclick="openFolder()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center shadow transition">
                                <i class="fa-solid fa-folder-open mr-2 text-sm text-indigo-200"></i> 📂 MỞ THƯ MỤC ẢNH VỪA TẢI
                            </button>
                            <button onclick="copyAllText()" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center shadow-sm">
                                <i class="fa-solid fa-copy mr-1.5 text-slate-500"></i> Copy Text
                            </button>
                        </div>
                    </div>

                    <!-- 3-Step Guide for Google Ads Web Upload -->
                    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 shadow-sm">
                        <div class="font-bold text-emerald-800 text-sm mb-2 flex items-center">
                            <i class="fa-solid fa-circle-check text-emerald-600 mr-2 text-base"></i> Quy trình 3 bước nạp nhanh trực tiếp trên Google Ads Web (Không cần app Editor):
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                            <div class="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                                <span class="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] mb-1">Bước 1</span>
                                <p class="font-semibold text-slate-800">Tải File CSV All-in-One</p>
                                <p class="text-slate-600 mt-1">Bấm nút xanh lá <strong>TẢI 1 FILE CSV NẠP GOOGLE ADS</strong>. File đã tích hợp sẵn Nhóm (Ad Group), Quảng cáo RSA 15 tiêu đề/4 mô tả và Từ khóa với <strong>Max CPC: 2.000đ</strong>.</p>
                            </div>
                            <div class="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                                <span class="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] mb-1">Bước 2</span>
                                <p class="font-semibold text-slate-800">Tải lên Google Ads Web</p>
                                <p class="text-slate-600 mt-1">Vào Google Ads Web &rarr; <strong>Công cụ và cài đặt</strong> &rarr; <strong>Tác vụ hàng loạt (Bulk actions)</strong> &rarr; <strong>Tải lên (Uploads)</strong> &rarr; Chọn file CSV vừa tải &rarr; Bấm <strong>Xem trước &amp; Áp dụng</strong>.</p>
                            </div>
                            <div class="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                                <span class="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] mb-1">Bước 3</span>
                                <p class="font-semibold text-slate-800">Gán ảnh từ thư mục máy tính</p>
                                <p class="text-slate-600 mt-1">Bấm nút <strong>📂 MỞ THƯ MỤC ẢNH VỪA TẢI</strong> &rarr; Vào Nhóm quảng cáo trên web &rarr; Mục <strong>Thành phần (Assets) &rarr; Hình ảnh</strong> &rarr; Tải ảnh từ thư mục máy lên là hoàn tất 100%!</p>
                            </div>
                        </div>
                    </div>

                    <!-- Headlines & Descriptions Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- 15 Headlines -->
                        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                            <div class="flex items-center justify-between mb-3 border-b pb-2">
                                <h4 class="font-semibold text-slate-900 text-sm flex items-center">
                                    <i class="fa-solid fa-heading text-indigo-500 mr-2"></i> 15 Tiêu Đề (Tối đa 30 ký tự)
                                </h4>
                                <span class="text-xs text-slate-400">Google Ads RSA</span>
                            </div>
                            <div id="headlines_list" class="space-y-2 max-h-[480px] overflow-y-auto pr-1"></div>
                        </div>

                        <!-- 4 Descriptions & Keywords -->
                        <div class="space-y-6">
                            <!-- Descriptions -->
                            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                <div class="flex items-center justify-between mb-3 border-b pb-2">
                                    <h4 class="font-semibold text-slate-900 text-sm flex items-center">
                                        <i class="fa-solid fa-align-left text-indigo-500 mr-2"></i> 4 Đoạn Mô Tả (Tối đa 90 ký tự)
                                    </h4>
                                    <span class="text-xs text-slate-400">Google Ads RSA</span>
                                </div>
                                <div id="descriptions_list" class="space-y-2.5"></div>
                            </div>

                            <!-- Keywords -->
                            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                                <div class="flex items-center justify-between mb-3 border-b pb-2">
                                    <h4 class="font-semibold text-slate-900 text-sm flex items-center">
                                        <i class="fa-solid fa-key text-amber-500 mr-2"></i> Danh Sách Từ Khóa (Keywords &bull; CPC: 2.000đ)
                                    </h4>
                                    <button onclick="copyKeywords()" class="text-xs text-indigo-600 hover:underline font-medium">Copy từ khóa</button>
                                </div>
                                <div id="keywords_cloud" class="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Product Images Grid -->
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div class="flex items-center justify-between mb-4 border-b pb-2">
                            <div>
                                <h4 class="font-semibold text-slate-900 text-sm flex items-center">
                                    <i class="fa-solid fa-images text-indigo-500 mr-2"></i> Ảnh Sản Phẩm Đã Tải Về Máy (<span id="images_count">0</span> ảnh)
                                </h4>
                                <p class="text-[11px] text-slate-500 mt-0.5" id="images_folder_path"></p>
                            </div>
                            <button onclick="openFolder()" class="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-lg font-semibold flex items-center shadow-xs">
                                <i class="fa-regular fa-folder-open mr-1.5"></i> Mở Thư Mục Này Trên Máy
                            </button>
                        </div>
                        <div id="images_grid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4"></div>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <footer class="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        Khải Hoàn Derma &bull; Google Ads Campaign Automation Suite &bull; Windows Standalone Edition
    </footer>

    <script>
        let currentResult = null;
        let selectedProductId = 0;
        let searchDebounceTimer = null;

        // Tải cấu hình khi khởi động trang
        window.addEventListener('DOMContentLoaded', () => {
            loadSystemConfig();
        });

        function showToast(msg, isSuccess = true) {
            const toast = document.getElementById('toast');
            const icon = document.getElementById('toast_icon');
            const msgEl = document.getElementById('toast_msg');
            msgEl.innerText = msg;
            icon.className = isSuccess ? 'fa-solid fa-circle-check text-emerald-400 text-base' : 'fa-solid fa-circle-exclamation text-rose-400 text-base';
            toast.classList.remove('hidden');
            setTimeout(() => { toast.classList.add('hidden'); }, 3000);
        }

        function togglePasswordVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-regular fa-eye-slash text-xs';
            } else {
                input.type = 'password';
                icon.className = 'fa-regular fa-eye text-xs';
            }
        }

        async function loadSystemConfig() {
            try {
                const res = await fetch('/api/config');
                const cfg = await res.json();
                document.getElementById('cfg_gemini_api_key').value = cfg.gemini_api_key || '';
                document.getElementById('cfg_gemini_model').value = cfg.gemini_model || 'gemini-3.8-flash';
                document.getElementById('cfg_wp_url').value = cfg.wp_url || '';
                document.getElementById('cfg_wp_user').value = cfg.wp_user || '';
                document.getElementById('cfg_wp_app_password').value = cfg.wp_app_password || '';
                document.getElementById('cfg_root_images_dir').value = cfg.root_images_dir || '';
                document.getElementById('cfg_max_cpc').value = cfg.max_cpc || 2000;
                document.getElementById('cfg_default_campaign_name').value = cfg.default_campaign_name || 'Chiến dịch sản phẩm Web Derma | 22/10';
                document.getElementById('campaign_name').value = cfg.default_campaign_name || 'Chiến dịch sản phẩm Web Derma | 22/10';
            } catch (e) {
                console.error('Lỗi khi tải cấu hình:', e);
            }
        }

        async function saveSystemConfig() {
            const btn = document.getElementById('btn_save_config');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Đang lưu...';

            const payload = {
                gemini_api_key: document.getElementById('cfg_gemini_api_key').value.trim(),
                gemini_model: document.getElementById('cfg_gemini_model').value.trim(),
                wp_url: document.getElementById('cfg_wp_url').value.trim(),
                wp_user: document.getElementById('cfg_wp_user').value.trim(),
                wp_app_password: document.getElementById('cfg_wp_app_password').value.trim(),
                root_images_dir: document.getElementById('cfg_root_images_dir').value.trim(),
                max_cpc: parseInt(document.getElementById('cfg_max_cpc').value) || 2000,
                default_campaign_name: document.getElementById('cfg_default_campaign_name').value.trim()
            };

            try {
                const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Không thể lưu cấu hình');
                showToast('Đã lưu cấu hình nội bộ vào máy tính thành công!', true);
            } catch (err) {
                showToast('Lỗi khi lưu cấu hình: ' + err.message, false);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-2 text-emerald-400"></i> LƯU CẤU HÌNH NỘI BỘ VÀO MÁY';
            }
        }

        function onSearchInput(val) {
            clearTimeout(searchDebounceTimer);
            const clearBtn = document.getElementById('btn_clear_search');
            if (val.trim().length > 0) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
            
            searchDebounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/products/search?q=${encodeURIComponent(val.trim())}`);
                    const data = await res.json();
                    renderDropdown(data.products || []);
                } catch (e) {
                    console.error('Search error:', e);
                }
            }, 250);
        }

        function onSearchFocus() {
            const val = document.getElementById('product_search_input').value;
            onSearchInput(val);
        }

        function renderDropdown(products) {
            const dropdown = document.getElementById('search_dropdown');
            dropdown.innerHTML = '';
            if (products.length === 0) {
                dropdown.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Không tìm thấy sản phẩm nào phù hợp</div>';
                dropdown.classList.remove('hidden');
                return;
            }
            
            products.forEach(p => {
                const item = document.createElement('div');
                item.className = 'flex items-center p-3 hover:bg-indigo-50 cursor-pointer transition border-b border-slate-100 last:border-0';
                item.onclick = () => selectProduct(p);
                
                const imgHtml = p.thumbnail 
                    ? `<img src="${p.thumbnail}" class="w-10 h-10 object-cover rounded border border-slate-200 mr-3 flex-shrink-0">`
                    : `<div class="w-10 h-10 bg-slate-100 rounded flex items-center justify-center mr-3 text-slate-400 flex-shrink-0"><i class="fa-solid fa-box"></i></div>`;
                    
                item.innerHTML = `
                    ${imgHtml}
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-bold text-slate-800 truncate">${p.name}</div>
                        <div class="text-[11px] text-slate-500 truncate">${p.permalink}</div>
                    </div>
                    <div class="ml-3 text-xs font-semibold text-emerald-600 flex-shrink-0">
                        ${p.price || ''}
                    </div>
                `;
                dropdown.appendChild(item);
            });
            dropdown.classList.remove('hidden');
        }

        function selectProduct(p) {
            selectedProductId = p.id;
            document.getElementById('product_url').value = p.permalink;
            document.getElementById('product_search_input').value = p.name;
            document.getElementById('search_dropdown').classList.add('hidden');
            
            const card = document.getElementById('selected_product_card');
            document.getElementById('selected_title').innerText = p.name;
            document.getElementById('selected_price').innerText = p.price ? 'Giá: ' + p.price : '';
            const thumb = document.getElementById('selected_thumb');
            if (p.thumbnail) {
                thumb.src = p.thumbnail;
                thumb.classList.remove('hidden');
            } else {
                thumb.classList.add('hidden');
            }
            card.classList.remove('hidden');
        }

        function clearSelectedProduct() {
            selectedProductId = 0;
            document.getElementById('product_search_input').value = '';
            document.getElementById('product_url').value = '';
            document.getElementById('selected_product_card').classList.add('hidden');
            document.getElementById('btn_clear_search').classList.add('hidden');
            document.getElementById('product_search_input').focus();
        }

        function clearSearch() {
            clearSelectedProduct();
        }

        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('search_dropdown');
            const input = document.getElementById('product_search_input');
            if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
                dropdown.classList.add('hidden');
            }
        });

        async function generateAds() {
            const url = document.getElementById('product_url').value.trim();
            const campaign_name = document.getElementById('campaign_name').value.trim();
            const custom_images_dir = document.getElementById('cfg_root_images_dir').value.trim();
            const max_cpc = parseInt(document.getElementById('cfg_max_cpc').value) || 2000;

            if (!selectedProductId && !url) {
                alert('Vui lòng chọn sản phẩm từ ô tìm kiếm hoặc nhập Link sản phẩm!');
                return;
            }

            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('result_area').classList.add('hidden');
            document.getElementById('btn_submit').disabled = true;

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        url: url, 
                        product_id: selectedProductId, 
                        campaign_name: campaign_name,
                        custom_images_dir: custom_images_dir,
                        max_cpc: max_cpc
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Lỗi khi tạo quảng cáo');
                }

                currentResult = await response.json();
                renderResult(currentResult);
                showToast('Tạo quảng cáo thành công! Sẵn sàng tải CSV.', true);
            } catch (err) {
                alert('Đã xảy ra lỗi: ' + err.message);
            } finally {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('btn_submit').disabled = false;
            }
        }

        function renderResult(data) {
            document.getElementById('res_ad_group').innerText = data.ad_data.ad_group_name;
            document.getElementById('res_campaign').innerText = data.ad_data.campaign_name;
            document.getElementById('res_paths').innerText = `/${data.ad_data.path1}/${data.ad_data.path2}`;

            // Image folder meta
            document.getElementById('images_count').innerText = data.ad_data.images.length;
            document.getElementById('images_folder_path').innerText = `Thư mục ảnh sản phẩm: ${data.images_folder}`;

            // Render Headlines
            const hList = document.getElementById('headlines_list');
            hList.innerHTML = '';
            data.ad_data.headlines.forEach((h, idx) => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100 transition';
                div.innerHTML = `
                    <div class="flex items-center space-x-2 truncate">
                        <span class="font-bold text-slate-400 w-5">${idx + 1}.</span>
                        <span class="font-medium text-slate-800 truncate">${h}</span>
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        <span class="char-badge char-safe">${h.length}/30</span>
                        <button onclick="navigator.clipboard.writeText('${h.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-indigo-600">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                `;
                hList.appendChild(div);
            });

            // Render Descriptions
            const dList = document.getElementById('descriptions_list');
            dList.innerHTML = '';
            data.ad_data.descriptions.forEach((d, idx) => {
                const div = document.createElement('div');
                div.className = 'p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100 transition';
                div.innerHTML = `
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-slate-500">Mô tả ${idx + 1}</span>
                        <div class="flex items-center space-x-2">
                            <span class="char-badge char-safe">${d.length}/90</span>
                            <button onclick="navigator.clipboard.writeText('${d.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-indigo-600">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-slate-700 leading-relaxed">${d}</p>
                `;
                dList.appendChild(div);
            });

            // Render Keywords
            const kwCloud = document.getElementById('keywords_cloud');
            kwCloud.innerHTML = '';
            data.ad_data.keywords.forEach(kw => {
                const span = document.createElement('span');
                span.className = 'bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-md font-mono';
                span.innerText = kw;
                kwCloud.appendChild(span);
            });

            // Render Images
            const imgGrid = document.getElementById('images_grid');
            imgGrid.innerHTML = '';
            data.ad_data.images.forEach(img => {
                const previewUrl = `/api/image_preview?path=${encodeURIComponent(img.local_path)}`;
                const filename = img.local_path.split('\\\\').pop().split('/').pop();
                
                const div = document.createElement('div');
                div.className = 'border rounded-lg overflow-hidden bg-slate-50 text-center text-xs p-1 shadow-xs hover:shadow transition';
                div.innerHTML = `
                    <img src="${previewUrl}" class="w-full h-24 object-cover rounded mb-1 bg-white">
                    <span class="text-[10px] text-slate-500 block truncate" title="${filename}">${filename}</span>
                    <span class="text-[10px] font-semibold text-indigo-600">${img.width}x${img.height} (${img.type})</span>
                `;
                imgGrid.appendChild(div);
            });

            document.getElementById('result_area').classList.remove('hidden');
        }

        function downloadFile(type) {
            if (!currentResult) return;
            const path = currentResult.files[type];
            window.location.href = `/api/download?path=${encodeURIComponent(path)}`;
        }

        function copyKeywords() {
            if (!currentResult) return;
            const kw = currentResult.ad_data.keywords.join('\\n');
            navigator.clipboard.writeText(kw);
            alert('Đã copy danh sách từ khóa!');
        }

        async function openFolder() {
            const target = currentResult?.images_folder || document.getElementById('cfg_root_images_dir').value.trim();
            await fetch(`/api/open_folder?path=${encodeURIComponent(target)}`);
        }

        async function openRootFolder() {
            const target = document.getElementById('cfg_root_images_dir').value.trim();
            await fetch(`/api/open_folder?path=${encodeURIComponent(target)}`);
        }

        function copyAllText() {
            if (!currentResult) return;
            let fullText = `CHIẾN DỊCH: ${currentResult.ad_data.campaign_name}\\n`;
            fullText += `NHÓM: ${currentResult.ad_data.ad_group_name}\\n`;
            fullText += `URL: ${currentResult.ad_data.final_url}\\n`;
            fullText += `PATH: /${currentResult.ad_data.path1}/${currentResult.ad_data.path2}\\n\\n`;
            fullText += `--- TIÊU ĐỀ ---\\n` + currentResult.ad_data.headlines.join('\\n') + '\\n\\n';
            fullText += `--- MÔ TẢ ---\\n` + currentResult.ad_data.descriptions.join('\\n') + '\\n\\n';
            fullText += `--- TỪ KHÓA ---\\n` + currentResult.ad_data.keywords.join('\\n');
            navigator.clipboard.writeText(fullText);
            alert('Đã copy toàn bộ nội dung mẫu quảng cáo!');
        }

        function openGeminiDoc() {
            window.open('https://aistudio.google.com/app/apikey', '_blank');
        }
    </script>
</body>
</html>
    """
    return html_content

@app.get("/api/config")
async def api_get_config():
    cfg = load_config()
    return cfg

@app.post("/api/config")
async def api_save_config(req: ConfigRequest):
    updated = save_config({
        "gemini_api_key": req.gemini_api_key,
        "gemini_model": req.gemini_model,
        "wp_url": req.wp_url,
        "wp_user": req.wp_user,
        "wp_app_password": req.wp_app_password,
        "default_campaign_name": req.default_campaign_name,
        "max_cpc": req.max_cpc,
        "root_images_dir": req.root_images_dir
    })
    return {"success": True, "config": updated}

@app.get("/api/products/search")
async def api_search_products(q: str = ""):
    results = search_products(q, limit=10)
    return {"products": results}

@app.post("/api/generate")
async def api_generate(req: GenerateRequest):
    try:
        cfg = load_config()
        custom_root = req.custom_images_dir.strip() if req.custom_images_dir else cfg.get("root_images_dir", os.path.join(output_dir, "images"))
        max_cpc_val = req.max_cpc if req.max_cpc > 0 else cfg.get("max_cpc", 2000)

        if req.product_id > 0:
            product_data = get_product_details_by_id(req.product_id, output_dir=output_dir, custom_images_dir=custom_root)
        else:
            if not req.url:
                raise ValueError("Vui lòng chọn sản phẩm hoặc nhập link sản phẩm!")
            product_data = extract_product_data(req.url, output_dir=output_dir, custom_images_dir=custom_root)
            
        ad_data = generate_google_ads_content(
            product_data, 
            campaign_name=req.campaign_name,
            api_key=cfg.get("gemini_api_key"),
            model=cfg.get("gemini_model")
        )
        files = export_to_google_ads_files(ad_data, output_dir=output_dir, max_cpc=max_cpc_val)
        
        # Thư mục ảnh con của sản phẩm
        images_dir = product_data.get("images_dir")
        if not images_dir:
            if product_data.get("images") and len(product_data["images"]) > 0:
                images_dir = os.path.dirname(product_data["images"][0]["local_path"])
            else:
                images_dir = custom_root

        return {
            "success": True,
            "product_data": product_data,
            "ad_data": ad_data,
            "images_folder": images_dir,
            "files": {
                "all_in_one_csv": files["all_in_one_csv"],
                "ad_group_csv": files["ad_group_csv"],
                "ads_csv": files["ads_csv"],
                "keywords_csv": files["keywords_csv"],
                "excel": files["excel"],
                "quick_copy_txt": files["quick_copy_txt"]
            }
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/api/download")
async def api_download(path: str):
    if os.path.exists(path):
        return FileResponse(path, filename=os.path.basename(path))
    return JSONResponse(status_code=404, content={"detail": "File not found"})

@app.get("/api/image_preview")
async def api_image_preview(path: str):
    if os.path.exists(path):
        return FileResponse(path)
    return JSONResponse(status_code=404, content={"detail": "Image not found"})

@app.get("/api/open_folder")
async def api_open_folder(path: str = ""):
    cfg = load_config()
    target = path.strip() if path and path.strip() else cfg.get("root_images_dir", os.path.join(output_dir, "images"))
    if not os.path.exists(target):
        try:
            os.makedirs(target, exist_ok=True)
        except Exception:
            pass
    if os.path.exists(target):
        subprocess.Popen(f'explorer "{target}"')
        return {"success": True, "opened": target}
    return JSONResponse(status_code=404, content={"detail": f"Thư mục không tồn tại: {target}"})

def run_server(port=8000):
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 GOOGLE ADS AUTO GENERATOR WEB SERVER")
    print("🌐 Đang chạy tại: http://127.0.0.1:8000")
    print("=" * 60)
    run_server()

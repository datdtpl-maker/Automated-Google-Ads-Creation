const { app, BrowserWindow, dialog, shell, ipcMain, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// KHÓA VÀ CẤU HÌNH TỰ ĐỘNG BẢO MẬT (TỰ GIẢI MÃ NỘI BỘ TRÊN MÁY TÍNH)
const EMBEDDED_KEY = Buffer.from('QVEuQWI4Uk42SkRESmMwNmtIREZ6a3k3RmZtX19pRXJGMm9QV3g3VVY5VXN2YkxRNVhXaXc=', 'base64').toString('utf8');
const EMBEDDED_PASS = Buffer.from('NmxHUyBhR1hUIGU2cXggQnhPWiBnOXo3IHRjMUs=', 'base64').toString('utf8');

const DEFAULT_CONFIG = {
    gemini_api_key: EMBEDDED_KEY,
    gemini_model: "gemini-3.8-flash",
    wp_url: "https://khaihoanderma.com",
    wp_user: "admin",
    wp_app_password: EMBEDDED_PASS,
    default_campaign_name: "Chiến dịch sản phẩm Web Derma | 21/10",
    max_cpc: 2000,
    daily_budget: 50000,
    campaign_mode: "separate",
    campaign_prefix: "Chiến dịch SP - ",
    root_images_dir: "D:\\Project Anti\\Auto-Google-Ads\\output\\images"
};

// Kiểm tra và sửa lỗi chuỗi mojibake
function isMojibake(str) {
    if (!str) return false;
    return /[\u00C0-\u00FF]{2,}|Tà€i|liĂª|ChiĂ/.test(str);
}

// Tìm đường dẫn file config.json
function getConfigPath() {
    try {
        const userDataPath = path.join(app.getPath('userData'), 'config.json');
        if (fs.existsSync(userDataPath)) {
            return userDataPath;
        }
    } catch (e) {}

    const bundledConfig = path.join(__dirname, 'config.json');
    if (fs.existsSync(bundledConfig)) {
        return bundledConfig;
    }

    const projectConfig = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(projectConfig)) {
        return projectConfig;
    }

    try {
        return path.join(app.getPath('userData'), 'config.json');
    } catch (e) {
        return bundledConfig;
    }
}

function getDefaultImagesDir() {
    return DEFAULT_CONFIG.root_images_dir;
}

function getDefaultOutputDir() {
    const localOutput = 'D:\\Project Anti\\Auto-Google-Ads\\output';
    if (!fs.existsSync(localOutput)) {
        try { fs.mkdirSync(localOutput, { recursive: true }); } catch (e) {}
    }
    return localOutput;
}

function readConfig() {
    const configPath = getConfigPath();
    let config = { ...DEFAULT_CONFIG };
    let needsResave = false;

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, 'utf8');
            const data = JSON.parse(raw);
            config = { ...config, ...data };

            // Tự động khôi phục key nếu bị trống hoặc thiếu
            if (!config.gemini_api_key || config.gemini_api_key.trim() === '') {
                config.gemini_api_key = DEFAULT_CONFIG.gemini_api_key;
                needsResave = true;
            }
            if (!config.wp_app_password || config.wp_app_password.trim() === '') {
                config.wp_app_password = DEFAULT_CONFIG.wp_app_password;
                needsResave = true;
            }

            // Luôn đặt mặc định mô hình là gemini-3.8-flash (loại bỏ các mô hình cũ đã ngừng hỗ trợ)
            if (!config.gemini_model || config.gemini_model !== 'gemini-3.8-flash') {
                config.gemini_model = 'gemini-3.8-flash';
                needsResave = true;
            }

            // Tự động sửa lỗi font tiếng Việt mojibake hoặc tên chiến dịch cũ trong config
            if (isMojibake(config.default_campaign_name) || config.default_campaign_name === 'Chiến dịch sản phẩm Web Derma | 22/10') {
                config.default_campaign_name = DEFAULT_CONFIG.default_campaign_name;
                needsResave = true;
            }
            if (isMojibake(config.root_images_dir) || config.root_images_dir.includes('OneDrive')) {
                config.root_images_dir = DEFAULT_CONFIG.root_images_dir;
                needsResave = true;
            }
        } catch (e) {
            console.error('Lỗi đọc config:', e);
            needsResave = true;
        }
    } else {
        needsResave = true;
    }

    if (needsResave) {
        writeConfig(config);
    }
    return config;
}

function writeConfig(newConfig) {
    let savePath;
    try {
        savePath = path.join(app.getPath('userData'), 'config.json');
    } catch (e) {
        savePath = path.join(__dirname, '..', 'config.json');
    }

    try {
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(savePath, JSON.stringify(newConfig, null, 4), 'utf8');

        // Đồng bộ sang thư mục dự án nếu tồn tại (môi trường dev)
        const projectConfig = path.join(__dirname, '..', 'config.json');
        if (projectConfig !== savePath && fs.existsSync(path.dirname(projectConfig))) {
            try {
                fs.writeFileSync(projectConfig, JSON.stringify(newConfig, null, 4), 'utf8');
            } catch (e) {}
        }
        return true;
    } catch (e) {
        console.error('Lỗi ghi config:', e);
        return false;
    }
}

// Cắt ngắn chuỗi thông minh cho tiêu đề và mô tả Google Ads
function smartTruncate(text, maxChars) {
    if (!text) return '';
    text = String(text).trim();
    if (text.length <= maxChars) return text;
    let truncated = text.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > Math.floor(maxChars * 0.6)) {
        truncated = truncated.substring(0, lastSpace);
    }
    truncated = truncated.replace(/[,;:\-–—\.\s]+$/, '').trim();
    return truncated;
}

function sanitizeFolderName(name) {
    return name.replace(/[\\/*?:"<>|]/g, '').replace(/\s+/g, '_').substring(0, 50).trim();
}

function cleanHtmlText(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function createWindow() {
    const iconPath = path.join(__dirname, 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1420,
        height: 940,
        minWidth: 1080,
        minHeight: 720,
        title: 'Google Ads Campaign Auto-Generator Pro',
        icon: iconPath,
        backgroundColor: '#f8fafd',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Context menu chuột phải tiện lợi cho việc bôi đen Sao chép / Dán văn bản
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();

        if (params.selectionText && params.selectionText.trim().length > 0) {
            menu.append(new MenuItem({
                label: 'Sao chép (Copy)',
                role: 'copy',
                accelerator: 'CmdOrCtrl+C'
            }));
            menu.append(new MenuItem({ type: 'separator' }));
        }

        if (params.isEditable) {
            menu.append(new MenuItem({ label: 'Cắt (Cut)', role: 'cut' }));
            menu.append(new MenuItem({ label: 'Sao chép (Copy)', role: 'copy' }));
            menu.append(new MenuItem({ label: 'Dán (Paste)', role: 'paste' }));
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({ label: 'Chọn tất cả (Select All)', role: 'selectAll' }));
        } else if (params.selectionText && params.selectionText.trim().length > 0) {
            menu.append(new MenuItem({ label: 'Chọn tất cả (Select All)', role: 'selectAll' }));
        }

        if (menu.items.length > 0) {
            menu.popup({ window: mainWindow, x: params.x, y: params.y });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ==========================================
// IPC HANDLERS - GIAO TIẾP VỚI HỆ THỐNG WINDOWS
// ==========================================

// 1. Hộp thoại chọn thư mục Windows Explorer gốc
ipcMain.handle('select-folder', async (event, defaultPath) => {
    const current = defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined;
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Chọn thư mục lưu hình ảnh sản phẩm Google Ads',
        defaultPath: current,
        properties: ['openDirectory', 'createDirectory']
    });
    if (!res.canceled && res.filePaths.length > 0) {
        return { success: true, path: res.filePaths[0] };
    }
    return { success: false, canceled: true };
});

// 2. Mở thư mục trong Windows Explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
    let target = folderPath;
    if (!target) {
        const cfg = readConfig();
        target = cfg.root_images_dir;
    }
    if (!fs.existsSync(target)) {
        try {
            fs.mkdirSync(target, { recursive: true });
        } catch (e) {}
    }
    const err = await shell.openPath(target);
    if (err) {
        return { success: false, error: err };
    }
    return { success: true, opened: target };
});

// 3. Hiển thị file trong Windows Explorer
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
    }
    return { success: false, error: 'File không tồn tại' };
});

// 4. Cấu hình
ipcMain.handle('get-config', async () => {
    return readConfig();
});

ipcMain.handle('save-config', async (event, newConfig) => {
    const ok = writeConfig(newConfig);
    return { success: ok, config: readConfig() };
});

// 5. Kiểm tra kết nối Gemini API
ipcMain.handle('test-gemini', async (event, { key, model }) => {
    try {
        const apiKey = key || readConfig().gemini_api_key;
        if (!apiKey) return { success: false, message: 'Chưa nhập Gemini API Key!' };

        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await fetch(testUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData?.error?.message || `Lỗi HTTP ${res.status}`;
            return { success: false, message: `Gemini API từ chối: ${msg}` };
        }
        const data = await res.json();
        return { 
            success: true, 
            message: `Kết nối Gemini thành công! Tìm thấy ${data.models?.length || 0} mô hình khả dụng.` 
        };
    } catch (e) {
        return { success: false, message: `Lỗi kết nối Gemini: ${e.message}` };
    }
});

// 6. Kiểm tra kết nối WooCommerce
ipcMain.handle('test-wc', async (event, { wp_url, wp_user, wp_app_password }) => {
    try {
        const cfg = readConfig();
        const url = (wp_url || cfg.wp_url || '').replace(/\/+$/, '');
        const user = wp_user || cfg.wp_user;
        const pass = wp_app_password || cfg.wp_app_password;

        if (!url || !user || !pass) {
            return { success: false, message: 'Vui lòng nhập đầy đủ URL website, tài khoản và mật khẩu ứng dụng!' };
        }

        const auth = Buffer.from(`${user}:${pass}`).toString('base64');
        const testEndpoint = `${url}/wp-json/wc/v3/products?per_page=1`;
        const res = await fetch(testEndpoint, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': 'GoogleAdsAutoGenerator/1.0'
            },
            signal: AbortSignal.timeout(12000)
        });

        if (!res.ok) {
            return { success: false, message: `Lỗi kết nối Website (HTTP ${res.status}). Kiểm tra lại tài khoản hoặc quyền REST API.` };
        }

        const data = await res.json();
        return { success: true, message: `Kết nối WooCommerce thành công! Sản phẩm mẫu: ${data[0]?.name || 'OK'}` };
    } catch (e) {
        return { success: false, message: `Không thể kết nối website: ${e.message}` };
    }
});

// 7. Quản lý Cache Sản Phẩm Local (Cực nhanh & Tìm kiếm siêu chính xác)
let memoryProductsCache = [];

function getProductsCachePath() {
    try {
        return path.join(app.getPath('userData'), 'products_cache.json');
    } catch (e) {
        return path.join(__dirname, 'products_cache.json');
    }
}

function loadProductsFromDisk() {
    try {
        const p = getProductsCachePath();
        if (fs.existsSync(p)) {
            const data = fs.readFileSync(p, 'utf8');
            memoryProductsCache = JSON.parse(data);
            return memoryProductsCache;
        }
    } catch (e) {
        console.warn('Lỗi đọc cache sản phẩm:', e.message);
    }
    return [];
}

async function syncAllProducts(force = false) {
    if (!force && memoryProductsCache.length > 0) {
        return memoryProductsCache;
    }

    try {
        const cfg = readConfig();
        const url = (cfg.wp_url || '').replace(/\/+$/, '');
        const auth = Buffer.from(`${cfg.wp_user}:${cfg.wp_app_password}`).toString('base64');
        if (!url || !cfg.wp_app_password) return memoryProductsCache;

        const allProducts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
            const endpoint = `${url}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`;
            const res = await fetch(endpoint, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'User-Agent': 'GoogleAdsAutoGenerator/1.0'
                },
                signal: AbortSignal.timeout(15000)
            });

            if (!res.ok) break;
            const items = await res.json();
            if (!Array.isArray(items) || items.length === 0) {
                hasMore = false;
                break;
            }

            for (const p of items) {
                allProducts.push({
                    id: p.id,
                    name: p.name,
                    price: p.price ? `${Number(p.price).toLocaleString('vi-VN')} đ` : 'Liên hệ',
                    regular_price: p.regular_price,
                    sale_price: p.sale_price,
                    permalink: p.permalink,
                    image: p.images && p.images.length > 0 ? p.images[0].src : '',
                    categories: p.categories ? p.categories.map(c => c.name).join(', ') : '',
                    images: p.images ? p.images.map(img => img.src) : [],
                    short_description: cleanHtmlText(p.short_description || p.description)
                });
            }

            if (items.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        if (allProducts.length > 0) {
            memoryProductsCache = allProducts;
            try {
                fs.writeFileSync(getProductsCachePath(), JSON.stringify(allProducts, null, 2), 'utf8');
            } catch (err) {
                console.warn('Lỗi ghi cache disk:', err.message);
            }
        }
        return memoryProductsCache;
    } catch (e) {
        console.error('Lỗi syncAllProducts:', e.message);
        return memoryProductsCache;
    }
}

function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[đĐ]/g, 'd')
              .toLowerCase();
}

function calculateProductRelevance(product, query) {
    const qNorm = removeAccents(query.trim());
    if (!qNorm) return 1;

    const nameNorm = removeAccents(product.name || '');
    const words = nameNorm.split(/[\s,–\-_+./()]+/);
    let score = 0;

    // 1. Khớp chính xác cụm từ trong tên sản phẩm (Ưu tiên cao nhất)
    if (nameNorm.startsWith(qNorm)) {
        score += 2000;
    } else if (nameNorm.includes(qNorm)) {
        score += 1000;
    }

    // 2. Khớp từng từ hoặc tiền tố của từ trong tiêu đề
    for (const w of words) {
        if (w === qNorm) {
            score += 800;
        } else if (w.startsWith(qNorm)) {
            score += 500;
        } else if (qNorm.length >= 3 && w.length >= qNorm.length) {
            // Cho phép sai khác 1 ký tự khi gõ phím nhanh (ví dụ: mud -> munderm)
            let diff = 0;
            for (let i = 0; i < qNorm.length; i++) {
                if (qNorm[i] !== w[i]) diff++;
            }
            if (diff <= 1) {
                score += 350;
            }
        }
    }

    // 3. Nếu người dùng gõ nhiều từ (ví dụ: "tri mun munderm")
    const qWords = qNorm.split(/\s+/).filter(Boolean);
    if (qWords.length > 1) {
        const allPresent = qWords.every(qw => nameNorm.includes(qw));
        if (allPresent) score += 600;
        else {
            const matchesCount = qWords.filter(qw => nameNorm.includes(qw)).length;
            score += matchesCount * 120;
        }
    }

    // 4. Danh mục sản phẩm
    const catNorm = removeAccents(product.categories || '');
    if (catNorm.includes(qNorm)) score += 50;

    return score;
}

// IPC: Đồng bộ toàn bộ sản phẩm thủ công
ipcMain.handle('sync-products', async (event, force = true) => {
    try {
        const products = await syncAllProducts(force);
        return { success: true, count: products.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC: Tìm kiếm sản phẩm siêu tốc trong bộ nhớ Local (< 5ms)
ipcMain.handle('search-products', async (event, keyword) => {
    try {
        if (!memoryProductsCache || memoryProductsCache.length === 0) {
            loadProductsFromDisk();
            if (memoryProductsCache.length === 0) {
                await syncAllProducts(false);
            }
        }

        const query = (keyword || '').trim();
        if (!query) {
            return {
                success: true,
                products: memoryProductsCache.slice(0, 20),
                total_cached: memoryProductsCache.length
            };
        }

        const scored = [];
        for (const p of memoryProductsCache) {
            const score = calculateProductRelevance(p, query);
            if (score > 0) {
                scored.push({ p, score });
            }
        }

        // Sắp xếp sản phẩm liên quan nhất lên đầu
        scored.sort((a, b) => b.score - a.score);

        const results = scored.slice(0, 30).map(s => s.p);
        return {
            success: true,
            products: results,
            total_cached: memoryProductsCache.length
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// 8. Lấy chi tiết sản phẩm theo ID
ipcMain.handle('get-product-details', async (event, id) => {
    try {
        const cfg = readConfig();
        const url = (cfg.wp_url || '').replace(/\/+$/, '');
        const auth = Buffer.from(`${cfg.wp_user}:${cfg.wp_app_password}`).toString('base64');

        const endpoint = `${url}/wp-json/wc/v3/products/${id}`;
        const res = await fetch(endpoint, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': 'GoogleAdsAutoGenerator/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
        const p = await res.json();
        return {
            success: true,
            product: {
                id: p.id,
                title: p.name,
                url: p.permalink,
                price: p.price ? `${Number(p.price).toLocaleString('vi-VN')} đ` : '',
                regular_price: p.regular_price,
                sale_price: p.sale_price,
                categories: p.categories ? p.categories.map(c => c.name).join(', ') : '',
                description: cleanHtmlText(p.description || p.short_description),
                images: p.images ? p.images.map(img => img.src) : []
            }
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// 9. Cấu trúc Header chuẩn Google Ads Bulk Upload (Tự động tạo Chiến dịch, Ngân sách, Nhóm, RSA, Từ khóa)
const CSV_HEADERS = [
    'Campaign', 'Campaign Type', 'Campaign status', 'Budget', 'Budget type', 'Bid Strategy type',
    'Ad group', 'Ad group status', 'Max CPC',
    'Ad type', 'Final URL', 'Path 1', 'Path 2'
];
for (let i = 1; i <= 15; i++) CSV_HEADERS.push(`Headline ${i}`);
for (let i = 1; i <= 4; i++) CSV_HEADERS.push(`Description ${i}`);
CSV_HEADERS.push('Keyword', 'Criterion Type');

function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

// Hàm xử lý từng sản phẩm đơn lẻ (gọi AI, tải ảnh, tạo dòng CSV)
async function processSingleProduct(product, { apiKey, model, campaignMode = 'separate', campaignPrefix = 'Chiến dịch SP - ', effectiveCampaignName, dailyBudget = 50000, effectiveMaxCpc, rootImgDir, todayStr }) {
    const cleanProdName = sanitizeFolderName(product.title || 'san_pham');
    const targetProductImgDir = path.join(rootImgDir, cleanProdName);

    const prompt = `
Bạn là chuyên gia thiết lập Google Ads Search chuyên nghiệp cấp cao.
Nhiệm vụ của bạn là đọc kỹ thông tin sản phẩm và tạo cấu trúc Quảng cáo tìm kiếm thích ứng (Responsive Search Ads - RSA) đạt điểm tối ưu "Rất tốt" (Ad Strength: Excellent).

THÔNG TIN SẢN PHẨM:
- Tiêu đề gốc: ${product.title}
- Giá bán: ${product.price || 'Theo giá web'}
- URL trang sản phẩm: ${product.url}
- Danh mục: ${product.categories || ''}
- Nội dung chi tiết:
${(product.description || '').substring(0, 3500)}

QUY TẮC BẮT BUỘC TRÊN GOOGLE ADS:
1. Tên nhóm quảng cáo (ad_group_name): Bắt buộc định dạng "Nhóm [Tên Rút Gọn] | ${todayStr}".
2. Đường dẫn hiển thị:
   - path1: Tối đa 15 ký tự, tiếng Việt không dấu hoặc tiếng Anh, nối bằng gạch ngang (ví dụ: "chinh-hang", "tri-mun", "gia-tot").
   - path2: Tối đa 15 ký tự (ví dụ: "30g", "chuan-y-khoa", "uu-dai").
3. Tiêu đề quảng cáo (headlines): BẮT BUỘC ĐỦ 15 TIÊU ĐỀ.
   - MỖI TIÊU ĐỀ TỐI ĐA 30 KÝ TỰ (Bao gồm cả dấu cách). Độ dài an toàn 18 - 28 ký tự. Tuyệt đối không vượt quá 30 ký tự!
   - Không trùng lặp, đa dạng các góc độ: Tên sản phẩm, Tên thương hiệu, Công dụng chính, Cam kết chính hãng, Dược sĩ tư vấn, Giá tốt hôm nay, Giao hàng nhanh.
   - Viết hoa chữ cái đầu mỗi từ (Title Case).
4. Đoạn mô tả (descriptions): BẮT BUỘC ĐỦ 4 ĐOẠN MÔ TẢ.
   - MỖI ĐOẠN MÔ TẢ TỐI ĐA 90 KÝ TỰ (Bao gồm cả dấu cách). Độ dài an toàn 65 - 85 ký tự. Tuyệt đối không quá 90 ký tự!
5. Từ khóa (keywords): Tạo danh sách 15 - 20 từ khóa có tỷ lệ chuyển đổi cao nhất:
   - Từ khóa đối sánh cụm từ đặt trong ngoặc kép: "từ khóa"
   - Từ khóa đối sánh chính xác đặt trong ngoặc vuông: [từ khóa]
   - TUYỆT ĐỐI KHÔNG chứa ký tự đặc biệt: %, +, !, @, ,, *, ?, & (Google Ads cấm và báo lỗi). Ví dụ: "munderm 0.05 2" thay vì "munderm 0.05% + 2%".

ĐỊNH DẠNG ĐẦU RA (JSON THUẦN TÚY):
{
  "product_short_name": "Tên sản phẩm ngắn gọn",
  "ad_group_name": "Nhóm [Tên ngắn gọn] | ${todayStr}",
  "path1": "path-1",
  "path2": "path-2",
  "headlines": [ ... 15 tiêu đề <= 30 ký tự ],
  "descriptions": [ ... 4 mô tả <= 90 ký tự ],
  "keywords": [ ... 15-20 từ khóa ]
}
`;

    let aiData;
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const aiRes = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.4
                }
            }),
            signal: AbortSignal.timeout(35000)
        });

        if (!aiRes.ok) {
            const errObj = await aiRes.json().catch(() => ({}));
            throw new Error(errObj?.error?.message || `HTTP ${aiRes.status}`);
        }

        const aiJson = await aiRes.json();
        let rawText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        rawText = rawText.trim();
        if (rawText.startsWith('```')) {
            const m = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
            if (m) rawText = m[1].trim();
        }
        aiData = JSON.parse(rawText);
    } catch (e) {
        return { success: false, error: `Lỗi gọi Gemini AI: ${e.message}` };
    }

    // Hậu kiểm độ dài ký tự chuẩn Google Ads
    const path1 = smartTruncate(aiData.path1 || 'chinh-hang', 15).replace(/\s+/g, '-').toLowerCase();
    const path2 = smartTruncate(aiData.path2 || 'gia-tot', 15).replace(/\s+/g, '-').toLowerCase();

    const shortName = aiData.product_short_name || product.title.substring(0, 25);
    const validHeadlines = [];
    const seenH = new Set();
    for (const h of (aiData.headlines || [])) {
        const cleanH = smartTruncate(h, 30);
        if (cleanH && !seenH.has(cleanH.toLowerCase())) {
            validHeadlines.push(cleanH);
            seenH.add(cleanH.toLowerCase());
        }
    }

    const fallbackH = [
        smartTruncate(`Mua ${shortName}`, 30),
        smartTruncate(`${shortName} Chính Hãng`, 30),
        smartTruncate("Cam Kết Chuẩn Y Khoa", 30),
        smartTruncate("Giao Hàng Nhanh Toàn Quốc", 30),
        smartTruncate("Dược Sĩ Tư Vấn Tận Tâm", 30),
        smartTruncate("Giá Tốt Nhất Hôm Nay", 30),
        smartTruncate("Đặt Hàng Ngay Nhận Ưu Đãi", 30),
        smartTruncate("Hàng Chuẩn Đủ Hoá Đơn", 30)
    ];
    for (const fb of fallbackH) {
        if (validHeadlines.length >= 15) break;
        if (!seenH.has(fb.toLowerCase())) {
            validHeadlines.push(fb);
            seenH.add(fb.toLowerCase());
        }
    }

    const validDescriptions = [];
    const seenD = new Set();
    for (const d of (aiData.descriptions || [])) {
        const cleanD = smartTruncate(d, 90);
        if (cleanD && !seenD.has(cleanD.toLowerCase())) {
            validDescriptions.push(cleanD);
            seenD.add(cleanD.toLowerCase());
        }
    }
    const fallbackD = [
        smartTruncate(`Phân phối ${shortName} chuẩn chính hãng. Đội ngũ dược sĩ tư vấn tận tình.`, 90),
        smartTruncate("Đặt hàng online nhanh chóng, kiểm tra hàng trước khi thanh toán. Mua ngay!", 90),
        smartTruncate("Sản phẩm an toàn, rõ nguồn gốc xuất xứ, hỗ trợ cải thiện làn da hiệu quả.", 90),
        smartTruncate("Giao hàng tận nơi toàn quốc, hỗ trợ 24/7. Xem chi tiết và đặt hàng tại đây!", 90)
    ];
    for (const fd of fallbackD) {
        if (validDescriptions.length >= 4) break;
        if (!seenD.has(fd.toLowerCase())) {
            validDescriptions.push(fd);
            seenD.add(fd.toLowerCase());
        }
    }

    let adGroupName = aiData.ad_group_name || `Nhóm ${shortName} | ${todayStr}`;
    if (!adGroupName.startsWith('Nhóm ')) adGroupName = `Nhóm ${adGroupName}`;
    if (!adGroupName.includes('|')) adGroupName = `${adGroupName} | ${todayStr}`;

    const isSeparate = campaignMode !== 'single';
    let cleanPrefix = (campaignPrefix && campaignPrefix.trim()) ? campaignPrefix.trim() : 'Chiến dịch SP -';
    if (!cleanPrefix.endsWith(' ')) cleanPrefix = cleanPrefix + ' ';
    const targetCampName = isSeparate ? `${cleanPrefix}${shortName} | ${todayStr}` : effectiveCampaignName;

    const adData = {
        campaign_name: targetCampName,
        ad_group_name: adGroupName,
        product_short_name: shortName,
        final_url: product.url,
        path1: path1,
        path2: path2,
        headlines: validHeadlines.slice(0, 15),
        descriptions: validDescriptions.slice(0, 4),
        keywords: aiData.keywords || [],
        images: product.images || []
    };

    // Tải ảnh sản phẩm về thư mục
    const downloadedImages = [];
    try {
        if (!fs.existsSync(targetProductImgDir)) {
            fs.mkdirSync(targetProductImgDir, { recursive: true });
        }
        for (let i = 0; i < (product.images || []).length; i++) {
            const imgUrl = product.images[i];
            const extMatch = imgUrl.match(/\.(jpg|jpeg|png|webp)/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
            const fileName = `image_${i + 1}.${ext}`;
            const destPath = path.join(targetProductImgDir, fileName);

            try {
                const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(10000) });
                if (imgRes.ok) {
                    const arrayBuffer = await imgRes.arrayBuffer();
                    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
                    downloadedImages.push({
                        url: imgUrl,
                        fileName: fileName,
                        localPath: destPath
                    });
                }
            } catch (err) {
                console.warn(`Lỗi tải ảnh ${imgUrl}:`, err.message);
            }
        }
    } catch (e) {
        console.error('Lỗi tạo thư mục ảnh:', e);
    }

    // Tạo các dòng dữ liệu CSV cho sản phẩm này
    const productRows = [];

    // Nếu ở chế độ "Mỗi sản phẩm 1 chiến dịch riêng" (separate): Tạo dòng Cấp Chiến Dịch với Ngân Sách
    if (isSeparate) {
        const rowCamp = new Array(CSV_HEADERS.length).fill('');
        rowCamp[0] = targetCampName;
        rowCamp[1] = 'Search';
        rowCamp[2] = 'Enabled';
        rowCamp[3] = dailyBudget || 50000;
        rowCamp[4] = 'Daily';
        rowCamp[5] = 'Manual CPC';
        productRows.push(rowCamp);
    }

    // Dòng Nhóm quảng cáo
    const rowAg = new Array(CSV_HEADERS.length).fill('');
    rowAg[0] = targetCampName;
    rowAg[6] = adGroupName;
    rowAg[7] = 'Enabled';
    rowAg[8] = effectiveMaxCpc;
    productRows.push(rowAg);

    // Dòng Mẫu quảng cáo RSA
    const rowAd = new Array(CSV_HEADERS.length).fill('');
    rowAd[0] = targetCampName;
    rowAd[6] = adGroupName;
    rowAd[9] = 'Responsive search ad';
    rowAd[10] = product.url;
    rowAd[11] = path1;
    rowAd[12] = path2;
    for (let i = 0; i < 15; i++) {
        rowAd[13 + i] = adData.headlines[i] || '';
    }
    for (let i = 0; i < 4; i++) {
        rowAd[28 + i] = adData.descriptions[i] || '';
    }
    productRows.push(rowAd);

    // Dòng Danh sách Từ khóa đã làm sạch ký tự cấm
    for (const kwRaw of adData.keywords) {
        let cleanKw = kwRaw.trim();
        let criterion = 'Broad';
        let kwText = cleanKw;
        if (cleanKw.startsWith('"') && cleanKw.endsWith('"')) {
            criterion = 'Phrase';
            kwText = cleanKw.slice(1, -1).trim();
        } else if (cleanKw.startsWith('[') && cleanKw.endsWith(']')) {
            criterion = 'Exact';
            kwText = cleanKw.slice(1, -1).trim();
        }

        // Tẩy sạch các ký tự đặc biệt bị Google Ads cấm trong Từ khóa: ! @ % , * + ? = & ^ $ ~ < > ; : \ /
        kwText = kwText.replace(/[!@%,*+?=&^$~<>;:\\/]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!kwText) continue;

        const rowKw = new Array(CSV_HEADERS.length).fill('');
        rowKw[0] = targetCampName;
        rowKw[6] = adGroupName;
        rowKw[8] = effectiveMaxCpc;
        rowKw[32] = kwText;
        rowKw[33] = criterion;
        productRows.push(rowKw);
    }

    return {
        success: true,
        adData,
        targetCampName,
        adGroupName,
        rows: productRows,
        images_folder: targetProductImgDir,
        downloaded_images: downloadedImages,
        shortName
    };
}

// 10. Tạo chiến dịch hàng loạt cho nhiều sản phẩm
async function executeBatchCampaign(sender, params) {
    const { products, campaignMode = 'separate', campaignPrefix, campaignName, dailyBudget = 50000, maxCpc, customImagesDir } = params;
    if (!products || !Array.isArray(products) || products.length === 0) {
        return { success: false, error: 'Chưa chọn sản phẩm nào để tạo chiến dịch!' };
    }

    const cfg = readConfig();
    const apiKey = cfg.gemini_api_key || DEFAULT_CONFIG.gemini_api_key;
    const model = 'gemini-3.8-flash';
    if (!apiKey) {
        return { success: false, error: 'Thiếu Gemini API Key! Vui lòng nhập và lưu trong Cấu hình hệ thống.' };
    }

    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    const effectivePrefix = (campaignPrefix && campaignPrefix.trim()) ? campaignPrefix.trim() : (cfg.campaign_prefix || "Chiến dịch SP - ");
    const effectiveCampaignName = campaignName || cfg.default_campaign_name || "Chiến dịch sản phẩm Web Derma | 21/10";
    const effectiveMaxCpc = maxCpc ? parseInt(maxCpc, 10) : (cfg.max_cpc || 2000);
    const effectiveDailyBudget = dailyBudget ? parseInt(dailyBudget, 10) : (cfg.daily_budget || 50000);
    const rootImgDir = (customImagesDir && customImagesDir.trim()) ? customImagesDir.trim() : (cfg.root_images_dir || getDefaultImagesDir());

    const allRows = [];
    const productsResults = [];

    for (let i = 0; i < products.length; i++) {
        const prod = products[i];
        if (sender && typeof sender.send === 'function') {
            sender.send('batch-progress', {
                current: i + 1,
                total: products.length,
                productTitle: prod.title,
                message: `[${i + 1}/${products.length}] Đang xử lý sản phẩm "${prod.title}"...`
            });
        }

        const res = await processSingleProduct(prod, {
            apiKey,
            model,
            campaignMode,
            campaignPrefix: effectivePrefix,
            effectiveCampaignName,
            dailyBudget: effectiveDailyBudget,
            effectiveMaxCpc,
            rootImgDir,
            todayStr
        });

        if (res.success) {
            allRows.push(...res.rows);
            productsResults.push(res);
        } else {
            console.warn(`Lỗi tạo chiến dịch cho "${prod.title}":`, res.error);
        }
    }

    if (allRows.length === 0) {
        return { success: false, error: 'Không thể tạo dữ liệu quảng cáo cho các sản phẩm đã chọn.' };
    }

    // Xuất duy nhất 1 file CSV All-in-One Master chứa toàn bộ các nhóm
    const outputDir = getDefaultOutputDir();
    const cleanTag = productsResults.length === 1 ? sanitizeFolderName(productsResults[0].shortName) : `batch_${productsResults.length}_san_pham`;
    const csvFileName = `google_ads_all_in_one_${cleanTag}.csv`;
    const csvFilePath = path.join(outputDir, csvFileName);

    const csvContentRows = [CSV_HEADERS.map(escapeCsv).join(',')];
    for (const r of allRows) {
        csvContentRows.push(r.map(escapeCsv).join(','));
    }

    fs.writeFileSync(csvFilePath, '\uFEFF' + csvContentRows.join('\r\n'), 'utf8');

    return {
        success: true,
        campaign_mode: campaignMode,
        is_batch: productsResults.length > 1,
        total_products: products.length,
        successful_products: productsResults.length,
        csv_file_path: csvFilePath,
        csv_file_name: csvFileName,
        output_dir: outputDir,
        products_results: productsResults,
        ad_data: productsResults[0]?.adData,
        images_folder: productsResults[0]?.images_folder,
        downloaded_images: productsResults[0]?.downloaded_images
    };
}

ipcMain.handle('generate-batch-campaign', async (event, params) => {
    return await executeBatchCampaign(event.sender, params);
});

// 11. Giữ tương thích đơn sản phẩm
ipcMain.handle('generate-campaign', async (event, params) => {
    const { product, campaignName, maxCpc, customImagesDir } = params;
    return await executeBatchCampaign(event.sender, {
        products: [product],
        campaignName,
        maxCpc,
        customImagesDir
    });
});

// Khởi chạy ứng dụng
app.whenReady().then(() => {
    // Đảm bảo nạp và sửa lỗi font trong config ban đầu
    readConfig();
    loadProductsFromDisk();
    createWindow();

    // Chạy ngầm đồng bộ cache sản phẩm sau khi cửa sổ sẵn sàng
    setTimeout(() => {
        syncAllProducts(false).catch(e => console.warn('Lỗi nền syncAllProducts:', e.message));
    }, 1500);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

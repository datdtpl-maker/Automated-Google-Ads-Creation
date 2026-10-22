const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// ThÆ° má»¥c lÆ°u cáº¥u hĂ¬nh cá»¥c bá»™ trĂªn mĂ¡y ngÆ°á» i dĂ¹ng
function getConfigPath() {
    try {
        const userDataPath = path.join(app.getPath('userData'), 'config.json');
        if (fs.existsSync(userDataPath)) {
            return userDataPath;
        }
    } catch (e) {}

    const projectConfig = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(projectConfig)) {
        return projectConfig;
    }

    try {
        return path.join(app.getPath('userData'), 'config.json');
    } catch (e) {
        return path.join(__dirname, 'config.json');
    }
}

function getDefaultImagesDir() {
    try {
        const docs = app.getPath('documents');
        return path.join(docs, 'GoogleAdsImages');
    } catch (e) {
        return 'D:\\Project Anti\\Auto-Google-Ads\\output\\images';
    }
}

function getDefaultOutputDir() {
    try {
        const docs = app.getPath('documents');
        return path.join(docs, 'GoogleAdsExports');
    } catch (e) {
        return 'D:\\Project Anti\\Auto-Google-Ads\\output';
    }
}

const DEFAULT_CONFIG = {
    gemini_api_key: "",
    gemini_model: "gemini-2.5-flash",
    wp_url: "https://khaihoanderma.com",
    wp_user: "admin",
    wp_app_password: "",
    default_campaign_name: "Chiáº¿n dá»‹ch sáº£n pháº©m Web Derma",
    max_cpc: 2000,
    root_images_dir: getDefaultImagesDir()
};

function readConfig() {
    const configPath = getConfigPath();
    let config = { ...DEFAULT_CONFIG };
    if (fs.existsSync(configPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            config = { ...config, ...data };
        } catch (e) {
            console.error('Lá»—i Ä‘á» c config:', e);
        }
    } else {
        writeConfig(config);
    }
    return config;
}

function writeConfig(newConfig) {
    const configPath = getConfigPath();
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 4), 'utf8');

        // Náº¿u cĂ³ thá»ƒ, Ä‘á»“ng bá»™ sang thÆ° má»¥c dá»± Ă¡n gá»‘c
        const projectConfig = path.join(__dirname, '..', 'config.json');
        if (projectConfig !== configPath && fs.existsSync(path.dirname(projectConfig))) {
            try {
                fs.writeFileSync(projectConfig, JSON.stringify(newConfig, null, 4), 'utf8');
            } catch (e) {}
        }
        return true;
    } catch (e) {
        console.error('Lá»—i ghi config:', e);
        return false;
    }
}

// CĂ¡c tiá»‡n Ăch chuáº©n hoĂ¡ vÄƒn báº£n cho Google Ads
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
        backgroundColor: '#090d16',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ==========================================
// IPC HANDLERS - GIAO TIáº¾P TRá»°C TIáº¾P Há»† THá» NG WINDOWS
// ==========================================

// 1. Chá» n thÆ° má»¥c Windows
ipcMain.handle('select-folder', async (event, defaultPath) => {
    const current = defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined;
    const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Chá» n thÆ° má»¥c lÆ°u hĂ¬nh áº£nh sáº£n pháº©m Google Ads',
        defaultPath: current,
        properties: ['openDirectory', 'createDirectory']
    });
    if (!res.canceled && res.filePaths.length > 0) {
        return { success: true, path: res.filePaths[0] };
    }
    return { success: false, canceled: true };
});

// 2. Má»Ÿ thÆ° má»¥c trong Windows Explorer
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

// 3. Hiá»ƒn thá»‹ file trong thÆ° má»¥c Windows Explorer
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
    if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
    }
    return { success: false, error: 'File khĂ´ng tá»“n táº¡i' };
});

// 4. Cáº¥u hĂ¬nh
ipcMain.handle('get-config', async () => {
    return readConfig();
});

ipcMain.handle('save-config', async (event, newConfig) => {
    const ok = writeConfig(newConfig);
    return { success: ok, config: readConfig() };
});

// 5. Kiá»ƒm tra Gemini API Key
ipcMain.handle('test-gemini', async (event, { key, model }) => {
    try {
        const apiKey = key || readConfig().gemini_api_key;
        if (!apiKey) return { success: false, message: 'ChÆ°a nháº­p Gemini API Key!' };

        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await fetch(testUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData?.error?.message || `Lá»—i HTTP ${res.status}`;
            return { success: false, message: `Gemini API tá»« chá»‘i: ${msg}` };
        }
        const data = await res.json();
        return { 
            success: true, 
            message: `Káº¿t ná»‘i Gemini thĂ nh cĂ´ng! TĂ¬m tháº¥y ${data.models?.length || 0} mĂ´ hĂ¬nh kháº£ dá»¥ng.` 
        };
    } catch (e) {
        return { success: false, message: `Lá»—i káº¿t ná»‘i Gemini: ${e.message}` };
    }
});

// 6. Kiá»ƒm tra WooCommerce
ipcMain.handle('test-wc', async (event, { wp_url, wp_user, wp_app_password }) => {
    try {
        const cfg = readConfig();
        const url = (wp_url || cfg.wp_url || '').replace(/\/+$/, '');
        const user = wp_user || cfg.wp_user;
        const pass = wp_app_password || cfg.wp_app_password;

        if (!url || !user || !pass) {
            return { success: false, message: 'Vui lĂ²ng nháº­p Ä‘áº§y Ä‘á»§ URL website, tĂªn ngÆ°á» i dĂ¹ng vĂ  Application Password!' };
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
            return { success: false, message: `Lá»—i káº¿t ná»‘i Website (HTTP ${res.status}). Kiá»ƒm tra láº¡i thĂ´ng tin Ä‘Äƒng nháº­p hoáº·c quyá» n REST API.` };
        }

        const data = await res.json();
        return { success: true, message: `Káº¿t ná»‘i WooCommerce thĂ nh cĂ´ng! Sáº£n pháº©m máº«u: ${data[0]?.name || 'OK'}` };
    } catch (e) {
        return { success: false, message: `KhĂ´ng thá»ƒ káº¿t ná»‘i website: ${e.message}` };
    }
});

// 7. TĂ¬m kiáº¿m sáº£n pháº©m WooCommerce
ipcMain.handle('search-products', async (event, keyword) => {
    try {
        const cfg = readConfig();
        const url = (cfg.wp_url || '').replace(/\/+$/, '');
        const auth = Buffer.from(`${cfg.wp_user}:${cfg.wp_app_password}`).toString('base64');

        let endpoint = `${url}/wp-json/wc/v3/products?per_page=10&status=publish`;
        if (keyword && keyword.trim().length > 0) {
            endpoint = `${url}/wp-json/wc/v3/products?search=${encodeURIComponent(keyword.trim())}&per_page=10&status=publish`;
        }

        const res = await fetch(endpoint, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'User-Agent': 'GoogleAdsAutoGenerator/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
        const items = await res.json();
        const simplified = items.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price ? `${Number(p.price).toLocaleString('vi-VN')} Ä‘` : 'LiĂªn há»‡',
            regular_price: p.regular_price,
            sale_price: p.sale_price,
            permalink: p.permalink,
            image: p.images && p.images.length > 0 ? p.images[0].src : '',
            categories: p.categories ? p.categories.map(c => c.name).join(', ') : '',
            images: p.images ? p.images.map(img => img.src) : [],
            short_description: cleanHtmlText(p.short_description || p.description)
        }));

        return { success: true, products: simplified };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// 8. Láº¥y chi tiáº¿t sáº£n pháº©m
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
                price: p.price ? `${Number(p.price).toLocaleString('vi-VN')} Ä‘` : '',
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

// 9. Táº¡o chiáº¿n dá»‹ch Google Ads, táº£i áº£nh vĂ  xuáº¥t CSV All-in-One
ipcMain.handle('generate-campaign', async (event, params) => {
    const { product, campaignName, maxCpc, customImagesDir } = params;
    const cfg = readConfig();

    const apiKey = cfg.gemini_api_key;
    const model = cfg.gemini_model || 'gemini-2.5-flash';
    if (!apiKey) {
        return { success: false, error: 'Thiáº¿u Gemini API Key! Vui lĂ²ng nháº­p vĂ  lÆ°u trong Cáº¥u hĂ¬nh há»‡ thá»‘ng.' };
    }

    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    const effectiveCampaignName = campaignName || cfg.default_campaign_name || `Chiáº¿n dá»‹ch sáº£n pháº©m | ${todayStr}`;
    const effectiveMaxCpc = maxCpc ? parseInt(maxCpc, 10) : (cfg.max_cpc || 2000);

    // XĂ¡c Ä‘á»‹nh thÆ° má»¥c lÆ°u áº£nh chĂnh
    const rootImgDir = (customImagesDir && customImagesDir.trim()) ? customImagesDir.trim() : (cfg.root_images_dir || getDefaultImagesDir());
    const cleanProdName = sanitizeFolderName(product.title || 'san_pham');
    const targetProductImgDir = path.join(rootImgDir, cleanProdName);

    // 1. Gá» i Gemini API sinh ná»™i dung quáº£ng cĂ¡o chuáº©n
    const prompt = `
Báº¡n lĂ  chuyĂªn gia thiáº¿t láº­p Google Ads Search chuyĂªn nghiá»‡p cáº¥p cao.
Nhiá»‡m vá»¥ cá»§a báº¡n lĂ  Ä‘á» c ká»¹ thĂ´ng tin sáº£n pháº©m vĂ  táº¡o cáº¥u trĂºc Quáº£ng cĂ¡o tĂ¬m kiáº¿m thĂch á»©ng (Responsive Search Ads - RSA) Ä‘áº¡t Ä‘iá»ƒm tá»‘i Æ°u "Ráº¥t tá»‘t" (Ad Strength: Excellent).

THĂ”NG TIN Sáº¢N PHáº¨M:
- TiĂªu Ä‘á»  gá»‘c: ${product.title}
- GiĂ¡ bĂ¡n: ${product.price || 'Theo giĂ¡ web'}
- URL trang sáº£n pháº©m: ${product.url}
- Danh má»¥c: ${product.categories || ''}
- Ná»™i dung chi tiáº¿t:
${(product.description || '').substring(0, 3500)}

QUY Táº®C Báº®T BUá»˜C TRĂŠN GOOGLE ADS (VI PHáº M Sáº¼ Bá»Š GOOGLE Tá»ª CHá» I):
1. TĂªn nhĂ³m quáº£ng cĂ¡o (ad_group_name): Bắt buộc định dạng "Nhóm [Tên Rút Gọn] | ${todayStr}".
2. Ä Æ°á» ng dáº«n hiá»ƒn thá»‹:
   - path1: Tá»‘i Ä‘a 15 kĂ½ tá»±, tiáº¿ng Viá»‡t khĂ´ng dáº¥u hoáº·c tiáº¿ng Anh, ná»‘i báº±ng gáº¡ch ngang (vĂ­ dá»¥: "chinh-hang", "tri-mun", "gia-tot").
   - path2: Tá»‘i Ä‘a 15 kĂ½ tá»± (vĂ­ dá»¥: "30g", "chuan-y-khoa", "uu-dai").
3. TiĂªu Ä‘á»  quáº£ng cĂ¡o (headlines): Báº®T BUá»˜C Ä á»¦ 15 TIĂŠU Ä á»€.
   - Má»–I TIĂŠU Ä á»€ Tá» I Ä A 30 KĂ  Tá»° (Bao gá»“m cáº£ dáº¥u cĂ¡ch). Ä á»™ dĂ i an toĂ n 18 - 28 kĂ½ tá»±. Tuyá»‡t Ä‘á»‘i khĂ´ng vÆ°á»£t quĂ¡ 30 kĂ½ tá»±!
   - KhĂ´ng trĂ¹ng láº·p, Ä‘a dáº¡ng cĂ¡c gĂ³c Ä‘á»™: TĂªn sáº£n pháº©m, TĂªn thÆ°Æ¡ng hiá»‡u, CĂ´ng dá»¥ng chĂ­nh, Cam káº¿t chĂ­nh hĂ£ng, DÆ°á»£c sÄ© tÆ° váº¥n, GiĂ¡ tá»‘t hĂ´m nay, Giao hĂ ng nhanh.
   - Viáº¿t hoa chá»¯ cĂ¡i Ä‘áº§u má»—i tá»« (Title Case).
4. Ä oáº¡n mĂ´ táº£ (descriptions): Báº®T BUá»˜C Ä á»¦ 4 Ä Oáº N MĂ” Táº¢.
   - Má»–I Ä Oáº N MĂ” Táº¢ Tá» I Ä A 90 KĂ  Tá»° (Bao gá»“m cáº£ dáº¥u cĂ¡ch). Ä á»™ dĂ i an toĂ n 65 - 85 kĂ½ tá»±. Tuyá»‡t Ä‘á»‘i khĂ´ng quĂ¡ 90 kĂ½ tá»±!
5. Tá»« khĂ³a (keywords): Táº¡o danh sĂ¡ch 15 - 20 tá»« khĂ³a cĂ³ tá»· lá»‡ chuyá»ƒn Ä‘á»•i cao nháº¥t:
   - Tá»« khĂ³a Ä‘á»‘i sĂ¡nh cá»¥m tá»« Ä‘áº·t trong ngoáº·c kĂ©p: "tá»« khĂ³a"
   - Tá»« khĂ³a Ä‘á»‘i sĂ¡nh chĂ­nh xĂ¡c Ä‘áº·t trong ngoáº·c vuĂ´ng: [tá»« khĂ³a]

Ä á»ŠNH Dáº NG Ä áº¦U RA (JSON THUáº¦N TĂšY):
{
  "product_short_name": "TĂªn sáº£n pháº©m ngáº¯n gá» n",
  "ad_group_name": "NhĂ³m [TĂªn ngáº¯n gá» n] | ${todayStr}",
  "path1": "path-1",
  "path2": "path-2",
  "headlines": [ ... 15 tiĂªu Ä‘á»  <= 30 kĂ½ tá»± ],
  "descriptions": [ ... 4 mĂ´ táº£ <= 90 kĂ½ tá»± ],
  "keywords": [ ... 15-20 tá»« khĂ³a ]
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
        return { success: false, error: `Lá»—i gá» i Gemini AI: ${e.message}` };
    }

    // 2. Háº­u kiá»ƒm nghiĂªm ngáº·t Ä‘á»™ dĂ i kĂ½ tá»± Google Ads
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
        smartTruncate(`${shortName} ChĂ­nh HĂ£ng`, 30),
        smartTruncate("Cam Káº¿t Chuáº©n Y Khoa", 30),
        smartTruncate("Giao HĂ ng Nhanh ToĂ n Quá»‘c", 30),
        smartTruncate("DÆ°á»£c SÄ© TÆ° Váº¥n Táº­n TĂ¢m", 30),
        smartTruncate("GiĂ¡ Tá»‘t Nháº¥t HĂ´m Nay", 30),
        smartTruncate("Ä áº·t HĂ ng Ngay Nháº­n Æ¯u Ä Ă£i", 30),
        smartTruncate("HĂ ng Chuáº©n Ä á»§ HoĂ¡ Ä Æ¡n", 30)
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
        smartTruncate(`PhĂ¢n phá»‘i ${shortName} chuáº©n chĂ­nh hĂ£ng. Ä á»™i ngÅ© dÆ°á»£c sÄ© tÆ° váº¥n táº­n tĂ¬nh.`, 90),
        smartTruncate("Ä áº·t hĂ ng online nhanh chĂ³ng, kiá»ƒm tra hĂ ng trÆ°á»›c khi thanh toĂ¡n. Mua ngay!", 90),
        smartTruncate("Sáº£n pháº©m an toĂ n, rĂµ nguá»“n gá»‘c xuáº¥t xá»©, há»— trá»£ cáº£i thiá»‡n lĂ n da hiá»‡u quáº£.", 90),
        smartTruncate("Giao hĂ ng táº­n nÆ¡i toĂ n quá»‘c, há»— trá»£ 24/7. Xem chi tiáº¿t vĂ  Ä‘áº·t hĂ ng táº¡i Ä‘Ă¢y!", 90)
    ];
    for (const fd of fallbackD) {
        if (validDescriptions.length >= 4) break;
        if (!seenD.has(fd.toLowerCase())) {
            validDescriptions.push(fd);
            seenD.add(fd.toLowerCase());
        }
    }

    let adGroupName = aiData.ad_group_name || `NhĂ³m ${shortName} | ${todayStr}`;
    if (!adGroupName.startsWith('NhĂ³m ')) adGroupName = `NhĂ³m ${adGroupName}`;
    if (!adGroupName.includes('|')) adGroupName = `${adGroupName} | ${todayStr}`;

    const adData = {
        campaign_name: effectiveCampaignName,
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

    // 3. Táº£i hĂ¬nh áº£nh sáº£n pháº©m vĂ o thÆ° má»¥c Ä‘Æ°á»£c chá» n
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
                console.warn(`Lá»—i táº£i áº£nh ${imgUrl}:`, err.message);
            }
        }
    } catch (e) {
        console.error('Lá»—i táº¡o thÆ° má»¥c áº£nh:', e);
    }

    // 4. Xuáº¥t File CSV All-in-One chuáº©n Google Ads
    const outputDir = getDefaultOutputDir();
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const cleanFileTag = sanitizeFolderName(shortName);
    const csvFileName = `google_ads_all_in_one_${cleanFileTag}.csv`;
    const csvFilePath = path.join(outputDir, csvFileName);

    // CSV Headers
    const headers = [
        'Campaign', 'Ad group', 'Campaign status', 'Ad group status', 'Max CPC',
        'Ad type', 'Final URL', 'Path 1', 'Path 2'
    ];
    for (let i = 1; i <= 15; i++) headers.push(`Headline ${i}`);
    for (let i = 1; i <= 4; i++) headers.push(`Description ${i}`);
    headers.push('Keyword', 'Criterion Type');

    function escapeCsv(val) {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }

    const csvRows = [];
    csvRows.push(headers.map(escapeCsv).join(','));

    // DĂ²ng 1: Ad Group
    const rowAg = new Array(headers.length).fill('');
    rowAg[0] = effectiveCampaignName;
    rowAg[1] = adGroupName;
    rowAg[2] = 'Enabled';
    rowAg[3] = 'Enabled';
    rowAg[4] = effectiveMaxCpc;
    csvRows.push(rowAg.map(escapeCsv).join(','));

    // DĂ²ng 2: RSA Ads
    const rowAd = new Array(headers.length).fill('');
    rowAd[0] = effectiveCampaignName;
    rowAd[1] = adGroupName;
    rowAd[5] = 'Responsive search ad';
    rowAd[6] = product.url;
    rowAd[7] = path1;
    rowAd[8] = path2;
    for (let i = 0; i < 15; i++) {
        rowAd[9 + i] = adData.headlines[i] || '';
    }
    for (let i = 0; i < 4; i++) {
        rowAd[24 + i] = adData.descriptions[i] || '';
    }
    csvRows.push(rowAd.map(escapeCsv).join(','));

    // DĂ²ng 3..N: Keywords
    for (const kwRaw of adData.keywords) {
        const cleanKw = kwRaw.trim();
        let criterion = 'Broad';
        let kwText = cleanKw;
        if (cleanKw.startsWith('"') && cleanKw.endsWith('"')) {
            criterion = 'Phrase';
            kwText = cleanKw.slice(1, -1).trim();
        } else if (cleanKw.startsWith('[') && cleanKw.endsWith(']')) {
            criterion = 'Exact';
            kwText = cleanKw.slice(1, -1).trim();
        }

        const rowKw = new Array(headers.length).fill('');
        rowKw[0] = effectiveCampaignName;
        rowKw[1] = adGroupName;
        rowKw[4] = effectiveMaxCpc;
        rowKw[headers.length - 2] = kwText;
        rowKw[headers.length - 1] = criterion;
        csvRows.push(rowKw.map(escapeCsv).join(','));
    }

    // Ghi CSV vá»›i UTF-8 BOM (\uFEFF) Ä‘á»ƒ Excel Windows khĂ´ng lá»—i font tiáº¿ng Viá»‡t
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');

    return {
        success: true,
        ad_data: adData,
        images_folder: targetProductImgDir,
        downloaded_images: downloadedImages,
        csv_file_path: csvFilePath,
        csv_file_name: csvFileName,
        output_dir: outputDir
    };
});

// ==========================================
// KHá»žI CHáº Y á»¨NG Dá»¤NG
// ==========================================
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

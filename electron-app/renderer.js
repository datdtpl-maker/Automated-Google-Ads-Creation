// Google Ads Auto Generator Pro - Renderer Script
let currentConfig = null;
let currentSelectedProduct = null;
let lastGeneratedResult = null;
let searchDebounceTimer = null;

// Tiện ích Toast Thông báo
function showToast(message, type = 'success') {
  const container = document.getElementById('toast_container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Cập nhật terminal log
function updateTerminal(msg) {
  const tText = document.getElementById('terminal_text');
  const tTime = document.getElementById('terminal_time');
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  if (tText) tText.innerHTML = msg;
  if (tTime) tTime.innerText = timeStr;
}

// Khi ứng dụng khởi động
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadAndApplyConfig();
  await checkSystemHealth();
});

// Kiểm tra và khử mojibake
function cleanSafeText(str, fallback) {
  if (!str || /[\u00C0-\u00FF]{2,}|Tà€i|liĂª|ChiĂ/.test(str)) return fallback;
  return str;
}

// 1. Nạp và điền cấu hình mặc định nội bộ
async function loadAndApplyConfig() {
  try {
    const cfg = await window.electronAPI.getConfig();
    currentConfig = cfg;

    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    const cleanCampName = cleanSafeText(cfg.default_campaign_name, `Chiến dịch sản phẩm Web Derma | ${todayStr}`);
    const cleanImagesDir = cleanSafeText(cfg.root_images_dir, 'D:\\Project Anti\\Auto-Google-Ads\\output\\images');

    document.getElementById('cfg_gemini_key').value = cfg.gemini_api_key || '';
    if (cfg.gemini_model) document.getElementById('cfg_gemini_model').value = cfg.gemini_model;
    document.getElementById('cfg_wp_url').value = cfg.wp_url || 'https://khaihoanderma.com';
    document.getElementById('cfg_wp_user').value = cfg.wp_user || 'admin';
    document.getElementById('cfg_wp_password').value = cfg.wp_app_password || '';
    document.getElementById('cfg_root_images_dir').value = cleanImagesDir;
    document.getElementById('cfg_max_cpc').value = cfg.max_cpc || 2000;
    document.getElementById('cfg_default_camp_name').value = cleanCampName;

    // Điền giá trị mặc định trên thanh chiến dịch chính
    document.getElementById('input_campaign_name').value = cleanCampName;
    document.getElementById('input_max_cpc').value = cfg.max_cpc || 2000;
  } catch (err) {
    console.error('Lỗi nạp config:', err);
  }
}

// 2. Kiểm tra kết nối hệ thống ngầm
async function checkSystemHealth() {
  // Gemini Status
  const dotGemini = document.getElementById('dot_gemini');
  const textGemini = document.getElementById('text_gemini');
  if (currentConfig && currentConfig.gemini_api_key) {
    try {
      const res = await window.electronAPI.testGemini({ key: currentConfig.gemini_api_key });
      if (res.success) {
        dotGemini.className = 'status-dot active';
        textGemini.innerText = 'Gemini: Sẵn sàng';
      } else {
        dotGemini.className = 'status-dot warning';
        textGemini.innerText = 'Gemini: Key lỗi';
      }
    } catch (e) {
      dotGemini.className = 'status-dot warning';
      textGemini.innerText = 'Gemini: Chưa kết nối';
    }
  } else {
    dotGemini.className = 'status-dot warning';
    textGemini.innerText = 'Gemini: Thiếu Key';
  }

  // WooCommerce Status
  const dotWc = document.getElementById('dot_wc');
  const textWc = document.getElementById('text_wc');
  if (currentConfig && currentConfig.wp_app_password) {
    try {
      const resWc = await window.electronAPI.testWc({});
      if (resWc.success) {
        dotWc.className = 'status-dot active';
        textWc.innerText = 'WooCommerce: Kết nối';
      } else {
        dotWc.className = 'status-dot warning';
        textWc.innerText = 'WooCommerce: Lỗi kết nối';
      }
    } catch (e) {
      dotWc.className = 'status-dot warning';
      textWc.innerText = 'WooCommerce: Offline';
    }
  } else {
    dotWc.className = 'status-dot warning';
    textWc.innerText = 'WooCommerce: Chưa cấu hình';
  }
}

// 3. Thiết lập toàn bộ sự kiện giao diện
function setupEventListeners() {
  const sidebar = document.getElementById('sidebar_settings');
  const btnToggleSidebar = document.getElementById('btn_toggle_sidebar');
  const btnCloseSidebar = document.getElementById('btn_close_sidebar');

  // Toggle Sidebar
  const toggleSidebar = () => {
    sidebar.classList.toggle('collapsed');
    btnToggleSidebar.classList.toggle('active', !sidebar.classList.contains('collapsed'));
  };
  btnToggleSidebar.addEventListener('click', toggleSidebar);
  btnCloseSidebar.addEventListener('click', toggleSidebar);

  // Eye toggle password
  document.getElementById('btn_toggle_key_eye').addEventListener('click', () => {
    const input = document.getElementById('cfg_gemini_key');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('btn_toggle_pass_eye').addEventListener('click', () => {
    const input = document.getElementById('cfg_wp_password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Chọn thư mục Windows Explorer Dialog
  document.getElementById('btn_browse_folder').addEventListener('click', async () => {
    const current = document.getElementById('cfg_root_images_dir').value.trim();
    showToast('Đang mở hộp thoại chọn thư mục Windows...', 'success');
    const res = await window.electronAPI.selectFolder(current);
    if (res.success && res.path) {
      document.getElementById('cfg_root_images_dir').value = res.path;
      showToast(`Đã chọn thư mục: ${res.path}`, 'success');
    }
  });

  // Mở thư mục Explorer
  document.getElementById('btn_open_img_folder').addEventListener('click', async () => {
    const dir = document.getElementById('cfg_root_images_dir').value.trim();
    await window.electronAPI.openFolder(dir);
  });
  document.getElementById('btn_open_cfg_folder').addEventListener('click', async () => {
    const dir = document.getElementById('cfg_root_images_dir').value.trim();
    await window.electronAPI.openFolder(dir);
  });
  document.getElementById('btn_open_csv_folder').addEventListener('click', async () => {
    await window.electronAPI.openFolder('');
  });

  // Kiểm tra Gemini Key
  document.getElementById('btn_test_gemini').addEventListener('click', async () => {
    const key = document.getElementById('cfg_gemini_key').value.trim();
    const model = document.getElementById('cfg_gemini_model').value;
    updateTerminal('⏳ Đang kiểm tra Gemini API Key...');
    const res = await window.electronAPI.testGemini({ key, model });
    if (res.success) {
      showToast(res.message, 'success');
      updateTerminal(`✓ ${res.message}`);
      document.getElementById('dot_gemini').className = 'status-dot active';
      document.getElementById('text_gemini').innerText = 'Gemini: Sẵn sàng';
    } else {
      showToast(res.message, 'error');
      updateTerminal(`✗ ${res.message}`);
    }
  });

  // Kiểm tra WooCommerce
  document.getElementById('btn_test_wc').addEventListener('click', async () => {
    const wp_url = document.getElementById('cfg_wp_url').value.trim();
    const wp_user = document.getElementById('cfg_wp_user').value.trim();
    const wp_app_password = document.getElementById('cfg_wp_password').value.trim();
    updateTerminal('⏳ Đang kết nối WooCommerce API...');
    const res = await window.electronAPI.testWc({ wp_url, wp_user, wp_app_password });
    if (res.success) {
      showToast(res.message, 'success');
      updateTerminal(`✓ ${res.message}`);
      document.getElementById('dot_wc').className = 'status-dot active';
      document.getElementById('text_wc').innerText = 'WooCommerce: Kết nối';
    } else {
      showToast(res.message, 'error');
      updateTerminal(`✗ ${res.message}`);
    }
  });

  // Lưu cấu hình
  document.getElementById('btn_save_config').addEventListener('click', async () => {
    const newCfg = {
      gemini_api_key: document.getElementById('cfg_gemini_key').value.trim(),
      gemini_model: document.getElementById('cfg_gemini_model').value,
      wp_url: document.getElementById('cfg_wp_url').value.trim(),
      wp_user: document.getElementById('cfg_wp_user').value.trim(),
      wp_app_password: document.getElementById('cfg_wp_password').value.trim(),
      root_images_dir: document.getElementById('cfg_root_images_dir').value.trim(),
      max_cpc: parseInt(document.getElementById('cfg_max_cpc').value, 10) || 2000,
      default_campaign_name: document.getElementById('cfg_default_camp_name').value.trim()
    };
    const res = await window.electronAPI.saveConfig(newCfg);
    if (res.success) {
      currentConfig = res.config;
      showToast('Đã lưu cấu hình hệ thống an toàn trên máy tính!', 'success');
      await checkSystemHealth();
    } else {
      showToast('Lỗi khi lưu file cấu hình', 'error');
    }
  });

  // Tìm kiếm sản phẩm WooCommerce với Autocomplete
  const searchInput = document.getElementById('input_product_search');
  const searchDropdown = document.getElementById('search_dropdown');

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const query = e.target.value.trim();
    if (query.length === 0) {
      searchDropdown.style.display = 'none';
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      searchDropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center;">Đang tìm kiếm sản phẩm...</div>';
      searchDropdown.style.display = 'block';

      const res = await window.electronAPI.searchProducts(query);
      if (res.success && res.products.length > 0) {
        searchDropdown.innerHTML = '';
        res.products.forEach(p => {
          const item = document.createElement('div');
          item.className = 'dropdown-item';
          const imgTag = p.image ? `<img src="${p.image}" alt="">` : `<div style="width:44px;height:44px;background:#e2e8f0;border-radius:6px;"></div>`;
          item.innerHTML = `
            ${imgTag}
            <div class="dropdown-item-info">
              <div class="dropdown-item-title">${p.name}</div>
              <div class="dropdown-item-meta">
                <span class="dropdown-item-price">${p.price}</span>
                <span>${p.categories || 'Sản phẩm'}</span>
              </div>
            </div>
          `;
          item.addEventListener('click', () => {
            selectProduct(p);
            searchDropdown.style.display = 'none';
          });
          searchDropdown.appendChild(item);
        });
      } else {
        searchDropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center;">Không tìm thấy sản phẩm phù hợp.</div>';
      }
    }, 280);
  });

  // Đóng dropdown khi bấm ra ngoài
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.style.display = 'none';
    }
  });

  // Nút tạo chiến dịch
  document.getElementById('btn_generate_campaign').addEventListener('click', generateCampaign);

  // Tab switching trong kết quả
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
    });
  });

  // Nút mở thư mục ảnh sản phẩm hiện tại
  document.getElementById('btn_open_current_product_images').addEventListener('click', async () => {
    if (lastGeneratedResult && lastGeneratedResult.images_folder) {
      await window.electronAPI.openFolder(lastGeneratedResult.images_folder);
    }
  });

  // Nút hiển thị file CSV trong Windows Explorer
  document.getElementById('btn_show_csv_in_folder').addEventListener('click', async () => {
    if (lastGeneratedResult && lastGeneratedResult.csv_file_path) {
      await window.electronAPI.showItemInFolder(lastGeneratedResult.csv_file_path);
    }
  });

  // Nút sao chép
  document.getElementById('btn_copy_all_headlines').addEventListener('click', () => {
    if (!lastGeneratedResult) return;
    const text = lastGeneratedResult.ad_data.headlines.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép 15 tiêu đề vào Clipboard!', 'success');
  });

  document.getElementById('btn_copy_all_descriptions').addEventListener('click', () => {
    if (!lastGeneratedResult) return;
    const text = lastGeneratedResult.ad_data.descriptions.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép 4 mô tả vào Clipboard!', 'success');
  });

  document.getElementById('btn_copy_all_keywords').addEventListener('click', () => {
    if (!lastGeneratedResult) return;
    const text = lastGeneratedResult.ad_data.keywords.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép danh sách từ khóa vào Clipboard!', 'success');
  });

  document.getElementById('btn_copy_all_ad_text').addEventListener('click', () => {
    if (!lastGeneratedResult) return;
    const ad = lastGeneratedResult.ad_data;
    let text = `=== CHIẾN DỊCH: ${ad.campaign_name} ===\n`;
    text += `Nhóm quảng cáo: ${ad.ad_group_name}\n`;
    text += `URL Đích: ${ad.final_url}\n`;
    text += `Đường dẫn: /${ad.path1}/${ad.path2}\n\n`;
    text += `TIÊU ĐỀ (15):\n` + ad.headlines.map((h, i) => `${i + 1}. [${h.length} ký tự] ${h}`).join('\n') + `\n\n`;
    text += `MÔ TẢ (4):\n` + ad.descriptions.map((d, i) => `${i + 1}. [${d.length} ký tự] ${d}`).join('\n') + `\n\n`;
    text += `TỪ KHÓA:\n` + ad.keywords.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép toàn bộ văn bản chiến dịch!', 'success');
  });
}

// 4. Khi chọn một sản phẩm từ danh sách
function selectProduct(p) {
  currentSelectedProduct = {
    id: p.id,
    title: p.name,
    url: p.permalink,
    price: p.price,
    categories: p.categories,
    description: p.short_description || p.name,
    images: p.images || []
  };

  document.getElementById('p_thumb').src = p.image || 'icon.png';
  document.getElementById('p_title').innerText = p.name;
  document.getElementById('p_price').innerText = `Giá: ${p.price}`;
  document.getElementById('p_cat').innerText = `Danh mục: ${p.categories || 'Chung'}`;
  
  const linkEl = document.getElementById('p_url');
  linkEl.href = p.permalink || '#';

  // Tự động tạo tên chiến dịch gợi ý
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
  const shortTitle = p.name.split('–')[0].split('-')[0].trim();
  document.getElementById('input_campaign_name').value = `Chiến dịch ${shortTitle} | ${todayStr}`;

  updateTerminal(`● Đã chọn sản phẩm: "${p.name}". Bấm "Tạo chiến dịch" để xử lý.`);
  showToast(`Đã chọn: ${p.name}`, 'success');
}

// 5. Thực thi Tạo Chiến Dịch
async function generateCampaign() {
  if (!currentSelectedProduct) {
    showToast('Vui lòng tìm kiếm và chọn một sản phẩm trước!', 'error');
    return;
  }

  const btn = document.getElementById('btn_generate_campaign');
  const campaignName = document.getElementById('input_campaign_name').value.trim();
  const maxCpc = parseInt(document.getElementById('input_max_cpc').value, 10) || 2000;
  const customImagesDir = document.getElementById('cfg_root_images_dir').value.trim();

  btn.disabled = true;
  btn.innerHTML = `<span>⏳ Đang phân tích & tạo quảng cáo...</span>`;
  updateTerminal(`[1/5] Đang gửi thông tin sản phẩm sang Gemini AI...`);

  try {
    const res = await window.electronAPI.generateCampaign({
      product: currentSelectedProduct,
      campaignName,
      maxCpc,
      customImagesDir
    });

    if (!res.success) {
      showToast(res.error || 'Có lỗi xảy ra', 'error');
      updateTerminal(`✗ Thất bại: ${res.error}`);
      return;
    }

    lastGeneratedResult = res;
    updateTerminal(`✓ Thành công! Đã tạo quảng cáo, tải ${res.downloaded_images?.length || 0} ảnh và xuất CSV All-in-One.`);
    showToast(`Đã tạo chiến dịch thành công cho ${currentSelectedProduct.title}!`, 'success');

    renderResults(res);
  } catch (e) {
    showToast(`Lỗi ngoại lệ: ${e.message}`, 'error');
    updateTerminal(`✗ Lỗi: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>TẠO CHIẾN DỊCH & TẢI ẢNH</span>`;
  }
}

// 6. Hiển thị kết quả ra giao diện
function renderResults(data) {
  const resultsSection = document.getElementById('results_section');
  resultsSection.style.display = 'flex';

  const ad = data.ad_data;

  // 1. Mockup Tab
  const domain = (ad.final_url.match(/^(?:https?:\/\/)?([^\/]+)/i) || ['', 'khaihoanderma.com'])[1];
  document.getElementById('mock_display_url').innerText = `https://${domain}/${ad.path1}/${ad.path2}`;
  document.getElementById('mock_headline').innerText = `${ad.headlines[0] || ''} | ${ad.headlines[1] || ''} | ${ad.headlines[2] || ''}`;
  document.getElementById('mock_description').innerText = ad.descriptions[0] || '';

  // 2. Headlines Grid
  const gridH = document.getElementById('grid_headlines');
  gridH.innerHTML = '';
  ad.headlines.forEach((h, i) => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const badgeClass = h.length <= 28 ? 'safe' : 'warn';
    card.innerHTML = `
      <span class="asset-text"><b>${i + 1}.</b> ${h}</span>
      <div class="asset-meta">
        <span class="char-badge ${badgeClass}">${h.length}/30</span>
        <button class="btn-copy-asset" title="Sao chép tiêu đề này">📋</button>
      </div>
    `;
    card.querySelector('.btn-copy-asset').addEventListener('click', () => {
      navigator.clipboard.writeText(h);
      showToast(`Đã chép: "${h}"`, 'success');
    });
    gridH.appendChild(card);
  });

  // 3. Descriptions Grid
  const gridD = document.getElementById('grid_descriptions');
  gridD.innerHTML = '';
  ad.descriptions.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const badgeClass = d.length <= 85 ? 'safe' : 'warn';
    card.innerHTML = `
      <span class="asset-text"><b>${i + 1}.</b> ${d}</span>
      <div class="asset-meta">
        <span class="char-badge ${badgeClass}">${d.length}/90</span>
        <button class="btn-copy-asset" title="Sao chép mô tả này">📋</button>
      </div>
    `;
    card.querySelector('.btn-copy-asset').addEventListener('click', () => {
      navigator.clipboard.writeText(d);
      showToast(`Đã chép đoạn mô tả ${i + 1}`, 'success');
    });
    gridD.appendChild(card);
  });

  // 4. Keywords Grid
  const gridK = document.getElementById('grid_keywords');
  gridK.innerHTML = '';
  ad.keywords.forEach((k, i) => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const isExact = k.startsWith('[') && k.endsWith(']');
    const typeLabel = isExact ? 'Chính xác [ ]' : 'Cụm từ " "';
    const badgeClass = isExact ? 'safe' : 'warn';
    card.innerHTML = `
      <span class="asset-text"><b>${i + 1}.</b> ${k}</span>
      <div class="asset-meta">
        <span class="char-badge ${badgeClass}">${typeLabel}</span>
        <button class="btn-copy-asset" title="Sao chép từ khóa">📋</button>
      </div>
    `;
    card.querySelector('.btn-copy-asset').addEventListener('click', () => {
      navigator.clipboard.writeText(k);
      showToast(`Đã chép từ khóa: ${k}`, 'success');
    });
    gridK.appendChild(card);
  });

  // 5. Images Grid
  const gridImg = document.getElementById('grid_images');
  gridImg.innerHTML = '';
  document.getElementById('res_img_count').innerText = data.downloaded_images?.length || 0;
  document.getElementById('label_img_folder').innerText = data.images_folder || '--';

  (data.downloaded_images || []).forEach(img => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.title = img.fileName;
    item.innerHTML = `<img src="file://${img.localPath}" alt="${img.fileName}">`;
    gridImg.appendChild(item);
  });

  // 6. CSV Tab
  document.getElementById('label_csv_file_path').innerText = data.csv_file_path || '--';

  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

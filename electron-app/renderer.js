// Google Ads Auto Generator Pro - Renderer Script
let currentConfig = null;
let selectedProductsList = [];
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
  updateSelectedProductsUI();
});

// Kiểm tra và khử mojibake
function cleanSafeText(str, fallback) {
  if (!str || /[\u00C0-\u00FF]{2,}|Tà€i|liĂª|ChiĂ/.test(str)) return fallback;
  if (str === 'Chiến dịch sản phẩm Web Derma | 22/10') return 'Chiến dịch sản phẩm Web Derma | 21/10';
  return str;
}

// 1. Nạp và điền cấu hình mặc định nội bộ
async function loadAndApplyConfig() {
  try {
    const cfg = await window.electronAPI.getConfig();
    currentConfig = cfg;

    const cleanCampName = cleanSafeText(cfg.default_campaign_name, 'Chiến dịch sản phẩm Web Derma | 21/10');
    const cleanImagesDir = cleanSafeText(cfg.root_images_dir, 'D:\\Project Anti\\Auto-Google-Ads\\output\\images');

    document.getElementById('cfg_gemini_key').value = cfg.gemini_api_key || '';
    document.getElementById('cfg_gemini_model').value = 'gemini-3.8-flash';
    document.getElementById('cfg_wp_url').value = cfg.wp_url || 'https://khaihoanderma.com';
    document.getElementById('cfg_wp_user').value = cfg.wp_user || 'admin';
    document.getElementById('cfg_wp_password').value = cfg.wp_app_password || '';
    document.getElementById('cfg_root_images_dir').value = cleanImagesDir;
    document.getElementById('cfg_campaign_prefix').value = cfg.campaign_prefix || 'Chiến dịch SP - ';
    document.getElementById('input_campaign_prefix').value = cfg.campaign_prefix || 'Chiến dịch SP - ';
    document.getElementById('cfg_daily_budget').value = cfg.daily_budget || 50000;
    document.getElementById('input_daily_budget').value = cfg.daily_budget || 50000;
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

// 3. Quản lý trạng thái sản phẩm được chọn (Đơn lẻ & Hàng loạt)
function isProductSelected(pId) {
  return selectedProductsList.some(item => item.id === pId);
}

function toggleProductSelection(p, checkboxEl) {
  const idx = selectedProductsList.findIndex(item => item.id === p.id);
  if (idx >= 0) {
    selectedProductsList.splice(idx, 1);
    if (checkboxEl) checkboxEl.checked = false;
  } else {
    selectedProductsList.push({
      id: p.id,
      title: p.name,
      url: p.permalink,
      price: p.price,
      categories: p.categories,
      description: p.short_description || p.name,
      images: p.images || [],
      thumb: p.image || 'icon.png'
    });
    if (checkboxEl) checkboxEl.checked = true;
  }
  updateSelectedProductsUI();
}

function selectAllFromSearchResults(products) {
  products.forEach(p => {
    if (!isProductSelected(p.id)) {
      selectedProductsList.push({
        id: p.id,
        title: p.name,
        url: p.permalink,
        price: p.price,
        categories: p.categories,
        description: p.short_description || p.name,
        images: p.images || [],
        thumb: p.image || 'icon.png'
      });
    }
  });
  const cbs = document.querySelectorAll('.dropdown-item-cb');
  cbs.forEach(cb => cb.checked = true);
  updateSelectedProductsUI();
}

function removeProductFromSelection(pId) {
  selectedProductsList = selectedProductsList.filter(item => item.id !== pId);
  const cb = document.querySelector(`.dropdown-item-cb[data-id="${pId}"]`);
  if (cb) cb.checked = false;
  updateSelectedProductsUI();
}

function clearAllSelections() {
  selectedProductsList = [];
  const cbs = document.querySelectorAll('.dropdown-item-cb');
  cbs.forEach(cb => cb.checked = false);
  updateSelectedProductsUI();
}

function updateSelectedProductsUI() {
  const cardSingle = document.getElementById('card_selected_product');
  const cardBatch = document.getElementById('card_batch_products');
  const btnGen = document.getElementById('btn_generate_campaign');
  const batchCountEl = document.getElementById('batch_count');
  const batchChipsList = document.getElementById('batch_chips_list');

  const count = selectedProductsList.length;

  // Giữ nguyên tên chiến dịch người dùng đã nhập, chỉ điền nếu ô đang trống
  const currentCamp = document.getElementById('input_campaign_name').value.trim();
  if (!currentCamp) {
    document.getElementById('input_campaign_name').value = 'Chiến dịch sản phẩm Web Derma | 21/10';
  }

  if (count === 0) {
    cardSingle.style.display = 'flex';
    cardBatch.style.display = 'none';
    document.getElementById('p_thumb').src = 'icon.png';
    document.getElementById('p_title').innerText = 'Chưa chọn sản phẩm nào (Gõ tìm kiếm ở trên để chọn một hoặc nhiều sản phẩm)';
    document.getElementById('p_price').innerText = 'Giá: --';
    document.getElementById('p_cat').innerText = 'Danh mục: --';
    document.getElementById('p_url').href = '#';

    btnGen.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>TẠO CHIẾN DỊCH & TẢI ẢNH</span>`;
  } else if (count === 1) {
    cardSingle.style.display = 'flex';
    cardBatch.style.display = 'none';

    const p = selectedProductsList[0];
    document.getElementById('p_thumb').src = p.thumb || 'icon.png';
    document.getElementById('p_title').innerText = p.title;
    document.getElementById('p_price').innerText = `Giá: ${p.price}`;
    document.getElementById('p_cat').innerText = `Danh mục: ${p.categories || 'Chung'}`;
    document.getElementById('p_url').href = p.url || '#';

    btnGen.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>TẠO CHIẾN DỊCH & TẢI ẢNH (1 SẢN PHẨM)</span>`;
    updateTerminal(`● Đã chọn 1 sản phẩm: "${p.title}". Bấm nút bên dưới để tạo.`);
  } else {
    // Chế độ hàng loạt
    cardSingle.style.display = 'none';
    cardBatch.style.display = 'flex';
    if (batchCountEl) batchCountEl.innerText = count;

    if (batchChipsList) {
      batchChipsList.innerHTML = '';
      selectedProductsList.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'batch-chip';
        chip.innerHTML = `
          <img src="${p.thumb || 'icon.png'}" alt="">
          <span title="${p.title}">${p.title.length > 25 ? p.title.slice(0, 23) + '...' : p.title}</span>
          <span class="batch-chip-remove" title="Bỏ chọn sản phẩm này">✕</span>
        `;
        chip.querySelector('.batch-chip-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          removeProductFromSelection(p.id);
        });
        batchChipsList.appendChild(chip);
      });
    }

    btnGen.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>TẠO HÀNG LOẠT (${count} SẢN PHẨM) & TẢI ẢNH</span>`;
    updateTerminal(`● Đã chọn ${count} sản phẩm để tạo hàng loạt trong 1 file CSV duy nhất.`);
  }
}

// 4. Thiết lập toàn bộ sự kiện giao diện
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
      campaign_prefix: document.getElementById('cfg_campaign_prefix').value.trim() || 'Chiến dịch SP - ',
      daily_budget: parseInt(document.getElementById('cfg_daily_budget').value, 10) || 50000,
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

  // Chuyển đổi chế độ Chiến dịch (Tách riêng từng sản phẩm vs Gộp chung)
  const radioSeparate = document.getElementById('radio_mode_separate');
  const radioSingle = document.getElementById('radio_mode_single');
  const labelSeparate = document.getElementById('label_mode_separate');
  const labelSingle = document.getElementById('label_mode_single');
  const grpCampName = document.getElementById('grp_campaign_name');
  const grpCampPrefix = document.getElementById('grp_campaign_prefix');
  const grpDailyBudget = document.getElementById('grp_daily_budget');
  const campaignBar = document.querySelector('.campaign-bar');

  function updateCampaignModeUI() {
    const isSeparate = radioSeparate.checked;
    labelSeparate.classList.toggle('active', isSeparate);
    labelSingle.classList.toggle('active', !isSeparate);
    if (grpCampName) grpCampName.style.display = isSeparate ? 'none' : 'flex';
    if (grpCampPrefix) grpCampPrefix.style.display = isSeparate ? 'flex' : 'none';
    if (grpDailyBudget) grpDailyBudget.style.display = isSeparate ? 'flex' : 'none';
    if (campaignBar) {
      campaignBar.style.gridTemplateColumns = isSeparate ? '1.2fr 1fr 1fr auto' : '2fr 1fr auto';
    }
  }

  if (radioSeparate && radioSingle) {
    radioSeparate.addEventListener('change', updateCampaignModeUI);
    radioSingle.addEventListener('change', updateCampaignModeUI);
  }

  // Nút xóa tất cả sản phẩm hàng loạt
  const btnClearBatch = document.getElementById('btn_clear_batch');
  if (btnClearBatch) {
    btnClearBatch.addEventListener('click', () => {
      clearAllSelections();
      showToast('Đã bỏ chọn tất cả sản phẩm', 'success');
    });
  }

  // Tìm kiếm sản phẩm WooCommerce với Autocomplete & Multi-select Checkbox
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

        // Thanh thao tác trên cùng dropdown
        const topBar = document.createElement('div');
        topBar.className = 'dropdown-top-bar';
        topBar.innerHTML = `
          <span>Tìm thấy ${res.products.length} sản phẩm</span>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button type="button" class="btn-clear-batch" id="btn_dd_select_all" style="font-weight: 600; font-size: 11px; color: var(--google-blue); text-decoration: underline;">Chọn tất cả</button>
            <button type="button" class="dropdown-done-btn" id="btn_dd_done">Xong</button>
          </div>
        `;
        searchDropdown.appendChild(topBar);

        topBar.querySelector('#btn_dd_select_all').addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectAllFromSearchResults(res.products);
          showToast(`Đã chọn tất cả ${res.products.length} sản phẩm trong kết quả`, 'success');
        });

        topBar.querySelector('#btn_dd_done').addEventListener('click', (ev) => {
          ev.stopPropagation();
          searchDropdown.style.display = 'none';
        });

        // Danh sách sản phẩm
        res.products.forEach(p => {
          const item = document.createElement('div');
          item.className = 'dropdown-item';
          const isChecked = isProductSelected(p.id);
          const imgTag = p.image ? `<img src="${p.image}" alt="">` : `<div style="width:44px;height:44px;background:#e2e8f0;border-radius:6px;"></div>`;
          item.innerHTML = `
            <input type="checkbox" class="dropdown-item-cb" data-id="${p.id}" ${isChecked ? 'checked' : ''}>
            ${imgTag}
            <div class="dropdown-item-info">
              <div class="dropdown-item-title">${p.name}</div>
              <div class="dropdown-item-meta">
                <span class="dropdown-item-price">${p.price}</span>
                <span>${p.categories || 'Sản phẩm'}</span>
              </div>
            </div>
          `;

          const cb = item.querySelector('.dropdown-item-cb');
          cb.addEventListener('click', (ev) => {
            ev.stopPropagation();
            toggleProductSelection(p, cb);
          });

          item.addEventListener('click', (ev) => {
            if (ev.target !== cb) {
              toggleProductSelection(p, cb);
            }
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

  // Nút sao chép đường dẫn thư mục ảnh
  const btnCopyImgPath = document.getElementById('btn_copy_product_images_path');
  if (btnCopyImgPath) {
    btnCopyImgPath.addEventListener('click', () => {
      if (lastGeneratedResult && lastGeneratedResult.images_folder) {
        navigator.clipboard.writeText(lastGeneratedResult.images_folder);
        showToast('Đã sao chép đường dẫn thư mục ảnh vào Clipboard!', 'success');
      }
    });
  }

  // Nút sao chép đường dẫn file CSV
  const btnCopyCsvPath = document.getElementById('btn_copy_csv_file_path');
  if (btnCopyCsvPath) {
    btnCopyCsvPath.addEventListener('click', () => {
      if (lastGeneratedResult && lastGeneratedResult.csv_file_path) {
        navigator.clipboard.writeText(lastGeneratedResult.csv_file_path);
        showToast('Đã sao chép đường dẫn file CSV! (Bấm Ctrl+V tại ô File Name để chọn file)', 'success');
      }
    });
  }

  // Nút sao chép đường dẫn thư mục chứa CSV
  const btnCopyCsvFolder = document.getElementById('btn_copy_csv_folder_path');
  if (btnCopyCsvFolder) {
    btnCopyCsvFolder.addEventListener('click', () => {
      if (lastGeneratedResult && lastGeneratedResult.output_dir) {
        navigator.clipboard.writeText(lastGeneratedResult.output_dir);
        showToast('Đã sao chép đường dẫn thư mục chứa file CSV!', 'success');
      }
    });
  }

  // Nút sao chép nội dung văn bản
  document.getElementById('btn_copy_all_headlines').addEventListener('click', () => {
    if (!lastGeneratedResult || !lastGeneratedResult.ad_data) return;
    const text = lastGeneratedResult.ad_data.headlines.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép 15 tiêu đề vào Clipboard!', 'success');
  });

  document.getElementById('btn_copy_all_descriptions').addEventListener('click', () => {
    if (!lastGeneratedResult || !lastGeneratedResult.ad_data) return;
    const text = lastGeneratedResult.ad_data.descriptions.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép 4 mô tả vào Clipboard!', 'success');
  });

  document.getElementById('btn_copy_all_keywords').addEventListener('click', () => {
    if (!lastGeneratedResult || !lastGeneratedResult.ad_data) return;
    const text = lastGeneratedResult.ad_data.keywords.join('\n');
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép danh sách từ khóa vào Clipboard!', 'success');
  });

  const copyAdTextBtn = document.getElementById('btn_copy_all_ad_text');
  if (copyAdTextBtn) {
    copyAdTextBtn.addEventListener('click', () => {
      if (!lastGeneratedResult || !lastGeneratedResult.ad_data) return;
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
}

// 5. Thực thi Tạo Chiến Dịch (Hàng loạt hoặc Đơn lẻ)
async function generateCampaign() {
  if (selectedProductsList.length === 0) {
    showToast('Vui lòng tìm kiếm và chọn ít nhất một sản phẩm trước!', 'error');
    return;
  }

  const btn = document.getElementById('btn_generate_campaign');
  const campaignMode = document.querySelector('input[name="campaign_mode"]:checked')?.value || 'separate';
  const campaignPrefix = document.getElementById('input_campaign_prefix').value.trim() || 'Chiến dịch SP - ';
  const campaignName = document.getElementById('input_campaign_name').value.trim();
  const dailyBudget = parseInt(document.getElementById('input_daily_budget').value, 10) || 50000;
  const maxCpc = parseInt(document.getElementById('input_max_cpc').value, 10) || 2000;
  const customImagesDir = document.getElementById('cfg_root_images_dir').value.trim();

  btn.disabled = true;
  const isBatch = selectedProductsList.length > 1;
  const modeText = campaignMode === 'separate' ? 'Chiến dịch riêng' : 'Nhóm quảng cáo';
  btn.innerHTML = `<span>⏳ Đang xử lý ${selectedProductsList.length} ${modeText}...</span>`;
  updateTerminal(`[1/${selectedProductsList.length + 1}] Bắt đầu quy trình tạo Google Ads (${campaignMode === 'separate' ? 'Tạo Chiến dịch riêng biệt' : 'Gộp vào 1 chiến dịch'})...`);

  // Lắng nghe tiến độ batch real-time
  if (window.electronAPI.removeProgressListener) window.electronAPI.removeProgressListener();
  if (window.electronAPI.onProgress) {
    window.electronAPI.onProgress((data) => {
      updateTerminal(`● [${data.current}/${data.total}] Đang xử lý: "${data.productTitle}"...`);
    });
  }

  try {
    const res = await window.electronAPI.generateBatchCampaign({
      products: selectedProductsList,
      campaignMode,
      campaignPrefix,
      campaignName,
      dailyBudget,
      maxCpc,
      customImagesDir
    });

    if (!res.success) {
      showToast(res.error || 'Có lỗi xảy ra', 'error');
      updateTerminal(`✗ Thất bại: ${res.error}`);
      return;
    }

    lastGeneratedResult = res;

    if (res.campaign_mode === 'separate') {
      updateTerminal(`✓ Hoàn tất! Đã tạo ${res.successful_products} Chiến dịch riêng biệt (tự động tạo Ngân sách ngày & Nhóm) trong file CSV Master.`);
      showToast(`Tạo thành công ${res.successful_products} Chiến dịch riêng biệt!`, 'success');
    } else if (res.is_batch) {
      updateTerminal(`✓ Thành công! Đã tạo ${res.successful_products} nhóm quảng cáo trong file CSV Master duy nhất.`);
      showToast(`Tạo thành công ${res.successful_products} nhóm quảng cáo hàng loạt!`, 'success');
    } else {
      updateTerminal(`✓ Thành công! Đã tạo quảng cáo, tải ${res.downloaded_images?.length || 0} ảnh và xuất CSV All-in-One.`);
      showToast(`Đã tạo chiến dịch thành công cho ${selectedProductsList[0].title}!`, 'success');
    }

    renderResults(res);
  } catch (e) {
    showToast(`Lỗi ngoại lệ: ${e.message}`, 'error');
    updateTerminal(`✗ Lỗi: ${e.message}`);
  } finally {
    if (window.electronAPI.removeProgressListener) window.electronAPI.removeProgressListener();
    btn.disabled = false;
    updateSelectedProductsUI();
  }
}

// 6. Hiển thị kết quả ra giao diện
function renderResults(data) {
  const resultsSection = document.getElementById('results_section');
  resultsSection.style.display = 'flex';

  const ad = data.ad_data || (data.products_results && data.products_results[0]?.adData);
  if (!ad) return;

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

  // 5. Images Grid - Tổng hợp ảnh của tất cả sản phẩm đã tải
  const gridImg = document.getElementById('grid_images');
  gridImg.innerHTML = '';

  const allImages = [];
  if (data.products_results && data.products_results.length > 0) {
    data.products_results.forEach(pr => {
      if (pr.downloaded_images) allImages.push(...pr.downloaded_images);
    });
  } else if (data.downloaded_images) {
    allImages.push(...data.downloaded_images);
  }

  document.getElementById('res_img_count').innerText = allImages.length;
  document.getElementById('label_img_folder').innerText = data.images_folder || '--';

  allImages.forEach(img => {
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

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

  // Khởi động nhanh bộ nhớ cache sản phẩm local
  try {
    const res = await window.electronAPI.searchProducts('');
    if (res && res.total_cached) {
      const lbl = document.getElementById('label_sync_status');
      if (lbl) lbl.innerText = `Đồng bộ SP (${res.total_cached})`;
    }
  } catch (e) {}

  // Quét ngầm số lượng nhiệm vụ Notion ban đầu để cập nhật badge
  setTimeout(async () => {
    try {
      const resN = await window.electronAPI.fetchNotionTasks('all');
      if (resN.success && Array.isArray(resN.tasks)) {
        notionTasksList = resN.tasks;
        updateNotionFilterCounts();
      }
    } catch (e) {}
  }, 800);
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
    document.getElementById('cfg_daily_budget').value = cfg.daily_budget || 100000;
    document.getElementById('input_daily_budget').value = cfg.daily_budget || 100000;
    document.getElementById('cfg_max_cpc').value = cfg.max_cpc || 2000;
    document.getElementById('cfg_default_camp_name').value = cleanCampName;

    // Cấu hình Notion
    if (document.getElementById('cfg_notion_token')) {
      document.getElementById('cfg_notion_token').value = cfg.notion_token || '';
    }
    if (document.getElementById('cfg_notion_database_id')) {
      document.getElementById('cfg_notion_database_id').value = cfg.notion_database_id || '';
    }
    if (document.getElementById('cfg_notion_page_id')) {
      document.getElementById('cfg_notion_page_id').value = cfg.notion_page_id || '';
    }

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

  // Notion Status
  const dotNotion = document.getElementById('dot_notion');
  const textNotion = document.getElementById('text_notion');
  if (dotNotion && textNotion) {
    if (currentConfig && currentConfig.notion_token) {
      try {
        const resN = await window.electronAPI.testNotion({});
        if (resN.success) {
          dotNotion.className = 'status-dot active';
          textNotion.innerText = 'Notion: Kết nối';
        } else {
          dotNotion.className = 'status-dot warning';
          textNotion.innerText = 'Notion: Lỗi kết nối';
        }
      } catch (e) {
        dotNotion.className = 'status-dot warning';
        textNotion.innerText = 'Notion: Offline';
      }
    } else {
      dotNotion.className = 'status-dot warning';
      textNotion.innerText = 'Notion: Chưa cấu hình';
    }
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
          <span title="${p.title}">${p.title}</span>
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

  // Eye toggle Notion token
  const btnToggleNotionEye = document.getElementById('btn_toggle_notion_token_eye');
  if (btnToggleNotionEye) {
    btnToggleNotionEye.addEventListener('click', () => {
      const input = document.getElementById('cfg_notion_token');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  // Kiểm tra Notion
  const btnTestNotion = document.getElementById('btn_test_notion');
  if (btnTestNotion) {
    btnTestNotion.addEventListener('click', async () => {
      const token = document.getElementById('cfg_notion_token').value.trim();
      const databaseId = document.getElementById('cfg_notion_database_id').value.trim();
      updateTerminal('⏳ Đang kiểm tra kết nối Notion API...');
      const res = await window.electronAPI.testNotion({ token, databaseId });
      if (res.success) {
        showToast(res.message, 'success');
        updateTerminal(`✓ ${res.message}`);
        const dotNotion = document.getElementById('dot_notion');
        const textNotion = document.getElementById('text_notion');
        if (dotNotion) dotNotion.className = 'status-dot active';
        if (textNotion) textNotion.innerText = 'Notion: Sẵn sàng';
      } else {
        showToast(res.message, 'error');
        updateTerminal(`✗ ${res.message}`);
      }
    });
  }

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
      daily_budget: parseInt(document.getElementById('cfg_daily_budget').value, 10) || 100000,
      max_cpc: parseInt(document.getElementById('cfg_max_cpc').value, 10) || 2000,
      default_campaign_name: document.getElementById('cfg_default_camp_name').value.trim(),
      notion_token: document.getElementById('cfg_notion_token')?.value.trim() || '',
      notion_database_id: document.getElementById('cfg_notion_database_id')?.value.trim() || '',
      notion_page_id: document.getElementById('cfg_notion_page_id')?.value.trim() || ''
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

  // Sự kiện mở & thao tác Notion Modal
  const btnOpenNotionHub = document.getElementById('btn_open_notion_hub');
  if (btnOpenNotionHub) btnOpenNotionHub.addEventListener('click', openNotionModal);

  const btnScanNotionTasks = document.getElementById('btn_scan_notion_tasks');
  if (btnScanNotionTasks) btnScanNotionTasks.addEventListener('click', openNotionModal);

  const btnCloseNotionModal = document.getElementById('btn_close_notion_modal');
  if (btnCloseNotionModal) btnCloseNotionModal.addEventListener('click', closeNotionModal);

  const notionModalOverlay = document.getElementById('notion_modal_overlay');
  if (notionModalOverlay) {
    notionModalOverlay.addEventListener('click', (e) => {
      if (e.target === notionModalOverlay) closeNotionModal();
    });
  }

  const btnRefreshNotion = document.getElementById('btn_refresh_notion');
  if (btnRefreshNotion) {
    btnRefreshNotion.addEventListener('click', async () => {
      showToast('Đang tải lại dữ liệu mới nhất từ Notion...', 'success');
      await loadNotionTasks();
    });
  }

  const btnOpenNotionLink = document.getElementById('btn_open_notion_link');
  if (btnOpenNotionLink) {
    btnOpenNotionLink.addEventListener('click', () => {
      window.electronAPI.openExternalUrl('https://app.notion.com/p/40270655a9aa81a093d6dae93c86f895');
    });
  }

  const btnOpenNotionWebBanner = document.getElementById('btn_open_notion_web_banner');
  if (btnOpenNotionWebBanner) {
    btnOpenNotionWebBanner.addEventListener('click', () => {
      window.electronAPI.openExternalUrl('https://app.notion.com/p/40270655a9aa81a093d6dae93c86f895');
    });
  }

  // Filter tabs trong Notion Modal
  ['Chờ tạo', 'Đang chạy Google Ads', 'Chưa xử lý', 'all'].forEach(st => {
    const btnTab = document.querySelector(`.notion-tab-btn[data-status="${st}"]`);
    if (btnTab) {
      btnTab.addEventListener('click', () => {
        document.querySelectorAll('.notion-tab-btn').forEach(b => b.classList.remove('active'));
        btnTab.classList.add('active');
        currentNotionFilter = st;
        renderNotionTasks();
      });
    }
  });

  // Search input trong Notion Modal
  const inputNotionSearch = document.getElementById('input_notion_search');
  if (inputNotionSearch) {
    inputNotionSearch.addEventListener('input', (e) => {
      notionSearchKeyword = e.target.value;
      renderNotionTasks();
    });
  }

  // Select all Pending (Chờ tạo)
  const btnSelectAllPending = document.getElementById('btn_select_all_pending');
  if (btnSelectAllPending) {
    btnSelectAllPending.addEventListener('click', () => {
      notionTasksList.forEach(t => {
        if (t.status === 'Chờ tạo') {
          selectedNotionTasksSet.add(t.page_id);
        }
      });
      renderNotionTasks();
      showToast(`Đã chọn ${selectedNotionTasksSet.size} sản phẩm đang Chờ tạo!`, 'success');
    });
  }

  // Deselect all
  const btnDeselectAllNotion = document.getElementById('btn_deselect_all_notion');
  if (btnDeselectAllNotion) {
    btnDeselectAllNotion.addEventListener('click', () => {
      selectedNotionTasksSet.clear();
      renderNotionTasks();
    });
  }

  // Checkbox Select All trên tiêu đề bảng Notion
  const cbNotionSelectAll = document.getElementById('cb_notion_select_all');
  if (cbNotionSelectAll) {
    cbNotionSelectAll.addEventListener('change', () => {
      const isChecked = cbNotionSelectAll.checked;
      const visibleCheckboxes = document.querySelectorAll('.cb-notion-row');
      visibleCheckboxes.forEach(cb => {
        const pId = cb.getAttribute('data-id');
        cb.checked = isChecked;
        if (isChecked) {
          selectedNotionTasksSet.add(pId);
        } else {
          selectedNotionTasksSet.delete(pId);
        }
      });
      updateNotionSelectedCount();
    });
  }

  // Đồng bộ thêm sản phẩm từ Web lên Notion
  const btnSyncMoreNotion = document.getElementById('btn_sync_more_notion');
  if (btnSyncMoreNotion) {
    btnSyncMoreNotion.addEventListener('click', async () => {
      showToast('Đang kiểm tra và đồng bộ sản phẩm mới lên Notion...', 'success');
      btnSyncMoreNotion.disabled = true;
      try {
        const res = await window.electronAPI.syncNotionProducts();
        if (res.success) {
          showToast(`Đồng bộ hoàn tất! Đã thêm mới ${res.added} sản phẩm lên Notion.`, 'success');
          await loadNotionTasks();
        } else {
          showToast(res.error || 'Lỗi khi đồng bộ sản phẩm lên Notion', 'error');
        }
      } catch (e) {
        showToast(`Lỗi: ${e.message}`, 'error');
      } finally {
        btnSyncMoreNotion.disabled = false;
      }
    });
  }

  // Thực thi tạo chiến dịch từ Notion
  const btnExecuteNotion = document.getElementById('btn_execute_notion_campaigns');
  if (btnExecuteNotion) {
    btnExecuteNotion.addEventListener('click', executeNotionCampaignsFlow);
  }



  // Nút xóa tất cả sản phẩm hàng loạt
  const btnClearBatch = document.getElementById('btn_clear_batch');
  if (btnClearBatch) {
    btnClearBatch.addEventListener('click', () => {
      clearAllSelections();
      showToast('Đã bỏ chọn tất cả sản phẩm', 'success');
    });
  }

  // Nút đồng bộ sản phẩm từ website về máy tính
  const btnSync = document.getElementById('btn_sync_products');
  const labelSync = document.getElementById('label_sync_status');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.classList.add('syncing');
      labelSync.innerText = 'Đang đồng bộ...';
      updateTerminal('⏳ Đang kết nối website tải toàn bộ danh mục sản phẩm...');
      try {
        const res = await window.electronAPI.syncProducts(true);
        if (res.success) {
          labelSync.innerText = `Đồng bộ SP (${res.count})`;
          showToast(`Đã đồng bộ thành công ${res.count} sản phẩm từ website!`, 'success');
          updateTerminal(`✓ Đã nạp ${res.count} sản phẩm vào bộ nhớ máy tính. Tìm kiếm siêu tốc!`);
          // Cập nhật lại dropdown nếu đang mở
          const query = searchInput.value.trim();
          performSearch(query);
        } else {
          labelSync.innerText = 'Đồng bộ SP';
          showToast('Lỗi khi đồng bộ sản phẩm: ' + (res.error || ''), 'error');
        }
      } catch (e) {
        labelSync.innerText = 'Đồng bộ SP';
        showToast('Lỗi kết nối: ' + e.message, 'error');
      } finally {
        btnSync.classList.remove('syncing');
      }
    });
  }

  // Tìm kiếm sản phẩm WooCommerce với In-Memory Smart Search (Siêu tốc < 5ms)
  const searchInput = document.getElementById('input_product_search');
  const searchDropdown = document.getElementById('search_dropdown');

  async function performSearch(query) {
    if (!query || query.length === 0) {
      searchDropdown.style.display = 'none';
      return;
    }

    const res = await window.electronAPI.searchProducts(query);
    if (res.success && res.products.length > 0) {
      searchDropdown.innerHTML = '';

      // Thanh thao tác trên cùng dropdown
      const topBar = document.createElement('div');
      topBar.className = 'dropdown-top-bar';
      topBar.innerHTML = `
        <span>Tìm thấy ${res.products.length} sản phẩm phù hợp</span>
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

      // Danh sách sản phẩm được xếp hạng độ chính xác cao nhất lên đầu
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
            const sel = window.getSelection().toString();
            if (sel && sel.trim().length > 0) {
              return; // Đang quét chuột chọn text để copy, không kích hoạt chọn/bỏ chọn
            }
            toggleProductSelection(p, cb);
          }
        });

        searchDropdown.appendChild(item);
      });
      searchDropdown.style.display = 'block';
    } else {
      searchDropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--text-muted); text-align: center;">Không tìm thấy sản phẩm phù hợp. Thử từ khóa khác hoặc bấm nút "Đồng bộ SP".</div>';
      searchDropdown.style.display = 'block';
    }
  }

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const query = e.target.value.trim();
    if (query.length === 0) {
      searchDropdown.style.display = 'none';
      return;
    }
    // Tìm kiếm tức thì trong bộ nhớ local chỉ cần delay 40ms
    searchDebounceTimer = setTimeout(() => {
      performSearch(query);
    }, 40);
  });

  searchInput.addEventListener('focus', () => {
    const query = searchInput.value.trim();
    if (query.length > 0) {
      performSearch(query);
    }
  });

  // Đóng dropdown khi bấm ra ngoài
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.style.display = 'none';
    }
  });

  // Nút tạo chiến dịch
  document.getElementById('btn_generate_campaign').addEventListener('click', generateCampaign);

  // Hàm chuyển tab kết quả an toàn và đồng bộ
  function switchResultTab(tabId) {
    if (!tabId) return;

    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(t => {
      const isTarget = t.getAttribute('data-tab') === tabId;
      t.classList.toggle('active', isTarget);
    });

    panes.forEach(p => {
      const isTarget = p.id === tabId;
      p.classList.toggle('active', isTarget);
    });

    // Đồng bộ trạng thái thẻ chip trong Progress Card
    const stepAi = document.getElementById('step_ai');
    const stepImg = document.getElementById('step_img');
    const stepCsv = document.getElementById('step_csv');

    if (stepAi && stepImg && stepCsv) {
      stepAi.classList.toggle('active', ['tab_preview', 'tab_headlines', 'tab_descriptions', 'tab_keywords'].includes(tabId));
      stepImg.classList.toggle('active', tabId === 'tab_images');
      stepCsv.classList.toggle('active', tabId === 'tab_csv');
    }
  }

  // Tab switching qua thanh điều hướng
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('data-tab');
      switchResultTab(targetId);
    });
  });

  // Event delegation cho results-nav phòng trường hợp icon/text con bị bấm
  const resultsNav = document.querySelector('.results-nav');
  if (resultsNav) {
    resultsNav.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.nav-tab');
      if (tabBtn) {
        e.preventDefault();
        const targetId = tabBtn.getAttribute('data-tab');
        switchResultTab(targetId);
      }
    });
  }

  // Cho phép bấm trực tiếp vào các ô tiến trình để chuyển tab kiểm tra nhanh
  const stepAiEl = document.getElementById('step_ai');
  const stepImgEl = document.getElementById('step_img');
  const stepCsvEl = document.getElementById('step_csv');

  if (stepAiEl) {
    stepAiEl.title = 'Bấm để kiểm tra Tiêu đề, Mô tả & Từ khóa AI';
    stepAiEl.addEventListener('click', () => switchResultTab('tab_headlines'));
  }
  if (stepImgEl) {
    stepImgEl.title = 'Bấm để kiểm tra Ảnh đã tải về';
    stepImgEl.addEventListener('click', () => switchResultTab('tab_images'));
  }
  if (stepCsvEl) {
    stepCsvEl.title = 'Bấm để kiểm tra File CSV đã xuất';
    stepCsvEl.addEventListener('click', () => switchResultTab('tab_csv'));
  }

  // Nút mở thư mục ảnh sản phẩm hiện tại
  document.getElementById('btn_open_current_product_images').addEventListener('click', async () => {
    if (lastGeneratedResult && lastGeneratedResult.images_folder) {
      await window.electronAPI.openFolder(lastGeneratedResult.images_folder);
    }
  });

  // Nút hiển thị file CSV trong Windows Explorer
  document.getElementById('btn_show_csv_in_folder').addEventListener('click', async () => {
    if (lastGeneratedResult && lastGeneratedResult.output_dir) {
      await window.electronAPI.openFolder(lastGeneratedResult.output_dir);
    } else if (lastGeneratedResult && lastGeneratedResult.csv_file_path) {
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
  const campaignMode = 'separate';
  const campaignPrefix = document.getElementById('input_campaign_prefix').value.trim() || 'Chiến dịch SP - ';
  const dailyBudget = parseInt(document.getElementById('input_daily_budget').value, 10) || 100000;
  const maxCpc = parseInt(document.getElementById('input_max_cpc').value, 10) || 2000;
  const customImagesDir = document.getElementById('cfg_root_images_dir').value.trim();

  btn.disabled = true;
  btn.innerHTML = `<span>⏳ Đang xử lý ${selectedProductsList.length} chiến dịch riêng...</span>`;
  updateTerminal(`[1/${selectedProductsList.length + 1}] Bắt đầu quy trình tạo Google Ads (Mỗi sản phẩm 1 Chiến dịch riêng biệt)...`);

  // Khởi tạo và hiển thị Hộp thanh tiến trình trực quan
  const progressCard = document.getElementById('process_progress_card');
  const progressFill = document.getElementById('progress_fill');
  const progressPct = document.getElementById('progress_percentage');
  const progressMain = document.getElementById('progress_main_status');
  const progressDetail = document.getElementById('progress_detail_status');
  const stepAi = document.getElementById('step_ai');
  const stepImg = document.getElementById('step_img');
  const stepCsv = document.getElementById('step_csv');

  if (progressCard) {
    progressCard.style.display = 'flex';
    progressCard.classList.remove('completed');
    if (progressFill) progressFill.style.width = '3%';
    if (progressPct) progressPct.innerText = '0%';
    if (progressMain) progressMain.innerText = 'Đang khởi động tiến trình...';
    if (progressDetail) progressDetail.innerText = `Chuẩn bị xử lý ${selectedProductsList.length} sản phẩm...`;
    if (stepAi) stepAi.className = 'progress-step-item active';
    if (stepImg) stepImg.className = 'progress-step-item';
    if (stepCsv) stepCsv.className = 'progress-step-item';
  }

  // Lắng nghe tiến độ batch real-time
  if (window.electronAPI.removeProgressListener) window.electronAPI.removeProgressListener();
  if (window.electronAPI.onProgress) {
    window.electronAPI.onProgress((data) => {
      const pct = data.percent || 0;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressPct) progressPct.innerText = `${pct}%`;
      if (progressMain) progressMain.innerText = data.message || 'Đang xử lý...';
      if (progressDetail) progressDetail.innerText = data.detail || data.productTitle || '';

      if (data.step?.startsWith('ai_')) {
        if (stepAi) stepAi.className = 'progress-step-item active';
        if (stepImg) stepImg.className = 'progress-step-item';
        if (stepCsv) stepCsv.className = 'progress-step-item';
      } else if (data.step?.startsWith('img_')) {
        if (stepAi) stepAi.className = 'progress-step-item done';
        if (stepImg) stepImg.className = 'progress-step-item active';
        if (stepCsv) stepCsv.className = 'progress-step-item';
      } else if (data.step?.startsWith('csv_')) {
        if (stepAi) stepAi.className = 'progress-step-item done';
        if (stepImg) stepImg.className = 'progress-step-item done';
        if (stepCsv) stepCsv.className = 'progress-step-item active';
      } else if (data.step === 'completed' || pct >= 100) {
        if (stepAi) stepAi.className = 'progress-step-item done';
        if (stepImg) stepImg.className = 'progress-step-item done';
        if (stepCsv) stepCsv.className = 'progress-step-item done';
        if (progressCard) progressCard.classList.add('completed');
      }

      updateTerminal(`● ${data.message}`);
    });
  }

  try {
    const res = await window.electronAPI.generateBatchCampaign({
      products: selectedProductsList,
      campaignMode: 'separate',
      campaignPrefix,
      dailyBudget,
      maxCpc,
      customImagesDir
    });

    if (!res.success) {
      showToast(res.error || 'Có lỗi xảy ra', 'error');
      updateTerminal(`✗ Thất bại: ${res.error}`);
      if (progressCard) {
        if (progressMain) progressMain.innerText = `✗ Lỗi: ${res.error}`;
        if (progressDetail) progressDetail.innerText = 'Vui lòng kiểm tra lại Gemini API key hoặc thư mục lưu trữ.';
      }
      return;
    }

    if (progressCard) {
      progressCard.classList.add('completed');
      if (progressFill) progressFill.style.width = '100%';
      if (progressPct) progressPct.innerText = '100%';
      if (progressMain) progressMain.innerText = '✓ Hoàn thành 100%! Đã tạo chiến dịch & tải ảnh thành công.';
      if (stepAi) stepAi.className = 'progress-step-item done';
      if (stepImg) stepImg.className = 'progress-step-item done';
      if (stepCsv) stepCsv.className = 'progress-step-item done';
    }

    lastGeneratedResult = res;

    updateTerminal(`✓ Hoàn tất! Đã tạo ${res.successful_products} Chiến dịch riêng biệt (tự động tạo Ngân sách ngày & Nhóm riêng) trong file CSV Master.`);
    showToast(`Tạo thành công ${res.successful_products} Chiến dịch riêng biệt!`, 'success');

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
  const mockBusName = document.getElementById('mock_business_name');
  if (mockBusName) mockBusName.innerText = 'Khải Hoàn Derma';
  document.getElementById('mock_display_url').innerText = `https://${domain}/${ad.path1}/${ad.path2}`;
  document.getElementById('mock_headline').innerText = `${ad.headlines[0] || ''} | ${ad.headlines[1] || ''} | ${ad.headlines[2] || ''}`;
  document.getElementById('mock_description').innerText = ad.descriptions[0] || '';

  // Cập nhật các liên kết trang web (Sitelinks) trong Mockup
  const sitelinksContainer = document.getElementById('mock_sitelinks_grid');
  if (sitelinksContainer && data.sitelinks && data.sitelinks.length > 0) {
    sitelinksContainer.innerHTML = '';
    data.sitelinks.forEach(st => {
      const box = document.createElement('div');
      box.className = 'sitelink-box';
      box.innerHTML = `
        <div class="ad-sitelink-title">${st.linkText}</div>
        <div class="ad-sitelink-desc">${st.desc1}</div>
      `;
      sitelinksContainer.appendChild(box);
    });
  }

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
    item.title = `${img.fileName} (Bấm để xem vị trí file trong Explorer)`;

    let imgSrc = img.dataUrl;
    if (!imgSrc && img.localPath) {
      const norm = img.localPath.replace(/\\/g, '/');
      const fileUrl = norm.startsWith('/') ? `file://${norm}` : `file:///${norm}`;
      imgSrc = encodeURI(fileUrl).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }

    item.innerHTML = `
      <img src="${imgSrc || 'icon.png'}" alt="${img.fileName}" loading="lazy">
      <div class="gallery-item-name">${img.fileName}</div>
    `;

    item.addEventListener('click', () => {
      if (img.localPath && window.electronAPI && window.electronAPI.showItemInFolder) {
        window.electronAPI.showItemInFolder(img.localPath);
      }
    });

    gridImg.appendChild(item);
  });

  // 6. CSV Tab
  const labelCsvPath = document.getElementById('label_csv_file_path');
  const containerIndiv = document.getElementById('container_individual_csv_files');
  const listIndiv = document.getElementById('list_individual_csv_files');
  const countIndiv = document.getElementById('count_individual_csv_files');

  if (labelCsvPath) {
    if (data.individual_csv_files && data.individual_csv_files.length > 1) {
      labelCsvPath.innerHTML = `<span>★ Đã tạo <b>${data.individual_csv_files.length} file CSV riêng biệt</b> (và 1 file Master: <i>${data.master_csv_name || ''}</i>)</span>`;
    } else {
      labelCsvPath.innerText = data.csv_file_path || '--';
    }
  }

  if (containerIndiv && listIndiv) {
    if (data.individual_csv_files && data.individual_csv_files.length > 1) {
      containerIndiv.style.display = 'flex';
      if (countIndiv) countIndiv.innerText = `${data.individual_csv_files.length} file CSV riêng biệt`;
      listIndiv.innerHTML = '';
      data.individual_csv_files.forEach((file, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px;';
        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 68%;">
            <span style="font-weight: 700; color: #475569;">${idx + 1}.</span>
            <span style="font-weight: 600; color: #1e293b;" title="${file.product_name}">${file.product_name}</span>
            <span style="font-family: var(--font-mono); color: #059669; font-size: 11px;">(${file.file_name})</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-input-action btn-copy-indiv-path" title="Sao chép đường dẫn file này" style="font-size: 11px; padding: 3px 8px;">📋 Chép file</button>
            <button class="btn-input-action btn-show-indiv-file" title="Mở file trong Explorer" style="font-size: 11px; padding: 3px 8px;">↗ Mở</button>
          </div>
        `;
        row.querySelector('.btn-copy-indiv-path').addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(file.file_path);
          showToast(`Đã chép: ${file.file_name}`, 'success');
        });
        row.querySelector('.btn-show-indiv-file').addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.electronAPI.showItemInFolder(file.file_path);
        });
        listIndiv.appendChild(row);
      });
    } else {
      containerIndiv.style.display = 'none';
    }
  }

  // Chuyển về Tab Preview xem trước mẫu quảng cáo đầu tiên khi hoàn tất
  switchResultTab('tab_preview');

  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ========================================================
// NOTION ADS & CAMP HUB - FRONTEND HANDLERS
// ========================================================

let notionTasksList = [];
let selectedNotionTasksSet = new Set();
let currentNotionFilter = 'Chờ tạo';
let notionSearchKeyword = '';

async function openNotionModal() {
  const modal = document.getElementById('notion_modal_overlay');
  if (modal) modal.style.display = 'flex';
  await loadNotionTasks();
}

function closeNotionModal() {
  const modal = document.getElementById('notion_modal_overlay');
  if (modal) modal.style.display = 'none';
}

async function loadNotionTasks() {
  const tbody = document.getElementById('notion_tasks_tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <span style="font-size: 24px;">⏳</span>
          <span style="font-weight: 600;">Đang kết nối Notion và quét danh sách sản phẩm...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const res = await window.electronAPI.fetchNotionTasks('all');
    if (res.success && Array.isArray(res.tasks)) {
      notionTasksList = res.tasks;
      updateNotionFilterCounts();

      // Nếu đang ở tab Chờ tạo, tự động tích chọn các mục chờ tạo
      if (currentNotionFilter === 'Chờ tạo') {
        selectedNotionTasksSet.clear();
        notionTasksList.forEach(t => {
          if (t.status === 'Chờ tạo') selectedNotionTasksSet.add(t.page_id);
        });
      }

      renderNotionTasks();
      updateTerminal(`● Đã quét xong ${notionTasksList.length} nhiệm vụ từ Notion Camp Google ADS.`);
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 30px; color: #dc2626;">
            Lỗi nạp dữ liệu Notion: ${res.error || 'Không kết nối được API'}
          </td>
        </tr>
      `;
    }
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 30px; color: #dc2626;">
          Lỗi: ${err.message}
        </td>
      </tr>
    `;
  }
}

function updateNotionFilterCounts() {
  const total = notionTasksList.length;
  const pending = notionTasksList.filter(t => t.status === 'Chờ tạo').length;
  const running = notionTasksList.filter(t => t.status === 'Đang chạy Google Ads').length;
  const unprocessed = notionTasksList.filter(t => t.status === 'Chưa xử lý').length;
  const rejected = notionTasksList.filter(t => t.status === 'Từ chối').length;

  const elAll = document.getElementById('count_all');
  const elPending = document.getElementById('count_pending');
  const elRunning = document.getElementById('count_running');
  const elUnprocessed = document.getElementById('count_unprocessed');
  const elRejected = document.getElementById('count_rejected');
  const hubPendingBadge = document.getElementById('hub_pending_badge');

  if (elAll) elAll.innerText = total;
  if (elPending) elPending.innerText = pending;
  if (elRunning) elRunning.innerText = running;
  if (elUnprocessed) elUnprocessed.innerText = unprocessed;
  if (elRejected) elRejected.innerText = rejected;

  if (hubPendingBadge) {
    hubPendingBadge.innerText = `${pending} Chờ tạo`;
    if (pending > 0) {
      hubPendingBadge.style.background = '#fef3c7';
      hubPendingBadge.style.color = '#92400e';
      hubPendingBadge.style.borderColor = '#fde68a';
    } else {
      hubPendingBadge.style.background = '#f1f5f9';
      hubPendingBadge.style.color = '#64748b';
      hubPendingBadge.style.borderColor = '#e2e8f0';
    }
  }
}

function renderNotionTasks() {
  const tbody = document.getElementById('notion_tasks_tbody');
  if (!tbody) return;

  let filtered = notionTasksList;

  // Lọc theo tab trạng thái
  if (currentNotionFilter !== 'all') {
    filtered = filtered.filter(t => t.status === currentNotionFilter);
  }

  // Lọc theo từ khóa tìm kiếm
  if (notionSearchKeyword.trim()) {
    const kw = notionSearchKeyword.trim().toLowerCase();
    filtered = filtered.filter(t => 
      (t.title && t.title.toLowerCase().includes(kw)) ||
      (t.category && t.category.toLowerCase().includes(kw)) ||
      (t.csv_file && t.csv_file.toLowerCase().includes(kw))
    );
  }

  if (filtered.length === 0) {
    if (currentNotionFilter === 'Chờ tạo') {
      const unprocessedCount = notionTasksList.filter(t => t.status === 'Chưa xử lý').length;
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 48px 20px;">
            <div style="font-size: 32px; margin-bottom: 8px;">⏳</div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
              Chưa có sản phẩm nào ở trạng thái "Chờ tạo" trên Notion
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); max-width: 520px; margin: 0 auto 16px auto; line-height: 1.5;">
              Toàn bộ ${notionTasksList.length} sản phẩm đang ở trạng thái <b>"Chưa xử lý"</b>.<br>
              Khi cần lên camp sản phẩm nào, Admin chỉ cần mở Notion chuyển sản phẩm đó sang <b>"Chờ tạo"</b> rồi bấm quét lại, hoặc chuyển sang tab <b>"Chưa xử lý"</b> bên trên để chọn trực tiếp ngay tại đây.
            </div>
            <button type="button" class="btn-hub-scan" id="btn_switch_unprocessed_tab" style="margin: 0 auto; font-size: 12px; padding: 8px 18px;">
              👉 Xem danh sách "Chưa xử lý" (${unprocessedCount})
            </button>
          </td>
        </tr>
      `;
      const btnSwitch = document.getElementById('btn_switch_unprocessed_tab');
      if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
          document.querySelectorAll('.notion-tab-btn').forEach(b => b.classList.remove('active'));
          const unTab = document.getElementById('tab_notion_unprocessed');
          if (unTab) unTab.classList.add('active');
          currentNotionFilter = 'Chưa xử lý';
          renderNotionTasks();
        });
      }
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
            Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc hiện tại.
          </td>
        </tr>
      `;
    }
    updateNotionSelectedCount();
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(task => {
    const tr = document.createElement('tr');
    const isChecked = selectedNotionTasksSet.has(task.page_id);
    if (isChecked) tr.classList.add('selected');

    let badgeClass = 'gray';
    if (task.status === 'Chờ tạo') badgeClass = 'yellow';
    else if (task.status === 'Đang chạy Google Ads') badgeClass = 'purple';
    else if (task.status === 'Từ chối') badgeClass = 'red';

    let dateDisplay = '--';
    if (task.updated_at) {
      try {
        const d = new Date(task.updated_at);
        dateDisplay = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch (e) {}
    }

    const budgetFormatted = task.daily_budget ? `${Number(task.daily_budget).toLocaleString('vi-VN')} đ` : '100.000 đ';

    tr.innerHTML = `
      <td style="text-align: center; width: 44px;">
        <input type="checkbox" class="cb-notion-row" data-id="${task.page_id}" ${isChecked ? 'checked' : ''}>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-primary); max-width: 440px; line-height: 1.4; word-break: break-word; user-select: text;" title="${task.title}">
          ${task.title}
        </div>
      </td>
      <td style="white-space: nowrap;">
        <span style="font-size: 11px; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; color: var(--text-secondary); white-space: nowrap;">${task.category || 'Chung'}</span>
      </td>
      <td style="font-weight: 600; color: var(--amber-text); white-space: nowrap;">${task.price || '--'}</td>
      <td style="font-weight: 600; color: #166534; white-space: nowrap;">${budgetFormatted}</td>
      <td style="white-space: nowrap;">
        <span class="notion-badge ${badgeClass}">● ${task.status}</span>
      </td>
      <td style="white-space: nowrap;">
        ${task.csv_file ? `
          <span style="font-family: var(--font-mono); font-size: 11px; color: #15803d; background: #dcfce7; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 4px; display: inline-block; max-width: 380px; user-select: text;" title="${task.csv_file}">
            ${task.csv_file}
          </span>
        ` : `<span style="font-size: 11px; color: var(--text-muted);">Chưa có</span>`}
      </td>
      <td style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">${dateDisplay}</td>
      <td style="white-space: nowrap; text-align: center;">
        <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: center;">
          ${task.url ? `<button class="btn-input-action btn-open-url" data-url="${task.url}" title="Xem sản phẩm trên web derma" style="font-size: 11px; padding: 4px 8px;">Web ↗</button>` : ''}
          <button class="btn-input-action btn-single-run" data-id="${task.page_id}" title="Tạo chiến dịch cho sản phẩm này" style="font-size: 11px; padding: 4px 10px; background: #e0f2fe; color: #0284c7; border-color: #bae6fd; font-weight: 600;">Tạo Camp</button>
        </div>
      </td>
    `;

    // Row selection toggle
    const cb = tr.querySelector('.cb-notion-row');
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      if (cb.checked) {
        selectedNotionTasksSet.add(task.page_id);
        tr.classList.add('selected');
      } else {
        selectedNotionTasksSet.delete(task.page_id);
        tr.classList.remove('selected');
      }
      updateNotionSelectedCount();
    });

    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    const btnWeb = tr.querySelector('.btn-open-url');
    if (btnWeb) {
      btnWeb.addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.openExternalUrl(task.url);
      });
    }

    const btnRun = tr.querySelector('.btn-single-run');
    if (btnRun) {
      btnRun.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedNotionTasksSet.clear();
        selectedNotionTasksSet.add(task.page_id);
        updateNotionSelectedCount();
        executeNotionCampaignsFlow();
      });
    }

    tbody.appendChild(tr);
  });

  updateNotionSelectedCount();
}

function updateNotionSelectedCount() {
  const count = selectedNotionTasksSet.size;
  const countEl = document.getElementById('notion_selected_count');
  if (countEl) countEl.innerText = `Đã chọn: ${count}`;

  const cbAll = document.getElementById('cb_notion_select_all');
  if (cbAll) {
    const rowCheckboxes = document.querySelectorAll('.cb-notion-row');
    if (rowCheckboxes.length > 0 && count >= rowCheckboxes.length) {
      cbAll.checked = true;
    } else {
      cbAll.checked = false;
    }
  }

  const footerStatus = document.getElementById('notion_footer_status');
  if (footerStatus) {
    if (count === 0) {
      footerStatus.innerText = 'Chưa chọn mục nào. Tích chọn sản phẩm để bắt đầu.';
    } else {
      footerStatus.innerText = `Đã chọn ${count} chiến dịch. Bấm nút bên phải để tạo tự động và cập nhật Notion.`;
    }
  }
}

async function executeNotionCampaignsFlow() {
  if (selectedNotionTasksSet.size === 0) {
    showToast('Vui lòng chọn ít nhất 1 sản phẩm/nhiệm vụ từ Notion!', 'error');
    return;
  }

  const selectedTasks = notionTasksList.filter(t => selectedNotionTasksSet.has(t.page_id));
  closeNotionModal();

  // Hiển thị thanh tiến trình ở workspace chính
  const progressCard = document.getElementById('process_progress_card');
  const progressFill = document.getElementById('progress_fill');
  const progressPercent = document.getElementById('progress_percentage');
  const progressMainStatus = document.getElementById('progress_main_status');
  const progressDetailStatus = document.getElementById('progress_detail_status');
  const resultsSection = document.getElementById('results_section');

  if (progressCard) progressCard.style.display = 'block';
  if (resultsSection) resultsSection.style.display = 'none';

  progressFill.style.width = '5%';
  progressPercent.innerText = '5%';
  progressMainStatus.innerText = `Đang bắt đầu tạo chiến dịch cho ${selectedTasks.length} sản phẩm từ Notion...`;
  progressDetailStatus.innerText = 'Mỗi sản phẩm sẽ là 1 chiến dịch riêng (100k/ngày, Maximize conversions, Vietnam).';

  updateTerminal(`🚀 Bắt đầu tạo ${selectedTasks.length} chiến dịch từ Notion Camp Google ADS...`);

  // Lắng nghe tiến độ batch real-time từ Notion backend
  if (window.electronAPI.removeProgressListener) window.electronAPI.removeProgressListener();
  if (window.electronAPI.onProgress) {
    window.electronAPI.onProgress((data) => {
      const pct = data.percent || 0;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressPercent) progressPercent.innerText = `${pct}%`;
      if (progressMainStatus) progressMainStatus.innerText = data.message || 'Đang xử lý...';
      if (progressDetailStatus) progressDetailStatus.innerText = data.detail || data.productTitle || '';

      const stepAi = document.getElementById('step_ai');
      const stepImg = document.getElementById('step_img');
      const stepCsv = document.getElementById('step_csv');
      if (data.step?.startsWith('ai_')) {
        if (stepAi) stepAi.className = 'progress-step-item active';
        if (stepImg) stepImg.className = 'progress-step-item';
        if (stepCsv) stepCsv.className = 'progress-step-item';
      } else if (data.step?.startsWith('img_')) {
        if (stepAi) stepAi.className = 'progress-step-item done';
        if (stepImg) stepImg.className = 'progress-step-item active';
        if (stepCsv) stepCsv.className = 'progress-step-item';
      } else if (data.step?.startsWith('csv_')) {
        if (stepAi) stepAi.className = 'progress-step-item done';
        if (stepImg) stepImg.className = 'progress-step-item done';
        if (stepCsv) stepCsv.className = 'progress-step-item active';
      } else if (data.step === 'completed' || pct >= 100) {
        if (stepAi) stepAi.className = 'progress-step-item done';
        if (stepImg) stepImg.className = 'progress-step-item done';
        if (stepCsv) stepCsv.className = 'progress-step-item done';
      }

      updateTerminal(`● ${data.message}`);
    });
  }

  try {
    const res = await window.electronAPI.runNotionCampaigns({
      tasks: selectedTasks,
      campaignPrefix: document.getElementById('input_campaign_prefix').value.trim() || 'Chiến dịch SP - ',
      dailyBudget: 100000,
      customImagesDir: document.getElementById('cfg_root_images_dir').value.trim()
    });

    if (res.success) {
      progressFill.style.width = '100%';
      progressPercent.innerText = '100%';
      progressMainStatus.innerText = '✓ Đã tạo xong toàn bộ chiến dịch và cập nhật Notion!';
      progressDetailStatus.innerText = `Đã xuất ${res.successful_products} file CSV riêng biệt cho từng sản phẩm!`;

      showToast(`Xuất thành công ${res.successful_products} file CSV riêng biệt & cập nhật Notion!`, 'success');
      updateTerminal(`✓ Hoàn tất! Đã xuất ${res.successful_products} file CSV riêng (mỗi SP 1 chiến dịch). Notion đã cập nhật "Đang chạy Google Ads" kèm tên file tương ứng.`);

      lastGeneratedResult = res;
      renderResults(res);

      // Tải lại dữ liệu Notion ngầm để cập nhật trạng thái mới
      setTimeout(() => {
        window.electronAPI.fetchNotionTasks('all').then(r => {
          if (r.success) {
            notionTasksList = r.tasks;
            updateNotionFilterCounts();
          }
        });
      }, 1000);
    } else {
      showToast(res.error || 'Lỗi khi tạo chiến dịch từ Notion', 'error');
      updateTerminal(`✗ Lỗi: ${res.error}`);
    }
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
    updateTerminal(`✗ Lỗi ngoại lệ: ${err.message}`);
  } finally {
    if (window.electronAPI.removeProgressListener) window.electronAPI.removeProgressListener();
  }
}

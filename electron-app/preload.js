const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Cấu hình
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
    testGemini: (data) => ipcRenderer.invoke('test-gemini', data),
    testWc: (data) => ipcRenderer.invoke('test-wc', data),
    testNotion: (data) => ipcRenderer.invoke('test-notion', data),
    
    // Hệ thống Windows OS
    selectFolder: (defaultPath) => ipcRenderer.invoke('select-folder', defaultPath),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
    openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
    
    // Nghiệp vụ WooCommerce & Google Ads
    syncProducts: (force) => ipcRenderer.invoke('sync-products', force),
    searchProducts: (keyword) => ipcRenderer.invoke('search-products', keyword),
    getProductDetails: (idOrUrl) => ipcRenderer.invoke('get-product-details', idOrUrl),
    generateCampaign: (params) => ipcRenderer.invoke('generate-campaign', params),
    generateBatchCampaign: (params) => ipcRenderer.invoke('generate-batch-campaign', params),
    onProgress: (callback) => ipcRenderer.on('batch-progress', (event, val) => callback(val)),
    removeProgressListener: () => ipcRenderer.removeAllListeners('batch-progress'),

    // Tích hợp Notion Camp Hub
    fetchNotionTasks: (filter) => ipcRenderer.invoke('fetch-notion-tasks', filter),
    updateNotionTask: (data) => ipcRenderer.invoke('update-notion-task', data),
    runNotionCampaigns: (params) => ipcRenderer.invoke('run-notion-campaigns', params),
    syncNotionProducts: () => ipcRenderer.invoke('sync-notion-products')
});

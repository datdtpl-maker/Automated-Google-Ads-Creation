const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProcess = null;
const PORT = 8000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

function isServerRunning(url) {
    return new Promise((resolve) => {
        const req = http.get(`${url}/api/config`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(url, timeoutMs = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (await isServerRunning(url)) {
            return true;
        }
        await new Promise((r) => setTimeout(r, 400));
    }
    return false;
}

function startPythonBackend() {
    // Tìm đường dẫn Python và script
    const projectDir = path.resolve(__dirname, '..');
    const webAppPy = path.join(projectDir, 'web_app.py');
    const exePath = path.join(projectDir, 'dist', 'AutoGoogleAds', 'AutoGoogleAds.exe');

    try {
        if (require('fs').existsSync(webAppPy)) {
            pythonProcess = spawn('python', [webAppPy], {
                cwd: projectDir,
                detached: false,
                windowsHide: true,
                stdio: 'ignore'
            });
        } else if (require('fs').existsSync(exePath)) {
            pythonProcess = spawn(exePath, [], {
                cwd: path.dirname(exePath),
                detached: false,
                windowsHide: true,
                stdio: 'ignore'
            });
        }
    } catch (err) {
        console.error('Lỗi khi khởi chạy Python backend:', err);
    }
}

function createWindow() {
    const iconPath = path.join(__dirname, 'icon.png');
    
    mainWindow = new BrowserWindow({
        width: 1360,
        height: 920,
        minWidth: 1020,
        minHeight: 680,
        title: 'Google Ads Campaign Auto-Generator',
        icon: iconPath,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadURL(SERVER_URL);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    const running = await isServerRunning(SERVER_URL);
    if (!running) {
        startPythonBackend();
        const ready = await waitForServer(SERVER_URL, 15000);
        if (!ready) {
            dialog.showErrorBox(
                'Lỗi kết nối máy chủ',
                'Không thể kết nối đến máy chủ Python tại http://127.0.0.1:8000. Vui lòng kiểm tra môi trường Python.'
            );
        }
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (pythonProcess) {
        try {
            pythonProcess.kill();
        } catch (e) {}
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (pythonProcess) {
        try {
            pythonProcess.kill();
        } catch (e) {}
    }
});

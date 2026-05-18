const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = !app.isPackaged;

// Keeps our app data isolated and human readable folder separated from generic Chromium caches
app.setPath('userData', path.join(app.getPath('home'), '.tabby', '.system-data'));

// Single-instance locking
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;

  function createWindow() {
    // Determine appropriate icon path depending on environment and platform
    let iconExt = 'png';
    if (process.platform === 'win32') iconExt = 'ico';
    else if (process.platform === 'darwin') iconExt = 'icns';

    let iconPath;
    if (isDev) {
      iconPath = path.join(process.cwd(), 'icon', `icon.${iconExt}`);
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(process.cwd(), 'icon', 'icon.png');
      }
    } else {
      iconPath = path.join(__dirname, `../dist/icon.${iconExt}`);
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(__dirname, '../dist/icon.png');
      }
    }
    
    // Fallback if the icon wasn't explicitly put there
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, `../public/icon.${iconExt}`);
      if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, '../public/icon.png');
      if (!isDev) {
        iconPath = path.join(__dirname, `../dist/icon.${iconExt}`);
        if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, '../dist/icon.png');
      }
      // if not found, let it be undefined
      if (!fs.existsSync(iconPath)) iconPath = undefined;
    }

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: iconPath,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    if (isDev) {
      mainWindow.loadURL('http://localhost:3000');
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    handleFileArgs(process.argv);
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      handleFileArgs(commandLine);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  function handleFileArgs(argv) {
    if (argv.length >= 2) {
      // Find a valid file argument (not an electron flag or the app itself)
      const filePath = argv.find(arg => 
        (arg.endsWith('.md') || arg.endsWith('.txt')) && 
        fs.existsSync(arg)
      );

      if (filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const filename = path.basename(filePath);
        if (mainWindow) {
          // Add a small delay to ensure React is loaded if this is startup
          setTimeout(() => {
            mainWindow.webContents.send('open-file', { filename, content, filePath });
          }, 500);
        }
      }
    }
  }

  // --- IPC Events ---

  // Workspace Storage implementation for ~/.tabby
  function getTabbyDir() {
    const tabbyDir = path.join(app.getPath('home'), '.tabby');
    if (!fs.existsSync(tabbyDir)) {
      fs.mkdirSync(tabbyDir, { recursive: true });
    }
    return tabbyDir;
  }

  ipcMain.handle('read-workspace-data', async (event, filename) => {
    try {
      const filePath = path.join(getTabbyDir(), filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return null;
    } catch (e) {
      console.error('Failed to read workspace data', e);
      return null;
    }
  });

  ipcMain.handle('write-workspace-data', async (event, { filename, data }) => {
    try {
      const filePath = path.join(getTabbyDir(), filename);
      fs.writeFileSync(filePath, data, 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write workspace data', e);
      return false;
    }
  });

  ipcMain.handle('delete-workspace-data', async (event, filename) => {
    try {
      const filePath = path.join(getTabbyDir(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (e) {
      console.error('Failed to delete workspace data', e);
      return false;
    }
  });

  // Export File mapping
  ipcMain.handle('save-file', async (event, { content, defaultPath }) => {
    if (!mainWindow) return false;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!canceled && filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    return false;
  });

  // Get user data path for temp/storage
  ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData');
  });

  let authServer = null;

  ipcMain.handle('start-login', async () => {
    if (authServer) {
      authServer.close();
    }
    
    return new Promise((resolve) => {
      authServer = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://127.0.0.1`);
        
        if (parsedUrl.pathname === '/login') {
          // Serve a simple HTML page that uses Firebase SDK to authenticate
          const configPath = path.join(__dirname, '../firebase-applet-config.json');
          let firebaseConfig = {};
          if (fs.existsSync(configPath)) {
            firebaseConfig = require(configPath);
          }
          
          const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Login to Tabby</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0B0E14; color: white; margin: 0; }
    .card { background: #0D1017; border: 1px solid #1f2937; padding: 3rem; border-radius: 1rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; }
    h1 { color: #DFFF00; font-style: italic; font-weight: 900; margin-bottom: 0.5rem; }
    button { background: white; color: black; padding: 12px 24px; border: none; border-radius: 0.25rem; font-weight: bold; font-size: 14px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; transition: background 0.2s; margin-top: 1.5rem; }
    button:hover { background: #e5e7eb; }
  </style>
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
    import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
    
    const firebaseConfig = ${JSON.stringify(firebaseConfig)};
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    auth.useDeviceLanguage();
    
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById('login-btn').addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        
        signInWithPopup(auth, provider).then((result) => {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          window.location.href = '/callback?idToken=' + encodeURIComponent(credential.idToken || '') + '&accessToken=' + encodeURIComponent(credential.accessToken || '');
        }).catch((error) => {
          console.error(error);
          document.getElementById('error').innerText = error.message;
        });
      });
    });
  </script>
</head>
<body>
  <div class="card">
     <h1>TABBY</h1>
     <p>Please sign in to sync with Google Drive.</p>
     <button id="login-btn">Sign in with Google</button>
     <div id="error" style="color: #ef4444; margin-top: 16px; font-size: 14px;"></div>
  </div>
</body>
</html>
          `;
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        } else if (parsedUrl.pathname === '/callback') {
          const idToken = parsedUrl.searchParams.get('idToken');
          const accessToken = parsedUrl.searchParams.get('accessToken');
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><head><title>Login Successful</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0B0E14;color:white;}</style></head><body><h1>Login Successful! You can safely close this browser window and return to Tabby.</h1><script>setTimeout(() => window.close(), 2000);</script></body></html>');
          
          if (mainWindow) {
             mainWindow.webContents.send('login-success', { idToken, accessToken });
          }
          
          authServer.close();
          authServer = null;
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
  
      // Listen on any available port on localhost
      authServer.listen(0, '127.0.0.1', () => {
        const port = authServer.address().port;
        const loginUrl = `http://127.0.0.1:${port}/login`;
        shell.openExternal(loginUrl);
        resolve(true);
      });
    });
  });
}

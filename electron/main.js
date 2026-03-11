import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let isClickThrough = true;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        resizable: false,
        focusable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Click-through by default so the overlay doesn't interfere with gameplay
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // In development, load from Vite dev server; in production, load the built file
    const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    // Prevent the window from being hidden behind the game
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function toggleClickThrough() {
    isClickThrough = !isClickThrough;

    if (isClickThrough) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        mainWindow.setFocusable(false);
        console.log('[Overlay] Click-through ENABLED — overlay is non-interactive');
    } else {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.setFocusable(true);
        mainWindow.focus();
        console.log('[Overlay] Click-through DISABLED — overlay is interactive');
    }
}

app.whenReady().then(() => {
    createWindow();

    // Alt+Shift+B toggles click-through mode
    globalShortcut.register('Alt+Shift+B', () => {
        if (mainWindow) {
            toggleClickThrough();
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    app.quit();
});

const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        fullscreenable: true,
        title: 'Abyssal Descent',
        backgroundColor: '#0a0a0f',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

    // Toggle fullscreen with F11
    globalShortcut.register('F11', () => {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

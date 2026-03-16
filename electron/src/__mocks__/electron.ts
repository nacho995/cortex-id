/**
 * @file __mocks__/electron.ts
 * @description Jest mock for the Electron module.
 * Provides minimal stubs for the Electron APIs used in the main process.
 */

const mockWebContents = {
  send: jest.fn(),
  openDevTools: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
};

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  show: jest.fn(),
  close: jest.fn(),
  minimize: jest.fn(),
  maximize: jest.fn(),
  unmaximize: jest.fn(),
  isMaximized: jest.fn().mockReturnValue(false),
  isFullScreen: jest.fn().mockReturnValue(false),
  isDestroyed: jest.fn().mockReturnValue(false),
  getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 800 }),
  on: jest.fn(),
  once: jest.fn(),
  webContents: mockWebContents,
}));

(mockBrowserWindow as unknown as { getAllWindows: jest.Mock }).getAllWindows = jest.fn().mockReturnValue([]);

const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn(),
};

const mockApp = {
  getVersion: jest.fn().mockReturnValue('0.1.0'),
  getPath: jest.fn().mockReturnValue('/mock/path'),
  isPackaged: false,
  quit: jest.fn(),
  whenReady: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  name: 'Cortex-ID',
};

const mockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: undefined }),
};

const mockMenu = {
  buildFromTemplate: jest.fn().mockReturnValue({}),
  setApplicationMenu: jest.fn(),
};

const mockScreen = {
  getAllDisplays: jest.fn().mockReturnValue([
    { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  ]),
  getPrimaryDisplay: jest.fn().mockReturnValue({
    workAreaSize: { width: 1920, height: 1080 },
  }),
};

const mockContextBridge = {
  exposeInMainWorld: jest.fn(),
};

const mockIpcRenderer = {
  invoke: jest.fn().mockResolvedValue(undefined),
  send: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
};

module.exports = {
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  dialog: mockDialog,
  Menu: mockMenu,
  MenuItem: jest.fn(),
  screen: mockScreen,
  contextBridge: mockContextBridge,
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
  },
};

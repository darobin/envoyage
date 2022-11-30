
import { app, protocol, BrowserWindow, screen }  from 'electron';
import { ipfsProtocolHandler } from './ipfs-handler.js';
import { initDataSource } from './data-source.js';
import makeRel from './rel.js';

let mainWindow;
const rel = makeRel(import.meta.url);

console.warn(`STARTING`);

// there can be only one
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// I am not clear at all as to what the privileges mean. They are listed at
// https://www.electronjs.org/docs/latest/api/structures/custom-scheme but that is harldy
// informative. https://www.electronjs.org/docs/latest/api/protocol#protocolregisterschemesasprivilegedcustomschemes
// is pretty clear that the behaviour we want requires at least `standard`.
const privileges = {
  standard: true,
  secure: false,
  bypassCSP: false,
  allowServiceWorkers: false,
  supportFetchAPI: true,
  corsEnabled: false,
  stream: true,
};
protocol.registerSchemesAsPrivileged([
  { scheme: 'ipfs', privileges },
  { scheme: 'ipns', privileges },
]);
app.enableSandbox();
app.whenReady().then(async () => {
  console.warn(`READY`);
  protocol.registerStreamProtocol('ipfs', ipfsProtocolHandler);
  protocol.registerStreamProtocol('ipns', ipfsProtocolHandler);
  console.warn(`PROTOCOLS REGISTERED`);
  await initDataSource();
  console.warn(`DATA READY`);
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width,
    height,
    show: false,
    backgroundColor: '#fff',
    title: 'Nytive',
    titleBarStyle: 'hidden',
    icon: './img/icon.png',
    webPreferences: {
      webviewTag: true, // I know that this isn't great, but the alternatives aren't there yet
      preload: rel('../build/preload.js'),
    },
  });
  console.warn(`LOADING…`);
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    console.warn(`SHOWING`);
    mainWindow.show();
  });
  const { webContents } = mainWindow;
  // reloading
  webContents.on('before-input-event', makeKeyDownMatcher('cmd+R', reload));
  webContents.on('before-input-event', makeKeyDownMatcher('ctrl+R', reload));
  webContents.on('before-input-event', makeKeyDownMatcher('cmd+alt+I', openDevTools));
});

function reload () {
  console.log('RELOAD');
  mainWindow.reload();
}

function openDevTools () {
  mainWindow.webContents.openDevTools();
}

// function makeKeyUpMatcher (sc, cb) {
//   return makeKeyMatcher('keyUp', sc, cb);
// }

function makeKeyDownMatcher (sc, cb) {
  return makeKeyMatcher('keyDown', sc, cb);
}

function makeKeyMatcher (type, sc, cb) {
  let parts = sc.split(/[+-]/)
    , key = parts.pop().toLowerCase()
    , modifiers = {
        shift: false,
        control: false,
        meta: false,
        alt: false,
      }
  ;
  parts.forEach(p => {
    p = p.toLowerCase();
    if (p === 'ctrl') p = 'control';
    if (p === 'cmd') p = 'meta';
    if (typeof modifiers[p] !== 'boolean') console.warn(`Unknown command modifier ${p}.`);
    modifiers[p] = true;
  });
  return (evt, input) => {
    if (type !== input.type) return;
    if (key !== input.key) return;
    let badMod = false;
    Object.keys(modifiers).forEach(mod => {
      if (input[mod] !== modifiers[mod]) badMod = true;
    });
    if (badMod) return;
    cb();
  };
}

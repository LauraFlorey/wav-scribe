const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { inspectWav, transcribe, saveTranscript, LANGUAGES } = require('./core.cjs');

let window, running = false, controller, quitting = false;
let jobs = [], lastExport;
const page = pathToFileURL(path.join(__dirname, '..', 'ui', 'index.html')).href;
const resourceRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'resources');
const binary = app.isPackaged ? path.join(resourceRoot, 'native', 'whisper-cli.exe') :
  (process.env.WAV_SCRIBE_ENGINE || path.join(resourceRoot, 'native', 'win32-x64', 'whisper-cli.exe'));
const model = path.join(resourceRoot, 'models', 'ggml-base.en.bin');
const workRoot = path.join(app.getPath('userData'), 'work');
let engineReady = false;

function state() {
  return { running, engineReady, version: app.getVersion(), languages: LANGUAGES,
    jobs: jobs.map(({ id, name, duration, bytes, status, progress, error, saved }) => ({ id, name, duration, bytes, status, progress, error, saved })) };
}
function send() { if (window && !window.isDestroyed()) window.webContents.send('state', state()); }
function handler(name, callback) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== page) throw new Error('Untrusted request.');
    try { return { ok: true, value: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
function findJob(id) {
  const job = jobs.find(item => item.id === id);
  if (!job) throw new Error('Choose a recording first.');
  return job;
}

handler('get-state', () => state());
handler('choose-files', async () => {
  if (running) throw new Error('Wait for transcription to finish before adding files.');
  const selection = await dialog.showOpenDialog(window, { title: 'Choose WAV recordings', properties: ['openFile', 'multiSelections'], filters: [{ name: 'WAV recordings', extensions: ['wav'] }] });
  const errors = [];
  for (const filename of selection.filePaths) {
    if (jobs.some(job => job.filename === filename)) continue;
    if (jobs.length >= 50) { errors.push('The queue holds up to 50 recordings. Clear it before adding more.'); break; }
    try { jobs.push({ id: randomUUID(), filename, ...await inspectWav(filename), status: 'ready', progress: 0, saved: false }); }
    catch (error) { errors.push(`${path.basename(filename)}: ${error.message}`); }
  }
  send();
  return errors;
});
handler('clear', async () => {
  if (running) throw new Error('Stop transcription before clearing recordings.');
  if (jobs.some(job => job.result && !job.saved)) {
    const answer = await dialog.showMessageBox(window, { type: 'question', message: 'Clear unsaved transcripts?', detail: 'Save any transcripts you want to keep first. Your original WAV files will stay in place.', buttons: ['Keep recordings', 'Clear'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return;
  }
  jobs = []; send();
});
handler('start', language => {
  if (running) throw new Error('Transcription is already running.');
  if (!engineReady) throw new Error('The speech engine or model is missing. Reinstall WAV Scribe.');
  if (!Object.hasOwn(LANGUAGES, language)) throw new Error('Choose a language.');
  const queue = jobs.filter(job => ['ready', 'failed', 'cancelled'].includes(job.status));
  if (!queue.length) throw new Error('Add a WAV recording to begin.');
  controller = new AbortController();
  running = true;
  for (const job of queue) { job.status = 'queued'; job.error = ''; job.progress = 0; }
  send();
  void (async () => {
    try {
      for (const job of queue) {
        if (controller.signal.aborted) { job.status = 'cancelled'; continue; }
        job.status = 'transcribing'; send();
        try {
          job.result = await transcribe({ binary, model, input: job.filename, workRoot, language,
            signal: controller.signal, onProgress: progress => { if (job.progress !== progress) { job.progress = progress; send(); } } });
          job.status = 'done'; job.progress = 100; job.saved = false;
        } catch (error) {
          job.status = controller.signal.aborted ? 'cancelled' : 'failed';
          job.error = controller.signal.aborted ? '' : error.message;
        }
        send();
      }
    } finally {
      running = false; send();
      if (quitting) app.quit();
    }
  })();
});
handler('cancel', () => { controller?.abort(); });
handler('get-transcript', id => { const job = findJob(id); return job.result?.txt ?? ''; });
handler('edit-transcript', (id, text) => {
  const job = findJob(id);
  if (!job.result || typeof text !== 'string' || text.length > 10000000) throw new Error('This transcript cannot be edited.');
  if (job.result.txt !== text) { job.result.txt = text; job.saved = false; }
});
handler('copy', id => {
  const job = findJob(id);
  if (!job.result) throw new Error('No transcript is ready.');
  clipboard.writeText(job.result.txt);
});
handler('export', async (id, format) => {
  const job = findJob(id);
  if (!job.result || !['txt', 'srt', 'vtt'].includes(format)) throw new Error('Choose a finished transcript and file type.');
  const selection = await dialog.showSaveDialog(window, {
    title: 'Save transcript', defaultPath: path.join(app.getPath('documents'), `${path.parse(job.name).name}.${format}`),
    filters: [{ name: format === 'txt' ? 'Text document' : 'Subtitles', extensions: [format] }]
  });
  if (selection.canceled || !selection.filePath) return null;
  if (path.extname(selection.filePath).toLowerCase() !== `.${format}`) throw new Error(`Use a .${format} filename.`);
  // The native save dialog handles overwrite confirmation. Never write audio paths.
  const target = path.resolve(selection.filePath);
  if (jobs.some(item => path.resolve(item.filename).toLowerCase() === target.toLowerCase())) throw new Error('Choose a different filename to preserve your recording.');
  await saveTranscript(target, job.result[format]);
  lastExport = target;
  if (format === 'txt') job.saved = true;
  send();
  return path.basename(target);
});
handler('show-export', () => { if (lastExport) shell.showItemInFolder(lastExport); });

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
    engineReady = await Promise.all([binary, model].map(file => fs.access(file))).then(() => true, () => false);
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('devtools:') });
    });
    window = new BrowserWindow({ width: 1120, height: 800, minWidth: 760, minHeight: 620,
      title: 'WAV Scribe', backgroundColor: '#f5f7fa', icon: path.join(__dirname, '..', 'ui', 'icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.on('close', async event => {
      if (quitting) { if (running) event.preventDefault(); return; }
      if (running || jobs.some(job => job.result && !job.saved)) {
        event.preventDefault();
        const answer = await dialog.showMessageBox(window, { type: 'question', message: running ? 'Stop transcription and close?' : 'Close with unsaved transcripts?',
          detail: 'Save transcripts you want to keep before closing. Your original WAV files will stay in place.', buttons: ['Keep open', 'Close app'], defaultId: 0, cancelId: 0 });
        if (answer.response === 1) { quitting = true; if (running) controller.abort(); else app.quit(); }
      }
    });
    await window.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  });
  app.on('window-all-closed', () => app.quit());
}

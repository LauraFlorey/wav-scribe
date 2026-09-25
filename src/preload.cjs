const { contextBridge, ipcRenderer } = require('electron');
const call = async (name, ...args) => {
  const response = await ipcRenderer.invoke(name, ...args);
  if (!response.ok) throw new Error(response.error);
  return response.value;
};
contextBridge.exposeInMainWorld('scribe', {
  state: () => call('get-state'),
  chooseFiles: () => call('choose-files'),
  clear: () => call('clear'),
  start: language => call('start', language),
  cancel: () => call('cancel'),
  transcript: id => call('get-transcript', id),
  edit: (id, text) => call('edit-transcript', id, text),
  copy: id => call('copy', id),
  export: (id, format) => call('export', id, format),
  showExport: () => call('show-export'),
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('state', listener); return () => ipcRenderer.removeListener('state', listener); }
});

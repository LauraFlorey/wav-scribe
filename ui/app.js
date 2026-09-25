const $ = id => document.getElementById(id);
let currentState, selected, loaded, dirty = false, switching = 0;
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
async function action(callback) { try { await callback(); } catch (error) { notice(error.message, true); } }
let editVersion = 0;
async function flush() {
  if (dirty && loaded) {
    const version = editVersion;
    await window.scribe.edit(loaded, $('editor').value);
    if (version === editVersion) dirty = false;
  }
}
function duration(seconds) { const m = Math.floor(seconds / 60); return `${m}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`; }
function words() { const count = $('editor').value.trim().split(/\s+/).filter(Boolean).length; $('word-count').textContent = `${count.toLocaleString()} ${count === 1 ? 'word' : 'words'}`; }
async function select(id) {
  await flush(); selected = id; const request = ++switching;
  const job = currentState.jobs.find(item => item.id === selected);
  $('selected-name').textContent = job?.name || '';
  const ready = job?.status === 'done';
  $('editor').hidden = !ready; $('transcript-empty').hidden = ready;
  $('copy').disabled = !ready; $('save').disabled = !ready;
  if (ready && loaded !== id) {
    const text = await window.scribe.transcript(id);
    if (request !== switching) return;
    $('editor').value = text; loaded = id; dirty = false; words();
  } else if (!ready) { loaded = null; $('word-count').textContent = job?.status === 'transcribing' ? 'Transcribing…' : 'Waiting for a transcript'; }
  for (const button of document.querySelectorAll('.file-button')) button.setAttribute('aria-current', String(button.dataset.id === id));
}
function render(state) {
  const previous = currentState;
  currentState = state;
  $('version').textContent = `WAV Scribe ${state.version}`;
  $('count').textContent = state.jobs.length;
  $('queue-empty').hidden = state.jobs.length > 0;
  $('clear').disabled = state.running || !state.jobs.length;
  $('choose').disabled = state.running;
  $('start').hidden = state.running;
  $('start').disabled = !state.engineReady || !state.jobs.some(job => ['ready','failed','cancelled'].includes(job.status));
  $('cancel').hidden = !state.running;
  if (!state.running) { $('cancel').disabled = false; $('cancel').textContent = 'Stop transcription'; }
  const active = state.jobs.find(job => job.status === 'transcribing');
  const complete = state.jobs.filter(job => job.status === 'done').length;
  $('run-status').textContent = active ? `Transcribing recording ${state.jobs.indexOf(active) + 1} of ${state.jobs.length} · ${active.progress}%` : complete ? `${complete} ${complete === 1 ? 'transcript' : 'transcripts'} ready to review.` : state.jobs.length ? 'Ready to transcribe.' : 'Ready when you are.';
  $('progress').hidden = !state.running; $('progress').value = active?.progress || 0;
  // Preserve focus when progress updates arrive.
  const focused = document.activeElement?.dataset?.id;
  $('queue').replaceChildren();
  for (const job of state.jobs) {
    const li = document.createElement('li'); const button = document.createElement('button');
    button.className = 'file-button'; button.dataset.id = job.id; button.setAttribute('aria-current', String(selected === job.id));
    const name = document.createElement('span'); name.className = 'file-name'; name.textContent = job.name;
    const meta = document.createElement('span'); meta.className = 'file-meta';
    const time = document.createElement('span'); time.textContent = `${duration(job.duration)} · ${(job.bytes/1048576).toFixed(1)} MB`;
    const status = document.createElement('span'); status.textContent = ({ ready:'Ready', queued:'Queued', transcribing:`${job.progress}%`, done:job.saved ? 'Text saved' : 'Ready to review', failed:'Try again', cancelled:'Stopped' })[job.status];
    meta.append(time,status); button.append(name,meta);
    if (job.error) { const error = document.createElement('span'); error.className = 'file-error'; error.textContent = job.error; button.append(error); }
    button.addEventListener('click', () => action(() => select(job.id))); li.append(button); $('queue').append(li);
    if (focused === job.id) button.focus();
  }
  if (!state.jobs.some(job => job.id === selected)) { selected = state.jobs[0]?.id; loaded = null; dirty = false; }
  const completedNow = state.jobs.find(job => job.status === 'done' && previous?.jobs.find(old => old.id === job.id)?.status !== 'done');
  if (completedNow && !loaded) selected = completedNow.id;
  if (selected) void action(() => select(selected));
  else { $('editor').hidden = true; $('transcript-empty').hidden = false; $('selected-name').textContent = ''; $('word-count').textContent = 'No recording selected'; $('save').disabled = true; $('copy').disabled = true; }
  if (!state.engineReady) notice('The speech engine or model is missing. Reinstall WAV Scribe to restore offline transcription.', true);
}
$('choose').addEventListener('click', () => action(async () => { await flush(); const errors = await window.scribe.chooseFiles(); notice(errors.join('\n'), errors.length > 0); }));
$('clear').addEventListener('click', () => action(async () => { await flush(); await window.scribe.clear(); }));
$('start').addEventListener('click', () => action(async () => { notice(''); await flush(); await window.scribe.start('en'); }));
$('cancel').addEventListener('click', () => action(async () => { $('cancel').disabled = true; $('cancel').textContent = 'Stopping…'; await window.scribe.cancel(); }));
$('editor').addEventListener('input', () => {
  dirty = true; editVersion++; words();
  const job = currentState.jobs.find(item => item.id === loaded);
  if (job) {
    job.saved = false;
    const button = [...document.querySelectorAll('.file-button')].find(item => item.dataset.id === loaded);
    if (button) button.querySelector('.file-meta span:last-child').textContent = 'Unsaved edits';
  }
  void action(flush);
});
$('copy').addEventListener('click', () => action(async () => { await flush(); await window.scribe.copy(selected); notice('Transcript copied.'); }));
$('save').addEventListener('click', () => action(async () => { await flush(); const name = await window.scribe.export(selected, $('format').value); if (name) { notice(`Saved ${name}`); $('show-export').hidden = false; } }));
$('show-export').addEventListener('click', () => action(() => window.scribe.showExport()));
$('format').addEventListener('change', () => { $('export-note').textContent = $('format').value === 'txt' ? 'Review names, numbers, and wording before sharing.' : 'Subtitles use the original transcript and timing. Text edits apply to .txt exports only.'; });
window.scribe.onState(render);
void action(async () => render(await window.scribe.state()));

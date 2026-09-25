const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
async function main() {
  const cache = path.join(root,'.cache','ui-check');
  await fs.mkdir(cache,{recursive:true});
  const original = path.join(cache,'sample.wav');
  const response = await fetch('https://raw.githubusercontent.com/ggml-org/whisper.cpp/927cfce3/samples/jfk.wav');
  if (!response.ok) throw new Error('Test sample download failed.');
  await fs.writeFile(original, Buffer.from(await response.arrayBuffer()));
  const stereo = path.join(cache,'Speech with spaces & accents é.wav');
  // ffmpeg is used only to construct a test fixture; it is not an app dependency.
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',original,'-ar','44100','-ac','2','-c:a','pcm_s24le',stereo]);
  const output = path.join(cache,'transcript.txt');
  const app = await electron.launch({ args:[root, `--user-data-dir=${path.join(cache,'profile')}`], env:{...process.env, WAV_SCRIBE_ENGINE:process.env.WAV_SCRIBE_ENGINE || path.join(root,'resources/native/win32-x64/whisper-cli.exe')} });
  const previousClipboard = await app.evaluate(({clipboard}) => clipboard.readText());
  try {
    const page = await app.firstWindow(); const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('heading',{name:'Let your recordings speak.'}).waitFor();
    await page.screenshot({path:path.join(root,'docs','app-preview.png')});
    assert.equal(await page.locator('#start').isDisabled(),true);
    await app.evaluate(({dialog},filename) => { dialog.showOpenDialog = async () => ({ canceled:false,filePaths:[filename] }); },stereo);
    await page.getByRole('button',{name:'Add WAV recordings'}).click();
    await page.getByRole('button',{name:/Transcribe recordings/}).click();
    await page.locator('#editor').waitFor({state:'visible',timeout:120000});
    const text = await page.locator('#editor').inputValue();
    assert.match(text,/ask not what your country can do for you/i);
    await page.locator('#editor').fill('Reviewed transcript. '+text);
    await app.evaluate(({dialog},filename) => { dialog.showSaveDialog = async () => ({canceled:false,filePath:filename}); },output);
    await page.getByRole('button',{name:'Save as…'}).click();
    await page.getByRole('status').filter({hasText:'Saved transcript.txt'}).waitFor();
    assert.match(await fs.readFile(output,'utf8'),/Reviewed transcript/);
    await page.locator('#editor').fill('Final reviewed transcript. '+text);
    assert.match(await page.locator('#queue').textContent(), /Unsaved edits/);
    await page.getByRole('button',{name:'Save as…'}).click();
    await page.getByRole('button',{name:'Copy text'}).click();
    assert.match(await app.evaluate(({clipboard}) => clipboard.readText()),/Final reviewed transcript/);
    await page.locator('#format').selectOption('srt');
    assert.match(await page.locator('#export-note').textContent(),/Text edits apply to .txt/);
    await app.evaluate(({dialog},filename) => { dialog.showSaveDialog = async () => ({canceled:false,filePath:filename}); },path.join(cache,'transcript.srt'));
    await page.getByRole('button',{name:'Save as…'}).click();
    await page.getByRole('status').filter({hasText:'Saved transcript.srt'}).waitFor();
    assert.match(await fs.readFile(path.join(cache,'transcript.srt'),'utf8'),/-->/);
    await page.locator('#format').selectOption('txt');
    await page.screenshot({path:path.join(root,'docs','app-transcript.png')});
    await page.setViewportSize({width:760,height:620});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),false);
    await page.screenshot({path:path.join(root,'docs','app-compact.png')});
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle}));
    assert.notEqual(focused.tag,'BODY'); assert.notEqual(focused.outline,'none');
    assert.deepEqual(errors,[]);
    console.log('Desktop UI, 44.1 kHz stereo 24-bit WAV, edited text export, subtitle export, clipboard, compact layout and keyboard focus passed.');
  } finally {
    await app.evaluate(({clipboard},text) => clipboard.writeText(text), previousClipboard);
    await app.close();
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });

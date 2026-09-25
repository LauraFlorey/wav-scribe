const path = require('node:path');
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const os = require('node:os');
const { transcribe } = require('../src/core.cjs');
const root = path.resolve(__dirname, '..');
async function main() {
  const binary = process.env.WAV_SCRIBE_ENGINE || path.join(root,'resources/native/win32-x64/whisper-cli.exe');
  const model = path.join(root,'resources/models/ggml-base.en.bin');
  const work = await fs.mkdtemp(path.join(os.tmpdir(),'wav-scribe-integration-'));
  try {
    const response = await fetch('https://raw.githubusercontent.com/ggml-org/whisper.cpp/927cfce3/samples/jfk.wav');
    if (!response.ok) throw new Error('Could not download the public-domain speech test.');
    const input = path.join(work,'speech sample.wav');
    await fs.writeFile(input, Buffer.from(await response.arrayBuffer()));
    const original = createHash('sha256').update(await fs.readFile(input)).digest('hex');
    const result = await transcribe({ binary, model, input, workRoot:path.join(work,'jobs'), language:'en' });
    assert.match(result.txt,/ask not what your country can do for you/i);
    assert.match(result.srt,/00:00:.* --> /); assert.match(result.vtt,/WEBVTT/);
    assert.equal(createHash('sha256').update(await fs.readFile(input)).digest('hex'),original);
    assert.deepEqual(await fs.readdir(path.join(work,'jobs')),[]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),100);
    await assert.rejects(transcribe({ binary,model,input,workRoot:path.join(work,'jobs'),signal:controller.signal }), /Cancelled|aborted/);
    clearTimeout(timer);
    assert.deepEqual(await fs.readdir(path.join(work,'jobs')),[]);
    console.log('Real speech transcription, TXT/SRT/VTT output, original preservation, cancellation and cleanup passed.');
    console.log(result.txt);
  } finally { await fs.rm(work,{recursive:true,force:true}); }
}
main().catch(error => { console.error(error); process.exitCode=1; });

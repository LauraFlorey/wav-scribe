const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { inspectWav, engineArguments, transcribe, saveTranscript } = require('../src/core.cjs');

function wav({ channels = 1, rate = 16000, bits = 16, encoding = 1, seconds = 1, extended = false } = {}) {
  const fmtSize = extended ? 40 : 16;
  const dataSize = rate * channels * bits / 8 * seconds;
  const buffer = Buffer.alloc(28 + fmtSize + dataSize);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(fmtSize, 16); buffer.writeUInt16LE(extended ? 65534 : encoding, 20);
  buffer.writeUInt16LE(channels, 22); buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * channels * bits / 8, 28); buffer.writeUInt16LE(channels * bits / 8, 32); buffer.writeUInt16LE(bits, 34);
  if (extended) { buffer.writeUInt16LE(22, 36); buffer.writeUInt16LE(bits, 38); Buffer.from('0100000000001000800000aa00389b71', 'hex').copy(buffer, 44); }
  buffer.write('data', 20 + fmtSize); buffer.writeUInt32LE(dataSize, 24 + fmtSize);
  return buffer;
}
async function fixture(t, buffer, name = 'sample.wav') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wav-scribe-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, name); await fs.writeFile(file, buffer); return file;
}

for (const format of [ {}, { channels:2, rate:44100, bits:24 }, { channels:2, rate:48000, bits:32, encoding:3 }, { bits:24, extended:true } ]) {
  test(`reads WAV metadata ${JSON.stringify(format)}`, async t => {
    const file = await fixture(t, wav(format)); const info = await inspectWav(file);
    assert.equal(info.duration, 1); assert.equal(info.channels, format.channels || 1);
  });
}
test('accepts uppercase extension, spaces, unicode and shell punctuation as a literal path', async t => {
  const name = process.platform === 'win32' ? "José & notes (final).WAV" : "José & notes $(test).WAV";
  const file = await fixture(t, wav(), name);
  assert.equal((await inspectWav(file)).name, name);
  const args = engineArguments({ model:'model', input:file, output:'out' });
  assert.equal(args[args.indexOf('--file')+1], file);
});
test('rejects a renamed non-WAV file', async t => {
  await assert.rejects(inspectWav(await fixture(t, Buffer.alloc(50))), /not supported/);
});
test('rejects a truncated recording', async t => {
  await assert.rejects(inspectWav(await fixture(t, wav().subarray(0, 100))), /incomplete/);
});
test('rejects empty audio', async t => {
  await assert.rejects(inspectWav(await fixture(t, wav({ seconds:0 }))), /no audio/);
});
test('rejects compressed audio with actionable guidance', async t => {
  await assert.rejects(inspectWav(await fixture(t, wav({ encoding:7 }))), /uncompressed PCM/);
});
test('rejects corrupt block alignment', async t => {
  const data = wav(); data.writeUInt16LE(0,32);
  await assert.rejects(inspectWav(await fixture(t, data)), /damaged/);
});
test('does not run if cancellation was requested before starting', async t => {
  const file = await fixture(t,wav()); const abort = new AbortController(); abort.abort();
  await assert.rejects(transcribe({ input:file, binary:'missing', workRoot:path.dirname(file), signal:abort.signal }), { name:'AbortError' });
});
test('reports missing engine and removes temporary work', async t => {
  const file = await fixture(t,wav()); const workRoot = path.join(path.dirname(file), 'work');
  await assert.rejects(transcribe({ input:file, binary:path.join(workRoot,'missing'), model:'model', workRoot }), /could not start/);
  assert.deepEqual(await fs.readdir(workRoot),[]);
});
test('rejects unsupported engine options', () => {
  assert.throws(() => engineArguments({ language:'../file' }), /supported language/);
});
test('export replaces an existing hardlink without changing its original', async t => {
  const file = await fixture(t, wav());
  const original = await fs.readFile(file);
  const target = path.join(path.dirname(file), 'transcript.txt');
  await fs.link(file,target);
  await saveTranscript(target,'Reviewed text');
  assert.deepEqual(await fs.readFile(file),original);
  assert.equal(await fs.readFile(target,'utf8'),'\uFEFFReviewed text');
});

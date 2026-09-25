const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const LANGUAGES = { en: 'English' };

async function inspectWav(filename) {
  if (path.extname(filename).toLowerCase() !== '.wav') throw new Error('Please choose a .wav recording.');
  const file = await fs.open(filename, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 44) throw new Error('This file is not a complete WAV recording.');
    const header = Buffer.alloc(12);
    await file.read(header, 0, 12, 0);
    if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('This WAV format is not supported. Export it as a standard PCM or float WAV file.');
    }
    const declaredEnd = header.readUInt32LE(4) + 8;
    if (declaredEnd > stat.size) throw new Error('This WAV file is incomplete or damaged.');
    let offset = 12, format, dataBytes;
    while (offset + 8 <= declaredEnd) {
      const chunk = Buffer.alloc(8);
      await file.read(chunk, 0, 8, offset);
      const name = chunk.toString('ascii', 0, 4);
      const size = chunk.readUInt32LE(4);
      if (offset + 8 + size > declaredEnd) throw new Error('This WAV file is incomplete or damaged.');
      if (name === 'fmt ') {
        if (size < 16) throw new Error('The WAV audio format is damaged.');
        const fmt = Buffer.alloc(Math.min(size, 40));
        await file.read(fmt, 0, fmt.length, offset + 8);
        let encoding = fmt.readUInt16LE(0);
        if (encoding === 65534) {
          if (size < 40 || fmt.readUInt16LE(16) < 22 || fmt.subarray(26, 40).toString('hex') !== '000000001000800000aa00389b71') {
            throw new Error('This extended WAV format is not supported. Export as PCM WAV.');
          }
          encoding = fmt.readUInt16LE(24);
        }
        format = { encoding, channels: fmt.readUInt16LE(2), sampleRate: fmt.readUInt32LE(4), blockAlign: fmt.readUInt16LE(12), bits: fmt.readUInt16LE(14) };
      }
      if (name === 'data') dataBytes = size;
      offset += 8 + size + (size % 2);
    }
    if (!format || !dataBytes) throw new Error('There is no audio in this WAV file.');
    const { encoding, channels, sampleRate, blockAlign, bits } = format;
    if (![1, 3].includes(encoding) || !(encoding === 1 ? [8, 16, 24, 32] : [32, 64]).includes(bits)) {
      throw new Error('Please export this recording as an uncompressed PCM or float WAV file.');
    }
    if (channels < 1 || channels > 8 || sampleRate < 8000 || sampleRate > 192000 || blockAlign !== channels * bits / 8 || dataBytes % blockAlign !== 0) {
      throw new Error('This WAV file has an unsupported or damaged audio format.');
    }
    const duration = dataBytes / blockAlign / sampleRate;
    if (duration > 7200) throw new Error('Please split recordings longer than two hours into smaller WAV files.');
    return { name: path.basename(filename), bytes: stat.size, duration, channels, sampleRate };
  } finally { await file.close(); }
}

function engineArguments({ model, input, output, language = 'en' }) {
  if (!Object.hasOwn(LANGUAGES, language)) throw new Error('Choose a supported language.');
  return ['--model', model, '--file', input, '--language', language,
    '--threads', String(Math.max(1, Math.min(6, os.availableParallelism() - 1))),
    '--no-gpu', '--print-progress', '--output-txt', '--output-srt', '--output-vtt',
    '--output-file', output];
}

async function transcribe({ binary, model, input, workRoot, language, signal, onProgress = () => {} }) {
  await inspectWav(input);
  signal?.throwIfAborted();
  await fs.mkdir(workRoot, { recursive: true, mode: 0o700 });
  const work = await fs.mkdtemp(path.join(workRoot, 'job-'));
  try {
    const output = path.join(work, 'transcript');
    await new Promise((resolve, reject) => {
      const child = spawn(binary, engineArguments({ model, input, output, language }), {
        windowsHide: true, shell: false, cwd: path.dirname(binary), stdio: ['ignore', 'ignore', 'pipe'], signal
      });
      let tail = '';
      child.stderr.on('data', data => {
        tail = (tail + data.toString()).slice(-6000);
        const matches = [...tail.matchAll(/progress\s*=\s*(\d+)%/g)];
        if (matches.length) onProgress(Math.min(99, Number(matches.at(-1)[1])));
      });
      child.once('error', error => {
        if (error.name === 'AbortError') return; // wait for close before cleaning temporary files
        reject(new Error('The speech engine could not start. Reinstall WAV Scribe and try again.'));
      });
      child.once('close', code => {
        if (signal?.aborted) return reject(new Error('Cancelled.'));
        if (code !== 0) {
          const advice = /failed to (read|open|decode).*audio|failed to retrieve.*audio/i.test(tail)
            ? 'The recording could not be decoded. Re-export it as PCM WAV and try again.'
            : 'Transcription stopped. Close other large apps and try again. If this repeats, reinstall WAV Scribe.';
          reject(new Error(advice));
        } else resolve();
      });
    });
    signal?.throwIfAborted();
    const [txt, srt, vtt] = await Promise.all(['txt', 'srt', 'vtt'].map(ext => fs.readFile(`${output}.${ext}`, 'utf8')));
    return { txt: txt.trim(), srt, vtt };
  } finally { await fs.rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

async function saveTranscript(filename, content) {
  // Replace the destination atomically, so existing symlinks/hardlinks cannot
  // redirect a write into original audio or another file.
  const temporary = await fs.mkdtemp(path.join(path.dirname(filename), '.wav-scribe-save-'));
  try {
    const file = path.join(temporary, 'export');
    await fs.writeFile(file, '\uFEFF' + content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(file, filename);
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

module.exports = { inspectWav, engineArguments, transcribe, saveTranscript, LANGUAGES };

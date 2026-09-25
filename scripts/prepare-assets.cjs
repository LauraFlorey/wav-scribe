const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const path = require('node:path');
const AdmZip = require('adm-zip');
const root = path.resolve(__dirname, '..');
const resources = path.join(root, 'resources');

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function download(url, file, checksum) {
  if (checksum && await sha256(file).catch(() => '') === checksum) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.partial';
  console.log('Preparing', path.basename(file));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if (checksum && await sha256(temporary) !== checksum) throw new Error(`Checksum mismatch: ${file}`);
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

async function main() {
  const archive = path.join(resources, 'whisper-windows.zip');
  await download('https://github.com/ggml-org/whisper.cpp/releases/download/b5130/whisper-bin-x64.zip', archive,
    'f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c');
  const unpacked = path.join(root, '.cache', 'whisper-b5130');
  await fs.rm(unpacked, { recursive: true, force: true });
  new AdmZip(archive).extractAllTo(unpacked, true);
  const native = path.join(resources, 'native', 'win32-x64');
  await fs.rm(native, { recursive: true, force: true });
  await fs.mkdir(native, { recursive: true });
  for (const file of await fs.readdir(path.join(unpacked, 'Release'))) {
    if (file === 'whisper-cli.exe' || /^(whisper|ggml.*)\.dll$/.test(file)) {
      await fs.copyFile(path.join(unpacked, 'Release', file), path.join(native, file));
    }
  }
  await download('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    path.join(resources, 'models', 'ggml-base.en.bin'),
    'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002');
  await download('https://raw.githubusercontent.com/ggml-org/whisper.cpp/927cfce3/LICENSE',
    path.join(resources, 'licenses', 'whisper-cpp-MIT.txt'));
  await download('https://raw.githubusercontent.com/openai/whisper/v20250625/LICENSE',
    path.join(resources, 'licenses', 'whisper-model-MIT.txt'));
  await download('https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe',
    path.join(resources, 'vc_redist.x64.exe'),
    '843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c');
  console.log('Offline model and Windows engine ready. No client downloads needed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

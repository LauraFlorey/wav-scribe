# WAV Scribe

A small, private desktop app for transcribing English WAV recordings on Windows 10
and Windows 11 (64-bit Intel/AMD). Everything needed for transcription is included
in its offline installer. No account, subscription, API key, Python installation,
or internet connection is needed on the client's computer.

## For the client

1. Copy **WAV-Scribe-Setup-0.1.0-x64.exe** to the Windows computer, for example on a USB drive.
2. Run the installer, approve the Windows administrator prompt, and follow the setup steps.
3. Open **WAV Scribe** from the desktop or Start menu.
4. Click **Add WAV recordings**, select files, and click **Transcribe recordings**.
5. Review the transcript. Use **Copy text** or **Save as…** to keep it.

Read [the short client guide](docs/CLIENT-GUIDE.md) for supported audio and export details.
This first build is unsigned and still needs installation testing on Windows before
client distribution. Windows may show an unknown-publisher or SmartScreen message.

## What it does

- Processes recordings locally with the bundled Whisper base English model.
- Queues up to 50 files, one at a time, with progress and cancellation.
- Supports standard PCM and floating-point WAV recordings, including stereo,
  44.1/48 kHz, and 24-bit audio. Individual recordings are limited to two hours.
- Lets you review and edit text, copy it, or export UTF-8 text, SRT, or WebVTT subtitles.
- Preserves source recordings. Transcripts stay in memory until you save them;
  temporary engine output is deleted after each job and cleaned up after crashes.
- Makes no runtime network requests. Includes no analytics or automatic updater.

Text edits apply to text exports. Subtitle exports retain the engine's original words
and timings. This version does not identify speakers, record a microphone, or translate.
Accuracy and speed depend on the recording and computer; review the output.

## Build the installer

Developer preparation requires internet. Client installation and use do not.
Use Node.js 22.23.0 (or a current supported Node version >=22):

```sh
npm ci
npm run build:win
```

The installer is created in `dist/`. The build script downloads the pinned Windows
speech engine, English model, Microsoft C++ Redistributable, and licenses, checking
SHA-256 hashes of executable/model downloads. Electron and build dependencies are
locked in `package-lock.json`. No publishing is configured or performed.

The installer installs for all users and requires administrator approval to install
the included Microsoft runtime. That runtime is not removed when uninstalling WAV Scribe.
Saved transcripts and original audio are also preserved when uninstalling.

## Develop and verify

```sh
npm run prepare:assets
npm test
npm run check
npm start
npm run test:integration
```

Windows development uses the prepared native engine automatically. For local Mac
development, point `WAV_SCRIBE_ENGINE` at an installed `whisper-cli` executable before
running `npm start` or the integration test. This is a developer override only and
is ignored by packaged apps. The distributed app is Windows-only.

`scripts/ui-check.cjs` exercises the real Electron interface, transcription and
exports. It uses ffmpeg **only to create a stereo 24-bit test recording**, never as
an application dependency. The integration and UI checks download the short public
JFK speech sample during developer testing. They never upload audio.

See [the development handoff](docs/HANDOFF.md) for test evidence and remaining Windows checks.

## Components and sources

- [whisper.cpp 1.9.4 / build b5130](https://github.com/ggml-org/whisper.cpp/releases/tag/b5130), MIT.
- [OpenAI Whisper](https://github.com/openai/whisper) English base model, MIT;
  [converted model](https://huggingface.co/ggerganov/whisper.cpp).
- [Electron](https://www.electronjs.org/docs/latest/tutorial/security), MIT and included Chromium notices.
- [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist), Microsoft license.

Upstream notices ship with the app. Installer code signing requires a publisher
certificate or signing service before a signed release can be produced.

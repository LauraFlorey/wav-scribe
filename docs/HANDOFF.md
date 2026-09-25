# WAV Scribe development handoff

## Scope

Requested September 25, 2026: a small Windows app to transcribe WAV files locally,
with an easy installer for a client. Laura confirmed Windows 10 and 11, entirely
offline installation, and primarily English recordings.

This standalone project lives separately from the Chicken Workshops website.
The website was not edited or published. At Laura's request, the private source
repository was created at https://github.com/LauraFlorey/wav-scribe. Its default
branch is `main`. The unsigned installer is available for Windows testing in the
private [v0.1.0-preview.1 prerelease](https://github.com/LauraFlorey/wav-scribe/releases/tag/v0.1.0-preview.1),
with the client guide and SHA-256 checksum. This preview does not establish Windows
installation success or readiness for client distribution.

## Implementation

- Electron main process controls native dialogs, the queue, local child processes,
  and exports. The renderer has a narrow context bridge, sandbox, no Node access,
  restrictive CSP, blocked navigation/new windows, denied permissions and blocked
  network requests. No runtime downloader, telemetry, account, or updater.
- Whisper.cpp 1.9.4 release-associated build b5130, Windows x64 CPU DLL variants,
  English base model, and Microsoft C++ x64 runtime are bundled. Download URLs and
  SHA-256 checksums are pinned in `scripts/prepare-assets.cjs`.
- NSIS installs for all users, including the bundled runtime. Administrator rights
  are required. Runtime success/newer-installed/restart exit codes are handled;
  other failures stop setup with an error. Windows 10 is the minimum version.
- Queue limit: 50 files. Per-file duration limit: two hours. English only. No speaker
  identification. Text edits do not regenerate subtitle timing or subtitle wording.
- Audio is read without alteration. Engine output uses a private work directory;
  normal completion, errors and cancellation clean it, and launch cleans crash leftovers.
  Exports replace destinations atomically. Transcripts are kept only in memory
  until explicitly exported; quitting or clearing unsaved work prompts the user.

## Verification performed on this Mac

- 14 automated checks: PCM/float/extensible WAV metadata, stereo and 24-bit formats,
  spaces/Unicode filenames, corrupt/truncated/empty/unsupported input, invalid options,
  pre-cancelled jobs, missing engine handling, temporary cleanup, and exports that
  preserve originals even when the destination is a hardlink.
- Real speech inference with installed whisper.cpp 1.9.1 and the bundled English
  model recovered the expected JFK speech. Verified TXT/SRT/VTT output, unchanged
  source hash, mid-job cancellation and cleanup.
- Real Electron UI exercised selection and transcription of a 44.1 kHz stereo 24-bit
  WAV with spaces and accented characters, edited TXT export, SRT export, clipboard,
  compact window overflow and keyboard focus. Screenshots are in this folder.
- Source syntax checks and dependency audit passed. App has no production npm dependencies.
- Windows x64 NSIS cross-build succeeded on macOS. The modern NSIS 3.12 toolset is
  pinned because the legacy compiler requires an unavailable Intel compatibility layer.

These checks do not establish that the Windows executable or installer runs correctly
on a clean Windows computer. No Windows machine or VM was available in this session.
The local test engine is 1.9.1; the bundled Windows engine is 1.9.4/b5130.

## Before client release

Installer produced: `dist/WAV-Scribe-Setup-0.1.0-x64.exe`, 261.7 MB.
SHA-256: `b4287c2d6c6071777c99d8f6f0fea84843016bbf964de96cb57a33fce3485cb0`.
The PE certificate table is empty, confirming this is unsigned. Final packaged
application files were compared byte-for-byte with their source, and the bundled
engine, CPU libraries, model and offline Microsoft runtime were all present.
`dist/SHA256SUMS.txt` records the installer checksum. Full dependency audit reported
zero known vulnerabilities at build time.

1. On clean Windows 10 and Windows 11 x64 machines, disable network access and run
   the installer with administrator approval. Verify runtime installation, shortcuts,
   launch after setup, and reboot handling if requested.
2. Transcribe representative client audio; confirm accuracy and acceptable speed.
   Include a 44.1/48 kHz stereo WAV and a filename/account name containing accents.
3. Verify TXT/SRT/VTT export, corrections, cancellation, retry, closing during work,
   and Windows security/antivirus behavior.
4. Reinstall/upgrade, then uninstall. Confirm source audio and exported transcripts
   remain and the shared Microsoft runtime is not removed.
5. Configure a publisher signing certificate/service for a signed release if needed.
   The current installer and app are unsigned. A successful package build is not a
   signing or Windows installation test.

## Rebuild

Run `npm ci`, then `npm run build:win`. This downloads build assets on the developer's
machine and writes the fully offline installer to `dist/`. The client needs only
the installer. Do not ship `win-unpacked` or require the client to build anything.

Use `npm run check`, `npm test`, and `npm run test:integration` for source verification.
On a Mac, set `WAV_SCRIBE_ENGINE` to an installed `whisper-cli` path. Run
`node scripts/ui-check.cjs` for the UI integration check; its test fixture requires
ffmpeg. That program is not bundled or needed by the application.

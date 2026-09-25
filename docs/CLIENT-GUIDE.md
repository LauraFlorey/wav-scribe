# WAV Scribe — getting started

## Install once

You need a Windows 10 or Windows 11 computer with a 64-bit Intel or AMD processor.
An ARM/Snapdragon computer is not a supported target for this build. We recommend
at least 8 GB of memory and 1 GB of free disk space for setup and working files.
These are practical starting recommendations, not measured minimum specifications.

Open **WAV-Scribe-Setup-0.1.0-x64.exe**, approve the administrator prompt, and complete
setup. Everything is included, so you can install from a USB drive with the computer
disconnected from the internet. If Windows requests a restart, restart before use.

The current review build has not been digitally signed. Windows may warn that its
publisher is unknown. For a managed client computer, arrange installation with its
administrator. A signed client release is a separate delivery step.

## Transcribe a recording

1. Open **WAV Scribe** from the desktop or Start menu.
2. Click **Add WAV recordings**. Choose one or more `.wav` files.
3. Click **Transcribe recordings**. Leave the app open while it works.
4. Click a completed recording to read its transcript. You can correct the text directly.
5. Click **Save as…** to save a text file, or **Copy text** to paste into Word or another app.

Recordings are processed one at a time. **Stop transcription** stops the current
recording and remaining queue; completed transcripts remain available. Click
**Transcribe recordings** again to retry stopped or failed recordings.

Save text before clearing the queue or closing the app. Transcripts are not kept
as a permanent history. Your original audio files are always left in place.

## Subtitle files

Select **Subtitles (.srt)** or **Web subtitles (.vtt)** beside the save button.
These formats contain timed captions for video/audio editing tools. They use the
original machine transcript; corrections made in the text editor apply to `.txt`
files only. Save a text copy too if you want to keep those corrections.

## Recording tips

This version is intended for English speech. Clear voices and low background noise
help. Review names, numbers, and technical terms before sharing a transcript.
It does not separate or label different speakers.

Standard uncompressed PCM and float WAV files are supported. A recording may be up
to two hours long. Very long files take more time and memory. If a file is rejected,
export it again as a standard PCM WAV file or split it into shorter recordings.
Renaming another file type to `.wav` does not convert it.

## Privacy

Audio and transcripts are processed on this computer. Nothing is uploaded to a
transcription service. There are no accounts, analytics, or background update checks.
Saved files are placed only in the location you choose. If you choose a folder
synced by OneDrive or another service, that service may sync the saved transcript.
**Copy text** uses the Windows clipboard, which may also sync if enabled in Windows.

## If something goes wrong

- **The speech engine could not start:** restart Windows after installation, then
  try again. If needed, rerun the installer to restore the included runtime and model.
- **The recording cannot be decoded:** re-export it as PCM WAV.
- **Transcription stops:** close other memory-heavy apps and retry a shorter recording.
- **The text is inaccurate:** check the source recording and correct the text before saving.

To uninstall, use **Settings → Apps → WAV Scribe → Uninstall**. Your recordings and
saved transcripts are preserved.

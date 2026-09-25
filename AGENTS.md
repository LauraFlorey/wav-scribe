# WAV Scribe

Standalone offline Windows WAV transcription app. Read README.md and docs/HANDOFF.md.
Keep all audio and transcripts local. Do not add telemetry, accounts, cloud inference,
automatic updates, or runtime downloads. Never overwrite source audio. Keep filesystem
access in Electron's main process and the renderer sandboxed. Use only checked native
assets from scripts/prepare-assets.cjs. Build output is local; no publishing without
an explicit request. Run npm test, npm run check, and the integration check after
engine changes. Windows installer execution must be tested on Windows before client
release; a cross build is not an installation test.

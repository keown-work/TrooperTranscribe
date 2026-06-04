\# TrooperTranscribe



Portable, offline audio transcription tool for Police investigators.

Runs from USB. No installation required on deployment machines.



\## Build Requirements (build machine only)

\- Python 3.11+

\- Hugging Face account with accepted licenses for:

&#x20; - pyannote/segmentation-3.0

&#x20; - pyannote/speaker-diarization-3.1



\## Setup

1\. Run `setup\_models.bat` and enter your HF token when prompted.

2\. Upload branding assets to `/branding/`.

3\. Proceed with USB packaging phase.



\## Deployment

Run `launch.bat` from the USB drive. No installation required.

Compatible with (CPU) and (GPU) computers.



\## Data Security

No audio, transcript, or case data leaves the local machine at any time.

All AI models run locally. No external API calls are made during operation.


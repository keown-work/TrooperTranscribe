
"""
KSPTranscribe - One-time model setup script.
Run via setup_models.bat on the build machine.
The HF token is used only during this download and never stored.
"""

import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
MODELS_DIR = SCRIPT_DIR / "models"
WHISPER_DIR = MODELS_DIR / "whisper"
PYANNOTE_DIR = MODELS_DIR / "pyannote"


def download_pyannote(hf_token: str):
    from huggingface_hub import snapshot_download

    skip = ["*.msgpack", "*.h5", "flax_model*", "tf_model*"]

    print("\n[1/5] Downloading pyannote/segmentation-3.0...")
    snapshot_download(
    repo_id="pyannote/segmentation-3.0",
    token=hf_token,
    cache_dir=str(PYANNOTE_DIR),
    ignore_patterns=skip
)
    print("      Complete.")

    print("\n[2/5] Downloading pyannote/speaker-diarization-3.1...")
    snapshot_download(
    repo_id="pyannote/speaker-diarization-3.1",
    token=hf_token,
    cache_dir=str(PYANNOTE_DIR),
    ignore_patterns=skip
)
    print("      Complete.")


def download_whisper():
    from faster_whisper import WhisperModel

    models = [
        ("large-v2", "3"),
        ("small",    "4"),
        ("base",     "5"),
    ]

    for model_name, step in models:
        target = WHISPER_DIR / model_name
        target.mkdir(parents=True, exist_ok=True)
        print(f"\n[{step}/5] Downloading faster-whisper {model_name}...")
        WhisperModel(model_name, device="cpu", download_root=str(target))
        print(f"      Complete.")


def main():
    print("=" * 60)
    print("  KSPTranscribe - Model Setup")
    print("=" * 60)
    print("\nAll processing is local. Your HF token is used only")
    print("for this download and is never written to disk.\n")

    for d in [MODELS_DIR, WHISPER_DIR, PYANNOTE_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    hf_token = input("Hugging Face token: ").strip()

    if not hf_token.startswith("hf_"):
        print("\nERROR: Token must start with 'hf_'. Check and retry.")
        sys.exit(1)

    try:
        download_pyannote(hf_token)
        download_whisper()
    except Exception as e:
        print(f"\nERROR: {e}")
        print("\nVerify that you accepted the license on both model pages:")
        print("  https://huggingface.co/pyannote/segmentation-3.0")
        print("  https://huggingface.co/pyannote/speaker-diarization-3.1")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  All models downloaded successfully.")
    print("  Upload your KSP branding assets to /branding/")
    print("  then return for the next build phase.")
    print("=" * 60)


if __name__ == "__main__":
    main()
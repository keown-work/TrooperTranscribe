"""
Transcription engine using faster-whisper.
Runs fully offline using locally cached models.
"""

from pathlib import Path
from typing import Callable, Optional
import torch


def transcribe_audio(
    audio_path: str,
    model_name: str,
    models_path: Path,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> list:
    """
    Transcribe an audio/video file using faster-whisper.

    Returns a list of dicts: [{start, end, text}, ...]
    """
    from faster_whisper import WhisperModel

    cuda = torch.cuda.is_available()
    device = "cuda" if cuda else "cpu"
    compute_type = "float16" if cuda else "int8"
    whisper_cache = str(models_path / "whisper")

    if progress_callback:
        mode_label = "GPU" if cuda else "CPU"
        progress_callback(8, f"Loading {model_name} ({mode_label})...")

    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        download_root=whisper_cache,
    )

    if progress_callback:
        progress_callback(18, "Transcribing audio...")

    segments_gen, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    segments = []
    total_duration = max(info.duration, 1)

    for seg in segments_gen:
        segments.append(
            {
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            }
        )
        if progress_callback:
            pct = 18 + int((seg.end / total_duration) * 48)
            elapsed = int(seg.end)
            total = int(total_duration)
            progress_callback(min(pct, 66), f"Transcribing... {elapsed}s / {total}s")

    return segments

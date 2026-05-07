"""
Speaker diarization using pyannote.audio 3.x.
Runs fully offline using locally cached models.
"""

import os
import uuid
from pathlib import Path
from typing import Optional
import torch


def diarize_audio(
    audio_path: str,
    models_path: Path,
    num_speakers: Optional[int] = None,
) -> list:
    """
    Run speaker diarization on an audio file.

    Returns list of dicts: [{start, end, speaker}, ...]
    """
    from pyannote.audio import Pipeline

    pyannote_cache = str(models_path / "pyannote")

    # Point HuggingFace at our local cache and enforce offline mode
    saved_hf_home = os.environ.get("HF_HOME")
    os.environ["HF_HOME"] = pyannote_cache
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
        pipeline.to(device)

        kwargs: dict = {}
        if num_speakers is not None:
            kwargs["num_speakers"] = num_speakers

        diarization = pipeline(audio_path, **kwargs)

        result = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            result.append(
                {
                    "start": round(turn.start, 3),
                    "end": round(turn.end, 3),
                    "speaker": speaker,
                }
            )
        return result

    finally:
        if saved_hf_home is not None:
            os.environ["HF_HOME"] = saved_hf_home
        elif "HF_HOME" in os.environ:
            del os.environ["HF_HOME"]


def merge_transcript_diarization(segments: list, diarization: list) -> list:
    """
    Align Whisper transcript segments with pyannote diarization labels.

    For each transcript segment, the diarization label with the greatest
    time overlap is assigned. Falls back to SPEAKER_01 if no overlap found.

    Returns list of dicts: [{id, start, end, text, speaker}, ...]
    """
    # Build a normalized speaker map (SPEAKER_01, SPEAKER_02, ...)
    speaker_map: dict = {}
    counter = [1]

    def normalize(raw: str) -> str:
        if raw not in speaker_map:
            speaker_map[raw] = f"SPEAKER_{counter[0]:02d}"
            counter[0] += 1
        return speaker_map[raw]

    result = []

    for seg in segments:
        seg_start = seg["start"]
        seg_end = seg["end"]
        best_speaker_raw = None
        best_overlap = 0.0

        for d in diarization:
            overlap = max(0.0, min(seg_end, d["end"]) - max(seg_start, d["start"]))
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker_raw = d["speaker"]

        if best_speaker_raw is None:
            # No overlap found — assign SPEAKER_01
            assigned = "SPEAKER_01"
        else:
            assigned = normalize(best_speaker_raw)

        result.append(
            {
                "id": str(uuid.uuid4()),
                "start": seg_start,
                "end": seg_end,
                "text": seg["text"],
                "speaker": assigned,
            }
        )

    return result

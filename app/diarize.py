# Copyright (c) 2026 Casey Keown. All rights reserved. Proprietary and confidential.

"""
Speaker diarization using pyannote.audio 4.x.
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
    from pyannote.audio import Pipeline
    import av
    import tempfile
    import numpy as np
    import soundfile as sf

    # Pre-convert audio to wav tensor so pyannote doesn't need torchcodec
    tmp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_wav.close()

    container = av.open(audio_path)
    resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
    samples = []
    for frame in container.decode(audio=0):
        for reframe in resampler.resample(frame):
            samples.append(reframe.to_ndarray()[0])
    container.close()

    audio_array = np.concatenate(samples).astype(np.float32)
    sf.write(tmp_wav.name, audio_array, 16000)

    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
        pipeline.to(device)

        # Pass as tensor dict to bypass broken torchcodec audio decoder
        audio_data, sr = sf.read(tmp_wav.name, dtype="float32")
        waveform = torch.from_numpy(audio_data).unsqueeze(0)
        audio_input = {"waveform": waveform, "sample_rate": sr}

        kwargs: dict = {}
        if num_speakers is not None:
            kwargs["num_speakers"] = num_speakers

        diarization = pipeline(audio_input, **kwargs)

        # pyannote 4.x returns DiarizeOutput, speaker_diarization is the Annotation
        annotation = diarization.speaker_diarization

        result = []
        for turn, _, speaker in annotation.itertracks(yield_label=True):
            result.append({
                "start": round(turn.start, 3),
                "end": round(turn.end, 3),
                "speaker": speaker,
            })
        return result

    finally:
        try:
            os.unlink(tmp_wav.name)
        except OSError:
            pass


def merge_transcript_diarization(segments: list, diarization: list) -> list:
    """
    Align Whisper transcript segments with pyannote diarization labels.
    For each transcript segment, the diarization label with the greatest
    time overlap is assigned. Falls back to SPEAKER_01 if no overlap found.
    Returns list of dicts: [{id, start, end, text, speaker}, ...]
    """
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
            assigned = "SPEAKER_01"
        else:
            assigned = normalize(best_speaker_raw)

        result.append({
            "id": str(uuid.uuid4()),
            "start": seg_start,
            "end": seg_end,
            "text": seg["text"],
            "speaker": assigned,
        })

    return result
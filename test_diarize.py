import os
from pathlib import Path
os.environ['HF_HOME'] = str(Path('models/pyannote'))
os.environ['HF_HUB_OFFLINE'] = '1'
from pyannote.audio import Pipeline
import av
import tempfile
import numpy as np
import soundfile as sf
import torch

audio_path = 'C:/Users/casey.keown/Desktop/voicemail.mp3'

container = av.open(audio_path)
resampler = av.AudioResampler(format='fltp', layout='mono', rate=16000)
samples = []
for frame in container.decode(audio=0):
    for reframe in resampler.resample(frame):
        samples.append(reframe.to_ndarray()[0])
container.close()

audio_array = np.concatenate(samples).astype(np.float32)
waveform = torch.from_numpy(audio_array).unsqueeze(0)
audio_input = {'waveform': waveform, 'sample_rate': 16000}
print('Audio loaded as tensor, shape:', waveform.shape)

pipeline = Pipeline.from_pretrained('pyannote/speaker-diarization-3.1')
print('Pipeline loaded')
diarization = pipeline(audio_input)
print('Done')
annotation = diarization.speaker_diarization
for turn, _, speaker in annotation.itertracks(yield_label=True):
    print(f'{speaker}: {turn.start:.1f}s - {turn.end:.1f}s')
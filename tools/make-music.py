"""Cut generated music tracks into loops for the game.

    python3 tools/make-music.py SOURCE_DIR OUT_DIR

For each track in TRACKS it finds two points a whole number of bars apart
where the music sounds alike, blends a short crossfade over the seam, sets
all tracks to one loudness and writes an MP3. Each file has a short lead-in
(the end of the loop) and a tail (the start of the loop again), so that the
player can loop between two fixed times and the MP3 padding does not matter.
It also writes tracks.json with the loop times. Needs ffmpeg, numpy, librosa.
"""
import json, subprocess, sys
import numpy as np
import librosa

LEAD, TAIL, XF, SR = 0.25, 0.75, 0.06, 44100
# name: (source file, bpm, earliest loop start in seconds)
TRACKS = {
    'map1': ('map_rocksteady_1', 84, 0), 'map2': ('map_rocksteady_2', 84, 0),
    'blend': ('level_skaclassic_1', 124, 0), 'ska': ('level_skaclassic_2', 124, 0),
    'tone': ('level_twotone_1', 148, None), 'title': ('level_twotone_2', 148, 0),
    'wheel': ('level_skapunk_1', 168, 0), 'punk': ('level_skapunk_2', 168, 0),
    'isle1': ('level_springs_1', 100, 14), 'isle2': ('level_springs_2', 100, 0),
}

def intro_end(y, sr):
    """The time where the band is first at full level (for a track with a thin intro)."""
    rms = librosa.feature.rms(y=y, frame_length=sr, hop_length=sr // 2)[0]
    full = np.median(rms[len(rms) // 3:])
    for i, v in enumerate(rms):
        if v > 0.8 * full and np.all(rms[i:i + 6] > 0.7 * full):
            return i * 0.5
    return 0.0

def find_loop(path, bpm, earliest):
    y, sr = librosa.load(path, sr=22050, mono=True)
    if earliest is None:
        earliest = intro_end(y, sr)
    hop = 512
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=bpm, hop_length=hop, tightness=200)
    tempo = float(np.atleast_1d(tempo)[0])
    bt = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
    per_bar = 4 * max(1, round(tempo / bpm))  # the tracker can count double time
    # where the ending starts: the last moment at a normal level, less a margin
    rms = librosa.feature.rms(y=y, frame_length=4096, hop_length=hop)[0]
    loud = np.where(rms > 0.25 * np.median(rms))[0]
    latest = librosa.frames_to_time(loud[-1], sr=sr, hop_length=hop) - 4.0
    feat = np.vstack([librosa.util.normalize(librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop), axis=0),
                      librosa.util.normalize(librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)[1:], axis=0) * 0.5])
    w = int(1.5 * sr / hop)
    best = None
    for i, s in enumerate(bt):
        if s < max(earliest, 1.0):
            continue
        for bars in range(8, 200, 4):
            j = i + bars * per_bar
            if j >= len(bt) or bt[j] > latest:
                break
            length = bt[j] - s
            if length < 40:
                continue
            a, b = beats[i], beats[j]
            if a - w < 0 or b + w > feat.shape[1]:
                continue
            d = np.mean(np.linalg.norm(feat[:, a - w:a + w] - feat[:, b - w:b + w], axis=0))
            score = d - 0.004 * length - (0.03 if bars % 8 == 0 else 0)
            if best is None or score < best[0]:
                best = (score, s, bt[j], bars, d)
    if best is None:
        raise SystemExit(f'no loop found in {path}')
    return dict(start=float(best[1]), end=float(best[2]), bars=best[3], dist=float(best[4]),
                tempo=tempo, earliest=float(earliest), latest=float(latest))

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

def cut(path, start, end):
    y = decode(path)
    s, e = int(start * SR), int(end * SR)
    # line the end up with the start to the sample
    n = int(0.25 * SR)
    ref = y[s:s + n].mean(axis=1)
    lag = max(range(-1500, 1501, 4), key=lambda k: float(np.dot(ref, y[e + k:e + k + n].mean(axis=1))))
    e += lag
    loop = y[s:e].copy()
    x = int(XF * SR)
    t = np.linspace(0, np.pi / 2, x)[:, None]
    loop[-x:] = y[e - x:e] * np.cos(t) + y[s - x:s] * np.sin(t)
    rms = np.sqrt(np.mean(loop ** 2))
    gain = min(10 ** (-19 / 20) / rms, 10 ** (-1 / 20) / np.abs(loop).max())
    loop *= gain
    return np.concatenate([loop[-int(LEAD * SR):], loop, loop[:int(TAIL * SR)]]), len(loop) / SR

def main(src, out):
    info = {}
    for name, (file, bpm, earliest) in TRACKS.items():
        f = find_loop(f'{src}/{file}.flac', bpm, earliest)
        audio, length = cut(f'{src}/{file}.flac', f['start'], f['end'])
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
                        '-c:a', 'libmp3lame', '-q:a', '5', f'{out}/{name}.mp3'], input=audio.tobytes(), check=True)
        info[name] = {'start': LEAD, 'length': round(length, 4)}
        print(name, file, {k: round(v, 2) for k, v in f.items()}, 'loop', round(length, 2), flush=True)
    json.dump(info, open(f'{out}/tracks.json', 'w'), indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

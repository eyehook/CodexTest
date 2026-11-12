#!/usr/bin/env python3
"""Extract the reviewed candidate windows; requires an external FFmpeg executable.
Only static gain and 10 ms edge de-clicks are applied. No compression/denoising.
"""
import argparse, hashlib, json, re, subprocess
from pathlib import Path

WINDOWS = [(47, 67), (87, 107), (183, 203), (267, 287), (307, 327)]
SOURCE_URL = 'https://freesound.org/people/bruno.auzet/sounds/670307/'
PREVIEW_URL = 'https://cdn.freesound.org/previews/670/670307_11519060-hq.mp3'

def run(ffmpeg, args):
    return subprocess.run([ffmpeg, '-hide_banner', '-nostats', *args], check=True, capture_output=True, text=True).stderr

def measure(ffmpeg, args):
    log = run(ffmpeg, [*args, '-af', 'atrim=duration=20,asetpts=PTS-STARTPTS,ebur128=peak=true', '-t', '20', '-f', 'null', '-'])
    summary = log[log.rfind('Summary:'):]
    return float(re.search(r'I:\s*([-\d.]+) LUFS', summary)[1]), float(re.search(r'Peak:\s*([-\d.]+) dBFS', summary)[1])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[3] / 'assets/hike/audio')
    parser.add_argument('--source-kind', choices=['public-hq-mp3-preview', 'original-wav'], default='public-hq-mp3-preview')
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    clips = []
    for index, (start, end) in enumerate(WINDOWS, 1):
        inputs = ['-ss', str(start), '-i', str(args.source)]
        loudness, peak = measure(args.ffmpeg, inputs)
        gain = round(max(-3, min(3, -23 - loudness)), 2)
        stem = f'forest-{index:02}'
        filters = f'atrim=duration=20,asetpts=PTS-STARTPTS,volume={gain}dB,afade=t=in:d=0.01,afade=t=out:st=19.99:d=0.01'
        files = {}
        for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '96k'])]:
            path = args.output / f'{stem}.{extension}'
            run(args.ffmpeg, [*inputs, '-t', '20', '-af', filters, '-ar', '32000', '-ac', '2', *codec, '-map_metadata', '-1', '-metadata', f'title=Forest ambience {index}', '-y', str(path)])
            output_lufs, output_peak = measure(args.ffmpeg, ['-i', str(path)])
            files[extension] = {'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'integratedLufs': output_lufs, 'truePeakDbfs': output_peak}
        clips.append({'id': stem, 'sourceStartSeconds': start, 'sourceEndSeconds': end, 'durationSeconds': end-start, 'inputLufs': loudness, 'inputTruePeakDbfs': peak, 'gainDb': gain, 'files': files})
    manifest = {'source': {'title': 'silent windy pine forest.wav', 'author': 'bruno.auzet', 'url': SOURCE_URL, 'license': 'CC0-1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/', 'inputKind': args.source_kind, 'downloadUrl': PREVIEW_URL if args.source_kind == 'public-hq-mp3-preview' else None, 'inputSha256': hashlib.sha256(args.source.read_bytes()).hexdigest()}, 'preparation': {'sampleRate': 32000, 'channels': 2, 'targetLufs': -23, 'maxGainAdjustmentDb': 3, 'edgeFadeSeconds': 0.01, 'auditoryReview': 'pending; selection based on waveform/spectral inspection'}, 'clips': clips}
    (args.output / 'clips.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps([{'clip': c['id'], 'start': c['sourceStartSeconds'], 'gainDb': c['gainDb'], 'oggLufs': c['files']['ogg']['integratedLufs']} for c in clips], indent=2))

if __name__ == '__main__':
    main()

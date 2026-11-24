"""Render the audition library from the locally retained Pixabay MP3."""

import argparse
from array import array
import json
import math
from pathlib import Path
import subprocess
import wave

ROOT = Path(__file__).resolve().parent
SOURCE = 'freesound_community-007024_alpine_ski_pov-16659.mp3'
SOURCE_ID = 'alpine-ski-pov'
RATE = 24000

# Titles, source ranges in seconds, and high/low cutoff frequencies in Hz.
CUTS = {
    'gentle-glide': [
        ('Soft track', 16.25, 21.9, 140, 7200),
        ('Light grain', 155.2, 162.1, 120, 6800),
        ('Quiet runout', 195.4, 203.6, 170, 6200),
    ],
    'fast-glide': [
        ('Steady rush', 20.9, 26.4, 150, 8600),
        ('Dense track', 102.6, 108.4, 180, 8800),
        ('Rough track', 123.85, 129.75, 165, 8200),
    ],
    'carving': [
        ('Rounded edge', 33.7, 36.55, 185, 9200),
        ('Pulsing edge', 83.95, 88.45, 220, 9400),
        ('Hard edge', 183.8, 187.8, 200, 9500),
    ],
    'braking': [
        ('Short spray', 43.98, 46.05, 180, 9400),
        ('Breaking edge', 136.02, 138.95, 210, 9000),
        ('Runout spray', 191.95, 194.95, 140, 8800),
    ],
    'wind': [
        ('Low rush', 103.1, 109.6, 65, 510),
        ('Open rush', 184.15, 191.45, 85, 680),
    ],
    'launch': [
        ('Light release', 56.35, 56.8, 260, 7900),
        ('Quick release', 72.4, 72.72, 225, 8300),
        ('Firm release', 97.5, 98.07, 190, 9100),
    ],
    'pole-push': [
        ('Light pole plant', 1.75, 2.10, 220, 7400),
        ('Quick pole plant', 4.55, 4.86, 270, 8200),
        ('Firm pole plant', 8.62, 9.04, 180, 6800),
    ],
    'landing': [
        ('Soft contact', 60.65, 61.22, 130, 7200),
        ('Flat contact', 111.22, 111.92, 105, 8000),
        ('Heavy contact', 151.57, 152.37, 95, 8400),
    ],
}


def render(raw, category, start, end, high, low):
    loop = category in {'gentle-glide', 'fast-glide', 'carving', 'wind'}
    samples = []
    baseline = filtered = 0.0
    hp = 1 - math.exp(-math.tau * high / RATE)
    lp = 1 - math.exp(-math.tau * low / RATE)
    offset = round(start * RATE)
    for index in range(max(0, offset - RATE // 10), round(end * RATE)):
        sample = raw[index] / 32768
        baseline += hp * (sample - baseline)
        filtered += lp * (sample - baseline - filtered)
        if index >= offset:
            samples.append(filtered)

    if loop:
        # Level broad changes in the glide while preserving individual grains.
        power = sum(value * value for value in samples) / len(samples)
        if category != 'carving':
            envelope = power
            smoothing = 1 - math.exp(-1 / (RATE * 0.14))
            for index, value in enumerate(samples):
                envelope += smoothing * (value * value - envelope)
                gain = min(1.65, max(0.6, (power / max(envelope, 1e-12)) ** 0.32))
                samples[index] *= gain

        # Begin with the tail blended into the head. The last unblended
        # sample precedes that same tail in the recording.
        overlap = round(RATE * (0.38 if category == 'wind' else 0.24))
        for index in range(overlap):
            angle = math.pi / 2 * index / (overlap - 1)
            samples[index] = (
                samples[index - overlap] * math.cos(angle)
                + samples[index] * math.sin(angle)
            )
        del samples[-overlap:]
    else:
        duration = len(samples) / RATE
        for index, value in enumerate(samples):
            time = index / RATE
            if category == 'launch':
                value *= max(0, 1 - time / duration) ** 0.65
            elif category == 'pole-push':
                value *= math.exp(-2 * time / duration)
            elif category == 'landing':
                # A damped body thump under the source-derived snow texture.
                value = value * math.exp(-3 * time / duration)
                value += 0.13 * math.sin(math.tau * (high * 0.48) * time) * math.exp(-26 * time)
            attack = 0.025 if category == 'pole-push' else 0.012
            fade = min(1, index / (RATE * attack), (len(samples) - 1 - index) / (RATE * 0.065))
            samples[index] = value * fade

    rms = math.sqrt(sum(value * value for value in samples) / len(samples))
    target_db = {'wind': -26, 'gentle-glide': -24, 'fast-glide': -22}.get(category, -21)
    gain = min(10 ** (target_db / 20) / rms, 0.85 / max(map(abs, samples)))
    return array('h', (round(value * gain * 32767) for value in samples))


def describe(category, high, low):
    details = f'Mono, {high}–{low:,} Hz filtering, level matched within category.'
    if category in {'gentle-glide', 'fast-glide', 'wind'}:
        return details + ' Smoothed level and crossfaded loop. ' + (
            'Low-band rush isolated from the mixed ski recording.' if category == 'wind' else 'Glide intensity is an audition estimate.'
        )
    if category == 'carving':
        return details + ' Crossfaded loop with edge pulses preserved.'
    if category == 'launch':
        return 'Reconstructed release from a short snow scrape. ' + details + ' Shaped decay.'
    if category == 'pole-push':
        return 'Short snow scrape from the source recording with a shaped decay. ' + details
    if category == 'landing':
        return 'Reconstructed landing with a synthesized thump under recorded snow texture. ' + details
    return 'Braking candidate from a decaying spray burst. ' + details + ' Short fades.'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--source', type=Path, default=ROOT / 'source' / SOURCE)
    args = parser.parse_args()
    decoded = subprocess.check_output([
        args.ffmpeg, '-v', 'error', '-i', str(args.source), '-ac', '1',
        '-ar', str(RATE), '-f', 's16le', '-',
    ])
    raw = array('h', decoded)
    output = ROOT / 'audio'
    manifest_file = output / 'manifest.json'
    manifest = json.loads(manifest_file.read_text())
    manifest['samples'] = []
    for category, cuts in CUTS.items():
        (output / category).mkdir(exist_ok=True)
        for number, (title, start, end, high, low) in enumerate(cuts, 1):
            sample_id = f'{category}-{number:02d}'
            name = f"{title.lower().replace(' ', '-')}.wav"
            filename = f'{category}/{name}'
            pcm = render(raw, category, start, end, high, low)
            with wave.open(str(output / filename), 'wb') as clip:
                clip.setparams((1, 2, RATE, len(pcm), 'NONE', 'not compressed'))
                clip.writeframes(pcm.tobytes())
            manifest['samples'].append({
                'id': sample_id,
                'title': title,
                'category': category,
                'filename': filename,
                'duration': len(pcm) / RATE,
                'playback': 'loop' if category in {'gentle-glide', 'fast-glide', 'carving', 'wind'} else 'one-shot',
                'sourceId': SOURCE_ID,
                'sourceRanges': [[start, end]],
                'processing': describe(category, high, low),
            })
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()

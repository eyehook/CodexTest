# The Hike — forest ambience assets

Source: **silent windy pine forest.wav**, bruno.auzet,
[Freesound sound 670307](https://freesound.org/people/bruno.auzet/sounds/670307/).
The source page lists **CC0 1.0**, stereo, 48 kHz / 24-bit WAV, 5:34.112.
License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
These extracted/level-adjusted derivatives are distributed under the same CC0
terms. Credit is retained for provenance; no music or other sound sources are used.

The original WAV requires Freesound login. The bundled clips were made from its
public [high-quality MP3 preview](https://cdn.freesound.org/previews/670/670307_11519060-hq.mp3)
(48 kHz stereo, approximately 177 kb/s VBR). They therefore include an extra lossy
encoding generation. The original recording is not duplicated in the repository.
`clips.json` records the exact input SHA-256 and each output's SHA-256, bytes,
source window, static gain, measured loudness and true peak.

## Clip selection

All windows are **20 seconds**, non-overlapping, measured from the decoded source
start. Selection used waveform/spectrogram inspection, short-window level,
boundary-vs-center energy and a high-frequency tonal-activity proxy. This is not
an auditory bird/noise classifier. Regions with conspicuous repeated high-frequency
traces around 1:55–2:45 and 3:40–4:10, the initial/final edges and conspicuous
transient candidates were avoided. Wind energy is generally lower at the selected
boundaries than around the interior swells.

| Clip | Source start–end | Static gain | Signal-based selection notes |
| --- | --- | --- | --- |
| [forest-01](forest-01.mp3) | 00:47–01:07 | −2.6 dB | Broad wind swell around 00:57, quieter boundaries |
| [forest-02](forest-02.mp3) | 01:27–01:47 | +1.3 dB | Lower-level bed, smaller interior movement |
| [forest-03](forest-03.mp3) | 03:03–03:23 | −1.0 dB | Wind movement around 03:13, away from the stronger tonal sequence |
| [forest-04](forest-04.mp3) | 04:27–04:47 | −1.1 dB | Broad wind energy around 04:37 |
| [forest-05](forest-05.mp3) | 05:07–05:27 | −0.3 dB | Late wind movement around 05:18, excludes the recording end |

**Listening review remains pending.** No human/model auditory audition was possible
in the authoring environment. Minimal birds, absence of handling noise and the
natural completeness of individual events still need listening confirmation.
The candidate files and player are usable for that review; do not interpret
signal analysis or automated continuity checks as audible-quality approval.

## Encoding and level

Each clip has stereo **32 kHz Ogg Vorbis quality 4**, plus a **96 kb/s MP3 fallback**.
Ogg is preferred when `canPlayType` indicates support; a fetch/decode failure also
tries MP3. Runtime never downloads both formats when the preferred one works.
The five Ogg files total about 1.25 MB; the five fallback MP3s about 1.21 MB.

FFmpeg EBU R128 measurement selects a single fixed gain toward **−23 LUFS**, capped
at ±3 dB. The final Ogg files measure approximately −23.2 LUFS; all peaks remain
below −9 dBFS. There is no dynamic compressor, limiter, denoiser or per-frame
normalization. Both channels receive the same gain. Only 10 ms edge de-click
fades are baked in; five-second playback crossfades supply the actual transitions.
Master playback gain is 0.35; natural wind dynamics remain within each clip.

## Rebuild

Use a locally downloaded copy of the same preview, or the original WAV:

```sh
python3 projects/hike/tools/prepare-ambience.py /absolute/path/source.mp3 --ffmpeg /absolute/path/ffmpeg
```

For the original WAV, add `--source-kind original-wav`. The tool regenerates both
formats and `clips.json`, with fresh loudness/peak measurements and hashes. It
requires an external FFmpeg build with libvorbis, libmp3lame and ebur128; no FFmpeg
binary or added runtime dependency is shipped. Timestamp windows live in that
script. Review the sound again if substituting a different source copy.

See [the project audio guide](../../../projects/hike/AUDIO.md) for scheduling,
activation, lifecycle, memory and validation limits.

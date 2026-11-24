const library = document.querySelector('#library');
const status = document.querySelector('#status');
const stopAll = document.querySelector('#stop-all');
const template = document.querySelector('#sample');
const buffers = new Map();
const active = new Set();
let context;
let output;

function loadBuffer(filename) {
  if (!buffers.has(filename)) {
    const pending = (async () => {
      const response = await fetch(new URL(filename, import.meta.url));
      if (!response.ok) throw new Error(`Audio request failed (${response.status})`);
      return context.decodeAudioData(await response.arrayBuffer());
    })();
    buffers.set(filename, pending);
    pending.catch(() => buffers.delete(filename));
  }
  return buffers.get(filename);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
}

function createSample(sample) {
  const card = template.content.firstElementChild.cloneNode(true);
  const find = selector => card.querySelector(selector);
  const play = find('.play');
  const stop = find('.stop');
  const loop = find('.loop');
  const volume = find('.volume');
  const rate = find('.rate');
  const message = find('.status');
  let voice;

  find('h3').textContent = sample.title;
  const timestamps = sample.sourceRanges?.map(([start, end]) =>
    `${formatTime(start)}–${formatTime(end)}`).join(', ');
  find('.details').textContent = [
    `${sample.duration.toFixed(2)} s`,
    sample.playback === 'loop' ? 'Loop' : 'One-shot',
    timestamps ? `Source ${timestamps}` : null,
  ].filter(Boolean).join(' · ');
  find('.processing').textContent = sample.processing;

  function update() {
    find('.volume-value').textContent = `${Math.round(volume.valueAsNumber * 100)}%`;
    find('.rate-value').textContent = `${rate.valueAsNumber.toFixed(2)}×`;
    if (voice?.source) {
      voice.source.loop = loop.checked;
      voice.source.playbackRate.value = rate.valueAsNumber;
      voice.gain.gain.setTargetAtTime(volume.valueAsNumber, context.currentTime, 0.015);
    }
  }

  function reset() {
    loop.checked = sample.playback === 'loop';
    volume.value = '0.75';
    rate.value = '1';
    update();
  }

  function stopVoice() {
    const current = voice;
    voice = undefined;
    if (current?.source) {
      current.source.onended = null;
      current.source.stop();
      current.source.disconnect();
      current.gain.disconnect();
    }
    active.delete(stopVoice);
    stopAll.disabled = active.size === 0;
    play.disabled = false;
    stop.disabled = true;
    message.textContent = '';
  }

  play.addEventListener('click', async () => {
    const pending = {};
    voice = pending;
    active.add(stopVoice);
    stopAll.disabled = false;
    play.disabled = true;
    stop.disabled = false;
    message.textContent = 'Loading…';
    try {
      if (!context) {
        context = new AudioContext();
        output = context.createDynamicsCompressor();
        output.threshold.value = -6;
        output.connect(context.destination);
      }
      const [, buffer] = await Promise.all([context.resume(), loadBuffer(sample.category === 'pole-push' ? sample.filename + '?v=0.1.67' : sample.filename)]);
      if (voice !== pending) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = loop.checked;
      source.playbackRate.value = rate.valueAsNumber;
      gain.gain.value = volume.valueAsNumber;
      source.connect(gain).connect(output);
      source.start();
      pending.source = source;
      pending.gain = gain;
      source.onended = stopVoice;
      message.textContent = 'Playing';
    } catch (error) {
      if (voice !== pending) return;
      stopVoice();
      message.textContent = `Could not play this sample. ${error.message}`;
    }
  });
  stop.addEventListener('click', stopVoice);
  loop.addEventListener('change', update);
  volume.addEventListener('input', update);
  rate.addEventListener('input', update);
  find('.reset').addEventListener('click', reset);
  reset();
  return card;
}

stopAll.addEventListener('click', () => active.forEach(stop => stop()));
window.addEventListener('pagehide', () => active.forEach(stop => stop()));

try {
  const response = await fetch('./manifest.json?v=0.1.67');
  if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
  const {categories, samples, sources} = await response.json();
  for (const [id, name] of Object.entries(categories)) {
    const group = samples.filter(sample => sample.category === id);
    if (!group.length) continue;
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = name;
    section.append(heading, ...group.map(createSample));
    library.append(section);
  }
  for (const source of Object.values(sources)) {
    const item = document.createElement('p');
    const recording = document.createElement('a');
    recording.href = source.url;
    recording.textContent = source.title;
    const license = document.createElement('a');
    license.href = source.licenseUrl;
    license.textContent = source.license;
    item.append(recording, ` · ${source.credit} · `, license);
    document.querySelector('#sources').append(item);
  }
  status.textContent = samples.length ? '' : 'Awaiting the source recording. No samples are available yet.';
} catch (error) {
  status.textContent = `Could not load the sample library. ${error.message}`;
}

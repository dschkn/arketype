const canvas = document.getElementById('visual');
const ctx = canvas.getContext('2d');
const enter = document.getElementById('enter');
const edition = document.getElementById('edition');

let audioContext;
let masterGain;
let analyser;
let started = false;
let noiseBuffer;

const activeVoices = [];

enter.addEventListener('click', startRadio, { once: true });
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

async function startRadio() {
  if (started) return;
  started = true;

  const seed = Math.floor(Math.random() * 100000);
  edition.textContent = `ARKETYPE RADIO / ${String(seed).padStart(5, '0')}`;
  document.body.classList.add('running');

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  createMasterBus();
  noiseBuffer = createNoiseBuffer();
  createDroneField();
  scheduleEvents();
  scheduleNoise();
  animate();
}

function createMasterBus() {
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.16;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.9;

  masterGain.connect(analyser);
  analyser.connect(audioContext.destination);
}

function createDroneField() {
  const fundamental = 55;
  const spectrum = [1, 2.01, 3.03, 4.07, 5.11, 6.19, 7.31, 8.47];
  const voiceCount = randomInt(3, 6);

  for (let i = 0; i < voiceCount; i += 1) {
    const ratio = spectrum[randomInt(0, spectrum.length - 1)];
    createDroneVoice(fundamental * ratio);
  }
}

function createDroneVoice(frequency) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  oscillator.detune.value = randomFloat(-8, 8);

  gain.gain.value = 0;

  filter.type = 'lowpass';
  filter.frequency.value = randomFloat(300, 1800);
  filter.Q.value = randomFloat(0.2, 2);

  oscillator.connect(filter).connect(gain).connect(masterGain);
  oscillator.start();

  const now = audioContext.currentTime;
  gain.gain.linearRampToValueAtTime(randomFloat(0.015, 0.05), now + randomFloat(6, 18));

  const voice = { oscillator, gain, filter };
  activeVoices.push(voice);
  modulateDrone(voice);
}

function modulateDrone(voice) {
  if (!started || !audioContext) return;

  const now = audioContext.currentTime;
  const duration = randomFloat(10, 32);

  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
  voice.gain.gain.linearRampToValueAtTime(randomFloat(0.008, 0.055), now + duration);

  voice.filter.frequency.cancelScheduledValues(now);
  voice.filter.frequency.setValueAtTime(Math.max(voice.filter.frequency.value, 100), now);
  voice.filter.frequency.linearRampToValueAtTime(randomFloat(220, 2200), now + duration);

  window.setTimeout(() => modulateDrone(voice), duration * 1000);
}

function scheduleEvents() {
  window.setTimeout(() => {
    createEvent();
    scheduleEvents();
  }, randomFloat(4000, 20000));
}

function createEvent() {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const frequencies = [110, 165, 220, 275, 330, 440, 550, 660];

  oscillator.type = Math.random() > 0.82 ? 'triangle' : 'sine';
  oscillator.frequency.value = frequencies[randomInt(0, frequencies.length - 1)];
  oscillator.detune.value = randomFloat(-12, 12);

  filter.type = 'lowpass';
  filter.frequency.value = randomFloat(700, 4200);
  filter.Q.value = randomFloat(0.2, 1.5);

  oscillator.connect(filter).connect(gain).connect(masterGain);

  const now = audioContext.currentTime;
  const attack = randomFloat(0.15, 3);
  const release = randomFloat(2, 12);
  const peak = randomFloat(0.008, 0.045);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);

  oscillator.start(now);
  oscillator.stop(now + attack + release + 0.1);
}

function createNoiseBuffer() {
  const length = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function scheduleNoise() {
  window.setTimeout(() => {
    if (Math.random() < 0.6) createNoiseEvent();
    scheduleNoise();
  }, randomFloat(15000, 60000));
}

function createNoiseEvent() {
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  source.buffer = noiseBuffer;
  source.loop = true;

  filter.type = 'bandpass';
  filter.frequency.value = randomFloat(200, 3000);
  filter.Q.value = randomFloat(2, 10);

  source.connect(filter).connect(gain).connect(masterGain);

  const now = audioContext.currentTime;
  const duration = randomFloat(4, 20);
  const peak = randomFloat(0.004, 0.02);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + duration * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.start(now);
  source.stop(now + duration + 0.05);
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function animate() {
  window.requestAnimationFrame(animate);

  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);

  if (!analyser) return;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  let energy = 0;
  for (let i = 0; i < data.length; i += 1) energy += data[i];
  energy /= data.length * 255;

  drawGeometry(width, height, energy);
}

function drawGeometry(width, height, energy) {
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineWidth = 0.5 + energy * 0.7;

  const lineLength = width * (0.08 + energy * 0.38);
  const x = width * 0.5 - lineLength / 2;
  const y = height * 0.53;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + lineLength, y);
  ctx.stroke();

  const verticalHeight = 18 + energy * height * 0.28;
  ctx.beginPath();
  ctx.moveTo(width * 0.28, height * 0.4);
  ctx.lineTo(width * 0.28, height * 0.4 + verticalHeight);
  ctx.stroke();

  const radius = 0.8 + energy * 2.4;
  ctx.beginPath();
  ctx.arc(width * 0.71, height * 0.68, radius, 0, Math.PI * 2);
  ctx.fill();
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomFloat(min, max + 1));
}

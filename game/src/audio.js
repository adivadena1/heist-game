// Aurum Heist — sound, synthesized live with WebAudio. No audio files,
// no network: every effect is an oscillator or a filtered noise burst.
// The bank hums quietly under everything; the alarm is a two-tone siren
// that only runs while the meter is in lockdown.
export function makeAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    alarmNodes: null,
    ambientNodes: null,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.startAmbient();
      return true;
    } catch {
      return false;
    }
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t0);
  }

  audio.startAmbient = function startAmbient() {
    if (!audio.ctx || audio.ambientNodes) return;
    const osc = audio.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 52;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = audio.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = audio.ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    lfo.start();
    audio.ambientNodes = { osc, lfo };
  };

  audio.step = function step() { noiseBurst(0.05, 0.06, 500); };
  audio.pickup = function pickup() { tone(880, 0.12, 'sine', 0.16); tone(1320, 0.18, 'sine', 0.12, 1760); };
  audio.keycard = function keycard() { tone(660, 0.1, 'square', 0.08); tone(990, 0.16, 'square', 0.08); };
  audio.doorOpen = function doorOpen() { noiseBurst(0.35, 0.14, 900); tone(180, 0.3, 'triangle', 0.1, 90); };
  audio.pickTick = function pickTick() { tone(1400, 0.03, 'square', 0.05); };
  audio.smoke = function smoke() { noiseBurst(0.5, 0.18, 1200); };
  audio.emp = function emp() { tone(1200, 0.4, 'sawtooth', 0.12, 120); noiseBurst(0.3, 0.1, 3000); };
  audio.spotted = function spotted() { tone(520, 0.16, 'square', 0.14); tone(780, 0.22, 'square', 0.14); };
  audio.laser = function laser() { tone(2400, 0.3, 'sawtooth', 0.1, 300); };
  audio.exitOpen = function exitOpen() { tone(523, 0.14, 'triangle', 0.14); tone(659, 0.14, 'triangle', 0.14); tone(784, 0.24, 'triangle', 0.16); };
  audio.caught = function caught() { tone(392, 0.25, 'sawtooth', 0.16, 196); tone(196, 0.5, 'sawtooth', 0.16, 98); };
  audio.clear = function clear() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 110);
    });
  };
  audio.win = function win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 130);
    });
  };
  audio.click = function click() { tone(700, 0.05, 'square', 0.07); };

  audio.setAlarm = function setAlarm(on) {
    if (!audio.ctx) return;
    if (on && !audio.alarmNodes) {
      const osc = audio.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 620;
      const gain = audio.ctx.createGain();
      gain.gain.value = 0.045;
      const lfo = audio.ctx.createOscillator();
      lfo.frequency.value = 1.1;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      lfo.start();
      audio.alarmNodes = { osc, lfo };
    } else if (!on && audio.alarmNodes) {
      try { audio.alarmNodes.osc.stop(); audio.alarmNodes.lfo.stop(); } catch { /* already stopped */ }
      audio.alarmNodes = null;
    }
  };

  return audio;
}

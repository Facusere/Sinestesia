/**
 * Sinestesia · módulo de análisis
 *
 * Funciones puras (sin DOM ni Web Audio) que trabajan sobre magnitudes
 * lineales de una FFT (`mag`, bins 0..N/2) o sobre muestras en el tiempo.
 * Se exponen como `window.A` en el navegador y como módulo CommonJS en Node
 * para poder testearlas con señales sintéticas.
 */
(function (root) {
  "use strict";

  const NOTE_NAMES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

  /** Número MIDI (fraccionario) de una frecuencia. La4 = 440 Hz = 69. */
  const toMidi = (freq) => 69 + 12 * Math.log2(freq / 440);

  /** Clase de nota (0 = Do … 11 = Si) más cercana a una frecuencia. */
  const pitchClass = (freq) => ((Math.round(toMidi(freq)) % 12) + 12) % 12;

  /** Nombre de nota con octava, p. ej. 440 → "La4". Devuelve "—" si no hay frecuencia. */
  function noteName(freq) {
    if (!(freq > 0)) return "—";
    const midi = Math.round(toMidi(freq));
    return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  /**
   * Frecuencia del pico más fuerte por encima de `minHz`, refinada con
   * interpolación parabólica sobre los tres bins centrales. 0 si no hay señal.
   */
  function peakFreq(mag, sampleRate, fftSize, minHz = 30) {
    const firstBin = Math.max(1, Math.ceil((minHz * fftSize) / sampleRate));
    let peak = firstBin;
    for (let i = firstBin; i < mag.length - 1; i++) {
      if (mag[i] > mag[peak]) peak = i;
    }
    if (!(mag[peak] > 1e-6) || peak >= mag.length - 1) return 0;

    const left = mag[peak - 1];
    const center = mag[peak];
    const right = mag[peak + 1];
    const curvature = left - 2 * center + right;
    const offset = curvature ? (0.5 * (left - right)) / curvature : 0;
    return ((peak + offset) * sampleRate) / fftSize;
  }

  /** Cromagrama: energía de cada una de las 12 notas (55 Hz a 4,2 kHz), normalizada a 0..1. */
  function chroma(mag, sampleRate, fftSize) {
    const energy = new Array(12).fill(0);
    for (let i = 1; i < mag.length; i++) {
      const freq = (i * sampleRate) / fftSize;
      if (freq < 55 || freq > 4200) continue;
      energy[pitchClass(freq)] += mag[i] * mag[i];
    }
    const max = Math.max(...energy) || 1;
    return energy.map((value) => value / max);
  }

  /** Centroide espectral ("brillo") en Hz. */
  function centroid(mag, sampleRate, fftSize) {
    let weighted = 0;
    let total = 0;
    for (let i = 1; i < mag.length; i++) {
      weighted += i * mag[i];
      total += mag[i];
    }
    return total ? ((weighted / total) * sampleRate) / fftSize : 0;
  }

  /** Raíz del promedio de los cuadrados de una señal en el tiempo. */
  function rms(samples) {
    let sum = 0;
    for (const value of samples) sum += value * value;
    return Math.sqrt(sum / samples.length);
  }

  /** Reparto de energía en graves (< 250 Hz), medios (< 4 kHz) y agudos. Suma 1. */
  function bands(mag, sampleRate, fftSize) {
    const energy = [0, 0, 0];
    for (let i = 1; i < mag.length; i++) {
      const freq = (i * sampleRate) / fftSize;
      const band = freq < 250 ? 0 : freq < 4000 ? 1 : 2;
      energy[band] += mag[i] * mag[i];
    }
    const total = energy[0] + energy[1] + energy[2] || 1;
    return energy.map((value) => value / total);
  }

  /**
   * Tempo por autocorrelación de la envolvente de onsets, buscando el desfase
   * dominante entre `lo` y `hi` BPM. Puede confundir octavas (x2, /2).
   * @param {number[]} env  envolvente (un valor por cuadro)
   * @param {number}   fps  cuadros por segundo de la envolvente
   */
  function estimateBPM(env, fps, lo = 60, hi = 180) {
    const n = env.length;
    if (n < fps * 3) return 0;

    const mean = env.reduce((a, b) => a + b, 0) / n;
    const centered = env.map((value) => value - mean);
    const minLag = Math.floor((fps * 60) / hi);
    const maxLag = Math.ceil((fps * 60) / lo);

    let bestScore = 0;
    let bestLag = 0;
    for (let lag = minLag; lag <= maxLag && lag < n / 2; lag++) {
      let sum = 0;
      for (let i = 0; i + lag < n; i++) sum += centered[i] * centered[i + lag];
      const score = sum / (n - lag);
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    return bestLag ? (60 * fps) / bestLag : 0;
  }

  /**
   * Matriz de autosimilitud (similitud coseno entre todos los pares de vectores).
   * Devuelve un Float32Array n×n; las repeticiones aparecen como diagonales.
   */
  function selfSim(features) {
    const n = features.length;
    const matrix = new Float32Array(n * n);
    const norms = features.map((v) => Math.hypot(...v) || 1);
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const a = features[i];
        const b = features[j];
        let dot = 0;
        for (let k = 0; k < a.length; k++) dot += a[k] * b[k];
        matrix[i * n + j] = matrix[j * n + i] = dot / (norms[i] * norms[j]);
      }
    }
    return matrix;
  }

  const api = { NOTE_NAMES, noteName, peakFreq, chroma, centroid, rms, bands, estimateBPM, selfSim };
  root.A = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

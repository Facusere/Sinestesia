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
   * dominante entre `lo` y `hi` BPM.
   *
   * Para reducir los errores de octava (x2, /2) cada candidato se pondera con
   * una curva suave centrada en 120 BPM (el tempo que más se percibe como
   * "pulso"). La confianza es la autocorrelación normalizada del candidato
   * elegido: cerca de 1 = pulso muy regular, cerca de 0 = sin pulso claro.
   *
   * @param {number[]} env  envolvente (un valor por cuadro)
   * @param {number}   fps  cuadros por segundo de la envolvente
   * @returns {{bpm: number, confidence: number}}
   */
  function estimateTempo(env, fps, lo = 60, hi = 180) {
    const n = env.length;
    if (n < fps * 3) return { bpm: 0, confidence: 0 };

    const mean = env.reduce((a, b) => a + b, 0) / n;
    const centered = env.map((value) => value - mean);
    let energy = 0;
    for (const v of centered) energy += v * v;
    energy /= n;
    if (!(energy > 0)) return { bpm: 0, confidence: 0 };

    const minLag = Math.max(1, Math.floor((fps * 60) / hi));
    const maxLag = Math.ceil((fps * 60) / lo);
    let bestWeighted = 0;
    let bestLag = 0;
    let bestCorrelation = 0;
    for (let lag = minLag; lag <= maxLag && lag < n / 2; lag++) {
      let sum = 0;
      for (let i = 0; i + lag < n; i++) sum += centered[i] * centered[i + lag];
      const correlation = sum / (n - lag) / energy; // −1..1
      const octavesFrom120 = Math.log2((60 * fps) / lag / 120);
      const weighted = correlation * Math.exp(-0.5 * (octavesFrom120 / 1.4) ** 2);
      if (weighted > bestWeighted) {
        bestWeighted = weighted;
        bestLag = lag;
        bestCorrelation = correlation;
      }
    }
    return bestLag ? { bpm: (60 * fps) / bestLag, confidence: Math.max(0, Math.min(1, bestCorrelation)) } : { bpm: 0, confidence: 0 };
  }

  /** Atajo que devuelve solo los BPM (0 si no hay pulso). */
  const estimateBPM = (env, fps, lo, hi) => estimateTempo(env, fps, lo, hi).bpm;

  // Perfiles de Krumhansl-Kessler: cuánto "pertenece" cada grado a una tonalidad mayor o menor.
  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function pearson(a, b) {
    const n = a.length;
    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - meanA) * (b[i] - meanB);
      da += (a[i] - meanA) ** 2;
      db += (b[i] - meanB) ** 2;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }

  /**
   * Tonalidad estimada (algoritmo de Krumhansl-Schmuckler): correlaciona el
   * cromagrama con los 24 perfiles mayores y menores rotados.
   * @returns {{tonic: number, minor: boolean, name: string, score: number} | null}
   */
  function detectKey(chromaValues) {
    if (!chromaValues.some((v) => v > 0)) return null;
    let best = null;
    for (let tonic = 0; tonic < 12; tonic++) {
      const rotated = chromaValues.map((_, i) => chromaValues[(i + tonic) % 12]);
      for (const minor of [false, true]) {
        const score = pearson(rotated, minor ? MINOR_PROFILE : MAJOR_PROFILE);
        if (!best || score > best.score) best = { tonic, minor, score };
      }
    }
    best.name = NOTE_NAMES[best.tonic] + (best.minor ? " menor" : " mayor");
    return best;
  }

  /** Afinador: nota temperada más cercana y desvío en cents (−50..+50). */
  function tuning(freq) {
    if (!(freq > 0)) return null;
    const midi = toMidi(freq);
    const nearest = Math.round(midi);
    return { note: noteName(freq), cents: (midi - nearest) * 100, target: 440 * 2 ** ((nearest - 69) / 12) };
  }

  // ───── Análisis offline (archivo completo) ─────

  /** FFT radix-2 en el lugar (re e im de longitud potencia de 2). */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const angle = (-2 * Math.PI) / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < len / 2; k++) {
          const c = Math.cos(angle * k);
          const s = Math.sin(angle * k);
          const u = i + k;
          const v = u + len / 2;
          const tr = re[v] * c - im[v] * s;
          const ti = re[v] * s + im[v] * c;
          re[v] = re[u] - tr;
          im[v] = im[u] - ti;
          re[u] += tr;
          im[u] += ti;
        }
      }
    }
  }

  const hannCache = {};
  /** Magnitudes lineales (|X| / N, ventana de Hann) de `size` muestras desde `start`. */
  function magnitudeSpectrum(samples, start, size) {
    const hann = (hannCache[size] ||= Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size)));
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = (samples[start + i] || 0) * hann[i];
    fft(re, im);
    const mag = new Float32Array(size / 2);
    for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]) / size;
    return mag;
  }

  /** Columna de espectrograma: `rows` valores 0..1 en escala logarítmica (fila 0 = grave). */
  function spectrumColumn(mag, sampleRate, fftSize, rows, minHz = 30, maxHz = 16000) {
    const top = Math.min(maxHz, sampleRate / 2);
    const column = new Float32Array(rows);
    for (let r = 0; r < rows; r++) {
      const freq = minHz * Math.exp((Math.log(top / minHz) * r) / rows);
      const bin = Math.min(mag.length - 1, Math.round((freq * fftSize) / sampleRate));
      const db = 20 * Math.log10(mag[bin] + 1e-12);
      column[r] = Math.max(0, Math.min(1, (db + 100) / 100));
    }
    return column;
  }

  const BAND_EDGES = [30, 100, 200, 400, 800, 1600, 3200, 6400, 12800];
  /** Vector para la autosimilitud: 12 notas + energía en 8 bandas logarítmicas (normalizada). */
  function featureVector(mag, sampleRate, fftSize) {
    const bandEnergy = [];
    for (let b = 0; b < 8; b++) {
      let sum = 0;
      const from = Math.ceil((BAND_EDGES[b] * fftSize) / sampleRate);
      const to = (BAND_EDGES[b + 1] * fftSize) / sampleRate;
      for (let i = from; i < to && i < mag.length; i++) sum += mag[i] * mag[i];
      bandEnergy.push(Math.log10(1 + sum * 1e4));
    }
    const max = Math.max(...bandEnergy) || 1;
    return [...chroma(mag, sampleRate, fftSize), ...bandEnergy.map((v) => v / max)];
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

  const api = {
    NOTE_NAMES,
    noteName,
    peakFreq,
    chroma,
    centroid,
    rms,
    bands,
    estimateTempo,
    estimateBPM,
    detectKey,
    tuning,
    selfSim,
    fft,
    magnitudeSpectrum,
    spectrumColumn,
    featureVector,
  };
  root.A = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

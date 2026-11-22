/**
 * Sinestesia · interfaz, audio y dibujo.
 * Depende de analysis.js (window.A). Script clásico (no módulo ES) para que
 * la página también funcione abriendo index.html directamente.
 */
(() => {
  "use strict";

  // ───────────────────────── Utilidades y constantes ─────────────────────────

  const $ = (id) => document.getElementById(id);
  const A = window.A;
  const noop = () => {};
  const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
  const setMessage = (text) => {
    $("msg").textContent = text || "";
  };

  const MIN_HZ = 30;
  const MAX_HZ = 16000;
  const SILENCE_RMS = 1e-4; // ≈ −80 dB: por debajo, nota y brillo se muestran como "—"
  const BG_COLOR = "#0b0d14";
  const LABEL_COLOR = "#9099b8";
  const FONT = "system-ui, 'Segoe UI', sans-serif";

  const PANELS = {
    spec: {
      title: "Espectro",
      desc: "Cuánta energía hay en cada frecuencia, en escala logarítmica. El marcador indica el pico y su nota.",
    },
    sg: {
      title: "Espectrograma",
      desc: "El sonido como imagen: el tiempo avanza a la derecha, las frecuencias agudas van arriba y el brillo es la intensidad.",
    },
    trail: {
      title: "Estela estéreo",
      desc: "Izquierda contra derecha con rastro que se desvanece. Un sonido mono dibuja una línea vertical; los tonos puros forman figuras.",
    },
    rad: {
      title: "Radial",
      desc: "El espectro enrollado en círculo, simétrico y giratorio, con estela.",
    },
    chroma: {
      title: "Notas",
      desc: "Cuánto suena cada una de las 12 notas, sin importar la octava. Ayuda a intuir la tonalidad.",
    },
    ssm: {
      title: "Autosimilitud",
      desc: "Compara cada instante con todos los demás (últimos ~80 s). Las diagonales claras son partes que se repiten.",
    },
  };

  const canvases = {};
  const contexts = {};
  for (const key in PANELS) {
    canvases[key] = $("c-" + key);
    contexts[key] = canvases[key].getContext("2d");
  }

  // ───────────────────────── Paletas ─────────────────────────

  /** HSL (h en grados, s y l en 0..1) → [r, g, b] en 0..255. */
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [channel(0), channel(8), channel(4)];
  }

  // `color(t)` da [h, s, l] para una intensidad t en 0..1; `accents` son los colores de la interfaz.
  const PALETTES = [
    { name: "Aurora", color: (t) => [250 - 190 * t, 0.9, 0.06 + 0.6 * t], accents: ["#ffb347", "#ff6f91", "#8a7dff"] },
    { name: "Fuego", color: (t) => [55 * t, 1, 0.04 + 0.58 * t], accents: ["#ffd23f", "#ff7a1a", "#e63946"] },
    { name: "Hielo", color: (t) => [190 + 45 * t, 0.8, 0.05 + 0.65 * t], accents: ["#7df9ff", "#4cc9f0", "#7b8cff"] },
  ];

  let colorTable = []; // 256 colores [r, g, b], de intensidad baja a alta
  let accents = PALETTES[0].accents;

  /** Aplica una paleta a todas las vistas, al fondo y a los acentos CSS (--a1..--a3). */
  function setPalette(index) {
    const palette = PALETTES[index];
    colorTable = Array.from({ length: 256 }, (_, k) => hslToRgb(...palette.color(k / 255)));
    accents = palette.accents;
    accents.forEach((color, j) => document.documentElement.style.setProperty("--a" + (j + 1), color));
  }

  const colorAt = (t) => "rgb(" + colorTable[Math.round(clamp(t) * 255)].join() + ")";

  setPalette(0);

  // ───────────────────────── Estado ─────────────────────────

  // Audio
  let audioCtx = null;
  let mixAnalyser, leftAnalyser, rightAnalyser, splitter;
  let source = null; // nodo conectado actualmente
  let fileSource = null; // MediaElementSource del <audio> (solo se puede crear una vez)
  let fileUrl = null; // URL del archivo actual, para liberarla al cambiar
  let currentStream = null; // MediaStream del micrófono o de la pestaña
  let stopDemo = noop;

  // Buffers del analizador (se recrean al cambiar la resolución FFT)
  let freqDb, magnitude, prevMagnitude, wave, waveLeft, waveRight;

  // Análisis
  const peakHold = []; // máximos recientes del espectro
  const chromaSmooth = new Array(12).fill(0);
  const features = []; // vectores para la autosimilitud
  const onsetEnvelope = []; // flujo espectral por cuadro
  const BAND_EDGES = [30, 100, 200, 400, 800, 1600, 3200, 6400, 12800];
  const timers = { thumbs: 0, feature: 0, beat: 0, tempo: 0, metrics: 0 };
  let frozen = false;
  let fps = 60;
  let bpm = 0;
  let lastFrameTime = 0;
  let level = 0; // volumen suavizado (lo usa el fondo)
  let beatFlash = 0;
  let trailHue = 0;
  let radialRotation = 0;
  let trailPersistence = +$("pers").value;
  let ssmDirty = false;

  // ───────────────────────── Fuentes de audio ─────────────────────────

  function setFftSize(size) {
    mixAnalyser.fftSize = leftAnalyser.fftSize = rightAnalyser.fftSize = size;
    const bins = mixAnalyser.frequencyBinCount;
    freqDb = new Float32Array(bins);
    magnitude = new Float32Array(bins);
    prevMagnitude = new Float32Array(bins);
    wave = new Float32Array(size);
    waveLeft = new Float32Array(size);
    waveRight = new Float32Array(size);
  }

  /** Crea el AudioContext y los analizadores la primera vez (requiere un gesto del usuario). */
  async function bootAudio() {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      mixAnalyser = audioCtx.createAnalyser();
      leftAnalyser = audioCtx.createAnalyser();
      rightAnalyser = audioCtx.createAnalyser();
      splitter = audioCtx.createChannelSplitter(2);
      splitter.connect(leftAnalyser, 0);
      splitter.connect(rightAnalyser, 1);
      mixAnalyser.smoothingTimeConstant = +$("sm").value;
      setFftSize(+$("fft").value);
    }
    await audioCtx.resume();
  }

  const stopStream = (stream) => stream.getTracks().forEach((track) => track.stop());

  /** Detiene la fuente actual (demo, micrófono, pestaña o archivo) y la desconecta. */
  function releaseSource(nextStream = null) {
    const stop = stopDemo;
    stopDemo = noop; // los osciladores solo se pueden detener una vez
    stop();
    if (source) {
      try {
        source.disconnect();
      } catch {}
    }
    source = null;
    if (currentStream && currentStream !== nextStream) stopStream(currentStream);
    currentStream = null;
  }

  /** Conecta una nueva fuente a los analizadores y reinicia el historial del análisis. */
  function useSource(node, { audible = false, stream = null } = {}) {
    releaseSource(stream);
    if (node !== fileSource) $("au").pause();
    currentStream = stream;
    source = node;
    node.connect(mixAnalyser);
    node.connect(splitter);
    if (audible) node.connect(audioCtx.destination);
    features.length = 0;
    onsetEnvelope.length = 0;
  }

  /** Avisa y libera la fuente si el usuario corta el micrófono o la captura desde el navegador. */
  function watchStreamEnd(stream, message) {
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (currentStream !== stream) return;
        releaseSource();
        setMessage(message);
      };
    });
  }

  $("mic").onclick = async () => {
    try {
      await bootAudio();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      useSource(audioCtx.createMediaStreamSource(stream), { stream });
      watchStreamEnd(stream, "El micrófono se desconectó. Elegí otra fuente para seguir.");
      setMessage("Escuchando el micrófono. Usá auriculares para evitar acople.");
    } catch (err) {
      setMessage("No se pudo usar el micrófono: " + err.message);
    }
  };

  $("filebtn").onclick = () => $("file").click();

  $("file").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await bootAudio();
      const player = $("au");
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(file);
      player.src = fileUrl;
      fileSource ||= audioCtx.createMediaElementSource(player);
      useSource(fileSource, { audible: true });
      await player.play();
      setMessage("Reproduciendo " + file.name);
    } catch (err) {
      setMessage("No se pudo reproducir el archivo: " + err.message);
    } finally {
      event.target.value = ""; // permite volver a elegir el mismo archivo
    }
  };

  $("tab").onclick = async () => {
    try {
      await bootAudio();
      const capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTracks = capture.getAudioTracks();
      capture.getVideoTracks().forEach((track) => track.stop());
      if (!audioTracks.length) throw new Error("elegí una pestaña y marcá “compartir audio”");
      const stream = new MediaStream(audioTracks);
      useSource(audioCtx.createMediaStreamSource(stream), { stream });
      watchStreamEnd(stream, "La captura de la pestaña se detuvo. Elegí otra fuente para seguir.");
      setMessage("Capturando el audio de la pestaña.");
    } catch (err) {
      setMessage("No se pudo capturar la pestaña: " + err.message);
    }
  };

  /** Demostración: arpegio estéreo (dos osciladores) con bombo a 120 BPM. */
  $("demo").onclick = async () => {
    try {
      await bootAudio();
      const output = audioCtx.createGain();
      output.gain.value = 0.22;

      const makeVoice = (type, detune, pan) => {
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        const panner = audioCtx.createStereoPanner();
        osc.type = type;
        osc.detune.value = detune;
        env.gain.value = 0;
        panner.pan.value = pan;
        osc.connect(env);
        env.connect(panner);
        panner.connect(output);
        osc.start();
        return { osc, env };
      };

      const low = makeVoice("sawtooth", -7, -0.8);
      const high = makeVoice("triangle", 7, 0.8);
      const ARPEGGIO = [0, 3, 7, 10, 12, 10, 7, 3]; // semitonos
      const ROOTS = [220, 174.61, 196, 130.81]; // La, Fa, Sol, Do
      let step = 0;
      useSource(output, { audible: true });

      const playKick = (t) => {
        const kick = audioCtx.createOscillator();
        const kickGain = audioCtx.createGain();
        kick.frequency.setValueAtTime(140, t);
        kick.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        kickGain.gain.setValueAtTime(1, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        kick.connect(kickGain);
        kickGain.connect(output);
        kick.start(t);
        kick.stop(t + 0.3);
      };

      const timer = setInterval(() => {
        const t = audioCtx.currentTime;
        const note = step % 8;
        const freq = ROOTS[Math.floor(step / 8) % 4] * 2 ** (ARPEGGIO[note] / 12);
        for (const voice of [low, high]) {
          voice.osc.frequency.setValueAtTime(freq * (voice === high ? 2 : 1), t);
          voice.env.gain.cancelScheduledValues(t);
          voice.env.gain.setValueAtTime(0.5, t);
          voice.env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        }
        if (note % 2 === 0) playKick(t);
        step++;
      }, 250);

      stopDemo = () => {
        clearInterval(timer);
        low.osc.stop();
        high.osc.stop();
      };
      setMessage("Sonido de demostración: arpegio estéreo y bombo a 120 BPM.");
    } catch (err) {
      setMessage("No se pudo iniciar la demo: " + err.message);
    }
  };

  // ───────────────────────── Controles ─────────────────────────

  $("sm").oninput = () => {
    if (mixAnalyser) mixAnalyser.smoothingTimeConstant = +$("sm").value;
  };
  $("pers").oninput = () => {
    trailPersistence = +$("pers").value;
  };
  $("fft").onchange = () => {
    if (mixAnalyser) setFftSize(+$("fft").value);
  };
  $("pal").onchange = () => {
    setPalette(+$("pal").value);
    ssmDirty = true;
    drawSelfSimilarity();
    drawThumbnails();
  };
  $("frz").onclick = () => {
    frozen = !frozen;
    $("frz").classList.toggle("on", frozen);
    $("frz").textContent = frozen ? "Reanudar análisis" : "Congelar análisis";
  };

  // ───────────────────────── Dibujo de las vistas ─────────────────────────

  for (const key in PANELS) {
    const g = contexts[key];
    const { width, height } = canvases[key];
    g.fillStyle = BG_COLOR;
    g.fillRect(0, 0, width, height);
    g.fillStyle = "#4a5378";
    g.font = "16px " + FONT;
    g.textAlign = "center";
    g.fillText("Esperando audio…", width / 2, height / 2);
    g.textAlign = "start";
  }

  /** dB del analizador (−100..0) → 0..1. */
  const dbToUnit = (db) => clamp((db + 100) / 100);
  /** Frecuencia de la posición `i` de `count` en escala logarítmica entre MIN_HZ y `maxHz`. */
  const logFreq = (i, count, maxHz) => MIN_HZ * Math.exp((Math.log(maxHz / MIN_HZ) * i) / count);
  /** Valor 0..1 del espectro en una frecuencia. */
  const levelAt = (freq, sampleRate, fftSize) =>
    dbToUnit(freqDb[Math.min(freqDb.length - 1, Math.round((freq * fftSize) / sampleRate))]);
  const maxFreq = (sampleRate) => Math.min(MAX_HZ, sampleRate / 2);

  function clearCanvas(g, canvas) {
    g.fillStyle = BG_COLOR;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** Oscurece el cuadro anterior según la persistencia y deja el modo aditivo para dibujar encima. */
  function fadeCanvas(g, width, height) {
    g.globalCompositeOperation = "source-over";
    g.fillStyle = `rgba(10,12,19,${1 - trailPersistence})`;
    g.fillRect(0, 0, width, height);
    g.globalCompositeOperation = "lighter";
  }

  function drawSpectrum(sampleRate, fftSize, peak) {
    const canvas = canvases.spec;
    const g = contexts.spec;
    const W = canvas.width;
    const H = canvas.height;
    const fmax = maxFreq(sampleRate);
    const logRange = Math.log(fmax / MIN_HZ);
    const xOf = (freq) => (Math.log(freq / MIN_HZ) / logRange) * W;
    clearCanvas(g, canvas);

    // Grilla de referencia
    g.font = "12px " + FONT;
    g.fillStyle = LABEL_COLOR;
    g.strokeStyle = "#1c2238";
    for (const freq of [100, 1000, 10000]) {
      const x = xOf(freq);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
      g.fillText(freq >= 1000 ? freq / 1000 + " kHz" : freq + " Hz", x + 4, H - 6);
    }

    // Barras y marcas de máximo reciente
    for (let x = 0, j = 0; x < W; x += 3, j++) {
      const value = levelAt(logFreq(x, W, fmax), sampleRate, fftSize);
      const barHeight = value * (H - 24);
      peakHold[j] = Math.max(value, (peakHold[j] || 0) - 0.006);
      g.fillStyle = colorAt(value);
      g.fillRect(x, H - 18 - barHeight, 2, barHeight);
      g.fillStyle = "#ffffff99";
      g.fillRect(x, H - 20 - peakHold[j] * (H - 24), 2, 2);
    }

    // Marcador del pico
    if (peak > 0) {
      const x = xOf(peak);
      g.fillStyle = accents[0];
      g.fillText(A.noteName(peak) + " · " + Math.round(peak) + " Hz", Math.min(x + 6, W - 110), 16);
      g.fillRect(x, 20, 1, H - 40);
    }
  }

  /** Desplaza la imagen un píxel a la izquierda y dibuja la columna actual a la derecha. */
  function drawSpectrogram(sampleRate, fftSize) {
    const canvas = canvases.sg;
    const g = contexts.sg;
    const W = canvas.width;
    const H = canvas.height;
    const fmax = maxFreq(sampleRate);
    g.drawImage(canvas, -1, 0);
    const column = g.createImageData(1, H);
    for (let y = 0; y < H; y++) {
      const value = levelAt(logFreq(H - y, H, fmax), sampleRate, fftSize);
      const [r, gr, b] = colorTable[Math.round(value * 255)];
      column.data[y * 4] = r;
      column.data[y * 4 + 1] = gr;
      column.data[y * 4 + 2] = b;
      column.data[y * 4 + 3] = 255;
    }
    g.putImageData(column, W - 1, 0);
  }

  /** Goniómetro: lateral (L−R) en X, central (L+R) en Y, con ganancia automática. */
  function drawTrail(rms) {
    const canvas = canvases.trail;
    const g = contexts.trail;
    const W = canvas.width;
    const H = canvas.height;
    fadeCanvas(g, W, H);
    trailHue += 0.5;
    const gain = Math.min(6, 0.3 / (rms + 0.03));
    g.strokeStyle = colorAt(Math.min(1, 0.6 + 0.4 * Math.sin(trailHue * 0.03) ** 2 + beatFlash * 0.2));
    g.lineWidth = 1.2 + beatFlash * 2;
    g.beginPath();
    for (let i = 0; i < waveLeft.length; i += 2) {
      const side = (waveLeft[i] - waveRight[i]) * Math.SQRT1_2;
      const mid = (waveLeft[i] + waveRight[i]) * Math.SQRT1_2;
      const x = W / 2 + side * W * 0.45 * gain;
      const y = H / 2 - mid * H * 0.45 * gain;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.globalCompositeOperation = "source-over";
  }

  /** Espectro en círculo, simétrico, que gira más rápido con los graves. */
  function drawRadial(sampleRate, fftSize, bass) {
    const canvas = canvases.rad;
    const g = contexts.rad;
    const W = canvas.width;
    const R = W / 2;
    const fmax = maxFreq(sampleRate);
    const SPOKES = 150;
    fadeCanvas(g, W, canvas.height);
    radialRotation += 0.004 + bass * 0.03;
    g.lineWidth = 2;
    for (let k = 0; k < SPOKES; k++) {
      const value = levelAt(logFreq(k, SPOKES, fmax), sampleRate, fftSize);
      const inner = R * 0.3;
      const outer = inner + value * R * 0.62;
      const angle = (k / SPOKES) * Math.PI + radialRotation;
      g.strokeStyle = colorAt(value);
      for (const side of [1, -1]) {
        const cos = Math.cos(side * angle);
        const sin = Math.sin(side * angle);
        g.beginPath();
        g.moveTo(R + cos * inner, R + sin * inner);
        g.lineTo(R + cos * outer, R + sin * outer);
        g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  function drawChroma(dominant) {
    const canvas = canvases.chroma;
    const g = contexts.chroma;
    const W = canvas.width;
    const H = canvas.height;
    const slot = W / 12;
    clearCanvas(g, canvas);
    g.font = "13px " + FONT;
    g.textAlign = "center";
    chromaSmooth.forEach((value, i) => {
      const barHeight = value * (H - 40);
      g.fillStyle = i === dominant && value > 0.5 ? accents[0] : colorAt(0.25 + value * 0.6);
      g.fillRect(i * slot + 6, H - 26 - barHeight, slot - 12, barHeight);
      g.fillStyle = LABEL_COLOR;
      g.fillText(A.NOTE_NAMES[i], i * slot + slot / 2, H - 8);
    });
    g.textAlign = "start";
  }

  const ssmBuffer = document.createElement("canvas"); // matriz a 1 px por celda, luego se escala

  /** Redibuja la autosimilitud si hay datos nuevos y la vista se ve. */
  function drawSelfSimilarity() {
    if (!ssmDirty || !isShown("ssm") || features.length < 8) return;
    ssmDirty = false;
    const n = features.length;
    const matrix = A.selfSim(features);
    ssmBuffer.width = ssmBuffer.height = n;
    const bufferCtx = ssmBuffer.getContext("2d");
    const image = bufferCtx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const contrast = clamp(Math.max(0, matrix[i]) ** 5); // realza las zonas muy parecidas
      const [r, g, b] = colorTable[Math.round(contrast * 255)];
      image.data[i * 4] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
      image.data[i * 4 + 3] = 255;
    }
    bufferCtx.putImageData(image, 0, 0);
    const g = contexts.ssm;
    g.imageSmoothingEnabled = false;
    g.drawImage(ssmBuffer, 0, 0, canvases.ssm.width, canvases.ssm.height);
  }

  // ───────────────────────── Bucle de análisis ─────────────────────────

  /** Vector de características: 12 notas + energía en 8 bandas logarítmicas (normalizada). */
  function featureVector(chromaValues, sampleRate, fftSize) {
    const bandEnergy = [];
    for (let b = 0; b < 8; b++) {
      let sum = 0;
      const from = Math.ceil((BAND_EDGES[b] * fftSize) / sampleRate);
      const to = (BAND_EDGES[b + 1] * fftSize) / sampleRate;
      for (let i = from; i < to && i < magnitude.length; i++) sum += magnitude[i] * magnitude[i];
      bandEnergy.push(Math.log10(1 + sum * 1e4));
    }
    const max = Math.max(...bandEnergy) || 1;
    return [...chromaValues, ...bandEnergy.map((v) => v / max)];
  }

  function updateMetrics(rms, peak, bandShares, sampleRate, fftSize) {
    const silent = rms < SILENCE_RMS;
    $("m-rms").textContent = rms > 1e-5 ? (20 * Math.log10(rms)).toFixed(1) + " dB" : "−∞";
    $("m-note").textContent = !silent && peak ? A.noteName(peak) + " · " + Math.round(peak) + " Hz" : "—";
    $("m-cen").textContent = silent ? "—" : Math.round(A.centroid(magnitude, sampleRate, fftSize)) + " Hz";
    $("m-bpm").textContent = bpm ? Math.round(bpm) : "—";
    bandShares.forEach((share, i) => {
      $("b" + i).style.width = Math.max(3, silent ? 0 : share * 100) + "%";
    });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!mixAnalyser || frozen) return;

    mixAnalyser.getFloatFrequencyData(freqDb);
    mixAnalyser.getFloatTimeDomainData(wave);
    leftAnalyser.getFloatTimeDomainData(waveLeft);
    rightAnalyser.getFloatTimeDomainData(waveRight);

    const sampleRate = audioCtx.sampleRate;
    const fftSize = mixAnalyser.fftSize;
    const dt = Math.max(1, now - (lastFrameTime || now - 16));
    lastFrameTime = now;
    fps = fps * 0.95 + (0.05 * 1000) / dt;

    // Magnitudes lineales y flujo espectral positivo (30 Hz – 4 kHz) para detectar golpes
    const fluxFrom = Math.ceil((30 * fftSize) / sampleRate);
    const fluxTo = Math.floor((4000 * fftSize) / sampleRate);
    let flux = 0;
    for (let i = 0; i < freqDb.length; i++) {
      magnitude[i] = 10 ** (freqDb[i] / 20);
      if (i >= fluxFrom && i <= fluxTo) flux += Math.max(0, magnitude[i] - prevMagnitude[i]);
    }
    prevMagnitude.set(magnitude);
    onsetEnvelope.push(flux);
    if (onsetEnvelope.length > 600) onsetEnvelope.shift();

    const rms = A.rms(wave);
    const peak = A.peakFreq(magnitude, sampleRate, fftSize);
    const chromaValues = A.chroma(magnitude, sampleRate, fftSize);
    const bandShares = A.bands(magnitude, sampleRate, fftSize);
    chromaValues.forEach((v, i) => (chromaSmooth[i] = chromaSmooth[i] * 0.7 + v * 0.3));

    // Golpe: el flujo supera 1,5 veces el promedio reciente
    const recent = onsetEnvelope.slice(-60);
    const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (flux > recentMean * 1.5 + 1e-3 && now - timers.beat > 200 && rms > 0.003) {
      beatFlash = 1;
      timers.beat = now;
    }
    beatFlash *= 0.92;

    if (now - timers.feature > 400 && rms > 0.002) {
      timers.feature = now;
      features.push(featureVector(chromaValues, sampleRate, fftSize));
      if (features.length > 200) features.shift();
      ssmDirty = true;
      drawSelfSimilarity();
    }
    if (now - timers.tempo > 500) {
      timers.tempo = now;
      bpm = A.estimateBPM(onsetEnvelope.slice(-Math.round(fps * 8)), fps);
    }
    if (now - timers.metrics > 200) {
      timers.metrics = now;
      updateMetrics(rms, peak, bandShares, sampleRate, fftSize);
    }
    $("dot").style.opacity = beatFlash;
    level = level * 0.9 + rms * 0.1;

    // El espectrograma se dibuja siempre para no perder historia (es una sola columna);
    // el resto solo si su tarjeta está en pantalla o su ventana está abierta.
    drawSpectrogram(sampleRate, fftSize);
    if (isShown("spec")) drawSpectrum(sampleRate, fftSize, peak);
    if (isShown("trail")) drawTrail(rms);
    if (isShown("rad")) drawRadial(sampleRate, fftSize, bandShares[0]);
    if (isShown("chroma")) drawChroma(chromaValues.indexOf(1));

    if (now - timers.thumbs > 150) {
      timers.thumbs = now;
      drawThumbnails();
    }
  }

  // ───────────────────────── Tarjetas y ventana ─────────────────────────

  const dialog = $("dlg");
  const thumbContexts = {};
  const visibleCards = new Set(Object.keys(PANELS)); // sin IntersectionObserver se dibuja todo
  let openPanel = null;

  /** ¿La vista está a la vista del usuario? (ventana abierta o tarjeta en pantalla) */
  function isShown(key) {
    return openPanel ? openPanel === key : visibleCards.has(key);
  }

  $("cards").innerHTML = Object.entries(PANELS)
    .map(
      ([key, panel]) =>
        `<button class="card" type="button" data-k="${key}">` +
        `<canvas width="320" height="180"></canvas>` +
        `<h3>${panel.title}</h3><p>${panel.desc}</p><b>Abrir →</b></button>`
    )
    .join("");

  const cards = document.querySelectorAll(".card");
  cards.forEach((card) => {
    thumbContexts[card.dataset.k] = card.querySelector("canvas").getContext("2d");
    card.onclick = () => openView(card.dataset.k);
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = entry.target.dataset.k;
        if (entry.isIntersecting) visibleCards.add(key);
        else visibleCards.delete(key);
      }
      drawSelfSimilarity();
    });
    cards.forEach((card) => observer.observe(card));
  }

  /** Copia cada vista visible, escalada, a la miniatura de su tarjeta. */
  function drawThumbnails() {
    if (openPanel) return; // las tarjetas quedan tapadas por la ventana
    for (const key in thumbContexts) {
      if (!visibleCards.has(key)) continue;
      const canvas = canvases[key];
      const g = thumbContexts[key];
      const scale = Math.min(320 / canvas.width, 180 / canvas.height);
      const w = canvas.width * scale;
      const h = canvas.height * scale;
      g.fillStyle = BG_COLOR;
      g.fillRect(0, 0, 320, 180);
      g.drawImage(canvas, (320 - w) / 2, (180 - h) / 2, w, h);
    }
  }

  /** Abre la vista en grande: mueve su canvas y los controles a la ventana. */
  function openView(key) {
    openPanel = key;
    const canvas = canvases[key];
    $("dt").textContent = PANELS[key].title;
    $("dd").textContent = PANELS[key].desc;
    canvas.style.width = canvas.width > canvas.height ? "100%" : "";
    $("dv").appendChild(canvas);
    $("dctl").appendChild($("ctl"));
    drawSelfSimilarity();
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  dialog.onclose = () => {
    const canvas = canvases[openPanel];
    canvas.style.width = "";
    $("stage").appendChild(canvas);
    $("msg").before($("ctl"));
    openPanel = null;
    drawSelfSimilarity();
    drawThumbnails();
  };

  $("dx").onclick = () => dialog.close();
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close(); // clic en el fondo
  };

  $("dpng").onclick = () => {
    const key = openPanel;
    canvases[key].toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "sinestesia-" + key + ".png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
  };

  drawThumbnails();

  // ───────────────────────── Fondo ─────────────────────────
  // Ecualizador tenue que sigue el espectro real; sin audio "respira" con un movimiento lento.

  const bgCanvas = $("bg");
  const bg = bgCanvas.getContext("2d");
  const BG_BARS = 72;
  const barHeights = new Array(BG_BARS).fill(0);
  const reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const idleAmplitude = reducedMotion ? 0.4 : 1;
  let bgWidth = 0;
  let bgHeight = 0;
  let bgTime = 0;
  let bgLastDraw = 0;

  function resizeBackground() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    bgWidth = bgCanvas.width = innerWidth * ratio;
    bgHeight = bgCanvas.height = innerHeight * ratio;
  }

  function drawBackground() {
    bg.clearRect(0, 0, bgWidth, bgHeight);
    const live = mixAnalyser && !frozen && level > 2e-4;
    const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
    const fftSize = mixAnalyser ? mixAnalyser.fftSize : 4096;
    const fmax = maxFreq(sampleRate);
    const barWidth = bgWidth / BG_BARS;

    for (let i = 0; i < BG_BARS; i++) {
      const idle = (0.16 + 0.09 * Math.sin(bgTime * 0.9 + i * 0.32) + 0.06 * Math.sin(bgTime * 0.55 + i * 0.85)) * idleAmplitude;
      const fromAudio = live ? levelAt(logFreq(i, BG_BARS, fmax), sampleRate, fftSize) * 1.1 : 0;
      barHeights[i] += (Math.max(idle, fromAudio) - barHeights[i]) * 0.18;

      const h = barHeights[i] * bgHeight * 0.55;
      const [r, g, b] = colorTable[Math.round(110 + (i / BG_BARS) * 145)];
      const gradient = bg.createLinearGradient(0, bgHeight - h, 0, bgHeight);
      gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},.34)`);
      bg.fillStyle = gradient;
      bg.fillRect(i * barWidth + 1, bgHeight - h, barWidth - 2, h);
      bg.fillStyle = `rgba(${r},${g},${b},.6)`;
      bg.fillRect(i * barWidth + 1, bgHeight - h - 2, barWidth - 2, 2);
    }
  }

  function backgroundLoop(now) {
    requestAnimationFrame(backgroundLoop);
    if (document.hidden || now - bgLastDraw < 33) return; // ~30 fps
    bgLastDraw = now;
    bgTime += 0.033;
    drawBackground();
  }

  resizeBackground();
  addEventListener("resize", () => {
    resizeBackground();
    drawBackground();
  });
  drawBackground();
  requestAnimationFrame(backgroundLoop);
  requestAnimationFrame(frame);
})();

// Prueba de humo: carga la página en jsdom con AudioContext, canvas y dispositivos simulados y recorre todas las funciones.
const { JSDOM } = require("jsdom"), fs = require("fs"), a = require("assert");
const w = new JSDOM(fs.readFileSync("index.html", "utf8").replace(/<script[^>]*><\/script>/g, ""), { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" }).window, q = [];
const seen = new Set(); let K = 0, stops = 0, killed = 0, dl = 0, fills = 0, scrolls = 0, lastDownload = "";
w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (o, k) => k === "createLinearGradient" ? () => ({ addColorStop() { } }) : k === "createImageData" ? (x, y) => ({ data: new Uint8ClampedArray(x * y * 4) }) : k === "fillRect" ? () => { fills++ } : k === "drawImage" ? (img, x) => { if (x === -1) scrolls++ } : k in o ? o[k] : () => { }, set: (o, k, v) => ((k === "fillStyle" || k === "strokeStyle") && typeof v === "string" && seen.add(v), o[k] = v, true) });
w.HTMLCanvasElement.prototype.toBlob = function (f) { f(new w.Blob(["x"])) };
w.HTMLCanvasElement.prototype.captureStream = () => ({ addTrack() { }, getVideoTracks: () => [{ stop() { } }] });
w.MediaRecorder = class { constructor() { this.mimeType = "video/webm" } static isTypeSupported() { return true } start() { } stop() { this.ondataavailable({ data: new w.Blob(["v"]) }); this.onstop() } };
const P = () => ({ value: 0, setValueAtTime() { }, linearRampToValueAtTime() { }, exponentialRampToValueAtTime() { }, cancelScheduledValues() { } }), N = () => ({ connect() { }, disconnect() { } });
// Archivo "decodificado": 10 s de un acorde de La menor (La-Do-Mi).
const SR = 44100, chord = Float32Array.from({ length: SR * 10 }, (_, i) => [220, 261.63, 329.63].reduce((s, f) => s + .2 * Math.sin(2 * Math.PI * f * i / SR), 0));
w.AudioContext = class {
    constructor() { this.sampleRate = 44100; this.currentTime = 0; this.destination = N() } resume() { return Promise.resolve() } createGain() { return { ...N(), gain: P() } } createOscillator() { return { ...N(), frequency: P(), detune: P(), start() { }, stop() { if (this.done) throw new Error("InvalidStateError: oscilador ya detenido"); this.done = 1; stops++ } } } createStereoPanner() { return { ...N(), pan: P() } } createChannelSplitter() { return N() } createMediaStreamSource() { return N() } createMediaElementSource() { return N() }
    createMediaStreamDestination() { return { ...N(), stream: { getAudioTracks: () => [{}] } } }
    decodeAudioData() { return Promise.resolve({ sampleRate: SR, duration: 10, length: chord.length, numberOfChannels: 1, getChannelData: () => chord }) }
    createAnalyser() { return { ...N(), fftSize: 4096, smoothingTimeConstant: 0, get frequencyBinCount() { return this.fftSize / 2 }, getFloatFrequencyData(x) { K++; if (w.__silent) { x.fill(-140); return } const on = K % 15 < 2; x.fill(-90); x[40] = on ? -10 : -70; x[39] = x[41] = on ? -25 : -80 }, getFloatTimeDomainData(x) { for (let i = 0; i < x.length; i++)x[i] = w.__silent ? 0 : .3 * Math.sin(i * .06) } } }
};
w.MediaStream = class { constructor(t) { this.t = t } getTracks() { return this.t } };
let revoked = 0, picks = 0; w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => { revoked++ }; w.HTMLInputElement.prototype.click = function () { if (this.type === "file") picks++ }; w.HTMLMediaElement.prototype.pause = () => { }; w.HTMLMediaElement.prototype.play = () => Promise.resolve();
w.HTMLAnchorElement.prototype.click = function () { dl++; lastDownload = this.download; a.ok(/^sinestesia-.*\.(png|webm)$/.test(this.download), this.download) };
const DP = w.HTMLDialogElement || w.HTMLElement; DP.prototype.showModal = function () { this.open = true }; DP.prototype.close = function () { if (!this.open) return; this.open = false; this.dispatchEvent(new w.Event("close")) };
w.localStorage.setItem("sinestesia:ajustes", JSON.stringify({ sm: "0.6" })); // ajuste guardado de una visita anterior
w.requestAnimationFrame = f => q.push(f); w.eval(fs.readFileSync("analysis.js", "utf8")); w.eval(fs.readFileSync("app.js", "utf8"));
const d = w.document, G = id => d.getElementById(id), g = id => G(id).textContent, tick = () => new Promise(r => setTimeout(r, 20)); let t = 0; const run = n => { for (let i = 0; i < n; i++) { const f = q.shift(); t += 16.7; f && f(t) } };
const key = k => d.body.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));
const drop = file => { const e = new w.Event("drop", { bubbles: true, cancelable: true }); Object.defineProperty(e, "dataTransfer", { value: { files: [file] } }); d.dispatchEvent(e) };
Object.defineProperty(G("au"), "currentTime", { value: 0, writable: true });
(async () => {
    a.ok(!G("bgt"), "el botón de animación ya no existe"); a.ok(g("msg").includes("demostración"));
    a.strictEqual(G("sm").value, "0.6", "se cargan los ajustes guardados");
    G("mic").click(); await tick(); a.ok(g("msg").startsWith("No se pudo usar el micrófono"), g("msg"));
    Object.defineProperty(w.navigator, "mediaDevices", { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() { killed++ } }] }), getDisplayMedia: async () => ({ getAudioTracks: () => w.__aud || [], getVideoTracks: () => [{ stop() { } }] }) } });
    G("mic").click(); await tick(); a.ok(g("msg").includes("Escuchando el micrófono"), g("msg"));
    G("tab").click(); await tick(); a.ok(g("msg").includes("No se pudo capturar la pestaña"), g("msg"));
    w.__aud = [{ stop() { killed++ } }]; G("tab").click(); await tick(); a.ok(g("msg").includes("Capturando"), g("msg")); a.ok(killed >= 1, "cambiar de fuente detiene el micrófono");
    await G("file").onchange({ target: { files: [{ name: "cancion.mp3" }] } }); await tick(); a.ok(g("msg").includes("cancion.mp3"), g("msg"));
    G("demo").click(); await tick(); a.ok(g("msg").includes("demostración") && g("msg").includes("120")); run(1200);
    a.ok(g("m-note").startsWith("La4"), g("m-note")); a.ok(g("m-rms").includes("dB")); a.ok(g("m-cen").endsWith("Hz"));
    const bpm = +g("m-bpm"); a.ok(bpm >= 115 && bpm <= 125, "tempo " + g("m-bpm")); a.ok(g("m-bpmc").startsWith("confianza"), "confianza del tempo"); a.ok(G("b0").style.width && G("b2").style.width); a.ok(fills > 1000, "el fondo y las vistas dibujan");
    a.ok(g("m-key").startsWith("La"), "tonalidad en vivo: " + g("m-key"));
    seen.clear(); run(150); const S0 = new Set(seen), R = () => w.document.documentElement.style.getPropertyValue("--a1"); a.strictEqual(R(), "#ffb347");
    const fft = G("fft"); fft.value = "8192"; fft.dispatchEvent(new w.Event("change")); G("pal").value = "1"; G("pal").dispatchEvent(new w.Event("change")); a.strictEqual(R(), "#ffd23f", "la paleta cambia los acentos"); seen.clear(); G("sm").value = ".5"; G("sm").dispatchEvent(new w.Event("input")); run(150); const S1 = [...seen]; a.ok(S1.length > 20 && S1.filter(x => S0.has(x)).length < S1.length / 2, "la paleta cambia los colores dibujados"); G("pal").value = "2"; G("pal").dispatchEvent(new w.Event("change")); a.strictEqual(R(), "#7df9ff"); run(10);
    const saved = JSON.parse(w.localStorage.getItem("sinestesia:ajustes")); a.deepStrictEqual([saved.pal, saved.fft, +saved.sm], ["2", "8192", .5], "se guardan los ajustes");
    G("frz").click(); const k0 = K; run(20); a.strictEqual(K, k0, "congelado no analiza"); G("frz").click(); run(20); a.ok(K > k0);
    const TITLES = ["Espectro", "Espectrograma", "Estela estéreo", "Radial", "Notas", "Autosimilitud", "Afinador", "Canción completa"];
    const cards = d.querySelectorAll(".card"); a.deepStrictEqual([...cards].map(c => c.querySelector("h3").textContent), TITLES); a.ok([...cards].every(c => c.querySelector("p").textContent.length > 30));
    for (const c of cards) { c.click(); a.ok(G("dlg").open); a.strictEqual(g("dt"), c.querySelector("h3").textContent); a.ok(G("dv").querySelector("canvas")); a.ok(G("dctl").contains(G("ctl"))); run(5); G("dpng").click(); G("dx").click(); a.ok(!G("dlg").open); a.strictEqual(G("stage").querySelectorAll("canvas").length, 8); a.ok(!G("dctl").contains(G("ctl"))) }
    a.strictEqual(dl, 8); cards[0].click(); G("dlg").onclick({ target: G("dlg") }); a.ok(!G("dlg").open, "el fondo de la ventana la cierra");
    // Atajos de teclado
    key("f"); a.strictEqual(g("frz"), "Reanudar análisis", "F congela"); key(" "); a.strictEqual(g("frz"), "Congelar análisis", "Espacio reanuda");
    key("7"); a.ok(G("dlg").open && g("dt") === "Afinador", "7 abre el afinador"); run(10); key("2"); a.strictEqual(g("dt"), "Espectrograma", "2 cambia de vista");
    const dl0 = dl; key("e"); a.strictEqual(dl, dl0 + 1, "E exporta");
    // Grabación de video (atajo G) y detención al cerrar la ventana
    key("g"); a.ok(g("msg").includes("Grabando"), g("msg")); a.strictEqual(g("drec"), "Detener grabación"); run(5); key("g"); a.ok(lastDownload === "sinestesia-sg.webm", lastDownload); a.ok(g("msg").includes("Video guardado"));
    G("drec").click(); G("dx").click(); a.strictEqual(lastDownload, "sinestesia-sg.webm"); a.strictEqual(g("drec"), "Grabar video", "cerrar la ventana detiene la grabación");
    const s0 = stops; G("mic").click(); await tick(); a.ok(stops > s0, "la demo se detiene al cambiar de fuente");
    G("tab").click(); await tick(); a.ok(g("msg").includes("Capturando"), "demo → mic → pestaña no debe volver a detener la demo: " + g("msg"));
    w.__aud[0].onended(); a.ok(g("msg").includes("se detuvo"), "aviso al cortar la captura: " + g("msg"));
    G("filebtn").click(); a.strictEqual(picks, 1, "el botón de archivo abre el selector");
    const r0 = revoked; await G("file").onchange({ target: { files: [{ name: "otra.mp3" }] } }); a.ok(revoked > r0, "se libera la URL del archivo anterior");
    w.__silent = true; run(40); a.strictEqual(g("m-cen"), "—", "en silencio el brillo muestra —"); a.strictEqual(g("m-note"), "—", "en silencio la nota muestra —"); w.__silent = false;
    // Arrastrar y soltar
    d.dispatchEvent(new w.Event("dragenter", { bubbles: true })); a.ok(d.body.classList.contains("dragging")); d.dispatchEvent(new w.Event("dragleave", { bubbles: true })); a.ok(!d.body.classList.contains("dragging"));
    drop({ name: "notas.txt", type: "text/plain" }); a.ok(g("msg").includes("no parece"), g("msg"));
    drop({ name: "acorde.wav", type: "audio/wav", arrayBuffer: async () => new ArrayBuffer(8) });
    // Análisis de la canción completa
    for (let i = 0; i < 300 && !g("msg").includes("analizada"); i++)await tick();
    a.ok(g("msg").includes("acorde.wav") && g("msg").includes("La menor"), "canción analizada: " + g("msg"));
    run(20); a.strictEqual(g("m-key"), "La menor"); a.strictEqual(g("m-keys"), "de toda la canción");
    key("8"); a.strictEqual(g("dt"), "Canción completa"); run(5); G("c-song").onclick({ clientX: 480 }); a.strictEqual(G("au").currentTime, 5, "tocar la canción salta a ese momento");
    key("6"); run(5); G("c-ssm").onclick({ clientX: 120 }); a.strictEqual(G("au").currentTime, 2.5, "tocar la autosimilitud salta a ese momento"); G("dx").click();
    // Al terminar el audio queda la imagen final (no se redibuja en silencio)
    G("au").onended(); a.ok(g("msg").includes("terminó"), g("msg"));
    w.__silent = true; const sc = scrolls; run(30); a.strictEqual(scrolls, sc, "en silencio el espectrograma no avanza"); w.__silent = false; run(5); a.ok(scrolls > sc, "con sonido vuelve a avanzar");
    console.log("smoke OK"); process.exit(0)
})().catch(e => { console.error(e); process.exit(1) });

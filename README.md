# Sinestesia · laboratorio de audio

Convierte sonido en imagen y lo analiza desde varios puntos de vista a la vez: frecuencias, tiempo, estéreo, notas, ritmo y repeticiones. Es una página estática en HTML + CSS + JavaScript puro (Web Audio API y canvas): sin dependencias, sin backend, sin base de datos y sin red. **El audio nunca sale de tu navegador.**

## Requisitos
- Un navegador moderno (Chrome, Edge, Firefox o Safari recientes). La captura del audio de una pestaña solo funciona en navegadores basados en Chromium.
- Para usar el micrófono o la captura de pestaña, la página debe abrirse por `https://` o `http://localhost`. Abrir `index.html` directamente (`file://`) sirve para la demostración y los archivos, pero algunos navegadores bloquean el micrófono.
- Para correr los tests: Node.js 18 o superior (`npm install` instala `jsdom` para la prueba de humo).

## Cómo correrlo
1. Cloná el repositorio (o descargalo como zip desde GitHub).
2. Desde la carpeta ejecutá `npm start` (equivale a `npx serve .`; también sirve `python3 -m http.server`) y abrí la dirección que indica; o abrí `index.html` con doble clic.
3. Para publicarlo: subí la carpeta a GitHub Pages, Netlify o Vercel (son archivos estáticos).

## Cómo se usa
1. Elegí una fuente de audio (ver abajo) o arrastrá un archivo a la página. Con **Probar con sonido de demostración** se ve todo funcionando sin micrófono ni archivo.
2. Mirá las métricas y las tarjetas de vistas. Cada tarjeta tiene una miniatura que se actualiza en vivo.
3. Tocá una tarjeta (o su número en el teclado) para abrir la vista en grande en una ventana emergente. Ahí están los controles y los botones **Exportar PNG** y **Grabar video**.
4. Cerrá con **Cerrar**, tocando fuera de la ventana o con Esc.
5. Cuando un archivo termina o lo pausás, las vistas conservan la imagen que se formó, lista para exportar.

## Atajos de teclado
| Tecla | Acción |
|---|---|
| `1`–`8` | Abrir la vista correspondiente |
| `F` o `Espacio` | Congelar / reanudar el análisis |
| `P` | Reproducir / pausar el archivo |
| `E` | Exportar PNG (con una vista abierta) |
| `G` | Grabar / detener video (con una vista abierta) |
| `D`, `M`, `A` | Demostración, micrófono, elegir archivo |
| `Esc` | Cerrar la ventana |

## Fuentes de audio
| Fuente | Detalle |
|---|---|
| Demostración | Arpegio estéreo con bombo a 120 BPM generado en el navegador (osciladores). |
| Micrófono | Sin cancelación de eco, supresión de ruido ni control automático de ganancia, para analizar la señal tal cual. Usá auriculares para evitar acople. |
| Archivo de audio | Cualquier formato que reproduzca tu navegador (botón o arrastrar y soltar); usa los controles nativos (reproducir, pausa, barra de tiempo). Además se analiza la canción completa en segundo plano: espectrograma total, autosimilitud total y tonalidad global. |
| Audio de una pestaña | Elegí una pestaña y marcá "compartir audio". Solo Chromium. |

Al cambiar de fuente se detienen la anterior (micrófono, captura o demostración) y se reinicia el historial del análisis. Si cortás la captura de pestaña desde el navegador o se desconecta el micrófono, la app lo avisa.

## Métricas (barra superior)
- **Volumen (RMS):** raíz del promedio de los cuadrados de la señal, en dB relativos al máximo (0 dB). Cuanto más cerca de 0, más fuerte.
- **Nota dominante:** frecuencia del pico más fuerte del espectro (con interpolación parabólica) y su nota, por ejemplo La4 · 440 Hz.
- **Brillo (centroide espectral):** el "centro de masa" del espectro; sube cuando el sonido es más agudo o con más armónicos.
- **Tempo estimado:** BPM entre 60 y 180, la confianza (qué tan regular es el pulso) y un punto que late con cada golpe detectado.
- **Tonalidad:** estimada con el algoritmo de Krumhansl-Schmuckler (por ejemplo "La menor"). En vivo usa los últimos segundos; con un archivo analizado, la canción completa.
- **Graves · medios · agudos:** reparto de energía por debajo de 250 Hz, entre 250 Hz y 4 kHz, y por encima de 4 kHz.
- En silencio (por debajo de −80 dB) la nota y el brillo muestran "—".

Para ahorrar recursos, solo se dibujan las vistas cuyas tarjetas están en pantalla o la que está abierta; el espectrograma se dibuja siempre para no perder su historia.

## Vistas
| Vista | Qué muestra y cómo leerla |
|---|---|
| **Espectro** | Energía por frecuencia en escala logarítmica (30 Hz a 16 kHz). Las barras altas son frecuencias fuertes; los puntos blancos retienen el máximo reciente. El marcador amarillo indica el pico y su nota. |
| **Espectrograma** | Imagen frecuencia × tiempo. El tiempo avanza a la derecha, los agudos van arriba y el brillo es la intensidad. Las líneas horizontales son notas sostenidas; las verticales, golpes. |
| **Estela estéreo** | Izquierda contra derecha (goniómetro) con rastro que se desvanece. Un sonido mono es una línea vertical; un estéreo amplio, una mancha ancha; los tonos puros forman figuras de Lissajous. |
| **Radial** | El espectro enrollado en círculo, simétrico, que gira más rápido con los graves y deja estela. |
| **Notas** | Cromagrama: cuánto suena cada una de las 12 notas sin importar la octava. Resalta la dominante e ayuda a intuir la tonalidad. |
| **Autosimilitud** | Matriz que compara cada instante con todos los demás. Un punto claro significa "estos dos momentos suenan parecido". Las diagonales claras paralelas a la principal son partes que se repiten (estribillos, loops). En vivo cubre los últimos ~80 s; con un archivo analizado muestra la canción entera con una cruz en la posición actual, y tocar un punto salta a ese momento. |
| **Afinador** | La nota más cercana al pico del sonido, su frecuencia y una aguja entre −50 y +50 cents; dice "afinado" dentro de ±5 cents. Funciona mejor con una sola nota limpia. |
| **Canción completa** | Espectrograma de todo el archivo con marcas de tiempo y el cursor de reproducción. Tocá un punto para saltar ahí. |

## Controles (en la ventana de cada vista)
- **Reproductor y Congelar análisis:** pausa el análisis para examinar un instante.
- **Suavizado:** promedia cuadros sucesivos del espectro (0 = reacciona al instante, 0,95 = muy suave).
- **Persistencia de la estela:** cuánto tarda en desvanecerse el rastro de la estela y del radial.
- **Resolución FFT (2048, 4096, 8192):** más resolución separa mejor las frecuencias, pero responde más lento.
- **Paleta:** Aurora, Fuego o Hielo. Cambia los colores de todas las vistas (incluida la estela), del fondo y de los acentos de la interfaz (título, botones, bordes y medidores). El espectrograma en vivo ya dibujado conserva sus colores viejos hasta que avanza el tiempo; la autosimilitud, la canción completa y las miniaturas se actualizan al instante.
- Suavizado, persistencia, resolución y paleta se guardan en el navegador y se recuerdan en la próxima visita.
- **Exportar PNG:** descarga la vista actual como `sinestesia-<vista>.png`.
- **Grabar video:** graba la vista abierta con el audio de la fuente y la descarga al detener como `sinestesia-<vista>.webm` (`.mp4` en Safari). Cerrar la ventana también detiene la grabación.

## Fondo
Un ecualizador de 72 barras en la parte inferior de la página, con puntas más claras. Con audio sigue el espectro real (escala logarítmica, igual que el espectro); sin audio "respira" con un movimiento lento. Usa los colores de la paleta elegida. Se pausa cuando la pestaña no está visible. Si tu sistema pide reducir el movimiento, la animación sigue pero con la amplitud ociosa al 40 %, porque el movimiento es parte de lo que hace la aplicación; no hay interruptor.

## Cómo funciona
```
fuente (mic / archivo / pestaña / demo)
   ├─> AnalyserNode (mezcla) ──> FFT en dB + forma de onda
   └─> ChannelSplitter ──> AnalyserNode L y R ──> estela estéreo
FFT ──> magnitudes lineales ──> pico, cromagrama, centroide, bandas, flujo espectral
flujo espectral ──> envolvente de onsets ──> autocorrelación ponderada ──> BPM + confianza
(cromagrama + 8 bandas) cada 0,4 s ──> matriz de autosimilitud (coseno)
cromagrama de largo plazo ──> perfiles de Krumhansl ──> tonalidad
archivo ──> decodeAudioData ──> FFT propia por tramos ──> espectrograma, autosimilitud y tonalidad de toda la canción
```
- **Pico:** máximo de las magnitudes con interpolación parabólica de los tres bins centrales.
- **Cromagrama:** cada bin se asigna a una de las 12 clases de nota (55 Hz a 4,2 kHz) y se suma su energía.
- **Tempo:** el flujo espectral positivo (aumento de energía entre 30 Hz y 4 kHz) forma la envolvente; la autocorrelación normalizada de los últimos 8 s busca el desfase dominante entre 60 y 180 BPM. Cada candidato se pondera con una campana centrada en 120 BPM (σ = 1,4 octavas) para reducir errores de octava; la confianza es la autocorrelación del elegido.
- **Tonalidad:** correlación de Pearson del cromagrama con los perfiles mayor y menor de Krumhansl-Kessler rotados a las 12 tónicas; gana la más alta (se muestra si supera 0,3).
- **Afinador:** cents = 100 × (MIDI fraccionario − MIDI redondeado), suavizado en escala logarítmica.
- **Canción completa:** el archivo se decodifica a mono y se analizan hasta 1200 ventanas de 4096 muestras (Hann) repartidas en toda la duración, cediendo el control cada 25 ventanas. La autosimilitud promedia ventanas hasta un máximo de 600 vectores.
- **Autosimilitud:** vector de 20 valores (12 notas + 8 bandas logarítmicas) cada 0,4 s, hasta 200 vectores; similitud coseno entre todos los pares, con contraste elevado a la 5.ª potencia.
- **Detección de golpe:** el flujo actual supera 1,5 veces el promedio reciente.
- **Imagen final:** con un archivo en pausa o terminado (silencio por debajo de −80 dB) las vistas no se redibujan, así se conserva la última imagen.

## Estructura
- `index.html`: estructura, tarjetas y ventana.
- `style.css`: estilos.
- `analysis.js`: funciones puras y testeables (`peakFreq`, `chroma`, `centroid`, `rms`, `bands`, `estimateTempo`, `estimateBPM`, `detectKey`, `tuning`, `selfSim`, `noteName`, `fft`, `magnitudeSpectrum`, `spectrumColumn`, `featureVector`).
- `app.js`: audio, análisis de la canción completa, bucle de dibujo, tarjetas, ventana, grabación, atajos y fondo.
- `test.js`: tests del análisis con señales sintéticas.
- `smoke.test.js`: prueba de humo con audio, canvas y dispositivos simulados.
- `package.json`: scripts `npm start` y `npm test`.
- `.github/workflows/test.yml`: corre los tests en GitHub en cada push.
- `CHANGELOG.md`: historial completo de cambios, errores encontrados y decisiones.

## Tests
`npm install` y luego `npm test` (corre los dos archivos).
- `test.js`: un tono de 440 Hz da La4, un acorde de Do mayor activa Do-Mi-Sol, un pulso a 120 BPM da 120 con confianza alta y uno a 160 BPM no se confunde con 80, los acordes de Do mayor y La menor dan esas tonalidades, el afinador mide 445 Hz como +19,6 cents, la FFT propia encuentra el mismo pico que la de referencia, un patrón periódico genera diagonales, el RMS de un seno da 0,707.
- `smoke.test.js`: recorre micrófono (error y éxito), captura de pestaña (con y sin audio), archivo, demostración con tempo de 120 BPM detectado, controles y ajustes guardados, cambio de paleta, congelar, las ocho tarjetas con su ventana y exportación PNG, cierre por fondo, atajos de teclado, grabación de video, detención de fuentes al cambiar, aviso al cortar la captura, arrastrar y soltar, análisis de la canción completa (tonalidad La menor de un acorde de prueba), salto al tocar la canción o la autosimilitud, y que la imagen se conserve al terminar el audio. Usa audio simulado, por lo que valida la lógica pero no cómo se ve ni suena en un navegador real.

## Solución de problemas
- **No se oye o no se ve nada:** probá la demostración. Si funciona, el problema es la fuente; si no, revisá la consola del navegador.
- **El micrófono no funciona:** revisá el permiso del navegador y que la página esté en HTTPS o `localhost`.
- **La captura de pestaña no tiene audio:** en el selector marcá "compartir audio"; no todos los navegadores lo ofrecen.
- **El tempo marca el doble o la mitad:** es una ambigüedad habitual de octavas; mirá la confianza.
- **Se ve lento:** bajá la resolución FFT a 2048 y cerrá otras pestañas.
- **"Canción completa" no aparece:** el análisis tarda unos segundos en archivos largos (el mensaje muestra el porcentaje). Si el navegador no puede decodificar el formato, la reproducción en vivo sigue funcionando igual.
- **No se puede grabar video:** requiere `MediaRecorder` y `canvas.captureStream`, disponibles en navegadores recientes.

## Limitaciones
- El tempo falla con música sin pulso claro.
- En vivo, la autosimilitud cubre una ventana deslizante de unos 80 s; la canción completa solo está disponible con archivos.
- La tonalidad es una estimación estadística: falla con música atonal, modal o con muchas modulaciones.
- La nota dominante y el afinador usan el pico más fuerte, no una transcripción: con sonidos ricos en armónicos pueden marcar un armónico.
- Los canvas usan resolución fija escalada por CSS.

## Glosario
**FFT:** transformada que separa un sonido en frecuencias. **dB:** escala logarítmica de intensidad. **RMS:** nivel medio de la señal. **Centroide:** centro de masa del espectro. **Cromagrama:** energía por nota. **Flujo espectral:** aumento de energía entre cuadros, útil para hallar golpes. **Lissajous:** figura que forman dos señales una contra otra. **Cent:** centésima de semitono.

## Ideas futuras
Paletas personalizadas, nitidez en pantallas de alta densidad, ejes en todas las vistas, modo pantalla completa y diseño móvil.

# Sinestesia · laboratorio de audio

Convierte sonido en imagen y lo analiza desde varios puntos de vista a la vez: frecuencias, tiempo, estéreo, notas, ritmo y repeticiones. Es una página estática en HTML + CSS + JavaScript puro (Web Audio API y canvas): sin dependencias, sin backend, sin base de datos y sin red. **El audio nunca sale de tu navegador.**

## Requisitos
- Un navegador moderno (Chrome, Edge, Firefox o Safari recientes). La captura del audio de una pestaña solo funciona en navegadores basados en Chromium.
- Para usar el micrófono o la captura de pestaña, la página debe abrirse por `https://` o `http://localhost`. Abrir `index.html` directamente (`file://`) sirve para la demostración y los archivos, pero algunos navegadores bloquean el micrófono.
- Para correr los tests: Node.js 18 o superior (y `npm i jsdom` para la prueba de humo).

## Cómo correrlo
1. Descomprimí el zip.
2. Desde la carpeta ejecutá `npx serve` (o `python3 -m http.server`) y abrí la dirección que indica; o abrí `index.html` con doble clic.
3. Para publicarlo: subí la carpeta a GitHub Pages, Netlify o Vercel (son archivos estáticos).

## Cómo se usa
1. Elegí una fuente de audio (ver abajo). Con **Probar con sonido de demostración** se ve todo funcionando sin micrófono ni archivo.
2. Mirá las métricas y las tarjetas de vistas. Cada tarjeta tiene una miniatura que se actualiza en vivo.
3. Tocá una tarjeta para abrir la vista en grande en una ventana emergente. Ahí están los controles y el botón **Exportar PNG**.
4. Cerrá con **Cerrar**, tocando fuera de la ventana o con Esc.

## Fuentes de audio
| Fuente | Detalle |
|---|---|
| Demostración | Arpegio estéreo con bombo a 120 BPM generado en el navegador (osciladores). |
| Micrófono | Sin cancelación de eco, supresión de ruido ni control automático de ganancia, para analizar la señal tal cual. Usá auriculares para evitar acople. |
| Archivo de audio | Cualquier formato que reproduzca tu navegador; usa los controles nativos (reproducir, pausa, barra de tiempo). |
| Audio de una pestaña | Elegí una pestaña y marcá "compartir audio". Solo Chromium. |

Al cambiar de fuente se detienen la anterior (micrófono, captura o demostración) y se reinicia el historial del análisis.

## Métricas (barra superior)
- **Volumen (RMS):** raíz del promedio de los cuadrados de la señal, en dB relativos al máximo (0 dB). Cuanto más cerca de 0, más fuerte.
- **Nota dominante:** frecuencia del pico más fuerte del espectro (con interpolación parabólica) y su nota, por ejemplo La4 · 440 Hz.
- **Brillo (centroide espectral):** el "centro de masa" del espectro; sube cuando el sonido es más agudo o con más armónicos.
- **Tempo estimado:** BPM entre 60 y 180 y un punto que late con cada golpe detectado.
- **Graves · medios · agudos:** reparto de energía por debajo de 250 Hz, entre 250 Hz y 4 kHz, y por encima de 4 kHz.

## Vistas
| Vista | Qué muestra y cómo leerla |
|---|---|
| **Espectro** | Energía por frecuencia en escala logarítmica (30 Hz a 16 kHz). Las barras altas son frecuencias fuertes; los puntos blancos retienen el máximo reciente. El marcador amarillo indica el pico y su nota. |
| **Espectrograma** | Imagen frecuencia × tiempo. El tiempo avanza a la derecha, los agudos van arriba y el brillo es la intensidad. Las líneas horizontales son notas sostenidas; las verticales, golpes. |
| **Estela estéreo** | Izquierda contra derecha (goniómetro) con rastro que se desvanece. Un sonido mono es una línea vertical; un estéreo amplio, una mancha ancha; los tonos puros forman figuras de Lissajous. |
| **Radial** | El espectro enrollado en círculo, simétrico, que gira más rápido con los graves y deja estela. |
| **Notas** | Cromagrama: cuánto suena cada una de las 12 notas sin importar la octava. Resalta la dominante e ayuda a intuir la tonalidad. |
| **Autosimilitud** | Matriz que compara cada instante con todos los demás (últimos ~80 s). Un punto claro significa "estos dos momentos suenan parecido". Las diagonales claras paralelas a la principal son partes que se repiten (estribillos, loops). |

## Controles (en la ventana de cada vista)
- **Reproductor y Congelar análisis:** pausa el análisis para examinar un instante.
- **Suavizado:** promedia cuadros sucesivos del espectro (0 = reacciona al instante, 0,95 = muy suave).
- **Persistencia de la estela:** cuánto tarda en desvanecerse el rastro de la estela y del radial.
- **Resolución FFT (2048, 4096, 8192):** más resolución separa mejor las frecuencias, pero responde más lento.
- **Paleta:** Aurora, Fuego o Hielo. Cambia los colores de todas las vistas (incluida la estela), del fondo y de los acentos de la interfaz (título, botones, bordes y medidores). El espectrograma ya dibujado conserva sus colores viejos hasta que avanza el tiempo; la autosimilitud y las miniaturas se actualizan al instante.
- **Exportar PNG:** descarga la vista actual como `sinestesia-<vista>.png`.

## Fondo
Un ecualizador de 72 barras en la parte inferior de la página, con puntas más claras. Con audio sigue el espectro real (escala logarítmica, igual que el espectro); sin audio "respira" con un movimiento lento. Usa los colores de la paleta elegida. Se pausa cuando la pestaña no está visible. Si tu sistema pide reducir el movimiento, la animación sigue pero con la amplitud ociosa al 40 %, porque el movimiento es parte de lo que hace la aplicación; no hay interruptor.

## Cómo funciona
```
fuente (mic / archivo / pestaña / demo)
   ├─> AnalyserNode (mezcla) ──> FFT en dB + forma de onda
   └─> ChannelSplitter ──> AnalyserNode L y R ──> estela estéreo
FFT ──> magnitudes lineales ──> pico, cromagrama, centroide, bandas, flujo espectral
flujo espectral ──> envolvente de onsets ──> autocorrelación ──> BPM
(cromagrama + 8 bandas) cada 0,4 s ──> matriz de autosimilitud (coseno)
```
- **Pico:** máximo de las magnitudes con interpolación parabólica de los tres bins centrales.
- **Cromagrama:** cada bin se asigna a una de las 12 clases de nota (55 Hz a 4,2 kHz) y se suma su energía.
- **Tempo:** el flujo espectral positivo (aumento de energía entre 30 Hz y 4 kHz) forma la envolvente; la autocorrelación de los últimos 8 s busca el desfase dominante entre 60 y 180 BPM.
- **Autosimilitud:** vector de 20 valores (12 notas + 8 bandas logarítmicas) cada 0,4 s, hasta 200 vectores; similitud coseno entre todos los pares, con contraste elevado a la 5.ª potencia.
- **Detección de golpe:** el flujo actual supera 1,5 veces el promedio reciente.

## Estructura
- `index.html`: estructura, tarjetas y ventana.
- `style.css`: estilos.
- `analysis.js`: funciones puras y testeables (`peakFreq`, `chroma`, `centroid`, `rms`, `bands`, `estimateBPM`, `selfSim`, `noteName`).
- `app.js`: audio, bucle de dibujo, tarjetas, ventana y fondo.
- `test.js`: tests del análisis con señales sintéticas.
- `CHANGELOG.md`: historial completo de cambios, errores encontrados y decisiones.
- `smoke.test.js`: prueba de humo con audio, canvas y dispositivos simulados.

## Tests
- `node test.js`: un tono de 440 Hz da La4, un acorde de Do mayor activa Do-Mi-Sol, un pulso a 120 BPM da 120, un patrón periódico genera diagonales, el RMS de un seno da 0,707.
- `node smoke.test.js` (requiere `npm i jsdom`): recorre micrófono (error y éxito), captura de pestaña (con y sin audio), archivo, demostración con tempo de 120 BPM detectado, controles, cambio de paleta (acentos y colores realmente dibujados), congelar, las seis tarjetas con su ventana y exportación PNG, cierre por fondo y detención de fuentes al cambiar. Usa audio simulado, por lo que valida la lógica pero no cómo se ve ni suena en un navegador real.

## Solución de problemas
- **No se oye o no se ve nada:** probá la demostración. Si funciona, el problema es la fuente; si no, revisá la consola del navegador.
- **El micrófono no funciona:** revisá el permiso del navegador y que la página esté en HTTPS o `localhost`.
- **La captura de pestaña no tiene audio:** en el selector marcá "compartir audio"; no todos los navegadores lo ofrecen.
- **El tempo marca el doble o la mitad:** es una ambigüedad habitual de octavas.
- **Se ve lento:** bajá la resolución FFT a 2048 y cerrá otras pestañas.

## Limitaciones
- El tempo falla con música sin pulso claro.
- La autosimilitud cubre una ventana deslizante de unos 80 s, no la canción completa.
- La nota dominante es el pico más fuerte, no una transcripción.
- Los canvas usan resolución fija escalada por CSS.

## Glosario
**FFT:** transformada que separa un sonido en frecuencias. **dB:** escala logarítmica de intensidad. **RMS:** nivel medio de la señal. **Centroide:** centro de masa del espectro. **Cromagrama:** energía por nota. **Flujo espectral:** aumento de energía entre cuadros, útil para hallar golpes. **Lissajous:** figura que forman dos señales una contra otra.

## Ideas futuras
Análisis offline del archivo completo, detección de tonalidad, afinador, grabación de la sesión y paletas personalizadas.

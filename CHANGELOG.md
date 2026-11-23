# Historial de cambios · Sinestesia

## 0.9 · Mejoras funcionales
- **Imagen final al terminar el audio:** con un archivo en pausa o terminado, las vistas dejan de redibujarse y conservan la imagen que se formó (antes la estela y el radial se apagaban y el espectrograma se llenaba de negro). Un aviso sugiere exportarla en PNG.
- **Canción completa:** al cargar un archivo se decodifica y analiza entero en segundo plano (por tramos, sin congelar la página). Nueva vista **Canción completa** con el espectrograma de todo el archivo y el cursor de reproducción. La **Autosimilitud** pasa a mostrar la canción entera con una cruz en la posición actual. En ambas, tocar un punto salta a ese momento.
- **Tonalidad:** nueva métrica con el algoritmo de Krumhansl-Schmuckler (24 tonalidades mayores y menores). En vivo usa los últimos segundos; con un archivo analizado, la canción completa.
- **Afinador:** nueva vista con la nota más cercana, la frecuencia y una aguja entre −50 y +50 cents.
- **Tempo más confiable:** se pondera cada candidato con una curva centrada en 120 BPM para reducir errores de octava, y se muestra la confianza.
- **Grabar video:** botón en la ventana de cada vista que graba el canvas con el audio de la fuente y descarga un `.webm` (o `.mp4` en Safari). Se detiene al cerrar la ventana.
- **Arrastrar y soltar** un archivo de audio sobre la página.
- **Atajos de teclado:** 1–8 abrir vista, F/Espacio congelar, P reproducir/pausar, E exportar, G grabar, D demo, M micrófono, A archivo.
- **Ajustes guardados:** suavizado, persistencia, resolución FFT y paleta se recuerdan entre visitas.
- `analysis.js` suma `estimateTempo`, `detectKey`, `tuning`, `fft`, `magnitudeSpectrum`, `spectrumColumn` y `featureVector`, todos con tests.
- `package.json` con `npm test` y GitHub Action que corre los tests en cada push.

## 0.8 · Código legible y correcciones
- **Código legible:** `app.js`, `analysis.js`, `index.html` y `style.css` dejaron de estar compactados en pocas líneas. Ahora tienen nombres descriptivos, secciones y comentarios; el comportamiento es el mismo.
- **Error corregido:** cambiar de fuente dos veces después de la demostración (demo → micrófono → pestaña) fallaba con "No se pudo…", porque se intentaba detener otra vez los osciladores ya detenidos (`InvalidStateError` en navegadores reales). La demo ahora se detiene una sola vez.
- **Error corregido:** cada archivo de audio nuevo dejaba la URL del anterior sin liberar (pérdida de memoria). Además se puede volver a elegir el mismo archivo.
- **Error corregido:** si el usuario cortaba la captura de pestaña desde el navegador o se desconectaba el micrófono, la app no se enteraba. Ahora libera la fuente y lo avisa.
- **Rendimiento:** solo se dibujan las vistas cuyas tarjetas están en pantalla (o la que está abierta en la ventana); las miniaturas se actualizan solo si se ven. El espectrograma se sigue dibujando siempre para no perder historia. La autosimilitud se recalcula solo cuando hay datos nuevos y reutiliza su lienzo auxiliar.
- **Rendimiento:** la persistencia de la estela ya no se lee del DOM en cada cuadro.
- **Accesibilidad:** "Archivo de audio" es ahora un botón real, enfocable y usable con teclado.
- **Métricas en silencio:** por debajo de −80 dB la nota dominante y el brillo muestran "—" en lugar de valores producidos por el ruido.
- Los canvas usan `system-ui` como fuente (antes solo `Segoe UI`, que no existe fuera de Windows).
- La prueba de humo cubre estos casos: doble cambio de fuente, fin de la captura, botón de archivo, liberación de URL y métricas en silencio.

## 0.7 · Paleta global y fondo más visible
- **Error corregido:** la paleta solo afectaba a algunas vistas. La estela estéreo usaba un ciclo de color propio, el fondo y los acentos de la interfaz tenían colores fijos, y el espectrograma conserva los colores de lo ya dibujado. Ahora la paleta define los colores de todas las vistas, del fondo y de la interfaz (variables CSS `--a1`, `--a2`, `--a3`), y refresca la autosimilitud y las miniaturas al instante.
- Fondo más visible: barras más altas y opacas, con una punta más clara y colores de la paleta.
- La prueba de humo verifica que los acentos y los colores dibujados cambien al elegir otra paleta.
- README y este historial actualizados.

## 0.6 · Fondo ecualizador y verificación ampliada
- Se quitó el botón "Fondo animado: sí/no".
- Nuevo fondo temático: un ecualizador tenue que sigue el espectro real del audio y "respira" sin audio. Con preferencia de movimiento reducido sigue animado, a menor amplitud.
- Prueba de humo ampliada: micrófono (error y éxito), captura de pestaña (con y sin audio), archivo, demostración con 120 BPM detectado, congelar, tarjetas, ventana, exportación y detención de fuentes.
- README completo: requisitos, uso, métricas, vistas, algoritmos, tests, solución de problemas y glosario.

## 0.5 · Correcciones de tarjetas y fondo
- **Error corregido:** los títulos de las tarjetas aparecían como letras sueltas ("E", "s"). Un cambio no se aplicó del todo y el código leía caracteres de un texto en vez de título y descripción. La prueba ahora comprueba los seis títulos y el de la ventana.
- Fondo de ondas acelerado y más visible (era casi imperceptible). Se agregó un botón para activarlo o desactivarlo, quitado en 0.6.

## 0.4 · Tarjetas y ventana emergente
- La pantalla principal pasó a seis tarjetas con miniatura en vivo; cada una abre la vista en una ventana con descripción, controles y exportación PNG.
- Los controles (reproductor, congelar, suavizado, persistencia, FFT, paleta) se mueven a la ventana mientras está abierta y vuelven al cerrarla.
- Las tarjetas no se mueven con el mouse (solo borde y sombra).
- Primer fondo animado: ondas suaves.

## 0.3 · Mejora visual y demostración
- Cabecera con degradados, paneles con borde de color, marcas de pico en el espectro, texto "Esperando audio…" en paneles vacíos.
- Botón de **sonido de demostración** (arpegio estéreo con bombo a 120 BPM).
- Primera prueba de humo con jsdom. El arnés de prueba necesitó ajustes (`URL.createObjectURL`, degradados, `pause`), no la aplicación.

## 0.2 · Cambio de nombre
- "Resonancia" pasó a llamarse "Sinestesia" (página, README y archivos PNG exportados).

## 0.1 · Primera versión
- Fuentes: micrófono, archivo y audio de pestaña.
- Vistas: espectro, espectrograma, estela estéreo, radial, cromagrama y autosimilitud.
- Métricas: RMS, nota dominante, centroide, tempo, graves/medios/agudos.
- Módulo de análisis puro (`analysis.js`) con tests de señales sintéticas.

## Decisiones de diseño
- **Sin dependencias ni backend:** HTML + CSS + JS puro para que se publique en cualquier hosting estático y el audio nunca salga del navegador.
- **Análisis separado de la interfaz:** `analysis.js` son funciones puras, fáciles de testear con señales conocidas.
- **Una ventana por vista:** las miniaturas muestran todo a la vez y la vista grande se abre bajo demanda; el mismo canvas se mueve entre la tarjeta y la ventana.
- **Movimiento:** las tarjetas no se mueven; la animación está en el fondo y en las vistas.

## Pendiente / ideas
Paletas personalizadas, mejoras visuales (nitidez en pantallas de alta densidad, ejes, pantalla completa, diseño móvil) y demo publicada. Falta validar el comportamiento visual y sonoro en un navegador real.

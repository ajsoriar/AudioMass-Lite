# Spectral Ribbon Waveform
## Una visualización completamente distinta a la waveform vertical clásica

Esta propuesta se aleja deliberadamente del estilo ReCycle.

No utiliza:

- barras verticales;
- min/max por columna como elemento visual principal;
- degradado repetido dentro de cada barra;
- relieve metálico sobre la misma geometría;
- sombreado tipo cilindro.

En su lugar, convierte el audio en varias **cintas fluidas superpuestas**, cada una asociada a una zona del espectro.

El resultado debe parecer una mezcla entre:

```text
onda
+
cinta de seda
+
topografía
+
espectro
```

La waveform deja de ser una sucesión de agujas y pasa a ser una superficie orgánica continua.

---

# 1. Idea visual

En vez de dibujar:

```text
| | || |||||| | | |||
```

dibujar algo más parecido a:

```text
        ~~~~~~~~
     ~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~
     ~~~~~~~~~~~~~
        ~~~~~~~~
```

Pero con varias capas internas:

```text
        ─────────────
      ╱───────────────╲
    ╱───────────────────╲
  ╱───────────────────────╲
 ╱─────────────────────────╲
╲───────────────────────────╱
  ╲───────────────────────╱
    ╲───────────────────╱
      ╲───────────────╱
        ─────────────
```

Cada banda representa una parte diferente del espectro.

---

# 2. División espectral

Separar el audio en varias bandas.

Por ejemplo:

```text
Banda 0: subgrave      20–80 Hz
Banda 1: graves        80–250 Hz
Banda 2: medios bajos  250–800 Hz
Banda 3: medios        800–2500 Hz
Banda 4: presencia     2500–6000 Hz
Banda 5: agudos        6000–16000 Hz
```

No hace falta utilizar filtros IIR reales si sólo se desea una visualización estática.

Puede hacerse mediante FFT por ventanas.

Para cada posición X:

```js
spectralEnergy[x][band]
```

---

# 3. Ventanas temporales

Dividir el audio en bloques.

Por ejemplo:

```js
const fftSize = 2048;
const hopSize = 512;
```

Para cada ventana:

```text
audio
↓
FFT
↓
magnitudes
↓
sumar energía por banda
```

Guardar:

```js
energy[frame][band]
```

---

# 4. Normalización

Conviene trabajar en escala logarítmica.

Por banda:

```js
db =
    20 * Math.log10(
        magnitude + 1e-8
    );
```

Normalizar después:

```js
normalized =
    clamp01(
        (db - minDb) /
        (maxDb - minDb)
    );
```

Valores iniciales:

```js
minDb = -70;
maxDb = -6;
```

---

# 5. Convertir frames a X

Si tenemos:

```js
frameCount
```

y un canvas de:

```js
width
```

mapear:

```js
const framePosition =
    x / (width - 1) *
    (frameCount - 1);
```

Interpolar entre frames:

```js
const i0 =
    Math.floor(framePosition);

const i1 =
    Math.min(
        frameCount - 1,
        i0 + 1
    );

const f =
    framePosition - i0;
```

Para cada banda:

```js
const value =
    lerp(
        energy[i0][band],
        energy[i1][band],
        f
    );
```

---

# 6. Geometría principal

Definir:

```js
const centerY =
    height / 2;
```

Cada banda crea una cinta alrededor del centro.

Por ejemplo:

```text
agudos
presencia
medios
medios bajos
graves
subgrave
---------------- eje
subgrave
graves
medios bajos
medios
presencia
agudos
```

Pero no dibujarlas como franjas rígidas.

Cada una tendrá un grosor variable.

---

# 7. Grosor de cada banda

Para cada X:

```js
thickness[x][band] =
    baseThickness +
    energy[x][band] *
    amplitudeScale[band];
```

Ejemplo:

```js
const BASE = [
    2,
    2,
    2,
    1.5,
    1.2,
    1
];

const SCALE = [
    35,
    30,
    25,
    20,
    15,
    10
];
```

Los graves ocupan más espacio.

Los agudos son más finos.

---

# 8. Apilar bandas

Calcular las fronteras acumuladas.

Parte superior:

```js
let y = centerY;

for (
    let band = 0;
    band < bandCount;
    band++
) {
    const thickness =
        getThickness(
            x,
            band
        );

    topInner[x][band] = y;

    y -= thickness;

    topOuter[x][band] = y;
}
```

Parte inferior:

```js
let y = centerY;

for (
    let band = 0;
    band < bandCount;
    band++
) {
    const thickness =
        getThickness(
            x,
            band
        );

    bottomInner[x][band] = y;

    y += thickness;

    bottomOuter[x][band] = y;
}
```

El resultado es una especie de cebolla espectral.

---

# 9. Suavizado temporal

Los valores FFT crudos producirán demasiados dientes.

Aplicar smoothing horizontal.

Una solución sencilla:

```js
smoothed[x] =
    value[x - 2] * 0.10 +
    value[x - 1] * 0.20 +
    value[x]     * 0.40 +
    value[x + 1] * 0.20 +
    value[x + 2] * 0.10;
```

O utilizar un filtro exponencial:

```js
smooth[x] =
    smooth[x - 1] * 0.70 +
    raw[x] * 0.30;
```

Para visualización estática es preferible un pequeño blur gaussiano.

---

# 10. Dibujar cada cinta

Cada banda es una forma cerrada.

Parte superior:

```js
ctx.beginPath();

ctx.moveTo(
    0,
    topInner[0][band]
);

for (
    let x = 1;
    x < width;
    x++
) {
    ctx.lineTo(
        x,
        topInner[x][band]
    );
}

for (
    let x = width - 1;
    x >= 0;
    x--
) {
    ctx.lineTo(
        x,
        topOuter[x][band]
    );
}

ctx.closePath();
ctx.fill();
```

Lo mismo para la parte inferior.

---

# 11. Mejor: curvas suaves

En vez de `lineTo`, usar una interpolación spline.

Por ejemplo Catmull-Rom.

Función aproximada:

```js
function catmullRom(
    p0,
    p1,
    p2,
    p3,
    t
) {
    const t2 =
        t * t;

    const t3 =
        t2 * t;

    return 0.5 * (
        2 * p1 +
        (-p0 + p2) * t +
        (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
        (-p0 + 3*p1 - 3*p2 + p3) * t3
    );
}
```

Esto evita el aspecto serrado.

---

# 12. Color por banda

No utilizar el mismo degradado dentro de todas.

Ejemplo:

```js
const BAND_COLORS = [
    [82, 55, 150],
    [105, 70, 185],
    [125, 90, 215],
    [145, 120, 235],
    [175, 155, 245],
    [215, 205, 255]
];
```

Interpretación:

```text
subgrave → violeta oscuro
graves   → violeta
medios   → azul-violeta
agudos   → casi blanco
```

---

# 13. Variación por energía

Modificar ligeramente el color según intensidad.

```js
const energy =
    normalizedEnergy[x][band];

const color =
    mixColor(
        darkBandColor,
        brightBandColor,
        energy
    );
```

Pero no pintar cada X con `fillStyle`.

Es mejor crear una textura horizontal.

---

# 14. Crear una textura de color horizontal

Crear un canvas auxiliar:

```js
const texture =
    document.createElement(
        "canvas"
    );
```

Tamaño:

```js
texture.width = width;
texture.height = 1;
```

Por cada X:

```js
setPixel(
    textureData,
    x,
    0,
    colorAtX
);
```

Después usarla como patrón o estirarla verticalmente sobre la cinta.

También se puede utilizar clipping:

```js
ctx.save();

ctx.clip(
    ribbonPath
);

ctx.drawImage(
    textureCanvas,
    0,
    ribbonTop,
    width,
    ribbonHeight
);

ctx.restore();
```

---

# 15. Separadores internos

Dibujar una línea muy fina entre bandas.

```js
ctx.strokeStyle =
    "rgba(255,255,255,0.10)";
```

Esto ayuda a leer la estructura.

No usar bordes fuertes.

---

# 16. Desfase entre bandas

Aquí aparece un efecto visual muy interesante.

No todas las bandas tienen que responder exactamente en la misma X.

Añadir pequeños offsets:

```js
const BAND_OFFSET = [
    0,
    1,
    2,
    4,
    6,
    8
];
```

Entonces:

```js
energyAtX =
    sampleEnergy(
        x + BAND_OFFSET[band],
        band
    );
```

Los agudos pueden adelantarse o retrasarse ligeramente.

El waveform adquiere sensación de movimiento interno.

---

# 17. Variante "trenzada"

En lugar de mantener el orden fijo de las bandas, permitir una pequeña oscilación vertical.

```js
offsetY =
    Math.sin(
        x * frequency +
        band * phase
    ) * amount;
```

Por ejemplo:

```js
const offsetY =
    Math.sin(
        x * 0.015 +
        band * 1.2
    ) * 3;
```

Esto hace que las cintas parezcan trenzarse.

Importante:

```text
amount pequeño
2–5 px
```

No debe destruir la estructura.

---

# 18. Variante "topográfica"

Otra posibilidad es no rellenar las bandas.

Dibujar únicamente contornos.

Por ejemplo:

```text
──────────────
 ─────────────
  ───────────
   ─────────
    ───────
```

Cada nivel representa un porcentaje de energía:

```js
levels = [
    0.15,
    0.30,
    0.45,
    0.60,
    0.75,
    0.90
];
```

Para cada nivel:

```js
y =
    centerY -
    envelope[x] *
    level *
    scale;
```

Resultado:

```text
mapa topográfico
onda acústica
líneas de nivel
```

Muy diferente a una waveform clásica.

---

# 19. Variante "isobaras"

En vez de dibujar la energía exacta, dibujar regiones donde:

```js
energy >= threshold
```

Por ejemplo:

```js
thresholds = [
    0.15,
    0.30,
    0.45,
    0.60,
    0.75
];
```

Cada threshold genera una superficie.

Resultado visual:

```text
capas geológicas
mapa de presión
campo de energía
```

---

# 20. Variante "cintas independientes"

En lugar de apilar las bandas, separarlas.

Por ejemplo:

```text
agudos      ~~~~~~~~~~~~~~~

presencia   ~~~~~~~~~~~~

medios      ~~~~~~~~~~~~~~~~~

graves      ~~~~~~~~~~~~~~~~~~~~~

subgrave    ~~~~~~~~~~~~~~~~~~~~~~~~
```

Cada banda ocupa su propia línea horizontal.

Esto convierte la waveform en una especie de:

```text
mini espectrograma vectorial
```

pero mucho más elegante que un espectrograma raster.

---

# 21. Variante "DNA"

Usar sólo dos o tres ribbons.

Por ejemplo:

```text
bass ribbon
treble ribbon
```

Hacerlas oscilar alrededor del eje:

```js
bassY =
    centerY +
    Math.sin(
        x * 0.025
    ) * bassEnergy * scale;

trebleY =
    centerY +
    Math.sin(
        x * 0.025 + Math.PI
    ) * trebleEnergy * scale;
```

Unirlas periódicamente:

```text
╲       ╱
 ╲     ╱
  ╲   ╱
   ╲ ╱
   ╱ ╲
  ╱   ╲
 ╱     ╲
╱       ╲
```

Puede parecer una doble hélice formada por audio.

---

# 22. Variante "tela"

Interpretar la waveform como una tela tensada.

Crear varias líneas horizontales:

```js
for (
    let row = 0;
    row < rows;
    row++
)
```

Cada línea se desplaza según la envolvente:

```js
const displacement =
    envelope[x] *
    Math.sin(
        row / rows *
        Math.PI
    ) *
    scale;
```

Resultado:

```text
malla
tejido
bandera
superficie flexible
```

Puede dibujarse sólo con líneas finas.

---

# 23. Variante "campo gravitatorio"

Representar la amplitud como una deformación del espacio.

Crear una cuadrícula:

```text
+----+----+----+
|    |    |    |
+----+----+----+
|    |    |    |
+----+----+----+
```

Deformar sus puntos hacia la waveform.

Ejemplo:

```js
distance =
    Math.abs(
        y - waveformY[x]
    );

force =
    amplitude[x] /
    (1 + distance * falloff);
```

Desplazar:

```js
deformedY =
    y +
    force * direction;
```

Resultado:

```text
la onda curva el espacio a su alrededor
```

Muy diferente visualmente.

---

# 24. Variante "partículas"

No dibujar líneas.

Para cada X generar partículas proporcionalmente a la energía.

```js
particleCount =
    Math.floor(
        energy[x] *
        maxParticles
    );
```

Posición:

```js
particleY =
    centerY +
    randomGaussian() *
    energy[x] *
    spread;
```

Opacidad:

```js
alpha =
    0.1 +
    energy[x] * 0.6;
```

Resultado:

```text
nube
polvo
humo
campo de partículas
```

Los transitorios pueden producir concentraciones muy densas.

---

# 25. Variante "pincel"

Interpretar el audio como una pincelada.

La amplitud controla:

```text
grosor
```

El espectro controla:

```text
rugosidad
```

Los ataques controlan:

```text
salpicaduras
```

Ejemplo:

```js
brushWidth =
    2 +
    energy * 60;

roughness =
    highFrequencyEnergy * 8;

splatter =
    attack * 20;
```

Resultado:

```text
tinta
acuarela
carboncillo
pintura
```

---

# 26. Variante "caligrafía"

Crear una sola línea continua:

```js
y =
    centerY +
    sampleEnvelope[x] *
    scale;
```

Pero variar su grosor:

```js
lineWidth =
    1 +
    energy[x] * 12;
```

y su inclinación aparente según pendiente.

Puede parecer una línea dibujada con una pluma.

---

# 27. Variante "ondas concéntricas"

Cada pico importante genera un pequeño frente de onda.

Detectar transitorios:

```js
if (
    attack[x] >
    threshold
) {
    events.push(x);
}
```

Por cada evento:

```text
     )
    ))
   )))
  ))))
```

Dibujar curvas que se expanden horizontalmente.

La intensidad disminuye con distancia:

```js
intensity =
    Math.exp(
        -distance *
        decay
    );
```

El resultado se parece más a ondas físicas en agua que a una waveform.

---

# 28. Variante "ecos"

Utilizar la waveform principal y dibujar varias copias desplazadas.

```js
for (
    let echo = 0;
    echo < echoCount;
    echo++
) {
    const dx =
        echo * 3;

    const alpha =
        Math.pow(
            0.65,
            echo
        );
}
```

Pero las copias pueden deformarse verticalmente.

Resultado:

```text
estela
movimiento
eco visual
```

---

# 29. Variante "corte geológico"

Esta es una propuesta especialmente diferente.

Interpretar las bandas espectrales como estratos geológicos:

```text
──────── agudos
~~~~~~~~ presencia
████████ medios
▒▒▒▒▒▒▒ graves
▓▓▓▓▓▓▓ subgrave
```

La energía hace que los estratos se deformen.

Conceptualmente:

```js
layerY[x][band] =
    baseY[band] +
    energy[x][band] *
    displacement[band];
```

Dibujar polígonos entre capas.

Resultado:

```text
montaña
geología
sección del terreno
```

---

# 30. Propuesta recomendada: Spectral Ribbon

La opción recomendada para empezar es:

```text
6 bandas espectrales
+
ribbons apilados
+
simetría superior/inferior
+
curvas suaves
+
color diferente por banda
```

No utilizar inicialmente:

```text
specular
metal
Fresnel
3D clásico
```

La diferencia estética debe venir de la propia geometría.

---

# 31. Pipeline recomendado

```text
AudioBuffer
↓
ventanas FFT
↓
energía por banda
↓
normalización dB
↓
interpolación horizontal
↓
smoothing
↓
thickness por banda
↓
apilado
↓
spline
↓
relleno por banda
↓
separadores
↓
composición final
```

---

# 32. Configuración inicial

```js
const config = {
    fftSize: 2048,

    hopSize: 512,

    minDb: -70,

    maxDb: -6,

    bands: [
        [20, 80],
        [80, 250],
        [250, 800],
        [800, 2500],
        [2500, 6000],
        [6000, 16000]
    ],

    baseThickness: [
        2,
        2,
        2,
        1.5,
        1.2,
        1
    ],

    amplitudeScale: [
        35,
        30,
        25,
        20,
        15,
        10
    ],

    smoothing: 0.65,

    mirror: true,

    separators: true,

    braidAmount: 0
};
```

---

# 33. Preset limpio

```js
{
    mirror: true,
    braidAmount: 0,
    separators: true,
    lineOnly: false
}
```

Aspecto:

```text
cintas apiladas limpias
```

---

# 34. Preset topográfico

```js
{
    lineOnly: true,
    contourLevels: 8,
    mirror: true,
    separators: false
}
```

Aspecto:

```text
mapa topográfico acústico
```

---

# 35. Preset trenzado

```js
{
    mirror: true,
    braidAmount: 3,
    braidFrequency: 0.015,
    separators: true
}
```

Aspecto:

```text
cintas orgánicas
ligeramente entrelazadas
```

---

# 36. Preset DNA

```js
{
    bands: [
        [20, 300],
        [3000, 16000]
    ],

    helix: true,

    helixFrequency: 0.025,

    connectors: true
}
```

Aspecto:

```text
doble hélice sonora
```

---

# 37. Preset geológico

```js
{
    mirror: false,
    geologicalLayers: true,
    separators: true,
    layerDisplacement: 30
}
```

Aspecto:

```text
estratos de terreno
movidos por el espectro
```

---

# 38. Diferencia respecto al waveform ReCycle

El renderer ReCycle parte de:

```text
una columna vertical
```

y modifica su apariencia.

Esta propuesta parte de:

```text
bandas espectrales continuas
```

y modifica su geometría.

Por tanto, incluso sin ningún efecto de iluminación, el resultado será visualmente completamente diferente.

---

# 39. Regla principal

La información sonora debe modificar la geometría.

No limitarse a modificar colores.

La filosofía es:

```text
audio
→ forma
```

más que:

```text
audio
→ barra
→ decoración
```

---

# 40. Recomendación final

Empezar implementando únicamente:

```text
FFT
+
6 bandas
+
ribbons apilados
+
spline
```

sin shaders complejos.

Si la geometría funciona visualmente, después añadir:

```text
color por banda
desfase
trenzado
contornos
```

La primera versión debe poder verse ya radicalmente distinta de una waveform convencional.


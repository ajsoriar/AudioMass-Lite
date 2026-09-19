# Reproducción del sombreado de waveform tipo ReCycle

Este documento describe cómo implementar un waveform visual inspirado en el modo **Shaded / 3D** de Propellerhead ReCycle.

El objetivo no es dibujar una onda plana con un único color, ni separar simplemente la parte positiva y negativa con dos colores distintos. El aspecto característico procede de un **patrón de iluminación local que se repite en cada segmento vertical del waveform**.

---

## 1. Objetivo visual

El resultado debe parecer una waveform clásica de ReCycle:

- fondo lila;
- barras verticales muy finas;
- sombreado con sensación de volumen;
- highlight claro;
- transición a violeta y azul;
- sombra oscura;
- pequeño rebote de luminosidad al final;
- antialiasing en los bordes;
- eje central oscuro;
- patrón de iluminación repetido en cada segmento.

La idea visual simplificada es:

```text
             luz
              ↓

        gris/lila claro
               │
        violeta claro
               │
      azul-violeta intenso
               │
         violeta oscuro
               │
       gris/azul oscuro
               │
       pequeño rebote
```

La característica clave es que este patrón **no pertenece al canvas completo**.

Debe pertenecer a cada tramo vertical de la waveform.

---

## 2. Lo que NO hay que hacer

No implementar el sombreado como un gradiente vertical global:

```js
const gradient = ctx.createLinearGradient(
    0,
    0,
    0,
    height
);
```

Eso provoca que un píxel situado, por ejemplo, en `y = 300` tenga siempre el mismo color, independientemente del tamaño o posición del segmento de waveform.

Ese comportamiento no reproduce adecuadamente el aspecto observado.

Tampoco basta con:

```text
parte positiva = color claro
parte negativa = color oscuro
```

ni con:

```js
color = baseColor * brightness;
```

El efecto modifica de forma independiente los canales RGB y, especialmente, aumenta el componente azul en determinadas zonas.

---

## 3. Color de fondo

En las capturas analizadas, el fondo es aproximadamente:

```js
const BACKGROUND = [165, 156, 206];
```

Equivalente a:

```css
rgb(165, 156, 206)
```

Este color puede usarse como referencia inicial.

---

## 4. Estructura cromática del shading

El patrón observado no es una interpolación lineal entre dos colores.

Conviene utilizar varios puntos de control.

Una aproximación inicial:

```js
const STOPS = [
    { t: 0.00, rgb: [190, 186, 212] },
    { t: 0.08, rgb: [210, 203, 222] },
    { t: 0.25, rgb: [188, 178, 235] },
    { t: 0.45, rgb: [150, 138, 245] },
    { t: 0.65, rgb: [115, 107, 180] },
    { t: 0.90, rgb: [75, 72, 100] },
    { t: 1.00, rgb: [125, 120, 150] }
];
```

Interpretación aproximada:

```text
t = 0.00    gris/lila claro
t = 0.08    highlight claro
t = 0.25    violeta claro
t = 0.45    azul-violeta intenso
t = 0.65    violeta oscuro
t = 0.90    gris azulado muy oscuro
t = 1.00    pequeño aclarado final
```

Estos colores son una reconstrucción visual aproximada a partir de capturas y no deben considerarse la fórmula interna original de ReCycle.

---

## 5. El componente azul es importante

El efecto no consiste únicamente en variar brillo.

En las capturas aparecen colores similares a:

```text
188, 178, 235
172, 164, 242
150, 142, 249
```

Obsérvese que el canal azul aumenta mientras rojo y verde disminuyen.

Por tanto, no hacer:

```js
r = baseR * brightness;
g = baseG * brightness;
b = baseB * brightness;
```

Es preferible interpolar directamente entre colores RGB definidos.

La progresión debe aproximarse a:

```text
gris claro
→ lila
→ azul eléctrico suave
→ violeta
→ gris oscuro
```

---

## 6. Construcción de la waveform

Cuando hay muchas más muestras de audio que píxeles horizontales, conviene representar cada columna del canvas mediante el mínimo y máximo de las muestras que corresponden a esa columna.

Para cada `x`:

```js
const sampleStart =
    Math.floor(x * samplesPerPixel);

const sampleEnd =
    Math.floor((x + 1) * samplesPerPixel);
```

Calcular:

```js
let min = 1;
let max = -1;

for (
    let i = sampleStart;
    i < sampleEnd;
    i++
) {
    const v = samples[i];

    if (v < min) min = v;
    if (v > max) max = v;
}
```

Guardar:

```js
minSample[x] = min;
maxSample[x] = max;
```

Este enfoque min/max es importante para conservar los picos estrechos y las agujas verticales características.

---

## 7. Conversión de amplitud a coordenadas Y

Con un canvas de altura `height`:

```js
const centerY = height / 2;
```

Convertir máximo y mínimo:

```js
const topY =
    centerY - maxSample[x] * amplitudeScale;

const bottomY =
    centerY - minSample[x] * amplitudeScale;
```

Normalmente:

```text
topY < centerY < bottomY
```

---

## 8. El patrón debe ser LOCAL

La clave de la implementación es normalizar la posición dentro del segmento.

No usar:

```js
const t = y / height;
```

Usar una posición relativa al segmento que se está dibujando.

Por ejemplo:

```js
const t =
    (y - segmentStart) /
    (segmentEnd - segmentStart);
```

De esta forma:

```text
t = 0
```

representa siempre el comienzo local del patrón, y:

```text
t = 1
```

representa el final.

Esto permite que una barra de 20 píxeles y otra de 300 píxeles recorran el mismo patrón cromático adaptado a su longitud.

---

## 9. Reinicio del patrón

Las capturas sugieren que el shading se reinicia.

Como mínimo, tratar de forma independiente:

```text
topY → centerY
centerY → bottomY
```

Es decir:

- mitad superior;
- mitad inferior.

Para la parte superior:

```js
const t =
    (y - topY) /
    Math.max(1, centerY - topY);
```

Para la parte inferior:

```js
const t =
    (y - centerY) /
    Math.max(1, bottomY - centerY);
```

Conceptualmente:

```text
        parte positiva
        patrón 0 → 1

topY
 │
 │
 │
centerY
 │
 │
 │
bottomY

        parte negativa
        patrón 0 → 1
```

Así el patrón puede aparecer dos veces dentro de una misma columna:

```text
claro
azul
oscuro

claro
azul
oscuro
```

Esto se aproxima mucho mejor al aspecto observado que un único gradiente global.

---

## 10. Función de interpolación

Función básica:

```js
function lerp(a, b, t) {
    return a + (b - a) * t;
}
```

Interpolación RGB:

```js
function lerpColor(a, b, t) {
    return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t))
    ];
}
```

---

## 11. Smoothstep

Para evitar transiciones demasiado matemáticas o lineales, aplicar una curva suave:

```js
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}
```

Uso:

```js
localT = smoothstep(localT);
```

Esto hace que las transiciones entre stops se parezcan más a una iluminación que a un gradiente digital simple.

---

## 12. Función `recycleShade`

Ejemplo de implementación:

```js
const STOPS = [
    { t: 0.00, rgb: [190, 186, 212] },
    { t: 0.08, rgb: [210, 203, 222] },
    { t: 0.25, rgb: [188, 178, 235] },
    { t: 0.45, rgb: [150, 138, 245] },
    { t: 0.65, rgb: [115, 107, 180] },
    { t: 0.90, rgb: [75, 72, 100] },
    { t: 1.00, rgb: [125, 120, 150] }
];

function clamp01(t) {
    return Math.max(0, Math.min(1, t));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(a, b, t) {
    return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t))
    ];
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function recycleShade(t) {
    t = clamp01(t);

    for (let i = 0; i < STOPS.length - 1; i++) {
        const a = STOPS[i];
        const b = STOPS[i + 1];

        if (t >= a.t && t <= b.t) {
            let localT =
                (t - a.t) /
                Math.max(0.000001, b.t - a.t);

            localT = smoothstep(localT);

            return lerpColor(
                a.rgb,
                b.rgb,
                localT
            );
        }
    }

    return STOPS[STOPS.length - 1].rgb;
}
```

---

## 13. Renderer por segmento

La arquitectura debe incluir explícitamente una función para dibujar un segmento vertical sombreado.

```js
function drawShadedSegment(
    imageData,
    x,
    y1,
    y2
) {
    y1 = Math.round(y1);
    y2 = Math.round(y2);

    if (y2 < y1) {
        const tmp = y1;
        y1 = y2;
        y2 = tmp;
    }

    const length =
        Math.max(1, y2 - y1);

    for (
        let y = y1;
        y <= y2;
        y++
    ) {
        const t =
            (y - y1) / length;

        const rgb =
            recycleShade(t);

        setPixel(
            imageData,
            x,
            y,
            rgb
        );
    }
}
```

Después:

```js
drawShadedSegment(
    imageData,
    x,
    topY,
    centerY
);

drawShadedSegment(
    imageData,
    x,
    centerY,
    bottomY
);
```

Esta separación es importante porque permite experimentar con distintos reinicios del patrón.

---

## 14. Dos modos que conviene probar

Las capturas permiten al menos dos interpretaciones plausibles.

### Modo A — un ciclo por cada mitad

```text
topY → centerY
centerY → bottomY
```

Es el punto de partida recomendado.

### Modo B — un ciclo por cada tramo continuo

Si el renderer genera diferentes tramos dentro de una misma columna, aplicar:

```js
drawShadedSegment(
    x,
    segmentStart,
    segmentEnd
);
```

independientemente para cada uno.

La implementación no debe depender de un gradiente global, para poder alternar fácilmente entre ambos modelos.

---

## 15. Renderizado con `ImageData`

Para máxima fidelidad y rendimiento razonable, es recomendable generar la imagen directamente en memoria:

```js
const imageData =
    ctx.createImageData(width, height);
```

Rellenar primero el fondo:

```js
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        setPixel(
            imageData,
            x,
            y,
            BACKGROUND
        );
    }
}
```

Después renderizar la waveform.

Finalmente:

```js
ctx.putImageData(
    imageData,
    0,
    0
);
```

Esto evita crear miles de objetos `CanvasGradient`.

---

## 16. Función `setPixel`

Ejemplo:

```js
function setPixel(
    imageData,
    x,
    y,
    rgb,
    alpha = 255
) {
    if (
        x < 0 ||
        y < 0 ||
        x >= imageData.width ||
        y >= imageData.height
    ) {
        return;
    }

    const index =
        (y * imageData.width + x) * 4;

    imageData.data[index + 0] = rgb[0];
    imageData.data[index + 1] = rgb[1];
    imageData.data[index + 2] = rgb[2];
    imageData.data[index + 3] = alpha;
}
```

---

## 17. Iluminación diferente arriba y abajo

No es obligatorio que la parte positiva y negativa sean un espejo cromático perfecto.

El aspecto de ReCycle parece simular iluminación desde arriba.

Se puede introducir una ligera diferencia:

```js
function shadePositive(t) {
    return recycleShade(t);
}

function shadeNegative(t) {
    const rgb = recycleShade(t);

    return [
        Math.round(rgb[0] * 0.95),
        Math.round(rgb[1] * 0.95),
        Math.round(rgb[2] * 0.98)
    ];
}
```

O tener dos tablas de stops distintas.

Por ejemplo, la mitad superior puede recibir más highlight y la inferior algo más de sombra.

Debe ser una diferencia sutil.

---

## 18. Edge highlight

Además del shading principal, conviene probar un ligero highlight en uno de los bordes del segmento.

Color aproximado:

```js
const EDGE_LIGHT = [205, 200, 225];
```

Sombra:

```js
const EDGE_DARK = [60, 58, 80];
```

Pero no aplicar estos colores como líneas absolutamente sólidas.

Mejor mezclar:

```js
function mixColor(a, b, amount) {
    return [
        Math.round(lerp(a[0], b[0], amount)),
        Math.round(lerp(a[1], b[1], amount)),
        Math.round(lerp(a[2], b[2], amount))
    ];
}
```

Ejemplo:

```js
pixelColor = mixColor(
    shadeColor,
    EDGE_LIGHT,
    0.20
);
```

Valores iniciales razonables:

```text
edgeStrength = 0.15 ... 0.35
```

No exagerarlo.

---

## 19. Antialiasing

La onda observada contiene píxeles intermedios mezclados con el fondo.

No tratar la máscara como:

```text
waveform = 1
background = 0
```

Para un píxel parcialmente cubierto:

```js
finalColor =
    waveformColor * coverage +
    backgroundColor * (1 - coverage);
```

Implementación:

```js
function blendCoverage(
    waveform,
    background,
    coverage
) {
    return [
        Math.round(
            waveform[0] * coverage +
            background[0] * (1 - coverage)
        ),

        Math.round(
            waveform[1] * coverage +
            background[1] * (1 - coverage)
        ),

        Math.round(
            waveform[2] * coverage +
            background[2] * (1 - coverage)
        )
    ];
}
```

Valores posibles:

```text
0.25
0.50
0.75
1.00
```

Los píxeles centrales de la barra pueden usar cobertura `1`, y los bordes una cobertura parcial.

---

## 20. Eje central

El eje `0` debe dibujarse independientemente.

Ejemplo:

```js
ctx.fillStyle =
    "rgba(20, 18, 30, 0.75)";

ctx.fillRect(
    0,
    Math.round(centerY),
    width,
    1
);
```

Puede ajustarse hacia:

```css
rgb(30, 28, 40)
```

según el contraste deseado.

Conviene permitir probar dos órdenes de composición:

```text
1. eje primero + waveform encima
2. waveform primero + eje encima
```

Las capturas sugieren que la línea central sigue siendo bastante visible.

---

## 21. Pipeline completo

La implementación debería seguir aproximadamente esta secuencia:

```text
AudioBuffer
   ↓
obtener channelData
   ↓
calcular samplesPerPixel
   ↓
min/max por X
   ↓
convertir amplitud a topY/bottomY
   ↓
rellenar fondo
   ↓
para cada X:
       dibujar segmento superior
       dibujar segmento inferior
   ↓
aplicar edge highlight / antialiasing
   ↓
dibujar eje central
   ↓
putImageData
```

Pseudocódigo:

```js
function renderWaveform(
    ctx,
    samples,
    width,
    height
) {
    const centerY = height / 2;

    const imageData =
        ctx.createImageData(
            width,
            height
        );

    fillBackground(
        imageData,
        BACKGROUND
    );

    const samplesPerPixel =
        samples.length / width;

    for (
        let x = 0;
        x < width;
        x++
    ) {
        const range =
            calculateMinMax(
                samples,
                x,
                samplesPerPixel
            );

        const topY =
            centerY -
            range.max * centerY;

        const bottomY =
            centerY -
            range.min * centerY;

        drawShadedSegment(
            imageData,
            x,
            topY,
            centerY
        );

        drawShadedSegment(
            imageData,
            x,
            centerY,
            bottomY
        );
    }

    ctx.putImageData(
        imageData,
        0,
        0
    );

    drawZeroAxis(
        ctx,
        centerY,
        width
    );
}
```

---

## 22. Optimización

Para un waveform grande:

### Precalcular la paleta

En lugar de ejecutar interpolaciones RGB para cada píxel:

```js
const SHADE_LUT_SIZE = 256;

const shadeLUT =
    new Array(SHADE_LUT_SIZE);

for (
    let i = 0;
    i < SHADE_LUT_SIZE;
    i++
) {
    shadeLUT[i] =
        recycleShade(
            i /
            (SHADE_LUT_SIZE - 1)
        );
}
```

Durante el render:

```js
const index =
    Math.min(
        255,
        Math.round(t * 255)
    );

const rgb =
    shadeLUT[index];
```

Esto reduce mucho el coste.

---

## 23. Escalado HiDPI

Si se utiliza un canvas con `devicePixelRatio`, separar:

```text
tamaño CSS
```

de:

```text
resolución real del canvas
```

Ejemplo:

```js
const dpr =
    window.devicePixelRatio || 1;

canvas.width =
    cssWidth * dpr;

canvas.height =
    cssHeight * dpr;

canvas.style.width =
    `${cssWidth}px`;

canvas.style.height =
    `${cssHeight}px`;
```

Si se quiere mantener el aspecto pixelado clásico de ReCycle, puede resultar preferible renderizar a resolución lógica 1:1 y escalar posteriormente con:

```css
image-rendering: pixelated;
```

si el diseño lo requiere.

---

## 24. Parámetros que deben quedar configurables

No hardcodear completamente el efecto.

Conviene exponer:

```js
const config = {
    background: [165, 156, 206],

    stops: STOPS,

    positiveBrightness: 1.0,
    negativeBrightness: 0.95,

    edgeLightStrength: 0.20,
    edgeDarkStrength: 0.20,

    axisColor: [30, 28, 40],
    axisAlpha: 0.75,

    useSmoothstep: true,

    repeatMode: "half-wave",

    antialias: true
};
```

Posibles valores de `repeatMode`:

```text
"full-column"
"half-wave"
"continuous-segment"
```

El modo recomendado para empezar:

```js
repeatMode: "half-wave"
```

---

## 25. Criterios visuales de validación

La implementación es correcta si se observan estas propiedades:

- las barras tienen volumen;
- el azul aparece en la zona intermedia;
- el patrón se adapta a la longitud de cada barra;
- una barra corta y una larga muestran la misma progresión cromática;
- el sombreado no depende únicamente de la coordenada Y global;
- el eje central permanece visible;
- los picos estrechos siguen siendo finos;
- no parece un waveform moderno plano;
- la parte inferior puede verse ligeramente más oscura;
- existe un pequeño aclarado o "cap" en el extremo final;
- no hay cortes bruscos entre los stops;
- las líneas conservan cierto antialiasing.

---

## 26. Errores que hay que evitar

### Error 1

Usar un único gradiente para todo el canvas.

```js
ctx.createLinearGradient(
    0,
    0,
    0,
    height
);
```

Incorrecto para este efecto.

### Error 2

Usar solamente dos colores.

```text
arriba claro
abajo oscuro
```

Insuficiente.

### Error 3

Modificar solamente luminancia.

La saturación azul cambia significativamente.

### Error 4

Dibujar cada sample individual cuando hay miles por píxel.

Debe utilizarse min/max por columna.

### Error 5

Hacer la mitad inferior exactamente simétrica.

Puede servir como primera versión, pero el resultado final debería permitir una iluminación ligeramente asimétrica.

### Error 6

Usar bordes negros demasiado marcados.

Los bordes deben mezclarse con el shading y con el fondo.

---

## 27. Orden recomendado de implementación

### Fase 1

Implementar:

```text
min/max
+
segmentos verticales
+
STOPS RGB
```

Sin antialiasing.

### Fase 2

Separar:

```text
top → center
center → bottom
```

para comprobar el reinicio del patrón.

### Fase 3

Añadir:

```text
smoothstep
```

### Fase 4

Añadir:

```text
edge highlight
edge shadow
```

### Fase 5

Añadir antialiasing.

### Fase 6

Ajustar independientemente parte positiva y negativa.

### Fase 7

Comparar visualmente contra la referencia y reajustar los stops.

---

## 28. Hipótesis visual principal

La hipótesis de trabajo que mejor encaja con las capturas es:

> Cada tramo vertical de la waveform utiliza una rampa de iluminación local. La rampa comienza con un highlight gris-lila, atraviesa una zona azul-violeta saturada, se oscurece progresivamente y termina con un pequeño rebote de luminosidad. Esta rampa se escala a la longitud del segmento y se reinicia, como mínimo, entre la parte positiva y negativa de la waveform.

Esto explica por qué varias barras de alturas distintas muestran estructuras de iluminación similares.

---

## 29. Nota sobre ReCycle

La documentación histórica de ReCycle describe modos visuales como **Plain**, **3D** y **Shaded**, y el modo Shaded se ha descrito como una iluminación procedente de arriba.

Sin embargo, no se dispone aquí del código fuente ni de la fórmula interna exacta del renderer original.

Por tanto, esta implementación debe considerarse una **reconstrucción visual**, basada en:

- documentación histórica;
- inspección de capturas;
- análisis de píxeles;
- comportamiento observado del patrón.

El objetivo práctico es reproducir fielmente la apariencia, no replicar necesariamente el algoritmo interno original bit a bit.

---

## 30. Resumen técnico

La idea esencial puede resumirse así:

```text
MIN/MAX POR COLUMNA
        +
PATRÓN CROMÁTICO LOCAL
        +
VARIOS COLOR STOPS RGB
        +
REINICIO DEL PATRÓN
        +
AZUL INTERMEDIO MARCADO
        +
SOMBRA
        +
EDGE HIGHLIGHT
        +
ANTIALIASING
```

Y la regla más importante:

> **No tratar el efecto como un gradiente vertical global del canvas. El shading debe pertenecer al segmento de waveform que se está dibujando.**


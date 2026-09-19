# Classic Pixel Waveform
## Visualización clásica de forma de onda para editores de audio

Este documento describe una visualización de waveform deliberadamente clásica, similar a la utilizada durante décadas por editores de audio, samplers y DAWs.

El objetivo es obtener una onda:

- sólida;
- plana;
- de un único color;
- perfectamente legible;
- con bordes duros;
- sin degradados;
- sin sombras;
- sin transparencias;
- sin efectos 3D;
- sin glow;
- sin suavizado visual;
- sin antialiasing.

La referencia conceptual es el aspecto tradicional de programas como Audacity y numerosos editores de audio clásicos.

---

# 1. Filosofía visual

La waveform debe representar el audio de la forma más directa posible.

```text
audio
  ↓
amplitud
  ↓
coordenadas verticales
  ↓
píxeles sólidos
```

No se intenta representar iluminación, profundidad ni materiales.

Cada píxel pertenece claramente a uno de dos estados:

```text
BACKGROUND
WAVEFORM
```

Por ejemplo:

```js
const BACKGROUND_COLOR = [238, 241, 250];
const WAVEFORM_COLOR   = [90, 95, 220];
```

No debe existir interpolación entre ambos colores.

---

# 2. Resultado visual esperado

Aspecto aproximado:

```text
                    │
          │     │   │ │
      │   ││ │ ││  │ │
──────████████████████████────────
      │████████████████│
          │ │██████│
              │
```

Los picos son finos y duros.

Las zonas densas forman masas sólidas.

La línea central permanece claramente identificable.

---

# 3. No utilizar antialiasing

Este punto es fundamental.

No utilizar trazados vectoriales normales de Canvas si producen suavizado de los bordes.

Evitar, por ejemplo:

```js
ctx.beginPath();
ctx.moveTo(...);
ctx.lineTo(...);
ctx.stroke();
```

si el navegador introduce píxeles semitransparentes.

No utilizar:

```css
filter
```

ni:

```js
ctx.shadowBlur
```

ni alpha parcial para el waveform.

El renderer ideal escribe directamente píxeles enteros.

---

# 4. Renderizar mediante `ImageData`

La opción más controlable es:

```js
const imageData =
    ctx.createImageData(
        width,
        height
    );
```

Rellenar primero el fondo y después escribir directamente los píxeles correspondientes a la waveform.

Finalmente:

```js
ctx.putImageData(
    imageData,
    0,
    0
);
```

`putImageData()` evita que Canvas vuelva a rasterizar geometría vectorial y permite controlar exactamente cada píxel.

---

# 5. Fondo

Ejemplo:

```js
const BACKGROUND = [
    239,
    242,
    250,
    255
];
```

Debe ser completamente opaco.

No utilizar transparencia:

```js
alpha = 255;
```

---

# 6. Color de la waveform

Usar un solo color sólido.

Por ejemplo:

```js
const WAVE_COLOR = [
    95,
    95,
    220,
    255
];
```

Alternativas:

```js
// Azul clásico
[70, 90, 210, 255]

// Azul-violeta
[90, 85, 220, 255]

// Azul oscuro
[50, 70, 180, 255]

// Negro
[20, 20, 20, 255]
```

Todos los píxeles interiores de la waveform deben tener exactamente el mismo color.

---

# 7. Línea central

La línea de amplitud cero puede representarse mediante un color independiente.

Ejemplo:

```js
const ZERO_LINE_COLOR = [
    45,
    45,
    55,
    255
];
```

Posición:

```js
const centerY =
    Math.floor(height / 2);
```

Dibujar:

```js
for (
    let x = 0;
    x < width;
    x++
) {
    setPixel(
        imageData,
        x,
        centerY,
        ZERO_LINE_COLOR
    );
}
```

Puede dibujarse antes o después de la waveform.

Para el aspecto clásico suele funcionar bien dibujarla al final.

---

# 8. Regla básica de rasterización

Cada columna X del canvas debe representar el rango mínimo/máximo del audio correspondiente a ese intervalo temporal.

Para cada X:

```text
minSample
maxSample
```

Convertidos a:

```text
topY
bottomY
```

Después se rellena:

```text
desde topY
hasta bottomY
```

con el mismo color.

---

# 9. Min/max por columna

Cuando hay más muestras de audio que píxeles horizontales:

```js
const samplesPerPixel =
    samples.length / width;
```

Para cada columna:

```js
const start =
    Math.floor(
        x * samplesPerPixel
    );

const end =
    Math.floor(
        (x + 1) * samplesPerPixel
    );
```

Calcular mínimo y máximo:

```js
let min = 1;
let max = -1;

for (
    let i = start;
    i < end;
    i++
) {
    const sample =
        samples[i];

    if (sample < min) {
        min = sample;
    }

    if (sample > max) {
        max = sample;
    }
}
```

Este método es fundamental.

No utilizar únicamente:

```js
samples[start]
```

porque desaparecerían muchos picos rápidos.

---

# 10. Conversión de amplitud a Y

Para audio normalizado:

```text
-1 ... +1
```

usar:

```js
const centerY =
    Math.floor(height / 2);

const amplitudeHeight =
    centerY - 1;
```

Máximo positivo:

```js
const topY =
    centerY -
    Math.round(
        max * amplitudeHeight
    );
```

Mínimo negativo:

```js
const bottomY =
    centerY -
    Math.round(
        min * amplitudeHeight
    );
```

Como `min` normalmente es negativo:

```text
bottomY > centerY
```

---

# 11. Importante: coordenadas enteras

No utilizar posiciones subpíxel.

Evitar:

```js
y = 24.37;
```

Convertir siempre:

```js
y =
    Math.round(y);
```

o:

```js
y =
    Math.floor(y);
```

El objetivo es que la geometría termine exactamente sobre la cuadrícula física de píxeles.

---

# 12. Dibujar una columna

Función básica:

```js
function drawWaveColumn(
    imageData,
    x,
    topY,
    bottomY,
    color
) {
    topY =
        Math.round(topY);

    bottomY =
        Math.round(bottomY);

    if (topY > bottomY) {
        const temp = topY;
        topY = bottomY;
        bottomY = temp;
    }

    for (
        let y = topY;
        y <= bottomY;
        y++
    ) {
        setPixel(
            imageData,
            x,
            y,
            color
        );
    }
}
```

No existen:

```text
edgeColor
highlight
shadow
coverage
opacity
```

Toda la columna utiliza exactamente:

```js
WAVE_COLOR
```

---

# 13. `setPixel`

Implementación:

```js
function setPixel(
    imageData,
    x,
    y,
    color
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
        (
            y * imageData.width +
            x
        ) * 4;

    imageData.data[index] =
        color[0];

    imageData.data[index + 1] =
        color[1];

    imageData.data[index + 2] =
        color[2];

    imageData.data[index + 3] =
        color[3];
}
```

---

# 14. Rellenar el fondo

```js
function clearImage(
    imageData,
    color
) {
    const data =
        imageData.data;

    for (
        let i = 0;
        i < data.length;
        i += 4
    ) {
        data[i]     = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = color[3];
    }
}
```

---

# 15. Renderer completo básico

```js
function renderClassicWaveform(
    ctx,
    samples,
    width,
    height
) {
    const imageData =
        ctx.createImageData(
            width,
            height
        );

    const BACKGROUND = [
        239,
        242,
        250,
        255
    ];

    const WAVE_COLOR = [
        90,
        90,
        220,
        255
    ];

    const ZERO_COLOR = [
        50,
        50,
        60,
        255
    ];

    clearImage(
        imageData,
        BACKGROUND
    );

    const centerY =
        Math.floor(
            height / 2
        );

    const amplitudeHeight =
        Math.max(
            1,
            centerY - 1
        );

    const samplesPerPixel =
        samples.length / width;

    for (
        let x = 0;
        x < width;
        x++
    ) {
        const start =
            Math.floor(
                x * samplesPerPixel
            );

        const end =
            Math.min(
                samples.length,
                Math.max(
                    start + 1,
                    Math.floor(
                        (x + 1) *
                        samplesPerPixel
                    )
                )
            );

        let min = 1;
        let max = -1;

        for (
            let i = start;
            i < end;
            i++
        ) {
            const value =
                samples[i];

            if (value < min) {
                min = value;
            }

            if (value > max) {
                max = value;
            }
        }

        const topY =
            centerY -
            Math.round(
                max *
                amplitudeHeight
            );

        const bottomY =
            centerY -
            Math.round(
                min *
                amplitudeHeight
            );

        drawWaveColumn(
            imageData,
            x,
            topY,
            bottomY,
            WAVE_COLOR
        );
    }

    // Línea cero.
    for (
        let x = 0;
        x < width;
        x++
    ) {
        setPixel(
            imageData,
            x,
            centerY,
            ZERO_COLOR
        );
    }

    ctx.putImageData(
        imageData,
        0,
        0
    );
}
```

---

# 16. Forma clásica versus línea de muestra

A zoom lejano debe utilizarse:

```text
MIN/MAX POR PÍXEL
```

A zoom muy cercano puede ser interesante mostrar la muestra real.

Cuando:

```js
samplesPerPixel <= 1
```

cada muestra tiene espacio horizontal propio.

Se puede entonces dibujar:

```text
sample[x]
sample[x+1]
```

como escalones o segmentos.

Sin embargo, si se quiere conservar estrictamente el aspecto pixelado, evitar antialiasing también en este modo.

---

# 17. Modo "sample sticks"

Una variante clásica consiste en dibujar cada muestra desde el eje cero hasta su amplitud:

```text
      │
      │
  │   │
  │ │ │
──│─│─│────
    │
    │
```

Para cada muestra:

```js
drawVerticalLine(
    x,
    centerY,
    sampleY,
    WAVE_COLOR
);
```

Este modo es útil con zoom extremo.

---

# 18. Modo "connected samples"

Otra vista tradicional a mucho zoom:

```text
       ●
      / \
  ●──●   \
 /        ●
●
```

Pero si se desea mantener el estilo sin antialiasing, la línea debe rasterizarse manualmente.

Puede utilizarse:

```text
algoritmo de Bresenham
```

en lugar de:

```js
ctx.lineTo()
```

---

# 19. Bresenham

Ejemplo:

```js
function drawLine(
    imageData,
    x0,
    y0,
    x1,
    y1,
    color
) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);

    const dx =
        Math.abs(x1 - x0);

    const sx =
        x0 < x1 ? 1 : -1;

    const dy =
        -Math.abs(y1 - y0);

    const sy =
        y0 < y1 ? 1 : -1;

    let err =
        dx + dy;

    while (true) {
        setPixel(
            imageData,
            x0,
            y0,
            color
        );

        if (
            x0 === x1 &&
            y0 === y1
        ) {
            break;
        }

        const e2 =
            2 * err;

        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }

        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
}
```

Bresenham produce líneas completamente pixeladas y sin antialiasing.

---

# 20. Zoom automático por modos

Se pueden definir tres niveles:

```js
if (samplesPerPixel > 1) {
    renderMinMax();
}
else if (pixelsPerSample < 8) {
    renderConnectedSamples();
}
else {
    renderSamplePoints();
}
```

Por ejemplo:

### Zoom lejano

```text
min/max vertical
```

### Zoom medio

```text
línea pixelada entre muestras
```

### Zoom extremo

```text
puntos + línea
```

---

# 21. Puntos de muestra

A mucho zoom:

```js
const POINT_SIZE = 3;
```

Dibujar:

```text
███
███
███
```

centrado en la muestra.

No usar círculos antialiasados.

Ejemplo:

```js
function drawSquarePoint(
    imageData,
    x,
    y,
    size,
    color
) {
    const half =
        Math.floor(size / 2);

    for (
        let py = y - half;
        py <= y + half;
        py++
    ) {
        for (
            let px = x - half;
            px <= x + half;
            px++
        ) {
            setPixel(
                imageData,
                px,
                py,
                color
            );
        }
    }
}
```

---

# 22. Evitar huecos artificiales

Cuando el rango min/max de una columna es prácticamente cero, debería dibujarse al menos un píxel.

Ejemplo:

```js
if (
    topY === bottomY
) {
    setPixel(
        imageData,
        x,
        topY,
        WAVE_COLOR
    );
}
```

Así el silencio parcial o señales de amplitud muy pequeña siguen siendo visibles.

---

# 23. Señal estéreo

Hay dos visualizaciones clásicas.

## Canales separados

```text
LEFT

~~~~~~~~~~~~~~
──────────────

RIGHT

~~~~~~~~~~~~~~
──────────────
```

Cada canal dispone de su propio:

```js
centerY
```

## Canales superpuestos

Ambos canales pueden compartir centro, utilizando colores distintos.

Para un editor clásico es preferible normalmente mostrarlos separados.

---

# 24. Canal estéreo separado

Si:

```js
height = 400;
```

puede utilizarse:

```js
const channelHeight =
    Math.floor(
        height / 2
    );

const leftTop = 0;

const rightTop =
    channelHeight;
```

Cada canal se renderiza independientemente dentro de su viewport.

---

# 25. Clipping

Si una muestra supera el rango:

```text
-1 ... +1
```

hacer clamp:

```js
function clampSample(v) {
    return Math.max(
        -1,
        Math.min(
            1,
            v
        )
    );
}
```

Opcionalmente se pueden marcar muestras clippeadas con un color específico:

```js
const CLIP_COLOR = [
    220,
    50,
    50,
    255
];
```

Pero esto es una función adicional, no parte del estilo básico.

---

# 26. Picos máximos

Otra función clásica opcional es mostrar una línea de pico.

Por ejemplo, para cada bloque:

```js
peak =
    Math.max(
        Math.abs(min),
        Math.abs(max)
    );
```

No es necesario para la representación base.

---

# 27. Escalado vertical

Permitir:

```js
verticalZoom
```

Ejemplo:

```js
const displayValue =
    clampSample(
        sample *
        verticalZoom
    );
```

Valores:

```text
1.0 = normal
2.0 = doble zoom vertical
4.0 = cuatro veces
```

---

# 28. Escala lineal

La visualización clásica debe utilizar inicialmente amplitud lineal:

```js
display =
    sample;
```

No convertir amplitud a dB para calcular la altura.

La escala dB puede implementarse como modo alternativo, pero modifica mucho la geometría.

---

# 29. Variante dB opcional

Si se desea:

```js
const sign =
    Math.sign(sample);

const abs =
    Math.abs(sample);

const db =
    20 *
    Math.log10(
        abs + 1e-10
    );
```

Después mapear:

```text
-60 dB → 0
0 dB   → 1
```

Pero no debe ser el comportamiento predeterminado.

---

# 30. Pixel ratio

Para conservar exactamente el estilo pixelado hay que tener cuidado con `devicePixelRatio`.

Si el canvas interno tiene:

```text
2 píxeles físicos
```

por cada:

```text
1 píxel CSS
```

el navegador podría volver a escalar la imagen.

Una estrategia simple consiste en renderizar directamente a la resolución física:

```js
const dpr =
    window.devicePixelRatio || 1;

canvas.width =
    Math.floor(
        cssWidth * dpr
    );

canvas.height =
    Math.floor(
        cssHeight * dpr
    );
```

Todos los cálculos deben usar entonces esa resolución.

---

# 31. Alternativa para estética realmente retro

Renderizar a una resolución lógica menor.

Ejemplo:

```text
600 × 200
```

y mostrarlo a:

```text
1200 × 400
```

con:

```css
canvas {
    image-rendering: pixelated;
}
```

Así cada píxel lógico se convierte en un bloque perfectamente definido.

---

# 32. Selección temporal

Una selección clásica puede representarse cambiando solamente el fondo.

Por ejemplo:

```js
const SELECTION_BACKGROUND = [
    205,
    215,
    245,
    255
];
```

No hace falta modificar la waveform.

Pipeline:

```text
fondo normal
↓
fondo de selección
↓
waveform
↓
línea central
```

---

# 33. Cursor

Cursor clásico:

```js
const CURSOR_COLOR = [
    20,
    20,
    20,
    255
];
```

Una línea vertical de un píxel:

```js
for (
    let y = 0;
    y < height;
    y++
) {
    setPixel(
        imageData,
        cursorX,
        y,
        CURSOR_COLOR
    );
}
```

---

# 34. Grid temporal

Opcionalmente:

```text
segundos
beats
frames
```

dibujar líneas verticales antes de la waveform.

Ejemplo:

```js
const GRID_COLOR = [
    210,
    213,
    220,
    255
];
```

El grid debe ser discreto.

---

# 35. Orden de composición

Orden recomendado:

```text
1. background
2. selection background
3. grid
4. waveform
5. zero line
6. sample points
7. playhead / cursor
```

---

# 36. Rendimiento

Para archivos largos no volver a recorrer todas las muestras en cada frame.

Precalcular niveles de resolución.

Por ejemplo:

```text
nivel 0 = muestras originales
nivel 1 = min/max cada 2 muestras
nivel 2 = min/max cada 4 muestras
nivel 3 = min/max cada 8 muestras
nivel 4 = min/max cada 16 muestras
...
```

Esto forma una pirámide de waveform.

---

# 37. Pirámide min/max

Cada nivel guarda:

```js
{
    min,
    max
}
```

El siguiente nivel combina dos bloques:

```js
next.min =
    Math.min(
        a.min,
        b.min
    );

next.max =
    Math.max(
        a.max,
        b.max
    );
```

Esto permite representar horas de audio sin escanear continuamente millones de muestras.

---

# 38. Elección del nivel

En función de:

```js
samplesPerPixel
```

seleccionar el nivel cuyo bloque tenga una resolución próxima.

Ejemplo:

```text
1 sample/pixel    → nivel 0
4 samples/pixel   → nivel 2
16 samples/pixel  → nivel 4
256 samples/pixel → nivel 8
```

---

# 39. Caché de waveform

Para una aplicación de edición conviene almacenar:

```js
waveformCache = {
    channel0: levels,
    channel1: levels
};
```

La representación visual puede reconstruirse rápidamente para cualquier zoom.

---

# 40. Configuración sugerida

```js
const classicWaveformConfig = {
    background: [
        239,
        242,
        250,
        255
    ],

    waveform: [
        90,
        90,
        220,
        255
    ],

    zeroLine: [
        50,
        50,
        60,
        255
    ],

    grid: [
        210,
        213,
        220,
        255
    ],

    selectionBackground: [
        205,
        215,
        245,
        255
    ],

    scale: "linear",

    antialias: false,

    gradients: false,

    shadows: false,

    transparency: false,

    minMax: true,

    minimumPixelHeight: 1,

    zeroLineEnabled: true
};
```

---

# 41. Criterios visuales

La implementación es correcta si:

- todos los píxeles de waveform tienen el mismo color;
- los bordes son duros;
- no aparecen halos;
- no existen píxeles semitransparentes;
- no existen degradados;
- no hay efectos de luz;
- los picos rápidos siguen visibles;
- las zonas densas forman bloques sólidos;
- el silencio se aproxima claramente a la línea central;
- la waveform sigue siendo legible con mucho zoom out;
- la apariencia recuerda a los editores de audio tradicionales.

---

# 42. Errores a evitar

## No usar `stroke()`

si provoca antialiasing:

```js
ctx.stroke();
```

## No usar transparencias

```js
rgba(..., 0.5)
```

para el waveform principal.

## No usar gradientes

```js
createLinearGradient()
```

## No utilizar blur

```js
filter = "blur(...)"
```

## No suavizar min/max

Los picos deben conservar su forma real.

## No promediar las muestras

Incorrecto:

```js
average =
    sum / count;
```

para construir la altura de la waveform.

El promedio puede eliminar transitorios.

Utilizar:

```text
MIN + MAX
```

---

# 43. Por qué min/max y no promedio

Supongamos este grupo:

```text
0.02
0.04
0.03
0.95
0.02
```

El promedio es aproximadamente:

```text
0.21
```

Si se dibuja el promedio, el pico:

```text
0.95
```

desaparece.

Con min/max:

```text
min = 0.02
max = 0.95
```

el transitorio queda correctamente representado.

Esta es una característica esencial de una waveform de editor de audio.

---

# 44. Mono clásico

El caso más sencillo:

```text
un canal
un centro
un color
un píxel por X
min/max
```

Debe implementarse primero.

Después añadir:

```text
stereo
zoom
selección
cursor
grid
```

---

# 45. Implementación mínima recomendada

Para una primera versión sólo son necesarios cinco elementos:

```text
1. ImageData
2. background sólido
3. min/max por columna
4. relleno vertical sólido
5. línea central
```

Todo lo demás es opcional.

---

# 46. Resumen

La visualización clásica debe obedecer esta regla:

> Cada columna horizontal representa el mínimo y máximo real del audio contenido en ese intervalo temporal y se dibuja como una línea vertical de píxeles sólidos de un único color.

La fórmula conceptual es:

```text
AUDIO
 ↓
MIN/MAX POR COLUMNA
 ↓
TOP Y / BOTTOM Y
 ↓
RELLENO DE PÍXELES
 ↓
WAVEFORM CLÁSICA
```

Sin:

```text
gradientes
antialiasing
shaders
iluminación
texturas
transparencia
blur
3D
```

El resultado debe priorizar:

```text
precisión
legibilidad
simplicidad
velocidad
```

por encima de cualquier efecto decorativo.

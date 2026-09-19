# Variaciones creativas para pintar waveforms

Este documento reúne varias ideas para evolucionar el waveform sombreado tipo ReCycle hacia estilos más tridimensionales, metálicos, líquidos, holográficos o reactivos al propio contenido del audio.

La idea base es conservar el enfoque ya implementado:

```text
min/max por columna
+
segmentos verticales
+
shading local
+
paleta violeta/azul
```

y añadir capas de iluminación o análisis sin perder la legibilidad de la waveform.

---

# 1. Objetivo general

El waveform actual ya tiene una sensación de volumen vertical. Las siguientes técnicas buscan añadir:

- volumen horizontal;
- iluminación dependiente de la geometría;
- reflejos especulares;
- bordes tipo cristal;
- cambios según energía;
- cambios según contenido espectral;
- destellos en transitorios;
- deformaciones líquidas;
- interferencias holográficas;
- densidad estadística;
- sensación de superficie 3D continua.

La recomendación principal es no sustituir el shading existente, sino usarlo como base y combinarlo con nuevas capas.

---

# 2. Arquitectura recomendada

Separar el renderer en varias fases:

```text
audio
↓
min/max por columna
↓
métricas auxiliares
↓
shading vertical base
↓
shading horizontal
↓
efectos opcionales
↓
antialiasing
↓
composición final
```

Una estructura posible:

```js
function renderWaveformColumn(x, data, config) {
    const geometry = calculateGeometry(x, data);
    const metrics = calculateMetrics(x, data);

    let color = baseRecycleShade(
        geometry.localT
    );

    color = applyHorizontalLighting(
        color,
        metrics,
        config
    );

    color = applyEnergyShading(
        color,
        metrics,
        config
    );

    color = applyFresnel(
        color,
        geometry,
        config
    );

    color = applySpectralTint(
        color,
        metrics,
        config
    );

    color = applyAttackGlow(
        color,
        metrics,
        config
    );

    return color;
}
```

Cada efecto debe poder activarse o desactivarse.

---

# 3. Efecto 1 — Cilindro metálico por segmento

En vez de interpretar cada barra como un simple degradado, imaginar que cada tramo vertical es la proyección de una superficie curva.

Para una posición normalizada:

```js
const u = t * 2 - 1;
```

donde:

```text
t = 0   inicio del segmento
t = 1   final del segmento
u = -1..1
```

Calcular una falsa profundidad:

```js
const z = Math.sqrt(
    Math.max(0, 1 - u * u)
);
```

Esto equivale a la sección de un cilindro.

Una normal aproximada:

```js
const normal = normalize([
    u,
    z
]);
```

Luz:

```js
const light = normalize([
    -0.4,
    1.0
]);
```

Difusa:

```js
const diffuse =
    Math.max(
        0,
        dot(normal, light)
    );
```

Especular aproximada:

```js
const specular =
    Math.pow(
        Math.max(0, diffuse),
        20
    );
```

Color final:

```js
color =
    baseColor * ambient
    +
    lightColor * diffuse
    +
    white * specular;
```

Valores iniciales:

```js
const ambient = 0.45;
const diffuseStrength = 0.75;
const specularStrength = 0.35;
const shininess = 20;
```

Resultado esperado:

```text
waveform metálico
tipo aluminio violeta
con highlight curvo
```

---

# 4. Efecto 2 — Iluminación por pendiente horizontal

Este es uno de los efectos más interesantes.

La columna actual debe conocer la altura de sus vecinas.

Calcular una amplitud representativa:

```js
const height =
    Math.max(
        Math.abs(maxSample[x]),
        Math.abs(minSample[x])
    );
```

Pendiente horizontal:

```js
const slope =
    height[x + 1] -
    height[x - 1];
```

Normal aproximada:

```js
const nx =
    -slope * strength;

const ny = 1;

const len =
    Math.sqrt(
        nx * nx +
        ny * ny
    );

const normalX = nx / len;
const normalY = ny / len;
```

Dirección de luz:

```js
const lightX = -0.45;
const lightY = 0.9;
```

Producto escalar:

```js
const lighting =
    Math.max(
        0,
        normalX * lightX +
        normalY * lightY
    );
```

Aplicarlo suavemente:

```js
color = multiplyBrightness(
    color,
    0.75 + lighting * 0.35
);
```

Resultado:

```text
las pendientes hacia la luz brillan
las pendientes contrarias se oscurecen
```

Visualmente la waveform deja de parecer una colección de líneas independientes y empieza a parecer una superficie continua.

---

# 5. Efecto 3 — Specular horizontal

Sobre la iluminación anterior, añadir un reflejo especular.

Una aproximación barata:

```js
const specular =
    Math.pow(
        lighting,
        12
    );
```

Después:

```js
color = addColor(
    color,
    [255, 255, 255],
    specular * 0.25
);
```

Valores interesantes:

```text
shininess:
8   = plástico
16  = metal
32  = superficie pulida
64  = reflejo muy fino
```

Para este waveform:

```js
shininess = 18;
specularStrength = 0.20;
```

es un buen punto de partida.

---

# 6. Efecto 4 — Fresnel / borde de cristal

El Fresnel hace que los bordes de una superficie brillen más.

Para una posición local:

```js
const edge =
    Math.abs(
        t * 2 - 1
    );
```

Curva:

```js
const fresnel =
    Math.pow(
        edge,
        4
    );
```

Aplicación:

```js
color = mixColor(
    color,
    [220, 215, 255],
    fresnel * 0.30
);
```

Versión azulada:

```js
const rimColor =
    [190, 205, 255];
```

Resultado:

```text
bordes brillantes
aspecto de cristal
plástico pulido
o material translúcido
```

No usar demasiada intensidad.

Recomendado:

```text
0.10 - 0.30
```

---

# 7. Efecto 5 — Shading según energía

El color puede variar según la fuerza local del audio.

Calcular:

```js
const energy =
    Math.max(
        Math.abs(min),
        Math.abs(max)
    );
```

Normalizar:

```js
const e =
    clamp01(energy);
```

Modificar la paleta:

```js
color = mixColor(
    lowEnergyColor,
    highEnergyColor,
    e
);
```

Una idea:

```text
energía baja:
gris-violeta

energía media:
violeta

energía alta:
azul eléctrico + blanco
```

Ejemplo:

```js
const lowEnergyTint =
    [130, 120, 175];

const highEnergyTint =
    [190, 190, 255];
```

Aplicación:

```js
color = mixColor(
    color,
    highEnergyTint,
    e * 0.18
);
```

Debe seguir siendo sutil.

La altura ya indica volumen; el color sólo añade información secundaria.

---

# 8. Efecto 6 — Color según espectro

Para cada zona temporal se puede calcular una FFT pequeña.

Métricas posibles:

```text
spectral centroid
spectral rolloff
bass energy
mid energy
high energy
```

La más sencilla es el centroide espectral.

Normalización:

```js
const spectralPosition =
    centroid / nyquist;
```

Mapa de color recomendado:

```text
graves
violeta oscuro

medios
violeta/azul

agudos
azul claro/blanco
```

Ejemplo:

```js
const bassTint =
    [150, 120, 200];

const trebleTint =
    [180, 210, 255];
```

Interpolar:

```js
const spectralTint =
    mixColor(
        bassTint,
        trebleTint,
        spectralPosition
    );
```

Después mezclar con el shading original:

```js
color =
    mixColor(
        color,
        spectralTint,
        0.15
    );
```

No convertir la waveform en arcoíris.

El objetivo es que el espectro module ligeramente la paleta existente.

---

# 9. Efecto 7 — Ataques luminosos

Detectar aumentos bruscos de energía.

Primero:

```js
const energy =
    Math.max(
        Math.abs(min),
        Math.abs(max)
    );
```

Ataque:

```js
const attack =
    Math.max(
        0,
        energy[x] -
        energy[x - 1]
    );
```

Suavizar:

```js
const normalizedAttack =
    clamp01(
        attack * attackGain
    );
```

Añadir brillo:

```js
color =
    mixColor(
        color,
        [255, 255, 255],
        normalizedAttack * 0.35
    );
```

Opcionalmente aumentar sólo el highlight:

```js
highlightStrength +=
    normalizedAttack * 0.4;
```

Resultado:

```text
kick
snare
clicks
transitorios
```

producen pequeñas chispas visuales.

---

# 10. Efecto 8 — Material líquido

Mantener el shading actual, pero deformar la coordenada local `t`.

Versión sencilla:

```js
const warpedT =
    t +
    Math.sin(
        x * 0.08 +
        t * Math.PI * 3
    ) * 0.035;
```

Después:

```js
color =
    recycleShade(
        clamp01(warpedT)
    );
```

Versión más orgánica:

```js
const warpedT =
    t
    + Math.sin(
        x * 0.071 +
        t * 8.0
    ) * 0.025
    + Math.sin(
        x * 0.017 -
        t * 17.0
    ) * 0.012;
```

Resultado:

```text
mercurio
líquido
metal fundido
ondas microscópicas
```

La deformación debe ser pequeña.

Si se exagera, se pierde la lectura del audio.

---

# 11. Efecto 9 — Holograma / interferencia

Crear una fase dependiente de X y de la posición local:

```js
const phase =
    x * 0.05 +
    t * Math.PI * 5;
```

Interferencia:

```js
const interference =
    Math.sin(phase) * 0.5 + 0.5;
```

Modificar ligeramente RGB:

```js
const hologramTint = [
    165 + interference * 20,
    150 + interference * 10,
    220 + interference * 30
];
```

Mezclar:

```js
color =
    mixColor(
        color,
        hologramTint,
        0.10
    );
```

Resultado:

```text
bandas suaves
reflejos iridiscentes
acabado holográfico
```

Debe ser un efecto muy leve.

---

# 12. Efecto 10 — Densidad estadística

En lugar de guardar sólo:

```text
min
max
```

guardar también una distribución aproximada de las muestras dentro de cada columna.

Por ejemplo, dividir la altura vertical en bins:

```js
const bins =
    new Uint16Array(binCount);
```

Para cada muestra:

```js
const bin =
    sampleToBin(sample);

bins[bin]++;
```

Normalizar:

```js
density =
    bins[y] /
    maxBinCount;
```

Usar la densidad para controlar:

```text
opacidad
brillo
saturación
```

Por ejemplo:

```js
alpha =
    0.25 +
    density * 0.75;
```

Resultado:

```text
núcleo sólido
+
halo de valores menos frecuentes
```

Puede producir un waveform parecido a una mezcla entre oscilograma y visualización estadística.

---

# 13. Efecto 11 — Glow local

Añadir un resplandor alrededor de los picos.

No conviene usar `ctx.shadowBlur` por columna porque puede ser caro.

Una alternativa:

1. renderizar waveform a un canvas auxiliar;
2. aplicar blur una sola vez;
3. dibujar el blur debajo;
4. dibujar el waveform nítido encima.

Ejemplo:

```js
blurCtx.filter =
    "blur(4px)";
```

Composición:

```js
ctx.globalAlpha = 0.20;

ctx.drawImage(
    blurredCanvas,
    0,
    0
);

ctx.globalAlpha = 1;

ctx.drawImage(
    waveformCanvas,
    0,
    0
);
```

Resultado:

```text
neón suave
sin perder nitidez
```

---

# 14. Efecto 12 — Glow sólo en ataques

Combinar:

```text
attack detection
+
blur
```

Crear un mapa de intensidad:

```js
glow[x] =
    normalizedAttack;
```

Renderizar sólo esas columnas en un canvas auxiliar.

Resultado:

```text
transitorios con destello
resto del waveform limpio
```

Esto puede quedar especialmente bien en batería y percusión.

---

# 15. Efecto 13 — Material anisotrópico

Una variante interesante para metal.

En lugar de un specular circular, hacerlo alargado verticalmente.

Por ejemplo:

```js
const specular =
    Math.pow(
        Math.max(0, lighting),
        24
    );
```

pero modularlo por `t`:

```js
const band =
    Math.exp(
        -Math.pow(
            (t - 0.30) / 0.12,
            2
        )
    );
```

Después:

```js
const anisotropicSpecular =
    specular * band;
```

Resultado:

```text
metal cepillado
aluminio
superficie industrial
```

---

# 16. Efecto 14 — Bandas de luz internas

Añadir una o varias líneas suaves dentro de cada segmento.

Por ejemplo:

```js
const stripe =
    Math.exp(
        -Math.pow(
            (t - 0.35) / 0.05,
            2
        )
    );
```

Aplicación:

```js
color =
    mixColor(
        color,
        [230, 225, 255],
        stripe * 0.25
    );
```

Varias bandas:

```js
stripe1(t)
stripe2(t)
stripe3(t)
```

Puede dar un aspecto:

```text
cristal
fibra óptica
plasma
```

---

# 17. Efecto 15 — Sombreado dependiente del signo

No usar exactamente la misma paleta arriba y abajo.

Ejemplo:

```js
function positiveShade(t) {
    return recycleShade(t);
}

function negativeShade(t) {
    let c =
        recycleShade(t);

    c = multiplyBrightness(
        c,
        0.92
    );

    return mixColor(
        c,
        [130, 120, 180],
        0.08
    );
}
```

Esto refuerza la sensación de luz procedente desde arriba.

---

# 18. Efecto 16 — Ondulación espacial lenta

Modificar el shading por X:

```js
const spatialWave =
    Math.sin(
        x * 0.015
    ) * 0.04;
```

Aplicar:

```js
t2 =
    clamp01(
        t + spatialWave
    );
```

Esto crea grandes ondas de iluminación a lo largo de la waveform.

Debe ser extremadamente suave.

Puede dar sensación de:

```text
superficie satinada
gran reflejo que cruza la onda
```

---

# 19. Efecto 17 — Highlight dependiente de curvatura

Además de la pendiente:

```js
slope =
    height[x + 1] -
    height[x - 1];
```

calcular segunda derivada:

```js
curvature =
    height[x - 1]
    - 2 * height[x]
    + height[x + 1];
```

Usar la curvatura para detectar crestas.

```js
ridge =
    clamp01(
        Math.abs(curvature) *
        curvatureGain
    );
```

Aclarar:

```js
color =
    mixColor(
        color,
        [240, 235, 255],
        ridge * 0.15
    );
```

Resultado:

```text
crestas más marcadas
mayor sensación de relieve
```

---

# 20. La combinación más recomendada

La evolución más interesante del waveform actual sería combinar:

```text
shading ReCycle actual
+
pendiente horizontal
+
specular
+
Fresnel suave
```

Pipeline:

```text
baseRecycleShade(t)
        ↓
horizontalLighting(x)
        ↓
specular(x)
        ↓
fresnel(t)
        ↓
color final
```

Conceptualmente:

```js
let color =
    recycleShade(t);

color =
    multiplyBrightness(
        color,
        horizontalLight
    );

color =
    addSpecular(
        color,
        specular
    );

color =
    applyFresnel(
        color,
        t
    );
```

Esta combinación debería convertir las barras individuales en una especie de superficie 3D continua.

---

# 21. Fórmula combinada sugerida

Ejemplo:

```js
function shadeAdvanced(
    x,
    t,
    metrics
) {
    let color =
        recycleShade(t);

    const horizontalLight =
        0.82 +
        metrics.diffuse * 0.28;

    color =
        multiplyBrightness(
            color,
            horizontalLight
        );

    color =
        mixColor(
            color,
            [255, 255, 255],
            metrics.specular * 0.20
        );

    const fresnel =
        Math.pow(
            Math.abs(t * 2 - 1),
            4
        );

    color =
        mixColor(
            color,
            [205, 215, 255],
            fresnel * 0.18
        );

    return color;
}
```

---

# 22. Métricas por columna

Precalcular:

```js
metrics[x] = {
    min,
    max,
    height,
    slope,
    curvature,
    energy,
    attack,
    spectralCentroid
};
```

Ejemplo:

```js
function calculateColumnMetrics(
    waveform,
    x
) {
    const prev =
        waveform[
            Math.max(0, x - 1)
        ];

    const curr =
        waveform[x];

    const next =
        waveform[
            Math.min(
                waveform.length - 1,
                x + 1
            )
        ];

    const prevHeight =
        Math.max(
            Math.abs(prev.min),
            Math.abs(prev.max)
        );

    const height =
        Math.max(
            Math.abs(curr.min),
            Math.abs(curr.max)
        );

    const nextHeight =
        Math.max(
            Math.abs(next.min),
            Math.abs(next.max)
        );

    const slope =
        nextHeight -
        prevHeight;

    const curvature =
        prevHeight -
        2 * height +
        nextHeight;

    const attack =
        Math.max(
            0,
            height - prevHeight
        );

    return {
        height,
        slope,
        curvature,
        attack
    };
}
```

---

# 23. Presets sugeridos

## Metal violeta

```js
{
    horizontalLighting: true,
    specular: 0.30,
    fresnel: 0.15,
    liquidWarp: 0,
    hologram: 0,
    attackGlow: 0
}
```

---

## Cristal

```js
{
    horizontalLighting: true,
    specular: 0.45,
    fresnel: 0.35,
    edgeLight: 0.30,
    glow: 0.10
}
```

---

## Mercurio

```js
{
    horizontalLighting: true,
    specular: 0.40,
    fresnel: 0.20,
    liquidWarp: 0.035,
    glow: 0.08
}
```

---

## Holograma

```js
{
    horizontalLighting: true,
    specular: 0.20,
    fresnel: 0.20,
    hologram: 0.15,
    spectralTint: 0.10
}
```

---

## Audio reactivo

```js
{
    energyTint: 0.15,
    spectralTint: 0.15,
    attackGlow: 0.35,
    horizontalLighting: true
}
```

---

# 24. Configuración general

Ejemplo:

```js
const config = {
    horizontalLighting: {
        enabled: true,
        strength: 0.35,
        slopeScale: 6.0
    },

    specular: {
        enabled: true,
        strength: 0.20,
        shininess: 18
    },

    fresnel: {
        enabled: true,
        strength: 0.18,
        power: 4
    },

    energyTint: {
        enabled: false,
        strength: 0.15
    },

    spectralTint: {
        enabled: false,
        strength: 0.15
    },

    attackGlow: {
        enabled: false,
        strength: 0.35
    },

    liquidWarp: {
        enabled: false,
        amount: 0.025
    },

    hologram: {
        enabled: false,
        strength: 0.10
    }
};
```

---

# 25. Orden recomendado de experimentación

No añadir todos los efectos a la vez.

## Paso 1

Implementar:

```text
pendiente horizontal
```

Comparar contra la versión actual.

## Paso 2

Añadir:

```text
specular
```

## Paso 3

Añadir:

```text
Fresnel
```

## Paso 4

Crear presets:

```text
metal
cristal
mercurio
```

## Paso 5

Añadir efectos dependientes del audio:

```text
energía
ataques
espectro
```

## Paso 6

Experimentar con:

```text
holograma
densidad
deformaciones
```

---

# 26. Recomendación principal

La mejora con más potencial es:

> Hacer que cada columna conozca a sus columnas vecinas y utilizar la pendiente horizontal para calcular una segunda iluminación.

El waveform actual ya tiene volumen vertical.

La pendiente horizontal añade volumen lateral.

Combinando ambos:

```text
shading vertical
+
shading horizontal
```

se puede conseguir una ilusión de superficie 3D muy convincente sin necesidad de WebGL.

---

# 27. Fórmula conceptual final

```text
COLOR FINAL =

ReCycleShade(t)

× iluminación_por_pendiente

+ specular

+ fresnel

+ energía_opcional

+ espectro_opcional

+ ataque_opcional

+ efectos_estéticos_opcionales
```

La regla fundamental es mantener el efecto base legible.

Los efectos deben reforzar la forma de la waveform, no esconderla.


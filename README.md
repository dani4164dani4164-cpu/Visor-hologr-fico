# Visor holográfico

Web app instalable (PWA) que muestra un **indicador animado**: anillos tipo
giroscopio, pistas de circuito con pulsos, partículas, marcas en el borde, arco
de barrido y un núcleo que pulsa. Tiene dos escenas, en 2D y en 3D, que se eligen
en el selector de arriba.

- **Dos estados**: *trabajando* (azul ↔ morado) y *en reposo* (gris plateado), con transición suave.
- **Gestos**: tocar = cambiar de estado · arrastrar = girar e inclinar · pellizcar = acercar/alejar.
- **Controles**: velocidad, cantidad de partículas, estado, "Restablecer vista" y "Exportar".
  La app recuerda la última velocidad, partículas, estado y escena elegidos.
- **Funciona sin conexión** una vez abierta por primera vez.
- HTML, CSS y JavaScript puros (módulos ES). Sin frameworks, sin npm, sin compilar.

## Abrirla

La app se publica sola con GitHub Pages en cada cambio a la rama `main`:

**https://dani4164dani4164-cpu.github.io/Visor-hologr-fico/**

Ábrela en el navegador del celular o la tableta. El prototipo original sigue
disponible en `…/Visor-hologr-fico/prototipo/visor-holografico.html`.

### Activar GitHub Pages (una sola vez, desde el navegador del celular)

1. Si el repositorio es **privado** y tu cuenta es gratuita, primero hazlo público:
   **Settings → General →** baja hasta *Danger Zone* **→ Change visibility → Public**.
   (Con GitHub Pro no hace falta.)
2. Abre **Settings → Pages** (en el celular, *Settings* está en el menú `⋯` del repositorio;
   usa "Vista de escritorio" del navegador si no aparece).
3. En **Build and deployment → Source** elige **GitHub Actions**.
4. Ve a la pestaña **Actions**, abre "Publicar en GitHub Pages" y pulsa **Run workflow**
   (o simplemente haz un cambio en `main`). Cuando termine en verde, la app ya está en la URL de arriba.

## Instalarla

### Android (Chrome)
1. Abre la URL en **Chrome**.
2. Toca el menú **⋮** → **Instalar app** (o **Agregar a la pantalla principal**).
3. Confirma. Aparecerá el ícono de anillos y se abrirá a pantalla completa, sin barra del navegador.

### iPhone / iPad (Safari)
1. Abre la URL en **Safari**.
2. Toca **Compartir** (cuadro con flecha hacia arriba).
3. Elige **Agregar a pantalla de inicio** → **Agregar**.

### Actualizaciones
Cada publicación cambia automáticamente la versión de la caché del service worker
(el workflow le pone el código del commit). La próxima vez que abras la app con
conexión, descargará la versión nueva y verás el aviso
**"Nueva versión lista · toca para actualizar"**.

## Estructura

```
index.html                 página, selector de escenas y panel de controles
css/estilos.css            estilos (móvil primero, safe-area, horizontal)
js/app.js                  montaje de escenas, controles, preferencias, service worker
js/arnes.js                estado por cuadro, gestos y bucle (compartido con lo exportado)
js/exportar.js             Exportar: arma los archivos .html / .js y los entrega
js/escenas/registro.js     lista de escenas disponibles
js/escenas/indicador.js    escena "Indicador" (canvas 2D)
js/escenas/indicador-3d.js escena "Indicador 3D" (three.js / WebGL 2)
manifest.webmanifest       datos de instalación de la PWA
service-worker.js          caché para uso sin conexión
iconos/                    íconos (SVG y PNG, normales y maskable)
.github/workflows/pages.yml  publicación automática en GitHub Pages
prototipo/                 prototipos originales (no se tocan)
```

## Escenas

| Escena | Tecnología | Qué muestra |
|---|---|---|
| **Indicador** | Canvas 2D | El indicador original, con vista previa a 48 px en la esquina. Funciona en cualquier dispositivo. |
| **Indicador 3D** | three.js (WebGL 2) | Núcleo con malla geodésica y halo, esfera de circuitos con pulsos, giroscopio de 4 anillos anidados, anillo escáner orbitando y partículas que brotan en espiral. |

- Las dos responden igual a los gestos (tocar, arrastrar, pellizcar), a los controles
  de velocidad y partículas y al cambio de estado (azul↔morado / gris plateado).
- La app recuerda la última escena elegida.
- **Sin WebGL 2** (algunos equipos viejos o con la aceleración gráfica desactivada):
  al elegir "Indicador 3D" aparece un aviso breve y la app vuelve a "Indicador".
  Lo mismo pasa si una escena falla al iniciar o al dibujar: la app no se rompe.
- **Sin conexión**: three.js se descarga y se guarda al instalar la app, así la escena 3D
  funciona sin internet aunque nunca la hayas abierto en línea.
- Cambiar de escena muchas veces no acumula canvas ni memoria: cada escena libera
  todo en `destruir()`, incluido el contexto WebGL.
- `prototipo/indicador-3d/` es el banco de pruebas de la escena 3D. La app usa la
  copia de `js/escenas/indicador-3d.js`, que libera además el contexto WebGL y la
  geometría compartida del halo (ver abajo). Si cambias el diseño en el prototipo,
  copia el cambio a esa escena.

## Exportar

El botón **Exportar** del panel guarda la escena que estás viendo (Indicador o
Indicador 3D) como archivo, para usarla en otros proyectos:

| Opción | Archivo | Qué es |
|---|---|---|
| **Página independiente (.html)** | `indicador-2d.html`, `indicador-3d.html` | Un solo archivo que muestra la escena a pantalla completa, con los mismos gestos que la app (tocar, arrastrar, pellizcar o rueda) y sin el panel de controles. |
| **Módulo de escena (.js)** | `indicador-2d.js`, `indicador-3d.js` | El archivo de la escena tal cual, con un encabezado que explica el contrato, qué campos de `S` usa y un ejemplo listo para copiar. |

**Cómo se guarda el archivo**
- En celular y tableta se abre la hoja de **Compartir** del sistema: elige *Guardar en Archivos*,
  *Drive*, o mándalo por correo o mensaje.
- En computadora se descarga normalmente.
- Si el dispositivo no deja ni compartir ni descargar (por ejemplo, la app instalada en un
  iPhone/iPad antiguo), aparece un panel con el código y un botón **Copiar**: pégalo en un
  archivo nuevo con el nombre que se indica.
- Al terminar aparece el aviso **"Archivo listo"**.

**La página exportada**
- Empieza con la velocidad, las partículas y el estado que tenías al exportar. Están en un
  bloque `CONFIG` al inicio del script, con comentarios, para cambiarlos a mano. También tiene
  `zoom`, `gestos` (ponlo en `false` para un indicador decorativo) y `fondo`.
- Para incrustarla en otra página, copia el archivo junto a ella y usa:

  ```html
  <iframe src="indicador-3d.html" title="Indicador 3D" width="400" height="400"
          style="border:0;background:#07070d"></iframe>
  ```

  El indicador se adapta al tamaño del iframe.
- La versión 3D descarga three.js de la CDN (la misma versión que usa la app), así que necesita
  internet la primera vez que se abre. Si no puede, muestra un aviso en lugar de quedar en negro.

**Siempre coincide con la app**: el código no es una copia hecha a mano. Al exportar, la app lee
los archivos reales de la escena (`js/escenas/…`) y del arnés (`js/arnes.js`, el mismo que usa la
app para los gestos y el bucle). Los toma de la caché, así que **exportar funciona sin conexión**.

## Agregar una escena nueva

Todo se puede hacer desde la web de GitHub (botón **Add file → Create new file**
y el lápiz ✏️ para editar), sin computadora.

1. **Crea el archivo** `js/escenas/mi-escena.js`. Una escena exporta un objeto con
   `id`, `nombre` y `crear(contenedor, S)`, que devuelve `redimensionar`, `dibujar` y `destruir`.
   `S` es el estado compartido: `S.energy` (0 = reposo, 1 = trabajando, con transición),
   `S.T` (tiempo que avanza según velocidad y energía), `S.speed`, `S.particles`,
   `S.rot`, `S.tilt` y `S.zoom` (los gestos ya los calcula `app.js`).

   Ejemplo 2D mínimo:

   ```js
   export default {
     id: 'pulso',
     nombre: 'Pulso',
     crear(contenedor, S) {
       const c = document.createElement('canvas');
       c.className = 'escena';
       contenedor.prepend(c);
       const x = c.getContext('2d');
       return {
         redimensionar(w, h) {
           const dpr = Math.min(devicePixelRatio || 1, 2);
           c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
         },
         dibujar(t, dT) {
           x.clearRect(0, 0, c.width, c.height);
           const r = Math.min(c.width, c.height) * 0.3 * S.zoom * (1 + 0.1 * Math.sin(S.T * 0.004));
           x.strokeStyle = `hsla(${250 + 25 * S.energy}, ${10 + 70 * S.energy}%, 65%, .9)`;
           x.lineWidth = 4;
           x.beginPath(); x.arc(c.width / 2, c.height / 2, r, 0, 6.28); x.stroke();
         },
         destruir() { c.remove(); }
       };
     }
   };
   ```

   Ejemplo 3D con **three.js** (se carga desde la CDN gracias al mapa de importación de `index.html`;
   solo se descarga cuando eliges la escena):

   ```js
   import * as THREE from 'three';

   export default {
     id: 'anillos-3d',
     nombre: 'Anillos 3D',
     crear(contenedor, S) {
       const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
       renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
       renderer.domElement.className = 'escena';
       contenedor.prepend(renderer.domElement);

       const escena = new THREE.Scene();
       const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
       camara.position.z = 6;
       const material = new THREE.MeshBasicMaterial({ color: 0x7a6ff0, wireframe: true });
       const anillo = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.03, 8, 96), material);
       escena.add(anillo);

       return {
         redimensionar(w, h) { renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); },
         dibujar(t, dT) {
           anillo.rotation.z = S.rot + S.T * 0.0004;
           anillo.rotation.x = 1 + S.tilt;
           camara.position.z = 6 / S.zoom;
           material.color.setHSL((250 + 25 * Math.sin(t * 0.00035)) / 360, 0.1 + 0.75 * S.energy, 0.62);
           renderer.render(escena, camara);
         },
         destruir() {
           material.dispose(); anillo.geometry.dispose();
           renderer.dispose();
           renderer.forceContextLoss();          // dispose() no libera el contexto WebGL
           renderer.domElement.remove();
         }
       };
     }
   };
   ```

   **Para que `destruir()` libere todo en escenas three.js:**
   - Llama `dispose()` en cada geometría, material y textura que crees.
   - Llama `renderer.dispose()` **y** `renderer.forceContextLoss()`; sin lo segundo, cada cambio
     de escena deja un contexto WebGL vivo y, tras unos 16, el navegador empieza a tirar contextos.
   - Si usas `THREE.Sprite`, desecha también `sprite.geometry`: three.js la comparte entre
     todos los sprites y retiene al renderer si no se desecha.

2. **Regístrala** en `js/escenas/registro.js` agregando una línea a la lista: `archivo` es el
   nombre del archivo de la escena y `exportar` el nombre base de los archivos que genera
   **Exportar**. Si usa three.js, agrega `requiere: ['webgl2']`: en equipos sin WebGL 2 la app
   avisará y volverá a "Indicador" sin descargar nada.

   ```js
   { id: 'anillos-3d', nombre: 'Anillos 3D', archivo: 'anillos-3d.js', exportar: 'anillos-3d', requiere: ['webgl2'] },
   ```

   Para que la escena se pueda exportar, debe tener un único `export default` e importar solo
   librerías del import map (como `'three'`), no otros archivos locales.

3. **Agrégala a la caché sin conexión**: en `service-worker.js`, añade
   `'./js/escenas/anillos-3d.js',` a la lista `ARCHIVOS`. three.js ya se guarda al instalar
   (lista `PRECARGA_CDN`). Si algún día cambias la versión de three en el import map de
   `index.html`, cambia también esa URL en `PRECARGA_CDN`. No hace falta subir la versión de
   caché a mano: cada publicación la renueva sola.

4. Guarda el cambio en `main`. En un par de minutos aparece en el selector de la app.

## Diseño

Diseño original de anillos y circuitos en azul y morado. No usa ni imita
personajes, logotipos ni interfaces de películas o marcas.

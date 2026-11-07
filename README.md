# Visor holográfico

Web app instalable (PWA) que muestra un **indicador animado**: anillos tipo
giroscopio, pistas de circuito con pulsos, partículas, marcas en el borde, arco
de barrido y un núcleo que pulsa.

- **Dos estados**: *trabajando* (azul ↔ morado) y *en reposo* (gris plateado), con transición suave.
- **Gestos**: tocar = cambiar de estado · arrastrar = girar e inclinar · pellizcar = acercar/alejar.
- **Controles**: velocidad, cantidad de partículas, estado y "Restablecer vista".
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
js/app.js                  estado, controles, gestos, bucle, preferencias, service worker
js/escenas/registro.js     lista de escenas disponibles
js/escenas/indicador.js    escena "Indicador" (canvas 2D)
manifest.webmanifest       datos de instalación de la PWA
service-worker.js          caché para uso sin conexión
iconos/                    íconos (SVG y PNG, normales y maskable)
.github/workflows/pages.yml  publicación automática en GitHub Pages
prototipo/                 prototipo original (no se toca)
```

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
         destruir() { renderer.dispose(); material.dispose(); anillo.geometry.dispose(); renderer.domElement.remove(); }
       };
     }
   };
   ```

2. **Regístrala** en `js/escenas/registro.js` agregando una línea a la lista:

   ```js
   { id: 'anillos-3d', nombre: 'Anillos 3D', cargar: () => import('./anillos-3d.js') },
   ```

3. **Agrégala a la caché sin conexión**: en `service-worker.js`, añade
   `'./js/escenas/anillos-3d.js',` a la lista `ARCHIVOS`. (three.js se guarda solo
   la primera vez que se usa con conexión.)

4. Guarda el cambio en `main`. En un par de minutos aparece en el selector de la app.

## Diseño

Diseño original de anillos y circuitos en azul y morado. No usa ni imita
personajes, logotipos ni interfaces de películas o marcas.

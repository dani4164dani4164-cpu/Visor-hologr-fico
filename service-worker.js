/* ============================================================
   Service worker del Visor holográfico
   - Guarda la app completa al instalarse para funcionar sin conexión.
   - La caché lleva versión: al cambiar VERSION (o BUILD), el navegador
     instala este archivo como nuevo, descarga todo otra vez y borra
     las cachés viejas.
   - BUILD lo reemplaza automáticamente el workflow de GitHub Pages
     con el commit publicado, así cada despliegue se aplica solo.
   ============================================================ */
const VERSION = '1.1.0';
const BUILD = 'dev';
const CACHE = `visor-${VERSION}-${BUILD}`;
const CACHE_CDN = 'visor-cdn-v1';   // librerías externas (p. ej. three.js) usadas por escenas

// Rutas relativas a este archivo: funcionan bajo /<nombre-del-repo>/
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/app.js',
  './js/escenas/registro.js',
  './js/escenas/indicador.js',
  './js/escenas/indicador-3d.js',
  './iconos/icono.svg',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-192.png',
  './iconos/icono-maskable-512.png',
  './iconos/apple-touch-icon.png',
];

// Orígenes externos cuyos archivos se guardan al usarse por primera vez
const CDN = ['https://cdn.jsdelivr.net', 'https://unpkg.com'];

// Librerías de CDN que se intentan guardar desde la instalación, para que
// las escenas 3D funcionen sin conexión aunque nunca se hayan abierto en línea.
// Debe coincidir EXACTAMENTE con la URL de "three" en el import map de index.html.
const PRECARGA_CDN = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' evita copiar versiones viejas de la caché HTTP
    await cache.addAll(ARCHIVOS.map(url => new Request(url, { cache: 'reload' })));
    // Librerías de CDN: si falla (sin red, CDN caída) no impide instalar;
    // se guardarán la primera vez que una escena las use.
    const cdn = await caches.open(CACHE_CDN);
    await Promise.all(PRECARGA_CDN.map(async url => {
      try { if (!(await cdn.match(url))) await cdn.add(new Request(url, { mode: 'cors' })); }
      catch (err) { console.warn('No se pudo precargar', url, err); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres
      .filter(n => n.startsWith('visor-') && n !== CACHE && n !== CACHE_CDN)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: primero la red (para ver cambios), si no hay conexión, la caché.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put('./index.html', res.clone());
        return res;
      } catch {
        return (await caches.match(req, { ignoreSearch: true }))
            || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  // Archivos propios: primero la caché (versionada), si falta, la red.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const enCache = await caches.match(req, { ignoreSearch: true });
      if (enCache) return enCache;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // Librerías de CDN (versión fija en la URL): se guardan la primera vez.
  if (CDN.includes(url.origin)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_CDN);
      const enCache = await cache.match(req);
      if (enCache) return enCache;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
  }
});

/* ============================================================
   Exportar la escena activa como archivo reutilizable:
   - Página independiente (.html): la escena + el arnés (estado,
     bucle, gestos) + un bloque CONFIG, todo en un solo archivo.
   - Módulo de escena (.js): el archivo de la escena tal cual,
     con un encabezado que explica cómo usarlo.
   El código se LEE de los archivos reales (js/escenas/*.js y
   js/arnes.js), que el service worker tiene en caché: lo exportado
   siempre coincide con lo que se ve, y funciona sin conexión.
   ============================================================ */
import { urlEscena } from './escenas/registro.js';

const URL_ARNES = new URL('./arnes.js', import.meta.url).href;

/* ---------- Lectura de fuentes (con memoria) ---------- */
const fuentes = new Map();
function leer(url){
  if (!fuentes.has(url)){
    fuentes.set(url, fetch(url)
      .then(r => { if (!r.ok) throw new Error(`${r.status} al leer ${url}`); return r.text(); })
      .catch(err => { fuentes.delete(url); throw err; }));
  }
  return fuentes.get(url);
}
/* Descarga por adelantado lo que hace falta, para que al tocar una
   opción el archivo esté listo al instante (navigator.share exige
   llamarse justo después del toque). */
export function precargar(entrada){
  return Promise.all([leer(urlEscena(entrada)), leer(URL_ARNES)]);
}

/* ---------- Utilidades ---------- */
const fecha = () => new Date().toISOString().slice(0, 10);
const num = v => +(+v).toFixed(2);

// Evita que el código cierre el <script> en el que se incrusta.
const paraScript = codigo => codigo.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const CAMPOS_S = {
  active:    'true = trabajando, false = en reposo',
  energy:    '0..1, transición suave entre reposo (0) y trabajo (1)',
  T:         'tiempo de simulación en ms (avanza con la velocidad y la energía)',
  speed:     'velocidad, de 0.2 a 2',
  particles: 'cantidad de partículas, de 0 a 160',
  rot:       'giro por arrastre horizontal (radianes)',
  rotVel:    'inercia del giro',
  tilt:      'inclinación por arrastre vertical, de -0.3 a 0.7',
  zoom:      'zoom por pellizco o rueda, de 0.5 a 2.5',
};
const camposUsados = codigo => [...new Set([...codigo.matchAll(/\bS\.([A-Za-z_]\w*)/g)].map(m => m[1]))];

/* Importaciones "desnudas" de la escena (p. ej. 'three') y su URL en el import map de la app */
function importacionesExternas(codigo, archivo){
  const specs = [...codigo.matchAll(/^\s*import\s[^'"]*?['"]([^'"]+)['"]/gm)].map(m => m[1]);
  if (specs.some(s => s.startsWith('.') || s.startsWith('/')))
    throw new Error(`${archivo} importa archivos locales; no se puede exportar en un solo archivo.`);
  let imports = {};
  try { imports = JSON.parse(document.querySelector('script[type="importmap"]')?.textContent || '{}').imports || {}; }
  catch { /* sin import map */ }
  const mapa = {};
  for (const s of specs){
    if (/^https?:/.test(s)) continue;
    const clave = imports[s] ? s : Object.keys(imports).find(k => k.endsWith('/') && s.startsWith(k));
    if (!clave) throw new Error(`No se encontró «${s}» en el import map de la app.`);
    mapa[clave] = imports[clave];
  }
  return mapa;
}

/* ---------- Módulo de escena (.js) ---------- */
export function construirModulo(entrada, codigo){
  const campos = camposUsados(codigo);
  const externas = importacionesExternas(codigo, entrada.archivo);
  const ancho = Math.max(...campos.map(c => c.length));
  const lineasS = campos.map(c => ` *     S.${c.padEnd(ancho)}  ${CAMPOS_S[c] || ''}`.trimEnd()).join('\n');
  const mapa = Object.keys(externas).length
    ? ` *     <script type="importmap">${JSON.stringify({ imports: externas })}</script>\n` : '';
  const css = codigo.includes("'mini'")
    ? ` *       .mini{position:absolute;top:10px;right:14px;display:flex;flex-direction:column;align-items:center;gap:4px;\n *             font:10px monospace;color:#7d78b8;pointer-events:none}\n *       .mini canvas{width:48px;height:48px}\n` : '';
  const encabezado =
`/**
 * ${entrada.nombre}: módulo de escena exportado de «Visor holográfico» (${fecha()}).
 *
 * CONTRATO
 *   export default { id, nombre, crear(contenedor, S) }
 *   crear() inserta su(s) <canvas class="escena"> al inicio de \`contenedor\`
 *   (que debe tener position:relative o absolute) y devuelve:
 *     redimensionar(anchoCss, altoCss)  llámalo al montar y cada vez que cambie el tamaño
 *     dibujar(t, dT)                    cada fotograma; t = reloj en ms, dT = ms desde el anterior
 *     destruir()                        quita los canvas y libera la memoria
 *
 * ESTADO S (lo lees y actualizas tú; la escena solo lo lee). Campos que usa:
${lineasS}
${Object.keys(externas).length ? ` *
 * REQUISITOS
 *   Importa ${Object.keys(externas).map(k => `'${k}'`).join(', ')}: declara en tu página un import map como el del ejemplo
 *   (necesita internet la primera vez para descargar la librería).
` : ''} *
 * EJEMPLO
 *     <style>
 *       #escenario{position:relative;width:360px;height:360px;background:#07070d}
 *       #escenario canvas.escena{position:absolute;inset:0;width:100%;height:100%;display:block}
${css} *     </style>
 *     <div id="escenario"></div>
${mapa} *     <script type="module">
 *       import escena from './${entrada.exportar}.js';
 *       const S = { active: true, energy: 1, speed: 0.85, particles: 80, rot: 0, rotVel: 0, tilt: 0, zoom: 1, T: 0 };
 *       const cont = document.getElementById('escenario');
 *       const inst = escena.crear(cont, S);
 *       inst.redimensionar(cont.clientWidth, cont.clientHeight);
 *       let antes = performance.now();
 *       requestAnimationFrame(function cuadro(t){
 *         const dT = Math.min(50, t - antes); antes = t;
 *         S.energy += ((S.active ? 1 : 0) - S.energy) * 0.05;   // transición trabajo↔reposo
 *         S.T += dT * S.speed * (0.2 + 0.8 * S.energy);
 *         inst.dibujar(t, dT);
 *         requestAnimationFrame(cuadro);
 *       });
 *       cont.onclick = () => { S.active = !S.active; };          // tocar = cambiar de estado
 *     </script>
 */
`;
  return { nombre: `${entrada.exportar}.js`, tipo: 'text/javascript', contenido: encabezado + codigo };
}

/* ---------- Página independiente (.html) ---------- */
function escenaComoScript(codigo, archivo){
  const defaults = codigo.match(/^export\s+default\s+/gm) || [];
  if (defaults.length !== 1 || /^export\s+(?!default\b)/m.test(codigo))
    throw new Error(`${archivo}: se esperaba un único «export default».`);
  return codigo.replace(/^export\s+default\s+/m, 'const ESCENA = ');
}
function arnesComoScript(codigo){
  if (/^\s*import\s/m.test(codigo)) throw new Error('arnes.js no debe importar nada.');
  return codigo.replace(/^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm, '');
}

function lineasConfig(S){
  const filas = [
    [`velocidad: ${num(S.speed)},`,               'rapidez de la animación: de 0.2 (lenta) a 2 (rápida)'],
    [`particulas: ${Math.round(S.particles)},`,   'cantidad de partículas: de 0 a 160'],
    [`trabajando: ${S.active},`,                  'true = trabajando (azul↔morado) · false = en reposo (gris plateado)'],
    ['zoom: 1,',                                  'acercamiento inicial: de 0.5 a 2.5'],
    ['gestos: true,',                             'false = sin gestos (indicador decorativo, p. ej. en un <iframe>)'],
    ["fondo: '#07070d',",                         'color de fondo'],
  ];
  const ancho = Math.max(...filas.map(f => f[0].length)) + 2;
  return filas.map(([codigo, nota]) => `  ${codigo.padEnd(ancho)}// ${nota}`).join('\n');
}

export function construirPagina(entrada, S, codigoEscena, codigoArnes){
  const externas = importacionesExternas(codigoEscena, entrada.archivo);
  const usaCdn = Object.keys(externas).length > 0;
  const titulo = entrada.nombre;

  const html =
`<!DOCTYPE html>
<!--
  ${titulo}: página independiente exportada de «Visor holográfico» (${fecha()}).

  QUÉ ES
    Un solo archivo que muestra la escena «${titulo}» animada a pantalla completa.
    No necesita la app ni ningún otro archivo${usaCdn ? ', salvo three.js (ver abajo)' : ''}.

  CÓMO USARLO
    Ábrelo en cualquier navegador (desde Archivos, Drive o con doble clic).
    Gestos: tocar = cambiar de estado · arrastrar = girar e inclinar ·
            pellizcar o rueda del ratón = acercar y alejar.
    Para cambiar la velocidad, las partículas o el estado inicial,
    edita el bloque CONFIG que está más abajo.

  INCRUSTARLO EN OTRA PÁGINA
    Copia este archivo junto a tu página y agrega:
      <iframe src="${entrada.exportar}.html" title="${titulo}"
              width="400" height="400" style="border:0;background:#07070d"></iframe>
    El indicador se adapta al tamaño del iframe. Si lo quieres solo
    decorativo (sin gestos), pon gestos: false en CONFIG.
${usaCdn ? `
  CONEXIÓN
    three.js se descarga de la CDN la primera vez, así que necesita
    internet al abrirla; después el navegador suele guardarlo en caché.
` : ''}-->
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#07070d">
<title>${titulo}</title>
<style>
  html,body{margin:0;height:100%;background:#07070d;overflow:hidden;overscroll-behavior:none}
  #escenario{position:fixed;inset:0;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
  #escenario canvas.escena{position:absolute;inset:0;width:100%;height:100%;display:block}
  /* Vista previa a 48 px que dibujan algunas escenas */
  .mini{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:calc(env(safe-area-inset-right) + 14px);display:flex;flex-direction:column;align-items:center;gap:4px;font:10px ui-monospace,monospace;color:#7d78b8;pointer-events:none;z-index:1}
  .mini canvas{width:48px;height:48px}
  #aviso{position:fixed;inset:auto 16px 50% 16px;margin:0;text-align:center;color:#CECBF6;font:14px system-ui,-apple-system,sans-serif}
</style>
${usaCdn ? `<!-- three.js desde la CDN: misma versión que la app. Necesita internet la primera vez. -->
<script type="importmap">
${JSON.stringify({ imports: externas }, null, 2)}
</script>
` : ''}</head>
<body>
<div id="escenario" aria-label="${titulo}"></div>
<p id="aviso" hidden>${usaCdn ? 'Este navegador no pudo iniciar la escena 3D (necesita WebGL 2 y, la primera vez, conexión a internet).' : 'Este navegador no pudo iniciar la escena.'}</p>

<script>
/* =====================================================================
   CONFIG: valores iniciales (tomados de la app al exportar).
   Puedes editarlos a mano.
   ===================================================================== */
window.CONFIG = {
${lineasConfig(S)}
};
</script>

<!-- onerror: si la escena no se puede cargar (p. ej. sin internet para three.js), muestra el aviso -->
<script type="module" onerror="document.getElementById('aviso').hidden=false">
/* =====================================================================
   ESCENA: copiada de js/escenas/${entrada.archivo} de la app
   ===================================================================== */
${paraScript(escenaComoScript(codigoEscena, entrada.archivo)).trimEnd()}

/* =====================================================================
   ARNÉS: copiado de js/arnes.js de la app (estado, gestos, bucle)
   ===================================================================== */
{
${paraScript(arnesComoScript(codigoArnes)).trimEnd()}

/* ---------- Arranque ---------- */
const C = window.CONFIG || {};
const limitar = (v, min, max, def) => (typeof v === 'number' && isFinite(v)) ? Math.max(min, Math.min(max, v)) : def;
const S = {
  active: C.trabajando !== false,
  energy: 0,
  speed: limitar(C.velocidad, 0.2, 2, 0.85),
  particles: Math.round(limitar(C.particulas, 0, 160, 80)),
  rot: 0, rotVel: 0, tilt: 0,
  zoom: limitar(C.zoom, 0.5, 2.5, 1),
  T: 0
};
S.energy = S.active ? 1 : 0;
if (C.fondo) document.documentElement.style.background = document.body.style.background = C.fondo;

const escenario = document.getElementById('escenario');
let escena = null;
try { escena = ESCENA.crear(escenario, S); }
catch (err) { document.getElementById('aviso').hidden = false; console.warn('No se pudo iniciar la escena:', err); }

if (escena){
  const ajustar = () => { const r = escenario.getBoundingClientRect(); if (r.width > 0 && r.height > 0) escena.redimensionar(r.width, r.height); };
  new ResizeObserver(ajustar).observe(escenario); ajustar();
  let gestos = { arrastrando: () => false };
  if (C.gestos === false) escenario.style.touchAction = 'auto';
  else gestos = instalarGestos(escenario, S);
  iniciarBucle((t, dT) => { avanzar(S, dT, gestos.arrastrando()); escena.dibujar(t, dT); });
}
}
</script>
</body>
</html>
`;
  return { nombre: `${entrada.exportar}.html`, tipo: 'text/html', contenido: html };
}

/* ---------- Entrega: compartir, descargar o mostrar el código ---------- */
const esMovil = () =>
  matchMedia('(pointer: coarse)').matches || navigator.userAgentData?.mobile === true ||
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);          // iPad con iPadOS
const esIOSInstalada = () => navigator.standalone === true;                    // PWA en la pantalla de inicio

/* Devuelve 'compartido', 'descargado', 'cancelado' o 'panel' (hay que mostrar el código). */
export async function entregar(archivo){
  // 1. Celular/tableta: hoja de compartir del sistema (Guardar en Archivos, Drive, enviar…)
  if (esMovil() && navigator.share && navigator.canShare){
    for (const tipo of [archivo.tipo, 'text/plain']){
      let f;
      try { f = new File([archivo.contenido], archivo.nombre, { type: tipo }); } catch { break; }
      if (!navigator.canShare({ files: [f] })) continue;
      try { await navigator.share({ files: [f], title: archivo.nombre }); return 'compartido'; }
      catch (err){ if (err?.name === 'AbortError') return 'cancelado'; break; }   // otro error: probar descarga
    }
  }
  // 2. Descarga normal (no funciona en la app instalada de iPhone/iPad)
  if (!esIOSInstalada() && 'download' in HTMLAnchorElement.prototype){
    try {
      const url = URL.createObjectURL(new Blob([archivo.contenido], { type: archivo.tipo }));
      const a = document.createElement('a');
      a.href = url; a.download = archivo.nombre; a.style.display = 'none';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'descargado';
    } catch { /* sigue al panel */ }
  }
  // 3. Último recurso: el código en un panel con botón Copiar
  return 'panel';
}

/* ---------- Interfaz: botón, menú y panel de código ---------- */
export function instalarExportar({ boton, menu, panel, escenaActual, estado, avisar }){
  const $m = sel => menu.querySelector(sel), $p = sel => panel.querySelector(sel);
  let pendiente = null;

  const cerrarAlTocarFondo = d => d.addEventListener('click', e => { if (e.target === d) d.close(); });
  cerrarAlTocarFondo(menu); cerrarAlTocarFondo(panel);

  boton.addEventListener('click', () => {
    const entrada = escenaActual();
    if (!entrada){ avisar('Espera a que cargue la escena.'); return; }
    $m('[data-nombre]').textContent = entrada.nombre;
    $m('[data-config]').textContent =
      `Velocidad ${num(estado.speed)} · ${Math.round(estado.particles)} partículas · ${estado.active ? 'trabajando' : 'en reposo'}`;
    for (const b of menu.querySelectorAll('[data-formato]')) b.querySelector('small b').textContent = `${entrada.exportar}.${b.dataset.formato}`;
    pendiente = precargar(entrada);
    pendiente.catch(() => {});   // el error se informa al elegir una opción
    menu.showModal();
  });

  $m('[data-cancelar]').addEventListener('click', () => menu.close());

  for (const b of menu.querySelectorAll('[data-formato]')){
    b.addEventListener('click', async () => {
      const entrada = escenaActual(), formato = b.dataset.formato;
      menu.close();
      let archivo;
      try {
        const [codigoEscena, codigoArnes] = await pendiente;
        archivo = formato === 'html'
          ? construirPagina(entrada, estado, codigoEscena, codigoArnes)
          : construirModulo(entrada, codigoEscena);
      } catch (err){
        console.warn('No se pudo exportar', err);
        avisar(`No se pudo exportar: ${err.message}`);
        return;
      }
      const resultado = await entregar(archivo);
      if (resultado === 'compartido') avisar(`Archivo listo: ${archivo.nombre}`);
      else if (resultado === 'descargado') avisar(`Archivo listo: ${archivo.nombre} (en Descargas)`);
      else if (resultado === 'panel') mostrarCodigo(archivo);
    });
  }

  function mostrarCodigo(archivo){
    $p('[data-nombre]').textContent = archivo.nombre;
    const ta = $p('textarea');
    ta.value = archivo.contenido;
    panel.showModal();
    ta.scrollTop = 0;
  }
  $p('[data-cerrar]').addEventListener('click', () => panel.close());
  $p('[data-copiar]').addEventListener('click', async () => {
    const ta = $p('textarea');
    let ok = false;
    try { await navigator.clipboard.writeText(ta.value); ok = true; }
    catch {
      try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch { ok = false; }
    }
    avisar(ok ? `Código copiado. Pégalo en un archivo llamado ${$p('[data-nombre]').textContent}` : 'No se pudo copiar: selecciona el texto y cópialo a mano.');
  });
}

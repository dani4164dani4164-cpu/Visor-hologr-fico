/* ============================================================
   Visor holográfico – montaje, controles, gestos y bucle.
   El dibujo vive en las escenas (js/escenas/); este archivo solo
   mantiene el estado compartido y se lo entrega a la escena activa.
   ============================================================ */
import { escenas, buscarEscena, cargarEscena } from './escenas/registro.js';
import { avanzar, instalarGestos, iniciarBucle } from './arnes.js';
import { instalarExportar } from './exportar.js';

/* ---------- Preferencias guardadas (localStorage con try/catch) ---------- */
const CLAVE = 'visor-holografico:prefs';
function leerPrefs(){
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; }
  catch { return {}; }
}
function guardarPrefs(){
  try {
    localStorage.setItem(CLAVE, JSON.stringify({
      speed: S.speed, particles: S.particles, active: S.active, escena: escenaId
    }));
  } catch { /* modo privado o almacenamiento bloqueado: se ignora */ }
}
const num = (v, min, max, def) => (typeof v === 'number' && isFinite(v)) ? Math.max(min, Math.min(max, v)) : def;
const prefs = leerPrefs();

/* ---------- Estado global compartido con las escenas ---------- */
const S = {
  active: typeof prefs.active === 'boolean' ? prefs.active : true,
  energy: 1,
  speed: num(prefs.speed, 0.2, 2, 0.85),
  particles: Math.round(num(prefs.particles, 0, 160, 80) / 10) * 10,
  rot: 0, rotVel: 0, tilt: 0, zoom: 1,
  T: 0            // tiempo de simulación (avanza con velocidad y energía)
};
S.energy = S.active ? 1 : 0;   // al abrir, empieza directamente en el estado guardado

/* ---------- Elementos ---------- */
const $ = id => document.getElementById(id);
const stage = $('stage'), tg = $('toggle'), estado = $('estado'), selector = $('escena');
const vel = $('vel'), den = $('den');

/* ---------- Escenas: selector y montaje ---------- */
let escena = null, escenaId = null, peticion = 0;

for (const e of escenas) selector.add(new Option(e.nombre, e.id));

/* Capacidades que una escena puede pedir con `requiere` en el registro.
   three.js (r163 en adelante) necesita WebGL 2. */
const capacidades = {
  webgl2(){
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();   // libera el contexto de prueba
      return true;
    } catch { return false; }
  }
};
const nombresCapacidad = { webgl2: 'WebGL 2' };
const capacidadMemo = {};
function capacidadFaltante(entrada){
  return (entrada.requiere || []).find(c => !(capacidadMemo[c] ??= !!capacidades[c]?.()));
}

const respaldo = escenas[0];   // «Indicador»: canvas 2D, funciona en todos lados

async function montarEscena(id){
  const entrada = buscarEscena(id);
  const n = ++peticion;
  selector.value = entrada.id;
  const previos = new Set(stage.children);
  const falta = capacidadFaltante(entrada);
  let nueva = null;
  try {
    if (falta) throw new Error(`Falta ${falta}`);
    const mod = await cargarEscena(entrada);
    if (n !== peticion) return;                 // el usuario eligió otra mientras cargaba
    nueva = mod.default.crear(stage, S);
    if (escena) escena.destruir();
    escena = nueva; escenaId = entrada.id;
    layout();
    guardarPrefs();
  } catch (err) {
    console.warn('No se pudo iniciar la escena', entrada.id, err);
    if (n !== peticion) return;                 // ya se eligió otra; esta no llegó a crear nada
    // Libera lo que la escena alcanzó a crear antes de fallar
    if (nueva && nueva !== escena) try { nueva.destruir(); } catch {}
    for (const el of [...stage.children]) if (!previos.has(el)) el.remove();
    mostrarAviso(falta
      ? `«${entrada.nombre}» necesita ${nombresCapacidad[falta] || falta}, que este dispositivo no tiene. Se muestra «${respaldo.nombre}».`
      : `No se pudo iniciar «${entrada.nombre}». Se muestra «${respaldo.nombre}».`);
    volverAlRespaldo(entrada.id);
  }
}
function volverAlRespaldo(fallida){
  if (escenaId === respaldo.id) selector.value = respaldo.id;       // ya estaba en «Indicador»
  else if (fallida !== respaldo.id) montarEscena(respaldo.id);
}
selector.addEventListener('change', () => montarEscena(selector.value));

/* ---------- Avisos breves ---------- */
let avisoTimer = 0;
function mostrarAviso(texto, ms = 4500){
  document.querySelector('.aviso:not(.aviso-actualizar)')?.remove();
  const aviso = document.createElement('div');
  aviso.className = 'aviso'; aviso.setAttribute('role', 'status');
  aviso.textContent = texto;
  document.body.append(aviso);
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso.remove(), ms);
}

function layout(){
  const r = stage.getBoundingClientRect();
  if (escena && r.width > 0 && r.height > 0) escena.redimensionar(r.width, r.height);
}
new ResizeObserver(layout).observe(stage);

/* ---------- Controles ---------- */
function setActive(v){
  S.active = v; tg.textContent = v ? 'Trabajando' : 'En reposo'; tg.classList.toggle('on', v);
  estado.textContent = v ? 'trabajando' : 'en reposo';
  guardarPrefs();
}
function setSpeed(v){ S.speed = v; vel.value = v; $('velOut').textContent = v.toFixed(2); }
function setParticles(v){ S.particles = v; den.value = v; $('denOut').textContent = v; }

tg.onclick = () => setActive(!S.active);
$('reset').onclick = () => { S.rot = 0; S.rotVel = 0; S.tilt = 0; S.zoom = 1; };
vel.oninput = e => { setSpeed(+e.target.value); guardarPrefs(); };
den.oninput = e => { setParticles(+e.target.value); guardarPrefs(); };

setSpeed(S.speed); setParticles(S.particles); setActive(S.active);

/* ---------- Exportar la escena activa ---------- */
instalarExportar({
  boton: $('exportar'), menu: $('menuExportar'), panel: $('panelCodigo'),
  escenaActual: () => escena ? buscarEscena(escenaId) : null,
  estado: S, avisar: mostrarAviso
});

/* ---------- Gestos (js/arnes.js): tocar, arrastrar, pellizcar ---------- */
let hintHidden = false;
function hideHint(){ if (!hintHidden){ hintHidden = true; $('hint').style.opacity = 0; } }
const gestos = instalarGestos(stage, S, { alTocar: () => setActive(!S.active), alInteractuar: hideHint });

/* ---------- Bucle (js/arnes.js; se pausa cuando la pestaña no está visible) ---------- */
iniciarBucle((t, dT) => {
  avanzar(S, dT, gestos.arrastrando());
  if (escena){
    try { escena.dibujar(t, dT); }
    catch (err){                                  // un fallo al dibujar no detiene la app
      console.error('Error al dibujar la escena', escenaId, err);
      const fallida = escenaId;
      try { escena.destruir(); } catch {}
      escena = null; escenaId = null;
      mostrarAviso(`Falló «${buscarEscena(fallida).nombre}». Se muestra «${respaldo.nombre}».`);
      volverAlRespaldo(fallida);
    }
  }
});

montarEscena(prefs.escena);

/* ---------- Service worker (sin conexión + actualizaciones) ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  const habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service worker no registrado:', err));
  // Cuando una versión nueva toma el control, ofrece recargar (no se interrumpe al usuario).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || document.querySelector('.aviso-actualizar')) return;
    const aviso = document.createElement('button');
    aviso.className = 'aviso aviso-actualizar'; aviso.type = 'button';
    aviso.textContent = 'Nueva versión lista · toca para actualizar';
    aviso.onclick = () => location.reload();
    document.body.append(aviso);
  });
}

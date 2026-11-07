/* ============================================================
   Visor holográfico – montaje, controles, gestos y bucle.
   El dibujo vive en las escenas (js/escenas/); este archivo solo
   mantiene el estado compartido y se lo entrega a la escena activa.
   ============================================================ */
import { escenas, buscarEscena } from './escenas/registro.js';

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

async function montarEscena(id){
  const entrada = buscarEscena(id);
  const n = ++peticion;
  selector.value = entrada.id;
  try {
    const mod = await entrada.cargar();
    if (n !== peticion) return;                 // el usuario eligió otra mientras cargaba
    const nueva = mod.default.crear(stage, S);
    if (escena) escena.destruir();
    escena = nueva; escenaId = entrada.id;
    layout();
    guardarPrefs();
  } catch (err) {
    console.error('No se pudo cargar la escena', entrada.id, err);
    estado.textContent = 'error al cargar';
    if (escenaId) selector.value = escenaId;
  }
}
selector.addEventListener('change', () => montarEscena(selector.value));

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

/* ---------- Gestos: tocar, arrastrar, pellizcar ---------- */
const ptrs = new Map(); let down = null, pinch0 = null, hintHidden = false;
function hideHint(){ if (!hintHidden){ hintHidden = true; $('hint').style.opacity = 0; } }
stage.addEventListener('pointerdown', e => {
  stage.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.zoom }; if (down) down.moved = true; }
});
stage.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2 && pinch0){
    const [a, b] = [...ptrs.values()];
    S.zoom = Math.max(0.5, Math.min(2.5, pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d)); hideHint(); return;
  }
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
  if (down && down.moved){ S.rot += dx * 0.008; S.rotVel = dx * 0.008; S.tilt = Math.max(-0.3, Math.min(0.7, S.tilt + dy * 0.004)); hideHint(); }
});
function up(e){
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch0 = null;
  if (ptrs.size === 0 && down){
    if (!down.moved && performance.now() - down.t < 300){ setActive(!S.active); hideHint(); }
    down = null;
  }
}
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
stage.addEventListener('wheel', e => { e.preventDefault(); S.zoom = Math.max(0.5, Math.min(2.5, S.zoom * Math.exp(-e.deltaY * 0.001))); }, { passive: false });
stage.addEventListener('contextmenu', e => e.preventDefault());

// iOS Safari: bloquea el zoom del navegador por pellizco y el desplazamiento de la página
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || e.target.closest('#stage')) e.preventDefault(); }, { passive: false });

/* ---------- Bucle (se pausa cuando la pestaña no está visible) ---------- */
let last = performance.now(), raf = 0;
function loop(t){
  const dT = Math.min(50, Math.max(0, t - last)); last = t;
  S.energy += ((S.active ? 1 : 0) - S.energy) * (1 - Math.pow(0.97, dT / 16.7));
  S.T += dT * S.speed * (0.2 + 0.8 * S.energy);
  if (!down){ S.rot += S.rotVel; S.rotVel *= Math.pow(0.94, dT / 16.7); }
  if (escena) escena.dibujar(t, dT);
  raf = requestAnimationFrame(loop);
}
function iniciar(){ if (!raf){ last = performance.now(); raf = requestAnimationFrame(loop); } }
function detener(){ if (raf){ cancelAnimationFrame(raf); raf = 0; } }
document.addEventListener('visibilitychange', () => document.hidden ? detener() : iniciar());

montarEscena(prefs.escena);
if (!document.hidden) iniciar();

/* ---------- Service worker (sin conexión + actualizaciones) ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  const habiaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service worker no registrado:', err));
  // Cuando una versión nueva toma el control, ofrece recargar (no se interrumpe al usuario).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || document.querySelector('.aviso')) return;
    const aviso = document.createElement('button');
    aviso.className = 'aviso'; aviso.type = 'button';
    aviso.textContent = 'Nueva versión lista · toca para actualizar';
    aviso.onclick = () => location.reload();
    document.body.append(aviso);
  });
}

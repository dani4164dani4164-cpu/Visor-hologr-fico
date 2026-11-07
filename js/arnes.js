/* ============================================================
   Arnés de escenas: avance del estado, gestos y bucle.
   Lo usan la app y las páginas exportadas (Exportar → Página
   independiente copia este archivo tal cual, quitando `export`).
   Por eso NO debe importar nada ni depender de la interfaz de la app.
   ============================================================ */

/* Avanza el estado compartido S en cada cuadro (dT en ms). */
export function avanzar(S, dT, arrastrando){
  S.energy += ((S.active ? 1 : 0) - S.energy) * (1 - Math.pow(0.97, dT / 16.7));   // transición suave trabajo↔reposo
  S.T += dT * S.speed * (0.2 + 0.8 * S.energy);                                     // tiempo de simulación
  if (!arrastrando){ S.rot += S.rotVel; S.rotVel *= Math.pow(0.94, dT / 16.7); }     // inercia del giro
}

/* Gestos sobre `zona`: tocar = alTocar(), arrastrar = girar/inclinar,
   pellizcar o rueda = zoom. alInteractuar() se llama en cualquier gesto. */
export function instalarGestos(zona, S, { alTocar = () => { S.active = !S.active; }, alInteractuar = () => {} } = {}){
  const ptrs = new Map(); let down = null, pinch0 = null;
  zona.addEventListener('pointerdown', e => {
    zona.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.zoom }; if (down) down.moved = true; }
  });
  zona.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && pinch0){
      const [a, b] = [...ptrs.values()];
      S.zoom = Math.max(0.5, Math.min(2.5, pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d)); alInteractuar(); return;
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
    if (down && down.moved){ S.rot += dx * 0.008; S.rotVel = dx * 0.008; S.tilt = Math.max(-0.3, Math.min(0.7, S.tilt + dy * 0.004)); alInteractuar(); }
  });
  function up(e){
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = null;
    if (ptrs.size === 0 && down){
      if (!down.moved && performance.now() - down.t < 300){ alTocar(); alInteractuar(); }
      down = null;
    }
  }
  zona.addEventListener('pointerup', up); zona.addEventListener('pointercancel', up);
  zona.addEventListener('wheel', e => { e.preventDefault(); S.zoom = Math.max(0.5, Math.min(2.5, S.zoom * Math.exp(-e.deltaY * 0.001))); alInteractuar(); }, { passive: false });
  zona.addEventListener('contextmenu', e => e.preventDefault());

  // iOS Safari: bloquea el zoom del navegador por pellizco y el desplazamiento de la página
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || zona.contains(e.target)) e.preventDefault(); }, { passive: false });

  return { arrastrando: () => down !== null };
}

/* Bucle de animación: llama cuadro(t, dT) en cada fotograma y se
   pausa mientras la pestaña no está visible. */
export function iniciarBucle(cuadro){
  let last = performance.now(), raf = 0;
  function loop(t){
    raf = requestAnimationFrame(loop);
    const dT = Math.min(50, Math.max(0, t - last)); last = t;
    cuadro(t, dT);
  }
  const iniciar = () => { if (!raf){ last = performance.now(); raf = requestAnimationFrame(loop); } };
  const detener = () => { if (raf){ cancelAnimationFrame(raf); raf = 0; } };
  document.addEventListener('visibilitychange', () => document.hidden ? detener() : iniciar());
  if (!document.hidden) iniciar();
}

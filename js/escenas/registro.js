/* ============================================================
   Registro de escenas
   ------------------------------------------------------------
   Cada entrada describe una escena y cómo cargarla. La carga es
   diferida (import dinámico): una escena pesada, por ejemplo con
   three.js, no se descarga hasta que se elige en el selector.

   Un módulo de escena exporta por defecto un objeto:

     export default {
       id: 'mi-escena',
       nombre: 'Mi escena',
       crear(contenedor, S) {
         // contenedor: el elemento #stage, donde la escena inserta
         //             su(s) canvas. Los gestos ya los gestiona app.js.
         // S: estado compartido (solo lectura salvo que sepas lo que haces):
         //    S.active    true = trabajando, false = en reposo
         //    S.energy    0..1, transición suave entre reposo y trabajo
         //    S.T         tiempo de simulación en ms (avanza con velocidad y energía)
         //    S.speed     velocidad elegida (0.2..2)
         //    S.particles cantidad de partículas elegida (0..160)
         //    S.rot       giro por arrastre horizontal (radianes)
         //    S.tilt      inclinación por arrastre vertical (-0.3..0.7)
         //    S.zoom      zoom por pellizco (0.5..2.5)
         return {
           redimensionar(anchoCss, altoCss) {},  // al montar y al cambiar el tamaño
           dibujar(t, dT) {},                    // cada cuadro; t = reloj, dT = ms desde el anterior
           destruir() {}                         // quitar canvas y liberar recursos
         };
       }
     };

   Para agregar una escena: crea su archivo en esta carpeta,
   añade una línea abajo y agrega la ruta al service-worker.js.
   ============================================================ */

export const escenas = [
  { id: 'indicador', nombre: 'Indicador', cargar: () => import('./indicador.js') },
  // { id: 'orbitas-3d', nombre: 'Órbitas 3D', cargar: () => import('./orbitas-3d.js') },
];

export function buscarEscena(id){
  return escenas.find(e => e.id === id) || escenas[0];
}

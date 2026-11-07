/* ============================================================
   Registro de escenas
   ------------------------------------------------------------
   Cada entrada describe una escena y en qué archivo está. La carga
   es diferida (import dinámico): una escena pesada, por ejemplo con
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

   Campos de cada entrada:
     id, nombre  identificador y texto del selector
     archivo     archivo de la escena en esta carpeta. La app lo
                 importa al elegirla, y «Exportar» lee su código para
                 que el archivo exportado coincida con lo que se ve.
     exportar    nombre base de los archivos exportados
                 (p. ej. 'indicador-2d' → indicador-2d.html / .js)
     requiere    (opcional) lista de capacidades: 'webgl2'. Si el
                 dispositivo no las tiene, la app avisa y vuelve a la
                 primera escena sin descargar nada.

   Para agregar una escena: crea su archivo en esta carpeta,
   añade una línea abajo y agrega la ruta al service-worker.js.
   ============================================================ */

export const escenas = [
  { id: 'indicador',    nombre: 'Indicador',    archivo: 'indicador.js',    exportar: 'indicador-2d' },
  { id: 'indicador-3d', nombre: 'Indicador 3D', archivo: 'indicador-3d.js', exportar: 'indicador-3d', requiere: ['webgl2'] },
  { id: 'agios',        nombre: 'Agios',        archivo: 'agios.js',        exportar: 'agios',        requiere: ['webgl2'] },
];

/* URL absoluta del archivo de una escena (sirve igual bajo /<nombre-del-repo>/) */
export function urlEscena(entrada){
  return new URL(entrada.archivo, import.meta.url).href;
}
export function cargarEscena(entrada){
  return import(urlEscena(entrada));
}

export function buscarEscena(id){
  return escenas.find(e => e.id === id) || escenas[0];
}

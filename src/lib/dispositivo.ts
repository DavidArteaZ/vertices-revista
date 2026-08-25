/**
 * Selector de versión (móvil o escritorio). Puerto de dispositivo.js del
 * sitio estático (lec-cdmx/vertices).
 *
 * El sitio tiene DOS experiencias sobre el mismo contenido: la de escritorio
 * (recorrido cinematográfico con el motor de partículas repartido en los
 * márgenes) y la de teléfono (el mismo recorrido, recolocado en vertical, con
 * el riel convertido en barra de pestañas). La decisión se anuncia de dos
 * maneras:
 *
 *   <html data-disp="movil">  → lo lee movil.css para tomar el control
 *   window.VERTICES_MOVIL     → lo leen el motor, el carrusel y el fondo
 *
 * El guion va SÍNCRONO en el <head>, antes de cualquier hoja y antes de
 * pintar: si llegara tarde, el teléfono alcanzaría a dibujar un cuadro con la
 * maqueta de escritorio y se vería el parpadeo. Por eso es una cadena que se
 * inyecta en el HTML y no un efecto de React.
 */

/** Ancho a partir del cual se sirve la versión de escritorio. */
export const ANCHO_MOVIL = 820;

export type Vista = "movil" | "escritorio";

declare global {
  interface Window {
    VERTICES_MOVIL?: boolean;
    VERTICES_VISTA_FORZADA?: Vista | null;
    VERTICES_CAMBIA_VISTA?: (vista: Vista) => void;
  }
}

/**
 * Criterio (ancho de la ventana, no "user agent": el user agent miente y no
 * sobrevive a una tableta nueva):
 *   · móvil       ancho ≤ 820px  → teléfono, y tableta en vertical
 *   · móvil       pantalla táctil acostada y baja → teléfono en horizontal
 *   · escritorio  todo lo demás
 *
 * La persona manda sobre el criterio: ?vista=movil o ?vista=escritorio fija la
 * versión y se recuerda; ?vista=auto devuelve la decisión automática.
 *
 * Diferencia con el original: `hayTextoSinGuardar` sólo mira campos dentro de
 * un <form>. El original recorría TODOS los <select> del documento, y la
 * pastilla de idioma siempre tiene valor, así que la salvaguarda se disparaba
 * siempre y el cambio de versión al redimensionar no llegaba a ocurrir nunca.
 */
export const GUION_DISPOSITIVO = `(function(){
var C="vertices_vista",r=document.documentElement;
function d(){var m=function(q){return matchMedia(q).matches};
if(m("(max-width:${ANCHO_MOVIL}px)"))return "movil";
if(m("(pointer:coarse)")&&m("(max-width:960px)")&&m("(max-height:520px)"))return "movil";
return "escritorio"}
function p(){try{var q=new URLSearchParams(location.search).get("vista");
if(q==="movil"||q==="escritorio")localStorage.setItem(C,q);
else if(q==="auto")localStorage.removeItem(C);
var g=localStorage.getItem(C);if(g==="movil"||g==="escritorio")return g}catch(e){}return null}
var f=p(),v=f||d();
r.dataset.disp=v;window.VERTICES_MOVIL=v==="movil";window.VERTICES_VISTA_FORZADA=f;
window.VERTICES_CAMBIA_VISTA=function(x){try{localStorage.setItem(C,x)}catch(e){}
var u=new URL(location.href);
if(u.searchParams.has("vista")){u.searchParams.delete("vista");location.replace(u.toString())}
else location.reload()};
function sucio(){var a=document.querySelectorAll("form input,form textarea"),i;
for(i=0;i<a.length;i++){var c=a[i];
if(c.type==="checkbox"||c.type==="radio"){if(c.checked)return true}
else if(c.value&&c.value.trim())return true}
var s=document.querySelectorAll("form select");
for(i=0;i<s.length;i++)if(s[i].value)return true;return false}
var t;addEventListener("resize",function(){if(f)return;clearTimeout(t);
t=setTimeout(function(){if(d()===r.dataset.disp||sucio())return;location.reload()},450)})})();`;

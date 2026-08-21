/**
 * Pastilla de idioma. En el sitio actual la inyecta idiomas.js dentro de
 * .marco nav, justo antes del botón de menú (idiomas.js:98-143), así que
 * aparece en las imágenes doradas y hay que reproducirla tal cual.
 *
 * En esta etapa es sólo marcado: no hay capa de traducción hasta la etapa 2,
 * que es la que le conectará el onChange y la persistencia en localStorage.
 * El <select> se conserva porque define la caja de clic y el tamaño de la
 * pastilla; sin él la geometría cambiaría.
 */

const IDIOMAS = [
  ["es", "Español"],
  ["en", "English"],
  ["fr", "Français"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["ru", "Русский"],
] as const;

export default function SelectorIdioma() {
  return (
    <span id="selIdiomaWrap">
      <svg
        id="selIdiomaGlobo"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" />
        <ellipse cx="10" cy="10" rx="3.6" ry="8" />
        <path d="M2.4 7.2 H17.6 M2.4 12.8 H17.6" />
      </svg>
      <span id="selIdiomaNombre">ES</span>
      <i id="selIdiomaFlecha"></i>
      <select id="selIdioma" aria-label="Idioma" defaultValue="es">
        {IDIOMAS.map(([cod, nombre]) => (
          <option key={cod} value={cod}>
            {nombre}
          </option>
        ))}
      </select>
    </span>
  );
}

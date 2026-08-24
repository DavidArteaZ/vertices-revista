/**
 * Pirámide de Vértices. Idéntica en la cabecera y en el pie
 * (index.html:598-601 y :917-920); estaba duplicada literal en ambos.
 */
export default function Emblema() {
  return (
    <svg className="emblema" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 5 L35 32 L5 32 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M20 5 L21.5 22.5 M5 32 L21.5 22.5 M35 32 L21.5 22.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}

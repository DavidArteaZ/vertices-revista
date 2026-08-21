import Link from "next/link";

/** Lineamientos para autores y preguntas frecuentes. index.html:866-898. */
export default function Lateral() {
  return (
    <aside className="lateral">
      <div className="lineamientos" id="lineamientos">
        <h3>Lineamientos para autores</h3>
        <ul>
          <li>Se reciben papers y abstracts de investigación, artículos con datos, entrevistas y cápsulas breves.</li>
          <li>Formato .docx o .pdf, interlineado 1.5 y letra Times New Roman de 12 puntos.</li>
          <li>Citación en estilo Chicago; todo dato y toda gráfica indican su fuente y fecha.</li>
          <li>Las piezas de investigación suman resumen y de 3 a 5 palabras clave, y pasan por verificación antiplagio.</li>
          <li>El uso de inteligencia artificial se declara.</li>
          <li>Decisiones posibles: aceptado, revisiones menores, revisiones mayores o rechazado.</li>
        </ul>
        <p className="linea-completa"><Link href="/lineamientos">Consulta los lineamientos completos por sección</Link></p>
      </div>
      <div>
        <h3>Preguntas frecuentes</h3>
        <details>
          <summary>¿Quién puede publicar?</summary>
          <p>Quien sea. La convocatoria es abierta: puede publicar cualquier persona mientras su investigación, artículo, documento o entrevista tenga una pregunta económica.</p>
        </details>
        <details>
          <summary>¿Cómo se revisa mi trabajo?</summary>
          <p>Según el tipo de pieza: la investigación pasa por dictaminación doble ciego (dos dictaminadores evalúan tu manuscrito anonimizado con la rúbrica del Dictamen Maestro), las piezas con datos por una revisión reforzada con verificación de fuentes, y el resto por edición y fact-check. Recibes un dictamen formal con fortalezas y áreas de mejora.</p>
        </details>
        <details>
          <summary>¿Puedo escribir desde fuera del Tec o en otro idioma?</summary>
          <p>Sí. La revista nace en el Tec de Monterrey CCM, pero recibe autores externos y universidades internacionales; Miradas Económicas incluye una subsección de investigaciones del extranjero, con trabajos en otro idioma.</p>
        </details>
        <details>
          <summary>¿Puedo proponer un tema nuevo?</summary>
          <p>Sí. Los 27 temas de la constelación son un mapa, no una jaula. Elige el más cercano en el formulario y cuéntanos tu propuesta en el resumen.</p>
        </details>
      </div>
    </aside>
  );
}

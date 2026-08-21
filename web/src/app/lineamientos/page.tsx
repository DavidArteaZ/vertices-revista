import type { Metadata } from "next";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import Revelar from "@/components/satelite/Revelar";
import "./lineamientos.css";

export const metadata: Metadata = { title: "Lineamientos editoriales · Vértices" };

/**
 * Contenido portado de lineamientos.html:269-659, convertido a JSX sin
 * cambiar una sola palabra.
 *
 * EN_FLUJO reproduce lo que fondo-flujo.js hace en tiempo de ejecución:
 * recorre document.body.children y estampa position:relative; z-index:1 en
 * línea sobre cada hermano (fondo-flujo.js:9-20). Eso incluye la cabecera,
 * que por tanto NO queda fija en las páginas satélite aunque el CSS diga
 * position:fixed. Casi seguro no era la intención del autor, pero es el
 * comportamiento vigente y está en las imágenes doradas: cambiarlo sería
 * rediseñar.
 */
const EN_FLUJO = { position: "relative", zIndex: 1 } as const;

export default function Pagina() {
  return (
    <>
      <FondoFlujo />
      <Marco satelite style={EN_FLUJO} />
      <main style={EN_FLUJO}>
        <p className="ceja">Vértices · Guía para autores</p>
        <h1>Lineamientos editoriales</h1>
        <div className="entrada">
          <p>Antes de enviar tu pieza, revisa los lineamientos generales y despliega la sección a la que quieres postular: ahí están sus requisitos, su rúbrica y el checklist de cierre.</p>
        </div>
      
        <section id="generales">
          <p className="ceja">Para todas las secciones</p>
          <h2>Lineamientos generales</h2>
          <p className="texto">Aplican a todas las secciones, salvo que el bloque de la sección indique algo distinto. El principio rector: <em>rigurosos en la evidencia, amables en la lectura</em>. Toda pieza equilibra sustento (fuentes, método, contexto) con accesibilidad (sin jerga innecesaria).</p>
          <ul className="generales">
            <li>
              <strong>Originalidad</strong>
              <p>Se prioriza el material inédito. Para trabajos estudiantiles se relaja el requisito: se aceptan trabajos de materias o de retos aunque no se hayan publicado antes, con aprobación del comité. Declara, por transparencia, si la pieza fue entregada en una materia o presentada en algún evento.</p>
            </li>
            <li>
              <strong>Antiplagio</strong>
              <p>Toda pieza con datos, citas o imágenes debe atribuir correctamente sus fuentes. Los trabajos de investigación pasan por una verificación antiplagio con Turnitin antes del dictamen.</p>
            </li>
            <li>
              <strong>Uso de IA</strong>
              <p>Se permite como apoyo en tareas específicas (corrección de estilo, asistencia en programación, revisión metodológica), siempre declarado: qué herramienta, con qué finalidad y en qué partes. La revista puede rechazar trabajos ante evidencia o sospecha fundada de uso indebido.</p>
            </li>
            <li>
              <strong>Equidad de género</strong>
              <p>La revista busca en todo momento la equidad de género y la igualdad de oportunidades, procurando de manera activa la participación homogénea a lo largo de sus ediciones.</p>
            </li>
            <li>
              <strong>Fuentes y datos</strong>
              <p>Todo dato lleva fuente y fecha. En piezas con datos se incluye una nota metodológica breve (origen, limpieza, supuestos y límites). Cuando sea posible, se enlaza el repositorio con código o los datos usados.</p>
            </li>
            <li>
              <strong>Metadatos</strong>
              <p>Cada pieza registra título, autoría, filiación y correo. Las piezas de investigación suman resumen y de 3 a 5 palabras clave; códigos JEL y ORCID cuando existan.</p>
            </li>
            <li>
              <strong>Citación</strong>
              <p>Se adopta Chicago como estilo de citación único, cuidando la limpieza y presentación de la revista.</p>
            </li>
          </ul>
        </section>
      
        <section id="niveles">
          <p className="ceja">¿Cómo se revisa?</p>
          <h2>Tres niveles de dictamen</h2>
          <div className="niveles">
            <article className="nivel">
              <span className="letra">A</span>
              <h3>Dictamen doble ciego por pares</h3>
              <p>Dos dictaminadores evalúan el manuscrito anonimizado con la rúbrica del Dictamen Maestro.</p>
              <em>Miradas Económicas y Horizonte Global cuando la pieza es investigación.</em>
            </article>
            <article className="nivel">
              <span className="letra">B</span>
              <h3>Revisión reforzada y verificación de datos</h3>
              <p>Revisor estudiante y revisor de datos o profesor; foco en fuentes, método y claridad.</p>
              <em>Datanomics y Horizonte Global (análisis).</em>
            </article>
            <article className="nivel">
              <span className="letra">C</span>
              <h3>Edición y verificación</h3>
              <p>Se verifican datos, consentimientos y derechos de imagen, y se edita el estilo.</p>
              <em>Apertura, La Voz de la Experiencia, ¿Sabías que…?, Capital Social y Excelencia en Acción.</em>
            </article>
          </div>
        </section>
      
        <section id="secciones">
          <p className="ceja">Sección por sección</p>
          <h2>Criterios por sección</h2>
          <p className="texto">Cada bloque incluye propósito, autoría, formato, qué sí y qué no entra, requisitos obligatorios, criterios de evaluación y el checklist de cierre.</p>
      
          <div className="acordeon">
      
            <details id="datanomics">
              <summary>
                <i style={{ background: 'var(--ambar)' }}></i>
                <h3>1 · Datanomics</h3>
                <span className="nivel-etq">Nivel B</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Publicar visualizaciones e infografías basadas en datos que expliquen fenómenos económicos, acercando herramientas prácticas (Excel, Python, R, SQL) con un how-to breve.</p>
                <p className="dato"><strong>Formato y extensión</strong> Visualización + texto de 200 a 800 palabras (cápsula ~200, artículo 500 a 800), con 1 a 3 gráficas; opcional repositorio con código en GitHub.</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Visualizaciones con fuente de datos explícita y fecha, indicando qué miden y por qué importan.</li>
                      <li>Comparaciones claras (tiempo, regiones, grupos) con un hallazgo principal sustentado por el gráfico.</li>
                      <li>Metodología breve: de dónde viene el dato y cómo se limpió o transformó (3 a 4 líneas).</li>
                      <li>Recursos replicables: herramientas, cursos o recursos vinculados al caso.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Gráficas atractivas sin pregunta económica ni conclusión verificable.</li>
                      <li>Visualizaciones sin fuente, sin fecha o con datos imposibles de rastrear.</li>
                      <li>Interpretación fuerte sin evidencia.</li>
                      <li>Tutoriales largos tipo manual técnico o infografías decorativas.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Fuente citada y fecha del dato.</li>
                  <li>Nota metodológica de 3 a 4 líneas.</li>
                  <li>Un hallazgo principal legible en el propio gráfico.</li>
                  <li>Ejes, unidades y escalas correctamente rotulados.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Trazabilidad del dato (condición de entrada), corrección metodológica, legibilidad del gráfico (escalas honestas), valor del hallazgo y utilidad del how-to.</p>
                <p className="umbral">No se publica sin fuente citada, fecha y un hallazgo verificable en el propio gráfico.</p>
              </div>
            </details>
      
            <details id="voz">
              <summary>
                <i style={{ background: 'var(--perla)' }}></i>
                <h3>2 · La Voz de la Experiencia</h3>
                <span className="nivel-etq">Nivel C</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Conversar con economistas en activo para aprender cómo se piensa y se trabaja en el mundo real, obtener posturas argumentadas y orientar el desarrollo profesional de la comunidad.</p>
                <p className="dato"><strong>Formato y extensión</strong> Entrevista presencial, extractos de 100 a 200 palabras.</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Consejos accionables: habilidades, portafolio, entrevistas, primeros roles, posgrado.</li>
                      <li>Opiniones ancladas en evidencia o experiencia verificable, con contexto y límites.</li>
                      <li>Recomendaciones de lectura, herramientas y decisiones de carrera con ejemplos.</li>
                      <li>Explicación accesible para estudiantes, sin jerga innecesaria.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Motivación vacía sin pasos concretos.</li>
                      <li>Opinión política o ideológica sin datos, contexto o supuestos declarados.</li>
                      <li>Comentarios de coyuntura sin sustento o con afirmaciones absolutas.</li>
                      <li>Promoción personal o de empresa sin valor informativo; ataques a personas.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Presentación de la persona: rol, sector y trayectoria breve (2 a 3 líneas).</li>
                  <li>Al menos 3 consejos o ideas accionables.</li>
                  <li>Fuente cuando se citen datos o cifras.</li>
                  <li>Consentimiento del entrevistado sobre la publicación y sus citas.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Valor práctico, anclaje en evidencia o experiencia, accesibilidad, estructura de la conversación e interés de la comunidad.</p>
                <p className="umbral">No se publica si es motivación genérica sin pasos o si contiene datos sin fuente.</p>
              </div>
            </details>
      
            <details id="miradas">
              <summary>
                <i style={{ background: 'var(--coral)' }}></i>
                <h3>3 · Miradas Económicas</h3>
                <span className="nivel-etq">Nivel A</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Difundir investigaciones económicas breves para acercar el conocimiento académico a la comunidad y al público general. Es la sección insignia de investigación y el sello de rigor de la revista.</p>
                <p className="dato"><strong>Formato y extensión</strong> Paper breve de hasta 5 cuartillas (aprox. 2,000 a 2,500 palabras) + código QR al documento completo. Etiqueta discreta de posgrado en la parte superior derecha cuando aplique. Subsección para investigaciones del extranjero.</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Investigación original con metodología cualitativa o cuantitativa y marco teórico claro.</li>
                      <li>Estudios de caso, modelos económicos y análisis de política pública.</li>
                      <li>Evidencias finales de materias y trabajos de equipos ganadores de retos.</li>
                      <li>Temas actuales: inflación, empleo, desigualdad, crecimiento, fintech, política monetaria, entre otros.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Opiniones sin sustento académico.</li>
                      <li>Ensayos puramente reflexivos o narrativos.</li>
                      <li>Divulgación general sin metodología ni referencias.</li>
                      <li>Lenguaje excesivamente técnico sin explicación.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Pregunta de investigación explícita.</li>
                  <li>Marco teórico breve y metodología identificable.</li>
                  <li>Hallazgo principal, implicación y limitaciones declaradas.</li>
                  <li>Referencias completas y QR funcional al paper íntegro.</li>
                  <li>Extensión dentro de las 5 cuartillas; etiqueta de posgrado si corresponde.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Con la rúbrica del Dictamen Maestro: relevancia, claridad de la pregunta, rigor conceptual (crítico), evidencia y metodología (crítico), estructura, escritura y adecuación al formato.</p>
                <p className="umbral">No se acepta con puntaje menor a 2 en rigor conceptual, metodología o claridad de la pregunta. Cualquier problema crítico impide la decisión de aceptado.</p>
              </div>
            </details>
      
            <details id="horizonte">
              <summary>
                <i style={{ background: 'var(--pizarra)' }}></i>
                <h3>4 · Horizonte Global</h3>
                <span className="nivel-etq">Nivel B (A si es paper)</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Traducir la economía internacional a un lenguaje accesible, aplicar modelos económicos a problemas globales contemporáneos y conectar lo que ocurre en el mundo con la economía local mexicana.</p>
                <p className="dato"><strong>Formato y extensión</strong> Análisis explicativo, aplicado y accesible, de 800 a 1500 palabras, con gráficas de apoyo (fuente + fecha).</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Temas que inviten a cuestionar lo aprendido en clase.</li>
                      <li>Papers y ensayos que expliquen cómo lo que pasa en Asia o Europa afecta la economía local.</li>
                      <li>Ideas nuevas o innovadoras sobre la perspectiva global.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Resumen de lo que ya salió en las noticias.</li>
                      <li>Lenguaje excesivamente técnico: si un alumno de primer semestre no lo entiende, no sirve.</li>
                      <li>Afirmaciones sin canales de transmisión ni evidencia.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Hecho detonante y por qué importa para México.</li>
                  <li>Pregunta guía y un marco conceptual simple (concepto explicado).</li>
                  <li>Canales de transmisión del fenómeno hacia la economía local.</li>
                  <li>Gráficas con fuente y fecha; implicaciones y cierre con indicadores a seguir y límites.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Aplicación conceptual (aplica teoría, no resume noticias), conexión global a local explícita y razonada, accesibilidad (pasa el test de primer semestre) y evidencia gráfica con fuente y fecha.</p>
                <p className="umbral">No se publica si es solo resumen de coyuntura, sin marco conceptual ni conexión con México.</p>
              </div>
            </details>
      
            <details id="sabias">
              <summary>
                <i style={{ background: 'var(--indigo)' }}></i>
                <h3>5 · ¿Sabías que…?</h3>
                <span className="nivel-etq">Nivel C</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Compartir datos curiosos, hechos relevantes y hallazgos breves sobre economía, economistas y actualidad, para despertar la curiosidad y ampliar la cultura económica de la comunidad.</p>
                <p className="dato"><strong>Formato y extensión</strong> Cápsula breve de 100 a 200 palabras, visualmente atractiva (imagen o gráfico + texto conciso).</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Datos curiosos sobre conceptos o fenómenos económicos.</li>
                      <li>Hechos interesantes de la historia económica.</li>
                      <li>Curiosidades sobre economistas y sus aportaciones.</li>
                      <li>Explicaciones breves de eventos económicos actuales.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Contenido excesivamente técnico para el formato breve.</li>
                      <li>Explicaciones extensas que rompen el carácter de cápsula.</li>
                      <li>Datos desactualizados o fuera de contexto.</li>
                      <li>Temas no relacionados con la economía.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Fuente verificable del dato (registrada aunque no se muestre completa).</li>
                  <li>Contexto y fecha cuando sea pertinente.</li>
                  <li>Un gancho claro que motive la lectura.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Veracidad y verificabilidad del dato (condición de entrada), interés del gancho, concisión y claridad visual.</p>
                <p className="umbral">No se publica si el dato no es verificable o está fuera de contexto.</p>
              </div>
            </details>
      
            <details id="capital">
              <summary>
                <i style={{ background: 'var(--perla)' }}></i>
                <h3>6 · Capital Social</h3>
                <span className="nivel-etq">Nivel C</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Documentar y fortalecer la identidad de la comunidad estudiantil: eventos, congresos, experiencias y aprendizajes que ocurren fuera del aula (SALEC, foros, visitas, intercambios).</p>
                <p className="dato"><strong>Formato y extensión</strong> Crónica de tono cercano y documentado de 500 a 900 palabras, con 2 a 4 fotos y sus pies de foto.</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Relatos en primera persona sobre la vida en la facultad.</li>
                      <li>Contenido visual que acompañe las crónicas de eventos.</li>
                      <li>Métodos y tips de estudio para las materias de economía.</li>
                      <li>Charlas con profesores destacados o alumnos con proyectos sobresalientes.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Críticas destructivas hacia la institución o los docentes.</li>
                      <li>Lenguaje informal excesivo: se mantiene el decoro editorial.</li>
                      <li>Contenido sin conexión con la facultad o la economía.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Qué evento o experiencia se relata y por qué importa.</li>
                  <li>2 a 4 fotos con pie de foto: qué, quién, fecha y lugar.</li>
                  <li>Revisión previa de imágenes por el equipo de Fotografía y Archivo.</li>
                  <li>Consentimiento de las personas fotografiadas.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Valor comunitario, precisión factual (fechas, nombres y lugares correctos), tono cercano con decoro y calidad y pertinencia visual.</p>
                <p className="umbral">No se publica con críticas destructivas ni con fotos sin revisión de Fotografía y Archivo o sin consentimiento.</p>
              </div>
            </details>
      
            <details id="excelencia">
              <summary>
                <i style={{ background: 'var(--coral)' }}></i>
                <h3>7 · Excelencia en Acción</h3>
                <span className="nivel-etq">Nivel C</span>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>Propósito</strong> Reconocer y visibilizar los logros académicos y profesionales de la comunidad de Economía, para celebrar la excelencia y fortalecer el sentido de comunidad.</p>
                <p className="dato"><strong>Formato y extensión</strong> Cápsula de reconocimiento: foto + nombre + semestre, cargo o vínculo + descripción concisa del logro.</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>Qué sí entra</h4>
                    <ul>
                      <li>Logros académicos: premios, becas, publicaciones, concursos, certificaciones.</li>
                      <li>Reconocimientos institucionales o externos y participación sobresaliente en proyectos.</li>
                      <li>Investigaciones que lograron publicarse.</li>
                      <li>Méritos profesionales relacionados con el ámbito económico.</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>Qué no entra</h4>
                    <ul>
                      <li>Logros no relacionados con el ámbito académico o profesional.</li>
                      <li>Contenido sin información suficiente o verificable.</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>Requisitos obligatorios</strong></p>
                <ul>
                  <li>Evidencia del logro: documento, enlace o constancia.</li>
                  <li>Fotografía proporcionada por la persona, con su consentimiento.</li>
                  <li>Datos correctos: nombre, semestre o cargo, vínculo con la institución.</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>Cómo se evalúa</strong> Verificabilidad del logro (condición de entrada), pertinencia, claridad de la cápsula, consentimiento y exactitud de datos.</p>
                <p className="umbral">No se publica sin evidencia del logro ni consentimiento de la persona reconocida.</p>
              </div>
            </details>
      
          </div>
        </section>
      
        <section id="matriz">
              <h2>Las secciones de un vistazo</h2>
          <div className="tabla-scroll">
            <table className="matriz">
              <thead>
                <tr><th>Sección</th><th>Cómo se revisa</th><th>Extensión sugerida</th></tr>
              </thead>
              <tbody>
                <tr><td>1 · Datanomics</td><td>B · Reforzada + datos</td><td>200 a 800 palabras + 1 a 3 gráficas</td></tr>
                <tr><td>2 · La Voz de la Experiencia</td><td>C · Editorial + fact-check</td><td>Extractos de 100 a 200 palabras</td></tr>
                <tr><td>3 · Miradas Económicas</td><td>A · Doble ciego por pares</td><td>Hasta 5 cuartillas + QR</td></tr>
                <tr><td>4 · Horizonte Global</td><td>B (A si es paper)</td><td>800 a 1500 palabras</td></tr>
                <tr><td>5 · ¿Sabías que…?</td><td>C · Fact-check</td><td>100 a 200 palabras</td></tr>
                <tr><td>6 · Capital Social</td><td>C · Editorial + imagen</td><td>500 a 900 palabras + fotos</td></tr>
                <tr><td>7 · Excelencia en Acción</td><td>C · Verificación del logro</td><td>Cápsula (foto + texto)</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      
        <div className="cierre">
          <p>¿Tu pieza ya cumple con su sección? El asistente de envío te guía en 4 pasos.</p>
          <a className="boton boton--lleno" href="index.html#envio">Publica tu artículo</a>
        </div>
      </main>      <Pie satelite style={EN_FLUJO} />
      <Revelar />
    </>
  );
}

import type { Metadata } from "next";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import Revelar from "@/components/satelite/Revelar";
import "./quienes-somos.css";

export const metadata: Metadata = { title: "Acerca de · Vértices" };

/**
 * Contenido portado de quienes-somos.html:240-335, convertido a JSX sin
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
        <div className="hero-qs">
          <div className="hero-cont">
            <p className="ceja">Vértices · Revista académica de economía</p>
            <h1>Acerca de</h1>
            <p className="qs-lema">El punto donde las ideas se conectan</p>
            <div className="entrada">
              <p>Vértices es la revista estudiantil de economía del Tecnológico de Monterrey, Campus Ciudad de México, creada por y para la comunidad de la Licenciatura en Economía (LEC). Nace de una idea sencilla: una revista <em>de economistas para economistas</em>, rigurosa en la evidencia y amable en la lectura.</p>
              <p>Somos un espacio de encuentro y convergencia de ideas, donde el pensamiento crítico, la pluralidad de perspectivas y la conexión entre la teoría económica y los problemas que nos rodean se expresan con claridad, sin jerga innecesaria.</p>
            </div>
          </div>
        </div>
      
      
        <section id="mision">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--indigo)' }}></i>Misión</p>
          <h2>El punto de encuentro del rigor y las ideas</h2>
          <p className="texto">Ser el punto de encuentro y convergencia de ideas y rigor académico, impulsando espacios que contribuyan a la formación de la comunidad estudiantil, en donde se transforma el conocimiento en nuevas perspectivas que cuestionan, debaten y proponen soluciones a los retos económicos del mundo actual.</p>
        </section>
      
      
        <section id="vision">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--perla)' }}></i>Visión</p>
          <h2>La revista de economía referente a nivel universitario</h2>
          <p className="texto">Consolidarnos como la revista estudiantil de economía referente a nivel universitario, reconocida por su pensamiento crítico, su pluralidad de ideas y su capacidad para conectar la teoría económica con los retos mundiales contemporáneos.</p>
        </section>
      
      
        <section id="valores">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--ambar)' }}></i>Valores</p>
          <h2>Los valores que compartimos con el Tec</h2>
          <p className="texto">Como proyecto de la comunidad del Tecnológico de Monterrey, Vértices hace suyos los valores institucionales y los lleva a la práctica editorial en cada número.</p>
          <div className="valores">
            <article className="valor">
              <i style={{ background: 'var(--indigo)' }}></i>
              <h3>Innovación</h3>
              <p>Nos apasiona la disrupción que genera valor: buscamos formatos y preguntas que renueven la conversación económica.</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--perla)' }}></i>
              <h3>Integridad</h3>
              <p>Ejercemos la libertad con responsabilidad: cada afirmación publicada tiene fuente, método y autoría transparentes.</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--pizarra)' }}></i>
              <h3>Colaboración</h3>
              <p>Juntos alcanzamos la visión: la revista es obra de estudiantes, docentes y profesionales que revisan y construyen en equipo.</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--coral)' }}></i>
              <h3>Empatía e inclusión</h3>
              <p>Ponemos siempre en primer lugar a las personas: escribimos para quien quiera entender y buscamos la equidad en nuestras autorías.</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--ambar)' }}></i>
              <h3>Ciudadanía global</h3>
              <p>Trabajamos por un mundo sostenible: conectamos los fenómenos globales con sus efectos en la economía local.</p>
            </article>
          </div>
          <p className="fuente-nota">Valores institucionales del <a href="https://tec.mx/es/conocenos/principios-valores-y-vision" target="_blank" rel="noopener">Tecnológico de Monterrey</a>.</p>
        </section>
      
      
        <section id="integridad">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--coral)' }}></i>Integridad académica</p>
          <h2>Cómo cuidamos el rigor de lo que publicamos</h2>
          <ul className="integridad">
            <li>
              <strong>Dictaminación</strong>
              <p>Tres niveles de revisión según el tipo de pieza. La investigación pasa por dictamen doble ciego: dos personas evalúan el manuscrito anonimizado con una rúbrica común.</p>
            </li>
            <li>
              <strong>Antiplagio</strong>
              <p>Los trabajos de investigación pasan por una verificación antiplagio con Turnitin antes del dictamen, y toda pieza con datos, citas o imágenes atribuye correctamente sus fuentes.</p>
            </li>
            <li>
              <strong>Fuentes y datos</strong>
              <p>Todo dato lleva fuente y fecha. Las piezas con datos incluyen una nota metodológica breve y, cuando es posible, enlazan el repositorio con el código o los datos usados. Citamos en estilo Chicago.</p>
            </li>
            <li>
              <strong>Uso de IA</strong>
              <p>Las herramientas de inteligencia artificial se permiten solo como apoyo declarado (corrección de estilo, programación, revisión metodológica). En la investigación dictaminada por pares no se permite IA generativa para elaborar el contenido del manuscrito.</p>
            </li>
            <li>
              <strong>Equidad de género</strong>
              <p>Buscamos de manera activa la participación homogénea y registramos el balance de autoría en cada número.</p>
            </li>
          </ul>
          <p className="fuente-nota">El detalle completo vive en los <a href="lineamientos.html">lineamientos editoriales</a>.</p>
        </section>
      
        <div className="cierre">
          <p>La convocatoria está abierta: estudiantes de Economía, economistas titulados, científicos de datos y científicos sociales.</p>
          <a className="boton boton--lleno" href="index.html#envio">Publica tu artículo</a>
        </div>
      </main>      <Pie satelite style={EN_FLUJO} />
      <Revelar />
    </>
  );
}

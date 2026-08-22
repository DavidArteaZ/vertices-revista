/**
 * Los 26 artículos de demostración, tal y como estaban en
 * src/lib/datos/articulos.ts hasta la etapa 5.
 *
 * Viven aquí y no en src/ porque ya no son datos de la aplicación: son la
 * SEMILLA de la base. La aplicación los lee de public.articulos como leerá
 * cualquier pieza real. Este archivo existe para poder regenerar la migración
 * y para que las pruebas comprueben sus invariantes sin necesitar Postgres.
 */
const DIACRITICOS = /[̀-ͯ]/g;
const slug = (t) =>
  t.toLowerCase().normalize("NFD").replace(DIACRITICOS, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** t: título · a: autoría · s: sección · tm: temas · min: minutos · dest: destacado */
const ARTICULOS = [
  { t: "La transmisión de la política monetaria en México después de 2021", a: "Ana Sofía Herrera", s: "Miradas Económicas", tm: ["Política Monetaria", "Banca Central", "Macroeconomía"], min: 12, dest: true },
  { t: "Nearshoring: ¿la oportunidad que México sí puede capturar?", a: "Diego Ramírez Peña", s: "Horizonte Global", tm: ["Comercio Internacional", "Guerras Comerciales y Geoeconomía"], min: 9, dest: true },
  { t: "Sesgos que cuestan: el ahorro juvenil visto desde la economía conductual", a: "Valeria Cantú", s: "Miradas Económicas", tm: ["Economía Conductual", "Finanzas"], min: 8 },
  { t: "El peso en datos: 30 años de tipo de cambio en una sola gráfica", a: "Emilio Zárate", s: "Datanomics", tm: ["Ciencia de Datos", "Mercados Financieros"], min: 6, dest: true },
  { t: "¿Sabías que el Banco de México nació en 1925?", a: "Equipo Vértices", s: "¿Sabías Qué?", tm: ["Banca Central", "Historia del Pensamiento Económico"], min: 3 },
  { t: "Cooperar o traicionar: teoría de juegos en la OPEP", a: "Marcela Ortiz", s: "Miradas Económicas", tm: ["Teoría de Juegos", "Economía Política"], min: 10 },
  { t: "Fintech en México: ¿inclusión financiera o espejismo digital?", a: "Rodrigo Elizondo", s: "Miradas Económicas", tm: ["Fintech", "Finanzas"], min: 11, dest: true },
  { t: "Enseñar economía del comportamiento: conversación con la cátedra", a: "Redacción Vértices", s: "La Voz de la Experiencia", tm: ["Economía Conductual"], min: 7 },
  { t: "Salarios mínimos y empleo juvenil: lo que dicen los microdatos", a: "Paola Gutiérrez", s: "Datanomics", tm: ["Economía Laboral", "Econometría"], min: 9 },
  { t: "Stablecoins y remesas: el corredor México-Estados Unidos", a: "Iker Morales", s: "Miradas Económicas", tm: ["Criptomonedas y Activos Digitales", "Fintech"], min: 10 },
  { t: "El costo de la desigualdad: movilidad social en la Ciudad de México", a: "Regina Salas", s: "Miradas Económicas", tm: ["Desigualdad y Distribución", "Economía del Desarrollo"], min: 13, dest: true },
  { t: "El dilema eléctrico mexicano: transición energética y mercado", a: "Santiago Vela", s: "Horizonte Global", tm: ["Economía Ambiental", "Economía Pública"], min: 9 },
  { t: "¿Sabías que en México ya se comercian derechos de emisión?", a: "Equipo Vértices", s: "¿Sabías Qué?", tm: ["Economía Ambiental"], min: 3 },
  { t: "Precios dinámicos y poder de mercado en las plataformas de reparto", a: "Fernanda Ríos", s: "Miradas Económicas", tm: ["Economía de Plataformas", "Organización Industrial", "Microeconomía"], min: 10, dest: true },
  { t: "IA generativa y productividad: primeras señales en firmas mexicanas", a: "Alonso Vergara", s: "Miradas Económicas", tm: ["IA y Economía", "Ciencia de Datos"], min: 11, dest: true },
  { t: "Crónica del primer coloquio estudiantil de economía", a: "Redacción Vértices", s: "Capital Social", tm: ["Economía de Redes"], min: 5 },
  { t: "Los tres ensayos ganadores del semestre", a: "Comité Editorial", s: "Excelencia en Acción", tm: [], min: 4 },
  { t: "Por qué una revista de economía hecha por estudiantes", a: "Comité Editorial", s: "Apertura Editorial", tm: [], min: 4 },
  { t: "ESG bajo la lupa: ¿los fondos sostenibles rinden menos?", a: "Camila Deloya", s: "Miradas Económicas", tm: ["Finanzas Sostenibles y ESG", "Mercados Financieros"], min: 9, dest: true },
  { t: "El regreso de la política industrial: lecciones de Asia oriental", a: "Héctor Lomelí", s: "Horizonte Global", tm: ["Economía del Desarrollo", "Economía Institucional", "Economía Política"], min: 12 },
  { t: "La inflación mexicana contada en 12 gráficas", a: "Equipo Datanomics", s: "Datanomics", tm: ["Macroeconomía", "Econometría"], min: 7, dest: true },
  { t: "Mapear una guerra comercial: aranceles y redes de producción", a: "Luis Barrientos", s: "Miradas Económicas", tm: ["Economía de Redes", "Guerras Comerciales y Geoeconomía", "Comercio Internacional"], min: 11 },
  { t: "Microcréditos y decisiones de mujeres rurales: evidencia de campo", a: "Ximena Paredes", s: "Miradas Económicas", tm: ["Economía del Desarrollo", "Microeconomía"], min: 10 },
  { t: "De la licenciatura al banco central: una trayectoria posible", a: "Redacción Vértices", s: "La Voz de la Experiencia", tm: ["Banca Central", "Política Monetaria"], min: 8 },
  { t: "Keynes en el siglo XXI: releer la Teoría General", a: "Mateo Iglesias", s: "Miradas Económicas", tm: ["Historia del Pensamiento Económico", "Macroeconomía"], min: 9 },
  { t: "Impuestos saludables: la economía pública del refresco", a: "Daniela Roldán", s: "Miradas Económicas", tm: ["Economía Pública", "Microeconomía"], min: 8 },
];


export { ARTICULOS, slug };

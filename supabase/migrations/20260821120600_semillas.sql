-- GENERADO por scripts/rubricas/generar-semillas.mjs. No editar a mano:
-- vuelve a generarse desde el libro de Excel y estos cambios se perderían.
--
-- Semillas de referencia y de las ocho rúbricas (spec §5.1 y §6.1).

insert into public.secciones (numero, nombre_canonico, nombre_display, slug, nivel, descripcion, orden, es_asignable, publica) values
  (1, '1 · Apertura editorial', 'Apertura Editorial', 'apertura-editorial', 'C', 'La carta que abre cada número: qué encontrarás, por qué existe la revista y el estándar de rigor que la sostiene.', 1, true, true),
  (2, '2 · Datanomics', 'Datanomics', 'datanomics', 'B', 'Visualizaciones e infografías sobre fenómenos económicos, con metodología clara y herramientas replicables (Python, R, Excel, SQL).', 2, true, true),
  (3, '3 · La Voz de la Experiencia', 'La Voz de la Experiencia', 'la-voz-de-la-experiencia', 'C', 'Conversaciones con economistas en activo: cómo se piensa y se trabaja en el mundo real, con consejos de carrera accionables.', 3, true, true),
  (4, '4 · Miradas Económicas', 'Miradas Económicas', 'miradas-economicas', 'A', 'El núcleo académico: investigaciones y papers dictaminados a doble ciego, con acceso al documento completo.', 4, true, true),
  (5, '5 · Horizonte Global', 'Horizonte Global', 'horizonte-global', 'B', 'La economía internacional en lenguaje accesible: cómo un suceso global se traduce en inflación, tipo de cambio y tasas en México.', 5, true, true),
  (6, '6 · ¿Sabías que…?', '¿Sabías Qué?', 'sabias-que', 'C', 'Cápsulas breves y visuales: datos curiosos sobre economía, economistas e historia económica.', 6, true, true),
  (7, '7 · Capital Social', 'Capital Social', 'capital-social', 'C', 'La vida de la comunidad: foros, congresos, estancias y las historias detrás de la facultad.', 7, true, true),
  (8, '8 · Excelencia en Acción', 'Excelencia en Acción', 'excelencia-en-accion', 'C', 'Reconocimiento a los logros académicos y profesionales de la comunidad de Economía.', 8, true, true),
  (null, 'Por asignar', 'Por asignar', 'por-asignar', null, 'Piezas cuya sección todavía no decide el comité. No pueden asignarse a dictamen hasta triaje.', 99, false, false);

insert into public.temas (nombre, slug, orden) values
  ('Macroeconomía', 'macroeconomia', 1),
  ('Microeconomía', 'microeconomia', 2),
  ('Finanzas', 'finanzas', 3),
  ('Ciencia de Datos', 'ciencia-de-datos', 4),
  ('Teoría de Juegos', 'teoria-de-juegos', 5),
  ('Economía Conductual', 'economia-conductual', 6),
  ('Econometría', 'econometria', 7),
  ('Organización Industrial', 'organizacion-industrial', 8),
  ('Comercio Internacional', 'comercio-internacional', 9),
  ('Política Monetaria', 'politica-monetaria', 10),
  ('Economía del Desarrollo', 'economia-del-desarrollo', 11),
  ('Economía Laboral', 'economia-laboral', 12),
  ('Economía Pública', 'economia-publica', 13),
  ('Economía Ambiental', 'economia-ambiental', 14),
  ('Mercados Financieros', 'mercados-financieros', 15),
  ('Fintech', 'fintech', 16),
  ('Criptomonedas y Activos Digitales', 'criptomonedas-y-activos-digitales', 17),
  ('Desigualdad y Distribución', 'desigualdad-y-distribucion', 18),
  ('Economía Política', 'economia-politica', 19),
  ('Historia del Pensamiento Económico', 'historia-del-pensamiento-economico', 20),
  ('Economía Institucional', 'economia-institucional', 21),
  ('Economía de Redes', 'economia-de-redes', 22),
  ('IA y Economía', 'ia-y-economia', 23),
  ('Economía de Plataformas', 'economia-de-plataformas', 24),
  ('Finanzas Sostenibles y ESG', 'finanzas-sostenibles-y-esg', 25),
  ('Banca Central', 'banca-central', 26),
  ('Guerras Comerciales y Geoeconomía', 'guerras-comerciales-y-geoeconomia', 27),
  ('Otro tema', 'otro-tema', 28);

insert into public.tipos_pieza (nombre, orden) values
  ('Paper/Investigación', 1),
  ('Artículo', 2),
  ('Nota', 3),
  ('Entrevista', 4),
  ('Visualización', 5),
  ('Infografía', 6),
  ('Cápsula', 7),
  ('Crónica', 8),
  ('Reseña', 9);

-- Los ocho instrumentos. Las etiquetas salen tal cual de la fila 7 de cada
-- hoja; ★ marca puerta eliminatoria o dimensión crítica, y es la misma
-- marca que usa el libro.
do $$
declare
  spec jsonb := '[
{"seccion":"1 · Apertura editorial","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Menciona explícitamente las secciones del número",true],["Incluye 3–4 reglas del estándar editorial",false],["Señala fecha y formato de publicación (PDF y sitio)",false],["Cierra con una vía concreta de participación",false]],"dimensiones":[["★ Claridad de propósito (×2)",true,2,false],["Representatividad",false,1,false],["Tono de marca",false,1,false],["Concisión",false,1,false]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[15,[12,9,6,0]]]},
{"seccion":"2 · Datanomics","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Fuente del dato citada",true],["★ Fecha del dato indicada",true],["★ Hallazgo principal legible en el gráfico",true],["Ejes, unidades y escalas rotulados",false],["Nota metodológica de 3–4 líneas",false]],"dimensiones":[["★ Trazabilidad del dato",true,1,false],["Corrección metodológica",false,1,false],["★ Legibilidad del gráfico",true,1,false],["Valor del hallazgo",false,1,false],["Utilidad del how-to (0–3 o N/A)",false,1,true]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[12,[10,7,5,0]],[15,[12,9,6,0]]]},
{"seccion":"3 · La Voz de la Experiencia","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Consentimiento del entrevistado (publicación y citas)",true],["★ Derechos de imagen resueltos",true],["Al menos 3 consejos o ideas accionables",false],["Fuente cuando se citan datos o cifras",false]],"dimensiones":[["★ Valor práctico",true,1,false],["★ Anclaje en evidencia/experiencia",true,1,false],["Accesibilidad",false,1,false],["Estructura de la conversación",false,1,false],["Interés de la comunidad",false,1,false]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[15,[12,9,6,0]]]},
{"seccion":"4 · Miradas Económicas","falla_puerta":"No aceptable (revisar puertas ★)","falla_critico":"No aceptable (crítico < 2)","puertas":[["★ Verificación antiplagio realizada (Turnitin)",true],["★ Manuscrito anonimizado (doble ciego)",true],["★ Sin problemas críticos",true]],"dimensiones":[["A. Relevancia y pertinencia",false,1,false],["★ B. Claridad de idea/pregunta",true,1,false],["★ C. Rigor y precisión conceptual",true,1,false],["D. Estructura y coherencia",false,1,false],["★ E. Evidencia / fuentes / datos",true,1,false],["F. Escritura y legibilidad",false,1,false],["G. Adecuación al formato",false,1,false]],"decisiones":[["Aceptado",true],["Aceptado con revisiones menores",true],["Revisiones mayores",false],["Rechazado",false]],"bandas":[[21,[17,14,9,0]]]},
{"seccion":"5 · Horizonte Global","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Parte de un suceso internacional y su vínculo con México",true],["★ Conexión global→local (País) explícita",true],["Marco conceptual simple presente",false],["Gráficas con fuente y fecha",false]],"dimensiones":[["★ Suceso internacional y lente económico",true,1,false],["★ Aplicación conceptual",true,1,false],["★ Conexión global→local",true,1,false],["Canales de transmisión",false,1,false],["Accesibilidad",false,1,false],["Evidencia gráfica",false,1,false]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[18,[14,11,7,0]]]},
{"seccion":"6 · ¿Sabías que…?","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Fuente verificable del dato (registrada)",true],["Contexto y fecha cuando sea pertinente",false],["Un gancho claro",false]],"dimensiones":[["★ Veracidad / verificabilidad",true,1,false],["Interés",false,1,false],["Concisión",false,1,false],["Claridad visual",false,1,false]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[12,[10,7,5,0]]]},
{"seccion":"7 · Capital Social","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Fotos revisadas por Fotografía y Archivo",true],["★ Consentimiento de personas fotografiadas",true],["★ Sin críticas destructivas a institución/docentes",true],["Pies de foto completos (qué/quién/fecha/lugar)",false]],"dimensiones":[["Valor comunitario",false,1,false],["★ Precisión factual",true,1,false],["Tono (cercano con decoro)",false,1,false],["Calidad y pertinencia visual",false,1,false]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[12,[10,7,5,0]]]},
{"seccion":"8 · Excelencia en Acción","falla_puerta":"No publicable (falla puerta ★)","falla_critico":"Requiere reelaboración (crítico < 2)","puertas":[["★ Evidencia del logro (documento/enlace/constancia)",true],["★ Fotografía con consentimiento",true],["Datos correctos (nombre/semestre/cargo/vínculo)",false],["El logro pertenece al ámbito económico/académico",false]],"dimensiones":[["★ Verificabilidad del logro",true,1,false],["Pertinencia",false,1,false],["Claridad de la cápsula",false,1,false],["Consentimiento y exactitud",false,1,false]],"decisiones":[["Publicable",true],["Publicable con ajustes menores",true],["Requiere reelaboración",false],["No publicable en este número",false]],"bandas":[[12,[10,7,5,0]]]}
]'::jsonb;
  r jsonb;
  x jsonb;
  b jsonb;
  i int;
  v_version bigint;
  v_seccion bigint;
begin
  for r in select value from jsonb_array_elements(spec) loop
    select id into strict v_seccion
      from public.secciones where nombre_canonico = r->>'seccion';

    insert into public.rubrica_versiones
      (seccion_id, version, vigente, etiqueta_falla_puerta, etiqueta_falla_critico, etiqueta_pendiente)
    values (v_seccion, 1, true, r->>'falla_puerta', r->>'falla_critico', 'Pendiente de dictamen')
    returning id into v_version;

    i := 0;
    for x in select value from jsonb_array_elements(r->'puertas') loop
      i := i + 1;
      insert into public.rubrica_puertas (rubrica_version_id, orden, etiqueta, es_eliminatoria)
      values (v_version, i, x->>0, (x->>1)::boolean);
    end loop;

    i := 0;
    for x in select value from jsonb_array_elements(r->'dimensiones') loop
      i := i + 1;
      insert into public.rubrica_dimensiones
        (rubrica_version_id, orden, etiqueta, es_critica, peso, permite_na)
      values (v_version, i, x->>0, (x->>1)::boolean, (x->>2)::smallint, (x->>3)::boolean);
    end loop;

    i := 0;
    for x in select value from jsonb_array_elements(r->'decisiones') loop
      i := i + 1;
      insert into public.decisiones (rubrica_version_id, orden, etiqueta, es_aceptante, es_falla)
      values (v_version, i, x->>0, (x->>1)::boolean, false);
    end loop;

    -- Las dos fallas y el pendiente también son decisiones: la instantánea
    -- del dictamen apunta a una fila de esta tabla, gane o pierda la pieza.
    insert into public.decisiones (rubrica_version_id, orden, etiqueta, es_aceptante, es_falla) values
      (v_version, 90, r->>'falla_puerta', false, true),
      (v_version, 91, r->>'falla_critico', false, true),
      (v_version, 99, 'Pendiente de dictamen', false, false);

    for b in select value from jsonb_array_elements(r->'bandas') loop
      for i in 0 .. jsonb_array_length(b->1) - 1 loop
        insert into public.bandas_decision (rubrica_version_id, variante, min_puntaje, decision_id)
        select v_version, (b->>0)::smallint, (b->1->>i)::smallint, d.id
          from public.decisiones d
         where d.rubrica_version_id = v_version
           and d.etiqueta = r->'decisiones'->i->>0;
      end loop;
    end loop;
  end loop;
end $$;

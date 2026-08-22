-- Los 26 artículos de demostración (spec §5.5).
--
-- GENERADO por scripts/articulos/generar-semillas.mjs. No editar a mano.
--
-- Van con es_placeholder = true y sin edición: se ven desde el primer día para
-- que el descubrimiento por tema y por sección funcione antes de que exista el
-- primer número. No tienen PDF, así que /articulos/[slug] les pinta un vacío
-- definido — hoy esos enlaces son anclas muertas (index.html:1942). El comité
-- los borra desde el panel cuando haya contenido real.
--
-- El orden es el del arreglo que estaba en src/lib/datos/articulos.ts, y no es
-- decorativo: es el orden en que el panel de descubrimiento los lista, y la
-- compuerta visual lo compara contra el sitio legado.

do $$
declare
  fila jsonb;
  v_articulo bigint;
  v_tema text;
begin
  for fila in select * from jsonb_array_elements($semilla$
[
{"titulo":"La transmisión de la política monetaria en México después de 2021","autor":"Ana Sofía Herrera","seccion":"Miradas Económicas","temas":["Política Monetaria","Banca Central","Macroeconomía"],"minutos":12,"destacado":true,"slug":"la-transmision-de-la-politica-monetaria-en-mexico-despues-de-2021","orden":0},
{"titulo":"Nearshoring: ¿la oportunidad que México sí puede capturar?","autor":"Diego Ramírez Peña","seccion":"Horizonte Global","temas":["Comercio Internacional","Guerras Comerciales y Geoeconomía"],"minutos":9,"destacado":true,"slug":"nearshoring-la-oportunidad-que-mexico-si-puede-capturar","orden":1},
{"titulo":"Sesgos que cuestan: el ahorro juvenil visto desde la economía conductual","autor":"Valeria Cantú","seccion":"Miradas Económicas","temas":["Economía Conductual","Finanzas"],"minutos":8,"destacado":false,"slug":"sesgos-que-cuestan-el-ahorro-juvenil-visto-desde-la-economia-conductual","orden":2},
{"titulo":"El peso en datos: 30 años de tipo de cambio en una sola gráfica","autor":"Emilio Zárate","seccion":"Datanomics","temas":["Ciencia de Datos","Mercados Financieros"],"minutos":6,"destacado":true,"slug":"el-peso-en-datos-30-anos-de-tipo-de-cambio-en-una-sola-grafica","orden":3},
{"titulo":"¿Sabías que el Banco de México nació en 1925?","autor":"Equipo Vértices","seccion":"¿Sabías Qué?","temas":["Banca Central","Historia del Pensamiento Económico"],"minutos":3,"destacado":false,"slug":"sabias-que-el-banco-de-mexico-nacio-en-1925","orden":4},
{"titulo":"Cooperar o traicionar: teoría de juegos en la OPEP","autor":"Marcela Ortiz","seccion":"Miradas Económicas","temas":["Teoría de Juegos","Economía Política"],"minutos":10,"destacado":false,"slug":"cooperar-o-traicionar-teoria-de-juegos-en-la-opep","orden":5},
{"titulo":"Fintech en México: ¿inclusión financiera o espejismo digital?","autor":"Rodrigo Elizondo","seccion":"Miradas Económicas","temas":["Fintech","Finanzas"],"minutos":11,"destacado":true,"slug":"fintech-en-mexico-inclusion-financiera-o-espejismo-digital","orden":6},
{"titulo":"Enseñar economía del comportamiento: conversación con la cátedra","autor":"Redacción Vértices","seccion":"La Voz de la Experiencia","temas":["Economía Conductual"],"minutos":7,"destacado":false,"slug":"ensenar-economia-del-comportamiento-conversacion-con-la-catedra","orden":7},
{"titulo":"Salarios mínimos y empleo juvenil: lo que dicen los microdatos","autor":"Paola Gutiérrez","seccion":"Datanomics","temas":["Economía Laboral","Econometría"],"minutos":9,"destacado":false,"slug":"salarios-minimos-y-empleo-juvenil-lo-que-dicen-los-microdatos","orden":8},
{"titulo":"Stablecoins y remesas: el corredor México-Estados Unidos","autor":"Iker Morales","seccion":"Miradas Económicas","temas":["Criptomonedas y Activos Digitales","Fintech"],"minutos":10,"destacado":false,"slug":"stablecoins-y-remesas-el-corredor-mexico-estados-unidos","orden":9},
{"titulo":"El costo de la desigualdad: movilidad social en la Ciudad de México","autor":"Regina Salas","seccion":"Miradas Económicas","temas":["Desigualdad y Distribución","Economía del Desarrollo"],"minutos":13,"destacado":true,"slug":"el-costo-de-la-desigualdad-movilidad-social-en-la-ciudad-de-mexico","orden":10},
{"titulo":"El dilema eléctrico mexicano: transición energética y mercado","autor":"Santiago Vela","seccion":"Horizonte Global","temas":["Economía Ambiental","Economía Pública"],"minutos":9,"destacado":false,"slug":"el-dilema-electrico-mexicano-transicion-energetica-y-mercado","orden":11},
{"titulo":"¿Sabías que en México ya se comercian derechos de emisión?","autor":"Equipo Vértices","seccion":"¿Sabías Qué?","temas":["Economía Ambiental"],"minutos":3,"destacado":false,"slug":"sabias-que-en-mexico-ya-se-comercian-derechos-de-emision","orden":12},
{"titulo":"Precios dinámicos y poder de mercado en las plataformas de reparto","autor":"Fernanda Ríos","seccion":"Miradas Económicas","temas":["Economía de Plataformas","Organización Industrial","Microeconomía"],"minutos":10,"destacado":true,"slug":"precios-dinamicos-y-poder-de-mercado-en-las-plataformas-de-reparto","orden":13},
{"titulo":"IA generativa y productividad: primeras señales en firmas mexicanas","autor":"Alonso Vergara","seccion":"Miradas Económicas","temas":["IA y Economía","Ciencia de Datos"],"minutos":11,"destacado":true,"slug":"ia-generativa-y-productividad-primeras-senales-en-firmas-mexicanas","orden":14},
{"titulo":"Crónica del primer coloquio estudiantil de economía","autor":"Redacción Vértices","seccion":"Capital Social","temas":["Economía de Redes"],"minutos":5,"destacado":false,"slug":"cronica-del-primer-coloquio-estudiantil-de-economia","orden":15},
{"titulo":"Los tres ensayos ganadores del semestre","autor":"Comité Editorial","seccion":"Excelencia en Acción","temas":[],"minutos":4,"destacado":false,"slug":"los-tres-ensayos-ganadores-del-semestre","orden":16},
{"titulo":"Por qué una revista de economía hecha por estudiantes","autor":"Comité Editorial","seccion":"Apertura Editorial","temas":[],"minutos":4,"destacado":false,"slug":"por-que-una-revista-de-economia-hecha-por-estudiantes","orden":17},
{"titulo":"ESG bajo la lupa: ¿los fondos sostenibles rinden menos?","autor":"Camila Deloya","seccion":"Miradas Económicas","temas":["Finanzas Sostenibles y ESG","Mercados Financieros"],"minutos":9,"destacado":true,"slug":"esg-bajo-la-lupa-los-fondos-sostenibles-rinden-menos","orden":18},
{"titulo":"El regreso de la política industrial: lecciones de Asia oriental","autor":"Héctor Lomelí","seccion":"Horizonte Global","temas":["Economía del Desarrollo","Economía Institucional","Economía Política"],"minutos":12,"destacado":false,"slug":"el-regreso-de-la-politica-industrial-lecciones-de-asia-oriental","orden":19},
{"titulo":"La inflación mexicana contada en 12 gráficas","autor":"Equipo Datanomics","seccion":"Datanomics","temas":["Macroeconomía","Econometría"],"minutos":7,"destacado":true,"slug":"la-inflacion-mexicana-contada-en-12-graficas","orden":20},
{"titulo":"Mapear una guerra comercial: aranceles y redes de producción","autor":"Luis Barrientos","seccion":"Miradas Económicas","temas":["Economía de Redes","Guerras Comerciales y Geoeconomía","Comercio Internacional"],"minutos":11,"destacado":false,"slug":"mapear-una-guerra-comercial-aranceles-y-redes-de-produccion","orden":21},
{"titulo":"Microcréditos y decisiones de mujeres rurales: evidencia de campo","autor":"Ximena Paredes","seccion":"Miradas Económicas","temas":["Economía del Desarrollo","Microeconomía"],"minutos":10,"destacado":false,"slug":"microcreditos-y-decisiones-de-mujeres-rurales-evidencia-de-campo","orden":22},
{"titulo":"De la licenciatura al banco central: una trayectoria posible","autor":"Redacción Vértices","seccion":"La Voz de la Experiencia","temas":["Banca Central","Política Monetaria"],"minutos":8,"destacado":false,"slug":"de-la-licenciatura-al-banco-central-una-trayectoria-posible","orden":23},
{"titulo":"Keynes en el siglo XXI: releer la Teoría General","autor":"Mateo Iglesias","seccion":"Miradas Económicas","temas":["Historia del Pensamiento Económico","Macroeconomía"],"minutos":9,"destacado":false,"slug":"keynes-en-el-siglo-xxi-releer-la-teoria-general","orden":24},
{"titulo":"Impuestos saludables: la economía pública del refresco","autor":"Daniela Roldán","seccion":"Miradas Económicas","temas":["Economía Pública","Microeconomía"],"minutos":8,"destacado":false,"slug":"impuestos-saludables-la-economia-publica-del-refresco","orden":25}
]
$semilla$::jsonb)
  loop
    insert into public.articulos (
      titulo, autor, seccion_id, minutos_lectura, destacado, slug,
      es_placeholder, orden
    ) values (
      fila->>'titulo',
      fila->>'autor',
      (select s.id from public.secciones s where s.nombre_display = fila->>'seccion'),
      (fila->>'minutos')::smallint,
      (fila->>'destacado')::boolean,
      fila->>'slug',
      true,
      (fila->>'orden')::smallint
    )
    on conflict (slug) do nothing
    returning id into v_articulo;

    if v_articulo is null then
      continue;
    end if;

    for v_tema in select * from jsonb_array_elements_text(fila->'temas')
    loop
      insert into public.articulo_temas (articulo_id, tema_id)
      values (v_articulo, (select t.id from public.temas t where t.nombre = v_tema));
    end loop;
  end loop;
end $$;

-- Que la semilla haya encontrado sección y tema para todo, y no dejado nulos.
do $$
declare n int;
begin
  select count(*) into n from public.articulos where es_placeholder;
  if n <> 26 then
    raise exception 'se esperaban 26 artículos de muestra y hay %', n;
  end if;

  select count(*) into n from public.articulo_temas at
    join public.articulos a on a.id = at.articulo_id where a.es_placeholder;
  if n <> 49 then
    raise exception 'se esperaban 49 relaciones artículo-tema y hay %', n;
  end if;

  select count(*) into n from public.articulos where es_placeholder and destacado;
  if n <> 9 then
    raise exception 'se esperaban 9 destacados y hay %', n;
  end if;
end $$;

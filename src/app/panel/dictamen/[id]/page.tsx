import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase/sesion";
import { cargaRubrica, cargaRespuestas } from "@/lib/dictamen/cargar";
import { decidir } from "@/lib/dictamen/decidir";
import { exigePersonal, Cabecera } from "../../guardia";
import Tarjeta from "./Tarjeta";

/**
 * La tarjeta de dictamen: el instrumento de la sección, tal como está sembrado.
 *
 * Las puertas y las dimensiones no están escritas en el código. Vienen de
 * rubrica_puertas y rubrica_dimensiones, que se sembraron desde el libro de
 * Excel, y son distintas para cada uno de los ocho instrumentos: 31 puertas y
 * 39 dimensiones en total, con pesos y críticas propias. Cambiar una rúbrica
 * es cambiar datos, no desplegar.
 *
 * Enviar esta tarjeta desvela la autoría de la pieza a quien la envía, y sólo
 * a ella. Por eso la base exige que esté completa: una tarjeta en blanco
 * enviada produciría "Pendiente de dictamen" —indistinguible de no haber
 * empezado— y habría desvelado gratis.
 */

export const dynamic = "force-dynamic";

export default async function PaginaDictamen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quien = await exigePersonal();
  const sb = await sesion();

  const { data: dictamen } = await sb
    .from("dictamenes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!dictamen) notFound();

  const { data: envio } = await sb
    .from("envios")
    .select("id, folio, titulo, resumen, nivel")
    .eq("id", dictamen.envio_id)
    .maybeSingle();

  const rubrica = await cargaRubrica(sb, dictamen.rubrica_version_id);
  if (!envio || !rubrica) notFound();

  const respuestas = await cargaRespuestas(sb, id);

  // Vista previa del veredicto con lo que hay ahora mismo. `decidir` lanza si
  // una dimensión que no admite N/A viene en null, que es el mismo invariante
  // que impone el disparador; aquí eso no debería pasar y si pasa hay que
  // verlo, no esconderlo.
  let previa: ReturnType<typeof decidir> | null = null;
  let problema: string | null = null;
  try {
    previa = decidir(rubrica, respuestas);
  } catch (e) {
    problema = (e as Error).message;
  }

  const propio = dictamen.revisor_id === quien.id;
  const enviado = dictamen.estado === "enviado";

  return (
    <main className="panel-marco">
      <Cabecera quien={quien} />

      <h2>{envio.titulo}</h2>
      <p className="nota">
        <span className="folio">{envio.folio}</span>
        {envio.nivel && <> · Nivel {envio.nivel}</>} ·{" "}
        <a href={`/panel/envios/${envio.id}`}>volver al envío</a>
      </p>

      <div className="tarjeta">
        <p style={{ margin: 0 }}>{envio.resumen}</p>
      </div>

      {!propio && (
        <div className="tarjeta">
          <p className="aviso" style={{ margin: 0 }}>
            Esta tarjeta es de otra persona. Puedes leerla, no escribirla — y la base
            tampoco te dejaría.
          </p>
        </div>
      )}

      {problema && (
        <div className="tarjeta">
          <p className="aviso" style={{ margin: 0 }}>{problema}</p>
        </div>
      )}

      <Tarjeta
        dictamenId={id}
        rubrica={rubrica}
        puertas={Object.fromEntries(respuestas.puertas)}
        puntajes={Object.fromEntries(respuestas.puntajes)}
        comentarios={dictamen.comentarios ?? ""}
        sinConflicto={dictamen.sin_conflicto}
        soloLectura={!propio || enviado}
        enviado={enviado}
        previa={
          previa && {
            puntaje: previa.puntaje,
            maximo: previa.maximo,
            puertasOk: previa.puertasOk,
            criticosOk: previa.criticosOk,
            etiqueta: previa.decision.etiqueta,
            motivo: previa.motivo,
          }
        }
      />
    </main>
  );
}

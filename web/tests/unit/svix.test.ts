import { describe, expect, it } from "vitest";
import { verificaSvix, firmaSvix, VENTANA_SEGUNDOS } from "@/lib/api/svix";

/**
 * Un verificador de firma roto no se nota: acepta todo y no da error. Es
 * exactamente la clase de fallo que sólo atrapa una prueba, y lo que hay
 * detrás de esta ruta es escritura en la bitácora del comité.
 */

const SECRETO = "whsec_" + Buffer.from("una clave de prueba de 32 bytes.").toString("base64");
const CUERPO = JSON.stringify({ type: "email.bounced", data: { subject: "VTX-2026-001" } });
const ID = "msg_2abc";
const AHORA = 1_800_000_000_000;
const TS = String(Math.floor(AHORA / 1000));

const cabeceras = (extra: Partial<Record<"id" | "timestamp" | "firma", string | null>> = {}) => ({
  id: ID,
  timestamp: TS,
  firma: firmaSvix(ID, TS, CUERPO, SECRETO),
  ...extra,
});

describe("verificaSvix", () => {
  it("acepta una firma legítima", () => {
    expect(verificaSvix(cabeceras(), CUERPO, SECRETO, AHORA)).toBe(true);
  });

  it("acepta si una de varias firmas vale, que es lo que pasa al rotar la clave", () => {
    const otra = firmaSvix(ID, TS, CUERPO, "whsec_" + Buffer.from("otra clave distinta 32 bytes...").toString("base64"));
    const buena = firmaSvix(ID, TS, CUERPO, SECRETO);
    expect(verificaSvix(cabeceras({ firma: `${otra} ${buena}` }), CUERPO, SECRETO, AHORA)).toBe(true);
  });

  it("rechaza un cuerpo alterado", () => {
    const manipulado = CUERPO.replace("VTX-2026-001", "VTX-2026-999");
    expect(verificaSvix(cabeceras(), manipulado, SECRETO, AHORA)).toBe(false);
  });

  it("rechaza otra clave", () => {
    const ajena = "whsec_" + Buffer.from("clave de alguien mas de 32 bytes").toString("base64");
    expect(verificaSvix(cabeceras(), CUERPO, ajena, AHORA)).toBe(false);
  });

  // Sin ventana, una petición capturada de la bandeja de salida sirve para
  // siempre: se reenvía y vuelve a escribir en la bitácora.
  it("rechaza una petición vieja", () => {
    const viejo = String(Math.floor(AHORA / 1000) - VENTANA_SEGUNDOS - 1);
    const firma = firmaSvix(ID, viejo, CUERPO, SECRETO);
    expect(verificaSvix({ id: ID, timestamp: viejo, firma }, CUERPO, SECRETO, AHORA)).toBe(false);
  });

  it("rechaza una petición con fecha futura", () => {
    const futuro = String(Math.floor(AHORA / 1000) + VENTANA_SEGUNDOS + 1);
    const firma = firmaSvix(ID, futuro, CUERPO, SECRETO);
    expect(verificaSvix({ id: ID, timestamp: futuro, firma }, CUERPO, SECRETO, AHORA)).toBe(false);
  });

  it("rechaza cuando falta cualquier cabecera", () => {
    expect(verificaSvix(cabeceras({ id: null }), CUERPO, SECRETO, AHORA)).toBe(false);
    expect(verificaSvix(cabeceras({ timestamp: null }), CUERPO, SECRETO, AHORA)).toBe(false);
    expect(verificaSvix(cabeceras({ firma: null }), CUERPO, SECRETO, AHORA)).toBe(false);
  });

  it("rechaza sin secreto configurado, en vez de aceptar", () => {
    expect(verificaSvix(cabeceras(), CUERPO, "", AHORA)).toBe(false);
    expect(verificaSvix(cabeceras(), CUERPO, "whsec_", AHORA)).toBe(false);
  });

  it("no revienta con firmas mal formadas", () => {
    for (const firma of ["", "v1", "v1,", "basura", "v2,abc", "v1,!!!no-es-base64!!!", "v1,c2hvcnQ="]) {
      expect(() => verificaSvix(cabeceras({ firma }), CUERPO, SECRETO, AHORA)).not.toThrow();
      expect(verificaSvix(cabeceras({ firma }), CUERPO, SECRETO, AHORA)).toBe(false);
    }
  });

  it("rechaza un timestamp que no es un número", () => {
    expect(verificaSvix(cabeceras({ timestamp: "ayer" }), CUERPO, SECRETO, AHORA)).toBe(false);
  });
});

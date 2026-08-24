import { describe, expect, it } from "vitest";
import { estadoDeEvento, estadoDePersona, type FilaEstado } from "@/lib/invitaciones";

/**
 * El defecto que motivó estas dos funciones: la pantalla del comité enseñaba
 * `activo` como si fuera el estado de la cuenta. Una persona invitada cuyo
 * enlace caducó se veía exactamente igual que una que lleva meses dictaminando,
 * y una invitación que rebotó no se veía en ninguna parte.
 *
 * Ambas son puras a propósito: el orden de precedencia es lo único que puede
 * volver a mentir, y aquí se fija sin base de datos de por medio.
 */

const base: FilaEstado = {
  activo: true,
  invitada_en: null,
  clave_fijada_en: null,
  invitacion_estado: null,
};

const AHORA = new Date("2026-08-24T12:00:00Z");
const hace = (dias: number) =>
  new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();

describe("estadoDeEvento", () => {
  it("traduce los cuatro eventos de Resend que importan", () => {
    expect(estadoDeEvento("email.delivered")).toBe("entregado");
    expect(estadoDeEvento("email.bounced")).toBe("rebotado");
    expect(estadoDeEvento("email.complained")).toBe("quejado");
    expect(estadoDeEvento("email.delivery_delayed")).toBe("retrasado");
  });

  it("devuelve null para lo que no interesa, en vez de inventarse un estado", () => {
    expect(estadoDeEvento("email.sent")).toBeNull();
    expect(estadoDeEvento("email.opened")).toBeNull();
    expect(estadoDeEvento("")).toBeNull();
  });
});

describe("estadoDePersona", () => {
  it("dar de baja gana sobre todo lo demás", () => {
    const baja = { ...base, activo: false, clave_fijada_en: hace(30) };
    expect(estadoDePersona(baja, AHORA).etiqueta).toBe("De baja");
  });

  it("haber fijado la contraseña gana sobre un correo que rebotó", () => {
    // El rebote puede ser de un reenvío posterior; si la clave está fijada, la
    // cuenta funciona y decir «Correo rebotado» sería una falsa alarma.
    const fila = { ...base, clave_fijada_en: hace(2), invitacion_estado: "rebotado" };
    expect(estadoDePersona(fila, AHORA).etiqueta).toBe("Activa");
  });

  it("un rebote sin contraseña fijada es lo que hay que ver", () => {
    const fila = { ...base, invitada_en: hace(1), invitacion_estado: "rebotado" };
    expect(estadoDePersona(fila, AHORA).etiqueta).toBe("Correo rebotado");
  });

  it("invitada y pendiente lleva la antigüedad del enlace", () => {
    const fila = { ...base, invitada_en: hace(3), invitacion_estado: "entregado" };
    expect(estadoDePersona(fila, AHORA).etiqueta).toBe("Invitada · pendiente (hace 3 d)");
  });

  it("una invitación de hoy no dice «hace 0 d»", () => {
    const fila = { ...base, invitada_en: hace(0) };
    expect(estadoDePersona(fila, AHORA).etiqueta).toBe("Invitada · pendiente (hoy)");
  });

  it("sin invitación y sin clave es un estado propio, no «Activa»", () => {
    expect(estadoDePersona(base, AHORA).etiqueta).toBe("Sin invitación");
  });

  it("sólo quien ya fijó contraseña sale en verde", () => {
    expect(estadoDePersona({ ...base, clave_fijada_en: hace(1) }, AHORA).clase).toBe(
      "etiqueta--lista",
    );
    expect(estadoDePersona({ ...base, invitada_en: hace(1) }, AHORA).clase).toBe(
      "etiqueta--alerta",
    );
  });
});

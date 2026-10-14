import { describe, expect, it } from "vitest";
import { fechaEvento, horaEvento } from "@/lib/evento";

describe("datos del evento", () => {
  it("escribe la hora en formato de 12 horas", () => {
    expect(horaEvento("15:00:00")).toBe("3:00 pm");
    expect(horaEvento("12:00:00")).toBe("12:00 pm");
    expect(horaEvento("00:30:00")).toBe("12:30 am");
    expect(horaEvento("09:15")).toBe("9:15 am");
    expect(horaEvento(null)).toBeNull();
  });

  it("escribe la fecha en palabras", () => {
    expect(fechaEvento("2026-11-23")).toBe("23 de noviembre de 2026");
    expect(fechaEvento(null)).toBe("fecha por definir");
  });
});

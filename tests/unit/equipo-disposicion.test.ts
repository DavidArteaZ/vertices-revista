import { describe, it, expect } from "vitest";
import { disponer, ESCRITORIO, MOVIL, R_ASESOR, R_CENTRO, radioArea } from "@/lib/equipo-disposicion";
import { INTEGRANTES } from "@/lib/datos/equipo";

for (const [nombre, lienzo] of [["escritorio", ESCRITORIO], ["móvil", MOVIL]] as const) {
  describe(`disponer (${nombre})`, () => {
    const burbujas = disponer(lienzo, INTEGRANTES);

    it("coloca a cada integrante una sola vez", () => {
      expect(burbujas.map((b) => b.persona.nombre)).toEqual(INTEGRANTES.map((p) => p.nombre));
    });

    // El servidor y el navegador tienen que llegar a las mismas coordenadas,
    // o React se queja al hidratar.
    it("da siempre el mismo resultado", () => {
      expect(disponer(lienzo, INTEGRANTES)).toEqual(burbujas);
    });

    it("no encima burbujas entre sí ni sobre los nodos fijos", () => {
      const fijos = [
        { ...lienzo.centro, r: R_CENTRO },
        ...Object.entries(lienzo.areas).map(([id, a]) => ({ ...a, r: radioArea(id as keyof typeof lienzo.areas) })),
        { ...lienzo.asesor, r: R_ASESOR },
      ];
      const todos = [...fijos, ...burbujas];
      for (let i = 0; i < todos.length; i++) {
        for (let j = Math.max(i + 1, fijos.length); j < todos.length; j++) {
          const a = todos[i], b = todos[j];
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
        }
      }
    });

    it("deja a todos dentro del campo, lejos del asesor", () => {
      for (const b of burbujas) {
        expect(b.x - b.r).toBeGreaterThanOrEqual(0);
        expect(b.x + b.r).toBeLessThanOrEqual(lienzo.campo);
        expect(b.y - b.r).toBeGreaterThanOrEqual(0);
        expect(b.y + b.r).toBeLessThanOrEqual(lienzo.alto);
      }
    });
  });
}

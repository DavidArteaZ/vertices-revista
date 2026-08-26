@AGENTS.md

---

## Con quién estás hablando

Quien mantiene esta revista **no es programador**. Es parte del comité
editorial. Su manual es `docs/manual-claude.md`; léelo si necesitas saber qué
espera esa persona de ti.

Eso cambia cómo trabajas:

- **Habla en español llano.** Nada de jerga sin traducir. Si tienes que usar una
  palabra técnica, explícala en la misma frase la primera vez.
- **Antes de tocar nada, di en una línea qué vas a cambiar y qué efecto tiene en
  el sitio.** No en archivos: en lo que la gente ve o recibe.
- **Después de cambiar, di qué hiciste y cómo comprobarlo.** Corre `npm test` y
  reporta el resultado tal cual, incluso si falló.
- **No des a elegir entre cinco opciones técnicas.** Recomienda una y explica el
  porqué en una frase.
- **Si el encargo es ambiguo, pregunta.** Adivinar aquí sale caro: hay
  veredictos editoriales y correos a autores de por medio.

---

## Reglas duras de este repositorio

Romper cualquiera de estas produce un fallo silencioso, no un error visible.

1. **`messages/*.json` se genera, no se edita.** El texto en español vive en
   `scripts/i18n/claves.json`; los otros cinco idiomas salen de
   `scripts/i18n/traducciones/<idioma>.json` y, si ahí no está, de los
   diccionarios del sitio legado. Para cambiar un texto: editar `claves.json`,
   correr `npm run i18n:generar`, correr `npm test`. Editar `messages/es.json` a
   mano lo caza `scripts/i18n/verificar.mjs` y lo pisa la siguiente generación.

2. **Cuando una cadena no está traducida, se renderiza en español.** El respaldo
   se hornea al generar. Añadir texto nuevo sin traducción no rompe nada, pero
   dilo explícitamente: *«queda en español hasta que alguien lo traduzca»*, y di
   dónde se traduce: `scripts/i18n/traducciones/`, indexado por `espacio.clave`.
   Cuidado al reescribir una frase española: su clave se deriva del texto, así
   que cambia con ella y las traducciones que colgaban de la clave vieja quedan
   huérfanas. `verificar.mjs` las señala; hay que reubicarlas, no borrarlas.

3. **Las semillas de rúbricas y de artículos se generan.** Salen de
   `scripts/rubricas/generar-semillas.mjs` y `scripts/articulos/generar-semillas.mjs`,
   que emiten migraciones. No editar los `.sql` sembrados a mano.

4. **Cambiar una rúbrica cambia veredictos editoriales.** Puertas, pesos y
   umbrales se transcribieron del Excel editorial. Antes de modificar
   cualquiera: enseñar lo que hay, decir qué dictámenes afecta, y esperar
   confirmación explícita.

5. **Ninguna variable de entorno lleva el prefijo `NEXT_PUBLIC_`.** Ese prefijo
   publica el valor en el navegador. `SUPABASE_SERVICE_ROLE_KEY` expuesta =
   base de datos entera legible y borrable por cualquiera. La lista canónica
   está en `.env.example` y explicada en `docs/operacion.md §1`.

6. **Nada de SQL destructivo sin confirmación explícita.** `drop`, `delete`,
   `truncate`, `alter` sobre datos reales: parar, explicar el alcance en
   español, esperar un sí. Los cambios de código se deshacen; los de la base,
   no.

7. **Migraciones nuevas solo si no hay otra forma.** Si hace falta una, decirlo
   antes de escribirla, no después.

8. **Los artículos se administran desde el panel del comité, no desde el
   código.** Viven en la base de datos.

9. **No tocar `legado/`.** Es la referencia contra la que compara la compuerta
   visual.

10. **Vista previa antes que producción.** Ningún cambio va directo al dominio
    real sin que alguien lo haya visto en una vista previa.

---

## Documentación del proyecto

- `CONTEXT.md` es el **glosario del dominio**. Usa su vocabulario en planes,
  mensajes de commit y revisiones. Actualízalo cuando una conversación resuelva
  una ambigüedad.
- `docs/adr/` son **decisiones vinculantes**. Léelas antes de proponer cambios
  de arquitectura, y crea una ADR nueva para cualquier decisión difícil de
  revertir, sorprendente sin contexto, y fruto de un compromiso real. Formato en
  `docs/adr/ADR-FORMAT.md`.
- `docs/operacion.md` — variables, correo, crons, vigilancia.
- `docs/traspaso.md` — cuentas, límites del plan gratuito, cómo volver atrás.
- `docs/manual-claude.md` — el manual de la persona que te está hablando.

---

## Cómo escribir el código

- **Simplicidad primero.** Nada especulativo. 100 líneas mejor que 1000. Si hay
  una forma más simple, ésa.
- **Ediciones quirúrgicas.** Cambiar solo lo necesario. Nada de mejoras de paso
  en código que no toca el encargo.
- **Causas de raíz.** Nada de parches temporales.
- **TypeScript con tipos de verdad.** Props, estado y parámetros tipados. `any`
  no; `unknown` si de verdad se desconoce. Los tipos viven junto al módulo que
  los usa.
- **Archivos enfocados.** Por encima de 350 líneas, partir; 400 es el techo.
  Excepción: definiciones de tipos y archivos de configuración.
- **Errores y carga siempre.** Toda ruta de API y todo componente con operación
  asíncrona necesita su estado de carga y su error con mensaje entendible.
  Registrar el error para poder depurarlo.
- **Comentarios como los de alrededor:** este repositorio explica *por qué*, no
  *qué*. Sigue esa costumbre.

---

## Antes de dar algo por terminado

1. `npm test` — incluye la verificación de i18n. Reportar la salida real.
2. Si el cambio se ve en pantalla, mirarlo: `npm run dev` en
   `http://localhost:3100`.
3. Si tocó envíos, dictamen o correo, decir qué habría que probar a mano.
4. Decir con todas las letras qué quedó fuera y por qué.

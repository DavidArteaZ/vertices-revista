# Vértices — Next.js + Supabase rebuild

**Date:** 2026-08-20
**Status:** Approved design, pending implementation plan
**Supersedes:** static site + Cloudflare Worker + Web3Forms + Power Automate + Excel

---

## 1. Context

Vértices is the academic economics journal of the Licenciatura en Economía at
Tecnológico de Monterrey, Campus Ciudad de México. The current site is a
zero-build static bundle (`index.html` 2404 lines, four satellite pages, six
languages, a canvas particle engine) deployed on Netlify, with submissions
routed to a Cloudflare Worker that writes rows into
`Vertices_BaseDatos_Editorial.xlsx` on SharePoint via Power Automate.

The workbook is the real editorial system: a `Registro` master sheet, eight
per-section dictamen instruments with gates and rubrics, a `Tablero` of counts,
and a `Catálogos` lookup. It is in production use — it holds genuine
submissions.

### Defects in the current system that this rebuild fixes

1. **Folio format mismatch.** Excel generates `VTX-001`
   (`="VTX-"&TEXT(ROW()-3,"000")`). The site validates `/^VTX-\d{4}-\d{1,4}$/`
   and instructs authors to type `VTX-2026-001`. The public status lookup can
   never match a real folio.
2. **Folio derives from row position.** Deleting a row renumbers every folio
   below it. Folios already emailed to authors then point at a different
   manuscript.
3. **Silent submission loss.** When the Worker fails and no Web3Forms key is
   configured, the browser fabricates `VTX-2026-<random>` and shows the author
   a success screen. The submission is gone and nobody is notified.
4. **Hard 50-row cap.** `Registro` rows 4–53; each section sheet rows 8–57.
   Piece 51 requires copying formulas down in nine sheets by hand.
5. **Orphan records.** A row with no `Sección` gets a blank `Nivel` and blank
   `Hoja de dictamen`, so it is never routed to any instrument and is invisible
   to review. One such row exists today.
6. **Structured fields collapsed to free text.** Column `T` concatenates
   `Perfil · Tema · Palabras clave · Resumen` into one string. The form collects
   these separately; they arrive unqueryable.
7. **Attachment inflation.** Files are base64-encoded into the JSON request
   body, inflating 33% — a 20 MB manuscript becomes a ~27 MB request.
8. **CORS lock.** The Worker only accepts
   `https://vertices-revista.netlify.app`, so nothing can be developed or tested
   against it locally.

## 2. Goals

- Preserve the visual design **exactly**: same fonts, colors, canvas animation,
  scroll choreography, copy, and all six languages.
- Replace Excel with Postgres as the source of truth; keep an `.xlsx` export.
- Give the editorial committee an admin panel with the full dictamen workflow,
  per-reviewer scorecards, and enforced double-blind review.
- Make accepted articles publishable to the site, grouped into ediciones.
- Notify authors by email whenever their submission's decision changes.

## 3. Non-goals

- No article body CMS. A published article **is** its PDF plus metadata.
- No author accounts. Authors track submissions by folio + email, as today.
- No live sync back to Excel or Power Automate. Export only.
- No redesign. Any visual change is a defect in this work.
- No per-section editor scoping or multi-tier permissions. One staff role.

## 4. Architecture

Single Next.js App Router application deployed on Vercel.

```
app/
  (public)/
    page.tsx                    landing: canvas engine + portal + form
    lineamientos/page.tsx
    quienes-somos/page.tsx
    equipo/page.tsx
    articulos/[slug]/page.tsx
  (admin)/panel/
    page.tsx                    queue + counts (replaces Tablero)
    envios/[folio]/page.tsx     full record, assignments, side-by-side dictámenes
    dictamen/[id]/page.tsx      one reviewer's scorecard (blinded)
    ediciones/page.tsx
    usuarios/page.tsx           invites
  api/
    envios/route.ts             POST — create submission
    estado/route.ts             GET  — public status lookup
```

The status lookup stays where it is today: the `#estado` block inside the
landing page's portal section, not a separate route. Moving it would be a
visual change.

The panel index replaces the `Tablero` sheet and reproduces its three counts:
pieces per sección, pieces per decisión vigente, and the equidad-de-género
tally of authorship — the last is a stated value in `lineamientos.html`, not
incidental.

Supabase provides Postgres, Auth, and Storage. Resend sends transactional
email. next-intl handles localization. No other third-party services.

### 4.1 Canvas engine port

The ~800-line particle engine is ported **verbatim** into a single
`"use client"` component that owns a `<canvas>` ref and drives its own
`requestAnimationFrame` loop outside React's render cycle. The four scroll
layers (`.capa`) remain plain positioned DOM that the engine mutates through
refs, exactly as today.

Rewriting it in React idioms is explicitly rejected: it would be slower to
build, would risk changing the motion, and React's reconciliation offers
nothing to a 60fps imperative canvas loop. The same applies to `fondo-flujo.js`
and `revelar.js` on the satellite pages.

The `window.__qa.runTo(u, seconds)` hook is preserved for deterministic visual
QA without real scrolling.

## 5. Data model

### 5.1 Reference tables (seeded)

```sql
secciones      id, numero, nombre_canonico, nombre_display, slug, nivel,
               descripcion, orden
temas          id, nombre, slug                       -- 27 rows
tipos_pieza    id, nombre                             -- 9 rows, from Catálogos
usuarios       id → auth.users, nombre, email, activo -- single role: staff
```

`nombre_canonico` is the Excel form (`"2 · Datanomics"`); `nombre_display` is
what the UI renders (`"Datanomics"`). The DB stores canonical.

### 5.2 The rubric is data, not code

The workbook defines eight distinct instruments. Hardcoding them would mean a
deploy every time the committee adjusts a criterion.

```sql
rubrica_puertas      id, seccion_id, orden, etiqueta, es_eliminatoria
rubrica_dimensiones  id, seccion_id, orden, etiqueta, es_critica,
                     peso DEFAULT 1, permite_na DEFAULT false
bandas_decision      id, seccion_id, min_puntaje, etiqueta, variante
```

`variante` distinguishes Datanomics' two band sets (`/15` and `/12`).

Non-`★` gates are recorded but do **not** affect the outcome — they are
checklist items. Only `es_eliminatoria` gates can fail a piece. This mirrors the
workbook, where e.g. Apertura has four gates but `Puertas ★ OK` tests only `F`.

### 5.3 Submissions

```sql
envios
  id            uuid pk
  folio         text unique      -- VTX-2026-001, immutable, yearly sequence
  -- autoría
  nombre, correo, afiliacion, coautores, perfil, genero
  -- manuscrito
  titulo, tipo_pieza_id, seccion_id, tema_id, resumen,
  palabras_clave text[], extension, es_investigacion bool, uso_ia
  -- staff-entered
  antiplagio    text            -- Sí | No | N/A
  notas_internas text
  -- derived at insert
  nivel                char(1)
  seccion_dictamen_id  → secciones
  -- workflow
  estado         text           -- recibido | asignado | en_dictamen | decidido
  decision_final text
  created_at, updated_at

envio_archivos
  id, envio_id, storage_path, nombre, mime, bytes, es_principal
```

**Folio** comes from a per-year Postgres sequence, is assigned once, and is
never recomputed. Deleting a submission does not renumber anything.

**Nivel routing** replicates the workbook: look up `nivel` from `secciones`,
then apply the override — `Horizonte Global` with `es_investigacion = true`
becomes Nivel A and routes to the Miradas Económicas instrument.

### 5.4 Review

```sql
asignaciones        id, envio_id, revisor_id, asignado_at
                    UNIQUE(envio_id, revisor_id)

dictamenes          id, envio_id, revisor_id,
                    estado text,          -- borrador | enviado
                    comentarios text, enviado_at
                    UNIQUE(envio_id, revisor_id)

dictamen_puertas    dictamen_id, puerta_id, valor bool
dictamen_puntajes   dictamen_id, dimension_id, valor int NULL  -- NULL = N/A
```

One scorecard per reviewer per submission. Nivel A pieces get two assignments;
Niveles B and C typically one.

### 5.5 Publishing

```sql
ediciones     id, numero int unique, titulo,
              estado text,          -- borrador | publicada
              publicada_at

articulos     id, envio_id NULL, edicion_id, titulo, autor, seccion_id,
              minutos_lectura, destacado bool, slug unique,
              pdf_publico_path, es_placeholder bool
articulo_temas  articulo_id, tema_id
```

`envio_id` is nullable and `es_placeholder` is true for the 26 existing
demonstration articles, which ship visible so topic and section discovery works
before the first edición launches. Staff delete them from the panel once real
content exists.

`articulo_temas` is many-to-many because the current corpus assigns up to three
topics per piece and the discovery panel filters by topic.

## 6. Decision engine

One TypeScript module, unit-tested, reproducing the workbook cascade exactly:

```
1. no dimension scored          → "Pendiente de dictamen"
2. any ★ gate = No              → "No publicable (falla puerta ★)"
3. any ★ critical dimension < 2 → "Requiere reelaboración (crítico < 2)"
4. otherwise                    → band lookup by puntaje
```

`puntaje = Σ (valor × peso)` over scored dimensions.
`máximo = Σ (3 × peso)`, excluding any dimension scored `N/A`.

### 6.1 Instruments as seeded

| # | Sección | Nivel | Máx | ★ Gates | ★ Críticos | Bands |
|---|---------|-------|-----|---------|-----------|-------|
| 1 | Apertura editorial | C | 15 | Menciona las secciones del número | Claridad de propósito (peso 2) | ≥12 · 9–11 · 6–8 · ≤5 |
| 2 | Datanomics | B | 15 / 12 | Fuente del dato citada; Fecha del dato indicada; Hallazgo legible en el gráfico | Trazabilidad del dato; Legibilidad del gráfico | ≥12 · 9–11 · 6–8 · ≤5 — or ≥10 · 7–9 · 5–6 · ≤4 |
| 3 | La Voz de la Experiencia | C | 15 | Consentimiento del entrevistado; Derechos de imagen | Valor práctico; Anclaje en evidencia | ≥12 · 9–11 · 6–8 · ≤5 |
| 4 | Miradas Económicas | A | 21 | Antiplagio (Turnitin); Manuscrito anonimizado; Sin problemas críticos | Claridad de idea/pregunta; Rigor conceptual; Evidencia/fuentes/datos | ≥17 · 14–16 · 9–13 · ≤8 |
| 5 | Horizonte Global | B | 18 | Suceso internacional vinculado a México; Conexión global→local explícita | Suceso y lente económico; Aplicación conceptual; Conexión global→local | ≥14 · 11–13 · 7–10 · ≤6 |
| 6 | ¿Sabías que…? | C | 12 | Fuente verificable del dato | Veracidad / verificabilidad | ≥10 · 7–9 · 5–6 · ≤4 |
| 7 | Capital Social | C | 12 | Fotos revisadas por Fotografía y Archivo; Consentimiento de fotografiados; Sin críticas destructivas | Precisión factual | ≥10 · 7–9 · 5–6 · ≤4 |
| 8 | Excelencia en Acción | C | 12 | Evidencia del logro; Fotografía con consentimiento | Verificabilidad del logro | ≥10 · 7–9 · 5–6 · ≤4 |

Two decision vocabularies. Miradas Económicas (Nivel A):
`Aceptado / Aceptado con revisiones menores / Revisiones mayores / Rechazado`.
All other sections:
`Publicable / Publicable con ajustes menores / Requiere reelaboración /
No publicable en este número`.

Only Datanomics has a dimension with `permite_na` (`Utilidad del how-to`);
scoring it `N/A` drops the maximum to 12 and selects the `/12` band variante.

### 6.2 Test matrix

Per section: pending state, each `★` gate failing individually, each `★`
critical at 1 and at 2, and both boundaries of every band. Plus Apertura's
`peso = 2` arithmetic and Datanomics' N/A max-shift with its band switch.

These tests are written before the engine.

### 6.3 Consensus

Each submitted scorecard yields its own suggested decision. The envío view
renders them side by side and flags disagreement between reviewers. A staff
member records `decision_final` on the envío; that value — not any individual
suggestion — is what the author sees and what gates publication.

## 7. Double-blind enforcement

Enforced in the API and RLS layer, never only in the UI.

Because there is a single staff role, blindness cannot be a permission tier. It
is a function of `(viewer, submission)` state, and it applies to **everyone**:

> No staff member can see a submission's author fields anywhere in the
> application until **they personally** have submitted a dictamen for that
> submission — or until the submission has a `decision_final`.

Being unassigned is not a reason to see the author. Anyone can open the panel
by accident or curiosity; the default must be blind.

- Blinded fields: `nombre`, `correo`, `afiliacion`, `coautores`. They are absent
  from the response payload, not merely hidden by CSS. This includes the queue,
  the envío detail page, the dictamen screen, and the `.xlsx` export.
- Visible while blinded: folio, título, tipo de pieza, sección, fecha de
  recepción, extensión, resumen, palabras clave, and the manuscript file.

Three unblind triggers, in order of precedence:

1. **Per-viewer.** A staff member sets their own scorecard to `enviado` → that
   submission unblinds for that member alone. Other reviewers stay blind until
   each submits their own.
2. **Decision recorded.** `decision_final` is set → the submission unblinds for
   all staff. The review is finished; blinding past this point protects nothing
   and would make publishing impossible, since attaching an article to an
   edición requires the author's name.
3. **Published.** The edición goes live → the author is public and the rule
   retires entirely.

Two consequences, stated plainly:

- Filing a dictamen blinds nobody retroactively. The rule governs what the
  system will show going forward, not what someone already remembers.
- Between submission and decision, no human can look up an author's email
  through the panel. Author correspondence in that window is automated:
  the folio receipt and the decision-change notice are sent by Resend, which
  reads the address server-side without exposing it to any user.

**There is no reveal action.** A logged "mostrar autor" escape hatch was
considered and rejected: the blind is absolute until one of the three triggers
fires. A staff member who needs an author's identity files their dictamen
first. The accepted cost is that answering an author's mid-review email
requires either completing a dictamen or replying on the folio alone.

Residual risk, accepted: both unblind triggers are actions a staff member can
take deliberately — filing a dictamen, or recording a `decision_final`. The
blind is therefore accountable rather than absolute. Both actions are attributed
and timestamped, so defeating the blind leaves a record with a name on it.

The conflict-of-interest check — a staff member may not be assigned to a
submission whose `correo` matches their account — runs server-side and never
reveals the address to anyone.

**Conflict of interest:** a staff member cannot be assigned to a submission
whose `correo` matches their account. Vértices is student-run and staff also
submit work.

## 8. Submission flow

The form UI is unchanged — same four steps, same validation thresholds, same
wording, same drag-and-drop. What changes is underneath:

1. Files upload **directly from browser to Supabase Storage** via a signed
   upload URL. The base64-in-JSON path is deleted.
2. `POST /api/envios` writes the row, derives `nivel` and
   `seccion_dictamen_id`, and assigns a folio from the yearly sequence.
3. Resend emails the author their folio and a link to the status page.
4. **No silent-failure path.** If the write fails, the user sees an error and
   the form retains their input. The fabricated-folio fallback is removed
   entirely.

Preserved validation: resumen 100–300 words with live counter; 3–5 comma-separated
keywords; `.pdf`/`.doc`/`.docx` only, 20 MB per file; all four declarations
required; email regex.

The form's `formato` select is replaced by the nine canonical `tipos_pieza` from
`Catálogos`, resolving the current 5-vs-9 mismatch.

## 9. Publishing flow

1. Staff create an edición: `número` + `título`, `estado = borrador`.
2. Submissions whose `decision_final` is an accepting value are attached as
   `articulos`; staff set read time, topics, and featured flag.
3. Publishing the edición copies each PDF from the private bucket to the public
   bucket and flips all its articles live in one transaction.

The private bucket is never publicly readable, so an unpublished manuscript
cannot be reached by guessing a URL. Published PDFs live in a separate public
bucket and are cacheable and shareable.

## 10. Author-facing

- Public status lookup by folio + correo, unchanged in appearance. The folio now
  matches what the site tells authors to type.
- Resend email on every `decision_final` change.
- No author accounts, no revision upload loop.

What the author sees is `decision_final` once one exists, and `"En revisión"`
before that — matching the current workbook behavior, where `Estado` is
`"En revisión"` until a decision lands and mirrors the decision afterwards. The
internal `estado` column (`recibido`/`asignado`/`en_dictamen`/`decidido`) drives
the staff queue and is never shown publicly.

## 11. Internationalization

A one-off script converts the five existing dictionaries (~500 keys each,
~330 KB total, fully translated) into next-intl message files. No retranslation;
nothing is discarded.

Locale routes: Spanish at root, `/en`, `/fr`, `/it`, `/pt`, `/ru`. The language
pill in the nav keeps its current appearance and behavior. Server-rendered, so
the current flash of Spanish before the runtime swap disappears.

`<option value>` attributes remain Spanish, so the database continues receiving
Spanish regardless of the visitor's locale — the deliberate behavior of the
current system.

## 12. Excel export

A panel button generates an `.xlsx` mirroring the current `Registro` column
layout, for anyone who prefers the spreadsheet view. Read-only export; no sync
back, no Power Automate dependency.

The export obeys §7: author columns are blank for any submission the exporting
user is still blind to. An export is not a way around the blind.

## 13. Security

- Invite-only accounts, email + password. No public signup.
- RLS on every table. Anonymous role may read only published `articulos`,
  published `ediciones`, and the reference tables; it may insert into `envios`
  through the API route only.
- Private storage bucket readable only by authenticated staff.
- Public status lookup requires folio **and** matching email, limiting
  enumeration.
- Rate limiting on `POST /api/envios`.

## 14. Migration

The database starts empty. Existing workbook rows are not imported: the real
entries are few, several are test rows, and one was never routed to a dictamen.

The 26 placeholder articles are seeded with `es_placeholder = true`.

The Netlify site and Cloudflare Worker stay running untouched until cutover.

## 15. Delivery order

The work is large but sequential. Each stage is independently verifiable and
leaves the system in a working state.

1. **Scaffold + visual parity.** Next.js app, fonts, canvas engine port,
   satellite pages, all static content. Verified by side-by-side comparison
   against the current site. No database yet.
2. **i18n migration.** Dictionary converter, next-intl wiring, locale routes.
   Verified by switching all six languages on every page.
3. **Schema + decision engine.** Migrations, reference and rubric seed data,
   the scoring module and its test matrix. Tests written first.
4. **Submission pipeline.** Storage uploads, `POST /api/envios`, folio
   sequence, Resend receipt, status lookup against real data.
5. **Admin panel.** Auth and invites, queue and counts, envío detail,
   assignments, per-reviewer scorecards, blindness rules, final decisions,
   status-change emails.
6. **Publishing.** Ediciones, articulos, bucket copy on publish, article pages,
   discovery panel and carousel reading from the database.
7. **Export + cutover.** `.xlsx` export, domain switch, retire Netlify and the
   Worker.

Stages 1 and 2 change no behavior an editor depends on and can ship before the
backend exists.

## 16. Open questions for review

- **Author-facing decision wording.** Internal decisions include jargon such as
  `"No publicable (falla puerta ★)"`. Recommendation: map internal values to
  author-appropriate text in emails and the status page, keeping the raw value
  in the panel. Needs confirmation.
- **Dictamen comments to authors.** Whether the status email includes reviewer
  `comentarios` or only the decision. Recommendation: staff opt in per
  submission when recording the final decision.
- **Domain and cutover.** Which domain the Vercel deployment serves and when
  Netlify is retired.

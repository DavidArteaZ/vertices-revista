# Vértices — Next.js + Supabase rebuild

**Date:** 2026-08-20 (v2, revised 2026-08-21 after architecture audit)
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
a `Guía`, and a `Catálogos` lookup. It is in production use.

### 1.1 Defects in the current system that this rebuild fixes

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
4. **Capacity is 48, not 50, and the last two slots are a trap.** Section
   sheets map `Registro` row *r* to sheet row *r+6*
   (`'1. Apertura editorial'!A57` reads `Registro!$G51`) but run only to row 57,
   while `Registro` runs to row 53. Rows 52–53 accept data, generate a folio,
   and appear in `Tablero` counts while reaching no dictamen sheet at all.
5. **Orphan records.** A row with no `Sección` gets a blank `Nivel` and blank
   `Hoja de dictamen`, so it is never routed to any instrument. One exists
   today: `Registro!B11` ("Banamex"), invisible to review since submission.
6. **Structured fields collapsed to free text.** Column `T` concatenates
   `Perfil · Tema · Palabras clave · Resumen` into one string.
7. **Attachment inflation.** Files are base64-encoded into the JSON request
   body, inflating 33% — a 20 MB manuscript becomes a ~27 MB request.
8. **CORS lock.** The Worker only accepts
   `https://vertices-revista.netlify.app`, so nothing can be developed or
   tested against it locally.
9. **Persistent API-base hijack.** `index.html:2284-2298` accepts
   `?api=https://…`, validates it only against `/^https:\/\/[\w.-]+/`, and
   **persists it to `localStorage`**, overriding `config.js` on every future
   visit. One crafted link permanently redirects that browser's manuscripts and
   status lookups to a third party. Removed by going same-origin.
10. **`Tablero` undercounts.** Its `COUNTIF`s match only the eight clean
    decision labels, so pieces resolving to `"No publicable (falla puerta ★)"`,
    `"Requiere reelaboración (crítico < 2)"`, `"No aceptable (…)"`, or
    `"Pendiente de dictamen"` appear in no bucket at all.

## 2. Goals

- Preserve the visual design **exactly**: same fonts, colors, canvas animation,
  scroll choreography, copy, and all six languages.
- Replace Excel with Postgres as the source of truth; keep an `.xlsx` export.
- Give the editorial committee an admin panel with the full dictamen workflow,
  per-reviewer scorecards, and enforced blinding of the submission record.
- Make accepted articles publishable to the site, grouped into ediciones.
- Notify authors by email whenever their submission's decision changes.

## 3. Non-goals

- No article body CMS. A published article **is** its PDF plus metadata.
- No author accounts. Authors track submissions by folio + email.
- No live sync back to Excel or Power Automate. Export only.
- No redesign. Any visual change is a defect in this work.
- No multi-tier permissions. One staff role.

**Stated risk of the single role:** `equipo-ds.html` names seven teams, and
`'7. Capital Social'!F7` gates on review by Fotografía y Archivo specifically.
With one role, a member of any team can record a `decision_final` and thereby
unblind a submission for everyone. Accepted for v1; revisit if the committee
grows.

## 4. Architecture

Single Next.js App Router application deployed on Vercel. Supabase provides
Postgres, Auth, and Storage. Resend sends transactional email. next-intl
handles localization.

```
app/
  (public)/
    page.tsx                    landing: canvas engine + portal + form + #estado
    lineamientos/page.tsx
    quienes-somos/page.tsx
    equipo/page.tsx
    articulos/[slug]/page.tsx
  (admin)/panel/
    page.tsx                    queue + counts (replaces Tablero)
    envios/[folio]/page.tsx
    dictamen/[id]/page.tsx
    ediciones/page.tsx
    usuarios/page.tsx
  api/
    envios/route.ts             POST — create submission
    estado/route.ts             GET  — public status lookup
    uploads/route.ts            POST — mint signed upload URL
```

The status lookup stays where it is today: the `#estado` block inside the
landing page's portal section, not a separate route. Moving it would be a
visual change.

The panel index replaces the `Tablero` sheet and reproduces its three counts —
pieces per sección, pieces per decisión vigente, and the equidad-de-género
tally — **and fixes the undercount** in defect 10 by bucketing on the decision
lookup rather than on matching strings.

### 4.1 Canvas engine port

The ~800-line particle engine is ported **verbatim** into a single
`"use client"` component that owns a `<canvas>` ref and drives its own
`requestAnimationFrame` loop outside React's render cycle. The four scroll
layers (`.capa`) remain plain positioned DOM that the engine mutates through
refs.

Rewriting it in React idioms is explicitly rejected: it would be slower to
build, would risk changing the motion, and React's reconciliation offers
nothing to a 60fps imperative canvas loop. This component is a deliberate,
documented exemption from the project's 400-line file limit.

`window.__qa.runTo(u, seconds)` is preserved for deterministic visual QA.

**`fondo-flujo.js` cannot be ported verbatim.** It prepends a canvas to
`<body>` and then iterates `document.body.children` assigning inline
`position`/`z-index` to every sibling (`fondo-flujo.js:9-20`). Under Next.js
that set includes framework-injected nodes, and React will fight the inline
styles on hydration. It needs a real stacking context instead. `revelar.js`
ports cleanly but depends on 17 hardcoded selectors (`revelar.js:9-18`) that
fail silently if a class is renamed.

### 4.2 Server surface

Every panel mutation runs as a server action or route handler. None of them is
reachable with an anon-key client.

```
crearAsignacion          guardarDictamenBorrador     enviarDictamen
marcarAnonimizacion      registrarDecisionFinal      crearEdicion
publicarEdicion          crearArticulo               invitarUsuario
exportarRegistro         vincularRevision
```

**Rule:** the browser never holds a Supabase client capable of reading
`envios_autoria`. All author-field access is mediated server-side, where the
blinding predicate in §7 is applied.

## 5. Data model

### 5.1 Reference tables (seeded)

```sql
secciones      id, numero, nombre_canonico, nombre_display, slug, nivel,
               descripcion, orden, es_asignable, publica
temas          id, nombre, slug
tipos_pieza    id, nombre
usuarios       id → auth.users, nombre, email, activo
usuario_correos id, usuario_id, correo   -- alternates, for conflict checks
```

`nombre_canonico` is the Excel form (`"2 · Datanomics"`); `nombre_display` is
what the UI renders (`"Datanomics"`). The DB stores canonical.

`secciones` holds **9** rows: the 8 real sections plus `"Por asignar"`
(`nivel NULL`, `publica = false`), the target for the form's
`"Aún no lo decido"` option. `temas` holds **28**: the 27 topics plus
`"Otro tema"`. This is what prevents defect 5 from recurring — a piece with no
chosen section is stored, routed to a `sin sección asignada` panel queue, and
cannot be assigned for review until staff set a real section.

### 5.2 The rubric is versioned data, not code

The workbook defines eight distinct instruments. Hardcoding them would mean a
deploy every time the committee adjusts a criterion.

```sql
rubrica_versiones    id, seccion_id, version, vigente bool, creada_at
rubrica_puertas      id, rubrica_version_id, orden, etiqueta, es_eliminatoria
rubrica_dimensiones  id, rubrica_version_id, orden, etiqueta, es_critica,
                     peso DEFAULT 1, permite_na DEFAULT false
bandas_decision      id, rubrica_version_id, min_puntaje, etiqueta,
                     variante, es_aceptante bool
```

**Versioning is not optional.** Without it, changing a weight or a band
boundary silently rewrites the verdict of every historical dictamen —
including ones already emailed to authors. `dictamenes.rubrica_version_id` is
pinned when the scorecard is submitted, and the computed result is additionally
persisted as a snapshot (§5.4).

Non-`★` gates are recorded but do **not** affect the outcome — they are
checklist items. Only `es_eliminatoria` gates can fail a piece, mirroring the
workbook, where e.g. Apertura has four gates but `Puertas ★ OK` tests only `F`.

`es_aceptante` marks which band outcomes permit publication (§9), replacing
string comparison against decision text.

Per-section failure labels live on the version, because they differ (§6):

```sql
rubrica_versiones.etiqueta_falla_puerta
rubrica_versiones.etiqueta_falla_critico
rubrica_versiones.etiqueta_pendiente
```

### 5.3 Submissions

PII lives in a 1:1 child table. This is the mechanism that makes §7
enforceable: Postgres RLS is row-level, and column privileges are role-based,
so "this staff member may read this row but not these four of its columns"
cannot be expressed — especially with a single role. Splitting the table turns
the whole double-blind into one readable row policy.

```sql
envios
  id            uuid pk
  folio         text unique      -- VTX-2026-001, immutable
  -- manuscrito (never blinded)
  titulo, tipo_pieza_id, seccion_id, tema_id, resumen,
  palabras_clave text[], es_investigacion bool, uso_ia, locale
  -- staff-entered
  extension          text        -- "600 palabras", "5 cuartillas"
  antiplagio         text        -- Sí | No | N/A
  anonimizacion_revisada_por → usuarios NULL
  anonimizacion_revisada_at  timestamptz NULL
  -- derived at insert
  nivel                char(1) NULL
  seccion_dictamen_id  → secciones NULL
  -- workflow
  estado             text        -- recibido | triage | asignado | en_dictamen | decidido
  decision_id        → decisiones NULL
  decision_final_por → usuarios  NULL
  decision_final_at  timestamptz NULL
  revision_de_envio_id → envios NULL
  -- consent
  declaraciones      jsonb NOT NULL      -- d1..d4 + text version
  declaraciones_at   timestamptz NOT NULL
  archivado_at       timestamptz NULL
  created_at, updated_at

envios_autoria                      -- 1:1, blinded
  envio_id pk → envios ON DELETE CASCADE
  nombre, correo, afiliacion, coautores, notas_internas

envio_archivos
  id, envio_id → envios ON DELETE CASCADE,
  storage_path,                    -- UUID, never derived from a name
  nombre_publico,                  -- "VTX-2026-012-01.pdf"
  mime, bytes, version int, es_principal

envio_archivo_nombres               -- 1:1, blinded
  archivo_id pk → envio_archivos ON DELETE CASCADE, nombre_original
```

`notas_internas` is in the blinded table because staff notes will name authors,
and because the export mirrors `Registro`, whose column `T` is exactly this
field. Original filenames are blinded for the same reason — real example from
live data: `Registro!O8` = `GuiaExpositor_Politica_de_Competencia.pdf`.

**Folio** comes from a counter table, not a sequence:

```sql
envio_folios (anio int pk, ultimo int)
-- UPDATE ... RETURNING inside the insert transaction
```

A sequence would require runtime DDL each January, and `nextval` does not roll
back, so a failed insert would burn a number and leave a visible gap in an
author-facing identifier. The year is computed in **`America/Mexico_City`**,
not UTC — Vercel runs UTC and the journal does not, so a 31 December evening
submission would otherwise get a January folio.

**Nivel routing** replicates the workbook: look up `nivel` from `secciones`,
then apply the override — `Horizonte Global` with `es_investigacion = true`
becomes Nivel A and routes to the Miradas Económicas instrument. A submission
in `"Por asignar"` has `nivel NULL` and cannot be assigned until triaged.

**Deletion.** `articulos.envio_id` is `ON DELETE SET NULL`, so removing a
submission never 404s a published URL. `envio_archivos`, `envios_autoria`,
`dictamenes`, and `asignaciones` cascade. Any envío with a `decision_id` is
**soft-deleted** (`archivado_at`), because hard-deleting a decided submission
would destroy the consent record and the dictamen history.

### 5.4 Review

```sql
asignaciones      id, envio_id, revisor_id, asignado_at
                  UNIQUE(envio_id, revisor_id)

dictamenes        id, envio_id, revisor_id,
                  FOREIGN KEY (envio_id, revisor_id)
                    REFERENCES asignaciones(envio_id, revisor_id),
                  rubrica_version_id → rubrica_versiones,
                  estado text,          -- borrador | enviado
                  comentarios text, enviado_at,
                  -- snapshot, written at enviado, never recomputed
                  puntaje int, maximo int, puertas_ok bool,
                  criticos_ok bool, decision_sugerida_id → decisiones
                  UNIQUE(envio_id, revisor_id)

dictamen_puertas   dictamen_id, puerta_id, valor bool NULL
dictamen_puntajes  dictamen_id, dimension_id, valor int NULL
```

**A dictamen must be assigned before it can exist** — the composite FK to
`asignaciones` enforces it. Without this, any staff member could create a
scorecard for any submission purely to unblind themselves.

**`enviado` requires a complete scorecard**, enforced by a `BEFORE UPDATE`
trigger: every `★` gate answered, and every dimension scored unless it is
`permite_na`. The transition is irreversible. Without completeness, submitting
a blank card would unblind the reviewer while producing
`"Pendiente de dictamen"` — indistinguishable from not having started.

**Three-state semantics**, matching the workbook exactly:

| State | Gate | Dimension |
|---|---|---|
| row absent | not answered → fails | not scored |
| `NULL` | not answered → fails | N/A — only where `permite_na` |
| value | as given | as given |

A `CHECK`/trigger rejects `NULL` on a dimension whose `permite_na` is false.
`permite_na` is true for exactly one dimension in the entire workbook
(`'2. Datanomics'!O`, validation `"0,1,2,3,N/A"`; every other rubric range is
`"0,1,2,3"`).

### 5.5 Publishing

```sql
decisiones    id, rubrica_version_id, etiqueta, es_aceptante, es_falla

ediciones     id, numero int unique, titulo,
              estado text,          -- borrador | publicada
              publicada_at

articulos     id, envio_id NULL → envios ON DELETE SET NULL,
              edicion_id NULL → ediciones,
              titulo, autor, seccion_id, minutos_lectura,
              destacado bool, slug unique,
              pdf_publico_path NULL, es_placeholder bool
articulo_temas  articulo_id, tema_id
```

`edicion_id` is nullable and `es_placeholder` is true for the 26 existing
demonstration articles, which ship visible so topic and section discovery works
before the first edición launches. They have no `pdf_publico_path`, so
`/articulos/[slug]` renders a defined empty state for them — matching today,
where those links are dead anchors (`index.html:1942`). Staff delete them from
the panel once real content exists.

`articulo_temas` is many-to-many because the current corpus assigns up to three
topics per piece and the discovery panel filters by topic.

### 5.6 Audit

```sql
envio_eventos  id, envio_id, actor_id → usuarios, tipo, payload jsonb, at
               -- append-only; no UPDATE or DELETE grant
```

Every unblind-relevant transition is written here: dictamen submitted,
anonymization checked, decision recorded, revision linked, edición published,
export generated. Without it, §7's accountability claim has nothing behind it.

## 6. Decision engine

One TypeScript module, unit-tested, reproducing the workbook cascade:

```
1. no dimension scored          → etiqueta_pendiente
2. any ★ gate not "Sí"          → etiqueta_falla_puerta
3. any ★ critical scored < 2,
   or ★ critical not scored     → etiqueta_falla_critico
4. otherwise                    → band lookup by puntaje
```

`puntaje = Σ (valor × peso)` over scored dimensions.
`máximo = Σ (3 × peso)`, excluding any dimension scored `N/A`.

Rules 2 and 3 are stricter than they first appear, and deliberately so. The
workbook's `U8 = IF(AND(F8="Sí"),"Sí","No")` fails a **blank** gate, and its
`V8 = IF(OR($A8="",COUNT(J8:M8)=0),"",IF(AND(J8>=2),"Sí","No"))` evaluates a
blank critical as `0 >= 2` → false → fail, as soon as any other dimension is
scored. Treating an unscored critical as "skip" would produce a more favourable
verdict than the real instrument gives.

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

**Three vocabularies, not two.** Band outcomes differ, and so do the failure
labels — verified against `W8` in every sheet:

| | Miradas Económicas (Nivel A) | All other sections |
|---|---|---|
| bands | `Aceptado` / `Aceptado con revisiones menores` / `Revisiones mayores` / `Rechazado` | `Publicable` / `Publicable con ajustes menores` / `Requiere reelaboración` / `No publicable en este número` |
| gate fail | `No aceptable (revisar puertas ★)` | `No publicable (falla puerta ★)` |
| critical fail | `No aceptable (crítico < 2)` | `Requiere reelaboración (crítico < 2)` |

This is not cosmetic: `Requiere reelaboración` is a Nivel C verdict that does
not exist in the Nivel A vocabulary.

Only Datanomics has a dimension with `permite_na` (`Utilidad del how-to`);
scoring it `N/A` drops the maximum to 12 and selects the `/12` band variante.

### 6.2 Test matrix

Written before the engine. Per section:

- pending state (nothing scored)
- each `★` gate failing individually
- each `★` gate **unanswered** (absent row and `NULL`)
- each `★` critical at 1 and at 2
- each `★` critical **unscored** while another dimension is scored
- both boundaries of every band
- the correct failure **label** for that section's vocabulary

Plus: Apertura's `peso = 2` arithmetic; Datanomics' N/A max-shift and its band
variante switch; `NULL` rejected on a dimension without `permite_na`; a pinned
`rubrica_version_id` still producing its original verdict after the live rubric
is edited.

### 6.3 Consensus

Each submitted scorecard yields its own suggested decision, snapshotted at
`enviado`. The envío view renders them side by side and flags disagreement. A
staff member records `decision_id` on the envío; that value — not any
individual suggestion — is what the author sees and what gates publication.

## 7. Blinding

### 7.1 What is enforced and what is not

**The record is technically blind. The document is procedurally blind.** These
are different guarantees and the distinction is deliberate.

*Enforced by the database and server:*

- `envios_autoria` (nombre, correo, afiliación, coautores, notas internas)
- original filenames (`envio_archivo_nombres`)
- PDF and Office **metadata**, stripped on upload
- the `.xlsx` export, the panel queue, search, sort, and filter

*Not enforced, and not claimed to be:*

- Identifying text **inside** the manuscript — byline, running headers,
  affiliation on the cover page, acknowledgements, self-citations.

Metadata stripping is deterministic and format-independent: `/Author`,
`/Creator`, `/Producer`, `/Title`, `/Subject`, `/Keywords` in the PDF DocInfo
and XMP packet, and `docProps/core.xml` (`creator`, `lastModifiedBy`) plus
tracked-changes and comment authorship in `.doc`/`.docx`, which the form also
accepts. Removing a *visible* byline is not automatable — it requires deciding
which rendered text is identifying, and any heuristic fails on the variety of
submissions received.

Only Miradas Económicas even has an anonymization gate
(`'4. Miradas Económicas'!F7`), and it is checked *during* dictamen — after the
reviewer has opened the file. The other seven instruments have none. The
workbook concedes the same point at `Guía!A28`: the double-blind is completed
by circulating an anonymized manuscript, a human step.

**Decision:** ship metadata stripping only, and state the boundary plainly
rather than claim enforcement that does not exist. Reviewers are instructed
that document anonymization is a shared responsibility. Adding a mandatory
staff anonymization check, or requiring authors to upload an anonymized copy,
were both considered and deferred — the schema keeps
`anonimizacion_revisada_por` / `_at` so either can be turned on later without a
migration.

### 7.2 The rule

Because there is a single staff role, blindness cannot be a permission tier. It
is a function of `(viewer, submission)` state, and it applies to **everyone**:

> No staff member can see a submission's author fields until **they
> personally** have submitted a dictamen for that submission — or until the
> submission has a `decision_id`.

Being unassigned is not a reason to see the author. Anyone can open the panel
by accident or curiosity; the default must be blind.

Visible while blinded: folio, título, tipo de pieza, sección, fecha de
recepción, extensión, resumen, palabras clave, and the manuscript file.

Three unblind triggers, in order of precedence:

1. **Per-viewer.** A staff member sets their own scorecard to `enviado` → that
   submission unblinds for that member alone. Other reviewers stay blind until
   each submits their own. The completeness trigger in §5.4 is what gives this
   a real cost.
2. **Decision recorded.** `decision_id` is set → unblinds for all staff. The
   review is finished; blinding past this point protects nothing and would make
   publishing impossible, since attaching an article to an edición requires the
   author's name.
3. **Published.** The edición goes live → the author is public.

Implemented as one RLS policy on `envios_autoria`:

```sql
USING (
  EXISTS (SELECT 1 FROM dictamenes d
          WHERE d.envio_id = envios_autoria.envio_id
            AND d.revisor_id = auth.uid()
            AND d.estado = 'enviado')
  OR EXISTS (SELECT 1 FROM envios e
             WHERE e.id = envios_autoria.envio_id
               AND e.decision_id IS NOT NULL)
)
```

`envios` itself carries no PII, so queue, detail, dictamen, and export inherit
the blind without further logic.

**There is no reveal action.** A logged "mostrar autor" escape hatch was
considered and rejected. A staff member who needs an author's identity files
their dictamen first. Accepted cost: answering an author's mid-review email
requires either completing a dictamen or replying on the folio alone.

Residual risk, accepted: both triggers are deliberate acts. The blind is
**accountable, not absolute** — every trigger writes to `envio_eventos` with an
actor and a timestamp.

### 7.3 Conflict of interest

Checked against `usuarios.email` **and** `usuario_correos`, because live data
shows staff submitting from personal Gmail addresses alongside institutional
`@tec.mx` ones — two of the former and one of the latter, in the workbook as of
2026-08.

> Redactado: aquí iban las tres direcciones reales, copiadas del libro como
> evidencia. Son datos personales de gente del comité y este repositorio es
> público, así que se describen en vez de citarse. El argumento no depende de
> cuáles sean: depende de que existan, y por eso el chequeo mira
> `usuario_correos` y no sólo `usuarios.email`. Las direcciones siguen en el
> libro, que no se versiona.

The check runs at **candidate-pool** time: a conflicted reviewer is excluded
from the assignment picker and no reason is reported. Reporting "cannot assign,
email matches" would turn the assignment form into an oracle — iterate across
ten staff members and the one rejection identifies the author.

Email matching cannot detect co-authorship, so the dictamen carries a
self-declaration checkbox: *"No participé en la elaboración de esta pieza."*

## 8. Submission flow

The form's four steps, validation thresholds, wording, and drag-and-drop are
unchanged. What changes underneath:

1. Files upload **directly from browser to Supabase Storage** via a signed URL
   from `POST /api/uploads`. The base64-in-JSON path is deleted.
2. Metadata is stripped server-side on upload; the object is stored under a
   UUID path with the original name recorded in the blinded table.
3. `POST /api/envios` writes the row, derives `nivel` and
   `seccion_dictamen_id`, and takes a folio from `envio_folios`.
4. Resend emails the author their folio and a link to the status page.
5. **No silent-failure path.** If the write fails the user sees an error and
   the form retains their input. The fabricated-folio fallback is removed.

Preserved validation: resumen 100–300 words with live counter; 3–5
comma-separated keywords; `.pdf`/`.doc`/`.docx`, 20 MB per file; four
declarations; email regex.

**Now enforced server-side**, since uploads no longer pass through the API:
MIME sniffing rather than extension matching, per-file and aggregate size caps
(max 5 files, 50 MB total), rate limiting on the signed-URL endpoint, and a
scheduled sweep of storage objects never referenced by an envío — abandoned
wizards would otherwise orphan them permanently.

**The four declarations are persisted.** Today they are validated client-side
but carry no `name` attribute and are absent from the POST body
(`index.html:2109-2124`). `d4` is the publication licence, and §9 copies PDFs
to a public bucket — there must be a record that the author granted permission.
Stored as `declaraciones jsonb` with the declaration text version, `NOT NULL`,
validated server-side.

The `formato` select is replaced by the nine canonical `tipos_pieza` from
`Catálogos`, resolving the 5-vs-9 mismatch. This is a UI change and adds nine
label strings that exist in no dictionary — see §11.

## 9. Publishing flow

1. Staff create an edición: `número` + `título`, `estado = borrador`.
2. Submissions whose decision has `es_aceptante = true` are attached as
   `articulos`; staff set read time, topics, and featured flag.
3. Publishing copies each PDF from the private bucket to the public bucket and
   flips all the edición's articles live in one transaction.

The private bucket is never publicly readable, so an unpublished manuscript
cannot be reached by guessing a URL.

## 10. Author-facing

- Public status lookup by folio + correo, unchanged in appearance. The folio now
  matches what the site tells authors to type.
- Resend email on every `decision_id` change, in the author's stored `locale`.
- No author accounts.

The author sees the recorded `decision_id` once one exists, and `"En revisión"`
before that.

**This is a deliberate behavior change, not parity.** Today
`Registro!S4 = IF(OR($R4="",$R4="Pendiente de dictamen"),"En revisión",$R4)`
where `R4` reads *Decisión vigente* = `IF($X8<>"",$X8,$W8)` — the
**auto-suggested** decision when the committee has not recorded one. So at
present, the moment a reviewer scores a single dimension, the author-visible
status can flip to raw jargon like `"No publicable (falla puerta ★)"`. Showing
only committee-recorded decisions is an improvement, and is documented as such.

### 10.1 Revisions

Four of eight outcomes ask the author to revise. With no author accounts, the
author resubmits through the public form and receives a **new folio**. Staff
then link the two records in the panel (`vincularRevision` →
`revision_de_envio_id`), so the dictamen history is joinable and the panel can
display the chain.

Accepted limitation: two folios exist for one paper, and the link depends on
staff noticing. A signed one-time upload link in the decision email was
considered and deferred.

## 11. Internationalization

Migrating to next-intl is **not a mechanical script**, and the plan budgets for
that.

The current system keys translations on normalized Spanish **sentences**
(`idiomas.js:54-56`); there are no ids or `data-i18n` attributes anywhere. Three
consequences:

1. **Keys must be designed.** next-intl uses dot notation for namespacing, and
   many of these strings contain periods, which would be parsed as nested
   paths. A script can emit JSON but cannot invent semantic keys or rewrite the
   call sites.
2. **The dictionaries are uneven.** Actual counts: `ru` 517, `en` 511, `it`
   509, `fr` 508, `pt` **479**. The union is 517, so Portuguese is missing 38.
   Today a miss silently falls back to Spanish (`dicc[s] || s`); next-intl must
   be configured with `es` as an explicit fallback locale or the Portuguese
   build breaks in 38 places.
3. **Some keys collide.** `"Otro"` serves both the *género* select and the
   *formato* select (8 occurrences). One Spanish key yields one translation per
   language, so several locales cannot render both correctly today. Named keys
   fix it — but that is retranslation, and it is scoped as such. Same for
   `"Estado"`, `"Formato"`, `"Sección"`, `"tema"`.

New translation work, not migration: the nine `tipos_pieza` labels from §8, and
the discovery-panel chrome that exists in **no** dictionary today —
`"Índice de temas"`, `"Todos los temas"`, `"Buscar un tema"`,
`"← Regresar al índice"`, `"min de lectura"` (`index.html:1964-1988`).

Locale routes: Spanish at root, `/en`, `/fr`, `/it`, `/pt`, `/ru`. The language
pill keeps its current appearance. Server-rendered, so the current flash of
Spanish disappears. `<option value>` attributes remain Spanish, so the database
continues receiving Spanish regardless of locale.

CI check: all six message files must share a key set.

## 12. Excel export

A panel button generates an `.xlsx` mirroring the current `Registro` column
layout. Read-only; no sync back.

The export obeys §7 — author columns are blank for any submission the exporting
user is still blind to, and each export writes an `envio_eventos` row. An
export is not a way around the blind.

## 13. Security

- Invite-only accounts, email + password. No public signup.
- RLS on every table. Anonymous has **no INSERT anywhere**; `POST /api/envios`
  uses a service-role client server-side. Anon may read published `articulos`,
  placeholder `articulos`, published `ediciones`, and the reference tables.
- `envios_autoria` and `envio_archivo_nombres` are reachable only through the
  server surface in §4.2.
- Private storage bucket readable only via server-minted signed URLs.
- **`/api/estado` is hardened.** It is otherwise an email oracle: public,
  unauthenticated, and it confirms a folio↔email pair, while folios are a
  predictable sequence. A blinded reviewer already holds the folio and need only
  test candidate addresses. Mitigations: rate limit with exponential backoff per
  IP *and* per folio; identical, constant-time responses for "wrong email" and
  "no such folio"; no enumeration signal in status codes or timing.
- Rate limiting on `POST /api/envios` and `POST /api/uploads`.
- CAPTCHA or Vercel BotID on public submission.
- CSP headers; no inline script beyond the canvas component's bundle.
- Service-role key server-only, never in a client bundle.
- PII retention policy: submissions archived rather than deleted; a documented
  procedure for author deletion requests.

## 14. Migration and cutover

The database starts empty. Existing workbook rows are not imported: the real
entries are few, several are tests, and one was never routed to a dictamen.

The 26 placeholder articles are seeded with `es_placeholder = true`.

**Redirect map**, since every path changes:

```
/index.html          → /
/lineamientos.html   → /lineamientos
/quienes-somos.html  → /quienes-somos
/equipo-ds.html      → /equipo
/mision-ds.html      → /quienes-somos#mision
/vision-ds.html      → /quienes-somos#vision
```

The last two are currently meta-refresh stubs and must keep working.

The Netlify site and Cloudflare Worker stay running until cutover.

## 15. Observability

The defect that motivated this rebuild was *silent submission loss*. The
replacement must not be able to lose one quietly.

- Structured logging on all three API routes, with folio as a correlation id.
- Sentry (or Vercel log drains) with an **alert on any `POST /api/envios` 5xx**
  and on any signed-upload failure.
- Resend delivery and bounce webhooks written to `envio_eventos`. A bounce
  notice must not surface the address to a blinded viewer.
- Weekly digest: submissions with no assignment, dictámenes in `borrador` older
  than N days, pieces in `"Por asignar"`.
- Storage sweep job reports orphaned objects rather than deleting silently.

## 16. Delivery order

Each stage is independently verifiable and leaves the system working.

1. **Scaffold + visual parity.** Next.js app, fonts, canvas engine port,
   satellite pages, static content, redirect map. **Playwright screenshot
   diffs across all six locales** — "side-by-side comparison" cannot carry a
   goal stated as *preserve the design exactly*.
2. **i18n migration.** Key design, converter, next-intl wiring, locale routes,
   `es` fallback, CI key-set check.
3. **Schema + decision engine + security model.** Migrations, reference and
   rubric seed data, the scoring module and its full §6.2 matrix, **and the RLS
   test suite** — running as a real unprivileged staff JWT, asserting author
   fields are absent from queue, detail, dictamen, export, and direct PostgREST
   access. The security model is proven before any panel UI exists.
4. **Submission pipeline.** Signed uploads, metadata stripping, `POST
   /api/envios`, folio counter, declarations, Resend receipt, hardened
   `/api/estado`.
5. **Admin panel.** Auth and invites, queue and counts, envío detail, triage of
   `"Por asignar"`, assignments, scorecards, blinding, decisions, revision
   linking, status emails.
6. **Publishing.** Ediciones, articulos, bucket copy on publish, article pages,
   discovery reading from the database.
7. **Export, observability, cutover.** `.xlsx` export, alerting, domain switch,
   retire Netlify and the Worker.

Stages 1 and 2 change nothing an editor depends on and can ship before the
backend exists.

## 17. Open questions

- **Author-facing decision wording.** Internal decisions include jargon such as
  `"No publicable (falla puerta ★)"`. Recommendation: map internal values to
  author-appropriate text in emails and the status page, keeping the raw value
  in the panel.
- **Dictamen comments to authors.** Whether the status email includes reviewer
  `comentarios` or only the decision. Recommendation: staff opt in per
  submission when recording the final decision.
- **Domain and cutover timing.**
- **`CONTEXT.md` is an unfilled template** while the project's `CLAUDE.md`
  treats it as the binding domain glossary. Populate it with the vocabulary
  this spec introduces — folio, envío, dictamen, puerta ★, dimensión crítica,
  banda, nivel, edición, sección canónica vs. display — before implementation,
  or terminology will drift across seven stages.

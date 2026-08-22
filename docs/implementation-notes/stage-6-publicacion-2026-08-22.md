# Implementation notes — Stage 6, publishing

- **Spec**: `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md` §5.5, §9
- **Started**: 2026-08-22

## Discovery now reads from Postgres, and the gate still passes

The 26 demonstration articles were a static array that the carousel and the
discovery panel imported directly. They are now rows in `articulos` with
`es_placeholder = true`, and both components receive them as props from a
server component.

That is the riskiest edit in this stage, because the discovery panel is inside
the visual parity gate: changing where the data comes from must not change a
pixel. Three things made it safe:

1. **The seed is generated, not typed** — `scripts/articulos/generar-semillas.mjs`
   emits the migration from `scripts/articulos/muestra.mjs`, which holds the
   original array verbatim.
2. **`orden` is a column.** The array's order is the order the panel lists
   them in, and the gate compares that. Without the column, `select` would
   return whatever the planner felt like.
3. **Round-trip check.** After seeding, the rows were read back, reassembled
   into the original `Articulo[]` shape, and compared field by field against
   the old file: 26/26 identical, same order. Then, and only then, the file was
   replaced.

24/24 parity still green.

## The publish path, and the order it happens in

Copying the PDF from the private bucket to the public one cannot live in SQL —
Storage is not reachable from Postgres. So publishing is an action, not a
single function, and the sequence matters: **copy every PDF first, flip the
edition last.** If a copy fails halfway, the edition is still a draft and
nothing is visible, because `articulos`' policy reads the state of its edition.
Half a copy is not half a published issue.

`publicar_edicion` refuses if any piece still lacks `pdf_publico_path`, so the
two halves cannot drift apart.

`tests/panel/publicar.spec.ts` walks it end to end and checks the two promises
around it, not just the button:

- while the edition is a draft, `/articulos/<slug>` is a **404** even knowing
  the slug;
- the private manuscript is not fetchable by URL, before or after publishing.
  What becomes public is a *copy* in another bucket, never the original.

## Decisions made outside the spec

- **The landing is ISR (`revalidate = 300`), not dynamic.** It is the most
  visited page and its content changes when the committee publishes, not when
  someone opens it. The cost is a new dependency: the build now needs to reach
  the database to prerender. That is the first of its kind in this project and
  worth knowing before a CI runner without network tries it.
- **Public reads use the anon key, not the service key**, even though the
  server has both. What decides whether an article is visible is
  `articulos_lectura_publica`; reading with the service key would bypass it and
  move that rule into every query, where one forgotten `where` publishes a
  draft issue. Same principle as the panel running as the user's session.
- **`adjuntar_articulo` refuses anything without an accepting decision.** The
  picker only offers accepted pieces, but the function checks again — a
  "requires rework" hung on an edition would turn a verdict into a publication
  by accident. It is also `SECURITY INVOKER` on purpose: reading the author's
  name goes through the blinding policy, and it passes precisely because a
  decided piece is already unblinded. A piece without a decision could not even
  supply a byline.
- **Slug generation exists twice, and the two are pinned together.**
  `src/lib/texto.ts` computes it in TypeScript for the seed; `adjuntar_articulo`
  computes it in SQL for real pieces. A unit test asserts the two agree, and a
  query confirmed all 26 seeded slugs match the SQL version. `unaccent` is not
  enabled on the project and asking for it needs privileges this does not
  warrant, so `public.unaccent_simple` is a `translate()` over the Latin set.
- **Only PDFs are published.** A `.docx` in the public bucket would be an
  editable document with the author's own layout, not the journal's piece. The
  action stops with a message naming the piece.
- **Placeholder articles are `noindex`.** They are scaffolding so topic
  discovery works before the first issue, not content.
- **Article pages are dynamic, not prerendered.** There is no
  `generateStaticParams`: the set of articles changes when staff publish, and a
  stale prerender would 404 a live piece.

## Gotchas / surprises

- **`NextIntlClientProvider` serialises the whole message catalogue into the
  HTML.** A test asserting `html).not.toContain("Descargar el PDF")` passes or
  fails for the wrong reason — the string is in the page as data even when
  nothing renders it. Content assertions have to run against the rendered tree.
- **`download()` is not authoritative.** It served a *deleted* object, which is
  the mirror image of the stage-4 bug where it served a stale one. The e2e now
  asks `list()`, which reads `storage.objects`. Reassuringly, this cannot leak a
  manuscript to a reviewer: the only signed URL for the dirty path was ever held
  by the author's own browser, and reviewers only receive the clean path.
- **The carousel is not in the accessibility tree on load** — it lives inside
  the canvas journey — so `getByRole("link")` finds nothing. Its links are
  asserted by selector.
- **A successful action that removes its own form removes its own message.**
  Third time this has caught a test: assignments, decisions, and now publishing.
- **`create or replace` with `search_path = ''` needs every call schema-
  qualified.** The repo migration called `unaccent_simple(...)` bare, which
  would have failed on a fresh `db reset` even though the applied version was
  correct. Caught when syncing the file to what was actually applied.

## Deferred / follow-ups

- **Topics on a published article come from the submission's single
  `tema_id`.** §5.5 says up to three per piece and the join table supports it,
  but there is no UI to add more yet. The seeded demonstration articles do have
  multiple topics.
- **No `orden` control for real articles inside an issue.** They come out in
  insertion order. The column exists.
- **Placeholders cannot be deleted from the panel yet.** §5.5 says staff delete
  them once real content exists; right now that is a SQL statement.
- **Nothing regenerates the landing on publish.** ISR expires after five
  minutes; an explicit `revalidatePath("/", "layout")` from the publish action
  would make it immediate, but it has to cover six locales.

## Open questions for review

- **The conflict-of-interest exclusion is quietly observable.** §7.3 chose to
  drop conflicted reviewers from the picker without saying why, precisely to
  avoid an oracle. But the panel also lists the whole committee at
  `/panel/equipo`, so anyone can diff the two lists and the difference is the
  author — when the author is a committee member, which is common in a student
  journal. The spec's design assumed the exclusion was unobservable and it is
  not. Options, all cheap: hide the roster from the assignment flow, drop
  candidate-pool filtering and rely on the self-declaration, or accept it and
  say so out loud in the committee's guidance. Worth a decision rather than a
  default.
- **The Supabase advisor now warns about `candidatos_asignacion`** being a
  `SECURITY DEFINER` function callable by signed-in users. That is deliberate
  and is the point of the function — it compares an email the caller cannot see
  — and it checks `es_staff()` internally and returns only id and name. Like
  `envio_folios`' RLS warning, this one should not be "fixed".
- **Read time is typed by hand.** It could be estimated from the PDF's word
  count at publish time. Not obviously better — the committee may want control.

# Implementation notes — Stage 4, submission pipeline

- **Spec**: `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md` §8, §10, §13, §15
- **Started**: 2026-08-21
- **Supabase project**: `kwfobjzvotyltxgnyagg`

## The bug the end-to-end test found, and why no unit test could

`limpiar()` strips PDF and `.docx` metadata correctly — twelve unit tests say
so, and they are right. And yet the first end-to-end run downloaded the stored
manuscript and found `Autora Que No Debe Aparecer` sitting in `/Info`, while
the object in the bucket was the clean 579-byte version.

The cause was the shape of the flow, not the code. The browser uploads the
**original** to a signed path; the server downloads it, cleans it, and — as
originally written — wrote the clean version back over *the same path* a few
seconds later. In that window the path already exists and is already
fetchable, and the upload carried `cacheControl: 3600`. The CDN kept the dirty
copy and went on serving it. Lowering it to `max-age=0` narrowed the window
but did not close it: invalidation on overwrite is not immediate.

The fix is structural rather than a tuning knob: the cleaned file goes to a
**new UUID path**, and the dirty one is deleted. A path that was never served
dirty cannot be cached dirty. `crear_envio` therefore takes two paths per file
— `subida_path`, the signed one, which is the ticket it validates and consumes,
and `storage_path`, where the clean bytes live, which is what gets stored.

This is the one defect in the stage that a reviewer would actually have hit,
and it is exactly the person the blinding is meant to protect the author from.
`scripts/e2e/envio.mjs` is committed because of it: unit tests could not see
past their own return values.

## The second security finding

`supabase/tests/superficie-api.sql` checks the ACL of *every* function in
`public` and `privado`, not just the ones stage 4 added. It immediately found
two stage-3 trigger functions — `privado.valida_na_dimension` and
`privado.valida_dictamen_completo` — still holding `EXECUTE` for `PUBLIC`.

Low severity: they are trigger functions, so calling them by hand fails as soon
as they touch `NEW`, and `anon` has no `USAGE` on `privado` anyway. But they
are `SECURITY DEFINER`, and "unreachable for two independent reasons" stops
being true the moment a future migration grants schema usage. Same root cause
as the stage-3 finding in `20260821120700`: Postgres grants `EXECUTE` to
`PUBLIC` on every new function, and `alter default privileges … from anon,
authenticated` does not cover the `PUBLIC` pseudo-role. Default privileges for
functions are now closed in both schemas.

Verified afterwards that both triggers still fire — Postgres checks `EXECUTE`
at `CREATE TRIGGER` time, not at fire time, but that is worth confirming rather
than assuming.

## Decisions made outside the spec

- **One RPC per operation instead of client-side queries.** PostgREST has no
  transactions across requests, and a submission touches five tables and draws
  a folio from a counter. Five round-trips leave gaps where a half-failure
  burns a folio or writes an envío with no authorship row. `crear_envio` is one
  statement and therefore one transaction.
- **`es_investigacion` is derived server-side from `tipo_pieza`, never taken
  from the request body.** It decides whether a Horizonte Global submission is
  judged with the Nivel A instrument — that is, how demanding its rubric is —
  and that cannot be the submitter's choice.
- **Rate limiting lives in Postgres, not Redis.** A sliding window over a
  `privado.golpes` table. Fixed windows let through double the quota at the
  boundary, and one of the things being limited is an email oracle. At a few
  dozen submissions a year, counting rows is free.
- **IP addresses are stored as a salted hash, never in the clear.** The salt is
  the service-role key: already secret, already mandatory, and rotating it just
  resets the counters. What the limiter needs is a stable identifier, not an
  address.
- **`/api/estado` is POST, not GET.** A folio and an email in a query string end
  up in proxy access logs and browser history.
- **The `.doc` binary format is passed through, marked, rather than rejected or
  cleaned.** It is a 1997 Compound File with the author's name spread across
  several OLE streams; doing it properly means implementing the container, and
  doing it badly corrupts the manuscript. It is recorded as
  `metadatos_no_limpiados` in `envio_eventos` so the anonymisation review —
  which has to happen anyway, because the name can be on the cover page — sees
  it. Same treatment for a PDF `pdf-lib` cannot reparse.
- **A failed receipt email never fails the submission.** The row is written; an
  error at that point would push the author to submit again, and then there
  would be two. It is logged and written to `envio_eventos`.
- **A replayed or forged storage path returns 400, not 500.** §15 asks for an
  alert on every `POST /api/envios` 5xx, and that alert is only useful if it
  always means the same thing. `check_violation` (23514) from `crear_envio` is
  a client error.
- **`claves.json` is now the source, not the codemod's output.** `convertir.mjs`
  was a one-shot migration; re-running it would erase anything added by hand
  afterwards. `scripts/i18n/etapa4.mjs` records this stage's additions and
  removals so the change is reviewable rather than a hand-edit of generated
  JSON.

## Deviations from the spec

- **§8 says "metadata is stripped server-side on upload". It is stripped on
  registration**, in `POST /api/envios`. It cannot be done on upload: the whole
  point of the signed URL is that the bytes go straight from the browser to
  Storage without passing through the server. `POST /api/envios` is the first
  moment the server can see them, and it is also where MIME sniffing has to
  happen for the same reason.
- **The nine `tipos_pieza` labels render in Spanish in all six locales.** The
  spec classifies them as new translation work rather than migration (§11), and
  `generar.mjs`'s rule — no legacy translation means the Spanish string —
  applies unchanged. Five previously-translated `formato` options are gone, so
  this is a small step backwards for non-Spanish authors on that one select,
  taken knowingly.
- **CAPTCHA / Vercel BotID (§13) is not implemented.** It needs a Vercel
  deployment to configure. Rate limiting on both public endpoints is in place;
  bot defence is a cutover task.

## The per-IP backoff was too strict, and it was measured

The first version blocked an IP after three failed status lookups. Against the
server: three wrong emails and the fourth request gets a 429 — *including* the
author's, once they finally typed their address correctly.

For an anonymous email oracle that is the right trade. For Vértices it is not:
this is a university journal, half a faculty leaves through one NAT address,
and one curious person locks out the building.

What actually stops the §13 attack is not the IP rule. The attack varies the
*email* against a fixed folio, and the **per-folio limit** — ten per hour, from
anyone — is what caps it, without punishing bystanders. So the folio+email
backoff stays strict, and the IP rule got ten failures of grace and a
fifteen-minute ceiling instead of an hour. Re-measured: four wrong guesses from
one address no longer lock out the legitimate author, and the folio counter
still ticks.

## Gotchas / surprises

- **`create or replace function` with a new signature does not replace — it
  overloads.** Adding defaults to `privado.intento_fallo` left two functions and
  made the one-argument call ambiguous (`42725, function is not unique`). The
  old one has to be dropped first.
- **`pdf-lib` writes all registered objects, reachable or not.** Deleting the
  catalog's `/Metadata` entry hides the XMP from viewers but leaves the stream
  in the file, where `strings manuscrito.pdf` finds `dc:creator`. The indirect
  object has to be deleted from the context too. The test caught this.
- **`pdf-lib` saves with object streams by default**, so `/Info` is Flate-
  compressed and the author's name is not in the raw bytes. A test fixture
  built the default way would let a byte-level assertion pass while the name
  was still there; the fixtures use `useObjectStreams: false` on purpose.
- **PDF strings are hex-encoded UTF-16BE.** `/Author <FEFF004E006F...>`. There
  are three ways a name can survive in a PDF, and a test that checks only the
  plain one always passes.
- **The generated `Database` type needs `Relationships` on every table** or the
  whole schema fails to satisfy `GenericSchema` and every query silently infers
  `never`. `src/lib/supabase/tipos.ts` uses empty arrays; nested `select` joins
  will type as `never` until it is regenerated properly.
- **Supabase's signed-upload endpoint expects multipart with an unnamed field**
  for the file. `subirA` builds it by hand so the browser never loads the
  Supabase SDK — §4.2 says the browser has no Supabase client, not even an
  anonymous one.
- **The root `.env` was not gitignored.** `web/.gitignore` covers `.env*`, the
  root one did not, and the file showed as `?? .env` — one `git add -A` from
  putting the service-role and Resend keys in a repo with a public remote.
  Fixed before anything else; confirmed it never appeared in history.

## Deferred / follow-ups

- **The receipt email has never actually been delivered.** Resend on
  `onboarding@resend.dev` only sends to the account owner's address, so the
  end-to-end test uses `@example.invalid` and exercises the failure path
  instead. Sending a real one is an outward-facing action and needs the user's
  say-so; a verified domain is needed for production anyway.
- **Resend delivery and bounce webhooks (§15) are not wired.** They need a
  public URL. A bounce notice must not surface the address to a blinded viewer,
  so that route needs care.
- **Sentry / log drains and the 5xx alert (§15) are not configured.** The
  structured logging they consume is in place — every line carries route,
  request id and, once it exists, folio.
- **`supabase/tests/*.sql` still have no runner.** Two suites now (`rls.sql`,
  `superficie-api.sql`), both run by pasting into `execute_sql`. Worth wiring
  into `npm test` once the CLI has a database URL.
- **Repository migrations and applied migrations differ in comments.** The
  files are canonical; the applied versions were pasted without the leading
  block comments. Schema-identical, but a `db reset` is what would prove it.
- **`envio_archivos.version` is unused.** Stage 5's revision linking is where it
  starts to matter.

## Open questions for review

- **The `.doc` pass-through is a real hole in the blinding**, and the only thing
  behind it is a human check. If the committee would rather not accept `.doc`
  at all, that is a one-line change to `EXT_OK` — and one fewer way for an
  author's name to reach a reviewer.
- **The declaration text version is a hardcoded `"2026-08-21"`** in the route.
  It has to be bumped by hand whenever the wording of the four checkboxes
  changes. If the committee expects to reword them, that belongs in a table.
- **The orphan sweep deletes at 04:00 daily** (`web/vercel.json`), 24 hours
  after upload. §15 asks the sweep to report rather than delete silently, so
  deletion is opt-in via `?borrar=1` and every path is logged — but an author
  who abandons the wizard on Friday and returns on Monday loses their upload.

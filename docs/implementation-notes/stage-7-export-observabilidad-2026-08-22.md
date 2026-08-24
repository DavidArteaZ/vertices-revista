# Implementation notes — Stage 7, export, observability, cutover

- **Spec**: `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md` §12, §14, §15
- **Started**: 2026-08-22

## The export inherits the blind instead of reimplementing it

§12's hard claim is that the `.xlsx` obeys §7 — author columns blank for
anything the exporter is still blind to. The tempting way to build that is an
`if` in the export code, which means two implementations of the same rule and
one of them being the one nobody updates.

Instead the export runs on the *user's session*, so `envios_autoria` arrives
already filtered by the policy. Where there is no row, the columns get `—`. The
route contains no blinding logic at all.

`tests/panel/export.spec.ts` downloads the real file, opens it with exceljs and
reads cells. It checks the specific columns, and then the thing that actually
matters: the author's name appears in **no cell of the sheet**. Then it records
a decision and downloads again — and now it does.

The logged `cegados` count is asserted against a number computed from the
database (submissions with no decision that the exporter hasn't reviewed), so
the assertion holds no matter what order the specs run in.

## Bounces cannot carry the address, and that is tested

§15 wants Resend's delivery and bounce webhooks in `envio_eventos`, with the
caveat that a bounce must not surface the address to a blinded viewer. That
caveat is the whole difficulty: `envio_eventos` is readable by the entire
committee, including people still blind to that submission, so a bounce
carrying `to` would be a back door into authorship opened by the inbox.

The route stores the event type and Resend's `email_id`, nothing else, and
finds the submission by matching the **folio in the subject** rather than the
recipient. Verified against a live signed request whose payload contained the
address twice — in `to` and inside `bounce.message`. Neither reached the log.

## Decisions made outside the spec

- **The signature verifier is twenty lines, not a dependency.** Svix signs
  `${id}.${timestamp}.${body}` with HMAC-SHA256. It lives in
  `src/lib/api/svix.ts` rather than inside the route so it can be tested — a
  broken verifier throws no error and logs nothing, it just accepts everything.
  Ten unit tests; making it fail open kills eight of them.
- **No secret means 503, not "skip verification".** An unverified webhook is an
  endpoint anyone can use to write into the committee's audit log.
- **A five-minute replay window.** Without it a captured request is valid
  forever.
- **The digest sends nothing when nothing is stuck.** A weekly mail that almost
  always says "all fine" is a mail nobody opens, and then the one that mattered
  goes unread too.
- **The digest carries folios and titles, never author names.** It goes to the
  whole committee, including people blind to those pieces.
- **The export is a route handler, not a server action.** What it returns is a
  file; an action would have to serialise the binary through React's protocol
  for the browser to reassemble it, when `Content-Disposition` already exists.
- **`overrides: { uuid: "^11.1.1" }`.** exceljs asks for uuid ^8, which carries
  an advisory about bounds checking in v3/v5/v6 when `buf` is passed. exceljs
  calls only `v4()` and never passes `buf`, so the vulnerable path is
  unreachable — but `v4` is API-identical in 11, so raising it is cheaper than
  documenting why it does not matter. `npm audit` is clean and the output was
  verified to still open in openpyxl.

## Gotchas / surprises

- **My own test fixtures were poisoning each other.** All three panel spec
  files created users named "Ana de Prueba", so `selectOption({ label })` could
  pick a *stale* user from another file's fixture; the assignment then belonged
  to someone else and the scorecard button never appeared. It looked exactly
  like an application bug. Names now carry the run's marker.
- **`desmonta` aborted on the first failing step**, leaving users behind — which
  is what made the above reachable. Each step is now wrapped so one failure
  cannot take the rest of the cleanup with it.
- **`page.request` shares the browser's cookies**, which is what lets the export
  test download an authenticated file without re-implementing login.
- **`eslint` insists on `<Link>` for internal hrefs**, including ones pointing
  at a route handler that returns a file. A client navigation would try to
  interpret the `.xlsx` as a page. Disabled on that line with the reason.
- **Playwright's `Buffer` and Node's `Buffer` are different types** to
  TypeScript, so exceljs refuses the response body directly; the underlying
  `ArrayBuffer` goes through fine.

## Deferred / follow-ups — these need an account or a deployment

Everything in `docs/operacion.md` §4 and §5. In short:

- **Alerting is not configured.** The structured logs it would consume are in
  place — every line carries route, request id and, once it exists, folio — and
  the runbook lists the exact patterns to alert on, starting with the one that
  cannot be missing: any 5xx on `POST /api/envios`. Wiring a log drain needs a
  Vercel deployment and a Sentry (or equivalent) account.
- **The Resend webhook has never received a real event.** The signature path is
  proven with a locally signed request and the privacy claim is proven against
  the real database, but the endpoint has never been registered with Resend
  because that needs a public URL.
- **The receipt email and the invitation flow still have not sent to anyone.**
  Unchanged since stages 4 and 5, and both blocked on the same thing: Resend on
  `onboarding@resend.dev` only delivers to the account owner, so production
  needs a verified domain.
- **Cutover is a written runbook, not a done thing.** DNS, TTL, the order of
  operations and the rollback are in `docs/operacion.md` §5. The redirect map
  itself has been in `next.config.ts` since stage 1 and is checked there.

## Open questions for review

- **Read time on the export's "Hoja de dictamen" column is a count, not a
  link.** The workbook had one row per submission pointing at its scorecard
  sheet; here there can be several scorecards and no sheet to point at, so the
  column says "2 dictamen(es)" and the puntaje column carries "12/15 · 11/15".
  If the committee wants the individual breakdown, that is a different layout
  and worth deciding before anyone builds habits on this one.
- **The digest's threshold for a stale draft is 14 days**, picked because it is
  a fortnight, not because anyone measured. Easy to change; someone should say
  what it ought to be.
- **`CONTEXT.md` was filled in this stage** and is now the binding glossary the
  project's CLAUDE.md assumes. It records four ambiguities that bit during the
  build — most importantly that "decisión" means two different things and that
  an artículo is not an envío. Worth a read from the committee's side: if their
  vocabulary differs, theirs wins and the code should follow.

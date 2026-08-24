# Implementation notes — Stage 5, the editorial panel

- **Spec**: `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md` §4.2, §5.4, §6.3, §7, §13
- **Started**: 2026-08-22

## The blinding is now proven through the UI, not just in SQL

Stage 3 proved the *policies* hold. That is a different claim from "no screen
leaks the author by another route", and only the second one is what the
committee actually relies on. `tests/panel/ceguera.spec.ts` drives a real
browser through the whole lifecycle:

1. Ana logs in, opens the submission, and cannot see the author — **including
   after assigning herself.** Being assigned is not a reason to see the author.
2. An incomplete scorecard is refused. This is what gives unblinding a price.
3. Ana submits her scorecard → Ana sees the author.
4. Beto, also assigned, still cannot. He can see that Ana's scorecard exists and
   what it scored; the unblind is per-person, not per-submission.
5. Ana records the decision → Beto sees the author too.
6. The queue never carries author fields, even for a decided submission.

The assertions search the entire page HTML for the author's name rather than a
selector, because the claim being tested is that it is nowhere.

## Two defects the browser suite found

- **"Pendiente de dictamen" was offered as a recordable decision.** It exists as
  a `decisiones` row because the engine needs something to point at before
  anything is scored — but it is not a verdict. Recording it would set
  `decision_id`, which unblinds the author to the entire committee and emails
  them that the decision on their manuscript is "pending". Now filtered out
  using `rubrica_versiones.etiqueta_pendiente`, so it stays available to the
  engine and invisible to the committee.
- **A submitted scorecard could still be edited.** Stage 3 made the transition
  to `enviado` irreversible and the answer tables were already protected by
  policies requiring `borrador`, but the `dictamenes` row itself was not:
  `comentarios` and the whole snapshot could be rewritten afterwards. That
  breaks §5.4's claim that the snapshot is what the committee saw on the day,
  and it makes unblinding cheap — submit anything, see the author, fix the card
  after. Frozen in `20260821140100_dictamen_congelado.sql`.

## Decisions made outside the spec

- **The panel lives outside `/[locale]` and is Spanish-only.** Putting it in the
  locale routing would mean several hundred new strings with no translation in
  five languages — the Spanish fallback that stage 2 accepts for 98 strings of
  the magazine, multiplied across an interface nobody outside the committee
  reads. It also keeps the panel entirely outside what the visual gate measures.
- **The browser still has no Supabase client, not even for auth.** Sign-in and
  sign-out are server actions; the only thing that reaches the browser is an
  httpOnly session cookie. `@supabase/ssr` refreshes the token in `proxy.ts`,
  because a server component cannot write cookies while rendering.
- **`proxy.ts` short-circuits `/panel` before next-intl sees it.** The two jobs
  do not compose: the public site resolves a locale and rewrites, the panel does
  neither.
- **Authorisation is checked per page (`exigePersonal()`), never in the layout.**
  A Next layout does not re-run on client navigation, so authorisation that
  lives in a layout is authorisation that may not run. It is convenience
  regardless — the real lock is RLS, which is why every server action re-checks
  independently instead of trusting that the page did.
- **Routing derivation moved from `crear_envio` into a trigger.** Level and
  instrument are derived from section and piece type. That lived inside
  `crear_envio`, which was fine while the section never changed — triage
  changes it. Two implementations of the same rule diverge, so
  `privado.deriva_enrutamiento()` is now the only one and `crear_envio` reads
  the result back. Consequence worth knowing: the triage form deliberately
  offers no level and no instrument. Letting staff pick the instrument by hand
  would let them pick how demanding a rubric this particular piece faces.
- **`candidatos_asignacion` is `SECURITY DEFINER` and reports no reasons.** It
  has to compare the author's email against staff institutional *and* alternate
  addresses, and whoever opens the assignment form cannot see that email. It
  returns id and name only. Saying "cannot assign Ana, her email matches" would
  turn the picker into an oracle: walk ten staff members and the one refusal
  identifies the author (§7.3).
- **Four panel operations are RPCs rather than two statements each.** Submitting
  a scorecard, recording a decision, marking anonymisation and linking a
  revision each reveal something, and each must land in `envio_eventos`. An
  `UPDATE` that succeeds beside an `INSERT` that fails leaves an unblinding with
  no record, which makes §7's accountability claim false. A function is a
  transaction. They are `SECURITY INVOKER`, so RLS still applies inside.
- **Signed download URLs are the one place the panel uses the service key.**
  `storage.objects` has RLS on and no policies, so a staff session cannot sign
  anything. The staff check replaces the policy. It does not break the blind:
  §7.2 says the manuscript file is visible while blinded — what is hidden is its
  *original filename*, which lives in `envio_archivo_nombres` behind the
  predicate.
- **Deactivating a staff member is `activo = false`, never a delete.** Deleting
  the row would cascade their assignments and scorecards, destroying the
  snapshot of what the committee saw. People leave; their scorecards stay.

## Gotchas / surprises

- **A successful action can take its own confirmation message with it.** After
  `revalidatePath`, the server component re-renders and the form may no longer
  exist — the assignment picker disappears when nobody is left to assign, the
  decision form is replaced by the recorded decision. Two Playwright assertions
  had to move from "the message appeared" to "the outcome is on the page",
  which is the better assertion anyway.
- **`create or replace function` with a new signature overloads rather than
  replaces**, and then the old call becomes ambiguous. Bit me twice now.
- **The generated `Database` type needs a real `Insert` per table**, not
  `Insert = Row`: otherwise inserting an assignment demands an `id` and an
  `asignado_at` that the database fills in. `Auto<R, K>` marks those optional.
  Nested `select("envios(autoria(*))")` still types as `never` because
  `Relationships` is `[]`, so the panel uses flat queries throughout.
- **Playwright transpiles test files to CommonJS**, where `import.meta` throws.
  The fixture resolves paths from `process.cwd()`.
- **Radio inputs styled as chips are `opacity: 0`** and Playwright refuses to
  click them. The test clicks the `<label>`, which is what a person does.

## Deferred / follow-ups

- **The invitation flow has never been run end to end.** `inviteUserByEmail`
  sends a real email, and the callback + password page are written but only
  reasoned about, not exercised. The Playwright fixture creates accounts through
  the admin API instead. First real invite will be the test.
- **No password reset.** Supabase can send the email; the link needs a panel
  route that does not exist yet. Right now a forgotten password means another
  invite.
- **The scorecard preview does not update as you type.** It recomputes on save.
  The engine is pure TypeScript and would run fine in the browser; it was left
  server-side to keep one implementation of the verdict.
- **`supabase/tests/*.sql` still have no runner** — now three suites.
- **Consensus is displayed, not computed.** §6.3 asks for disagreement to be
  flagged, which it is; there is no rule about what to do when two reviewers
  disagree, and the spec does not define one.

## Open questions for review

- **Anyone on the committee can record a decision on anything**, including a
  piece they never reviewed, and doing so unblinds the author for everyone. The
  spec accepts this as the cost of a single role, and it is logged with actor
  and timestamp — but the panel now makes it a two-click operation, which is
  more available than it was on paper. A second confirmation, or restricting it
  to submissions with at least one submitted scorecard, are both easy if the
  committee wants them.
- **`sin_conflicto` defaults to unchecked and blocks sending** until ticked.
  That is the only defence against co-authorship, which email matching cannot
  see. If reviewers find themselves ticking it reflexively it stops being a
  defence, and the alternative is asking authors to declare co-authors in a
  structured field.

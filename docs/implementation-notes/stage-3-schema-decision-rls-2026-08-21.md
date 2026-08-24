# Implementation notes — Stage 3, schema, decision engine, RLS

- **Spec**: `docs/superpowers/specs/2026-08-20-vertices-nextjs-supabase-design.md` §5, §6, §7, §13
- **Started**: 2026-08-21
- **Supabase project**: `kwfobjzvotyltxgnyagg`, Postgres 17.6

## The security bug this stage was designed to find, and found

The spec asks for the RLS suite *before* any panel UI, on the theory that a
security model you have not attacked is a security model you have not built.
On its very first run the suite failed on assertion #1: `anon` could
`select from public.envios` and got **zero rows instead of a permission error**.

Cause: Supabase's project bootstrap sets `ALTER DEFAULT PRIVILEGES … GRANT ALL
ON TABLES TO anon, authenticated, service_role` for the `public` schema. Every
table created in stages 3 onward was therefore born with `INSERT`, `UPDATE`,
`DELETE` and `TRUNCATE` granted to `anon` — including `envios_autoria`. RLS was
the only thing standing in the way.

RLS did hold. But spec §13 says "anonymous has **no INSERT** anywhere", and at
the privilege level that was simply false: one over-permissive policy in any
future migration and anonymous writes would have been open, with no second
line of defence. `20260821120700_privilegios_minimos.sql` revokes everything
from `anon`/`authenticated`, re-grants the exact minimum, and changes the
default privileges so future tables are born closed.

Worth knowing: the 2026-04-28 changelog entry, "tables not exposed to the Data
API automatically", is about PostgREST's exposed-schema config, **not** about
SQL grants. It is easy to read it as "new tables are closed now" — they are
not, at the privilege level.

## Decisions made outside the spec

- **Primary keys.** `uuid` where the spec says so — `envios` and its children,
  whose ids appear in panel URLs — and `bigint generated always as identity`
  for catalogs and rubrics. The Postgres skill warns against random UUIDv4 PKs
  because of index fragmentation; at this volume (dozens of pieces a year) that
  is irrelevant, but there is no reason not to use the standard where nothing
  argues against it.
- **Helper functions live in a `privado` schema, not `public`.** Postgres
  grants `EXECUTE` to `PUBLIC` on every new function, so a `SECURITY DEFINER`
  function in `public` is a public API endpoint. `privado.es_staff()` and
  `privado.puede_ver_autoria()` are `SECURITY DEFINER` on purpose — they must
  read `usuarios` and `dictamenes` without being caught by those tables' own
  policies — and `EXECUTE` is revoked from `public` and `anon`.
- **Server actions will run as the *user's* session, not service_role.** That
  is what makes the RLS suite meaningful: the policies are the enforcement, not
  a second opinion. `service_role` is reserved for `POST /api/envios`, which is
  genuinely anonymous. Consequence: `authenticated` needs real INSERT/UPDATE
  grants, and every one of them is paired with a policy.
- **Failure labels and "pending" are rows in `decisiones`.** A dictamen's
  snapshot points at a `decisiones` row whether the piece passed or failed, so
  the two failure labels and `Pendiente de dictamen` need to exist there —
  seven rows per instrument, not four.
- **The seed is generated, not typed.** `scripts/rubricas/generar-semillas.mjs`
  reads the workbook extraction and emits both the migration and the test
  fixture. 31 gates and 39 dimensions across eight instruments is too much to
  transcribe by hand when a silent typo changes an editorial verdict.
- **The engine mirrors the DB's N/A rule.** `decidir()` throws if a dimension
  without `permite_na` is scored `null`, matching the trigger. Belt and braces,
  and it makes the invariant unit-testable.

## How the seed is proven correct

Three independent checks, because "I transcribed the spreadsheet carefully" is
not a check:

1. **Σ(peso) × 3 equals the workbook's `T8`** for all eight instruments —
   15, 15, 15, 21, 18, 12, 12, 12. Computed in SQL from the seeded rows, not
   from the generator.
2. **Checksum agreement.** The generator hashes the canonical form of every
   instrument (labels, order, ★ flags, weights, thresholds) and Postgres
   computes the same hash over the seeded rows with `sha256`. Both give
   `6449ec3aa78d89bd`. So the test fixture and the live database are provably
   the same rubrics, and the unit tests are testing what is deployed.
3. **Mutation testing of the engine.** Four deliberate breaks — unscored
   critical treated as passing, absent gate treated as passing, `>` instead of
   `>=` in the band lookup, weight dropped from the maximum — produced 14, 34,
   29 and 10 failures respectively. A 205-test matrix that passes on the first
   run deserves that check before it is believed.

## Gotchas / surprises

- **`SET LOCAL ROLE authenticated` plus `request.jwt.claims` is enough to test
  RLS properly.** `authenticated` has no `BYPASSRLS`, so the policies are
  genuinely enforced; this is the model, not a simulation of it. It does *not*
  cover PostgREST or API-key plumbing — see the follow-up below.
- **Minimal `auth.users` rows can be inserted directly** for tests
  (id, instance_id, aud, role, email, empty encrypted_password, timestamps).
  No admin API needed.
- **An RLS `WITH CHECK` violation raises `insufficient_privilege` (42501)**,
  not `check_violation`. Relevant when writing assertions that distinguish
  "policy refused" from "constraint refused".
- **A blocked `UPDATE` is not an error.** RLS makes it affect zero rows, so the
  assertion has to be on `FOUND`, not on an exception. That is also why the
  spec insists UPDATE policies carry both `USING` and `WITH CHECK`: without the
  latter a reviewer could reassign a row to someone else.
- **`envio_folios` deliberately has RLS on and no policy**, so the Supabase
  linter reports `rls_enabled_no_policy` as INFO. That is the intent: deny
  everyone except roles that bypass RLS. Do not "fix" it by adding a policy.
- **The composite foreign key `dictamenes(envio_id, revisor_id) →
  asignaciones` does real work.** Without it any staff member could open a
  scorecard on any submission purely to unblind themselves, and the
  completeness trigger would be the only cost. The suite asserts it.

## Deferred / follow-ups

- **End-to-end PostgREST assertions need the service-role key**, which I do not
  have. The suite proves the policies; it does not prove the HTTP layer applies
  them with a real JWT. Add that in stage 4, when the key is configured, by
  signing in as a seeded staff user and hitting `/rest/v1/envios_autoria`
  directly.
- **`supabase/tests/rls.sql` has no runner yet.** It is run by pasting into
  `execute_sql` or `psql`. Wire it into `npm test` once the CLI has a database
  URL.
- **Storage buckets are not created yet** (spec §9 wants a private bucket and a
  public one). That is stage 4's first task.
- The RLS suite does not yet cover `articulos`/`ediciones` publication
  visibility for `anon`; those policies exist but are asserted only indirectly.
  Stage 6 should extend the suite rather than trust them.

## Open questions for review

- **`revoke all … from authenticated` also removed privileges the Supabase
  dashboard's table editor relies on** for the `anon`/`authenticated` roles.
  The dashboard uses its own privileged connection so it still works, but any
  tooling that authenticates as `authenticated` will now see much less. That is
  the point, and worth knowing before someone reports it as a bug.
- **One staff role, as the spec accepts.** The suite makes the residual risk
  concrete: any staff member can record a `decision_id`, and that unblinds the
  submission for the whole committee. It is logged with actor and timestamp,
  but it is not prevented. Revisit if the committee grows.

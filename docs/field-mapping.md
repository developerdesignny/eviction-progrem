# Field Mapping — AllEVICTIONS.csv → App Schema

Source: `AllEVICTIONS.csv` (120 columns, 3 sample records). Column order in Airtable is NOT logical/chronological — fields get appended at the end as they're created, so intake-looking fields (Floor Number, Apartment/Unit#) appear after "Intake Done", and near-duplicate fields exist (Airtable churn). This doc is a first-pass grouping; items marked ❓ still need your confirmation.

Evictions Type values seen: `NP` (non-payment), `Holdover` — confirms our two project types.
`Stage` field values seen: `testing`, `Day before court Date`, `Billing` — this looks like a free-text/legacy status field, not a clean stage list. We will replace it with our own `ProjectStage` model.

## Implementation status

**Built.** Section A (the 29 intake fields) is implemented as fixed columns on `Project` in
`prisma/schema.prisma`, rendered by `src/client/components/IntakePanel.tsx`, and typed in
`src/shared/types.ts` (`IntakeDto`). The subset that drives `intakeDone` is
`CORE_INTAKE_FIELDS` in that same file — see "Intake Done — core fields" in `requirements.md`.

**Sections B–H are reference only and are not in the database.** Nothing from the legacy
Airtable task list is seeded: `StageDefinition` and `FieldDefinition` start empty, and the real
stage list is built by hand in the Configuration screen. Keep these sections as a checklist of
what the old base tracked when building those stages out — they are history, not a spec.

## Decisions confirmed so far

Mockup approved — `docs/mockup.html`, 4 screens (Login, Projects dashboard, Project Detail, Config). Superseded by the real app; kept as the visual reference, and its design tokens live on in `src/client/styles.css`.

**Product / schema decisions**

- **Duplicate task fields** ("Email language" ×8, "Fill out the GCE Correctly" ×3) — not collapsed in the data model. Since fields/tasks are admin-configurable per stage, you'll just add the ones you want per stage yourself. No special-casing needed in schema.
- **Contact model** — a `Contacts` table (Name/Phone/Email/etc., more fields to grow over time). A Project links to: **Landlord/Owner** (full contact record), **Tenant(s) on Lease** (linked to the same table, name-only exposed), **Occupants 18+ Not on Lease** (linked, name-only exposed). Confirmed twice — replaces the old flat text fields for tenants/occupants. Mocked as removable/addable chips in the intake panel.
- **Stage flow** — stages are independent, parallel checklists, not a locked sequential pipeline. A project can have several stages in progress at once; dashboard shows all stages side-by-side with done/not-done state (see the segmented progress bar in the mockup's project list).
- **Editing a linked contact swaps the link, not the contact's own data** — in edit mode, Landlord/Owner shows the same rich contact card (with a remove ×) plus a search field to link a different contact. It does not expose phone/email as editable inputs inline — those live on the contact record itself, edited elsewhere.
- **File/Attachment is a real field type** — "Lease Agreement Attached" and "Property Management Agreement Attached" are file uploads (the actual document), not just confirmation checkboxes. Added to the field-type list in `requirements.md`.
- **Closing a project requires a reason** — "Close Project" button opens a modal: pick a preset reason (Balance paid in full / Tenant vacated / Case dismissed / Settled outside of court / Other) and/or free-text detail; confirm is disabled until a reason is given. This is the real-schema version of the old `Close` + `Closed Reason` fields (see Section G below).

**Mockup UI behavior**

- **Intake panel is collapsible** — header has a chevron toggle; collapsed state shows a one-line summary ("29 fields · 27 complete") instead of the full 5-group layout.
- **Stage cards collapse/expand** — in Project Detail, each stage card header is clickable (chevron toggle). Fully-complete stages (Intake 6/6, Verification 5/5) start collapsed by default; incomplete stages start expanded so what's outstanding is visible at a glance.
- **Configuration screen now lists all 29 real intake fields** — was showing a stale 5-field placeholder that didn't include Property fields (this is why "Property Management Agreement Attached" wasn't visible — it existed in the Project Detail intake panel but had never been added to the admin Config mock). Fixed; grouped the same way as this doc, with a new `Link` type badge for the three contact-relationship fields and a `File` badge for the two attachment fields.

**Mockup bug fixes**

- **Checkbox visibility** — the intake panel's checkboxes (and "Intake Done") had no shared border/size rule and were nearly invisible. Now all checkboxes share one style with a visible border, hover ring, and green fill when checked (view-mode checkboxes stay dimmed/disabled, as intended).
- **Field labels were too light** — intake field labels (`.ifield .k`), section headers (Contacts/Case & Lease/Property/etc.), Config screen subheads, contact-modal labels, and docket numbers were all using the faintest text color (below-AA contrast). Bumped to a darker, bolder tone; kept the faint tone only for genuinely decorative text (icons, placeholders, empty states).
- **Collapsed stage card outer box** — the stage grid used CSS Grid's default `stretch`, so a collapsed card's outer box still stretched to match its taller row-neighbors, leaving empty space. Grid now uses `align-items: start` so each card sizes to its own (collapsed or expanded) content.

## A. Intake fields (29 total)

Everything filled out when a project is created, up through "Intake Done."

**Contacts (3 relationships — not plain text)**

| Field | Type |
|---|---|
| Landlord / Owner | Linked contact (full: name, phone, email) |
| Tenant(s) on Lease | Linked contact(s), name-only |
| Occupants 18+ Not on Lease | Linked contact(s), name-only |

**Case & Lease (6)**

| Field | Type |
|---|---|
| Tenancy Start Date | Date |
| Length of Tenancy | Text |
| Monthly Rent Amount | Currency |
| Total Rent Balance Owed | Currency |
| Lease Agreement Attached | **File upload** (the actual document, not just a confirmation checkbox) |
| Ledger Attached | Checkbox |

**Property (10)**

| Field | Type |
|---|---|
| Property Street Address | Text |
| Apartment/Unit # | Text |
| Floor Number | Text |
| Property City | Text |
| Property State | Text |
| Property Zip | Text |
| Property Management Agreement Attached | **File upload** (the actual document, not just a confirmation checkbox) |
| Property Access: Straightforward | Checkbox |
| Additional Property Access Instructions | Text |
| Active Rental Permit (Albany/Newburgh/Syracuse) | Checkbox |

**Submitted By (6)**

| Field | Type |
|---|---|
| Submitted By (Name) | Text |
| Submitted By (Title) | Text |
| Submitted By (Company) | Text |
| Submitted By (Phone) | Text |
| Submitted By (Email) | Text |
| Submitted By (Date) | Date |

**Case flags & type (3)**

| Field | Type |
|---|---|
| Marked Personal and Confidential | Checkbox |
| Entry Point | Select: Front / Back / Side / Right / Left — **resolved**: physical entry point to the property, not a referral source |
| Evictions Type | Select: NP / Holdover — this **is** the ProjectType |

**Boundary marker (1)**

| Field | Type |
|---|---|
| Intake Done | Checkbox — marks intake stage complete |

**Sections B–H below are historical reference only** — legacy Airtable task names, kept for context. None of it is seeded into the DB: stages and their fields are fully admin-configurable (per requirements.md item 4–5) and start empty. You add the real stages/fields yourself via the Config screen. This also makes the two open duplicate-field questions below moot (nothing gets auto-imported, so there's nothing to de-duplicate).

## B. Verification stage (sub-tasks, all before "Verification Done")

- Verify the address • Google Map
- Verify in which City/Town/Village Imo / Tax
- Verify if rent amount owned
- Verify if any more occupants over 18
- add the rent owed / ask for ledger
- add occupant not listed on the lease above 18
- list occupant above 18 including not listed on lease
- Search in which county
- Owner name to records • Imo / Tax
- **Verification Done** (stage-complete marker)

## C. Notice preparation & service — ❓ needs your confirmation on grouping

**NP-specific** (5-Day Notice track):
- Print all certified mail of 5 day notice
- 5 Day Notice & certified mail
- 5-Day Done
- 5–14 Day Notice & GCEN Done

**Holdover-specific** (14/30/60/90-Day Notice of Termination track):
- Fill out the GCE Correctly N.O.T.
- send to landlord for review & signatures N.O.T.
- Send to Server N.O.T.
- Put the court date in the Calendar add Attorney & SD N.O.T.
- Email language → 14 days / N.O.T. (several near-duplicate fields)
- Email landlord Termination was served
- Email landlord 14 Day notice was served
- Date it was served / Date Termination Finishes / Date 14 day notice Ends
- Ask the attorney for a Court date min. 30 days after 14 days served
- 30/60/90 Notice of Termination Done
- 30/60/90 Notice of Termination & Original Affidavit
- 30/60/90 Notice Served Done
- 14-Day Notice Served Done
- 14 Day notice, GCE & Original Affidavit
- 14 Day Notice & GCEN Done

**Shared:**
- Prepare the notice(s)
- attach affidavit to file N.S.
- Send out to certified & regular mail for each tenant separately

## D. Petition / NOP / GCEN filing — ❓ needs your confirmation

- Fill out the GCE Correctly (general) / P&G NP (NP variant)
- send Petition to landlord to be notarized & GCEN for signature
- Request Notice of Petition from Attorney
- Get Back Petition from Attorney NP
- get original petition and save to folder
- get original NOP and save to folder
- Set a new computer folder name, add a subfolder Landlord documents
- Send to Server the NOP, Petition, GCEN & attach the 14 day Notice with Affidavits (NP variant)
- Send to Server the NOP, Petition, GCEN & attach the Termination Notice with Affidavit (Holdover variant)
- Send to Server (general)
- Original NOP, Petition, GCEN & Original Affidavit (appears **twice**, identical label — ❓ duplicate field, or NP vs Holdover copies?)
- original Affidavit to folder
- Original Affidavit to the folder
- Original Affidavit to the folder at NOP & Petition Served
- attach Affidavit to file at NOP & Petition Served
- combine & scan to file
- Save to file
- Petition & GCEN (NP) Done
- Petition & GCEN (Holdover) Done
- Petition, GCEN & NOP Done
- Notice of Petition Done
- NOP & Petition Served Done
- Update the Attorney with this Info & request Petition

## E. Court date prep

- Put the court date in the Calendar add Attorney & SD (+ N.O.T. variant)
- email the attorney to confirm the court date
- Check Court fee
- Prepare envelope for court Done
- Prepare FedEx label
- Attorneys signature and Date
- Attach affidavit to file

## F. Billing / payment

- send out the invoice
- Create an invoice
- receive payment 1 / receive payment 2
- Increase or decrease balance based on the transaction
- Billing Done

## G. Closing — resolved

- Close (checkbox — project complete) → **now a "Close Project" action, not a checkbox**, since it requires a reason to complete.
- Closed Reason → **required**: preset dropdown (Balance paid in full / Tenant vacated / Case dismissed / Settled outside of court / Other) + optional free-text detail. Confirm button disabled until a reason is provided.

## H. Computed / not user-entered (skip — derived from linked Contact record)

- Phone Number Rollup (from Contact)
- Email Rollup (from Contact)
- Contact Name
- Contact

## I. Legal/config flags (possibly per-municipality settings, not per-project?)

- ← If the Municipality adopt the ETPA ❓
- ← If the Municipality adapt the GCE law ❓

**Not implemented, and no special modeling planned.** There is no municipality table. If these
need tracking per case, add them as Checkbox fields on whichever stage they belong to — that is
what the configurable field engine is for. Only revisit if you want them to *drive* behavior
(e.g. auto-selecting a notice track), which would need a real municipality lookup.

## Duplicate/near-duplicate fields — resolved

- "Email language" family (~8 near-identical fields) and "Fill out the GCE Correctly" (3 variants) — **resolved**: not collapsed, admin adds these per stage as needed (see Decisions above).
- "Original NOP, Petiton, GCEN & Original Affidavit" (listed twice) and "Prepare the notice" vs "Prepare the notices" — **resolved**: moot. Sections B–H are historical reference only and are not seeded into the DB (see note above); you add real stage fields yourself, so there's nothing to de-duplicate.

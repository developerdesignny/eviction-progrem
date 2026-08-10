# DB Schema — Confirmed

Prisma schema for PostgreSQL. Reflects all decisions from `requirements.md` and `field-mapping.md`.

## Design decisions

- **Intake fields (Section A of `field-mapping.md`) are fixed columns on `Project`** — not part of the dynamic field-config engine, since the intake form's 29 fields are the same for every project (unlike stage fields, which are admin-configurable).
- **Stages and stage fields are fully dynamic** — `StageDefinition` / `FieldDefinition` start empty. Nothing from the legacy Airtable task list (sections B–H in `field-mapping.md`) is seeded; the admin builds the real stage list via the Config screen.
- **Entry Point** is a physical property entry point (Front/Back/Side/Right/Left), not a referral source — modeled as an enum.
- **Files are stored as `bytea` blobs directly in Postgres** (`FileAttachment.data`) — no separate object storage service. Fine at this app's document volume; backed up with the DB.
- **Single org/firm for now** — no `Organization` table. Multi-tenant support may be added later (`Organization` + `orgId` scoping on `User`/`Project`/`Contact`) but isn't built in yet.
- **`FieldValue` uses typed nullable columns** (text/date/bool/numeric/file) rather than a single JSON column, so Postgres can still enforce/query types per field.
- **Intake is not a stage** — no `StageDefinition` named "Intake" exists. Intake lives entirely in the fixed columns below plus `intakeDone`, and is excluded from the stage grid, progress bar, and Config screen.
- **Only `type` is required to create a project** — every other column is nullable and filled in over time. `type` is mandatory because the stage set hangs off it.
- **`intakeDone` is computed**, not user-toggled: true when the core intake subset is filled (see "Intake Done — core fields" in `requirements.md`). Intake checkboxes never count toward it — an unchecked box there is a valid answer, unlike a required stage checkbox.
- **Two identifiers on a project** — `caseNumber` is auto-generated (`EV-<year>-<4-digit sequence>`, unique, immutable, allocated from `CaseCounter` inside the create transaction); `docketNumber` is the optional court-assigned number, entered by hand later. Both are searchable.
- **Nothing is ever deleted, anywhere** — no model exposes a delete path. `StageDefinition.hidden`, `FieldDefinition.hidden` and `Contact.hidden` replace deletion so historical values survive; `User.active` replaces user deletion; projects have only `closedAt`. Because nothing is removed, no relation needs `onDelete: Cascade`. Reopening never happens automatically but is available as a manual action, which clears `closedAt`/`closeReason`/`closeReasonDetail`.
- **Hidden is only hidden where empty** — a hidden `FieldDefinition` is still rendered read-only on any `ProjectStage` that already holds a `FieldValue` for it; it is omitted where no value exists. Same rule for a hidden `StageDefinition` (shown if any of its fields hold values on that project). Hidden-and-empty fields are excluded from stage-completion math.
- **Stage completion is derived, not manual** — `ProjectStage.completed` is recomputed on every value write: true when all *required* visible fields hold a value (Checkbox required ⇒ must be `true`), or, when a stage has no required fields, when all visible fields are filled. A stage with no visible fields falls back to a manual toggle. Clearing a value flips it back and nulls `completedAt`.
- **Stage reconciliation** — on load/save of an **open** project, a `ProjectStage` row is created for every non-hidden `StageDefinition` matching the project's `type` that it doesn't already have. Closed projects are skipped, so they keep the stage set they had at close; reopening resumes reconciliation.
- **Changing `Project.type`** keeps old-type `ProjectStage` rows and their `FieldValue`s in the database; they're filtered out of the project view because their `StageDefinition.projectType` no longer matches.

## Schema

> **The live schema is `prisma/schema.prisma`** — that file is authoritative and is what
> migrations are generated from. The listing below mirrors it for reading convenience;
> if the two ever disagree, the `.prisma` file wins. The live file additionally carries
> `@@index` declarations (case lookups, contact name search, stage ordering) and
> `@db.Decimal(12, 2)` precision on the money columns, both omitted here for readability.

```prisma
enum ProjectType { NP HOLDOVER }
enum CloseReason { BALANCE_PAID_IN_FULL TENANT_VACATED CASE_DISMISSED SETTLED_OUTSIDE_COURT OTHER }
enum ContactRole { TENANT OCCUPANT }
enum FieldType { TEXT DATE CHECKBOX CURRENCY SELECT FILE }
enum EntryPoint { FRONT BACK SIDE RIGHT LEFT }
enum StatusEvent { CLOSED REOPENED }

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   // bcrypt
  active       Boolean  @default(true) // deactivated instead of deleted
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// allocates the per-year project case number sequence
model CaseCounter {
  year       Int @id
  lastNumber Int @default(0)
}

model Contact {
  id        String   @id @default(uuid())
  name      String
  phone     String?
  email     String?
  address   String?
  notes     String?
  hidden    Boolean  @default(false) // never deleted; hidden = unsearchable + unlinkable
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  landlordProjects Project[]        @relation("LandlordContact")
  projectLinks     ProjectContact[]
}

// join table for Tenant(s) on Lease / Occupant(s) 18+ Not on Lease
model ProjectContact {
  id        String      @id @default(uuid())
  projectId String
  project   Project     @relation(fields: [projectId], references: [id])
  contactId String
  contact   Contact     @relation(fields: [contactId], references: [id])
  role      ContactRole

  @@unique([projectId, contactId, role])
}

model Project {
  id           String      @id @default(uuid())
  caseNumber   String      @unique // auto: EV-2026-0001, per-year sequence
  docketNumber String?             // court-assigned, entered manually later
  type         ProjectType

  landlordContactId String?
  landlordContact   Contact?         @relation("LandlordContact", fields: [landlordContactId], references: [id])
  contactLinks      ProjectContact[]

  // --- Intake (fixed 29-field form, Section A of field-mapping.md) ---
  tenancyStartDate              DateTime?
  lengthOfTenancy                String?
  monthlyRentAmount              Decimal?
  totalRentBalanceOwed           Decimal?
  leaseAgreementFileId           String?
  leaseAgreementFile             FileAttachment? @relation("LeaseAgreement", fields: [leaseAgreementFileId], references: [id])
  ledgerAttached                  Boolean @default(false)

  propertyStreetAddress          String?
  apartmentUnitNumber            String?
  floorNumber                     String?
  propertyCity                    String?
  propertyState                   String?
  propertyZip                     String?
  propMgmtAgreementFileId        String?
  propMgmtAgreementFile          FileAttachment? @relation("PropMgmtAgreement", fields: [propMgmtAgreementFileId], references: [id])
  propertyAccessStraightforward  Boolean @default(false)
  additionalAccessInstructions   String?
  activeRentalPermit              Boolean @default(false)

  submittedByName     String?
  submittedByTitle    String?
  submittedByCompany  String?
  submittedByPhone    String?
  submittedByEmail    String?
  submittedByDate     DateTime?

  markedPersonalConfidential Boolean     @default(false)
  entryPoint                  EntryPoint?
  // Evictions Type == `type` field above

  intakeDone Boolean @default(false)

  // --- Stages (dynamic, admin-configured, empty until built in Config) ---
  stages ProjectStage[]

  // --- Close (no delete; reopen is manual-only, from the Archive screen) ---
  closedAt          DateTime?
  closeReason       CloseReason?
  closeReasonDetail String?
  statusEvents      ProjectStatusEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model StageDefinition {
  id            String            @id @default(uuid())
  projectType   ProjectType
  name          String
  sortOrder     Int
  hidden        Boolean           @default(false) // hide instead of delete — preserves saved values
  fields        FieldDefinition[]
  projectStages ProjectStage[]
}

model FieldDefinition {
  id                String    @id @default(uuid())
  stageDefinitionId String
  stageDefinition   StageDefinition @relation(fields: [stageDefinitionId], references: [id])
  label             String
  type              FieldType
  options           Json?     // choices, for SELECT type
  required          Boolean   @default(false)
  sortOrder         Int
  hidden            Boolean   @default(false) // hide instead of delete — preserves saved values
  values            FieldValue[]
}

model ProjectStage {
  id                String    @id @default(uuid())
  projectId         String
  project           Project   @relation(fields: [projectId], references: [id])
  stageDefinitionId String
  stageDefinition   StageDefinition @relation(fields: [stageDefinitionId], references: [id])
  completed         Boolean   @default(false)
  completedAt       DateTime?
  fieldValues       FieldValue[]

  @@unique([projectId, stageDefinitionId])
}

model FieldValue {
  id                String    @id @default(uuid())
  updatedAt         DateTime  @updatedAt
  projectStageId    String
  projectStage      ProjectStage    @relation(fields: [projectStageId], references: [id])
  fieldDefinitionId String
  fieldDefinition   FieldDefinition @relation(fields: [fieldDefinitionId], references: [id])

  textValue    String?
  dateValue    DateTime?
  boolValue    Boolean?
  numericValue Decimal?
  fileId       String?
  file         FileAttachment? @relation(fields: [fileId], references: [id])

  @@unique([projectStageId, fieldDefinitionId])
}

// audit trail of every close / reopen, so repeat closures keep their history
model ProjectStatusEvent {
  id           String       @id @default(uuid())
  projectId    String
  project      Project      @relation(fields: [projectId], references: [id])
  event        StatusEvent
  reason       CloseReason? // set on CLOSED
  reasonDetail String?
  userId       String?
  at           DateTime     @default(now())
}

model FileAttachment {
  id         String   @id @default(uuid())
  filename   String
  mimeType   String
  size       Int      // bytes, so the UI can show a size without loading the blob
  data       Bytes    // file content stored directly in Postgres
  uploadedAt DateTime @default(now())

  leaseFor    Project[]    @relation("LeaseAgreement")
  propMgmtFor Project[]    @relation("PropMgmtAgreement")
  fieldValues FieldValue[]
}
```

## Where each rule is implemented

The behavioral decisions above are not spread through the route handlers — each lives in
one module, so changing a rule means editing one file.

| Rule | Code |
|---|---|
| Case number allocation (per-year sequence, inside the create transaction) | `src/server/services/caseNumber.ts` |
| Stage completion + `intakeDone` (what counts as "filled") | `src/server/services/completion.ts` |
| Stage reconciliation, completion persistence | `src/server/services/reconcile.ts` |
| Hidden-where-empty filtering, old-type stage filtering, DTO shaping | `src/server/services/projectView.ts` |
| Core intake field list | `src/shared/types.ts` → `CORE_INTAKE_FIELDS` |
| Upload size cap and MIME allowlist | `src/shared/types.ts` → `MAX_UPLOAD_BYTES`, `ALLOWED_UPLOAD_MIME` |
| Which database (local vs hosted), startup migration, first user | `src/server/env.ts`, `src/server/bootstrap.ts` |

## Status
Confirmed and implemented. `prisma/schema.prisma` is in place; run `npm run prisma:migrate`
to generate the initial migration. No open schema questions.

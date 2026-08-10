import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { nextCaseNumber } from '../services/caseNumber';
import { computeIntakeDone } from '../services/completion';
import { reconcileStages, recomputeStageCompletion } from '../services/reconcile';
import { projectInclude, toProjectDetail, toProjectListItem } from '../services/projectView';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectTypeSchema = z.enum(['NP', 'HOLDOVER']);
const entryPointSchema = z.enum(['FRONT', 'BACK', 'SIDE', 'RIGHT', 'LEFT']);
const closeReasonSchema = z.enum([
  'BALANCE_PAID_IN_FULL',
  'TENANT_VACATED',
  'CASE_DISMISSED',
  'SETTLED_OUTSIDE_COURT',
  'OTHER',
]);

const nullableDate = z
  .union([z.string(), z.null()])
  .transform((v) => (v ? new Date(v) : null))
  .optional();

const nullableDecimal = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null || v === '' ? null : new Prisma.Decimal(v)))
  .optional();

const nullableText = z
  .union([z.string(), z.null()])
  .transform((v) => (v === null || v.trim() === '' ? null : v))
  .optional();

/** Every intake field is optional — only `type` is required to create a project. */
const intakeSchema = z.object({
  docketNumber: nullableText,
  type: projectTypeSchema.optional(),

  tenancyStartDate: nullableDate,
  lengthOfTenancy: nullableText,
  monthlyRentAmount: nullableDecimal,
  totalRentBalanceOwed: nullableDecimal,
  leaseAgreementFileId: nullableText,
  ledgerAttached: z.boolean().optional(),

  propertyStreetAddress: nullableText,
  apartmentUnitNumber: nullableText,
  floorNumber: nullableText,
  propertyCity: nullableText,
  propertyState: nullableText,
  propertyZip: nullableText,
  propMgmtAgreementFileId: nullableText,
  propertyAccessStraightforward: z.boolean().optional(),
  additionalAccessInstructions: nullableText,
  activeRentalPermit: z.boolean().optional(),

  submittedByName: nullableText,
  submittedByTitle: nullableText,
  submittedByCompany: nullableText,
  submittedByPhone: nullableText,
  submittedByEmail: nullableText,
  submittedByDate: nullableDate,

  markedPersonalConfidential: z.boolean().optional(),
  entryPoint: z.union([entryPointSchema, z.null()]).optional(),
  landlordContactId: nullableText,
});

/** Recomputes and persists `intakeDone` from the core field subset. */
async function refreshIntakeDone(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { contactLinks: { select: { role: true } } },
  });
  if (!project) return;

  const done = computeIntakeDone(project);
  if (done !== project.intakeDone) {
    await prisma.project.update({ where: { id: projectId }, data: { intakeDone: done } });
  }
}

projectsRouter.get('/', async (req, res) => {
  const status = String(req.query.status ?? 'open');
  const search = String(req.query.search ?? '').trim();
  const type = projectTypeSchema.safeParse(req.query.type);

  const where: Prisma.ProjectWhereInput = {
    ...(status === 'open' ? { closedAt: null } : {}),
    ...(status === 'closed' ? { NOT: { closedAt: null } } : {}),
    ...(type.success ? { type: type.data } : {}),
    ...(search
      ? {
          OR: [
            { caseNumber: { contains: search, mode: 'insensitive' } },
            { docketNumber: { contains: search, mode: 'insensitive' } },
            { propertyStreetAddress: { contains: search, mode: 'insensitive' } },
            { propertyCity: { contains: search, mode: 'insensitive' } },
            { landlordContact: { name: { contains: search, mode: 'insensitive' } } },
            { contactLinks: { some: { contact: { name: { contains: search, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  };

  const projects = await prisma.project.findMany({
    where,
    include: projectInclude,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(projects.map(toProjectListItem));
});

projectsRouter.post('/', async (req, res) => {
  const parsed = intakeSchema.extend({ type: projectTypeSchema }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Project type is required (NP or Holdover)' });
  }

  const project = await prisma.$transaction(async (tx) => {
    const caseNumber = await nextCaseNumber(tx);
    return tx.project.create({ data: { ...parsed.data, caseNumber } });
  });

  await reconcileStages(project.id);
  await refreshIntakeDone(project.id);

  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: projectInclude,
  });
  res.status(201).json(toProjectDetail(full!));
});

projectsRouter.get('/:id', async (req, res) => {
  // Stages mirror the configuration — reconcile on the way in.
  await reconcileStages(req.params.id);

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: projectInclude,
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(toProjectDetail(project));
});

projectsRouter.patch('/:id', async (req, res) => {
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid intake data' });
  }

  await prisma.project.update({ where: { id: req.params.id }, data: parsed.data });

  // A type change swaps in the new type's stages; the old ones stay in the database
  // and are filtered out of the view unless they already hold values.
  await reconcileStages(req.params.id);
  await refreshIntakeDone(req.params.id);

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: projectInclude,
  });
  res.json(toProjectDetail(project!));
});

/** Link an existing contact as tenant or occupant. */
projectsRouter.post('/:id/contacts', async (req, res) => {
  const parsed = z
    .object({ contactId: z.string().uuid(), role: z.enum(['TENANT', 'OCCUPANT']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Contact and role are required' });

  const contact = await prisma.contact.findUnique({ where: { id: parsed.data.contactId } });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  if (contact.hidden) {
    return res.status(400).json({ error: 'That contact is hidden and cannot be linked' });
  }

  await prisma.projectContact.upsert({
    where: {
      projectId_contactId_role: {
        projectId: req.params.id,
        contactId: parsed.data.contactId,
        role: parsed.data.role,
      },
    },
    create: { projectId: req.params.id, ...parsed.data },
    update: {},
  });

  await refreshIntakeDone(req.params.id);
  res.json({ ok: true });
});

/** Unlinks a contact from this case. The contact record itself is untouched. */
projectsRouter.delete('/:id/contacts/:contactId/:role', async (req, res) => {
  const role = z.enum(['TENANT', 'OCCUPANT']).safeParse(req.params.role);
  if (!role.success) return res.status(400).json({ error: 'Invalid role' });

  await prisma.projectContact.deleteMany({
    where: { projectId: req.params.id, contactId: req.params.contactId, role: role.data },
  });
  await refreshIntakeDone(req.params.id);
  res.json({ ok: true });
});

const valueSchema = z.object({
  textValue: z.string().nullish(),
  dateValue: z.string().nullish(),
  boolValue: z.boolean().nullish(),
  numericValue: z.union([z.string(), z.number()]).nullish(),
  fileId: z.string().nullish(),
});

/** Sets one stage field value, then recomputes whether the stage is complete. */
projectsRouter.put('/:id/stages/:stageId/fields/:fieldId', async (req, res) => {
  const parsed = valueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid value' });

  const stage = await prisma.projectStage.findFirst({
    where: { id: req.params.stageId, projectId: req.params.id },
    include: { stageDefinition: true },
  });
  if (!stage) return res.status(404).json({ error: 'Stage not found on this project' });

  const field = await prisma.fieldDefinition.findUnique({ where: { id: req.params.fieldId } });
  if (!field || field.stageDefinitionId !== stage.stageDefinitionId) {
    return res.status(404).json({ error: 'Field not found on this stage' });
  }
  // Hidden fields still render where they hold a value, but they are read-only.
  if (field.hidden || stage.stageDefinition.hidden) {
    return res.status(400).json({ error: 'That field is hidden and can no longer be edited' });
  }

  const data = {
    textValue: parsed.data.textValue ?? null,
    dateValue: parsed.data.dateValue ? new Date(parsed.data.dateValue) : null,
    boolValue: parsed.data.boolValue ?? null,
    numericValue:
      parsed.data.numericValue === null || parsed.data.numericValue === undefined || parsed.data.numericValue === ''
        ? null
        : new Prisma.Decimal(parsed.data.numericValue),
    fileId: parsed.data.fileId ?? null,
  };

  await prisma.fieldValue.upsert({
    where: {
      projectStageId_fieldDefinitionId: {
        projectStageId: stage.id,
        fieldDefinitionId: field.id,
      },
    },
    create: { projectStageId: stage.id, fieldDefinitionId: field.id, ...data },
    update: data,
  });

  await recomputeStageCompletion(stage.id);

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: projectInclude,
  });
  res.json(toProjectDetail(project!));
});

/** Manual completion toggle — only meaningful for a stage with no visible fields. */
projectsRouter.post('/:id/stages/:stageId/complete', async (req, res) => {
  const parsed = z.object({ completed: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const stage = await prisma.projectStage.findFirst({
    where: { id: req.params.stageId, projectId: req.params.id },
    include: { stageDefinition: { include: { fields: true } }, fieldValues: true },
  });
  if (!stage) return res.status(404).json({ error: 'Stage not found on this project' });

  const visible = stage.stageDefinition.fields.filter((f) => !f.hidden);
  if (visible.length > 0) {
    return res
      .status(400)
      .json({ error: 'This stage completes automatically from its fields' });
  }

  await prisma.projectStage.update({
    where: { id: stage.id },
    data: {
      completed: parsed.data.completed,
      completedAt: parsed.data.completed ? new Date() : null,
    },
  });
  res.json({ ok: true });
});

projectsRouter.post('/:id/close', async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ reason: closeReasonSchema, detail: z.string().nullish() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A close reason is required' });

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.closedAt) return res.status(400).json({ error: 'Project is already closed' });

  await prisma.$transaction([
    prisma.project.update({
      where: { id: req.params.id },
      data: {
        closedAt: new Date(),
        closeReason: parsed.data.reason,
        closeReasonDetail: parsed.data.detail || null,
      },
    }),
    prisma.projectStatusEvent.create({
      data: {
        projectId: req.params.id,
        event: 'CLOSED',
        reason: parsed.data.reason,
        reasonDetail: parsed.data.detail || null,
        userId: req.user?.id,
      },
    }),
  ]);

  res.json({ ok: true });
});

/** Manual only — nothing reopens a project on its own. */
projectsRouter.post('/:id/reopen', async (req: AuthedRequest, res) => {
  const detail = z.string().nullish().safeParse(req.body?.detail);

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.closedAt) return res.status(400).json({ error: 'Project is not closed' });

  await prisma.$transaction([
    prisma.project.update({
      where: { id: req.params.id },
      data: { closedAt: null, closeReason: null, closeReasonDetail: null },
    }),
    prisma.projectStatusEvent.create({
      data: {
        projectId: req.params.id,
        event: 'REOPENED',
        reasonDetail: detail.success ? detail.data ?? null : null,
        userId: req.user?.id,
      },
    }),
  ]);

  // Back in the active list, so it starts tracking configuration changes again.
  await reconcileStages(req.params.id);
  res.json({ ok: true });
});

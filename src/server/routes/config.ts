import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import type { StageDefinitionDto } from '../../shared/types';

export const configRouter = Router();
configRouter.use(requireAuth);

const projectTypeSchema = z.enum(['NP', 'HOLDOVER']);
const fieldTypeSchema = z.enum(['TEXT', 'DATE', 'CHECKBOX', 'CURRENCY', 'SELECT', 'FILE']);

function toStageDto(stage: {
  id: string;
  projectType: 'NP' | 'HOLDOVER';
  name: string;
  sortOrder: number;
  hidden: boolean;
  fields: {
    id: string;
    label: string;
    type: StageDefinitionDto['fields'][number]['type'];
    options: unknown;
    required: boolean;
    sortOrder: number;
    hidden: boolean;
  }[];
}): StageDefinitionDto {
  return {
    id: stage.id,
    projectType: stage.projectType,
    name: stage.name,
    sortOrder: stage.sortOrder,
    hidden: stage.hidden,
    fields: stage.fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      options: (f.options as string[] | null) ?? null,
      required: f.required,
      sortOrder: f.sortOrder,
      hidden: f.hidden,
    })),
  };
}

/** Stage list for a project type. Hidden stages are included so admins can unhide them. */
configRouter.get('/stages', async (req, res) => {
  const type = projectTypeSchema.safeParse(req.query.projectType);
  const stages = await prisma.stageDefinition.findMany({
    where: type.success ? { projectType: type.data } : {},
    orderBy: [{ projectType: 'asc' }, { sortOrder: 'asc' }],
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json(stages.map(toStageDto));
});

configRouter.post('/stages', async (req, res) => {
  const parsed = z
    .object({ projectType: projectTypeSchema, name: z.string().min(1) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Stage name and type are required' });

  const last = await prisma.stageDefinition.findFirst({
    where: { projectType: parsed.data.projectType },
    orderBy: { sortOrder: 'desc' },
  });

  const stage = await prisma.stageDefinition.create({
    data: { ...parsed.data, sortOrder: (last?.sortOrder ?? 0) + 1 },
    include: { fields: true },
  });
  res.status(201).json(toStageDto(stage));
});

/** Rename, reorder or hide. There is no delete — hiding preserves saved values. */
configRouter.patch('/stages/:id', async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(1).optional(),
      sortOrder: z.number().int().optional(),
      hidden: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid stage update' });

  const stage = await prisma.stageDefinition.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json(toStageDto(stage));
});

const fieldSchema = z.object({
  label: z.string().min(1),
  type: fieldTypeSchema,
  options: z.array(z.string()).nullish(),
  required: z.boolean().optional(),
});

configRouter.post('/stages/:id/fields', async (req, res) => {
  const parsed = fieldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Field label and type are required' });
  if (parsed.data.type === 'SELECT' && !parsed.data.options?.length) {
    return res.status(400).json({ error: 'A Select field needs at least one option' });
  }

  const last = await prisma.fieldDefinition.findFirst({
    where: { stageDefinitionId: req.params.id },
    orderBy: { sortOrder: 'desc' },
  });

  const field = await prisma.fieldDefinition.create({
    data: {
      stageDefinitionId: req.params.id,
      label: parsed.data.label,
      type: parsed.data.type,
      options: parsed.data.options ?? undefined,
      required: parsed.data.required ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  res.status(201).json(field);
});

configRouter.patch('/fields/:id', async (req, res) => {
  const parsed = fieldSchema
    .partial()
    .extend({ hidden: z.boolean().optional(), sortOrder: z.number().int().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid field update' });

  const { options, ...rest } = parsed.data;
  const field = await prisma.fieldDefinition.update({
    where: { id: req.params.id },
    data: { ...rest, ...(options !== undefined ? { options: options ?? undefined } : {}) },
  });
  res.json(field);
});

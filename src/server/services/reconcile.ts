import { prisma } from '../prisma';
import { computeStage } from './completion';

/**
 * Stages always mirror the configuration: every open project carries a ProjectStage
 * for each non-hidden StageDefinition of its type. Called on project load and save.
 *
 * Closed projects are skipped on purpose — a closed case keeps the stage set it had
 * when it closed. Reopening it resumes reconciliation.
 */
export async function reconcileStages(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, type: true, closedAt: true, stages: { select: { stageDefinitionId: true } } },
  });
  if (!project || project.closedAt) return;

  const definitions = await prisma.stageDefinition.findMany({
    where: { projectType: project.type, hidden: false },
    select: { id: true },
  });

  const existing = new Set(project.stages.map((s) => s.stageDefinitionId));
  const missing = definitions.filter((d) => !existing.has(d.id));
  if (missing.length === 0) return;

  await prisma.projectStage.createMany({
    data: missing.map((d) => ({ projectId, stageDefinitionId: d.id })),
    skipDuplicates: true,
  });
}

/**
 * Recomputes and persists `completed` for one stage. Stages with no visible fields
 * are left alone — those are the manual-toggle case.
 */
export async function recomputeStageCompletion(projectStageId: string): Promise<void> {
  const stage = await prisma.projectStage.findUnique({
    where: { id: projectStageId },
    include: {
      stageDefinition: { include: { fields: true } },
      fieldValues: true,
    },
  });
  if (!stage) return;

  const valuesByField = new Map(stage.fieldValues.map((v) => [v.fieldDefinitionId, v]));
  const result = computeStage(stage.stageDefinition.fields, valuesByField);
  if (result.manual) return;

  if (result.completed !== stage.completed) {
    await prisma.projectStage.update({
      where: { id: projectStageId },
      data: {
        completed: result.completed,
        completedAt: result.completed ? new Date() : null,
      },
    });
  }
}

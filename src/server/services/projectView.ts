import type { Prisma } from '@prisma/client';
import type {
  ContactDto,
  FieldValueDto,
  FileDto,
  ProjectDetailDto,
  ProjectListItemDto,
  ProjectStageDto,
} from '../../shared/types';
import { computeStage, hasValue, missingCoreIntakeFields } from './completion';

/** Everything the detail view needs, in one query. */
export const projectInclude = {
  landlordContact: true,
  contactLinks: { include: { contact: true } },
  leaseAgreementFile: true,
  propMgmtAgreementFile: true,
  statusEvents: { orderBy: { at: 'desc' } },
  stages: {
    include: {
      stageDefinition: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      fieldValues: { include: { file: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

type FullProject = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const dec = (d: Prisma.Decimal | null | undefined) => (d ? d.toString() : null);

export function toFileDto(file: {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
} | null): FileDto | null {
  if (!file) return null;
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: file.uploadedAt.toISOString(),
  };
}

export function toContactDto(
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    hidden: boolean;
  } | null,
): ContactDto | null {
  if (!contact) return null;
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    address: contact.address,
    notes: contact.notes,
    hidden: contact.hidden,
  };
}

/**
 * Hidden is only hidden *where empty*: a hidden stage or field still renders on a
 * project that already holds values for it, so case history stays intact. Where it
 * does still render, it is read-only — you can see the old answer but not add new ones.
 */
function buildStages(project: FullProject): ProjectStageDto[] {
  const stages: ProjectStageDto[] = [];

  for (const stage of project.stages) {
    const definition = stage.stageDefinition;
    const valuesByField = new Map(stage.fieldValues.map((v) => [v.fieldDefinitionId, v]));
    const result = computeStage(definition.fields, valuesByField);

    // A hidden stage disappears only from projects that never filled anything in.
    const stageHasValues = definition.fields.some((f) => hasValue(f, valuesByField.get(f.id)));
    if (definition.hidden && !stageHasValues) continue;

    // Old-type stages: kept in the database, filtered out of the project view.
    if (definition.projectType !== project.type && !stageHasValues) continue;

    stages.push({
      id: stage.id,
      stageDefinitionId: definition.id,
      name: definition.name,
      sortOrder: definition.sortOrder,
      completed: result.manual ? stage.completed : result.completed,
      completedAt: iso(stage.completedAt),
      manual: result.manual,
      filledCount: result.filled,
      totalCount: result.bar.length,
      fields: result.visible.map((f) => {
        const value = valuesByField.get(f.id) ?? null;
        return {
          id: f.id,
          label: f.label,
          type: f.type,
          options: (f.options as string[] | null) ?? null,
          required: f.required,
          sortOrder: f.sortOrder,
          hidden: f.hidden,
          readOnly: f.hidden || definition.hidden,
          value: value
            ? ({
                fieldDefinitionId: f.id,
                textValue: value.textValue,
                dateValue: iso(value.dateValue),
                boolValue: value.boolValue,
                numericValue: dec(value.numericValue),
                file: toFileDto(value.file),
              } satisfies FieldValueDto)
            : null,
        };
      }),
    });
  }

  return stages.sort((a, b) => a.sortOrder - b.sortOrder);
}

function listFields(project: FullProject, stages: ProjectStageDto[]): ProjectListItemDto {
  const tenants = project.contactLinks.filter((l) => l.role === 'TENANT');
  return {
    id: project.id,
    caseNumber: project.caseNumber,
    docketNumber: project.docketNumber,
    type: project.type,
    propertyStreetAddress: project.propertyStreetAddress,
    apartmentUnitNumber: project.apartmentUnitNumber,
    propertyCity: project.propertyCity,
    propertyState: project.propertyState,
    landlordName: project.landlordContact?.name ?? null,
    tenantNames: tenants.map((l) => l.contact.name),
    intakeDone: project.intakeDone,
    closedAt: iso(project.closedAt),
    closeReason: project.closeReason,
    stageSummary: stages.map((s) => ({ name: s.name, completed: s.completed })),
  };
}

export function toProjectListItem(project: FullProject): ProjectListItemDto {
  return listFields(project, buildStages(project));
}

export function toProjectDetail(project: FullProject): ProjectDetailDto {
  const stages = buildStages(project);
  return {
    ...listFields(project, stages),
    closeReasonDetail: project.closeReasonDetail,
    landlord: toContactDto(project.landlordContact),
    tenants: project.contactLinks
      .filter((l) => l.role === 'TENANT')
      .map((l) => toContactDto(l.contact)!),
    occupants: project.contactLinks
      .filter((l) => l.role === 'OCCUPANT')
      .map((l) => toContactDto(l.contact)!),
    intake: {
      tenancyStartDate: iso(project.tenancyStartDate),
      lengthOfTenancy: project.lengthOfTenancy,
      monthlyRentAmount: dec(project.monthlyRentAmount),
      totalRentBalanceOwed: dec(project.totalRentBalanceOwed),
      leaseAgreementFile: toFileDto(project.leaseAgreementFile),
      ledgerAttached: project.ledgerAttached,
      propertyStreetAddress: project.propertyStreetAddress,
      apartmentUnitNumber: project.apartmentUnitNumber,
      floorNumber: project.floorNumber,
      propertyCity: project.propertyCity,
      propertyState: project.propertyState,
      propertyZip: project.propertyZip,
      propMgmtAgreementFile: toFileDto(project.propMgmtAgreementFile),
      propertyAccessStraightforward: project.propertyAccessStraightforward,
      additionalAccessInstructions: project.additionalAccessInstructions,
      activeRentalPermit: project.activeRentalPermit,
      submittedByName: project.submittedByName,
      submittedByTitle: project.submittedByTitle,
      submittedByCompany: project.submittedByCompany,
      submittedByPhone: project.submittedByPhone,
      submittedByEmail: project.submittedByEmail,
      submittedByDate: iso(project.submittedByDate),
      markedPersonalConfidential: project.markedPersonalConfidential,
      entryPoint: project.entryPoint,
      intakeDone: project.intakeDone,
    },
    stages,
    statusEvents: project.statusEvents.map((e) => ({
      id: e.id,
      event: e.event,
      reason: e.reason,
      reasonDetail: e.reasonDetail,
      at: e.at.toISOString(),
    })),
    intakeMissing: missingCoreIntakeFields(project),
  };
}

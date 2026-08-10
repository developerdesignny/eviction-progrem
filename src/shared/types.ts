// Types shared by the Express server and the React client — one definition, no drift.

export type ProjectType = 'NP' | 'HOLDOVER';
export type ContactRole = 'TENANT' | 'OCCUPANT';
export type FieldType = 'TEXT' | 'DATE' | 'CHECKBOX' | 'CURRENCY' | 'SELECT' | 'FILE';
export type EntryPoint = 'FRONT' | 'BACK' | 'SIDE' | 'RIGHT' | 'LEFT';
export type CloseReason =
  | 'BALANCE_PAID_IN_FULL'
  | 'TENANT_VACATED'
  | 'CASE_DISMISSED'
  | 'SETTLED_OUTSIDE_COURT'
  | 'OTHER';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  NP: 'NP',
  HOLDOVER: 'Holdover',
};

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  BALANCE_PAID_IN_FULL: 'Balance paid in full',
  TENANT_VACATED: 'Tenant vacated',
  CASE_DISMISSED: 'Case dismissed',
  SETTLED_OUTSIDE_COURT: 'Settled outside of court',
  OTHER: 'Other',
};

export const ENTRY_POINTS: EntryPoint[] = ['FRONT', 'BACK', 'SIDE', 'RIGHT', 'LEFT'];
export const FIELD_TYPES: FieldType[] = ['TEXT', 'DATE', 'CHECKBOX', 'CURRENCY', 'SELECT', 'FILE'];

export interface UserDto {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

export interface ContactDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  hidden: boolean;
  projectCount?: number;
}

export interface FileDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface FieldDefinitionDto {
  id: string;
  label: string;
  type: FieldType;
  options: string[] | null;
  required: boolean;
  sortOrder: number;
  hidden: boolean;
}

export interface StageDefinitionDto {
  id: string;
  projectType: ProjectType;
  name: string;
  sortOrder: number;
  hidden: boolean;
  fields: FieldDefinitionDto[];
}

export interface FieldValueDto {
  fieldDefinitionId: string;
  textValue: string | null;
  dateValue: string | null;
  boolValue: boolean | null;
  numericValue: string | null;
  file: FileDto | null;
}

/** A stage as it appears on one project, after hidden-where-empty filtering. */
export interface ProjectStageDto {
  id: string;
  stageDefinitionId: string;
  name: string;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
  /** True when the stage has no visible fields, so completion is a manual toggle. */
  manual: boolean;
  filledCount: number;
  totalCount: number;
  fields: (FieldDefinitionDto & { value: FieldValueDto | null; readOnly: boolean })[];
}

export interface ProjectListItemDto {
  id: string;
  caseNumber: string;
  docketNumber: string | null;
  type: ProjectType;
  propertyStreetAddress: string | null;
  apartmentUnitNumber: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  landlordName: string | null;
  tenantNames: string[];
  intakeDone: boolean;
  closedAt: string | null;
  closeReason: CloseReason | null;
  stageSummary: { name: string; completed: boolean }[];
}

export interface ProjectDetailDto extends ProjectListItemDto {
  closeReasonDetail: string | null;
  landlord: ContactDto | null;
  tenants: ContactDto[];
  occupants: ContactDto[];
  intake: IntakeDto;
  stages: ProjectStageDto[];
  statusEvents: {
    id: string;
    event: 'CLOSED' | 'REOPENED';
    reason: CloseReason | null;
    reasonDetail: string | null;
    at: string;
  }[];
  /** Which core intake fields are still blank — drives the "x of y complete" summary. */
  intakeMissing: string[];
}

export interface IntakeDto {
  tenancyStartDate: string | null;
  lengthOfTenancy: string | null;
  monthlyRentAmount: string | null;
  totalRentBalanceOwed: string | null;
  leaseAgreementFile: FileDto | null;
  ledgerAttached: boolean;
  propertyStreetAddress: string | null;
  apartmentUnitNumber: string | null;
  floorNumber: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  propMgmtAgreementFile: FileDto | null;
  propertyAccessStraightforward: boolean;
  additionalAccessInstructions: string | null;
  activeRentalPermit: boolean;
  submittedByName: string | null;
  submittedByTitle: string | null;
  submittedByCompany: string | null;
  submittedByPhone: string | null;
  submittedByEmail: string | null;
  submittedByDate: string | null;
  markedPersonalConfidential: boolean;
  entryPoint: EntryPoint | null;
  intakeDone: boolean;
}

/**
 * Core intake fields — the subset that decides `intakeDone`.
 * Checkboxes are deliberately excluded: on intake an unchecked box ("no ledger")
 * is a real answer, so waiting for it would mean intake never completes. This is
 * the opposite of a required stage checkbox, where ticking it IS the task.
 * `totalRentBalanceOwed` counts on NP cases only.
 */
export const CORE_INTAKE_FIELDS = [
  'landlordContactId',
  'tenants',
  'tenancyStartDate',
  'monthlyRentAmount',
  'leaseAgreementFileId',
  'propertyStreetAddress',
  'propertyCity',
  'propertyState',
  'propertyZip',
  'propMgmtAgreementFileId',
  'entryPoint',
  'submittedByName',
  'submittedByPhone',
  'submittedByEmail',
  'submittedByDate',
] as const;

export const CORE_INTAKE_FIELD_LABELS: Record<string, string> = {
  landlordContactId: 'Landlord / Owner',
  tenants: 'Tenant(s) on Lease',
  tenancyStartDate: 'Tenancy Start Date',
  monthlyRentAmount: 'Monthly Rent Amount',
  totalRentBalanceOwed: 'Total Rent Balance Owed',
  leaseAgreementFileId: 'Lease Agreement',
  propertyStreetAddress: 'Property Street Address',
  propertyCity: 'Property City',
  propertyState: 'Property State',
  propertyZip: 'Property Zip',
  propMgmtAgreementFileId: 'Property Management Agreement',
  entryPoint: 'Entry Point',
  submittedByName: 'Submitted By (Name)',
  submittedByPhone: 'Submitted By (Phone)',
  submittedByEmail: 'Submitted By (Email)',
  submittedByDate: 'Submitted By (Date)',
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

import type { FieldDefinition, FieldValue, Project, ProjectContact } from '@prisma/client';
import { CORE_INTAKE_FIELDS } from '../../shared/types';

/**
 * Does this value count as filled?
 * A Checkbox counts only when it is actually checked — inside a stage checklist,
 * ticking the box IS the task ("5-Day Done"), so an unchecked box is not an answer.
 */
export function hasValue(field: FieldDefinition, value: FieldValue | null | undefined): boolean {
  if (!value) return false;
  switch (field.type) {
    case 'TEXT':
    case 'SELECT':
      return !!value.textValue && value.textValue.trim() !== '';
    case 'DATE':
      return value.dateValue != null;
    case 'CHECKBOX':
      return value.boolValue === true;
    case 'CURRENCY':
      return value.numericValue != null;
    case 'FILE':
      return value.fileId != null;
    default:
      return false;
  }
}

export interface StageComputation {
  /** Fields to render: visible ones, plus hidden ones that already hold a value. */
  visible: FieldDefinition[];
  /** Fields that count toward completion. */
  bar: FieldDefinition[];
  filled: number;
  completed: boolean;
  /** No visible fields at all — completion falls back to a manual toggle. */
  manual: boolean;
}

/**
 * Stage completion, per docs/requirements.md:
 *  - complete when every *required* visible field has a value;
 *  - with no required fields, the bar is all visible fields;
 *  - with no visible fields at all, completion is manual;
 *  - hidden-and-empty fields are excluded, so hiding a field can complete a stage.
 * Never sticky: clearing a value flips the stage back to incomplete.
 */
export function computeStage(
  fields: FieldDefinition[],
  valuesByField: Map<string, FieldValue>,
): StageComputation {
  const visible = fields.filter(
    (f) => !f.hidden || hasValue(f, valuesByField.get(f.id)),
  );

  if (visible.length === 0) {
    return { visible, bar: [], filled: 0, completed: false, manual: true };
  }

  const required = visible.filter((f) => f.required);
  const bar = required.length > 0 ? required : visible;
  const filled = bar.filter((f) => hasValue(f, valuesByField.get(f.id))).length;

  return { visible, bar, filled, completed: filled === bar.length, manual: false };
}

type ProjectForIntake = Project & { contactLinks?: Pick<ProjectContact, 'role'>[] };

/**
 * Which core intake fields are still blank. `intakeDone` is true when this is empty.
 * Intake checkboxes never count — an unchecked box there ("no ledger", "access is not
 * straightforward") is a valid answer, so requiring it would mean intake never completes.
 */
export function missingCoreIntakeFields(project: ProjectForIntake): string[] {
  const hasTenant = (project.contactLinks ?? []).some((l) => l.role === 'TENANT');
  const missing: string[] = [];

  for (const key of CORE_INTAKE_FIELDS) {
    if (key === 'tenants') {
      if (!hasTenant) missing.push(key);
      continue;
    }
    const value = (project as Record<string, unknown>)[key];
    const blank = value == null || (typeof value === 'string' && value.trim() === '');
    if (blank) missing.push(key);
  }

  // Balance owed is a core field on non-payment cases only.
  if (project.type === 'NP' && project.totalRentBalanceOwed == null) {
    missing.push('totalRentBalanceOwed');
  }

  return missing;
}

export function computeIntakeDone(project: ProjectForIntake): boolean {
  return missingCoreIntakeFields(project).length === 0;
}

import { useState } from 'react';
import type { ProjectDetailDto, ProjectStageDto } from '../../shared/types';
import { api } from '../api';
import { FileField } from './FileField';

/**
 * One stage checklist. Stages are independent parallel checklists — not a locked
 * sequential pipeline — and completion is derived from the field values, so there is
 * no "mark done" button except on a stage that has no fields at all.
 */
export function StageCard({
  project,
  stage,
  readOnly,
  onChanged,
}: {
  project: ProjectDetailDto;
  stage: ProjectStageDto;
  readOnly: boolean;
  onChanged: (project: ProjectDetailDto) => void;
}) {
  // Finished stages start collapsed; anything outstanding stays open.
  const [collapsed, setCollapsed] = useState(stage.completed);
  const [busy, setBusy] = useState(false);

  async function setValue(fieldId: string, value: Record<string, unknown>) {
    setBusy(true);
    try {
      onChanged(await api.projects.setFieldValue(project.id, stage.id, fieldId, value));
    } finally {
      setBusy(false);
    }
  }

  async function toggleManual() {
    setBusy(true);
    try {
      await api.projects.setStageComplete(project.id, stage.id, !stage.completed);
      onChanged(await api.projects.get(project.id));
    } finally {
      setBusy(false);
    }
  }

  const percent = stage.totalCount === 0 ? 0 : (stage.filledCount / stage.totalCount) * 100;

  return (
    <div className={`stagecard${stage.filledCount === 0 ? ' notstarted' : ''}`}>
      <div className="shead" onClick={() => setCollapsed((prior) => !prior)}>
        <div className="shead-top">
          <span className="stitle">
            <span className="chev-ico">{collapsed ? '▸' : '▾'}</span>
            <h3>{stage.name}</h3>
          </span>
          <span className="count">
            {stage.manual ? (stage.completed ? 'Done' : 'Open') : `${stage.filledCount}/${stage.totalCount}`}
          </span>
        </div>
        <div className="pbar">
          <i style={{ width: `${stage.manual ? (stage.completed ? 100 : 0) : percent}%` }} />
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flist">
            {stage.fields.map((field) => {
              const disabled = readOnly || field.readOnly || busy;
              const value = field.value;

              return (
                <div className={`frow${value ? '' : ' empty'}`} key={field.id}>
                  {field.type === 'CHECKBOX' ? (
                    <span
                      className={`box${value?.boolValue ? ' on' : ''}${disabled ? ' readonly' : ''}`}
                      onClick={() => !disabled && void setValue(field.id, { boolValue: !value?.boolValue })}
                    >
                      {value?.boolValue ? '✓' : ''}
                    </span>
                  ) : (
                    <span className="ftype">{field.type}</span>
                  )}

                  <span className="flabel">
                    {field.label}
                    {field.required && <span className="req"> *</span>}
                  </span>

                  {field.type === 'TEXT' && (
                    <input
                      type="text"
                      defaultValue={value?.textValue ?? ''}
                      disabled={disabled}
                      onBlur={(event) => void setValue(field.id, { textValue: event.target.value })}
                    />
                  )}

                  {field.type === 'DATE' && (
                    <input
                      type="date"
                      defaultValue={value?.dateValue?.slice(0, 10) ?? ''}
                      disabled={disabled}
                      onChange={(event) => void setValue(field.id, { dateValue: event.target.value || null })}
                    />
                  )}

                  {field.type === 'CURRENCY' && (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={value?.numericValue ?? ''}
                      disabled={disabled}
                      onBlur={(event) => void setValue(field.id, { numericValue: event.target.value || null })}
                    />
                  )}

                  {field.type === 'SELECT' && (
                    <select
                      defaultValue={value?.textValue ?? ''}
                      disabled={disabled}
                      onChange={(event) => void setValue(field.id, { textValue: event.target.value || null })}
                    >
                      <option value="">—</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'FILE' && (
                    <FileField
                      file={value?.file ?? null}
                      editing={!disabled}
                      onChange={(fileId) => void setValue(field.id, { fileId })}
                    />
                  )}

                  {field.readOnly && <span className="readonly-note">hidden</span>}
                </div>
              );
            })}

            {stage.fields.length === 0 && (
              <div className="frow empty">
                <span className="flabel">No fields configured for this stage yet.</span>
              </div>
            )}
          </div>

          {stage.manual && (
            <div className="sfoot">
              <button className="btn btn-sm" onClick={() => void toggleManual()} disabled={readOnly || busy}>
                {stage.completed ? 'Mark not done' : 'Mark stage done'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

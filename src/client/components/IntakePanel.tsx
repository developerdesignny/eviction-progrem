import { useState } from 'react';
import type { ContactDto, EntryPoint, ProjectDetailDto } from '../../shared/types';
import { CORE_INTAKE_FIELD_LABELS, ENTRY_POINTS } from '../../shared/types';
import { api } from '../api';
import { ContactPicker } from './ContactPicker';
import { ContactViewModal, initials } from './ContactViewModal';
import { FileField } from './FileField';

type Draft = Record<string, unknown>;

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/**
 * The fixed 29-field intake form. Intake is NOT a stage — it never appears in the
 * stage grid or the progress bar, and `intakeDone` is computed by the server from
 * the core field subset rather than ticked by hand.
 */
export function IntakePanel({
  project,
  onSaved,
}: {
  project: ProjectDetailDto;
  onSaved: (project: ProjectDetailDto) => void;
}) {
  const [collapsed, setCollapsed] = useState(project.intakeDone);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ contact: ContactDto; role: string } | null>(null);

  const intake = project.intake;
  const value = <T,>(key: string, current: T): T =>
    (key in draft ? (draft[key] as T) : current);
  const set = (key: string, next: unknown) => setDraft((prior) => ({ ...prior, [key]: next }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.projects.update(project.id, draft));
      setDraft({});
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Contact links are saved the moment they change rather than riding along in the intake
   * draft — the landlord slot used to sit in `draft`, which left a removed landlord still
   * on screen until Save. Re-reading the project keeps the panel honest about what is
   * actually linked, and the unsaved draft for the other fields survives untouched.
   */
  async function saveLink(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved(await api.projects.get(project.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update contacts');
    } finally {
      setBusy(false);
    }
  }

  const setLandlord = (contactId: string | null) =>
    saveLink(() => api.projects.update(project.id, { landlordContactId: contactId }));

  const linkContact = (contact: ContactDto, role: 'TENANT' | 'OCCUPANT') =>
    saveLink(() => api.projects.linkContact(project.id, contact.id, role));

  const unlinkContact = (contactId: string, role: 'TENANT' | 'OCCUPANT') =>
    saveLink(() => api.projects.unlinkContact(project.id, contactId, role));

  /**
   * The landlord, rendered in full — name, role and how to reach them at a glance, with
   * View for the rest of the record. Only this slot gets a card: a case has one landlord
   * and their contact details are needed constantly, whereas tenants and occupants are a
   * list of names (see personChip).
   */
  const contactCard = (contact: ContactDto, role: string, onRemove: () => void) => (
    <div className="contact-card" key={contact.id}>
      <div className="cc-avatar">{initials(contact.name)}</div>
      <div className="cc-info">
        <div className="cc-name">
          {contact.name}
          <span className="cc-role">{role}</span>
        </div>
        <div className={`cc-detail mono${contact.phone ? '' : ' empty'}`}>
          ☎ {contact.phone || 'No phone'}
        </div>
        <div className={`cc-detail mono${contact.email ? '' : ' empty'}`}>
          ✉ {contact.email || 'No email'}
        </div>
        {contact.address && <div className="cc-detail">{contact.address}</div>}
      </div>
      <button className="cc-view btn btn-sm" onClick={() => setViewing({ contact, role })}>
        View
      </button>
      {editing && (
        <button className="cc-remove" title="Remove from this case" disabled={busy} onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );

  /**
   * A tenant or occupant: the name only, as the intake form asks for. The full record is a
   * click away rather than spread across the panel — a case can list several of each, and
   * three stacked contact cards each buried the fields around them.
   */
  const personChip = (contact: ContactDto, role: string, onRemove: () => void) => (
    <span className="chip" key={contact.id}>
      <button
        className="chip-name"
        title={`View ${contact.name}'s details`}
        onClick={() => setViewing({ contact, role })}
      >
        {contact.name}
      </button>
      {editing && (
        <button className="rm" title="Remove from this case" disabled={busy} onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );

  const text = (key: string, label: string, current: string | null) => (
    <div className="ifield" key={key}>
      <div className="k">{label}</div>
      {editing ? (
        <input
          type="text"
          value={(value(key, current) as string | null) ?? ''}
          onChange={(event) => set(key, event.target.value)}
        />
      ) : (
        <div className={`v${current ? '' : ' empty'}`}>{current || '—'}</div>
      )}
    </div>
  );

  const date = (key: string, label: string, current: string | null) => (
    <div className="ifield" key={key}>
      <div className="k">{label}</div>
      {editing ? (
        <input
          type="date"
          value={dateInput((value(key, current) as string | null) ?? null)}
          onChange={(event) => set(key, event.target.value || null)}
        />
      ) : (
        <div className={`v mono${current ? '' : ' empty'}`}>
          {current ? new Date(current).toLocaleDateString() : '—'}
        </div>
      )}
    </div>
  );

  const money = (key: string, label: string, current: string | null) => (
    <div className="ifield" key={key}>
      <div className="k">{label}</div>
      {editing ? (
        <input
          type="number"
          step="0.01"
          value={(value(key, current) as string | null) ?? ''}
          onChange={(event) => set(key, event.target.value || null)}
        />
      ) : (
        <div className={`v mono${current ? '' : ' empty'}`}>
          {current ? `$${Number(current).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
        </div>
      )}
    </div>
  );

  const check = (key: string, label: string, current: boolean) => {
    const shown = value(key, current) as boolean;
    return (
      <div className="ifield checkfield" key={key}>
        <span
          className={`box${shown ? ' on' : ''}${editing ? '' : ' readonly'}`}
          onClick={() => editing && set(key, !shown)}
        >
          {shown ? '✓' : ''}
        </span>
        <div className="k">{label}</div>
      </div>
    );
  };

  const missingLabels = project.intakeMissing.map((key) => CORE_INTAKE_FIELD_LABELS[key] ?? key);

  return (
    <section className="intake-panel">
      <div className="ihead">
        <button className="ihead-toggle" onClick={() => setCollapsed((prior) => !prior)}>
          <span className="chev-ico">{collapsed ? '▸' : '▾'}</span>
          <h3>Intake Information</h3>
          {collapsed && (
            <span className="isummary">
              {project.intakeDone
                ? 'Complete'
                : `${missingLabels.length} core field${missingLabels.length === 1 ? '' : 's'} outstanding`}
            </span>
          )}
        </button>

        {!collapsed &&
          (editing ? (
            <div className="case-actions">
              <button
                className="btn btn-sm"
                onClick={() => {
                  setDraft({});
                  setEditing(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
          ))}
      </div>

      {collapsed ? null : (
        <div className="ibody">
          {error && <div className="error-banner">{error}</div>}
          {editing && (
            <div className="editing-note">
              Editing — linking and removing contacts saves right away; the rest of the form saves
              when you hit Save. Editing a contact's own details is done on the Contacts screen.
            </div>
          )}

          <div className="igroup">
            <div className="igroup-title">Contacts</div>
            <div className="igrid cols-1">
              <div className="ifield">
                <div className="k">Landlord / Owner</div>
                <div className="contact-cards">
                  {project.landlord ? (
                    contactCard(project.landlord, 'Landlord', () => void setLandlord(null))
                  ) : (
                    <div className="v empty">Not linked</div>
                  )}
                </div>
                {editing && (
                  <ContactPicker
                    placeholder={project.landlord ? 'Replace landlord…' : 'Link a landlord…'}
                    onPick={(contact) => void setLandlord(contact.id)}
                  />
                )}
              </div>
            </div>

            <div className="igrid cols-2" style={{ marginTop: 14 }}>
              <div className="ifield">
                <div className="k">Tenant(s) on Lease</div>
                <div className="chiprow">
                  {project.tenants.map((tenant) =>
                    personChip(tenant, 'Tenant', () => void unlinkContact(tenant.id, 'TENANT')),
                  )}
                  {project.tenants.length === 0 && <span className="v empty">None</span>}
                </div>
                {editing && (
                  <ContactPicker
                    placeholder="Add tenant…"
                    onPick={(contact) => void linkContact(contact, 'TENANT')}
                  />
                )}
              </div>

              <div className="ifield">
                <div className="k">Occupants 18+ Not on Lease</div>
                <div className="chiprow">
                  {project.occupants.map((occupant) =>
                    personChip(occupant, 'Occupant', () =>
                      void unlinkContact(occupant.id, 'OCCUPANT'),
                    ),
                  )}
                  {project.occupants.length === 0 && <span className="v empty">None</span>}
                </div>
                {editing && (
                  <ContactPicker
                    placeholder="Add occupant…"
                    onPick={(contact) => void linkContact(contact, 'OCCUPANT')}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="igroup">
            <div className="igroup-title">Case &amp; Lease</div>
            <div className="igrid">
              {date('tenancyStartDate', 'Tenancy Start Date', intake.tenancyStartDate)}
              {text('lengthOfTenancy', 'Length of Tenancy', intake.lengthOfTenancy)}
              {money('monthlyRentAmount', 'Monthly Rent Amount', intake.monthlyRentAmount)}
              {money('totalRentBalanceOwed', 'Total Rent Balance Owed', intake.totalRentBalanceOwed)}
              <div className="ifield">
                <div className="k">Lease Agreement</div>
                <FileField
                  file={intake.leaseAgreementFile}
                  editing={editing}
                  onChange={(fileId) => set('leaseAgreementFileId', fileId)}
                />
              </div>
              {check('ledgerAttached', 'Ledger Attached', intake.ledgerAttached)}
            </div>
          </div>

          <div className="igroup">
            <div className="igroup-title">Property</div>
            <div className="igrid">
              {text('propertyStreetAddress', 'Street Address', intake.propertyStreetAddress)}
              {text('apartmentUnitNumber', 'Apartment / Unit #', intake.apartmentUnitNumber)}
              {text('floorNumber', 'Floor Number', intake.floorNumber)}
              {text('propertyCity', 'City', intake.propertyCity)}
              {text('propertyState', 'State', intake.propertyState)}
              {text('propertyZip', 'Zip', intake.propertyZip)}
              <div className="ifield">
                <div className="k">Property Mgmt Agreement</div>
                <FileField
                  file={intake.propMgmtAgreementFile}
                  editing={editing}
                  onChange={(fileId) => set('propMgmtAgreementFileId', fileId)}
                />
              </div>
              {check('propertyAccessStraightforward', 'Access: Straightforward', intake.propertyAccessStraightforward)}
              {check('activeRentalPermit', 'Active Rental Permit', intake.activeRentalPermit)}
            </div>
            <div className="igrid cols-1" style={{ marginTop: 14 }}>
              {text(
                'additionalAccessInstructions',
                'Additional Property Access Instructions',
                intake.additionalAccessInstructions,
              )}
            </div>
          </div>

          <div className="igroup">
            <div className="igroup-title">Submitted By</div>
            <div className="igrid cols-3">
              {text('submittedByName', 'Name', intake.submittedByName)}
              {text('submittedByTitle', 'Title', intake.submittedByTitle)}
              {text('submittedByCompany', 'Company', intake.submittedByCompany)}
              {text('submittedByPhone', 'Phone', intake.submittedByPhone)}
              {text('submittedByEmail', 'Email', intake.submittedByEmail)}
              {date('submittedByDate', 'Date', intake.submittedByDate)}
            </div>
          </div>

          <div className="igroup">
            <div className="igroup-title">Case Flags &amp; Type</div>
            <div className="igrid">
              <div className="ifield">
                <div className="k">Entry Point</div>
                {editing ? (
                  <select
                    value={(value('entryPoint', intake.entryPoint) as string | null) ?? ''}
                    onChange={(event) => set('entryPoint', event.target.value || null)}
                  >
                    <option value="">—</option>
                    {ENTRY_POINTS.map((point: EntryPoint) => (
                      <option key={point} value={point}>
                        {point[0] + point.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={`v${intake.entryPoint ? '' : ' empty'}`}>
                    {intake.entryPoint
                      ? intake.entryPoint[0] + intake.entryPoint.slice(1).toLowerCase()
                      : '—'}
                  </div>
                )}
              </div>

              <div className="ifield">
                <div className="k">Evictions Type</div>
                {editing ? (
                  <select
                    value={value('type', project.type) as string}
                    onChange={(event) => set('type', event.target.value)}
                  >
                    <option value="NP">NP</option>
                    <option value="HOLDOVER">Holdover</option>
                  </select>
                ) : (
                  <div className="v">{project.type === 'NP' ? 'NP' : 'Holdover'}</div>
                )}
                {editing && (
                  <div className="field-hint">
                    Changing the type swaps in that type's stages. Stages from the old type keep
                    their answers but drop out of this project.
                  </div>
                )}
              </div>

              {text('docketNumber', 'Docket # (court-assigned)', project.docketNumber)}
              {check(
                'markedPersonalConfidential',
                'Marked Personal & Confidential',
                intake.markedPersonalConfidential,
              )}
            </div>
          </div>

          <div className={`intake-done-row${project.intakeDone ? '' : ' pending'}`}>
            <span className={`box readonly${project.intakeDone ? ' on' : ''}`}>
              {project.intakeDone ? '✓' : ''}
            </span>
            <span className="k">Intake Done</span>
            {!project.intakeDone && (
              <span className="missing">Waiting on: {missingLabels.join(', ')}</span>
            )}
          </div>
        </div>
      )}

      {viewing && (
        <ContactViewModal
          contact={viewing.contact}
          role={viewing.role}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

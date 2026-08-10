import type { ContactDto } from '../../shared/types';
import { Modal } from './Modal';

/** Up to two initials — "R. Alvarez" → RA, "BHMS Management LLC" → BM. */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
  return letters.toUpperCase() || '?';
}

/**
 * A linked contact, read-only. Tenants and occupants are listed on a case as bare names,
 * so this is where the rest of the record — phone, email, address, notes — is reachable
 * without leaving the case. Read-only on purpose: editing a contact's own details belongs
 * on the Contacts screen, since the record is shared by every case that links it.
 */
export function ContactViewModal({
  contact,
  role,
  onClose,
}: {
  contact: ContactDto;
  role: string;
  onClose: () => void;
}) {
  const rows: [string, string | null, boolean][] = [
    ['Phone', contact.phone, true],
    ['Email', contact.email, true],
    ['Address', contact.address, false],
    ['Notes', contact.notes, false],
  ];

  return (
    <Modal
      title={contact.name}
      className="contact-modal"
      onClose={onClose}
      header={
        <div className="cm-head">
          <div className="cm-avatar">{initials(contact.name)}</div>
          <div className="cm-title">
            <h3>{contact.name}</h3>
            <span className="cc-role">{role}</span>
          </div>
        </div>
      }
      footer={
        <button className="btn btn-sm" onClick={onClose}>
          Close
        </button>
      }
    >
      <dl>
        {rows.map(([label, value, mono]) => (
          <div className="cm-row" key={label}>
            <dt>{label}</dt>
            <dd className={`${mono ? 'mono' : ''}${value ? '' : ' empty'}`}>{value || '—'}</dd>
          </div>
        ))}
      </dl>

      {typeof contact.projectCount === 'number' && (
        <div className="cm-linked">
          Linked to <strong>{contact.projectCount}</strong>
          {contact.projectCount === 1 ? ' project' : ' projects'}.
        </div>
      )}

      <div className="field-hint" style={{ marginTop: 14 }}>
        Details are edited on the Contacts screen — changes there apply to every case this
        contact is linked to.
      </div>
    </Modal>
  );
}

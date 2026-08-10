import { useState } from 'react';
import type { ContactDto } from '../../shared/types';
import { api } from '../api';
import { Modal } from './Modal';

/**
 * The whole contact record in one form. Both the Contacts screen and the inline
 * "create" path inside a case use it, so a contact made from within a case is a full
 * record rather than a bare name.
 */
export function ContactFormModal({
  contact,
  initialName,
  subtitle,
  onClose,
  onSaved,
}: {
  contact: ContactDto | null;
  initialName?: string;
  subtitle?: string;
  onClose: () => void;
  onSaved: (contact: ContactDto) => void;
}) {
  const [form, setForm] = useState({
    name: contact?.name ?? initialName ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    address: contact?.address ?? '',
    notes: contact?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(event) => setForm((prior) => ({ ...prior, [key]: event.target.value }))}
      />
    </div>
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(
        contact ? await api.contacts.update(contact.id, form) : await api.contacts.create(form),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save contact');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={contact ? 'Edit contact' : 'New contact'}
      subtitle={subtitle ?? (contact ? 'Changes apply everywhere this contact is linked.' : undefined)}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={busy || !form.name.trim()}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {error && <div className="error-banner">{error}</div>}
      {field('name', 'Name')}
      {field('phone', 'Phone', 'tel')}
      {field('email', 'Email', 'email')}
      {field('address', 'Address')}
      <div className="field">
        <label>Notes</label>
        <textarea
          value={form.notes}
          onChange={(event) => setForm((prior) => ({ ...prior, notes: event.target.value }))}
        />
      </div>
    </Modal>
  );
}

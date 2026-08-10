import { useEffect, useState } from 'react';
import type { ContactDto } from '../../shared/types';
import { api } from '../api';
import { ContactFormModal } from '../components/ContactFormModal';

/**
 * The shared Contacts table. Editing a contact here updates it on every project it is
 * linked to — that is the point of one shared record. Contacts are never deleted:
 * hiding one takes it out of search and out of every picker, but projects that already
 * reference it keep showing it.
 */
export function Contacts() {
  const [contacts, setContacts] = useState<ContactDto[]>([]);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<ContactDto | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setContacts(await api.contacts.list(search, showHidden));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load contacts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showHidden]);

  async function setHidden(contact: ContactDto, hidden: boolean) {
    await api.contacts.update(contact.id, { hidden });
    void refresh();
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Contacts</h1>
          <div className="desc">
            Landlords, tenants and occupants. One record per person — edit it here and every case
            linked to it updates.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + New contact
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div className="chip-filter">
          <button className={showHidden ? '' : 'active'} onClick={() => setShowHidden(false)}>
            Active
          </button>
          <button className={showHidden ? 'active' : ''} onClick={() => setShowHidden(true)}>
            Include hidden
          </button>
        </div>
        <div className="search">
          <input
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">No contacts yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Projects</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className={contact.hidden ? 'dim' : ''}>
                <td>
                  <strong>{contact.name}</strong>
                  {contact.hidden && <span className="cc-role" style={{ marginLeft: 8 }}>Hidden</span>}
                </td>
                <td className="mono">{contact.phone ?? '—'}</td>
                <td>{contact.email ?? '—'}</td>
                <td className="mono">{contact.projectCount ?? 0}</td>
                <td>
                  <div className="row-actions">
                    <button className="linkbtn" onClick={() => setEditing(contact)}>
                      Edit
                    </button>
                    <button
                      className="linkbtn"
                      onClick={() => void setHidden(contact, !contact.hidden)}
                    >
                      {contact.hidden ? 'Unhide' : 'Hide'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ContactFormModal
          contact={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}

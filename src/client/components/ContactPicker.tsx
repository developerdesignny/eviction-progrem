import { useEffect, useState } from 'react';
import type { ContactDto } from '../../shared/types';
import { api } from '../api';
import { ContactFormModal } from './ContactFormModal';

/**
 * Search the shared Contacts table and pick one, or create a full record inline.
 * Creating opens the same form the Contacts screen uses — a contact added from inside a
 * case gets its phone, email and address at the moment someone has them to hand.
 * Hidden contacts never appear here — that is what hiding a contact means.
 */
export function ContactPicker({
  placeholder,
  onPick,
}: {
  placeholder: string;
  onPick: (contact: ContactDto) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactDto[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.contacts.list(query).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(contact: ContactDto) {
    onPick(contact);
    setQuery('');
    setResults([]);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <span className="chip-add">
        <input
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </span>

      {query.trim().length >= 2 && (
        <div className="chiprow">
          {results.map((contact) => (
            <button key={contact.id} className="chip" onClick={() => pick(contact)}>
              {contact.name}
              {contact.phone ? ` · ${contact.phone}` : ''}
            </button>
          ))}
          {/* Offered whether or not the search matched — a near-miss is not the same person. */}
          <button className="linkbtn" onClick={() => setCreating(true)}>
            + Create “{query.trim()}” as a new contact
          </button>
        </div>
      )}

      {creating && (
        <ContactFormModal
          contact={null}
          initialName={query.trim()}
          subtitle="Saved to the shared Contacts table and linked to this case."
          onClose={() => setCreating(false)}
          onSaved={(contact) => {
            setCreating(false);
            pick(contact);
          }}
        />
      )}
    </div>
  );
}

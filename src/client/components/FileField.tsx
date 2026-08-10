import { useState } from 'react';
import type { FileDto } from '../../shared/types';
import { api } from '../api';

const kb = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** An actual uploaded document (Lease Agreement, Property Mgmt Agreement, …). */
export function FileField({
  file,
  editing,
  onChange,
}: {
  file: FileDto | null;
  editing: boolean;
  onChange: (fileId: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(picked: File) {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await api.files.upload(picked);
      onChange(uploaded.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (file) {
    return (
      <div>
        <div className="file-pill">
          <a className="file-name" href={api.files.url(file.id)} target="_blank" rel="noreferrer">
            {file.filename}
          </a>
          <span className="file-meta">{kb(file.size)}</span>
          {editing && (
            <button className="cc-remove" title="Remove" onClick={() => onChange(null)}>
              ×
            </button>
          )}
        </div>
        {error && <div className="field-hint">{error}</div>}
      </div>
    );
  }

  if (!editing) return <div className="file-empty">Not attached</div>;

  return (
    <div>
      <label className="file-upload-btn">
        {busy ? 'Uploading…' : '↑ Upload file'}
        <input
          type="file"
          disabled={busy}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (picked) void upload(picked);
          }}
        />
      </label>
      {error && <div className="field-hint">{error}</div>}
    </div>
  );
}

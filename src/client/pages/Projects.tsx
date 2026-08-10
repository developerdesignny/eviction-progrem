import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectListItemDto, ProjectType } from '../../shared/types';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { ProjectList } from '../components/ProjectList';

export function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItemDto[]>([]);
  const [type, setType] = useState<'ALL' | ProjectType>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Debounced so typing in the search box doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      setLoading(true);
      api.projects
        .list({ status: 'open', search, type: type === 'ALL' ? undefined : type })
        .then(setProjects)
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [search, type]);

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Projects</h1>
          <div className="desc">Open eviction cases. Closed cases live in the Archive.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New project
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div className="chip-filter">
          {(['ALL', 'NP', 'HOLDOVER'] as const).map((option) => (
            <button
              key={option}
              className={type === option ? 'active' : ''}
              onClick={() => setType(option)}
            >
              {option === 'ALL' ? 'All' : option === 'NP' ? 'NP' : 'Holdover'}
            </button>
          ))}
        </div>
        <div className="search">
          <input
            placeholder="Search by address, tenant, landlord, case # or docket #…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? <div className="loading">Loading…</div> : <ProjectList projects={projects} />}

      {creating && (
        <NewProjectModal
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/projects/${id}`)}
        />
      )}
    </>
  );
}

/** Only the project type is required — everything else is filled in over time. */
function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [type, setType] = useState<ProjectType>('NP');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const project = await api.projects.create({
        type,
        propertyStreetAddress: address || null,
      });
      onCreated(project.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create project');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New project"
      subtitle="A case number is assigned automatically. Everything else can wait."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </>
      }
    >
      {error && <div className="error-banner">{error}</div>}

      <div className="field">
        <label>Project type</label>
        <select value={type} onChange={(event) => setType(event.target.value as ProjectType)}>
          <option value="NP">NP — Non-payment</option>
          <option value="HOLDOVER">Holdover</option>
        </select>
      </div>

      <div className="field">
        <label>Property address (optional)</label>
        <input value={address} onChange={(event) => setAddress(event.target.value)} />
      </div>
    </Modal>
  );
}

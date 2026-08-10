import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CloseReason, ProjectDetailDto } from '../../shared/types';
import { CLOSE_REASON_LABELS, PROJECT_TYPE_LABELS } from '../../shared/types';
import { api } from '../api';
import { IntakePanel } from '../components/IntakePanel';
import { Modal } from '../components/Modal';
import { StageCard } from '../components/StageCard';
import { addressOf } from '../components/ProjectList';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.projects
      .get(id)
      .then(setProject)
      .catch((caught) => setError(caught.message));
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <div className="loading">Loading…</div>;

  const closed = project.closedAt != null;
  const doneStages = project.stages.filter((s) => s.completed).length;

  async function reopen() {
    if (!project) return;
    await api.projects.reopen(project.id);
    setProject(await api.projects.get(project.id));
  }

  return (
    <>
      <Link className="backlink" to={closed ? '/archive' : '/'}>
        ‹ Back to {closed ? 'archive' : 'projects'}
      </Link>

      <div className="case-head">
        <div>
          <h1>{addressOf(project)}</h1>
          <div className="case-meta">
            <span className={`tag tag-${project.type.toLowerCase()}`}>
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
            {closed && <span className="tag tag-closed">Closed</span>}
            <span className="mono">{project.caseNumber}</span>
            {project.docketNumber && <span className="mono">Docket {project.docketNumber}</span>}
            <span className="mono">
              {doneStages} of {project.stages.length} stages done
            </span>
          </div>
        </div>

        <div className="case-actions">
          {closed ? (
            <button className="btn btn-primary" onClick={() => void reopen()}>
              Reopen project
            </button>
          ) : (
            <button className="btn-close-project" onClick={() => setClosing(true)}>
              Close project
            </button>
          )}
        </div>
      </div>

      {closed && (
        <div className="error-banner">
          Closed {new Date(project.closedAt!).toLocaleDateString()} —{' '}
          {project.closeReason ? CLOSE_REASON_LABELS[project.closeReason] : 'no reason recorded'}
          {project.closeReasonDetail ? `: ${project.closeReasonDetail}` : ''}. Reopening puts it back
          in the active list and resumes stage updates.
        </div>
      )}

      <IntakePanel project={project} onSaved={setProject} />

      <div className="section-note">
        Stages run in parallel — each is its own checklist, and they complete on their own as
        fields are filled in.
      </div>

      {project.stages.length === 0 ? (
        <div className="empty-state">
          No stages configured for {PROJECT_TYPE_LABELS[project.type]} cases yet. Add them in{' '}
          <Link to="/config" style={{ textDecoration: 'underline' }}>
            Configuration
          </Link>
          .
        </div>
      ) : (
        <div className="stagegrid">
          {project.stages.map((stage) => (
            <StageCard
              key={stage.id}
              project={project}
              stage={stage}
              readOnly={closed}
              onChanged={setProject}
            />
          ))}
        </div>
      )}

      {project.statusEvents.length > 0 && (
        <>
          <div className="section-note">History</div>
          <table className="table">
            <tbody>
              {project.statusEvents.map((event) => (
                <tr key={event.id}>
                  <td style={{ width: 120 }}>{event.event === 'CLOSED' ? 'Closed' : 'Reopened'}</td>
                  <td>
                    {event.reason ? CLOSE_REASON_LABELS[event.reason] : ''}
                    {event.reasonDetail ? ` — ${event.reasonDetail}` : ''}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--ink-muted)' }}>
                    {new Date(event.at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {closing && (
        <CloseModal
          onClose={() => setClosing(false)}
          onConfirm={async (reason, detail) => {
            await api.projects.close(project.id, reason, detail);
            setProject(await api.projects.get(project.id));
            setClosing(false);
          }}
        />
      )}
    </>
  );
}

/** Closing requires a reason — the confirm button stays disabled until one is picked. */
function CloseModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: CloseReason, detail: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<CloseReason | ''>('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      title="Close project"
      subtitle="Closed cases move to the Archive. Nothing is deleted, and you can reopen it later."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-critical"
            disabled={!reason || busy}
            onClick={() => {
              setBusy(true);
              void onConfirm(reason as CloseReason, detail).finally(() => setBusy(false));
            }}
          >
            {busy ? 'Closing…' : 'Close project'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Reason (required)</label>
        <select value={reason} onChange={(event) => setReason(event.target.value as CloseReason)}>
          <option value="">Select a reason…</option>
          {(Object.keys(CLOSE_REASON_LABELS) as CloseReason[]).map((key) => (
            <option key={key} value={key}>
              {CLOSE_REASON_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Detail (optional)</label>
        <textarea value={detail} onChange={(event) => setDetail(event.target.value)} />
      </div>
    </Modal>
  );
}

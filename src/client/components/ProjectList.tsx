import { useNavigate } from 'react-router-dom';
import type { ProjectListItemDto } from '../../shared/types';
import { CLOSE_REASON_LABELS, PROJECT_TYPE_LABELS } from '../../shared/types';

export function addressOf(project: ProjectListItemDto): string {
  const street = [project.propertyStreetAddress, project.apartmentUnitNumber && `#${project.apartmentUnitNumber}`]
    .filter(Boolean)
    .join(' ');
  const city = [project.propertyCity, project.propertyState].filter(Boolean).join(', ');
  return [street, city].filter(Boolean).join(' · ') || 'No address yet';
}

export function ProjectList({ projects }: { projects: ProjectListItemDto[] }) {
  const navigate = useNavigate();

  if (projects.length === 0) {
    return <div className="empty-state">No projects here yet.</div>;
  }

  return (
    <div className="plist">
      {projects.map((project) => {
        const done = project.stageSummary.filter((s) => s.completed).length;
        const total = project.stageSummary.length;

        return (
          <div
            key={project.id}
            className="prow"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/projects/${project.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(`/projects/${project.id}`);
            }}
          >
            <div className="primary">
              <div className="addr">{addressOf(project)}</div>
              <div className="sub">
                <span className="mono">{project.caseNumber}</span>
                {project.docketNumber && <span className="mono">Docket {project.docketNumber}</span>}
                {project.tenantNames.length > 0 && <span>{project.tenantNames.join(', ')}</span>}
                {project.landlordName && <span>· {project.landlordName}</span>}
              </div>
            </div>

            <span className={`tag tag-${project.type.toLowerCase()}`}>
              {PROJECT_TYPE_LABELS[project.type]}
            </span>

            <div className="segwrap">
              <div className="segbar">
                {total === 0 ? (
                  <span className="seg" />
                ) : (
                  project.stageSummary.map((stage, index) => (
                    <span
                      key={index}
                      className={`seg${stage.completed ? ' done' : ''}`}
                      title={stage.name}
                    />
                  ))
                )}
              </div>
              <div className="lbl">
                {total === 0 ? 'No stages configured' : `${done} of ${total} stages done`}
              </div>
            </div>

            {project.closedAt ? (
              <span className="stagepill crit">
                {project.closeReason ? CLOSE_REASON_LABELS[project.closeReason] : 'Closed'}
              </span>
            ) : (
              <span className={`stagepill ${project.intakeDone ? 'ok' : 'warn'}`}>
                {project.intakeDone ? 'Intake done' : 'Intake open'}
              </span>
            )}

            <span className="chev">›</span>
          </div>
        );
      })}
    </div>
  );
}

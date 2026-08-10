import { useEffect, useState } from 'react';
import type { ProjectListItemDto } from '../../shared/types';
import { api } from '../api';
import { ProjectList } from '../components/ProjectList';

/** Closed projects. Nothing is ever deleted — this is where cases go instead. */
export function Archive() {
  const [projects, setProjects] = useState<ProjectListItemDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api.projects
        .list({ status: 'closed', search })
        .then(setProjects)
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Archive</h1>
          <div className="desc">
            Closed cases. Open one to see why it closed, or reopen it to put it back in the active list.
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div className="search">
          <input
            placeholder="Search closed cases…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? <div className="loading">Loading…</div> : <ProjectList projects={projects} />}
    </>
  );
}

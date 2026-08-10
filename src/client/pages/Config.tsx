import { useEffect, useState } from 'react';
import type { FieldType, ProjectType, StageDefinitionDto, UserDto } from '../../shared/types';
import { FIELD_TYPES, PROJECT_TYPE_LABELS } from '../../shared/types';
import { api } from '../api';
import { Modal } from '../components/Modal';

type Tab = 'STAGES' | 'USERS';

export function Config() {
  const [tab, setTab] = useState<Tab>('STAGES');

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Configuration</h1>
          <div className="desc">
            Stages and their fields are defined here, per project type. Intake is not a stage — it is
            the fixed form on every project.
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="chip-filter">
          <button className={tab === 'STAGES' ? 'active' : ''} onClick={() => setTab('STAGES')}>
            Stages &amp; fields
          </button>
          <button className={tab === 'USERS' ? 'active' : ''} onClick={() => setTab('USERS')}>
            Users
          </button>
        </div>
      </div>

      {tab === 'STAGES' ? <StageConfig /> : <UserConfig />}
    </>
  );
}

function StageConfig() {
  const [projectType, setProjectType] = useState<ProjectType>('NP');
  const [stages, setStages] = useState<StageDefinitionDto[]>([]);
  const [newStage, setNewStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh(type: ProjectType) {
    try {
      setStages(await api.config.stages(type));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load stages');
    }
  }

  useEffect(() => {
    void refresh(projectType);
  }, [projectType]);

  async function addStage() {
    if (!newStage.trim()) return;
    await api.config.createStage(projectType, newStage.trim());
    setNewStage('');
    void refresh(projectType);
  }

  return (
    <div className="admin-layout">
      <div>
        <div className="typelist">
          {(['NP', 'HOLDOVER'] as ProjectType[]).map((type) => (
            <div
              key={type}
              className={`titem${projectType === type ? ' active' : ''}`}
              onClick={() => setProjectType(type)}
            >
              <div className="tname">{PROJECT_TYPE_LABELS[type]}</div>
              <div className="tcount">
                {projectType === type ? `${stages.filter((s) => !s.hidden).length} stages` : ' '}
              </div>
            </div>
          ))}
        </div>
        <p className="field-hint" style={{ marginTop: 12 }}>
          Adding a stage adds it to every open project of this type. Closed projects keep the stages
          they had when they closed.
        </p>
      </div>

      <div>
        {error && <div className="error-banner">{error}</div>}

        <div className="stage-config">
          {stages.map((stage) => (
            <StageRow key={stage.id} stage={stage} onChanged={() => void refresh(projectType)} />
          ))}

          {stages.length === 0 && (
            <div className="empty-state">
              No stages yet for {PROJECT_TYPE_LABELS[projectType]} cases. Add the first one below.
            </div>
          )}
        </div>

        <div className="add-field-row" style={{ marginTop: 14 }}>
          <input
            placeholder="New stage name (e.g. Verification)"
            value={newStage}
            onChange={(event) => setNewStage(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void addStage()}
          />
          <button className="btn btn-sm btn-primary" onClick={() => void addStage()}>
            Add stage
          </button>
        </div>
      </div>
    </div>
  );
}

function StageRow({ stage, onChanged }: { stage: StageDefinitionDto; onChanged: () => void }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('CHECKBOX');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function addField() {
    if (!label.trim()) return;
    setError(null);
    try {
      await api.config.addField(stage.id, {
        label: label.trim(),
        type,
        required,
        options:
          type === 'SELECT'
            ? options.split(',').map((option) => option.trim()).filter(Boolean)
            : null,
      });
      setLabel('');
      setOptions('');
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add field');
    }
  }

  return (
    <div className={`stage-row${stage.hidden ? ' hidden-stage' : ''}`}>
      <div className="stage-row-head">
        <span className="sname">
          {stage.name}
          {stage.hidden && <span className="cc-role" style={{ marginLeft: 8 }}>Hidden</span>}
        </span>
        <span className="fcount">{stage.fields.filter((f) => !f.hidden).length} fields</span>
        <button
          className="linkbtn"
          onClick={() => void api.config.updateStage(stage.id, { hidden: !stage.hidden }).then(onChanged)}
        >
          {stage.hidden ? 'Unhide' : 'Hide'}
        </button>
      </div>

      <div className="stage-fields">
        {error && <div className="error-banner">{error}</div>}

        {stage.fields.map((field) => (
          <div className={`cfg-field${field.hidden ? ' is-hidden' : ''}`} key={field.id}>
            <span className={`type-badge ${field.type.toLowerCase()}`}>{field.type}</span>
            <span className="fname">{field.label}</span>
            {field.required && <span className="req">required</span>}
            <button
              className="linkbtn"
              onClick={() =>
                void api.config.updateField(field.id, { hidden: !field.hidden }).then(onChanged)
              }
            >
              {field.hidden ? 'Unhide' : 'Hide'}
            </button>
          </div>
        ))}

        {stage.fields.length === 0 && (
          <div className="field-hint">
            No fields yet — a stage with no fields is completed by hand.
          </div>
        )}

        <div className="add-field-row">
          <input
            placeholder="New field label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <select value={type} onChange={(event) => setType(event.target.value as FieldType)}>
            {FIELD_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {type === 'SELECT' && (
            <input
              placeholder="Options, comma separated"
              value={options}
              onChange={(event) => setOptions(event.target.value)}
            />
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
            />
            Required
          </label>
          <button className="btn btn-sm" onClick={() => void addField()}>
            Add field
          </button>
        </div>
        <div className="field-hint">
          Required fields decide when the stage completes. With none marked required, every field
          has to be filled instead.
        </div>
      </div>
    </div>
  );
}

function UserConfig() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setUsers(await api.users.list());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load users');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function setActive(user: UserDto, active: boolean) {
    setError(null);
    try {
      await api.users.update(user.id, { active });
      void refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update user');
    }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>
          + New user
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={user.active ? '' : 'dim'}>
              <td>
                <strong>{user.name}</strong>
              </td>
              <td>{user.email}</td>
              <td>{user.active ? 'Active' : 'Deactivated'}</td>
              <td>
                <div className="row-actions">
                  <button className="linkbtn" onClick={() => setEditing(user)}>
                    Edit
                  </button>
                  <button className="linkbtn" onClick={() => void setActive(user, !user.active)}>
                    {user.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="field-hint" style={{ marginTop: 12 }}>
        Users are deactivated, never deleted, so their name stays on the records they touched. The
        last active user cannot be deactivated.
      </p>

      {editing && (
        <UserModal
          user={editing === 'new' ? null : editing}
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

function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await api.users.update(user.id, { name, email, ...(password ? { password } : {}) });
      } else {
        await api.users.create({ name, email, password });
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save user');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={user ? 'Edit user' : 'New user'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={busy || !name || !email || (!user && password.length < 8)}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {error && <div className="error-banner">{error}</div>}

      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="field">
        <label>{user ? 'New password (leave blank to keep)' : 'Password (min 8 characters)'}</label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
    </Modal>
  );
}

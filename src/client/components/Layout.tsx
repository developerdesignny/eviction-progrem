import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/', label: 'Projects', icon: '▤', end: true },
  { to: '/archive', label: 'Archive', icon: '▣', end: false },
  { to: '/contacts', label: 'Contacts', icon: '☰', end: false },
  { to: '/config', label: 'Configuration', icon: '⚙', end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">Docket</span>
          <span className="sub">Eviction Case Mgmt</span>
        </div>

        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="ico">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="who">
            <div className="avatar">{initials}</div>
            <div>
              <div className="name">{user?.name}</div>
              <button className="signout" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Archive } from './pages/Archive';
import { Config } from './pages/Config';
import { Contacts } from './pages/Contacts';
import { Login } from './pages/Login';
import { ProjectDetail } from './pages/ProjectDetail';
import { Projects } from './pages/Projects';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading" style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/config" element={<Config />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import ClientList from './pages/ClientList';
import Login from './pages/Login';

function Header() {
  const { trainer, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          Gym Tracker
        </Link>
        <nav className="header-nav">
          <Link to="/">Klien</Link>
          {trainer?.isAdmin && <Link to="/admin/trainers">Admin</Link>}
        </nav>
        <div className="header-user">
          <span className="muted">{trainer?.username}</span>
          <button type="button" className="secondary" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}

function ProtectedLayout() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="center-screen">Memuat…</div>;
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return (
    <>
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  );
}

function Notice() {
  const { notice, clearNotice } = useAuth();
  if (!notice) return null;

  return (
    <div className="toast" role="status">
      <span>{notice}</span>
      <button type="button" className="toast-close" onClick={clearNotice} aria-label="Tutup">
        ×
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Notice />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<ClientList />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

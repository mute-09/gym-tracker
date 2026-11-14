import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import AdminTrainers from './pages/AdminTrainers';
import ClientDetail from './pages/ClientDetail';
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

function AdminDenied() {
  const { showNotice } = useAuth();
  const [redirect, setRedirect] = useState(false);

  useEffect(() => {
    showNotice('Akses ditolak');
    setRedirect(true);
  }, [showNotice]);

  if (redirect) {
    return <Navigate to="/" replace />;
  }

  return <div className="center-screen">Memeriksa akses…</div>;
}

function ProtectedLayout() {
  const { status, trainer } = useAuth();
  const location = useLocation();
  const isAdminArea =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');

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

  if (isAdminArea && trainer && !trainer.isAdmin) {
    return <AdminDenied />;
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
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/admin/trainers" element={<AdminTrainers />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

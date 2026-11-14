import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type TrainerAccount } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/format';

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function isAuthError(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

interface CreateTrainerModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateTrainerModal({ onClose, onCreated }: CreateTrainerModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Username wajib diisi.');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createTrainer({ username: trimmedUsername, password });
      onCreated();
      onClose();
    } catch (err) {
      if (isAuthError(err)) return;
      setError(messageOf(err, 'Gagal membuat trainer'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-trainer-title"
      >
        <div className="modal-head">
          <h2 id="create-trainer-title">Tambah trainer</h2>
          <button
            type="button"
            className="secondary icon-button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Username *
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoFocus
              required
            />
          </label>

          <label>
            Password *
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <p className="muted">Minimal 8 karakter. Trainer baru tidak otomatis menjadi admin.</p>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ResetPasswordModalProps {
  trainer: TrainerAccount;
  onClose: () => void;
  onReset: () => void;
}

function ResetPasswordModal({ trainer, onClose, onReset }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      await api.updateTrainer(trainer.id, { password });
      onReset();
      onClose();
    } catch (err) {
      if (isAuthError(err)) return;
      setError(messageOf(err, 'Gagal reset password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        <div className="modal-head">
          <h2 id="reset-password-title">Reset password {trainer.username}</h2>
          <button
            type="button"
            className="secondary icon-button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <p className="form-warning">Sesi login trainer ini akan berakhir.</p>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Password baru *
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              autoFocus
              required
            />
          </label>
          <p className="muted">Minimal 8 karakter.</p>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeactivateDialogProps {
  trainer: TrainerAccount;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeactivateDialog({
  trainer,
  busy,
  error,
  onCancel,
  onConfirm
}: DeactivateDialogProps) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="card modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deactivate-title"
      >
        <h2 id="deactivate-title">Nonaktifkan trainer?</h2>
        <p>
          Nonaktifkan akun <strong>{trainer.username}</strong>? Sesi login trainer ini akan
          langsung berakhir.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Memproses…' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminBadge({ value }: { value: boolean }) {
  return (
    <span className={value ? 'badge badge-admin' : 'badge badge-neutral'}>
      {value ? 'Ya' : 'Tidak'}
    </span>
  );
}

function StatusBadge({ aktif }: { aktif: boolean }) {
  return (
    <span className={aktif ? 'badge badge-success' : 'badge badge-danger'}>
      {aktif ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

export default function AdminTrainers() {
  const { trainer: currentTrainer } = useAuth();

  const [trainers, setTrainers] = useState<TrainerAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [resetting, setResetting] = useState<TrainerAccount | null>(null);
  const [deactivating, setDeactivating] = useState<TrainerAccount | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const loadTrainers = useCallback(async () => {
    try {
      const data = await api.listTrainers();
      setTrainers(data);
      setError(null);
    } catch (err) {
      if (isAuthError(err)) return;
      setError(messageOf(err, 'Gagal memuat trainer'));
    }
  }, []);

  useEffect(() => {
    void loadTrainers();
  }, [loadTrainers]);

  async function activateTrainer(trainer: TrainerAccount) {
    setPendingId(trainer.id);
    setActionError(null);

    try {
      await api.updateTrainer(trainer.id, { aktif: true });
      await loadTrainers();
    } catch (err) {
      if (isAuthError(err)) return;
      setActionError(messageOf(err, 'Gagal mengaktifkan trainer'));
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDeactivate() {
    if (!deactivating) return;

    setDeactivateBusy(true);
    setDeactivateError(null);
    setActionError(null);

    try {
      await api.updateTrainer(deactivating.id, { aktif: false });
      setDeactivating(null);
      await loadTrainers();
    } catch (err) {
      if (isAuthError(err)) return;
      setDeactivateError(messageOf(err, 'Gagal menonaktifkan trainer'));
    } finally {
      setDeactivateBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Kelola trainer</h1>
          <p className="muted">Buat akun trainer, atur status aktif, dan reset password.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setShowCreate(true);
          }}
        >
          Tambah trainer
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {trainers === null && !error && <p className="muted">Memuat trainer…</p>}

      {trainers !== null && trainers.length === 0 && (
        <div className="card empty-state">
          <h2>Belum ada trainer.</h2>
        </div>
      )}

      {trainers !== null && trainers.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Admin</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th className="actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((trainer) => {
                const isSelf = currentTrainer?.id === trainer.id;

                return (
                  <tr key={trainer.id}>
                    <td>
                      <strong>{trainer.username}</strong>
                      {isSelf && <span className="muted"> (Anda)</span>}
                    </td>
                    <td>
                      <AdminBadge value={trainer.isAdmin} />
                    </td>
                    <td>
                      <StatusBadge aktif={trainer.aktif} />
                    </td>
                    <td>{formatDate(trainer.createdAt.slice(0, 10))}</td>
                    <td>
                      <div className="table-actions">
                        {trainer.aktif ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              setDeactivateError(null);
                              setDeactivating(trainer);
                            }}
                            disabled={isSelf || pendingId === trainer.id}
                            title={
                              isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : undefined
                            }
                          >
                            {pendingId === trainer.id ? 'Memproses…' : 'Nonaktifkan'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => void activateTrainer(trainer)}
                            disabled={pendingId === trainer.id}
                          >
                            {pendingId === trainer.id ? 'Memproses…' : 'Aktifkan'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setActionError(null);
                            setResetting(trainer);
                          }}
                          disabled={isSelf}
                          title={
                            isSelf ? 'Tidak bisa reset password akun sendiri di sini' : undefined
                          }
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateTrainerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            void loadTrainers();
          }}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          trainer={resetting}
          onClose={() => setResetting(null)}
          onReset={() => {
            void loadTrainers();
          }}
        />
      )}

      {deactivating && (
        <DeactivateDialog
          trainer={deactivating}
          busy={deactivateBusy}
          error={deactivateError}
          onCancel={() => {
            if (deactivateBusy) return;
            setDeactivating(null);
            setDeactivateError(null);
          }}
          onConfirm={() => void confirmDeactivate()}
        />
      )}
    </section>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import SessionForm from '../components/SessionForm';
import {
  api,
  ApiError,
  type Client,
  type LastSummary,
  type MuscleGroup,
  type PlanDayOption,
  type Session
} from '../lib/api';
import { daysLabel, daysSince, formatDate, formatNumber, weightLabel } from '../lib/format';

type Tab = 'ringkasan' | 'sesi' | 'profil';

function topSetLabel(topSet: { berat: number | null; reps: number | null } | null) {
  if (!topSet) return '-';
  const berat = topSet.berat === null ? '-' : formatNumber(topSet.berat);
  const reps = topSet.reps === null ? '-' : topSet.reps;
  return `${berat} kg × ${reps}`;
}

function ProfileForm({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const [nama, setNama] = useState(client.nama);
  const [berat, setBerat] = useState(client.beratBadan === null ? '' : String(client.beratBadan));
  const [catatan, setCatatan] = useState(client.catatan);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNama(client.nama);
    setBerat(client.beratBadan === null ? '' : String(client.beratBadan));
    setCatatan(client.catatan);
  }, [client]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedNama = nama.trim();
    if (!trimmedNama) {
      setError('Nama wajib diisi.');
      return;
    }

    let beratBadan: number | null = null;
    if (berat.trim() !== '') {
      beratBadan = Number(berat.replace(',', '.'));
      if (!Number.isFinite(beratBadan) || beratBadan <= 0) {
        setError('Berat harus angka lebih dari 0, atau kosongkan.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.updateClient(client.id, {
        nama: trimmedNama,
        beratBadan,
        catatan: catatan.trim()
      });
      setSuccess(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Nama *
        <input
          type="text"
          value={nama}
          onChange={(event) => setNama(event.target.value)}
          required
        />
      </label>

      <label>
        Berat badan (kg)
        <input
          type="text"
          inputMode="decimal"
          value={berat}
          onChange={(event) => setBerat(event.target.value)}
          placeholder="Opsional"
        />
      </label>

      <label>
        Catatan
        <textarea
          rows={3}
          value={catatan}
          onChange={(event) => setCatatan(event.target.value)}
          placeholder="Opsional"
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="form-success" role="status">
          Profil tersimpan.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan…' : 'Simpan profil'}
        </button>
      </div>
    </form>
  );
}

interface DeleteSessionModalProps {
  session: Session;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteSessionModal({
  session,
  busy,
  error,
  onCancel,
  onConfirm
}: DeleteSessionModalProps) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-session-title"
      >
        <h2 id="delete-session-title">Hapus sesi?</h2>
        <p>
          Hapus sesi tanggal <strong>{formatDate(session.tanggal)}</strong>? Tindakan ini bisa
          dipulihkan lewat database oleh admin.
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
            {busy ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const params = useParams();
  const clientId = Number(params.id);
  const validId = Number.isInteger(clientId) && clientId > 0;

  const [tab, setTab] = useState<Tab>('ringkasan');
  const [version, setVersion] = useState(0);
  const [clientVersion, setClientVersion] = useState(0);

  const [client, setClient] = useState<Client | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [planDays, setPlanDays] = useState<PlanDayOption[]>([]);

  const [summary, setSummary] = useState<LastSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Session | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);

  const [deleting, setDeleting] = useState<Session | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;

    Promise.all([api.client(clientId), api.muscleGroups(), api.clientPlanDays(clientId)])
      .then(([clientData, groups, days]) => {
        if (cancelled) return;
        setClient(clientData);
        setMuscleGroups(groups);
        setPlanDays(days);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setClientError(
          err instanceof ApiError && err.status === 404
            ? 'Klien tidak ditemukan.'
            : err instanceof Error
              ? err.message
              : 'Gagal memuat klien'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, validId, clientVersion]);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    setSummaryError(null);

    api
      .lastSummary(clientId)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setSummaryError(err instanceof Error ? err.message : 'Gagal memuat ringkasan');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, validId, version]);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    setSessionsError(null);

    api
      .sessions(clientId)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setSessionsError(err instanceof Error ? err.message : 'Gagal memuat sesi');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, validId, version]);

  async function startEdit(sessionId: number) {
    setLoadingEditId(sessionId);
    setEditError(null);

    try {
      const data = await api.session(sessionId);
      setEditing(data);
      setTab('sesi');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setEditError(err instanceof Error ? err.message : 'Gagal memuat sesi');
    } finally {
      setLoadingEditId(null);
    }
  }

  async function handleDeleteSession() {
    if (!deleting) return;

    setDeleteError(null);
    setDeleteBusy(true);

    try {
      await api.deleteSession(deleting.id);
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
      setVersion((current) => current + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus sesi');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!validId) {
    return (
      <section className="page">
        <p className="form-error">Klien tidak ditemukan.</p>
        <Link to="/">Kembali ke daftar klien</Link>
      </section>
    );
  }

  if (clientError) {
    return (
      <section className="page">
        <p className="form-error">{clientError}</p>
        <Link to="/">Kembali ke daftar klien</Link>
      </section>
    );
  }

  if (!client) {
    return (
      <section className="page">
        <p className="muted">Memuat klien…</p>
      </section>
    );
  }

  return (
    <section className="page">
      <Link to="/" className="back-link">
        ← Klien
      </Link>

      <div className="page-head">
        <div>
          <h1>{client.nama}</h1>
          <p className="muted">Berat: {weightLabel(client.beratBadan)}</p>
          {client.catatan && <p className="muted">Catatan: {client.catatan}</p>}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Detail klien">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ringkasan'}
          className={tab === 'ringkasan' ? 'tab active' : 'tab'}
          onClick={() => setTab('ringkasan')}
        >
          Ringkasan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sesi'}
          className={tab === 'sesi' ? 'tab active' : 'tab'}
          onClick={() => setTab('sesi')}
        >
          Sesi
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'profil'}
          className={tab === 'profil' ? 'tab active' : 'tab'}
          onClick={() => setTab('profil')}
        >
          Profil
        </button>
      </div>

      <div hidden={tab !== 'ringkasan'}>
        {summaryError && <p className="form-error">{summaryError}</p>}

        {!summaryError && summary === null && <p className="muted">Memuat ringkasan…</p>}

        {summary !== null && summary.session === null && (
          <div className="card empty-state">
            <h2>Belum ada sesi tercatat</h2>
            <p className="muted">Catat sesi pertama di tab Sesi.</p>
          </div>
        )}

        {summary !== null && summary.session !== null && (
          <div className="card summary-card">
            <div className="summary-head">
              <div>
                <h2>Sesi terakhir</h2>
                <p className="muted">
                  {formatDate(summary.session.tanggal)} ·{' '}
                  {daysLabel(daysSince(summary.session.tanggal))}
                </p>
              </div>
            </div>

            <div className="chip-row">
              {summary.muscles.map((muscle) => (
                <span key={muscle.id} className="chip static">
                  {muscle.nama}
                </span>
              ))}
            </div>

            {summary.session.catatan && (
              <p className="muted">Catatan: {summary.session.catatan}</p>
            )}

            {summary.exercises.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Top set</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.exercises.map((exercise, index) => (
                    <tr key={`${exercise.namaExercise}-${index}`}>
                      <td>{exercise.namaExercise}</td>
                      <td>{topSetLabel(exercise.topSet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div hidden={tab !== 'sesi'}>
        {editError && (
          <p className="form-error" role="alert">
            {editError}
          </p>
        )}

        {editing && (
          <div className="card form-card">
            <h2>Edit sesi {formatDate(editing.tanggal)}</h2>
            <SessionForm
              key={editing.id}
              mode="edit"
              initial={editing}
              muscleGroups={muscleGroups}
              planDays={planDays}
              onSubmit={(payload) => api.updateSession(editing.id, payload)}
              onSaved={() => {
                setEditing(null);
                setVersion((current) => current + 1);
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        <div className="card form-card" hidden={editing !== null}>
          <h2>Catat sesi baru</h2>
          <SessionForm
            mode="create"
            muscleGroups={muscleGroups}
            planDays={planDays}
            onSubmit={(payload) => api.createSession(clientId, payload)}
            onSaved={() => setVersion((current) => current + 1)}
          />
        </div>

        <div className="session-list">
          <h2>Riwayat sesi</h2>

          {sessionsError && <p className="form-error">{sessionsError}</p>}
          {!sessionsError && sessions === null && <p className="muted">Memuat sesi…</p>}
          {sessions !== null && sessions.length === 0 && (
            <p className="muted">Belum ada sesi.</p>
          )}

          {sessions !== null &&
            sessions.map((session) => (
              <article className="card session-card" key={session.id}>
                <div className="session-head">
                  <div>
                    <strong>{formatDate(session.tanggal)}</strong>
                    <div className="muted">
                      {session.muscles.length > 0
                        ? session.muscles.map((muscle) => muscle.nama).join(', ')
                        : 'Tanpa tag otot'}
                    </div>
                  </div>
                  <div className="session-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void startEdit(session.id)}
                      disabled={loadingEditId === session.id}
                    >
                      {loadingEditId === session.id ? 'Memuat…' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(session);
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {session.exercises.map((exercise) => (
                  <div className="session-exercise" key={exercise.id}>
                    <span>{exercise.namaExercise}</span>
                    <span className="muted">
                      {exercise.sets
                        .map(
                          (set) =>
                            `${set.berat === null ? '-' : formatNumber(set.berat)}×${
                              set.reps === null ? '-' : set.reps
                            }`
                        )
                        .join(', ')}
                    </span>
                  </div>
                ))}

                {session.catatan && <p className="muted">Catatan: {session.catatan}</p>}
              </article>
            ))}
        </div>
      </div>

      <div hidden={tab !== 'profil'}>
        <div className="card form-card">
          <h2>Profil klien</h2>
          <ProfileForm client={client} onSaved={() => setClientVersion((current) => current + 1)} />
        </div>
      </div>

      {deleting && (
        <DeleteSessionModal
          session={deleting}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (deleteBusy) return;
            setDeleting(null);
            setDeleteError(null);
          }}
          onConfirm={() => void handleDeleteSession()}
        />
      )}
    </section>
  );
}

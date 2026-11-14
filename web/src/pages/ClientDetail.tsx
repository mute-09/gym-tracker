import { useEffect, useState } from 'react';
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
import { daysLabel, formatDate, formatNumber, weightLabel } from '../lib/format';

type Tab = 'ringkasan' | 'sesi';

function topSetLabel(topSet: { berat: number | null; reps: number | null } | null) {
  if (!topSet) return '-';
  const berat = topSet.berat === null ? '-' : formatNumber(topSet.berat);
  const reps = topSet.reps === null ? '-' : topSet.reps;
  return `${berat} kg × ${reps}`;
}

export default function ClientDetail() {
  const params = useParams();
  const clientId = Number(params.id);
  const validId = Number.isInteger(clientId) && clientId > 0;

  const [tab, setTab] = useState<Tab>('ringkasan');
  const [version, setVersion] = useState(0);

  const [client, setClient] = useState<Client | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [planDays, setPlanDays] = useState<PlanDayOption[]>([]);

  const [summary, setSummary] = useState<LastSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

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
  }, [clientId, validId]);

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
                  {formatDate(summary.session.tanggal)} · {daysLabel(summary.daysAgo)}
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
        <div className="card form-card">
          <h2>Catat sesi baru</h2>
          <SessionForm
            clientId={clientId}
            muscleGroups={muscleGroups}
            planDays={planDays}
            onCreated={() => setVersion((current) => current + 1)}
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
                  <strong>{formatDate(session.tanggal)}</strong>
                  <span className="muted">
                    {session.muscles.length > 0
                      ? session.muscles.map((muscle) => muscle.nama).join(', ')
                      : 'Tanpa tag otot'}
                  </span>
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
    </section>
  );
}

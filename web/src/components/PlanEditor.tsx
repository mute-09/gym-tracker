import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  api,
  ApiError,
  type Plan,
  type PlanDay,
  type PlanDayBase,
  type PlanExercise,
  type PlanSummary
} from '../lib/api';
import DayModal from './DayModal';
import ExerciseModal from './ExerciseModal';

interface PlanEditorProps {
  clientId: number;
  onPlanDaysChanged?: () => void;
}

type PlanNameModalState =
  | { mode: 'create' }
  | { mode: 'rename'; id: number; current: string };

type DayModalState = { mode: 'create' } | { mode: 'edit'; day: PlanDayBase };

type ExerciseModalState =
  | { mode: 'create'; day: PlanDay }
  | { mode: 'edit'; day: PlanDay; exercise: PlanExercise };

type ConfirmState =
  | { kind: 'archive-plan'; id: number; nama: string }
  | { kind: 'delete-day'; day: PlanDayBase }
  | { kind: 'delete-exercise'; exercise: PlanExercise };

function isAuthError(err: unknown) {
  return err instanceof ApiError && err.status === 401;
}

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function nextUrutan(items: { urutan: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.urutan), -1) + 1;
}

function exerciseTarget(exercise: PlanExercise) {
  const sets = exercise.setTarget === null ? null : `${exercise.setTarget} set`;
  const reps = exercise.repTarget ? `${exercise.repTarget} rep` : null;
  if (!sets && !reps) return 'Target belum diisi';
  return [sets, reps].filter(Boolean).join(' × ');
}

interface PlanNameModalProps {
  mode: 'create' | 'rename';
  initialName?: string;
  onClose: () => void;
  onSubmit: (nama: string) => Promise<void>;
}

function PlanNameModal({ mode, initialName, onClose, onSubmit }: PlanNameModalProps) {
  const [nama, setNama] = useState(initialName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = nama.trim();
    if (!trimmed) {
      setError('Nama plan wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(messageOf(err, 'Gagal menyimpan plan'));
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
        aria-labelledby="plan-name-title"
      >
        <div className="modal-head">
          <h2 id="plan-name-title">{mode === 'create' ? 'Tambah plan' : 'Ganti nama plan'}</h2>
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
            Nama plan *
            <input
              type="text"
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="PPL, Upper/Lower, 12 minggu…"
              autoFocus
              required
            />
          </label>

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

interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  error,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
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
        aria-labelledby="confirm-title"
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{body}</p>

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
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanEditor({ clientId, onPlanDaysChanged }: PlanEditorProps) {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [planNameModal, setPlanNameModal] = useState<PlanNameModalState | null>(null);
  const [dayModal, setDayModal] = useState<DayModalState | null>(null);
  const [exerciseModal, setExerciseModal] = useState<ExerciseModalState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const loadPlans = useCallback(
    async (preferId?: number | null) => {
      try {
        const data = await api.listPlans(clientId);
        setPlans(data);
        setPlansError(null);
        setSelectedPlanId((current) => {
          const wanted = preferId === undefined ? current : preferId;
          if (wanted !== null && data.some((item) => item.id === wanted)) return wanted;
          return data[0]?.id ?? null;
        });
      } catch (err) {
        if (isAuthError(err)) return;
        setPlansError(messageOf(err, 'Gagal memuat plan'));
      }
    },
    [clientId]
  );

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (selectedPlanId === null) {
      setPlan(null);
      setPlanError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setPlanError(null);

    api
      .plan(selectedPlanId)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch((err: unknown) => {
        if (cancelled || isAuthError(err)) return;
        setPlan(null);
        setPlanError(messageOf(err, 'Gagal memuat plan'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlanId]);

  async function refreshPlanSafe(id: number | null = selectedPlanId) {
    if (id === null) return;
    try {
      const data = await api.plan(id);
      setPlan(data);
      setPlanError(null);
    } catch (err) {
      if (isAuthError(err)) return;
      setActionError(messageOf(err, 'Gagal memuat ulang plan'));
    }
  }

  async function handlePlanNameSubmit(nama: string) {
    if (!planNameModal) return;
    setActionError(null);

    if (planNameModal.mode === 'create') {
      const created = await api.createPlan(clientId, { nama });
      setPlanNameModal(null);
      await loadPlans(created.id);
    } else {
      const id = planNameModal.id;
      await api.updatePlan(id, { nama });
      setPlanNameModal(null);
      await loadPlans(id);
      await refreshPlanSafe(id);
      onPlanDaysChanged?.();
    }
  }

  async function handleDaySubmit(payload: { weekNumber: number | null; label: string }) {
    if (!dayModal) return;
    setActionError(null);

    if (dayModal.mode === 'create') {
      if (!plan) throw new Error('Plan belum dimuat.');
      await api.createDay(plan.id, { ...payload, urutan: nextUrutan(plan.days) });
    } else {
      await api.updateDay(dayModal.day.id, payload);
    }

    setDayModal(null);
    onPlanDaysChanged?.();
    await refreshPlanSafe();
  }

  async function handleExerciseSubmit(payload: {
    namaExercise: string;
    setTarget: number | null;
    repTarget: string | null;
  }) {
    if (!exerciseModal) return;
    setActionError(null);

    if (exerciseModal.mode === 'create') {
      await api.createExercise(exerciseModal.day.id, {
        ...payload,
        urutan: nextUrutan(exerciseModal.day.exercises)
      });
    } else {
      await api.updateExercise(exerciseModal.exercise.id, payload);
    }

    setExerciseModal(null);
    await refreshPlanSafe();
  }

  async function persistDayOrder(ordered: PlanDay[]) {
    setBusy(true);
    setActionError(null);

    try {
      for (let index = 0; index < ordered.length; index += 1) {
        if (ordered[index].urutan !== index) {
          await api.updateDay(ordered[index].id, { urutan: index });
        }
      }
      onPlanDaysChanged?.();
      await refreshPlanSafe();
    } catch (err) {
      if (isAuthError(err)) return;
      setActionError(messageOf(err, 'Gagal mengubah urutan day'));
      await refreshPlanSafe();
    } finally {
      setBusy(false);
    }
  }

  async function persistExerciseOrder(ordered: PlanExercise[]) {
    setBusy(true);
    setActionError(null);

    try {
      for (let index = 0; index < ordered.length; index += 1) {
        if (ordered[index].urutan !== index) {
          await api.updateExercise(ordered[index].id, { urutan: index });
        }
      }
      await refreshPlanSafe();
    } catch (err) {
      if (isAuthError(err)) return;
      setActionError(messageOf(err, 'Gagal mengubah urutan exercise'));
      await refreshPlanSafe();
    } finally {
      setBusy(false);
    }
  }

  function moveDay(index: number, delta: number) {
    if (!plan || busy) return;
    const target = index + delta;
    if (target < 0 || target >= plan.days.length) return;

    const ordered = [...plan.days];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void persistDayOrder(ordered);
  }

  function moveExercise(day: PlanDay, index: number, delta: number) {
    if (busy) return;
    const target = index + delta;
    if (target < 0 || target >= day.exercises.length) return;

    const ordered = [...day.exercises];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void persistExerciseOrder(ordered);
  }

  async function handleConfirm() {
    if (!confirm) return;

    setBusy(true);
    setActionError(null);
    setConfirmError(null);

    try {
      if (confirm.kind === 'archive-plan') {
        await api.deletePlan(confirm.id);
        if (selectedPlanId === confirm.id) setPlan(null);
        setConfirm(null);
        onPlanDaysChanged?.();
        await loadPlans(null);
      } else if (confirm.kind === 'delete-day') {
        await api.deleteDay(confirm.day.id);
        setConfirm(null);
        onPlanDaysChanged?.();
        await refreshPlanSafe();
      } else {
        await api.deleteExercise(confirm.exercise.id);
        setConfirm(null);
        await refreshPlanSafe();
      }
    } catch (err) {
      if (isAuthError(err)) return;
      setConfirmError(messageOf(err, 'Gagal memproses'));
    } finally {
      setBusy(false);
    }
  }

  function openConfirm(next: ConfirmState) {
    setConfirmError(null);
    setConfirm(next);
  }

  const confirmBody =
    confirm === null
      ? null
      : confirm.kind === 'archive-plan'
        ? `Arsipkan plan '${confirm.nama}'? Plan hilang dari daftar, histori sesi tetap utuh.`
        : confirm.kind === 'delete-day'
          ? `Hapus day '${confirm.day.label}'? Semua exercise di dalamnya ikut terhapus.`
          : `Hapus exercise '${confirm.exercise.namaExercise}'?`;

  return (
    <div className="plan-editor">
      <div className="plan-toolbar">
        {plans !== null && plans.length > 0 ? (
          <div className="plan-tabs" role="tablist" aria-label="Plan klien">
            {plans.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === selectedPlanId}
                className={item.id === selectedPlanId ? 'tab active' : 'tab'}
                onClick={() => {
                  setSelectedPlanId(item.id);
                  setActionError(null);
                }}
              >
                {item.nama}
                <span className="plan-tab-count">
                  {plan !== null && plan.id === item.id ? plan.days.length : item.dayCount}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <span className="muted">Plan latihan</span>
        )}

        <button type="button" onClick={() => setPlanNameModal({ mode: 'create' })}>
          Tambah plan
        </button>
      </div>

      {plansError && (
        <p className="form-error" role="alert">
          {plansError}
        </p>
      )}

      {plans === null && !plansError && <p className="muted">Memuat plan…</p>}

      {plans !== null && plans.length === 0 && (
        <div className="card empty-state">
          <h2>Belum ada plan</h2>
          <p className="muted">Buat plan pertama untuk klien ini.</p>
          <button type="button" onClick={() => setPlanNameModal({ mode: 'create' })}>
            Tambah plan
          </button>
        </div>
      )}

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {plans !== null && plans.length > 0 && selectedPlanId !== null && (
        <>
          {(plan === null || plan.id !== selectedPlanId) && detailLoading && (
            <p className="muted">Memuat plan…</p>
          )}

          {planError && <p className="form-error">{planError}</p>}

          {plan !== null && plan.id === selectedPlanId && (
            <>
              <div className="plan-head">
                <div>
                  <h2>{plan.nama}</h2>
                  <p className="muted">
                    {plan.days.length} day · {plan.days.reduce((sum, day) => sum + day.exercises.length, 0)}{' '}
                    exercise
                  </p>
                </div>
                <div className="session-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setPlanNameModal({ mode: 'rename', id: plan.id, current: plan.nama })
                    }
                    disabled={busy}
                  >
                    Edit nama
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      openConfirm({ kind: 'archive-plan', id: plan.id, nama: plan.nama })
                    }
                    disabled={busy}
                  >
                    Arsipkan
                  </button>
                </div>
              </div>

              {plan.days.length === 0 ? (
                <div className="card empty-state">
                  <p className="muted">Belum ada day. Tambah day pertama.</p>
                  <button type="button" onClick={() => setDayModal({ mode: 'create' })}>
                    Tambah day
                  </button>
                </div>
              ) : (
                <div className="day-list">
                  {plan.days.map((day, dayIndex) => (
                    <article className="card plan-day" key={day.id}>
                      <div className="day-head">
                        <div>
                          <h3>
                            {day.weekNumber !== null && `Minggu ${day.weekNumber} · `}
                            {day.label}
                          </h3>
                          <p className="muted">{day.exercises.length} exercise</p>
                        </div>

                        <div className="row-actions">
                          <button
                            type="button"
                            className="secondary icon-button"
                            aria-label={`Naikkan day ${day.label}`}
                            title="Naik"
                            onClick={() => moveDay(dayIndex, -1)}
                            disabled={busy || dayIndex === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="secondary icon-button"
                            aria-label={`Turunkan day ${day.label}`}
                            title="Turun"
                            onClick={() => moveDay(dayIndex, 1)}
                            disabled={busy || dayIndex === plan.days.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setDayModal({ mode: 'edit', day })}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => openConfirm({ kind: 'delete-day', day })}
                            disabled={busy}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      {day.exercises.length === 0 ? (
                        <p className="muted">Belum ada exercise.</p>
                      ) : (
                        <div className="plan-exercises">
                          {day.exercises.map((exercise, exerciseIndex) => (
                            <div className="plan-exercise" key={exercise.id}>
                              <div className="grow">
                                <strong>{exercise.namaExercise}</strong>
                                <span className="exercise-target">{exerciseTarget(exercise)}</span>
                              </div>

                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="secondary icon-button"
                                  aria-label={`Naikkan exercise ${exercise.namaExercise}`}
                                  title="Naik"
                                  onClick={() => moveExercise(day, exerciseIndex, -1)}
                                  disabled={busy || exerciseIndex === 0}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="secondary icon-button"
                                  aria-label={`Turunkan exercise ${exercise.namaExercise}`}
                                  title="Turun"
                                  onClick={() => moveExercise(day, exerciseIndex, 1)}
                                  disabled={busy || exerciseIndex === day.exercises.length - 1}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() =>
                                    setExerciseModal({ mode: 'edit', day, exercise })
                                  }
                                  disabled={busy}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() =>
                                    openConfirm({ kind: 'delete-exercise', exercise })
                                  }
                                  disabled={busy}
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setExerciseModal({ mode: 'create', day })}
                          disabled={busy}
                        >
                          Tambah exercise
                        </button>
                      </div>
                    </article>
                  ))}

                  <div>
                    <button type="button" onClick={() => setDayModal({ mode: 'create' })}>
                      Tambah day
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {planNameModal && (
        <PlanNameModal
          mode={planNameModal.mode}
          initialName={planNameModal.mode === 'rename' ? planNameModal.current : undefined}
          onClose={() => setPlanNameModal(null)}
          onSubmit={handlePlanNameSubmit}
        />
      )}

      {dayModal && (
        <DayModal
          mode={dayModal.mode}
          initial={dayModal.mode === 'edit' ? dayModal.day : undefined}
          onClose={() => setDayModal(null)}
          onSubmit={handleDaySubmit}
        />
      )}

      {exerciseModal && (
        <ExerciseModal
          mode={exerciseModal.mode}
          initial={exerciseModal.mode === 'edit' ? exerciseModal.exercise : undefined}
          onClose={() => setExerciseModal(null)}
          onSubmit={handleExerciseSubmit}
        />
      )}

      {confirm && confirmBody !== null && (
        <ConfirmDialog
          title={
            confirm.kind === 'archive-plan'
              ? 'Arsipkan plan?'
              : confirm.kind === 'delete-day'
                ? 'Hapus day?'
                : 'Hapus exercise?'
          }
          body={confirmBody}
          confirmLabel={
            confirm.kind === 'archive-plan'
              ? 'Arsipkan'
              : confirm.kind === 'delete-day'
                ? 'Hapus day'
                : 'Hapus exercise'
          }
          busy={busy}
          error={confirmError}
          onCancel={() => {
            if (busy) return;
            setConfirm(null);
            setConfirmError(null);
          }}
          onConfirm={() => void handleConfirm()}
        />
      )}
    </div>
  );
}

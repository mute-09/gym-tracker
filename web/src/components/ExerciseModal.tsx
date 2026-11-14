import { useState, type FormEvent } from 'react';
import type { PlanExercise } from '../lib/api';

interface ExerciseModalProps {
  mode: 'create' | 'edit';
  initial?: PlanExercise;
  onClose: () => void;
  onSubmit: (payload: {
    namaExercise: string;
    setTarget: number | null;
    repTarget: string | null;
  }) => Promise<void>;
}

export default function ExerciseModal({ mode, initial, onClose, onSubmit }: ExerciseModalProps) {
  const [namaExercise, setNamaExercise] = useState(initial?.namaExercise ?? '');
  const [setTarget, setSetTarget] = useState(
    initial?.setTarget === null || initial?.setTarget === undefined ? '' : String(initial.setTarget)
  );
  const [repTarget, setRepTarget] = useState(initial?.repTarget ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedNama = namaExercise.trim();
    if (!trimmedNama) {
      setError('Nama exercise wajib diisi.');
      return;
    }

    let parsedSets: number | null = null;
    const trimmedSets = setTarget.trim();
    if (trimmedSets !== '') {
      if (!/^\d+$/.test(trimmedSets)) {
        setError('Set target harus angka bulat minimal 1, atau kosongkan.');
        return;
      }
      parsedSets = Number(trimmedSets);
      if (!Number.isSafeInteger(parsedSets) || parsedSets < 1) {
        setError('Set target harus angka bulat minimal 1, atau kosongkan.');
        return;
      }
    }

    const trimmedReps = repTarget.trim();

    setSubmitting(true);
    try {
      await onSubmit({
        namaExercise: trimmedNama,
        setTarget: parsedSets,
        repTarget: trimmedReps === '' ? null : trimmedReps
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan exercise');
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
        aria-labelledby="exercise-modal-title"
      >
        <div className="modal-head">
          <h2 id="exercise-modal-title">
            {mode === 'create' ? 'Tambah exercise' : 'Edit exercise'}
          </h2>
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
            Nama exercise *
            <input
              type="text"
              value={namaExercise}
              onChange={(event) => setNamaExercise(event.target.value)}
              placeholder="Bench Press"
              autoFocus
              required
            />
          </label>

          <div className="form-grid">
            <label>
              Set target
              <input
                type="text"
                inputMode="numeric"
                value={setTarget}
                onChange={(event) => setSetTarget(event.target.value)}
                placeholder="Opsional"
              />
            </label>

            <label>
              Rep target
              <input
                type="text"
                value={repTarget}
                onChange={(event) => setRepTarget(event.target.value)}
                placeholder="8-12 atau 10"
              />
            </label>
          </div>

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

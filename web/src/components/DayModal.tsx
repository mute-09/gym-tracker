import { useState, type FormEvent } from 'react';
import type { PlanDayBase } from '../lib/api';

interface DayModalProps {
  mode: 'create' | 'edit';
  initial?: PlanDayBase;
  onClose: () => void;
  onSubmit: (payload: { weekNumber: number | null; label: string }) => Promise<void>;
}

export default function DayModal({ mode, initial, onClose, onSubmit }: DayModalProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [weekNumber, setWeekNumber] = useState(
    initial?.weekNumber === null || initial?.weekNumber === undefined
      ? ''
      : String(initial.weekNumber)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Label wajib diisi.');
      return;
    }

    let parsedWeek: number | null = null;
    const trimmedWeek = weekNumber.trim();
    if (trimmedWeek !== '') {
      if (!/^\d+$/.test(trimmedWeek)) {
        setError('Minggu harus angka bulat positif, atau kosongkan.');
        return;
      }
      parsedWeek = Number(trimmedWeek);
      if (!Number.isSafeInteger(parsedWeek) || parsedWeek < 1) {
        setError('Minggu harus angka bulat positif, atau kosongkan.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({ weekNumber: parsedWeek, label: trimmedLabel });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan day');
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
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="day-modal-title">
        <div className="modal-head">
          <h2 id="day-modal-title">{mode === 'create' ? 'Tambah day' : 'Edit day'}</h2>
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
            Label *
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Push, Upper, Day 1…"
              autoFocus
              required
            />
          </label>

          <label>
            Minggu (opsional)
            <input
              type="text"
              inputMode="numeric"
              value={weekNumber}
              onChange={(event) => setWeekNumber(event.target.value)}
              placeholder="kosongkan untuk PPL/tanpa minggu"
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

import { useEffect, useState, type FormEvent } from 'react';
import { api, type MuscleGroup, type NewSession, type PlanDayOption } from '../lib/api';
import { todayLocal } from '../lib/format';

interface SetDraft {
  berat: string;
  reps: string;
}

interface ExerciseDraft {
  namaExercise: string;
  sets: SetDraft[];
}

interface SessionFormProps {
  clientId: number;
  muscleGroups: MuscleGroup[];
  planDays: PlanDayOption[];
  onCreated: () => void;
}

function emptySet(): SetDraft {
  return { berat: '', reps: '' };
}

function emptyExercise(): ExerciseDraft {
  return { namaExercise: '', sets: [emptySet()] };
}

function planDayLabel(day: PlanDayOption) {
  const week = day.weekNumber === null ? '' : `W${day.weekNumber} · `;
  return `${day.planNama} — ${week}${day.label}`;
}

export default function SessionForm({
  clientId,
  muscleGroups,
  planDays,
  onCreated
}: SessionFormProps) {
  const [tanggal, setTanggal] = useState(todayLocal);
  const [planDayId, setPlanDayId] = useState('');
  const [muscleIds, setMuscleIds] = useState<number[]>([]);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise()]);
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  function toggleMuscle(id: number) {
    setMuscleIds((prev) =>
      prev.includes(id) ? prev.filter((muscleId) => muscleId !== id) : [...prev, id]
    );
  }

  function updateExercise(index: number, patch: Partial<ExerciseDraft>) {
    setExercises((prev) =>
      prev.map((exercise, current) => (current === index ? { ...exercise, ...patch } : exercise))
    );
  }

  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()]);
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, current) => current !== index));
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) =>
      prev.map((exercise, current) =>
        current === exerciseIndex ? { ...exercise, sets: [...exercise.sets, emptySet()] } : exercise
      )
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) =>
      prev.map((exercise, current) =>
        current === exerciseIndex
          ? { ...exercise, sets: exercise.sets.filter((_, i) => i !== setIndex) }
          : exercise
      )
    );
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetDraft>) {
    setExercises((prev) =>
      prev.map((exercise, current) =>
        current === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, i) => (i === setIndex ? { ...set, ...patch } : set))
            }
          : exercise
      )
    );
  }

  function buildPayload(): NewSession | string {
    if (!tanggal) return 'Tanggal wajib diisi.';
    if (muscleIds.length === 0) return 'Pilih minimal 1 otot.';
    if (exercises.length === 0) return 'Tambahkan minimal 1 exercise.';

    const builtExercises: NewSession['exercises'] = [];

    for (let i = 0; i < exercises.length; i += 1) {
      const exercise = exercises[i];
      const nama = exercise.namaExercise.trim();
      if (!nama) return `Nama exercise #${i + 1} wajib diisi.`;
      if (exercise.sets.length === 0) return `Exercise "${nama}" minimal punya 1 set.`;

      const sets: { berat: number; reps: number }[] = [];

      for (let j = 0; j < exercise.sets.length; j += 1) {
        const set = exercise.sets[j];

        if (set.berat.trim() === '') {
          return `Berat set ${j + 1} pada "${nama}" wajib diisi (isi 0 untuk bodyweight).`;
        }
        const berat = Number(set.berat.replace(',', '.'));
        if (!Number.isFinite(berat) || berat < 0) {
          return `Berat set ${j + 1} pada "${nama}" harus angka >= 0.`;
        }

        if (set.reps.trim() === '') {
          return `Reps set ${j + 1} pada "${nama}" wajib diisi.`;
        }
        const reps = Number(set.reps);
        if (!Number.isInteger(reps) || reps < 1) {
          return `Reps set ${j + 1} pada "${nama}" harus bilangan bulat >= 1.`;
        }

        sets.push({ berat, reps });
      }

      builtExercises.push({ namaExercise: nama, sets });
    }

    return {
      tanggal,
      planDayId: planDayId === '' ? null : Number(planDayId),
      catatan: catatan.trim(),
      muscleGroupIds: muscleIds,
      exercises: builtExercises
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const payload = buildPayload();
    if (typeof payload === 'string') {
      setError(payload);
      return;
    }

    setSubmitting(true);
    try {
      await api.createSession(clientId, payload);
      setTanggal(todayLocal());
      setPlanDayId('');
      setMuscleIds([]);
      setExercises([emptyExercise()]);
      setCatatan('');
      setSuccess(true);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan sesi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack-form session-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Tanggal *
          <input
            type="date"
            value={tanggal}
            onChange={(event) => setTanggal(event.target.value)}
            required
          />
        </label>

        <label>
          Plan day (opsional)
          <select
            value={planDayId}
            onChange={(event) => setPlanDayId(event.target.value)}
            disabled={planDays.length === 0}
          >
            <option value="">
              {planDays.length === 0 ? 'Belum ada plan day' : 'Tanpa plan day'}
            </option>
            {planDays.map((day) => (
              <option key={day.id} value={day.id}>
                {planDayLabel(day)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="field-group">
        <legend>Otot dilatih *</legend>
        <div className="chip-row">
          {muscleGroups.map((muscle) => {
            const selected = muscleIds.includes(muscle.id);
            return (
              <label key={muscle.id} className={selected ? 'chip selected' : 'chip'}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleMuscle(muscle.id)}
                />
                <span>{muscle.nama}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="exercise-list">
        {exercises.map((exercise, exerciseIndex) => (
          <div className="exercise-card" key={exerciseIndex}>
            <div className="exercise-head">
              <label className="grow">
                Exercise {exerciseIndex + 1} *
                <input
                  type="text"
                  value={exercise.namaExercise}
                  onChange={(event) =>
                    updateExercise(exerciseIndex, { namaExercise: event.target.value })
                  }
                  placeholder="Bench Press"
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => removeExercise(exerciseIndex)}
              >
                Hapus exercise
              </button>
            </div>

            <div className="set-rows">
              <div className="set-header">
                <span>Set</span>
                <span>Berat (kg)</span>
                <span>Reps</span>
                <span />
              </div>
              {exercise.sets.map((set, setIndex) => (
                <div className="set-row" key={setIndex}>
                  <span className="set-number">{setIndex + 1}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={set.berat}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, { berat: event.target.value })
                    }
                    placeholder="0"
                    aria-label={`Berat set ${setIndex + 1}`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, { reps: event.target.value })
                    }
                    placeholder="0"
                    aria-label={`Reps set ${setIndex + 1}`}
                  />
                  <button
                    type="button"
                    className="secondary icon-button"
                    onClick={() => removeSet(exerciseIndex, setIndex)}
                    aria-label={`Hapus set ${setIndex + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="secondary" onClick={() => addSet(exerciseIndex)}>
              + Set
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="secondary" onClick={addExercise}>
        + Exercise
      </button>

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
          Sesi tersimpan.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan…' : 'Simpan sesi'}
        </button>
      </div>
    </form>
  );
}

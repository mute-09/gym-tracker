import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Client } from '../lib/api';
import { daysLabel, weightLabel } from '../lib/format';

interface AddClientModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddClientModal({ onClose, onCreated }: AddClientModalProps) {
  const [nama, setNama] = useState('');
  const [berat, setBerat] = useState('');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
      await api.createClient({
        nama: trimmedNama,
        beratBadan,
        catatan: catatan.trim()
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah klien');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
      >
        <div className="modal-head">
          <h2 id="add-client-title">Tambah klien</h2>
          <button type="button" className="secondary icon-button" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Nama *
            <input
              type="text"
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              autoFocus
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

export default function ClientList() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const data = await api.clients();
      setClients(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Gagal memuat klien');
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Klien</h1>
          <p className="muted">Semua trainer dapat melihat dan mengedit semua klien.</p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)}>
          Tambah klien
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {clients === null && !error && <p className="muted">Memuat klien…</p>}

      {clients !== null && clients.length === 0 && (
        <div className="card empty-state">
          <h2>Belum ada klien</h2>
          <p className="muted">Klik “Tambah klien” untuk memulai.</p>
        </div>
      )}

      {clients !== null && clients.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Berat</th>
                <th>Sesi terakhir</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.nama}</td>
                  <td>{weightLabel(client.beratBadan)}</td>
                  <td>{daysLabel(client.daysAgo)}</td>
                  <td className="actions">
                    <Link className="button-link" to={`/clients/${client.id}`}>
                      Buka
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            void loadClients();
          }}
        />
      )}
    </section>
  );
}

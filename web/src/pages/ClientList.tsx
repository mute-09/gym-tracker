import { useEffect, useState } from 'react';
import { api, ApiError, type Client } from '../lib/api';

function sessionLabel(client: Client) {
  if (client.daysAgo === null) {
    return 'Belum ada sesi';
  }
  if (client.daysAgo === 0) {
    return 'Hari ini';
  }
  if (client.daysAgo === 1) {
    return '1 hari lalu';
  }
  return `${client.daysAgo} hari lalu`;
}

export default function ClientList() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .clients()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat klien');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Klien</h1>
          <p className="muted">Semua trainer dapat melihat dan mengedit semua klien.</p>
        </div>
        <button type="button" disabled title="Form tambah klien menyusul di M8">
          Tambah klien
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {clients === null && !error && <p className="muted">Memuat klien…</p>}

      {clients !== null && clients.length === 0 && (
        <div className="card empty-state">
          <h2>Belum ada klien</h2>
          <p className="muted">Klien pertama akan tampil di sini setelah ditambahkan.</p>
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
                  <td>{client.beratBadan === null ? '—' : `${client.beratBadan} kg`}</td>
                  <td>{sessionLabel(client)}</td>
                  <td className="actions">
                    <button type="button" disabled title="Detail klien tersedia di M8">
                      Buka
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

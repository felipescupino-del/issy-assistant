'use client';

import { useState, useEffect, useCallback } from 'react';
import BrokerTable from '@/components/brokers/BrokerTable';
import CsvImportDialog from '@/components/brokers/CsvImportDialog';

interface Batch {
  id: number;
  name: string;
  count: number;
  importedAt: string;
}

interface Broker {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  susep: string | null;
  city: string | null;
  state: string | null;
  importBatch: { id: number; name: string } | null;
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState('');

  const fetchBatches = useCallback(async () => {
    const res = await fetch('/api/brokers/batches');
    if (res.ok) setBatches(await res.json());
  }, []);

  const fetchBrokers = useCallback(async () => {
    setLoading(true);
    const url = selectedBatch
      ? `/api/brokers?batchId=${selectedBatch}`
      : '/api/brokers';
    const res = await fetch(url);
    if (res.ok) setBrokers(await res.json());
    setLoading(false);
  }, [selectedBatch]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    fetchBrokers();
  }, [fetchBrokers]);

  function handleImportSuccess(result: { imported: number; skipped: number; batchName: string }) {
    setImportOpen(false);
    setToast(`Importados ${result.imported} corretores no lote "${result.batchName}"`);
    setTimeout(() => setToast(''), 4000);
    fetchBatches();
    fetchBrokers();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Corretores</h1>

        <div className="flex items-center gap-3">
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos os lotes</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.count})
              </option>
            ))}
          </select>

          <button
            onClick={() => setImportOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Importar CSV
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}

      <p className="mb-3 text-sm text-gray-500">
        {loading ? 'Carregando...' : `${brokers.length} corretor(es)`}
      </p>

      <BrokerTable brokers={brokers} loading={loading} />

      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}

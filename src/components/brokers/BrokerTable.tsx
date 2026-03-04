'use client';

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

interface BrokerTableProps {
  brokers: Broker[];
  loading: boolean;
}

export default function BrokerTable({ brokers, loading }: BrokerTableProps) {
  if (loading) {
    return <p className="py-8 text-center text-gray-500">Carregando...</p>;
  }

  if (brokers.length === 0) {
    return <p className="py-8 text-center text-gray-500">Nenhum corretor encontrado</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nome</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Telefone</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">SUSEP</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cidade</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">UF</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Lote</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {brokers.map((broker) => (
            <tr key={broker.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{broker.name}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{broker.email ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{broker.phone ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{broker.susep ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{broker.city ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{broker.state ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {broker.importBatch ? (
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {broker.importBatch.name}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

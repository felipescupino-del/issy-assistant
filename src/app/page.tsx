import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Issy Assistant</h1>
        <p className="text-gray-600 mb-6">Painel de gestão</p>
        <Link
          href="/brokers"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Gerenciar Corretores
        </Link>
      </div>
    </main>
  );
}

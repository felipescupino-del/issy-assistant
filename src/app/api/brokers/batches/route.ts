import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { importedAt: 'desc' },
    });

    return NextResponse.json(batches);
  } catch (err) {
    console.error('[Batches] Error:', err);
    return NextResponse.json({ error: 'Erro ao buscar lotes' }, { status: 500 });
  }
}

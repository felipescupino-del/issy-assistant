import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    const where = batchId ? { importBatchId: Number(batchId) } : {};

    const brokers = await prisma.broker.findMany({
      where,
      include: { importBatch: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(brokers);
  } catch (err) {
    console.error('[Brokers] Error:', err);
    return NextResponse.json({ error: 'Erro ao buscar corretores' }, { status: 500 });
  }
}

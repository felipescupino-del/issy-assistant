import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CsvRow {
  nome: string;
  email?: string;
  telefone?: string;
  susep?: string;
  cidade?: string;
  estado?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map((v) => v.trim());
    if (values.length < 1 || !values[0]) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    rows.push({
      nome: row['nome'] || row['name'] || '',
      email: row['email'] || undefined,
      telefone: row['telefone'] || row['phone'] || row['celular'] || undefined,
      susep: row['susep'] || undefined,
      cidade: row['cidade'] || row['city'] || undefined,
      estado: row['estado'] || row['uf'] || row['state'] || undefined,
    });
  }

  return rows.filter((r) => r.nome);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const batchName = (formData.get('name') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV vazio ou formato inválido' }, { status: 400 });
    }

    // Create import batch
    const now = new Date();
    const defaultName = `Importação ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const batch = await prisma.importBatch.create({
      data: { name: batchName || defaultName },
    });

    let imported = 0;
    let skipped = 0;
    const issues: string[] = [];

    for (const row of rows) {
      try {
        if (row.telefone) {
          await prisma.broker.upsert({
            where: { phone: row.telefone },
            create: {
              name: row.nome,
              email: row.email,
              phone: row.telefone,
              susep: row.susep,
              city: row.cidade,
              state: row.estado,
              importBatchId: batch.id,
            },
            update: {
              name: row.nome,
              email: row.email,
              susep: row.susep,
              city: row.cidade,
              state: row.estado,
              importBatchId: batch.id,
            },
          });
        } else {
          await prisma.broker.create({
            data: {
              name: row.nome,
              email: row.email,
              phone: row.telefone,
              susep: row.susep,
              city: row.cidade,
              state: row.estado,
              importBatchId: batch.id,
            },
          });
        }
        imported++;
      } catch (err) {
        skipped++;
        issues.push(`Linha "${row.nome}": ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      }
    }

    // Update batch count
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { count: imported },
    });

    return NextResponse.json({
      imported,
      skipped,
      issues: issues.slice(0, 10),
      batchId: batch.id,
      batchName: batch.name,
    });
  } catch (err) {
    console.error('[Import] Error:', err);
    return NextResponse.json(
      { error: 'Erro ao importar CSV' },
      { status: 500 },
    );
  }
}

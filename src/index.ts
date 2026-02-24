import 'dotenv/config';
import express from 'express';
import { config } from './config';
import { prisma } from './lib/prisma';
import webhookRouter from './routes/webhook';

const app = express();

app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'issy-assistant', timestamp: new Date().toISOString() });
});

// Routes
app.use('/whatsapp-webhook', webhookRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

async function start(): Promise<void> {
  // Test database connectivity before accepting traffic
  await prisma.$queryRaw`SELECT 1`;
  console.log('[DB] Conectado ao PostgreSQL via Prisma.');

  app.listen(config.port, () => {
    console.log(`[Server] Issy Assistant rodando na porta ${config.port}`);
    console.log(`[Server] Health:  GET  http://localhost:${config.port}/health`);
    console.log(`[Server] Webhook: POST http://localhost:${config.port}/whatsapp-webhook`);
  });
}

start().catch((err) => {
  console.error('[Server] Falha ao iniciar:', err.message);
  process.exit(1);
});

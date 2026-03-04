-- CreateTable: lotes_importacao (ImportBatch)
CREATE TABLE "lotes_importacao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "importado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lotes_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable: corretores (Broker)
CREATE TABLE "corretores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "susep" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "lote_id" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "corretores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique phone for brokers
CREATE UNIQUE INDEX "corretores_telefone_key" ON "corretores"("telefone");

-- AddForeignKey
ALTER TABLE "corretores"
    ADD CONSTRAINT "corretores_lote_id_fkey"
    FOREIGN KEY ("lote_id") REFERENCES "lotes_importacao"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

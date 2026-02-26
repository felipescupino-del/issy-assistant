-- CreateTable
CREATE TABLE "contatos" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT 'Desconhecido',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "modo_humano" BOOLEAN NOT NULL DEFAULT false,
    "estado" JSONB,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" SERIAL NOT NULL,
    "telefone" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contatos_telefone_key" ON "contatos"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_telefone_key" ON "conversas"("telefone");

-- CreateIndex
CREATE INDEX "idx_mensagens_telefone" ON "mensagens"("telefone");

-- CreateIndex
CREATE INDEX "idx_mensagens_criado_em" ON "mensagens"("criado_em");

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_telefone_fkey" FOREIGN KEY ("telefone") REFERENCES "contatos"("telefone") ON DELETE RESTRICT ON UPDATE CASCADE;

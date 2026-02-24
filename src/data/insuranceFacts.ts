// src/data/insuranceFacts.ts
// Insurance knowledge layer — curated facts for 5 product types (KNOW-01 through KNOW-04)
// [ASSESSORIA] markers indicate placeholder values that require assessoria confirmation before quoting.
// No hardcoded R$ values — all financial references use [ASSESSORIA] markers.

import { ProductType, InsuranceFacts } from '../types/index';

export const insuranceFacts: Record<ProductType, InsuranceFacts> = {
  saude: {
    productName: 'Plano de Saúde',
    description: 'Cobertura para despesas médicas, hospitalares e ambulatoriais. Inclui internações, cirurgias e consultas conforme o plano contratado.',
    commonCoverages: [
      'Consultas médicas com clínicos gerais e especialistas',
      'Internação hospitalar em enfermaria ou apartamento (conforme plano)',
      'Cirurgias eletivas e de emergência previstas no rol da ANS',
      'Exames laboratoriais e de imagem (raios-X, tomografia, ressonância)',
      'Pronto-socorro e urgências médicas',
      'Tratamentos quimioterápicos e radioterápicos',
    ],
    commonExclusions: [
      'Tratamentos estéticos e cirurgias plásticas não reparadoras',
      'Medicamentos de uso contínuo fora do internamento',
      'Procedimentos experimentais ou não reconhecidos pelo CFM',
      'Internação em clínicas de repouso ou psiquiátricas (cobertura limitada por plano)',
    ],
    acceptanceRules: [
      'Exige declaração de saúde e pode solicitar exames admissionais dependendo da seguradora',
      'Doenças preexistentes declaradas podem ter cobertura parcial ou período de carência estendido [ASSESSORIA: regras por seguradora]',
      'Faixa etária e quantidade de dependentes impactam na precificação [ASSESSORIA: tabela atualizada]',
    ],
    importantNotes: [
      'Valores de mensalidade e carências variam por seguradora e rede credenciada — consulte a tabela atualizada com a assessoria',
      'A ANS regula os planos individuais/familiares; planos coletivos empresariais seguem regras diferenciadas',
    ],
  },

  auto: {
    productName: 'Seguro Auto',
    description: 'Proteção para veículos contra danos, roubo, colisão e responsabilidade civil a terceiros. Disponível para automóveis de passeio, utilitários e frotas.',
    commonCoverages: [
      'Colisão com outros veículos ou objetos fixos (cobertura compreensiva)',
      'Roubo e furto total ou parcial do veículo',
      'Incêndio acidental ou criminoso',
      'Responsabilidade civil facultativa (RCF) — danos materiais e corporais a terceiros',
      'Assistência 24h: guincho, pane seca, chaveiro e troca de pneu',
      'Carro reserva em casos de sinistro (conforme apólice)',
    ],
    commonExclusions: [
      'Condução por motorista sem CNH válida ou habilitação compatível com o veículo',
      'Danos causados em participação em competições ou rachas',
      'Desgaste natural e problemas mecânicos não decorrentes de sinistro',
      'Sinistros causados sob efeito de álcool ou substâncias ilícitas',
    ],
    acceptanceRules: [
      'Perfil do condutor principal (idade, sexo, CEP, uso do veículo) impacta diretamente na precificação',
      'Veículos com rastreador ou bloqueador ativo podem ter desconto no prêmio [ASSESSORIA: desconto por seguradora]',
      'Histórico de sinistros do proprietário é consultado no cadastro SUSEP [ASSESSORIA: impacto por seguradora]',
    ],
    importantNotes: [
      'Prêmio e franquia variam conforme modelo, ano do veículo, perfil do condutor e cobertura escolhida — consulte a tabela atualizada',
      'Frotas acima de determinado número de veículos podem ter condições diferenciadas de apólice coletiva [ASSESSORIA: critérios por seguradora]',
    ],
  },

  vida: {
    productName: 'Seguro de Vida',
    description: 'Proteção financeira para beneficiários em caso de morte do segurado. Pode incluir coberturas adicionais para invalidez, doenças graves e auxílio funeral.',
    commonCoverages: [
      'Morte por qualquer causa (natural ou acidental)',
      'Morte acidental com cobertura adicional (capital dobrado ou triplicado conforme apólice)',
      'Invalidez permanente total ou parcial por acidente',
      'Doenças graves: câncer, infarto, AVC e outras listadas na apólice',
      'Auxílio funeral para o segurado e familiares diretos',
    ],
    commonExclusions: [
      'Suicídio nos primeiros 2 anos de vigência da apólice',
      'Morte em decorrência de guerra declarada ou atos terroristas (cobertura específica)',
      'Invalidez preexistente à contratação não declarada',
      'Doenças preexistentes não declaradas no momento da contratação',
    ],
    acceptanceRules: [
      'Declaração pessoal de saúde (DPS) é obrigatória; acima de determinada faixa de capital pode exigir exames [ASSESSORIA: limites por seguradora]',
      'Idade e estado de saúde do segurado impactam na aceitação e no valor do prêmio [ASSESSORIA: faixas etárias por seguradora]',
    ],
    importantNotes: [
      'Valores de capital segurado e prêmio variam por seguradora, idade e coberturas contratadas — consulte a tabela atualizada',
      'O beneficiário deve ser indicado na proposta; alteração posterior é permitida mediante aditivo à apólice',
    ],
  },

  residencial: {
    productName: 'Seguro Residencial',
    description: 'Proteção para imóveis residenciais contra danos estruturais, roubo de conteúdo e responsabilidade civil. Cobre casas e apartamentos próprios ou alugados.',
    commonCoverages: [
      'Incêndio, explosão e queda de raio na estrutura do imóvel',
      'Roubo e furto qualificado de bens e eletrodomésticos',
      'Danos elétricos em equipamentos por variação de tensão',
      'Quebra de vidros, espelhos e mármores',
      'Responsabilidade civil do segurado a terceiros (vazamentos, danos aos vizinhos)',
      'Assistência residencial 24h: encanador, eletricista, chaveiro',
    ],
    commonExclusions: [
      'Danos causados por obras ou reformas realizadas pelo próprio segurado',
      'Danos decorrentes de infiltrações graduais e umidade preexistente',
      'Furto simples sem arrombamento ou violência (verificar apólice)',
      'Danos causados por guerra, motins ou fenômenos da natureza não previstos na apólice',
    ],
    acceptanceRules: [
      'Valor do imóvel e do conteúdo devem ser declarados corretamente para evitar sub-seguro',
      'Imóveis desocupados por mais de 60 dias consecutivos podem ter restrições de cobertura [ASSESSORIA: prazo por seguradora]',
    ],
    importantNotes: [
      'Prêmio varia conforme localização, tipo de construção (alvenaria/madeira), valor do imóvel e coberturas contratadas — consulte a tabela atualizada',
      'Locatários podem contratar seguro residencial para o conteúdo mesmo sem ser proprietários do imóvel',
    ],
  },

  empresarial: {
    productName: 'Seguro Empresarial',
    description: 'Proteção abrangente para estabelecimentos comerciais, cobindo patrimônio, responsabilidade civil e interrupção de negócios. Indicado para empresas de qualquer porte.',
    commonCoverages: [
      'Incêndio, explosão e queda de raio nas instalações',
      'Roubo e furto qualificado de equipamentos, estoque e mobiliário',
      'Danos elétricos em equipamentos de informática e industriais',
      'Responsabilidade civil do estabelecimento por danos a clientes ou terceiros',
      'Perda de lucros por interrupção temporária das atividades após sinistro',
      'Vidros, letreiros e fachadas',
    ],
    commonExclusions: [
      'Danos causados por greves, tumultos ou manifestações (cobertura específica disponível)',
      'Mercadorias perecíveis em câmaras frias fora da cobertura padrão',
      'Danos causados por negligência comprovada nos processos operacionais',
      'Sinistros ocorridos fora do endereço declarado na apólice',
    ],
    acceptanceRules: [
      'CNPJ ativo e descrição detalhada da atividade são obrigatórios para precificação',
      'Estabelecimentos de alto risco (postos de gasolina, indústrias químicas) requerem vistoria prévia [ASSESSORIA: critérios por seguradora]',
      'Faturamento anual pode impactar na contratação de cobertura de lucros cessantes [ASSESSORIA: limites por seguradora]',
    ],
    importantNotes: [
      'Prêmio e coberturas variam conforme atividade econômica, localização, faturamento e riscos específicos — consulte a tabela atualizada com a assessoria',
      'Empresas com múltiplos estabelecimentos podem contratar apólice global com desconto por volume [ASSESSORIA: condições por seguradora]',
    ],
  },
};

/**
 * Detect the insurance product type from the message text.
 * Returns null if no product keyword is found (general Q&A).
 * Detection is case-insensitive and uses normalized (lowercase) matching.
 */
export function detectProductType(text: string): ProductType | null {
  const lower = text.toLowerCase();

  if (['saúde', 'saude', 'plano de saúde', 'médico', 'medico', 'hospitalar'].some((k) => lower.includes(k))) {
    return 'saude';
  }
  if (['empresarial', 'empresa', 'negócio', 'negocio', 'comercial', 'cnpj'].some((k) => lower.includes(k))) {
    return 'empresarial';
  }
  if (['auto', 'automóvel', 'automovel', 'carro', 'veículo', 'veiculo', 'frota'].some((k) => lower.includes(k))) {
    return 'auto';
  }
  if (['vida', 'morte', 'funeral', 'seguro de vida'].some((k) => lower.includes(k))) {
    return 'vida';
  }
  if (['residencial', 'casa', 'apartamento', 'imóvel', 'imovel', 'residência', 'residencia'].some((k) => lower.includes(k))) {
    return 'residencial';
  }

  return null;
}

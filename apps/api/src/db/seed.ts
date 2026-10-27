import { eq, inArray } from 'drizzle-orm';
import { computeDueAt } from '@nexo-assist/domain';
import { EnvConfig } from '../config/env.config';
import { closeDb, createDb, type AppDatabase } from './client';

EnvConfig.getInstance().load();
import {
  conversations,
  drafts,
  executionEvents,
  helpArticles,
  messages,
  operations,
  seedMeta,
  sessions,
  ticketHistory,
  tickets,
  users,
} from './schema';

const SEED_ID = 'nexo-assist-demo-v3';
const LEGACY_SEED_IDS = ['nexo-assist-demo-v2'] as const;

async function wipeDemoTables(db: AppDatabase): Promise<void> {
  await db.delete(executionEvents);
  await db.delete(drafts);
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(ticketHistory);
  await db.delete(tickets);
  await db.delete(operations);
  await db.delete(helpArticles);
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(seedMeta);
}

export const IDS = {
  ana: 'a1111111-1111-4111-8111-111111111111',
  rafael: 'a2222222-2222-4222-8222-222222222222',
  bruno: 'a3333333-3333-4333-8333-333333333333',
  carla: 'a4444444-4444-4444-8444-444444444444',
  inc20311: 'b1111111-1111-4111-8111-111111111111',
  inc20298: 'b2222222-2222-4222-8222-222222222222',
  req10442: 'b3333333-3333-4333-8333-333333333333',
  inc20150: 'b4444444-4444-4444-8444-444444444444',
  anaResolvedIn: 'b5555555-5555-4555-8555-555555555555',
  anaResolvedOut: 'b6666666-6666-4666-8666-666666666666',
  convWaiting: 'c1111111-1111-4111-8111-111111111111',
  convAgent: 'c2222222-2222-4222-8222-222222222222',
  convAnalyst: 'c3333333-3333-4333-8333-333333333333',
  convClosed: 'c4444444-4444-4444-8444-444444444444',
  convAna: 'c5555555-5555-4555-8555-555555555555',
} as const;

export async function runSeed(now = new Date()): Promise<void> {
  const db = createDb();
  const existing = await db.select().from(seedMeta).where(eq(seedMeta.id, SEED_ID));
  if (existing.length > 0) {
    // eslint-disable-next-line no-console
    console.log('Seed already applied; skipping.');
    return;
  }

  const legacy = await db
    .select()
    .from(seedMeta)
    .where(inArray(seedMeta.id, [...LEGACY_SEED_IDS]));
  if (legacy.length > 0) {
    // eslint-disable-next-line no-console
    console.log('Upgrading demo seed to v3 (wiping prior demo tables)…');
    await wipeDemoTables(db);
  }

  await db.insert(users).values([
    {
      id: IDS.ana,
      email: 'ana.souza@nexo.com.br',
      name: 'Ana Souza',
      area: 'Financeiro',
      role: 'employee',
    },
    {
      id: IDS.rafael,
      email: 'rafael.lima@nexo.com.br',
      name: 'Rafael Lima',
      area: 'Service Desk',
      role: 'analyst',
    },
    {
      id: IDS.bruno,
      email: 'bruno.mendes@nexo.com.br',
      name: 'Bruno Mendes',
      area: 'Financeiro',
      role: 'employee',
    },
    {
      id: IDS.carla,
      email: 'carla.nunes@nexo.com.br',
      name: 'Carla Nunes',
      area: 'RH',
      role: 'employee',
    },
  ]);

  await db.insert(helpArticles).values([
    {
      slug: 'vpn-erro-809',
      title: 'VPN corporativa — erro 809',
      body: 'Reinicie o cliente VPN, confira se está na rede permitida e tente novamente. Se o erro 809 persistir, reinicie o adaptador de rede.',
      tags: ['vpn', 'rede', '809'],
      errorCodes: ['809'],
      isDemo: true,
    },
    {
      slug: 'horario-service-desk',
      title: 'Horário do service desk e plantão',
      body: 'Expediente: segunda a sexta, 08:00–18:00 (America/Sao_Paulo). Casos críticos usam plantão 24h.',
      tags: ['horario', 'plantao', 'sla'],
      errorCodes: [],
      isDemo: true,
    },
    {
      slug: 'acesso-sistemas',
      title: 'Solicitar ou recuperar acesso',
      body: 'Informe o sistema, o perfil necessário e se o bloqueio ocorreu após troca de senha.',
      tags: ['acesso', 'senha'],
      errorCodes: [],
      isDemo: true,
    },
    {
      slug: 'email-outlook',
      title: 'Problemas com e-mail Outlook',
      body: 'Verifique espaço da caixa, modo online e se a autenticação multifator está válida.',
      tags: ['email', 'outlook'],
      errorCodes: [],
      isDemo: true,
    },
    {
      slug: 'software-instalacao',
      title: 'Instalação de software aprovado',
      body: 'Abra um pedido com o nome do software e a justificativa de negócio. Softwares fora do catálogo precisam de aprovação.',
      tags: ['software'],
      errorCodes: [],
      isDemo: true,
    },
    {
      slug: 'rede-wifi',
      title: 'Wi-Fi corporativo instável',
      body: 'Esqueça a rede, reconecte e teste por cabo se disponível. Anote o horário do incidente.',
      tags: ['rede', 'wifi'],
      errorCodes: [],
      isDemo: true,
    },
    {
      slug: 'equipamento-notebook',
      title: 'Notebook com falha de hardware',
      body: 'Descreva o sintoma, modelo e se há garantia. Não abra o equipamento.',
      tags: ['hardware', 'notebook'],
      errorCodes: [],
      isDemo: true,
    },
    {
      slug: 'sharepoint-permissoes',
      title: 'Permissões no SharePoint',
      body: 'Informe a biblioteca, o nível desejado e quem deve aprovar o acesso.',
      tags: ['sharepoint', 'acesso'],
      errorCodes: [],
      isDemo: true,
    },
  ]);

  const overdueDue = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const mediumDue = computeDueAt('medium', now);
  const lowDue = computeDueAt('low', now);
  const resolvedIn = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const resolvedOut = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Prototype Screen 2 anchors: opened ~11 days ago, last update 5 days ago → "há 5 dias".
  const openedElevenDaysAgo = new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000);
  const updatedFiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  await db.insert(tickets).values([
    {
      id: IDS.inc20311,
      number: 'INC-20311',
      employeeId: IDS.ana,
      type: 'incident',
      category: 'hardware',
      title: 'Notebook lento após atualização do Windows',
      description:
        'Lentidão geral desde a atualização de 15/10. Reiniciar e rodar o diagnóstico da central não resolveu.',
      errorCode: null,
      priority: 'medium',
      status: 'waiting_analyst',
      dueAt: overdueDue,
      resolvedAt: null,
      createdAt: openedElevenDaysAgo,
      updatedAt: updatedFiveDaysAgo,
    },
    {
      id: IDS.inc20298,
      number: 'INC-20298',
      employeeId: IDS.ana,
      type: 'incident',
      category: 'access',
      title: 'Acesso à pasta Financeiro no SharePoint',
      description: 'Não consigo abrir a biblioteca do time de Operações.',
      errorCode: null,
      priority: 'medium',
      status: 'in_progress',
      dueAt: mediumDue,
      resolvedAt: null,
    },
    {
      id: IDS.req10442,
      number: 'REQ-10442',
      employeeId: IDS.ana,
      type: 'request',
      category: 'hardware',
      title: 'Segundo monitor para home office',
      description: 'Solicitação de segundo monitor para home office.',
      errorCode: null,
      priority: 'low',
      status: 'approved',
      dueAt: lowDue,
      resolvedAt: null,
    },
    {
      id: IDS.inc20150,
      number: 'INC-20150',
      employeeId: IDS.bruno,
      type: 'incident',
      category: 'access',
      title: 'Senha do SAP',
      description: 'Senha do SAP expirada; preciso redefinir.',
      errorCode: null,
      priority: 'medium',
      status: 'resolved',
      dueAt: mediumDue,
      resolvedAt: resolvedIn,
    },
    {
      id: IDS.anaResolvedIn,
      number: 'INC-20400',
      employeeId: IDS.ana,
      type: 'incident',
      category: 'software',
      title: 'Teams travando',
      description: 'Teams fechava sozinho ao entrar em reunião.',
      errorCode: null,
      priority: 'medium',
      status: 'resolved',
      dueAt: mediumDue,
      resolvedAt: resolvedIn,
    },
    {
      id: IDS.anaResolvedOut,
      number: 'INC-19990',
      employeeId: IDS.ana,
      type: 'incident',
      category: 'network',
      title: 'VPN lenta',
      description: 'VPN corporativa muito lenta em viagens.',
      errorCode: null,
      priority: 'low',
      status: 'resolved',
      dueAt: lowDue,
      resolvedAt: resolvedOut,
    },
  ]);

  await db.insert(ticketHistory).values([
    {
      ticketId: IDS.inc20311,
      fromStatus: null,
      toStatus: 'open',
      note: 'Chamado aberto pelo portal.',
    },
    {
      ticketId: IDS.inc20311,
      fromStatus: 'open',
      toStatus: 'waiting_analyst',
      note: 'Transferido para um analista',
    },
    {
      ticketId: IDS.inc20298,
      fromStatus: 'waiting_analyst',
      toStatus: 'in_progress',
      note: 'Analista iniciou atendimento.',
    },
    {
      ticketId: IDS.req10442,
      fromStatus: 'waiting_analyst',
      toStatus: 'approved',
      note: 'Pedido aprovado pelo gestor.',
    },
    {
      ticketId: IDS.inc20150,
      fromStatus: 'in_progress',
      toStatus: 'resolved',
      note: 'Senha redefinida com sucesso.',
    },
  ]);

  await db.insert(conversations).values([
    {
      id: IDS.convAna,
      employeeId: IDS.ana,
      status: 'waiting_analyst',
      analystId: null,
      employeeMessageCount: 4,
      summary: 'Está parado há 5 dias. Quero falar com um analista. · INC-20311',
    },
    {
      id: IDS.convWaiting,
      employeeId: IDS.carla,
      status: 'waiting_analyst',
      analystId: null,
      employeeMessageCount: 4,
      summary: 'Impressora da recepção offline.',
    },
    {
      id: IDS.convAgent,
      employeeId: IDS.bruno,
      status: 'with_agent',
      analystId: null,
      employeeMessageCount: 2,
      summary: 'Dúvida sobre VPN.',
    },
    {
      id: IDS.convAnalyst,
      employeeId: IDS.carla,
      status: 'with_analyst',
      analystId: IDS.rafael,
      employeeMessageCount: 6,
      summary: 'Notebook lento em reuniões.',
    },
    {
      id: IDS.convClosed,
      employeeId: IDS.bruno,
      status: 'closed',
      analystId: IDS.rafael,
      employeeMessageCount: 5,
      summary: 'Acesso ao e-mail restabelecido.',
    },
  ]);

  await db.insert(messages).values([
    {
      conversationId: IDS.convAna,
      role: 'employee',
      content: 'Qual o status do meu chamado?',
    },
    {
      conversationId: IDS.convAna,
      role: 'agent',
      content: 'Você tem 3 chamados abertos. Sobre qual deles quer saber?',
    },
    {
      conversationId: IDS.convAna,
      role: 'employee',
      content: 'INC-20311 · Notebook lento após atualização',
    },
    {
      conversationId: IDS.convAna,
      role: 'agent',
      content:
        'Está sem atualização há 5 dias, acima do prazo de 3 dias úteis. Quer que eu chame um analista?',
    },
    {
      conversationId: IDS.convAna,
      role: 'employee',
      content: 'Está parado há 5 dias.',
    },
    {
      conversationId: IDS.convAna,
      role: 'employee',
      content: 'Quero falar com um analista.',
    },
    {
      conversationId: IDS.convAna,
      role: 'agent',
      content:
        'Encaminhei para o Suporte N2. Um analista vai falar com você em até 2 h úteis.',
    },
    {
      conversationId: IDS.convAna,
      role: 'system',
      content: 'Transferida para Suporte N2',
    },
    {
      conversationId: IDS.convWaiting,
      role: 'employee',
      content: 'A impressora da recepção parou de funcionar.',
    },
    {
      conversationId: IDS.convWaiting,
      role: 'agent',
      content: 'Vou transferir você para um analista.',
    },
    {
      conversationId: IDS.convAnalyst,
      role: 'employee',
      content: 'Meu notebook fica lento em videochamadas.',
    },
    {
      conversationId: IDS.convAnalyst,
      role: 'analyst',
      content: 'Olá Carla, estou verificando os logs do equipamento.',
    },
    {
      conversationId: IDS.convClosed,
      role: 'system',
      content: 'Atendimento encerrado.',
    },
  ]);

  await db.insert(seedMeta).values({ id: SEED_ID });
  // eslint-disable-next-line no-console
  console.log('Seed applied.');
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await closeDb();
    })
    .catch(async (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await closeDb();
      process.exit(1);
    });
}

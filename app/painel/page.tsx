"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  type Produto,
  type Cliente,
  type Venda,
  type Lancamento,
  type ItemVenda,
  type Perfil,
  getProdutos,
  getRankingProdutos,
  ajustarEstoque,
  getClientes,
  upsertCliente,
  criarClienteRapido,
  removeCliente,
  getVendas,
  registrarVenda,
  atualizarVenda,
  reativarVenda,
  cancelarVenda,
  excluirVenda,
  receberVenda,
  getFinanceiro,
  addLancamento,
  removerLancamento,
  getPerfil,
  completarCadastro,
  atualizarPerfil,
  uploadFotoPerfil,
  validarCpf,
  marcarPosVendaContatado,
  limparFollowupCliente,
  marcarBoasVindasContatado,
  marcarIndicacaoPedida,
  marcarInatividadeContatada,
  marcarAniversarioPedido,
  limparLembreteCobranca,
  getTemplates,
  salvarTemplate,
  restaurarTemplatePadrao,
  importarClientes,
  normalizarTelefone,
  getCatalogoConfig,
  salvarCatalogoConfig,
  verificarSlugDisponivel,
  CATEGORIAS_CATALOGO,
  type CatalogoConfig,
  getMateriaisApoio,
  type MaterialApoio,
  getAudiosVenda,
  salvarAudioVenda,
  removerAudioVenda,
  type AudioVenda,
} from "@/lib/store";
import { extrairItensNotaFiscal, casarComCatalogo, type ItemNotaFiscal } from "@/lib/nota-fiscal";
import { extrairContatosPlanilha, type ContatoImportado } from "@/lib/planilha";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function linkWhatsApp(telefone: string, mensagem: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(mensagem)}`;
}

function montarMensagemPedido(venda: Venda): string {
  const itens = venda.itens.map((i) => `• ${i.quantidade}x ${i.nome}`).join("\n");
  const saudacao = venda.clienteNome && venda.clienteNome !== "Cliente avulso"
    ? `Olá, ${primeiroNome(venda.clienteNome)}! 👋`
    : "Olá! 👋";
  return (
    `${saudacao}\n\nAqui está o resumo do seu pedido:\n\n${itens}\n\n` +
    `Total: ${currency(venda.total)}\n\nObrigado pela preferência! 💙`
  );
}

function primeiroNome(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  return partes[0] || nomeCompleto;
}

function mensagemBoasVindas(nome: string): string {
  return `Oi ${nome}! Que bom ter você como cliente! 🙌 Qualquer dúvida sobre os produtos ou pra fazer seu próximo pedido, pode me chamar por aqui, tô à disposição!`;
}

function mensagemAniversario(nome: string): string {
  return `Oi ${nome}! 🎉 Passando aqui pra desejar um feliz aniversário! Que seu dia seja ótimo. Qualquer coisa que precisar, é só chamar! 💛`;
}

function mensagemRenovarPedido(nome: string, ultimoProduto?: string): string {
  const referencia = ultimoProduto
    ? `Vi que você levou ${ultimoProduto}, já deu tempo de acabar?`
    : "Já deu tempo de acabar algum produto?";
  return `Oi ${nome}, tudo bem? Faz um tempinho desde seu último pedido. ${referencia} Posso te ajudar a repor quando quiser! 😊`;
}

function mensagemPosVenda(nome: string): string {
  return `Oi ${nome}! Já faz alguns dias da sua última compra, queria saber como está sendo sua experiência com os produtos! Ficou alguma dúvida ou posso ajudar em algo? 💬`;
}

function mensagemIndicacao(nome: string, produto?: string): string {
  const referencia = produto ? `o ${produto}` : "os produtos";
  return `Oi ${nome}! Fico muito feliz que você escolheu ${referencia} 💛 Se tiver alguém que também usaria, me manda o contato? Prometo cuidar bem dela, igual cuidei de você!`;
}

function mensagemInativo(nome: string): string {
  return `Oi ${nome}! Faz tempo que a gente não se fala 💛 Passando só pra saber como você está e se posso te ajudar com alguma coisa. Sentimos sua falta por aqui!`;
}

function mensagemPedirAniversario(nome: string): string {
  return `Oi ${nome}! Estou atualizando meu cadastro de clientes aqui 📋 Você pode me passar sua data de aniversário (dia e mês)? Sempre preparo um agrado especial pros meus clientes nessa data! 🎁`;
}

function mensagemCobranca(nome: string, valor?: string): string {
  const referencia = valor ? ` no valor de ${valor}` : "";
  return `Oi ${nome}! Passando pra lembrar que ainda está em aberto um pagamento${referencia}. Consegue resolver hoje? Qualquer dúvida sobre o pedido, me chama! 💙`;
}

// Tipos de tarefa que têm mensagem editável (fora do fluxo especial de
// "cadastro incompleto", que não manda mensagem — não tem telefone ainda).
const TIPOS_TAREFA_MENSAGEM: { tipo: TipoTarefa; label: string }[] = [
  { tipo: "novo_cadastro", label: "Boas-vindas" },
  { tipo: "aniversario", label: "Aniversário" },
  { tipo: "renovar", label: "Renovar pedido" },
  { tipo: "pos_venda", label: "Pós-venda" },
  { tipo: "indicacao", label: "Pedir indicação" },
  { tipo: "inativo", label: "Cliente inativo" },
  { tipo: "pedir_aniversario", label: "Pedir data de aniversário" },
  { tipo: "cobranca", label: "Cobrança (a receber)" },
];

function mensagemPadraoPorTipo(
  tipo: TipoTarefa,
  nome: string,
  ultimoProduto?: string,
  valor?: string
): string {
  if (tipo === "novo_cadastro") return mensagemBoasVindas(nome);
  if (tipo === "aniversario") return mensagemAniversario(nome);
  if (tipo === "renovar") return mensagemRenovarPedido(nome, ultimoProduto);
  if (tipo === "indicacao") return mensagemIndicacao(nome, ultimoProduto);
  if (tipo === "inativo") return mensagemInativo(nome);
  if (tipo === "pedir_aniversario") return mensagemPedirAniversario(nome);
  if (tipo === "cobranca") return mensagemCobranca(nome, valor);
  return mensagemPosVenda(nome);
}

// Gera a mensagem final: usa o template customizado da conta se existir
// (trocando {nome}, {produto} e {valor}), senão cai no texto padrao.
function gerarMensagem(
  tipo: TipoTarefa,
  nome: string,
  ultimoProduto?: string,
  templates?: Record<string, string>,
  valor?: string
): string {
  const customizado = templates?.[tipo];
  if (customizado) {
    return customizado
      .replace(/\{nome\}/g, nome)
      .replace(/\{produto\}/g, ultimoProduto || "os produtos")
      .replace(/\{valor\}/g, valor || "o valor pendente");
  }
  return mensagemPadraoPorTipo(tipo, nome, ultimoProduto, valor);
}

function rotuloTempoDesde(data: Date, hoje: Date): string {
  const diffDias = Math.round(
    (inicioDoDia(hoje).getTime() - inicioDoDia(data).getTime()) / 86400000
  );
  if (diffDias <= 0) return "Cadastrado hoje";
  if (diffDias === 1) return "Cadastrado ontem";
  return `Cadastrado há ${diffDias} dias`;
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function proximaOcorrenciaAniversario(dia: number, mes: number, hoje: Date): Date {
  const hojeSemHora = inicioDoDia(hoje);
  let data = new Date(hoje.getFullYear(), mes - 1, dia);
  if (data < hojeSemHora) {
    data = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  }
  return data;
}

function rotuloRelativo(data: Date, hoje: Date): string {
  const diffDias = Math.round(
    (inicioDoDia(data).getTime() - inicioDoDia(hoje).getTime()) / 86400000
  );
  const formatada = data.toLocaleDateString("pt-BR");
  if (diffDias < 0) return `Atrasado desde ${formatada}`;
  if (diffDias === 0) return "Hoje";
  if (diffDias === 1) return "Amanhã";
  return `Em ${diffDias} dias (${formatada})`;
}

type TipoTarefa =
  | "novo_cadastro"
  | "aniversario"
  | "renovar"
  | "pos_venda"
  | "indicacao"
  | "inativo"
  | "pedir_aniversario"
  | "cadastro_incompleto"
  | "cobranca";

type Tarefa = {
  id: string;
  tipo: TipoTarefa;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  dataReferencia: string;
  mensagemPadrao: string;
  vendaId?: string;
};

const CONFIG_TAREFA: Record<TipoTarefa, { label: string; emoji: string; badge: string }> = {
  cadastro_incompleto: { label: "Cadastro incompleto", emoji: "⚠️", badge: "badge-low" },
  novo_cadastro: { label: "Boas-vindas", emoji: "👋", badge: "badge-info" },
  aniversario: { label: "Aniversário", emoji: "🎂", badge: "badge-warn" },
  pedir_aniversario: { label: "Pedir aniversário", emoji: "📋", badge: "badge-info" },
  renovar: { label: "Renovar pedido", emoji: "🔁", badge: "badge-low" },
  pos_venda: { label: "Pós-venda", emoji: "💬", badge: "badge-ok" },
  indicacao: { label: "Pedir indicação", emoji: "🤝", badge: "badge-info" },
  inativo: { label: "Cliente inativo", emoji: "😴", badge: "badge-low" },
  cobranca: { label: "Cobrança", emoji: "💰", badge: "badge-low" },
};

// Ordem de exibição dos grupos: mais urgente/sensível a tempo primeiro.
const ORDEM_TIPOS_TAREFA: TipoTarefa[] = [
  "cobranca",
  "aniversario",
  "pos_venda",
  "novo_cadastro",
  "cadastro_incompleto",
  "pedir_aniversario",
  "indicacao",
  "renovar",
  "inativo",
];

const LOGO_URL =
  "https://ghqsqqegblhseocxmwwx.supabase.co/storage/v1/object/public/brand-assets/Screenshot_20260722_100709_ChatGPT.jpg";

/* ---------------------------- Ícones ---------------------------- */

function IconEstoque({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8.5 12 4 3 8.5l9 4.5 9-4.5Z" />
      <path d="M3 8.5V16l9 4.5 9-4.5V8.5" />
      <path d="M12 13v7.5" />
    </svg>
  );
}
function IconClientes({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}
function IconVendas({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
      <path d="M2.5 3.5h2.2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6l1.5-7.9H6.1" />
    </svg>
  );
}
function IconFinanceiro({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5a1 1 0 0 1 1 1v2.2" />
      <path d="M3.5 7.5v10A2.5 2.5 0 0 0 6 20h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2.5 2.5 0 0 1-2.5-2.5Z" />
      <circle cx="16.3" cy="14" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconSair({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.02c-.24.68-1.4 1.32-1.94 1.4-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.86-1.24-4.72-4.12-4.86-4.31-.14-.19-1.16-1.55-1.16-2.96 0-1.4.73-2.09 1-2.38.26-.28.57-.35.76-.35h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.56.16.28.72 1.18 1.55 1.92 1.07.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.53.72 1.79.85.26.14.44.2.5.31.07.12.07.65-.17 1.33Z" />
    </svg>
  );
}

function IconInicio({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}
function IconPerfil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="9.7" r="2.6" />
      <path d="M6.3 18.2c1.3-2.6 3.4-3.9 5.7-3.9s4.4 1.3 5.7 3.9" />
    </svg>
  );
}

function IconCampanha({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11v2a2 2 0 0 0 2 2h1l2.5 4.5.9-.3A2 2 0 0 0 10.6 17L10 15" />
      <path d="M3 11 15 5v12L3 15Z" />
      <path d="M17 9.5c1 .7 1 3.3 0 4" />
      <path d="M19.5 7c2 1.5 2 8.5 0 10" />
    </svg>
  );
}

function IconCatalogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="4" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="4" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="14" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="14" width="7" height="7" rx="1.4" />
    </svg>
  );
}

function IconMateriais({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3.5h9l4 4V19a1.4 1.4 0 0 1-1.4 1.4H6A1.4 1.4 0 0 1 4.6 19V4.9A1.4 1.4 0 0 1 6 3.5Z" />
      <path d="M14.5 3.5v4H19" />
      <path d="M8 12.5h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function IconTemplates({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 3.5h9l4 4V15.5a1.2 1.2 0 0 1-1.2 1.2H4.5Z" opacity="0.45" />
      <path d="M2.5 6.5h9l4 4V20a1.2 1.2 0 0 1-1.2 1.2H3.7A1.2 1.2 0 0 1 2.5 20Z" />
      <path d="M6 12.5h6" />
      <path d="M6 15.5h4" />
    </svg>
  );
}

function IconAudio({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

function IconRede({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="4.5" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M12 6.5v5" />
      <path d="M12 11.5 6.3 16.5" />
      <path d="M12 11.5l5.7 5" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

/* ---------------------------- Início (Dashboard) ---------------------------- */

function TabInicio({
  ativo,
  onCompletarCadastro,
}: {
  ativo: boolean;
  onCompletarCadastro: (clienteId: string) => void;
}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [tarefaAberta, setTarefaAberta] = useState<Tarefa | null>(null);
  const [modeloSelecionado, setModeloSelecionado] = useState<TipoTarefa | null>(null);
  const [mensagensEditadas, setMensagensEditadas] = useState<Record<string, string>>({});
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());
  const [processandoTarefa, setProcessandoTarefa] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Set<TipoTarefa>>(new Set());
  const jaAtivouAntes = useRef(false);

  function buscarDados() {
    return Promise.all([
      getProdutos(),
      getClientes(),
      getVendas(),
      getPerfil(),
      getTemplates(),
    ]).then(([p, c, v, perf, temp]) => {
      setProdutos(p);
      setClientes(c);
      setVendas(v);
      setPerfil(perf);
      setTemplates(temp);
    });
  }

  useEffect(() => {
    buscarDados().finally(() => setCarregando(false));
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos: mantém o que já
  // está na tela e só atualiza se vier algo novo, sem mostrar "Carregando".
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    buscarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  if (carregando) {
    return <div className="empty-state">Carregando painel...</div>;
  }

  const agora = new Date();
  const vendasConcluidas = vendas.filter((v) => v.status === "concluida");
  const vendasDoMes = vendasConcluidas.filter((v) => {
    const d = new Date(v.data);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });
  const valorVendasMes = vendasDoMes.reduce((s, v) => s + v.total, 0);
  const valorEstoque = produtos.reduce((s, p) => s + p.estoque * p.preco, 0);
  const lucroPotencial = produtos.reduce(
    (s, p) => s + p.estoque * (p.preco - p.custo),
    0
  );
  const ticketMedio =
    vendasConcluidas.length > 0
      ? vendasConcluidas.reduce((s, v) => s + v.total, 0) / vendasConcluidas.length
      : 0;

  const metaVenda = perfil?.metaVenda ?? 0;
  const progressoVendaMes =
    metaVenda > 0 ? Math.min(100, (valorVendasMes / metaVenda) * 100) : 0;

  // Última venda concluída por cliente, pra citar o produto na mensagem de renovação.
  const ultimaVendaPorCliente = new Map<string, Venda>();
  for (const v of vendasConcluidas) {
    if (!v.clienteId) continue;
    const atual = ultimaVendaPorCliente.get(v.clienteId);
    if (!atual || new Date(v.data) > new Date(atual.data)) {
      ultimaVendaPorCliente.set(v.clienteId, v);
    }
  }

  const JANELA_ANIVERSARIO_DIAS = 30;

  const tarefasNovoCadastro: Tarefa[] = clientes
    .filter((c) => c.telefone && !c.boasVindasContatado)
    .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())
    .map((c) => ({
      id: `novocadastro-${c.id}`,
      tipo: "novo_cadastro" as const,
      clienteId: c.id,
      clienteNome: c.nome,
      telefone: c.telefone,
      dataReferencia: rotuloTempoDesde(new Date(c.criadoEm), agora),
      mensagemPadrao: gerarMensagem("novo_cadastro", primeiroNome(c.nome), undefined, templates),
    }));

  const tarefasAniversario: Tarefa[] = clientes
    .filter((c) => c.telefone && c.aniversarioDia && c.aniversarioMes)
    .map((c) => {
      const proxima = proximaOcorrenciaAniversario(c.aniversarioDia!, c.aniversarioMes!, agora);
      return { cliente: c, proxima };
    })
    .filter(({ proxima }) => {
      const diffDias = Math.round(
        (inicioDoDia(proxima).getTime() - inicioDoDia(agora).getTime()) / 86400000
      );
      return diffDias <= JANELA_ANIVERSARIO_DIAS;
    })
    .sort((a, b) => a.proxima.getTime() - b.proxima.getTime())
    .map(({ cliente: c, proxima }) => ({
      id: `aniversario-${c.id}`,
      tipo: "aniversario" as const,
      clienteId: c.id,
      clienteNome: c.nome,
      telefone: c.telefone,
      dataReferencia: rotuloRelativo(proxima, agora),
      mensagemPadrao: gerarMensagem("aniversario", primeiroNome(c.nome), undefined, templates),
    }));

  const tarefasRenovar: Tarefa[] = clientes
    .filter((c) => c.telefone && c.proximoFollowup)
    .sort(
      (a, b) => new Date(a.proximoFollowup!).getTime() - new Date(b.proximoFollowup!).getTime()
    )
    .map((c) => {
      const ultima = ultimaVendaPorCliente.get(c.id);
      const ultimoProduto = ultima?.itens?.[0]?.nome;
      return {
        id: `renovar-${c.id}`,
        tipo: "renovar" as const,
        clienteId: c.id,
        clienteNome: c.nome,
        telefone: c.telefone,
        dataReferencia: rotuloRelativo(new Date(c.proximoFollowup!), agora),
        mensagemPadrao: gerarMensagem("renovar", primeiroNome(c.nome), ultimoProduto, templates),
      };
    });

  const tarefasPosVenda: Tarefa[] = vendasConcluidas
    .filter((v) => {
      if (v.posVendaContatado || !v.clienteId) return false;
      const cliente = clientes.find((c) => c.id === v.clienteId);
      if (!cliente?.telefone) return false;
      const dias = (agora.getTime() - new Date(v.data).getTime()) / 86400000;
      return dias >= 3;
    })
    .map((v) => {
      const cliente = clientes.find((c) => c.id === v.clienteId)!;
      return {
        id: `posvenda-${v.id}`,
        tipo: "pos_venda" as const,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        dataReferencia: `Venda de ${new Date(v.data).toLocaleDateString("pt-BR")}`,
        mensagemPadrao: gerarMensagem("pos_venda", primeiroNome(cliente.nome), v.itens?.[0]?.nome, templates),
        vendaId: v.id,
      };
    });

  const tarefasIndicacao: Tarefa[] = vendasConcluidas
    .filter((v) => {
      if (v.indicacaoPedida || !v.clienteId) return false;
      const cliente = clientes.find((c) => c.id === v.clienteId);
      if (!cliente?.telefone) return false;
      const dias = (agora.getTime() - new Date(v.data).getTime()) / 86400000;
      return dias >= 7;
    })
    .map((v) => {
      const cliente = clientes.find((c) => c.id === v.clienteId)!;
      return {
        id: `indicacao-${v.id}`,
        tipo: "indicacao" as const,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        dataReferencia: `Venda de ${new Date(v.data).toLocaleDateString("pt-BR")}`,
        mensagemPadrao: gerarMensagem("indicacao", primeiroNome(cliente.nome), v.itens?.[0]?.nome, templates),
        vendaId: v.id,
      };
    });

  // Cobrança: vendas "A receber" com um lembrete definido que já chegou (ou
  // passou). Some sozinha assim que a venda é marcada como recebida ou
  // quando a tarefa é concluída (limpa o lembrete daquela venda específica).
  const tarefasCobranca: Tarefa[] = vendasConcluidas
    .filter((v) => {
      if (v.formaPagamento !== "A receber" || !v.lembreteCobranca || !v.clienteId) return false;
      const cliente = clientes.find((c) => c.id === v.clienteId);
      if (!cliente?.telefone) return false;
      return inicioDoDia(new Date(v.lembreteCobranca)) <= inicioDoDia(agora);
    })
    .sort(
      (a, b) =>
        new Date(a.lembreteCobranca!).getTime() - new Date(b.lembreteCobranca!).getTime()
    )
    .map((v) => {
      const cliente = clientes.find((c) => c.id === v.clienteId)!;
      return {
        id: `cobranca-${v.id}`,
        tipo: "cobranca" as const,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        dataReferencia: rotuloRelativo(new Date(v.lembreteCobranca!), agora),
        mensagemPadrao: gerarMensagem(
          "cobranca",
          primeiroNome(cliente.nome),
          undefined,
          templates,
          currency(v.total)
        ),
        vendaId: v.id,
      };
    });

  // Cliente inativo: comprou pelo menos uma vez, mas nao volta ha 60+ dias.
  // Reseta sozinho sempre que ele compra de novo (compara com a data da
  // ultima venda, nao so uma flag fixa).
  const JANELA_INATIVIDADE_DIAS = 60;
  const tarefasInativo: Tarefa[] = Array.from(ultimaVendaPorCliente.entries())
    .filter(([clienteId, venda]) => {
      const cliente = clientes.find((c) => c.id === clienteId);
      if (!cliente?.telefone) return false;
      const dias = (agora.getTime() - new Date(venda.data).getTime()) / 86400000;
      if (dias < JANELA_INATIVIDADE_DIAS) return false;
      if (
        cliente.inatividadeContatadaEm &&
        new Date(cliente.inatividadeContatadaEm) > new Date(venda.data)
      ) {
        return false;
      }
      return true;
    })
    .map(([clienteId, venda]) => {
      const cliente = clientes.find((c) => c.id === clienteId)!;
      return {
        id: `inativo-${cliente.id}`,
        tipo: "inativo" as const,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        dataReferencia: `Última compra em ${new Date(venda.data).toLocaleDateString("pt-BR")}`,
        mensagemPadrao: gerarMensagem("inativo", primeiroNome(cliente.nome), undefined, templates),
      };
    });

  // Pedir data de aniversário pra quem não tem preenchida.
  const tarefasPedirAniversario: Tarefa[] = clientes
    .filter(
      (c) =>
        c.telefone &&
        !c.aniversarioPedido &&
        (!c.aniversarioDia || !c.aniversarioMes)
    )
    .map((c) => ({
      id: `pedir-aniversario-${c.id}`,
      tipo: "pedir_aniversario" as const,
      clienteId: c.id,
      clienteNome: c.nome,
      telefone: c.telefone,
      dataReferencia: "Data de nascimento não informada",
      mensagemPadrao: gerarMensagem("pedir_aniversario", primeiroNome(c.nome), undefined, templates),
    }));

  // Cadastro incompleto (sem WhatsApp): não manda mensagem, leva direto pra
  // completar o cadastro do cliente.
  const tarefasCadastroIncompleto: Tarefa[] = clientes
    .filter((c) => !c.telefone)
    .map((c) => ({
      id: `cadastro-incompleto-${c.id}`,
      tipo: "cadastro_incompleto" as const,
      clienteId: c.id,
      clienteNome: c.nome,
      telefone: "",
      dataReferencia: "Sem WhatsApp cadastrado",
      mensagemPadrao: "",
    }));

  const tarefas = [
    ...tarefasCadastroIncompleto,
    ...tarefasNovoCadastro,
    ...tarefasAniversario,
    ...tarefasPedirAniversario,
    ...tarefasCobranca,
    ...tarefasRenovar,
    ...tarefasPosVenda,
    ...tarefasIndicacao,
    ...tarefasInativo,
  ].filter((t) => !dispensados.has(t.id));

  const tarefasPorTipo = new Map<TipoTarefa, Tarefa[]>();
  for (const t of tarefas) {
    const lista = tarefasPorTipo.get(t.tipo) ?? [];
    lista.push(t);
    tarefasPorTipo.set(t.tipo, lista);
  }

  function alternarGrupo(tipo: TipoTarefa) {
    setGruposAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(tipo)) novo.delete(tipo);
      else novo.add(tipo);
      return novo;
    });
  }

  async function concluirTarefa(t: Tarefa) {
    if (processandoTarefa) return;
    setProcessandoTarefa(true);
    try {
      if (t.tipo === "renovar") {
        setClientes(await limparFollowupCliente(t.clienteId));
      } else if (t.tipo === "pos_venda" && t.vendaId) {
        setVendas(await marcarPosVendaContatado(t.vendaId));
      } else if (t.tipo === "indicacao" && t.vendaId) {
        setVendas(await marcarIndicacaoPedida(t.vendaId));
      } else if (t.tipo === "cobranca" && t.vendaId) {
        setVendas(await limparLembreteCobranca(t.vendaId));
      } else if (t.tipo === "novo_cadastro") {
        setClientes(await marcarBoasVindasContatado(t.clienteId));
      } else if (t.tipo === "inativo") {
        setClientes(await marcarInatividadeContatada(t.clienteId));
      } else if (t.tipo === "pedir_aniversario") {
        setClientes(await marcarAniversarioPedido(t.clienteId));
      } else {
        setDispensados((prev) => new Set(prev).add(t.id));
      }
    } finally {
      setProcessandoTarefa(false);
      setTarefaAberta(null);
    }
  }

  function abrirTarefa(t: Tarefa) {
    if (t.tipo === "cadastro_incompleto") {
      onCompletarCadastro(t.clienteId);
      return;
    }
    setTarefaAberta(t);
    setModeloSelecionado(t.tipo);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Início</h1>
        <p>Resumo rápido do seu negócio.</p>
      </div>

      <div className="kpi-scroll">
        <div className="kpi-card">
          <div className="label">Valor em estoque</div>
          <div className="value accent">{currency(valorEstoque)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Vendas do mês</div>
          <div className="value positive">{currency(valorVendasMes)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Clientes cadastrados</div>
          <div className="value">{clientes.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Vendas realizadas</div>
          <div className="value">{vendasConcluidas.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Ticket médio</div>
          <div className="value">{currency(ticketMedio)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Lucro potencial</div>
          <div className="value positive">{currency(lucroPotencial)}</div>
        </div>
      </div>

      {metaVenda > 0 && (
        <div className="panel-card" style={{ marginTop: 16 }}>
          <h2 className="panel-title">Metas</h2>
          <div>
            <div className="row-card-sub" style={{ marginBottom: 6 }}>
              Vendas do mês: {currency(valorVendasMes)} de {currency(metaVenda)} (
              {Math.round(progressoVendaMes)}%)
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progressoVendaMes}%`, background: "var(--success)" }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="panel-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 className="panel-title" style={{ marginBottom: 0 }}>
            Tarefas
          </h2>
        </div>
        {tarefas.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhuma tarefa por aqui 🎉</div>
            <p>
              Boas-vindas, aniversários, follow-ups, pós-vendas, indicações,
              clientes inativos e cadastros incompletos aparecem aqui
              automaticamente.
            </p>
          </div>
        ) : (
          <div>
            {ORDEM_TIPOS_TAREFA.map((tipo) => {
              const lista = tarefasPorTipo.get(tipo);
              if (!lista || lista.length === 0) return null;
              const cfg = CONFIG_TAREFA[tipo];
              const aberto = gruposAbertos.has(tipo);
              return (
                <div key={tipo}>
                  <div className="tarefa-grupo-header" onClick={() => alternarGrupo(tipo)}>
                    <span className="tarefa-grupo-titulo">
                      <span>{cfg.emoji}</span>
                      {cfg.label}
                      <span className={"badge " + cfg.badge}>{lista.length}</span>
                    </span>
                    <span className="tarefa-grupo-seta">{aberto ? "▲" : "▼"}</span>
                  </div>
                  {aberto && (
                    <div className="tarefa-grupo-corpo">
                      {lista.map((t) => (
                        <div
                          key={t.id}
                          className="cliente-linha"
                          onClick={() => abrirTarefa(t)}
                        >
                          <span className="cliente-linha-nome">{t.clienteNome}</span>
                          <span className="cliente-linha-telefone">{t.dataReferencia}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tarefaAberta && (
        <div className="sheet-overlay" onClick={() => setTarefaAberta(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>{tarefaAberta.clienteNome}</h2>
              <button className="sheet-close" onClick={() => setTarefaAberta(null)}>
                ×
              </button>
            </div>

            <div className="form-row">
              <label>Tipo de mensagem</label>
              <select
                className="select-input"
                value={modeloSelecionado ?? tarefaAberta.tipo}
                onChange={(e) => {
                  const novoTipo = e.target.value as TipoTarefa;
                  setModeloSelecionado(novoTipo);
                  const ultima = ultimaVendaPorCliente.get(tarefaAberta.clienteId);
                  const novaMensagem = gerarMensagem(
                    novoTipo,
                    primeiroNome(tarefaAberta.clienteNome),
                    ultima?.itens?.[0]?.nome,
                    templates
                  );
                  setMensagensEditadas((m) => ({ ...m, [tarefaAberta.id]: novaMensagem }));
                }}
              >
                <option value="novo_cadastro">Boas-vindas</option>
                <option value="aniversario">Aniversário</option>
                <option value="pedir_aniversario">Pedir aniversário</option>
                <option value="renovar">Renovar pedido</option>
                <option value="pos_venda">Pós-venda</option>
                <option value="indicacao">Pedir indicação</option>
                <option value="inativo">Cliente inativo</option>
              </select>
            </div>

            <div className="form-row">
              <label>Mensagem</label>
              <textarea
                className="textarea-input"
                rows={6}
                value={mensagensEditadas[tarefaAberta.id] ?? tarefaAberta.mensagemPadrao}
                onChange={(e) =>
                  setMensagensEditadas((m) => ({ ...m, [tarefaAberta.id]: e.target.value }))
                }
              />
            </div>

            <div className="row-card-actions" style={{ marginTop: 4 }}>
              <a
                className="btn btn-primary"
                href={linkWhatsApp(
                  tarefaAberta.telefone,
                  mensagensEditadas[tarefaAberta.id] ?? tarefaAberta.mensagemPadrao
                )}
                target="_blank"
                rel="noreferrer"
                aria-label="Enviar no WhatsApp"
                title="Enviar no WhatsApp"
                onClick={(e) => {
                  if (processandoTarefa) {
                    e.preventDefault();
                    return;
                  }
                  concluirTarefa(tarefaAberta);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  opacity: processandoTarefa ? 0.6 : 1,
                  pointerEvents: processandoTarefa ? "none" : "auto",
                }}
              >
                <IconWhatsApp />
              </a>
              <button
                className="btn btn-ghost"
                disabled={processandoTarefa}
                onClick={() => concluirTarefa(tarefaAberta)}
              >
                {processandoTarefa ? "Salvando..." : "Marcar como feito"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Campanha ---------------------------- */

function TabCampanha({ ativo }: { ativo: boolean }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroSexo, setFiltroSexo] = useState<"qualquer" | "masculino" | "feminino">(
    "qualquer"
  );
  const [filtroRelacionamento, setFiltroRelacionamento] = useState<
    "qualquer" | "sim" | "nao"
  >("qualquer");
  const [filtroFilhos, setFiltroFilhos] = useState<"qualquer" | "sim" | "nao">("qualquer");
  const [mensagemCampanha, setMensagemCampanha] = useState(
    "Oi {nome}! Passando aqui com uma novidade especial pra você! 😊"
  );
  const [enviadosCampanha, setEnviadosCampanha] = useState<Set<string>>(new Set());
  const jaAtivouAntes = useRef(false);

  useEffect(() => {
    getClientes()
      .then(setClientes)
      .finally(() => setCarregando(false));
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos, sem mostrar
  // "Carregando" de novo.
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    getClientes().then(setClientes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  function aplicarPresetCampanha(
    preset: "maes" | "pais" | "namorados" | "mulher" | "limpar"
  ) {
    if (preset === "maes") {
      setFiltroSexo("feminino");
      setFiltroFilhos("sim");
      setFiltroRelacionamento("qualquer");
      setMensagemCampanha(
        "Oi {nome}! Hoje é Dia das Mães e eu queria te desejar um dia incrível! 💐 Já pensou em se presentear com um perfume novo?"
      );
    } else if (preset === "pais") {
      setFiltroSexo("masculino");
      setFiltroFilhos("sim");
      setFiltroRelacionamento("qualquer");
      setMensagemCampanha(
        "Oi {nome}! Feliz Dia dos Pais! 🎉 Que tal renovar o perfume hoje?"
      );
    } else if (preset === "namorados") {
      setFiltroSexo("qualquer");
      setFiltroFilhos("qualquer");
      setFiltroRelacionamento("sim");
      setMensagemCampanha(
        "Oi {nome}! Feliz Dia dos Namorados! 💕 Separei uma sugestão de perfume que combina bem pra ocasião, quer ver?"
      );
    } else if (preset === "mulher") {
      setFiltroSexo("feminino");
      setFiltroFilhos("qualquer");
      setFiltroRelacionamento("qualquer");
      setMensagemCampanha(
        "Oi {nome}! Feliz Dia Internacional da Mulher! 💜 Você merece se cuidar hoje."
      );
    } else {
      setFiltroSexo("qualquer");
      setFiltroFilhos("qualquer");
      setFiltroRelacionamento("qualquer");
      setMensagemCampanha("Oi {nome}! Passando aqui com uma novidade especial pra você! 😊");
    }
  }

  if (carregando) {
    return <div className="empty-state">Carregando campanha...</div>;
  }

  const clientesCampanha = clientes.filter((c) => {
    if (!c.telefone) return false;
    if (filtroSexo !== "qualquer" && c.sexo !== filtroSexo) return false;
    if (filtroRelacionamento !== "qualquer") {
      if (c.emRelacionamento !== (filtroRelacionamento === "sim")) return false;
    }
    if (filtroFilhos !== "qualquer") {
      if (c.temFilhos !== (filtroFilhos === "sim")) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Campanha</h1>
        <p>Dispare mensagens por data comemorativa ou filtro personalizado.</p>
      </div>

      <div className="panel-card">
        <div
          className="row-card-actions"
          style={{ marginBottom: 14, flexWrap: "wrap" }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => aplicarPresetCampanha("maes")}
          >
            Dia das Mães
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => aplicarPresetCampanha("pais")}
          >
            Dia dos Pais
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => aplicarPresetCampanha("namorados")}
          >
            Dia dos Namorados
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => aplicarPresetCampanha("mulher")}
          >
            Dia da Mulher
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => aplicarPresetCampanha("limpar")}
          >
            Limpar filtro
          </button>
        </div>

        <div className="form-row">
          <label>Sexo</label>
          <select
            className="select-input"
            value={filtroSexo}
            onChange={(e) => setFiltroSexo(e.target.value as typeof filtroSexo)}
          >
            <option value="qualquer">Qualquer</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
          </select>
        </div>
        <div className="form-row">
          <label>Em relacionamento</label>
          <select
            className="select-input"
            value={filtroRelacionamento}
            onChange={(e) =>
              setFiltroRelacionamento(e.target.value as typeof filtroRelacionamento)
            }
          >
            <option value="qualquer">Qualquer</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
        <div className="form-row">
          <label>Tem filhos</label>
          <select
            className="select-input"
            value={filtroFilhos}
            onChange={(e) => setFiltroFilhos(e.target.value as typeof filtroFilhos)}
          >
            <option value="qualquer">Qualquer</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>

        <div className="form-row">
          <label>Mensagem (use {"{nome}"} pra personalizar)</label>
          <textarea
            className="textarea-input"
            rows={4}
            value={mensagemCampanha}
            onChange={(e) => setMensagemCampanha(e.target.value)}
          />
        </div>

        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "4px 0 12px" }}>
          {clientesCampanha.length} cliente(s) com telefone cadastrado encontrados com
          esse filtro.
        </p>

        {clientesCampanha.length === 0 ? (
          <div className="empty-state">
            <p>
              Nenhum cliente encontrado. Ajuste o filtro ou complete o cadastro de
              sexo/relacionamento/filhos dos clientes.
            </p>
          </div>
        ) : (
          <div className="list">
            {clientesCampanha.map((c) => {
              const enviado = enviadosCampanha.has(c.id);
              return (
                <div key={c.id} className="row-card">
                  <div className="row-card-body">
                    <div className="row-card-title">{c.nome}</div>
                    {enviado && (
                      <div className="row-card-sub">
                        <span className="badge badge-ok">Enviado</span>
                      </div>
                    )}
                  </div>
                  <a
                    className="btn btn-primary"
                    href={linkWhatsApp(
                      c.telefone,
                      mensagemCampanha.replace(/\{nome\}/g, primeiroNome(c.nome))
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Enviar no WhatsApp"
                    title="Enviar no WhatsApp"
                    onClick={() => setEnviadosCampanha((prev) => new Set(prev).add(c.id))}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      opacity: enviado ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <IconWhatsApp />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Estoque ---------------------------- */

function TabEstoque({
  ativo,
  onVenderProduto,
}: {
  ativo: boolean;
  onVenderProduto: (produtoId: string) => void;
}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ranking, setRanking] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [ocultarZerados, setOcultarZerados] = useState(true);
  const [detalhes, setDetalhes] = useState<Produto | null>(null);
  const [slideDetalhe, setSlideDetalhe] = useState(0);
  const [descricaoExpandida, setDescricaoExpandida] = useState(false);
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [ajusteValor, setAjusteValor] = useState(0);
  const [entradaAberta, setEntradaAberta] = useState(false);
  const [etapaEntrada, setEtapaEntrada] = useState<"metodo" | "manual" | "importar">("metodo");
  const [resolvendoItem, setResolvendoItem] = useState<number | null>(null);
  const [buscaResolucao, setBuscaResolucao] = useState("");
  const [buscaEntrada, setBuscaEntrada] = useState("");
  const [itensEntrada, setItensEntrada] = useState<
    { produto: Produto; quantidade: number }[]
  >([]);
  const [importandoNota, setImportandoNota] = useState(false);
  const [salvandoEntrada, setSalvandoEntrada] = useState(false);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [progressoNota, setProgressoNota] = useState<{ atual: number; total: number } | null>(
    null
  );
  const [erroImportacao, setErroImportacao] = useState("");
  const [naoEncontrados, setNaoEncontrados] = useState<ItemNotaFiscal[]>([]);
  const jaAtivouAntes = useRef(false);

  function buscarDados() {
    getProdutos().then(setProdutos);
    // Ranking é só um "extra" visual — se falhar (ex: RPC indisponível),
    // não deve travar o carregamento do estoque.
    getRankingProdutos()
      .then(setRanking)
      .catch(() => {});
  }

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .finally(() => setCarregando(false));
    getRankingProdutos()
      .then(setRanking)
      .catch(() => {});
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos, sem mostrar
  // "Carregando" de novo.
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    buscarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = produtos;
    if (ocultarZerados) lista = lista.filter((p) => p.estoque > 0);
    if (termo) {
      lista = lista.filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          p.familiaOlfativa.toLowerCase().includes(termo)
      );
    }
    return [...lista].sort(
      (a, b) => (ranking[b.id] ?? 0) - (ranking[a.id] ?? 0)
    );
  }, [produtos, busca, ocultarZerados, ranking]);

  const maisVendidosIds = useMemo(() => {
    return new Set(
      Object.entries(ranking)
        .filter(([, total]) => total > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id)
    );
  }, [ranking]);

  const resultadosEntrada = useMemo(() => {
    const termo = buscaEntrada.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [produtos, buscaEntrada]);

  const resultadosResolucao = useMemo(() => {
    const termo = buscaResolucao.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [produtos, buscaResolucao]);

  const totalUnidades = produtos.reduce((s, p) => s + p.estoque, 0);
  const produtosComEstoque = produtos.filter((p) => p.estoque > 0).length;

  function statusDe(p: Produto) {
    return p.estoque === 0
      ? { label: "Esgotado", cls: "badge-low" }
      : p.estoque <= p.estoqueMinimo
      ? { label: "Baixo", cls: "badge-warn" }
      : { label: "Em estoque", cls: "badge-ok" };
  }

  function abrirAjuste(p: Produto) {
    setAjuste(p);
    setAjusteValor(p.estoque);
    setDetalhes(null);
  }

  async function confirmarAjuste() {
    if (!ajuste || salvandoAjuste) return;
    const delta = ajusteValor - ajuste.estoque;
    setSalvandoAjuste(true);
    try {
      if (delta !== 0) {
        setProdutos(await ajustarEstoque(ajuste.id, delta));
      }
    } finally {
      setSalvandoAjuste(false);
      setAjuste(null);
    }
  }

  function fecharEntrada() {
    setEntradaAberta(false);
    setEtapaEntrada("metodo");
    setBuscaEntrada("");
    setItensEntrada([]);
    setNaoEncontrados([]);
    setErroImportacao("");
    setResolvendoItem(null);
    setBuscaResolucao("");
  }

  // Manual e Importar são sessões independentes: trocar de método descarta
  // qualquer seleção feita no outro, pra não somar itens de fluxos diferentes
  // numa mesma entrada por engano.
  function voltarParaMetodo() {
    setEtapaEntrada("metodo");
    setBuscaEntrada("");
    setItensEntrada([]);
    setNaoEncontrados([]);
    setErroImportacao("");
    setResolvendoItem(null);
    setBuscaResolucao("");
  }

  async function importarNotaFiscal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Trava extra contra clique duplo: mesmo que o input já esteja
    // desabilitado visualmente, ignora qualquer chamada enquanto já
    // houver uma importação em andamento.
    if (importandoNota) return;

    setErroImportacao("");
    setImportandoNota(true);
    setProgressoNota({ atual: 0, total: 0 });
    try {
      const { itens, formato } = await extrairItensNotaFiscal(file, (atual, total) =>
        setProgressoNota({ atual, total })
      );
      if (itens.length === 0) {
        setErroImportacao(
          formato === "desconhecido"
            ? "Não reconheci o formato desse PDF. Ele deve ser a nota fiscal ou o espelho do pedido da Ozonteck."
            : "Não encontrei itens nesse PDF. Confira se é uma nota fiscal da Ozonteck."
        );
        return;
      }
      const { casados, naoEncontrados: semMatch } = casarComCatalogo(itens, produtos);
      setItensEntrada((atual) => {
        const copia = atual.map((i) => ({ ...i }));
        for (const c of casados) {
          const existente = copia.find((i) => i.produto.id === c.produto.id);
          if (existente) existente.quantidade += c.quantidade;
          else copia.push(c);
        }
        return copia;
      });
      setNaoEncontrados(semMatch);
    } catch {
      setErroImportacao("Não foi possível ler esse PDF. Tente novamente.");
    } finally {
      setImportandoNota(false);
      setProgressoNota(null);
    }
  }

  function adicionarItemEntrada(p: Produto) {
    setItensEntrada((itens) => {
      const existente = itens.find((i) => i.produto.id === p.id);
      if (existente) {
        return itens.map((i) =>
          i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...itens, { produto: p, quantidade: 1 }];
    });
  }

  function resolverNaoEncontrado(idx: number, produto: Produto) {
    const item = naoEncontrados[idx];
    if (!item) return;
    setItensEntrada((itens) => {
      const existente = itens.find((i) => i.produto.id === produto.id);
      if (existente) {
        return itens.map((i) =>
          i.produto.id === produto.id
            ? { ...i, quantidade: i.quantidade + item.quantidade }
            : i
        );
      }
      return [...itens, { produto, quantidade: item.quantidade }];
    });
    setNaoEncontrados((atual) => atual.filter((_, i) => i !== idx));
    setResolvendoItem(null);
    setBuscaResolucao("");
  }

  function atualizarQtdEntrada(id: string, quantidade: number) {
    setItensEntrada((itens) =>
      itens.map((i) =>
        i.produto.id === id ? { ...i, quantidade: Math.max(1, quantidade) } : i
      )
    );
  }

  function removerItemEntrada(id: string) {
    setItensEntrada((itens) => itens.filter((i) => i.produto.id !== id));
  }

  async function confirmarEntrada() {
    // Trava contra clique duplo: se já tem uma entrada sendo salva, ignora.
    // Isso precisa ser checado ANTES de qualquer await, senão dois cliques
    // rápidos entram os dois aqui antes do estado atualizar.
    if (itensEntrada.length === 0 || salvandoEntrada) return;
    const itens = itensEntrada;
    setSalvandoEntrada(true);
    // Fecha a janela imediatamente no primeiro clique, como pedido —
    // o salvamento continua em segundo plano com o indicador de carregamento.
    fecharEntrada();
    try {
      let atualizados = produtos;
      for (const item of itens) {
        atualizados = await ajustarEstoque(item.produto.id, item.quantidade);
      }
      setProdutos(atualizados);

      // Toda entrada de estoque é dinheiro saindo pra comprar da Ozonteck —
      // registra automaticamente no financeiro (usa o custo, que é o que
      // realmente é pago, não o preço de venda). Esse valor também alimenta
      // o progresso de graduação na Início (1 real investido = 1 ponto).
      const valorTotal = itens.reduce(
        (soma, item) => soma + item.quantidade * item.produto.custo,
        0
      );
      const totalUnidades = itens.reduce((soma, item) => soma + item.quantidade, 0);
      if (valorTotal > 0) {
        await addLancamento({
          tipo: "saida",
          categoria: "Compra de estoque",
          descricao: `Entrada de estoque: ${itens.length} produto(s), ${totalUnidades} un.`,
          valor: valorTotal,
        });
      }
    } finally {
      setSalvandoEntrada(false);
    }
  }

  if (carregando) {
    return <div className="empty-state">Carregando produtos...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <h1>Estoque</h1>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEntradaAberta(true);
              setEtapaEntrada("metodo");
            }}
            disabled={salvandoEntrada}
          >
            {salvandoEntrada ? "Salvando..." : "Entrada"}
          </button>
        </div>
        <p>Catálogo, quantidade disponível e preço.</p>
        {salvandoEntrada && (
          <div className="empty-state" style={{ padding: "10px 14px", textAlign: "left" }}>
            Salvando entrada de estoque, um instante...
          </div>
        )}
      </div>

      <div className="kpi-scroll">
        <div className="kpi-card">
          <div className="label">Unidades</div>
          <div className="value">{totalUnidades}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Variações em estoque</div>
          <div className="value">{produtosComEstoque}</div>
        </div>
      </div>

      <div className="panel-card">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.82rem",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={ocultarZerados}
              onChange={(e) => setOcultarZerados(e.target.checked)}
            />
            Ocultar itens esgotados
          </label>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhum produto encontrado</div>
            <p>
              {ocultarZerados
                ? "Todos os produtos estão esgotados, ou ajuste a busca."
                : "Ajuste a busca."}
            </p>
          </div>
        ) : (
          <div className="stock-grid">
            {filtrados.map((p) => {
              const status = statusDe(p);
              return (
                <div
                  key={p.id}
                  className="stock-card"
                  onClick={() => {
                    setDetalhes(p);
                    setSlideDetalhe(0);
                    setDescricaoExpandida(false);
                  }}
                >
                  <div className="stock-card-media">
                    {p.imagem ? (
                      <img src={p.imagem} alt={p.nome} loading="lazy" decoding="async" />
                    ) : (
                      <span className="stock-card-placeholder">
                        {p.nome.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {maisVendidosIds.has(p.id) && (
                      <span className="badge stock-card-badge-left" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                        🔥
                      </span>
                    )}
                    <span className={"badge stock-card-badge " + status.cls}>
                      {status.label}
                    </span>
                  </div>
                  <div className="stock-card-body">
                    <div className="stock-card-tag">
                      {p.familiaOlfativa || "Perfumes"}
                    </div>
                    <div className="stock-card-title">{p.nome}</div>
                    <div className="stock-card-footer">
                      <span className="stock-card-price">{currency(p.preco)}</span>
                      <span className="stock-card-qty">{p.estoque} un.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detalhes && (
        <div className="sheet-overlay" onClick={() => setDetalhes(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h2>{detalhes.nome}</h2>
              <button className="sheet-close" onClick={() => setDetalhes(null)}>
                ×
              </button>
            </div>

            <div
              className="stock-detail-swipe"
              onScroll={(e) => {
                const el = e.currentTarget;
                const indice = Math.round(el.scrollLeft / el.clientWidth);
                setSlideDetalhe(indice);
              }}
            >
              <div className="stock-detail-slide">
                {detalhes.imagem ? (
                  <img src={detalhes.imagem} alt={detalhes.nome} decoding="async" />
                ) : (
                  <span className="stock-card-placeholder">
                    {detalhes.nome.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="stock-detail-slide-label">Ozonteck</span>
              </div>
              {detalhes.imagemReferencia && (
                <div className="stock-detail-slide eh-referencia">
                  <img
                    src={detalhes.imagemReferencia}
                    alt={detalhes.referenciaNome ?? "Referência do perfume importado"}
                    decoding="async"
                  />
                  <span className="stock-detail-slide-label">
                    Referência: {detalhes.referenciaNome ?? "não identificada"}
                  </span>
                </div>
              )}
            </div>
            {detalhes.imagemReferencia && (
              <>
                <div className="stock-detail-dots">
                  <span className={"stock-detail-dot " + (slideDetalhe === 0 ? "ativo" : "")} />
                  <span className={"stock-detail-dot " + (slideDetalhe === 1 ? "ativo" : "")} />
                </div>
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.7rem",
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  Arraste pra o lado pra ver a referência. Só aparece aqui, uso interno.
                </p>
              </>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                margin: "14px 0 10px",
              }}
            >
              <span className="stock-card-tag">
                {detalhes.familiaOlfativa || "Perfumes"}
              </span>
              <span className={"badge " + statusDe(detalhes).cls}>
                {statusDe(detalhes).label}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--gold)" }}>
                {currency(detalhes.preco)}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {detalhes.estoque} un. em estoque
              </div>
            </div>

            {detalhes.descricaoCurta && (
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.86rem",
                  lineHeight: 1.5,
                  margin: descricaoExpandida && detalhes.descricaoCompleta ? "0 0 8px" : "0 0 16px",
                }}
              >
                {detalhes.descricaoCurta}
              </p>
            )}

            {detalhes.descricaoCompleta && (
              <>
                {descricaoExpandida && (
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "0.86rem",
                      lineHeight: 1.5,
                      margin: "0 0 8px",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {detalhes.descricaoCompleta}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setDescricaoExpandida((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--gold)",
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  {descricaoExpandida ? "Ver menos" : "Ver mais"}
                </button>
              </>
            )}

            <button
              className="btn btn-primary btn-block"
              onClick={() => abrirAjuste(detalhes)}
            >
              Ajustar estoque
            </button>
            <button
              className="btn btn-ghost btn-block"
              style={{ marginTop: 8 }}
              onClick={() => {
                onVenderProduto(detalhes.id);
                setDetalhes(null);
              }}
            >
              Vender
            </button>
          </div>
        </div>
      )}

      {ajuste && (
        <div className="sheet-overlay" onClick={() => setAjuste(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Ajustar estoque</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              {ajuste.imagem ? (
                <img src={ajuste.imagem} alt={ajuste.nome} className="row-card-media" />
              ) : (
                <div className="row-card-media-placeholder">
                  {ajuste.nome.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="row-card-title">{ajuste.nome}</div>
                <div className="row-card-sub">Estoque atual: {ajuste.estoque} un.</div>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 8 }}>
              <label>Nova quantidade em estoque</label>
              <div className="qty-control" style={{ justifyContent: "center" }}>
                <button onClick={() => setAjusteValor((q) => Math.max(0, q - 1))}>−</button>
                <input
                  type="number"
                  inputMode="numeric"
                  className="text-input"
                  style={{ textAlign: "center", maxWidth: 100 }}
                  value={ajusteValor}
                  onChange={(e) => setAjusteValor(Math.max(0, Number(e.target.value)))}
                />
                <button onClick={() => setAjusteValor((q) => q + 1)}>+</button>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="btn btn-ghost"
                disabled={salvandoAjuste}
                onClick={() => setAjuste(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={salvandoAjuste}
                onClick={confirmarAjuste}
              >
                {salvandoAjuste ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {entradaAberta && (
        <div
          className="sheet-overlay"
          onClick={importandoNota ? undefined : fecharEntrada}
        >
          <div className="sheet sheet-full" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>
                {etapaEntrada === "metodo" && "Entrada de estoque"}
                {etapaEntrada === "manual" && "Adicionar manualmente"}
                {etapaEntrada === "importar" && "Importar nota fiscal"}
              </h2>
              <button
                className="sheet-close"
                onClick={fecharEntrada}
                disabled={importandoNota}
              >
                ×
              </button>
            </div>

            <div className="sheet-full-body">
              {etapaEntrada === "metodo" && (
                <>
                  <button
                    type="button"
                    className="metodo-card"
                    onClick={() => setEtapaEntrada("manual")}
                  >
                    <span className="metodo-card-icone">📝</span>
                    <span>
                      <div className="metodo-card-titulo">Adicionar manualmente</div>
                      <div className="metodo-card-subtitulo">
                        Navegue pelo catálogo e adicione item por item
                      </div>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="metodo-card"
                    onClick={() => setEtapaEntrada("importar")}
                  >
                    <span className="metodo-card-icone">📄</span>
                    <span>
                      <div className="metodo-card-titulo">Importar nota fiscal (PDF)</div>
                      <div className="metodo-card-subtitulo">
                        Leio a nota e já reconheço os produtos automaticamente
                      </div>
                    </span>
                  </button>
                </>
              )}

              {etapaEntrada === "manual" && (
                <>
                  <input
                    className="search-input"
                    placeholder="Digite o nome do perfume..."
                    value={buscaEntrada}
                    onChange={(e) => setBuscaEntrada(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  {itensEntrada.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 10 }}>
                      {itensEntrada.length} produto(s) nesta entrada,{" "}
                      {itensEntrada.reduce((s, i) => s + i.quantidade, 0)} un. no total
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
                    {resultadosEntrada.length === 0 ? (
                      <div className="empty-state" style={{ padding: "20px 0" }}>
                        Nenhum produto encontrado.
                      </div>
                    ) : (
                      resultadosEntrada.map((p) => {
                        const item = itensEntrada.find((i) => i.produto.id === p.id);
                        return (
                          <div
                            key={p.id}
                            className={"produto-linha" + (item ? " selecionada" : "")}
                            onClick={() => {
                              if (!item) adicionarItemEntrada(p);
                            }}
                          >
                            {p.imagem ? (
                              <img src={p.imagem} className="produto-mini-thumb" alt="" />
                            ) : (
                              <div className="produto-mini-thumb-placeholder">
                                {p.nome.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="produto-linha-nome">{p.nome}</span>
                            {item ? (
                              <div className="qty-control" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() =>
                                    item.quantidade <= 1
                                      ? removerItemEntrada(p.id)
                                      : atualizarQtdEntrada(p.id, item.quantidade - 1)
                                  }
                                >
                                  −
                                </button>
                                <span style={{ minWidth: 20, textAlign: "center" }}>
                                  {item.quantidade}
                                </span>
                                <button onClick={() => atualizarQtdEntrada(p.id, item.quantidade + 1)}>
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="produto-linha-add"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  adicionarItemEntrada(p);
                                }}
                              >
                                +
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {etapaEntrada === "importar" && (
                <>
                  <label
                    className="btn btn-ghost btn-block"
                    style={{
                      cursor: importandoNota ? "not-allowed" : "pointer",
                      opacity: importandoNota ? 0.6 : 1,
                      marginBottom: importandoNota ? 8 : 12,
                    }}
                  >
                    {importandoNota ? "Lendo nota fiscal..." : "📄 Selecionar PDF da nota fiscal"}
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={importarNotaFiscal}
                      disabled={importandoNota}
                      style={{ display: "none" }}
                    />
                  </label>
                  {importandoNota && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: "var(--panel-2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 999,
                            background: "var(--gold)",
                            width:
                              progressoNota && progressoNota.total > 0
                                ? `${Math.round((progressoNota.atual / progressoNota.total) * 100)}%`
                                : "12%",
                            transition: "width 0.2s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: "var(--muted)",
                          marginTop: 4,
                          textAlign: "center",
                        }}
                      >
                        {progressoNota && progressoNota.total > 0
                          ? `Lendo página ${progressoNota.atual} de ${progressoNota.total}... não feche essa tela.`
                          : "Abrindo o PDF... não feche essa tela."}
                      </div>
                    </div>
                  )}
                  {erroImportacao && (
                    <div className="login-error" style={{ marginBottom: 12 }}>
                      {erroImportacao}
                    </div>
                  )}

                  {itensEntrada.length > 0 && (
                    <>
                      <div className="entrada-secao-titulo">
                        Reconhecidos automaticamente ({itensEntrada.length})
                      </div>
                      <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                        {itensEntrada.map((item) => (
                          <div
                            key={item.produto.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              paddingBottom: 8,
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <span style={{ flex: 1, fontSize: "0.86rem" }}>
                              {item.produto.imagem ? (
                                <img
                                  src={item.produto.imagem}
                                  className="produto-mini-thumb"
                                  alt=""
                                  style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8 }}
                                />
                              ) : (
                                <span
                                  className="produto-mini-thumb-placeholder"
                                  style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}
                                >
                                  {item.produto.nome.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              {item.produto.nome}
                            </span>
                            <div className="qty-control">
                              <button
                                onClick={() =>
                                  atualizarQtdEntrada(item.produto.id, item.quantidade - 1)
                                }
                              >
                                −
                              </button>
                              <span style={{ minWidth: 20, textAlign: "center" }}>
                                {item.quantidade}
                              </span>
                              <button
                                onClick={() =>
                                  atualizarQtdEntrada(item.produto.id, item.quantidade + 1)
                                }
                              >
                                +
                              </button>
                            </div>
                            <button
                              className="btn btn-ghost btn-icon"
                              onClick={() => removerItemEntrada(item.produto.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {naoEncontrados.length > 0 && (
                    <>
                      <div className="entrada-secao-titulo">
                        Não reconhecidos ({naoEncontrados.length}) — toque pra localizar o produto certo
                      </div>
                      {naoEncontrados.map((item, idx) => (
                        <div key={idx} className="item-nao-reconhecido">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "0.86rem" }}>{item.descricao}</div>
                              <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                                {item.quantidade} un. na nota
                              </div>
                            </div>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ flexShrink: 0 }}
                              onClick={() => {
                                if (resolvendoItem === idx) {
                                  setResolvendoItem(null);
                                  setBuscaResolucao("");
                                } else {
                                  setResolvendoItem(idx);
                                  setBuscaResolucao("");
                                }
                              }}
                            >
                              {resolvendoItem === idx ? "Fechar" : "Localizar produto"}
                            </button>
                          </div>
                          {resolvendoItem === idx && (
                            <div style={{ marginTop: 10 }}>
                              <input
                                className="search-input"
                                placeholder="Buscar produto no catálogo..."
                                value={buscaResolucao}
                                onChange={(e) => setBuscaResolucao(e.target.value)}
                                style={{ marginBottom: 8 }}
                              />
                              <div
                                style={{
                                  display: "grid",
                                  gap: 4,
                                  maxHeight: 160,
                                  overflowY: "auto",
                                }}
                              >
                                {resultadosResolucao.length === 0 ? (
                                  <div className="empty-state" style={{ padding: "12px 0" }}>
                                    Nenhum produto encontrado.
                                  </div>
                                ) : (
                                  resultadosResolucao.map((p) => (
                                    <div
                                      key={p.id}
                                      className="cart-line"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => resolverNaoEncontrado(idx, p)}
                                    >
                                      <span>{p.nome}</span>
                                      <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                                        {p.estoque} em estoque
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="sheet-full-footer">
              {etapaEntrada === "metodo" ? (
                <div className="form-actions">
                  <button className="btn btn-ghost btn-block" onClick={fecharEntrada}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="form-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={voltarParaMetodo}
                    disabled={importandoNota}
                  >
                    Voltar
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={itensEntrada.length === 0 || salvandoEntrada}
                    onClick={confirmarEntrada}
                  >
                    Confirmar entrada (
                    {itensEntrada.reduce((s, i) => s + i.quantidade, 0)} un.)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Clientes ---------------------------- */

function TabClientes({
  ativo,
  onNovaVenda,
  clienteParaEditar,
  aoConsumirClienteParaEditar,
}: {
  ativo: boolean;
  onNovaVenda: (clienteId: string) => void;
  clienteParaEditar?: string | null;
  aoConsumirClienteParaEditar?: () => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [detalhes, setDetalhes] = useState<Cliente | null>(null);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [importAberto, setImportAberto] = useState(false);
  const [contatosLidos, setContatosLidos] = useState<ContatoImportado[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [removendoCliente, setRemovendoCliente] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [avisoImportacao, setAvisoImportacao] = useState("");
  const jaAtivouAntes = useRef(false);

  function buscarDados() {
    return Promise.all([getClientes(), getVendas()]).then(([c, v]) => {
      setClientes(c);
      setVendas(v);
    });
  }

  useEffect(() => {
    buscarDados().finally(() => setCarregando(false));
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos, sem mostrar
  // "Carregando" de novo.
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    buscarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  useEffect(() => {
    if (clienteParaEditar && clientes.length > 0) {
      const cliente = clientes.find((c) => c.id === clienteParaEditar);
      if (cliente) {
        setDetalhes(null);
        setEditando({ ...cliente });
      }
      aoConsumirClienteParaEditar?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteParaEditar, clientes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? clientes.filter(
          (c) => c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo)
        )
      : clientes;
    return [...base].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes, busca]);

  function totalGasto(clienteId: string) {
    return vendas
      .filter((v) => v.clienteId === clienteId && v.status === "concluida")
      .reduce((s, v) => s + v.total, 0);
  }

  async function lerArquivoContatos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLendoArquivo(true);
    setAvisoImportacao("");
    try {
      const contatos = await extrairContatosPlanilha(await file.arrayBuffer());

      if (contatos.length === 0) {
        setAvisoImportacao(
          "Não encontrei nenhum contato válido nessa planilha. Confira se preencheu as colunas Nome e Telefone."
        );
        setContatosLidos([]);
        setSelecionados(new Set());
        return;
      }
      const existentes = new Set(clientes.map((c) => normalizarTelefone(c.telefone)));
      const vistos = new Set<string>();
      const novosIndices = new Set<number>();
      contatos.forEach((c, i) => {
        const tel = normalizarTelefone(c.telefone);
        if (tel && !existentes.has(tel) && !vistos.has(tel)) {
          vistos.add(tel);
          novosIndices.add(i);
        }
      });
      setContatosLidos(contatos);
      setSelecionados(novosIndices);
    } catch {
      setAvisoImportacao("Não consegui ler essa planilha. Confira se é um arquivo .xlsx válido.");
    } finally {
      setLendoArquivo(false);
    }
  }

  function alternarSelecionado(i: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });
  }

  async function confirmarImportacao() {
    if (importando || selecionados.size === 0) return;
    setImportando(true);
    try {
      const escolhidos = contatosLidos.filter((_, i) => selecionados.has(i));
      const { importados, clientes: atualizados } = await importarClientes(escolhidos);
      setClientes(atualizados);
      setAvisoImportacao(`${importados} contato(s) importado(s) com sucesso!`);
      setContatosLidos([]);
      setSelecionados(new Set());
    } finally {
      setImportando(false);
    }
  }

  function fecharImportacao() {
    setImportAberto(false);
    setContatosLidos([]);
    setSelecionados(new Set());
    setAvisoImportacao("");
  }

  if (carregando) {
    return <div className="empty-state">Carregando clientes...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Clientes</h1>
        <p>
          {clientes.length} cliente{clientes.length === 1 ? "" : "s"} cadastrado
          {clientes.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="panel-card">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1 }}
              onClick={() =>
                setEditando({
                  id: "",
                  nome: "",
                  telefone: "",
                  email: "",
                  origem: "Indicação",
                  observacoes: "",
                  aniversarioDia: null,
                  aniversarioMes: null,
                  proximoFollowup: null,
                  criadoEm: new Date().toISOString(),
                  boasVindasContatado: false,
                  sexo: null,
                  emRelacionamento: null,
                  temFilhos: null,
                  inatividadeContatadaEm: null,
                  aniversarioPedido: false,
                })
              }
            >
              + Novo cliente
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ flex: 1 }}
              onClick={() => setImportAberto(true)}
            >
              Importar planilha
            </button>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhum cliente cadastrado</div>
            <p>Cadastre o primeiro cliente para começar a registrar vendas.</p>
          </div>
        ) : (
          <div>
            {filtrados.map((c) => (
              <div
                key={c.id}
                className="cliente-linha"
                onClick={() => setDetalhes(c)}
              >
                <span className="cliente-linha-nome">{c.nome}</span>
                {c.telefone && <span className="cliente-linha-telefone">{c.telefone}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {detalhes && (
        <div className="sheet-overlay" onClick={() => setDetalhes(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h2>{detalhes.nome}</h2>
              <button className="sheet-close" onClick={() => setDetalhes(null)}>
                ×
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {detalhes.telefone && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>Telefone</span>
                  <span>{detalhes.telefone}</span>
                </div>
              )}
              {detalhes.email && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>E-mail</span>
                  <span>{detalhes.email}</span>
                </div>
              )}
              <div className="cart-line">
                <span style={{ color: "var(--muted)" }}>Origem</span>
                <span>{detalhes.origem || "—"}</span>
              </div>
              {detalhes.sexo && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>Sexo</span>
                  <span>{detalhes.sexo === "feminino" ? "Feminino" : "Masculino"}</span>
                </div>
              )}
              {detalhes.emRelacionamento !== null && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>Em relacionamento</span>
                  <span>{detalhes.emRelacionamento ? "Sim" : "Não"}</span>
                </div>
              )}
              {detalhes.temFilhos !== null && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>Tem filhos</span>
                  <span>{detalhes.temFilhos ? "Sim" : "Não"}</span>
                </div>
              )}
              {detalhes.aniversarioDia && detalhes.aniversarioMes && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>Aniversário</span>
                  <span>
                    {detalhes.aniversarioDia}/{detalhes.aniversarioMes}
                  </span>
                </div>
              )}
              {detalhes.proximoFollowup && (
                <div className="cart-line">
                  <span style={{ color: "var(--muted)" }}>Próximo follow-up</span>
                  <span>
                    {new Date(detalhes.proximoFollowup + "T00:00:00").toLocaleDateString(
                      "pt-BR"
                    )}
                  </span>
                </div>
              )}
              <div className="cart-line">
                <span style={{ color: "var(--muted)" }}>Total gasto</span>
                <span className="value positive">{currency(totalGasto(detalhes.id))}</span>
              </div>
              {detalhes.observacoes && (
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: "0.86rem",
                    lineHeight: 1.5,
                    marginTop: 10,
                  }}
                >
                  {detalhes.observacoes}
                </p>
              )}
            </div>

            <button
              className="btn btn-primary btn-block"
              style={{ marginBottom: 8 }}
              onClick={() => {
                onNovaVenda(detalhes.id);
                setDetalhes(null);
              }}
            >
              + Nova venda
            </button>
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setEditando({ ...detalhes });
                  setDetalhes(null);
                }}
              >
                Editar
              </button>
              <button
                className="btn btn-danger"
                disabled={removendoCliente}
                onClick={async () => {
                  if (removendoCliente) return;
                  if (confirm("Remover este cliente?")) {
                    setRemovendoCliente(true);
                    try {
                      setClientes(await removeCliente(detalhes.id));
                      setDetalhes(null);
                    } finally {
                      setRemovendoCliente(false);
                    }
                  }
                }}
              >
                {removendoCliente ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="sheet-overlay" onClick={() => setEditando(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>{editando.id ? "Editar cliente" : "Novo cliente"}</h2>
            <div className="form-grid">
              <div className="form-row">
                <label>Nome</label>
                <input
                  className="text-input"
                  value={editando.nome}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Telefone / WhatsApp</label>
                <input
                  className="text-input"
                  inputMode="tel"
                  value={editando.telefone}
                  onChange={(e) => setEditando({ ...editando, telefone: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>E-mail</label>
                <input
                  className="text-input"
                  inputMode="email"
                  value={editando.email}
                  onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Origem</label>
                <select
                  className="select-input"
                  value={editando.origem}
                  onChange={(e) => setEditando({ ...editando, origem: e.target.value })}
                >
                  <option>Família</option>
                  <option>Amigo(a)</option>
                  <option>Trabalho</option>
                  <option>Salão</option>
                  <option>Motorista de app</option>
                  <option>Indicação</option>
                  <option>Rede social</option>
                  <option>Outro</option>
                </select>
              </div>
              <div className="form-row">
                <label>Sexo</label>
                <select
                  className="select-input"
                  value={editando.sexo ?? ""}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      sexo: (e.target.value || null) as "masculino" | "feminino" | null,
                    })
                  }
                >
                  <option value="">Não informado</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </div>
              <div className="form-row">
                <label>Em relacionamento</label>
                <select
                  className="select-input"
                  value={
                    editando.emRelacionamento === null
                      ? ""
                      : editando.emRelacionamento
                      ? "sim"
                      : "nao"
                  }
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      emRelacionamento:
                        e.target.value === "" ? null : e.target.value === "sim",
                    })
                  }
                >
                  <option value="">Não informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div className="form-row">
                <label>Tem filhos</label>
                <select
                  className="select-input"
                  value={editando.temFilhos === null ? "" : editando.temFilhos ? "sim" : "nao"}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      temFilhos: e.target.value === "" ? null : e.target.value === "sim",
                    })
                  }
                >
                  <option value="">Não informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div className="form-row">
                <label>Observações</label>
                <textarea
                  className="textarea-input"
                  rows={3}
                  value={editando.observacoes}
                  onChange={(e) =>
                    setEditando({ ...editando, observacoes: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <label>Aniversário (dia e mês)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="select-input"
                    value={editando.aniversarioDia ?? ""}
                    onChange={(e) =>
                      setEditando({
                        ...editando,
                        aniversarioDia: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">Dia</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-input"
                    value={editando.aniversarioMes ?? ""}
                    onChange={(e) =>
                      setEditando({
                        ...editando,
                        aniversarioMes: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">Mês</option>
                    {[
                      "Janeiro",
                      "Fevereiro",
                      "Março",
                      "Abril",
                      "Maio",
                      "Junho",
                      "Julho",
                      "Agosto",
                      "Setembro",
                      "Outubro",
                      "Novembro",
                      "Dezembro",
                    ].map((mes, i) => (
                      <option key={mes} value={i + 1}>
                        {mes}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <label>Próximo follow-up</label>
                <input
                  type="date"
                  className="text-input"
                  value={editando.proximoFollowup || ""}
                  onChange={(e) =>
                    setEditando({ ...editando, proximoFollowup: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-ghost"
                disabled={salvandoCliente}
                onClick={() => setEditando(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={salvandoCliente}
                onClick={async () => {
                  if (salvandoCliente || !editando || !editando.nome.trim()) return;
                  setSalvandoCliente(true);
                  try {
                    setClientes(await upsertCliente(editando));
                    setEditando(null);
                  } finally {
                    setSalvandoCliente(false);
                  }
                }}
              >
                {salvandoCliente ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importAberto && (
        <div className="sheet-overlay" onClick={fecharImportacao}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>Importar contatos</h2>
              <button className="sheet-close" onClick={fecharImportacao}>
                ×
              </button>
            </div>

            {contatosLidos.length === 0 ? (
              <>
                <p className="sheet-descricao">
                  Baixe a planilha modelo, preencha com seus contatos e
                  suba de volta aqui pra importar vários clientes de uma
                  vez.
                </p>
                <a
                  href="/modelo-contatos.xlsx"
                  download
                  className="btn btn-ghost btn-block"
                  style={{ marginBottom: 10, textDecoration: "none" }}
                >
                  📥 Baixar modelo de planilha (.xlsx)
                </a>
                <label className="btn btn-primary btn-block" style={{ cursor: "pointer" }}>
                  {lendoArquivo ? "Lendo arquivo..." : "Escolher planilha preenchida"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{ display: "none" }}
                    disabled={lendoArquivo}
                    onChange={lerArquivoContatos}
                  />
                </label>
                <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 10 }}>
                  Telefone no formato +55DDDNúmero, ex: +5527998877665.
                </p>
                {avisoImportacao && (
                  <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 12 }}>
                    {avisoImportacao}
                  </p>
                )}
              </>
            ) : (
              <>
                <p
                  style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 12px" }}
                >
                  {selecionados.size} de {contatosLidos.length} selecionado(s) pra
                  importar. Contatos já cadastrados (mesmo telefone) vêm
                  desmarcados automaticamente.
                </p>
                <div className="list" style={{ maxHeight: "40vh", overflowY: "auto" }}>
                  {contatosLidos.map((c, i) => {
                    const tel = normalizarTelefone(c.telefone);
                    const jaExiste = clientes.some(
                      (existente) => normalizarTelefone(existente.telefone) === tel
                    );
                    const marcado = selecionados.has(i);
                    return (
                      <div
                        key={i}
                        className="row-card"
                        style={{
                          opacity: jaExiste ? 0.5 : 1,
                          cursor: jaExiste ? "default" : "pointer",
                        }}
                        onClick={() => !jaExiste && alternarSelecionado(i)}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={jaExiste}
                          onChange={() => alternarSelecionado(i)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="row-card-body">
                          <div className="row-card-title">{c.nome}</div>
                          <div className="row-card-sub">
                            {tel}
                            {jaExiste ? " • já cadastrado" : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {avisoImportacao && (
                  <p style={{ color: "var(--success)", fontSize: "0.85rem", margin: "12px 0" }}>
                    {avisoImportacao}
                  </p>
                )}
                <div className="form-actions" style={{ marginTop: 14 }}>
                  <button className="btn btn-ghost" onClick={fecharImportacao}>
                    Fechar
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={selecionados.size === 0 || importando}
                    onClick={confirmarImportacao}
                  >
                    {importando
                      ? "Importando..."
                      : `Importar ${selecionados.size} contato(s)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Vendas ---------------------------- */

function TabVendas({
  ativo,
  clientePreSelecionado,
  aoConsumirPreSelecao,
  produtoPreSelecionado,
  aoConsumirProdutoPreSelecao,
  onCompletarWhatsapp,
}: {
  ativo: boolean;
  clientePreSelecionado?: string | null;
  aoConsumirPreSelecao?: () => void;
  produtoPreSelecionado?: string | null;
  aoConsumirProdutoPreSelecao?: () => void;
  onCompletarWhatsapp: (clienteId: string) => void;
}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [etapaVenda, setEtapaVenda] = useState<"produtos" | "cliente" | "pagamento">(
    "produtos"
  );
  const [clienteAvulso, setClienteAvulso] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [dividirPagamento, setDividirPagamento] = useState(false);
  const [formaPagamento2, setFormaPagamento2] = useState("Dinheiro");
  const [valorPagamento1, setValorPagamento1] = useState<number | "">("");
  const [valorPagamento2, setValorPagamento2] = useState<number | "">("");
  const [lembreteCobranca, setLembreteCobranca] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [carrinho, setCarrinho] = useState<ItemVenda[]>([]);
  const [revendedor, setRevendedor] = useState(false);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [vendaEditando, setVendaEditando] = useState<Venda | null>(null);
  const [detalhes, setDetalhes] = useState<Venda | null>(null);
  const [recebendo, setRecebendo] = useState<Venda | null>(null);
  const [formaRecebimento, setFormaRecebimento] = useState("Pix");
  const [salvando, setSalvando] = useState(false);
  const [processandoDetalheVenda, setProcessandoDetalheVenda] = useState(false);
  const [confirmandoRecebimento, setConfirmandoRecebimento] = useState(false);
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");
  const [salvandoNovoCliente, setSalvandoNovoCliente] = useState(false);
  const jaAtivouAntes = useRef(false);

  async function salvarNovoClienteDaVenda() {
    if (!novoClienteNome.trim() || salvandoNovoCliente) return;
    setSalvandoNovoCliente(true);
    try {
      const criado = await criarClienteRapido({
        nome: novoClienteNome.trim(),
        telefone: novoClienteTelefone,
      });
      setClientes((atuais) => [criado, ...atuais]);
      setClienteSelecionado(criado.id);
      setBuscaCliente("");
      setClienteAvulso("");
      setCadastrandoCliente(false);
      setNovoClienteNome("");
      setNovoClienteTelefone("");
    } finally {
      setSalvandoNovoCliente(false);
    }
  }

  async function recarregar() {
    const [p, c, v] = await Promise.all([getProdutos(), getClientes(), getVendas()]);
    setProdutos(p);
    setClientes(c);
    setVendas(v);
  }

  useEffect(() => {
    recarregar().finally(() => setCarregando(false));
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos, sem mostrar
  // "Carregando" de novo.
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  useEffect(() => {
    if (clientePreSelecionado) {
      setVendaEditando(null);
      setCarrinho([]);
      setClienteSelecionado(clientePreSelecionado);
      setBuscaCliente("");
      setClienteAvulso("");
      setFormaPagamento("Pix");
      setLembreteCobranca("");
      setEtapaVenda("produtos");
      setRevendedor(false);
      setSheetAberto(true);
      aoConsumirPreSelecao?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientePreSelecionado]);

  useEffect(() => {
    if (produtoPreSelecionado && produtos.length > 0) {
      const produto = produtos.find((p) => p.id === produtoPreSelecionado);
      if (produto) {
        setVendaEditando(null);
        setClienteSelecionado("");
        setBuscaCliente("");
        setClienteAvulso("");
        setFormaPagamento("Pix");
        setLembreteCobranca("");
        setEtapaVenda("produtos");
        setRevendedor(false);
        setCarrinho([
          { produtoId: produto.id, nome: produto.nome, quantidade: 1, precoUnitario: produto.preco },
        ]);
        setSheetAberto(true);
      }
      aoConsumirProdutoPreSelecao?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoPreSelecionado, produtos]);

  // Ao editar uma venda ativa (concluída), os itens que já estavam nela
  // ainda não foram "devolvidos" ao estoque na tela — então a quantidade
  // disponível pra escolher é o estoque atual + o que já estava alocado.
  // Se a venda estava cancelada, os itens já foram devolvidos ao estoque
  // no cancelamento, então não somamos nada extra.
  function estoqueDisponivel(p: Produto) {
    if (!vendaEditando || vendaEditando.status !== "concluida") return p.estoque;
    const jaAlocado = vendaEditando.itens.find((i) => i.produtoId === p.id)?.quantidade ?? 0;
    return p.estoque + jaAlocado;
  }

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase();
    // Um produto entra na lista se estiver ativo com estoque disponível,
    // OU se já fizer parte do carrinho atual (caso de edição de venda:
    // o item pode ter zerado o estoque ou sido desativado depois da venda,
    // mas ainda precisa aparecer pra poder ser visto/ajustado/removido).
    const disponiveis = produtos.filter((p) => {
      const jaNoCarrinho = carrinho.some((i) => i.produtoId === p.id);
      if (jaNoCarrinho) return true;
      return p.ativo && estoqueDisponivel(p) > 0;
    });
    return termo
      ? disponiveis.filter((p) => p.nome.toLowerCase().includes(termo))
      : disponiveis;
  }, [produtos, buscaProduto, carrinho, vendaEditando]);

  function ajustarQtdCarrinho(produtoId: string, delta: number) {
    const produto = produtos.find((p) => p.id === produtoId);
    setCarrinho((itens) =>
      itens
        .map((item) => {
          if (item.produtoId !== produtoId) return item;
          const novaQtd = item.quantidade + delta;
          if (produto && novaQtd > estoqueDisponivel(produto)) return item;
          return { ...item, quantidade: novaQtd };
        })
        .filter((item) => item.quantidade > 0)
    );
  }

  function alternarRevendedor(novoValor: boolean) {
    setRevendedor(novoValor);
    setCarrinho((itens) =>
      itens.map((item) => {
        const produto = produtos.find((p) => p.id === item.produtoId);
        if (!produto) return item;
        return { ...item, precoUnitario: novoValor ? produto.custo : produto.preco };
      })
    );
  }

  function abrirNovaVenda() {
    setVendaEditando(null);
    setCarrinho([]);
    setClienteSelecionado("");
    setBuscaCliente("");
    setClienteAvulso("");
    setFormaPagamento("Pix");
    setDividirPagamento(false);
    setFormaPagamento2("Dinheiro");
    setValorPagamento1("");
    setValorPagamento2("");
    setLembreteCobranca("");
    setEtapaVenda("produtos");
    setRevendedor(false);
    setCadastrandoCliente(false);
    setNovoClienteNome("");
    setNovoClienteTelefone("");
    setSheetAberto(true);
  }

  function abrirEdicaoVenda(v: Venda) {
    setVendaEditando(v);
    setCarrinho(v.itens.map((i) => ({ ...i })));
    setClienteSelecionado(v.clienteId ?? "");
    setBuscaCliente("");
    setClienteAvulso(v.clienteId ? "" : v.clienteNome);
    if (v.pagamentos && v.pagamentos.length === 2) {
      setDividirPagamento(true);
      setFormaPagamento(v.pagamentos[0].forma);
      setFormaPagamento2(v.pagamentos[1].forma);
      setValorPagamento1(v.pagamentos[0].valor);
      setValorPagamento2(v.pagamentos[1].valor);
    } else {
      setDividirPagamento(false);
      setFormaPagamento(v.formaPagamento);
      setFormaPagamento2("Dinheiro");
      setValorPagamento1("");
      setValorPagamento2("");
    }
    setLembreteCobranca(v.lembreteCobranca ?? "");
    setEtapaVenda("produtos");
    setRevendedor(v.tipoVenda === "revendedor");
    setCadastrandoCliente(false);
    setNovoClienteNome("");
    setNovoClienteTelefone("");
    setSheetAberto(true);
  }

  function fecharSheet() {
    setSheetAberto(false);
    setVendaEditando(null);
    setCarrinho([]);
    setClienteSelecionado("");
    setBuscaCliente("");
    setClienteAvulso("");
    setDividirPagamento(false);
    setFormaPagamento2("Dinheiro");
    setValorPagamento1("");
    setValorPagamento2("");
    setLembreteCobranca("");
    setEtapaVenda("produtos");
    setRevendedor(false);
    setCadastrandoCliente(false);
    setNovoClienteNome("");
    setNovoClienteTelefone("");
  }

  const totalCarrinho = carrinho.reduce(
    (s, i) => s + i.quantidade * i.precoUnitario,
    0
  );
  const somaPagamentoDividido =
    (valorPagamento1 === "" ? 0 : valorPagamento1) + (valorPagamento2 === "" ? 0 : valorPagamento2);
  const pagamentoDivididoValido =
    !dividirPagamento || Math.abs(totalCarrinho - somaPagamentoDividido) < 0.01;
  const clienteEscolhido = clientes.find((c) => c.id === clienteSelecionado);
  const resultadosBuscaCliente = (() => {
    const termo = buscaCliente.trim().toLowerCase();
    const termoDigits = buscaCliente.replace(/\D/g, "");
    if (!termo) return [];
    return clientes
      .filter((c) => {
        const bateNome = c.nome.toLowerCase().includes(termo);
        const bateTelefone =
          termoDigits.length >= 3 && (c.telefone || "").replace(/\D/g, "").includes(termoDigits);
        return bateNome || bateTelefone;
      })
      .slice(0, 30);
  })();
  const vendasHoje = vendas.filter(
    (v) =>
      v.status === "concluida" &&
      new Date(v.data).toDateString() === new Date().toDateString()
  );
  const faturadoHoje = vendasHoje.reduce((s, v) => s + v.total, 0);
  const totalAReceber = vendas
    .filter((v) => v.status === "concluida" && v.formaPagamento === "A receber")
    .reduce((s, v) => s + v.total, 0);

  if (carregando) {
    return <div className="empty-state">Carregando vendas...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Vendas</h1>
        <p>Registre uma venda e acompanhe o histórico.</p>
      </div>

      <div className="kpi-scroll">
        <div className="kpi-card">
          <div className="label">Vendas hoje</div>
          <div className="value">{vendasHoje.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Faturado hoje</div>
          <div className="value accent">{currency(faturadoHoje)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Total de vendas</div>
          <div className="value">{vendas.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">A receber</div>
          <div className="value negative">{currency(totalAReceber)}</div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginBottom: 20 }}
        onClick={abrirNovaVenda}
      >
        + Nova venda
      </button>

      <div className="panel-card">
        <h2 className="panel-title">Histórico de vendas</h2>
        {vendas.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhuma venda registrada</div>
            <p>As vendas finalizadas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="list">
            {vendas.map((v) => (
              <div
                key={v.id}
                className="row-card"
                style={{ cursor: "pointer", justifyContent: "space-between" }}
                onClick={() => setDetalhes(v)}
              >
                <div className="row-card-body">
                  <div className="row-card-title">{v.clienteNome}</div>
                </div>
                <div className="row-card-trail">{currency(v.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detalhes && (
        <div className="sheet-overlay" onClick={() => setDetalhes(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h2>{detalhes.clienteNome}</h2>
              <button className="sheet-close" onClick={() => setDetalhes(null)}>
                ×
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0 14px" }}>
              <span
                className={"badge " + (detalhes.status === "concluida" ? "badge-ok" : "badge-low")}
              >
                {detalhes.status === "concluida" ? "Concluída" : "Cancelada"}
              </span>
              {detalhes.tipoVenda === "revendedor" && (
                <span className="badge badge-warn">Revendedor</span>
              )}
              {detalhes.formaPagamento === "A receber" && (
                <span className="badge badge-low">A receber</span>
              )}
              <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                {new Date(detalhes.data).toLocaleString("pt-BR")} · {detalhes.formaPagamento}
              </span>
            </div>

            {detalhes.formaPagamento === "A receber" && (
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 12 }}>
                {detalhes.lembreteCobranca
                  ? `Lembrete de cobrança em ${new Date(
                      detalhes.lembreteCobranca + "T00:00:00"
                    ).toLocaleDateString("pt-BR")}.`
                  : "Sem lembrete de cobrança definido — edite a venda pra adicionar uma data."}
              </p>
            )}

            {detalhes.pagamentos && detalhes.pagamentos.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {detalhes.pagamentos.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                    }}
                  >
                    <span>{p.forma}</span>
                    <span>{currency(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              {detalhes.itens.map((i) => (
                <div key={i.produtoId} className="cart-line">
                  <span>
                    {i.quantidade}x {i.nome}
                  </span>
                  <span>{currency(i.quantidade * i.precoUnitario)}</span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontWeight: 700,
                }}
              >
                <span>Total</span>
                <span className="value accent" style={{ fontSize: "1.05rem" }}>
                  {currency(detalhes.total)}
                </span>
              </div>
            </div>

            {(() => {
              const cliente = detalhes.clienteId
                ? clientes.find((c) => c.id === detalhes.clienteId)
                : null;
              if (!detalhes.clienteId) {
                return (
                  <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 12 }}>
                    Venda sem cliente associado — não é possível enviar resumo.
                  </p>
                );
              }
              if (cliente && cliente.telefone) {
                return (
                  <a
                    href={linkWhatsApp(cliente.telefone, montarMensagemPedido(detalhes))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-block"
                    style={{ marginBottom: 12, textDecoration: "none" }}
                  >
                    📱 Enviar resumo no WhatsApp
                  </a>
                );
              }
              return (
                <button
                  className="btn btn-ghost btn-block"
                  style={{ marginBottom: 12 }}
                  onClick={() => {
                    onCompletarWhatsapp(detalhes.clienteId as string);
                    setDetalhes(null);
                  }}
                >
                  Cliente sem WhatsApp — completar cadastro
                </button>
              );
            })()}

            {detalhes.status === "concluida" && detalhes.formaPagamento === "A receber" && (
              <button
                className="btn btn-primary btn-block"
                style={{ marginBottom: 8 }}
                disabled={processandoDetalheVenda}
                onClick={() => {
                  setRecebendo(detalhes);
                  setFormaRecebimento("Pix");
                  setDetalhes(null);
                }}
              >
                Marcar como recebido
              </button>
            )}

            <div className="form-actions" style={{ marginTop: 0 }}>
              <button
                className="btn btn-ghost"
                disabled={processandoDetalheVenda}
                onClick={() => {
                  abrirEdicaoVenda(detalhes);
                  setDetalhes(null);
                }}
              >
                Editar
              </button>
              {detalhes.status === "concluida" ? (
                <button
                  className="btn btn-danger"
                  disabled={processandoDetalheVenda}
                  onClick={async () => {
                    if (processandoDetalheVenda) return;
                    if (confirm("Cancelar esta venda? O estoque será devolvido.")) {
                      setProcessandoDetalheVenda(true);
                      try {
                        await cancelarVenda(detalhes.id);
                        await recarregar();
                        setDetalhes(null);
                      } finally {
                        setProcessandoDetalheVenda(false);
                      }
                    }
                  }}
                >
                  {processandoDetalheVenda ? "Cancelando..." : "Cancelar"}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={processandoDetalheVenda}
                  onClick={async () => {
                    if (processandoDetalheVenda) return;
                    setProcessandoDetalheVenda(true);
                    try {
                      await reativarVenda(detalhes.id);
                      await recarregar();
                      setDetalhes(null);
                    } finally {
                      setProcessandoDetalheVenda(false);
                    }
                  }}
                >
                  {processandoDetalheVenda ? "Reativando..." : "Reativar"}
                </button>
              )}
            </div>
            {detalhes.status === "cancelada" && (
              <button
                className="btn btn-danger btn-block"
                style={{ marginTop: 8 }}
                disabled={processandoDetalheVenda}
                onClick={async () => {
                  if (processandoDetalheVenda) return;
                  if (
                    confirm(
                      "Excluir este registro definitivamente? Essa ação não pode ser desfeita."
                    )
                  ) {
                    setProcessandoDetalheVenda(true);
                    try {
                      setVendas(await excluirVenda(detalhes.id));
                      setDetalhes(null);
                    } finally {
                      setProcessandoDetalheVenda(false);
                    }
                  }
                }}
              >
                {processandoDetalheVenda ? "Excluindo..." : "Excluir registro"}
              </button>
            )}
          </div>
        </div>
      )}

      {recebendo && (
        <div className="sheet-overlay" onClick={() => setRecebendo(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Marcar como recebido</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.86rem", marginTop: -8, marginBottom: 16 }}>
              {recebendo.clienteNome} · {currency(recebendo.total)}
            </p>
            <div className="form-row">
              <label>Como foi recebido</label>
              <select
                className="select-input"
                value={formaRecebimento}
                onChange={(e) => setFormaRecebimento(e.target.value)}
              >
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Cartão de débito</option>
                <option>Cartão de crédito</option>
              </select>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-ghost"
                disabled={confirmandoRecebimento}
                onClick={() => setRecebendo(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={confirmandoRecebimento}
                onClick={async () => {
                  if (confirmandoRecebimento) return;
                  setConfirmandoRecebimento(true);
                  try {
                    setVendas(await receberVenda(recebendo.id, formaRecebimento));
                    setRecebendo(null);
                  } finally {
                    setConfirmandoRecebimento(false);
                  }
                }}
              >
                {confirmandoRecebimento ? "Confirmando..." : "Confirmar recebimento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetAberto && (
        <div className="sheet-overlay" onClick={fecharSheet}>
          <div className="sheet sheet-full" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>{vendaEditando ? "Editar venda" : "Nova venda"}</h2>
              <button className="sheet-close" onClick={fecharSheet}>
                ×
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(
                [
                  { chave: "produtos" as const, label: "1 · Produtos" },
                  { chave: "cliente" as const, label: "2 · Cliente" },
                  { chave: "pagamento" as const, label: "3 · Pagamento" },
                ]
              ).map((etapa) => (
                <button
                  key={etapa.chave}
                  type="button"
                  onClick={() => {
                    if (etapa.chave !== "produtos" && carrinho.length === 0) return;
                    setEtapaVenda(etapa.chave);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 4px",
                    borderRadius: 999,
                    border: "1px solid " + (etapaVenda === etapa.chave ? "var(--gold)" : "var(--border)"),
                    background: etapaVenda === etapa.chave ? "var(--gold-soft)" : "transparent",
                    color: "var(--text)",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {etapa.label}
                </button>
              ))}
            </div>

            <div className="sheet-full-body">
              {etapaVenda === "produtos" && (
                <>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: revendedor ? "var(--gold-soft)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revendedor}
                      onChange={(e) => alternarRevendedor(e.target.checked)}
                    />
                    <span style={{ fontSize: "0.86rem" }}>
                      Venda para revendedor — usa o valor de custo
                    </span>
                  </label>

                  <input
                    className="search-input"
                    placeholder="Buscar produto..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  {carrinho.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 8 }}>
                      {carrinho.length} item(ns) · {currency(totalCarrinho)}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      maxHeight: 320,
                      overflowY: "auto",
                      marginBottom: 16,
                    }}
                  >
                    {produtosFiltrados.map((p) => {
                      const disponivel = estoqueDisponivel(p);
                      const precoUsar = revendedor ? p.custo : p.preco;
                      const item = carrinho.find((i) => i.produtoId === p.id);
                      const semEstoque = disponivel <= 0 && !item;

                      function adicionar() {
                        if (disponivel <= 0) return;
                        setCarrinho((itens) => {
                          const existente = itens.find((i) => i.produtoId === p.id);
                          if (existente) {
                            if (existente.quantidade >= disponivel) return itens;
                            return itens.map((i) =>
                              i.produtoId === p.id
                                ? { ...i, quantidade: i.quantidade + 1, precoUnitario: precoUsar }
                                : i
                            );
                          }
                          return [
                            ...itens,
                            { produtoId: p.id, nome: p.nome, quantidade: 1, precoUnitario: precoUsar },
                          ];
                        });
                      }

                      return (
                        <div
                          key={p.id}
                          className={"produto-linha" + (item ? " selecionada" : "")}
                          style={{
                            cursor: semEstoque ? "not-allowed" : "pointer",
                            opacity: semEstoque ? 0.4 : 1,
                          }}
                          onClick={() => {
                            if (!item) adicionar();
                          }}
                        >
                          {p.imagem ? (
                            <img src={p.imagem} className="produto-mini-thumb" alt="" />
                          ) : (
                            <div className="produto-mini-thumb-placeholder">
                              {p.nome.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="produto-linha-nome">
                            {p.nome}{" "}
                            <span style={{ fontSize: "0.74rem" }}>
                              ({disponivel} un. · {currency(precoUsar)})
                            </span>
                          </span>
                          {item ? (
                            <div
                              className="qty-control"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button onClick={() => ajustarQtdCarrinho(p.id, -1)}>−</button>
                              <span style={{ minWidth: 16, textAlign: "center" }}>
                                {item.quantidade}
                              </span>
                              <button onClick={() => ajustarQtdCarrinho(p.id, 1)}>+</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="produto-linha-add"
                              disabled={semEstoque}
                              onClick={(e) => {
                                e.stopPropagation();
                                adicionar();
                              }}
                            >
                              +
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {etapaVenda === "cliente" && (
                <>
                  <div className="form-row">
                    <label>Cliente cadastrado</label>
                    {clienteEscolhido ? (
                      <div
                        className="cart-line"
                        style={{
                          borderLeft: "2px solid var(--blue-light)",
                          paddingLeft: 10,
                        }}
                      >
                        <span>{clienteEscolhido.nome}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setClienteSelecionado("");
                            setBuscaCliente("");
                          }}
                        >
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          className="search-input"
                          placeholder="Buscar por nome ou WhatsApp..."
                          value={buscaCliente}
                          onChange={(e) => setBuscaCliente(e.target.value)}
                        />
                        {buscaCliente.trim() !== "" && (
                          <div
                            style={{
                              display: "grid",
                              gap: 4,
                              maxHeight: 240,
                              overflowY: "auto",
                              marginTop: 8,
                            }}
                          >
                            {resultadosBuscaCliente.length === 0 ? (
                              <div className="empty-state" style={{ padding: "12px 0" }}>
                                Nenhum cliente encontrado. Cadastre um novo cliente ou continue como cliente avulso.
                              </div>
                            ) : (
                              resultadosBuscaCliente.map((c) => (
                                <div
                                  key={c.id}
                                  className="cart-line"
                                  style={{ cursor: "pointer" }}
                                  onClick={() => {
                                    setClienteSelecionado(c.id);
                                    setBuscaCliente("");
                                  }}
                                >
                                  <span>{c.nome}</span>
                                  {c.telefone && (
                                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                                      {c.telefone}
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!clienteSelecionado && !cadastrandoCliente && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginBottom: 14 }}
                      onClick={() => {
                        setCadastrandoCliente(true);
                        setNovoClienteNome(buscaCliente.trim());
                        setNovoClienteTelefone("");
                      }}
                    >
                      + Cadastrar novo cliente
                    </button>
                  )}

                  {!clienteSelecionado && cadastrandoCliente && (
                    <div
                      className="form-row"
                      style={{
                        borderLeft: "2px solid var(--blue-light)",
                        paddingLeft: 10,
                        marginBottom: 14,
                      }}
                    >
                      <label>Nome do cliente</label>
                      <input
                        className="text-input"
                        value={novoClienteNome}
                        onChange={(e) => setNovoClienteNome(e.target.value)}
                        placeholder="Nome completo"
                      />
                      <label style={{ marginTop: 10 }}>WhatsApp (opcional)</label>
                      <input
                        className="text-input"
                        value={novoClienteTelefone}
                        onChange={(e) => setNovoClienteTelefone(e.target.value)}
                        placeholder="(27) 99999-9999"
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!novoClienteNome.trim() || salvandoNovoCliente}
                          onClick={salvarNovoClienteDaVenda}
                        >
                          {salvandoNovoCliente ? "Salvando..." : "Salvar e usar na venda"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setCadastrandoCliente(false);
                            setNovoClienteNome("");
                            setNovoClienteTelefone("");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {!clienteSelecionado && !cadastrandoCliente && (
                    <div className="form-row">
                      <label>Nome do cliente avulso (opcional)</label>
                      <input
                        className="text-input"
                        value={clienteAvulso}
                        onChange={(e) => setClienteAvulso(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              {etapaVenda === "pagamento" && (
                <>
                  {!dividirPagamento ? (
                    <div className="form-row">
                      <label>Forma de pagamento</label>
                      <select
                        className="select-input"
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value)}
                      >
                        <option>Pix</option>
                        <option>Dinheiro</option>
                        <option>Cartão de débito</option>
                        <option>Cartão de crédito</option>
                        <option>A receber</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12, marginBottom: 4 }}>
                      <div className="form-row">
                        <label>1ª forma de pagamento</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select
                            className="select-input"
                            style={{ flex: 1.2 }}
                            value={formaPagamento}
                            onChange={(e) => setFormaPagamento(e.target.value)}
                          >
                            <option>Pix</option>
                            <option>Dinheiro</option>
                            <option>Cartão de débito</option>
                            <option>Cartão de crédito</option>
                          </select>
                          <input
                            className="text-input"
                            style={{ flex: 1 }}
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={valorPagamento1}
                            onChange={(e) =>
                              setValorPagamento1(e.target.value === "" ? "" : Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <label>2ª forma de pagamento</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select
                            className="select-input"
                            style={{ flex: 1.2 }}
                            value={formaPagamento2}
                            onChange={(e) => setFormaPagamento2(e.target.value)}
                          >
                            <option>Pix</option>
                            <option>Dinheiro</option>
                            <option>Cartão de débito</option>
                            <option>Cartão de crédito</option>
                          </select>
                          <input
                            className="text-input"
                            style={{ flex: 1 }}
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={valorPagamento2}
                            onChange={(e) =>
                              setValorPagamento2(e.target.value === "" ? "" : Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                      {(() => {
                        const v1 = valorPagamento1 === "" ? 0 : valorPagamento1;
                        const v2 = valorPagamento2 === "" ? 0 : valorPagamento2;
                        const diferenca = totalCarrinho - (v1 + v2);
                        if (Math.abs(diferenca) < 0.01) {
                          return (
                            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                              Soma bate com o total da venda.
                            </p>
                          );
                        }
                        return (
                          <p style={{ color: "#e0665a", fontSize: "0.78rem" }}>
                            {diferenca > 0
                              ? `Falta ${currency(diferenca)} pra completar o total.`
                              : `${currency(Math.abs(diferenca))} a mais que o total da venda.`}
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: dividirPagamento ? 4 : 10, marginBottom: 14 }}
                    onClick={() => {
                      const ligando = !dividirPagamento;
                      setDividirPagamento(ligando);
                      if (ligando) {
                        setValorPagamento1(totalCarrinho);
                        setValorPagamento2(0);
                        if (formaPagamento === "A receber") setFormaPagamento("Pix");
                      }
                    }}
                  >
                    {dividirPagamento ? "Usar uma forma de pagamento só" : "+ Dividir em duas formas de pagamento"}
                  </button>

                  {!dividirPagamento && formaPagamento === "A receber" && (
                    <div className="form-row">
                      <label>Lembrete de cobrança (opcional)</label>
                      <input
                        type="date"
                        className="text-input"
                        value={lembreteCobranca}
                        onChange={(e) => setLembreteCobranca(e.target.value)}
                      />
                      <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4 }}>
                        Na data escolhida, a cobrança aparece como tarefa no Início.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sheet-full-footer">
              {carrinho.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.82rem",
                    color: "var(--muted)",
                    marginBottom: 8,
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>
                    {currency(totalCarrinho)}
                  </span>
                </div>
              )}
              <div className="form-actions">
                {etapaVenda === "produtos" ? (
                  <button className="btn btn-ghost" disabled={salvando} onClick={fecharSheet}>
                    Cancelar
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost"
                    disabled={salvando}
                    onClick={() =>
                      setEtapaVenda(etapaVenda === "pagamento" ? "cliente" : "produtos")
                    }
                  >
                    Voltar
                  </button>
                )}

                {etapaVenda !== "pagamento" ? (
                  <button
                    className="btn btn-primary"
                    disabled={carrinho.length === 0}
                    onClick={() => setEtapaVenda(etapaVenda === "produtos" ? "cliente" : "pagamento")}
                  >
                    Avançar
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={carrinho.length === 0 || salvando || !pagamentoDivididoValido}
                    onClick={async () => {
                      if (carrinho.length === 0 || !pagamentoDivididoValido) return;
                      setSalvando(true);
                      const cliente = clientes.find((c) => c.id === clienteSelecionado);
                      const pagamentos = dividirPagamento
                        ? [
                            { forma: formaPagamento, valor: valorPagamento1 === "" ? 0 : valorPagamento1 },
                            { forma: formaPagamento2, valor: valorPagamento2 === "" ? 0 : valorPagamento2 },
                          ]
                        : null;
                      const dadosVenda = {
                        clienteId: cliente ? cliente.id : null,
                        clienteNome: cliente ? cliente.nome : clienteAvulso.trim() || "Cliente avulso",
                        itens: carrinho,
                        formaPagamento: dividirPagamento
                          ? `${formaPagamento} + ${formaPagamento2}`
                          : formaPagamento,
                        pagamentos,
                        tipoVenda: revendedor ? ("revendedor" as const) : ("cliente" as const),
                        lembreteCobranca: lembreteCobranca || null,
                      };
                      if (vendaEditando) {
                        await atualizarVenda(vendaEditando.id, dadosVenda);
                      } else {
                        await registrarVenda(dadosVenda);
                      }
                      setSalvando(false);
                      fecharSheet();
                      await recarregar();
                    }}
                  >
                    {salvando
                      ? "Salvando..."
                      : vendaEditando
                      ? "Salvar alterações"
                      : "Finalizar venda"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Financeiro ---------------------------- */

function TabFinanceiro({ ativo }: { ativo: boolean }) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("Despesa operacional");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);
  const jaAtivouAntes = useRef(false);

  function buscarDados() {
    return Promise.all([getFinanceiro(), getProdutos()]).then(([f, p]) => {
      setLancamentos(f);
      setProdutos(p);
    });
  }

  useEffect(() => {
    buscarDados().finally(() => setCarregando(false));
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos, sem mostrar
  // "Carregando" de novo.
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    buscarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const resumo = useMemo(() => {
    const entradas = lancamentos.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
    const saidas = lancamentos.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [lancamentos]);

  const valorEstoque = produtos.reduce((s, p) => s + p.estoque * p.preco, 0);
  const lucroPotencial = produtos.reduce(
    (s, p) => s + p.estoque * (p.preco - p.custo),
    0
  );

  if (carregando) {
    return <div className="empty-state">Carregando financeiro...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Financeiro</h1>
        <p>Entradas e saídas do negócio.</p>
      </div>

      <div className="kpi-scroll">
        <div className="kpi-card">
          <div className="label">Entradas</div>
          <div className="value positive">{currency(resumo.entradas)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Saídas</div>
          <div className="value negative">{currency(resumo.saidas)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Saldo</div>
          <div className={"value " + (resumo.saldo >= 0 ? "positive" : "negative")}>
            {currency(resumo.saldo)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Produtos</div>
          <div className="value">{produtos.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Valor em estoque</div>
          <div className="value accent">{currency(valorEstoque)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Lucro potencial</div>
          <div className="value positive">{currency(lucroPotencial)}</div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginBottom: 20 }}
        onClick={() => setSheetAberto(true)}
      >
        + Novo lançamento
      </button>

      <div className="panel-card">
        <h2 className="panel-title">Lançamentos</h2>
        {lancamentos.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhum lançamento ainda</div>
            <p>Vendas finalizadas geram entradas automaticamente aqui. Despesas você lança manualmente.</p>
          </div>
        ) : (
          <div className="list">
            {lancamentos.map((l) => (
              <div
                key={l.id}
                className="row-card"
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div className="row-card-body">
                    <div className="row-card-title">{l.descricao}</div>
                    <div className="row-card-sub">
                      {l.categoria} · {new Date(l.data).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div
                    className="row-card-trail"
                    style={{ color: l.tipo === "entrada" ? "var(--success)" : "var(--danger)" }}
                  >
                    {l.tipo === "entrada" ? "+" : "−"}
                    {currency(l.valor)}
                  </div>
                </div>
                <div
                  className="row-card-expand"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span className={"badge " + (l.tipo === "entrada" ? "badge-ok" : "badge-low")}>
                    {l.tipo === "entrada" ? "Entrada" : "Saída"}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={removendoId === l.id}
                    onClick={async () => {
                      if (removendoId) return;
                      if (confirm("Remover este lançamento?")) {
                        setRemovendoId(l.id);
                        try {
                          setLancamentos(await removerLancamento(l.id));
                        } finally {
                          setRemovendoId(null);
                        }
                      }
                    }}
                  >
                    {removendoId === l.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sheetAberto && (
        <div className="sheet-overlay" onClick={() => setSheetAberto(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Novo lançamento</h2>
            <div className="form-grid">
              <div className="form-row">
                <label>Tipo</label>
                <select
                  className="select-input"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "entrada" | "saida")}
                >
                  <option value="saida">Saída (despesa)</option>
                  <option value="entrada">Entrada (receita manual)</option>
                </select>
              </div>
              <div className="form-row">
                <label>Categoria</label>
                <input
                  className="text-input"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex: Frete, Marketing, Fornecedor..."
                />
              </div>
              <div className="form-row">
                <label>Descrição</label>
                <input
                  className="text-input"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Valor (R$)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="text-input"
                  value={valor}
                  onChange={(e) => setValor(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-ghost"
                disabled={salvandoLancamento}
                onClick={() => setSheetAberto(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={salvandoLancamento}
                onClick={async () => {
                  if (salvandoLancamento || !descricao.trim() || valor <= 0) return;
                  setSalvandoLancamento(true);
                  try {
                    setLancamentos(await addLancamento({ tipo, categoria, descricao, valor }));
                    setSheetAberto(false);
                    setDescricao("");
                    setValor(0);
                  } finally {
                    setSalvandoLancamento(false);
                  }
                }}
              >
                {salvandoLancamento ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Perfil ---------------------------- */

const GRADUACOES = [
  "Topázio",
  "Ônix",
  "Ametista",
  "Diamante Negro",
  "Jaspe",
  "Jade",
  "Royal Black",
  "Dream Red",
  "Master Gold",
];

const CROP_BOX = 260;
const CROP_SAIDA = 480;

function TabPerfil() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [graduacao, setGraduacao] = useState("");
  const [metaPontuacao, setMetaPontuacao] = useState(0);
  const [metaVenda, setMetaVenda] = useState(0);

  // Recorte de foto
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrastoRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    getPerfil()
      .then((p) => {
        setPerfil(p);
        if (p) {
          setNome(p.nome);
          setWhatsapp(p.whatsapp);
          setEmail(p.email);
          setCpf(p.cpf);
          setFoto(p.foto);
          setGraduacao(p.graduacao);
          setMetaPontuacao(p.metaPontuacao);
          setMetaVenda(p.metaVenda);
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  const baseScale =
    imgNatural.w > 0 && imgNatural.h > 0
      ? Math.max(CROP_BOX / imgNatural.w, CROP_BOX / imgNatural.h)
      : 0;

  function clampPos(p: { x: number; y: number }, z: number) {
    const scale = baseScale * z;
    const dw = imgNatural.w * scale;
    const dh = imgNatural.h * scale;
    const maxX = Math.max(0, (dw - CROP_BOX) / 2);
    const maxY = Math.max(0, (dh - CROP_BOX) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    };
  }

  function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro("");
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setImgNatural({ w: 0, h: 0 });
    setPreviewUrl(URL.createObjectURL(file));
  }

  function fecharRecorte() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImgNatural({ w: 0, h: 0 });
  }

  function onPointerDownCrop(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastoRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  }

  function onPointerMoveCrop(e: React.PointerEvent) {
    if (!arrastoRef.current) return;
    const dx = e.clientX - arrastoRef.current.startX;
    const dy = e.clientY - arrastoRef.current.startY;
    setPos(
      clampPos(
        { x: arrastoRef.current.origX + dx, y: arrastoRef.current.origY + dy },
        zoom
      )
    );
  }

  function onPointerUpCrop() {
    arrastoRef.current = null;
  }

  async function confirmarRecorte() {
    if (!previewUrl || imgNatural.w === 0) return;
    setEnviandoFoto(true);
    setErro("");
    try {
      const img = new window.Image();
      img.src = previewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const scale = baseScale * zoom;
      const dw = imgNatural.w * scale;
      const dh = imgNatural.h * scale;
      const topLeftX = CROP_BOX / 2 + pos.x - dw / 2;
      const topLeftY = CROP_BOX / 2 + pos.y - dh / 2;
      const ratio = CROP_SAIDA / CROP_BOX;

      const canvas = document.createElement("canvas");
      canvas.width = CROP_SAIDA;
      canvas.height = CROP_SAIDA;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.drawImage(
        img,
        0,
        0,
        imgNatural.w,
        imgNatural.h,
        topLeftX * ratio,
        topLeftY * ratio,
        dw * ratio,
        dh * ratio
      );

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("Falha ao gerar imagem");

      const url = await uploadFotoPerfil(blob);
      setFoto(url);
      fecharRecorte();
    } catch {
      setErro("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function salvar() {
    setErro("");
    setSucesso(false);
    if (!nome.trim()) {
      setErro("Informe seu nome completo.");
      return;
    }
    if (whatsapp.replace(/\D/g, "").length < 10) {
      setErro("Informe um WhatsApp válido, com DDD.");
      return;
    }
    if (!validarCpf(cpf)) {
      setErro("CPF inválido. Confira os números digitados.");
      return;
    }
    setSalvando(true);
    try {
      const atualizado = await atualizarPerfil({
        nome: nome.trim(),
        whatsapp,
        email,
        cpf,
        foto,
        graduacao,
        metaPontuacao,
        metaVenda,
      });
      setPerfil(atualizado);
      setSucesso(true);
    } catch (e: any) {
      setErro(
        e?.code === "23505"
          ? "Este CPF já está cadastrado em outra conta."
          : "Não foi possível salvar. Tente novamente."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando || !perfil) {
    return <div className="empty-state">Carregando perfil...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Perfil</h1>
        <p>Seus dados, graduação e metas.</p>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div className="profile-avatar">
            {foto ? (
              <img src={foto} alt={nome} />
            ) : (
              <span>{(nome || "?").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            Trocar foto
            <input
              type="file"
              accept="image/*"
              onChange={selecionarArquivo}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      {previewUrl && (
        <div className="sheet-overlay" onClick={fecharRecorte}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Ajustar foto</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: -8, marginBottom: 14 }}>
              Arraste para posicionar e use o controle para dar zoom.
            </p>

            <div
              className="crop-box"
              onPointerDown={onPointerDownCrop}
              onPointerMove={onPointerMoveCrop}
              onPointerUp={onPointerUpCrop}
              onPointerLeave={onPointerUpCrop}
            >
              <img
                src={previewUrl}
                alt="Pré-visualização"
                draggable={false}
                onLoad={(e) => {
                  const w = e.currentTarget.naturalWidth;
                  const h = e.currentTarget.naturalHeight;
                  setImgNatural({ w, h });
                  setPos({ x: 0, y: 0 });
                }}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: imgNatural.w > 0 ? imgNatural.w * baseScale * zoom : "100%",
                  height: imgNatural.h > 0 ? imgNatural.h * baseScale * zoom : "100%",
                  transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
                  maxWidth: "none",
                }}
              />
            </div>

            <div style={{ margin: "16px 4px" }}>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => {
                  const z = Number(e.target.value);
                  setZoom(z);
                  setPos((p) => clampPos(p, z));
                }}
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={fecharRecorte} disabled={enviandoFoto}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmarRecorte}
                disabled={enviandoFoto || imgNatural.w === 0}
              >
                {enviandoFoto ? "Enviando..." : "Usar esta foto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {erro && <div className="login-error" style={{ marginBottom: 12 }}>{erro}</div>}
      {sucesso && (
        <div style={{ color: "var(--success)", fontSize: "0.85rem", marginBottom: 12 }}>
          Perfil salvo com sucesso.
        </div>
      )}

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h2 className="panel-title">Dados cadastrais</h2>
        <div className="form-grid">
          <div className="form-row">
            <label>Nome completo</label>
            <input
              className="text-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>WhatsApp</label>
            <input
              className="text-input"
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input
              className="text-input"
              type="email"
              value={email}
              disabled
              readOnly
              style={{ opacity: 0.7, cursor: "not-allowed" }}
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Confirmado automaticamente pela sua conta Google.
            </span>
          </div>
          <div className="form-row">
            <label>CPF</label>
            <input
              className="text-input"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <h2 className="panel-title">Graduação e metas</h2>
        <div className="form-grid">
          <div className="form-row">
            <label>Graduação atual</label>
            <select
              className="select-input"
              value={graduacao}
              onChange={(e) => setGraduacao(e.target.value)}
            >
              <option value="">Selecionar...</option>
              {GRADUACOES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Meta de venda (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className="text-input"
              value={metaVenda}
              onChange={(e) => setMetaVenda(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        disabled={salvando}
        onClick={salvar}
      >
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>
    </div>
  );
}

function TabCatalogo() {
  const [config, setConfig] = useState<CatalogoConfig | null>(null);
  const [whatsappCadastrado, setWhatsappCadastrado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [slug, setSlug] = useState("");
  const [titulo, setTitulo] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [statusSlug, setStatusSlug] = useState<
    "idle" | "checando" | "livre" | "ocupado" | "invalido"
  >("idle");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    Promise.all([getCatalogoConfig(), getPerfil()])
      .then(([c, p]) => {
        setConfig(c);
        setWhatsappCadastrado(Boolean(p?.whatsapp));
        if (c) {
          setSlug(c.slug);
          setTitulo(c.titulo);
          setCategorias(c.categoriasSelecionadas);
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const valor = slug.trim().toLowerCase();
    if (!valor) {
      setStatusSlug("idle");
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(valor) || valor.length < 3 || valor.length > 40) {
      setStatusSlug("invalido");
      return;
    }
    setStatusSlug("checando");
    const timer = setTimeout(async () => {
      try {
        const livre = await verificarSlugDisponivel(valor, config?.slug);
        setStatusSlug(livre ? "livre" : "ocupado");
      } catch {
        setStatusSlug("idle");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, config?.slug]);

  function alternarCategoria(valor: string) {
    setCategorias((atual) =>
      atual.includes(valor) ? atual.filter((c) => c !== valor) : [...atual, valor]
    );
  }

  // Salvar sempre publica (ativo: true) — é a única ação de escrita do
  // formulário. Pausar é uma ação separada e explícita, abaixo do link.
  async function salvar() {
    setErro("");
    setSucesso(false);
    const slugFinal = slug.trim().toLowerCase();

    if (!slugFinal || statusSlug === "invalido") {
      setErro("Escolha um link válido: letras minúsculas, números e hífen.");
      return;
    }
    if (statusSlug === "ocupado") {
      setErro("Esse link já está em uso. Escolha outro.");
      return;
    }
    if (categorias.length === 0) {
      setErro("Selecione ao menos uma categoria de produtos.");
      return;
    }
    if (!whatsappCadastrado) {
      setErro("Preencha seu WhatsApp em Perfil antes de publicar o catálogo.");
      return;
    }

    setSalvando(true);
    try {
      const salvo = await salvarCatalogoConfig({
        slug: slugFinal,
        titulo: titulo.trim(),
        categoriasSelecionadas: categorias,
        ativo: true,
      });
      setConfig(salvo);
      setSlug(salvo.slug);
      setSucesso(true);
    } catch (e: any) {
      setErro(
        e?.code === "23505"
          ? "Esse link já está em uso. Escolha outro."
          : "Não foi possível salvar. Tente novamente."
      );
    } finally {
      setSalvando(false);
    }
  }

  // Pausar/reativar agem sobre o que já está salvo, não sobre edições
  // ainda não confirmadas no formulário acima.
  async function alternarAtivo(novoAtivo: boolean) {
    if (!config) return;
    setErro("");
    setSalvando(true);
    try {
      const salvo = await salvarCatalogoConfig({
        slug: config.slug,
        titulo: config.titulo,
        categoriasSelecionadas: config.categoriasSelecionadas,
        ativo: novoAtivo,
      });
      setConfig(salvo);
    } catch {
      setErro("Não foi possível atualizar o catálogo. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function copiarLink() {
    if (!config?.slug) return;
    const link = `${window.location.origin}/catalogo/${config.slug}`;
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (carregando) {
    return <div className="empty-state">Carregando catálogo...</div>;
  }

  const rotuloBotaoPrincipal = salvando
    ? "Salvando..."
    : config
    ? "Salvar alterações"
    : "Publicar catálogo";

  return (
    <div>
      <div className="page-header">
        <h1>Catálogo</h1>
        <p>Um link com os produtos que você escolher, pra compartilhar no WhatsApp sem PDF.</p>
      </div>

      {config?.slug && (
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              Seu link
            </h2>
            <span className={"badge " + (config.ativo ? "badge-ok" : "badge-warn")}>
              {config.ativo ? "Ativo" : "Pausado"}
            </span>
          </div>
          <div className="row-card-actions" style={{ gap: 8 }}>
            <input
              className="text-input"
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/catalogo/${config.slug}`}
              readOnly
              style={{ flex: 1 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={copiarLink}>
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
          {config.ativo ? (
            <button
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
              disabled={salvando}
              onClick={() => alternarAtivo(false)}
            >
              Pausar catálogo
            </button>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 10 }}>
              Pausado: ninguém consegue acessar esse link agora. Toque em "{rotuloBotaoPrincipal}"
              abaixo, ou{" "}
              <button
                className="sheet-whatsapp-link"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: "inherit",
                }}
                disabled={salvando}
                onClick={() => alternarAtivo(true)}
              >
                reative sem alterar nada
              </button>
              .
            </p>
          )}
        </div>
      )}

      <div className="panel-card">
        <h2 className="panel-title">{config ? "Editar catálogo" : "Criar catálogo"}</h2>

        {!whatsappCadastrado && (
          <div className="login-error" style={{ marginBottom: 12 }}>
            Preencha seu WhatsApp em Perfil antes de publicar o catálogo.
          </div>
        )}

        <div className="form-row">
          <label>Link do catálogo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--muted)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
              /catalogo/
            </span>
            <input
              className="text-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="seu-nome"
            />
          </div>
          {statusSlug === "checando" && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Checando disponibilidade...
            </span>
          )}
          {statusSlug === "livre" && (
            <span style={{ fontSize: 12, color: "var(--success)" }}>Link disponível.</span>
          )}
          {statusSlug === "ocupado" && (
            <span style={{ fontSize: 12, color: "var(--danger)" }}>Esse link já está em uso.</span>
          )}
          {statusSlug === "invalido" && (
            <span style={{ fontSize: 12, color: "var(--danger)" }}>
              Use só letras minúsculas, números e hífen, entre 3 e 40 caracteres.
            </span>
          )}
        </div>

        <div className="form-row">
          <label>Título (opcional)</label>
          <input
            className="text-input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Catálogo de Perfumes"
          />
        </div>

        <div className="form-row">
          <label>Categorias exibidas</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {CATEGORIAS_CATALOGO.map((c) => (
              <label
                key={c.valor}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.86rem" }}
              >
                <input
                  type="checkbox"
                  checked={categorias.includes(c.valor)}
                  onChange={() => alternarCategoria(c.valor)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {erro && (
          <div className="login-error" style={{ marginBottom: 12 }}>
            {erro}
          </div>
        )}
        {sucesso && (
          <div style={{ color: "var(--success)", fontSize: "0.85rem", marginBottom: 12 }}>
            Catálogo salvo com sucesso.
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={salvando} onClick={salvar}>
          {rotuloBotaoPrincipal}
        </button>
      </div>
    </div>
  );
}

const LABEL_CATEGORIA_MATERIAL: Record<MaterialApoio["categoria"], string> = {
  catalogo_mes: "Catálogo do mês",
  apresentacao_negocio: "Apresentação de negócio",
  imagens_linha: "Imagens da linha",
  outros: "Outros materiais",
};

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function TabMateriais({ ativo }: { ativo: boolean }) {
  const [materiais, setMateriais] = useState<MaterialApoio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const jaAtivouAntes = useRef(false);

  useEffect(() => {
    getMateriaisApoio()
      .then(setMateriais)
      .finally(() => setCarregando(false));
  }, []);

  // Ao voltar pra essa aba, revalida por baixo dos panos, sem mostrar
  // "Carregando" de novo.
  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    getMateriaisApoio().then(setMateriais);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<MaterialApoio["categoria"], MaterialApoio[]>();
    for (const m of materiais) {
      const lista = mapa.get(m.categoria) ?? [];
      lista.push(m);
      mapa.set(m.categoria, lista);
    }
    return mapa;
  }, [materiais]);

  if (carregando) {
    return <div className="empty-state">Carregando materiais...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Materiais de apoio</h1>
        <p>Catálogo oficial, apresentação do negócio e imagens da linha, prontos pra baixar.</p>
      </div>

      {materiais.length === 0 && (
        <div className="empty-state">
          <div className="title">Nenhum material ainda</div>
          Assim que tiver algo novo, aparece aqui.
        </div>
      )}

      {Array.from(porCategoria.entries()).map(([categoria, itens]) => (
        <div key={categoria} style={{ marginBottom: 22 }}>
          <h2 className="panel-title">{LABEL_CATEGORIA_MATERIAL[categoria]}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {itens.map((m) => (
              <div key={m.id} className="row-card">
                <div className="row-card-media-placeholder">
                  {m.tipoArquivo.toUpperCase()}
                </div>
                <div className="row-card-body">
                  <div className="row-card-title">{m.titulo}</div>
                  <div className="row-card-sub">
                    {formatarTamanho(m.tamanhoBytes)}
                    {m.descricao ? ` • ${m.descricao}` : ""}
                  </div>
                </div>
                <a
                  className="btn btn-ghost btn-sm"
                  href={m.arquivoUrl}
                  download={m.arquivoNome}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Baixar
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TabTemplates() {
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoTarefa>("novo_cadastro");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    setTexto(
      templates[tipoSelecionado] ??
        mensagemPadraoPorTipo(tipoSelecionado, "{nome}", "{produto}")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoSelecionado, templates]);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarTemplate(tipoSelecionado, texto);
      setTemplates((t) => ({ ...t, [tipoSelecionado]: texto }));
    } finally {
      setSalvando(false);
    }
  }

  async function restaurar() {
    setSalvando(true);
    try {
      await restaurarTemplatePadrao(tipoSelecionado);
      setTemplates((t) => {
        const novo = { ...t };
        delete novo[tipoSelecionado];
        return novo;
      });
      setTexto(mensagemPadraoPorTipo(tipoSelecionado, "{nome}", "{produto}"));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div className="empty-state">Carregando templates...</div>;
  }

  const customizado = Boolean(templates[tipoSelecionado]);

  return (
    <div>
      <div className="page-header">
        <h1>Templates</h1>
        <p>Mensagens editáveis do app: tarefas automáticas, e no futuro, respostas rápidas.</p>
      </div>

      <div className="panel-card">
        <h2 className="panel-title">Mensagens de tarefa</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 12 }}>
          Personalize o texto sugerido de cada tipo de tarefa. Use {"{nome}"},{" "}
          {"{produto}"} e {"{valor}"} que o sistema substitui automaticamente ao enviar.
        </p>
        <div className="form-row">
          <label>Tipo de mensagem</label>
          <select
            className="select-input"
            value={tipoSelecionado}
            onChange={(e) => setTipoSelecionado(e.target.value as TipoTarefa)}
          >
            {TIPOS_TAREFA_MENSAGEM.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.label}
                {templates[t.tipo] ? " • personalizado" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Mensagem</label>
          <textarea
            className="textarea-input"
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="row-card-actions">
          <button className="btn btn-primary" disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          {customizado && (
            <button className="btn btn-ghost" disabled={salvando} onClick={restaurar}>
              Restaurar padrão
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type SugestaoAudio = {
  id: string;
  titulo: string;
  texto: string;
};

const SUGESTOES_AUDIO: SugestaoAudio[] = [
  {
    id: "convite",
    titulo: "Convite geral",
    texto:
      "Oi, tudo bem? Gravei esse áudio rapidinho pra te contar uma novidade. Comecei a trabalhar com a Ozonteck, uma marca de perfumaria, linha capilar e bem-estar. A qualidade me surpreendeu de verdade, principalmente a perfumaria. Queria te mostrar de perto, topa marcar um horário essa semana?",
  },
  {
    id: "dia-das-maes",
    titulo: "Dia das Mães",
    texto:
      "Oi, tudo bem? O Dia das Mães está chegando e separei algumas opções lindas de perfume pra você presentear com carinho, sem gastar uma fortuna. Quer que eu te mande as sugestões?",
  },
  {
    id: "dia-dos-pais",
    titulo: "Dia dos Pais",
    texto:
      "Oi, tudo bem? Com o Dia dos Pais chegando, separei algumas fragrâncias marcantes que fazem muito sucesso como presente. Quer dar uma olhada nas opções antes que acabe o estoque?",
  },
  {
    id: "indicacao",
    titulo: "Pedido de indicação",
    texto:
      "Oi, tudo bem? Queria te pedir um favor. Você conhece alguém que possa gostar dos produtos da Ozonteck ou até se interessar em trabalhar com a gente? Se lembrar de alguém, me indica que eu cuido do resto.",
  },
];

function formatarDuracao(segundos: number | null): string {
  if (!segundos || segundos <= 0) return "";
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mimeTypeAudioSuportado(): string {
  const candidatos = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  if (typeof MediaRecorder === "undefined") return "";
  for (const tipo of candidatos) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return "";
}

function TabAudios({ ativo }: { ativo: boolean }) {
  const [audios, setAudios] = useState<AudioVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const jaAtivouAntes = useRef(false);

  const [painelAberto, setPainelAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravado, setTempoGravado] = useState(0);
  const [blobGravado, setBlobGravado] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tituloAudio, setTituloAudio] = useState("");
  const [erroGravacao, setErroGravacao] = useState("");
  const [salvandoAudio, setSalvandoAudio] = useState(false);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioGravacaoRef = useRef(0);

  useEffect(() => {
    getAudiosVenda()
      .then(setAudios)
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!ativo) return;
    if (!jaAtivouAntes.current) {
      jaAtivouAntes.current = true;
      return;
    }
    getAudiosVenda().then(setAudios);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // Libera microfone e limpa timer se a pessoa sair da aba com a gravação
  // ainda rolando ou o painel aberto.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function abrirPainel() {
    setPainelAberto(true);
    setErroGravacao("");
    setTituloAudio("");
    setBlobGravado(null);
    setPreviewUrl(null);
    setTempoGravado(0);
  }

  function fecharPainel() {
    if (gravando) pararGravacao();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPainelAberto(false);
    setBlobGravado(null);
    setPreviewUrl(null);
    setTituloAudio("");
    setTempoGravado(0);
  }

  async function iniciarGravacao() {
    setErroGravacao("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = mimeTypeAudioSuportado();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlobGravado(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      inicioGravacaoRef.current = Date.now();
      setTempoGravado(0);
      setGravando(true);
      timerRef.current = setInterval(() => {
        setTempoGravado(Math.floor((Date.now() - inicioGravacaoRef.current) / 1000));
      }, 250);
    } catch {
      setErroGravacao(
        "Não consegui acessar o microfone. Verifique a permissão do navegador e tente de novo."
      );
    }
  }

  function pararGravacao() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  function regravar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlobGravado(null);
    setPreviewUrl(null);
    setTempoGravado(0);
  }

  async function salvarAudio() {
    if (!blobGravado || !tituloAudio.trim() || salvandoAudio) return;
    setSalvandoAudio(true);
    try {
      const criado = await salvarAudioVenda({
        titulo: tituloAudio.trim(),
        blob: blobGravado,
        duracaoSegundos: tempoGravado || null,
      });
      setAudios((atuais) => [criado, ...atuais]);
      fecharPainel();
    } finally {
      setSalvandoAudio(false);
    }
  }

  async function excluirAudio(audio: AudioVenda) {
    setExcluindoId(audio.id);
    try {
      await removerAudioVenda(audio.id);
      setAudios((atuais) => atuais.filter((a) => a.id !== audio.id));
    } finally {
      setExcluindoId(null);
    }
  }

  async function compartilharAudio(audio: AudioVenda) {
    try {
      const resposta = await fetch(audio.arquivoUrl);
      const blob = await resposta.blob();
      const extensao = audio.arquivoUrl.split(".").pop() || "webm";
      const nomeArquivo = `${audio.titulo.replace(/[^\w\s-]/g, "").trim() || "audio"}.${extensao}`;
      const arquivo = new File([blob], nomeArquivo, { type: blob.type || "audio/webm" });

      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: audio.titulo });
      } else {
        window.open(audio.arquivoUrl, "_blank");
      }
    } catch (e: any) {
      // AbortError acontece quando a pessoa cancela a folha de compartilhamento — não é erro.
      if (e?.name !== "AbortError") {
        window.open(audio.arquivoUrl, "_blank");
      }
    }
  }

  if (carregando) {
    return <div className="empty-state">Carregando áudios...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Áudios</h1>
        <p>Grave convites e mensagens em áudio pra compartilhar direto no WhatsApp.</p>
      </div>

      {!painelAberto && (
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={abrirPainel}>
          + Gravar novo áudio
        </button>
      )}

      {painelAberto && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <h2 className="panel-title">Novo áudio</h2>

          {erroGravacao && (
            <p style={{ color: "#e0665a", fontSize: "0.82rem", marginBottom: 10 }}>{erroGravacao}</p>
          )}

          {!blobGravado && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <button
                type="button"
                className={gravando ? "btn btn-ghost" : "btn btn-primary"}
                onClick={gravando ? pararGravacao : iniciarGravacao}
              >
                {gravando ? "Parar gravação" : "Iniciar gravação"}
              </button>
              {gravando && (
                <span style={{ color: "#e0665a", fontSize: "0.85rem", fontVariantNumeric: "tabular-nums" }}>
                  ● {formatarDuracao(tempoGravado) || "0:00"}
                </span>
              )}
            </div>
          )}

          {blobGravado && previewUrl && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 8 }}>
                Ouça antes de salvar. Se não ficou bom, é só regravar.
              </p>
              <audio controls src={previewUrl} style={{ width: "100%", marginBottom: 10 }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={regravar}>
                Regravar
              </button>
            </div>
          )}

          <div className="form-row">
            <label>Título do áudio</label>
            <input
              className="text-input"
              value={tituloAudio}
              onChange={(e) => setTituloAudio(e.target.value)}
              placeholder="Ex: Convite geral, Dia das Mães..."
            />
          </div>

          <div className="row-card-actions">
            <button
              className="btn btn-primary"
              disabled={!blobGravado || !tituloAudio.trim() || salvandoAudio}
              onClick={salvarAudio}
            >
              {salvandoAudio ? "Salvando..." : "Salvar áudio"}
            </button>
            <button className="btn btn-ghost" disabled={salvandoAudio} onClick={fecharPainel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {audios.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 24 }}>
          <div className="title">Nenhum áudio gravado ainda</div>
          Grave o primeiro usando o botão acima.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {audios.map((a) => (
            <div key={a.id} className="row-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div
                style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpandidoId(expandidoId === a.id ? null : a.id)}
              >
                <div className="row-card-media-placeholder">
                  <IconAudio />
                </div>
                <div className="row-card-body">
                  <div className="row-card-title">{a.titulo}</div>
                  <div className="row-card-sub">
                    {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                    {a.duracaoSegundos ? ` • ${formatarDuracao(a.duracaoSegundos)}` : ""}
                  </div>
                </div>
              </div>

              {expandidoId === a.id && (
                <div style={{ marginTop: 10 }}>
                  <audio controls src={a.arquivoUrl} style={{ width: "100%", marginBottom: 10 }} />
                  <div className="row-card-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => compartilharAudio(a)}
                    >
                      Compartilhar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={excluindoId === a.id}
                      onClick={() => excluirAudio(a)}
                    >
                      {excluindoId === a.id ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="panel-title" style={{ marginBottom: 4 }}>
        Sugestões de roteiro
      </h2>
      <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 12 }}>
        Textos prontos pra ler enquanto grava, como um teleprompter. Toque pra abrir.
      </p>
      {SUGESTOES_AUDIO.map((s) => (
        <div key={s.id} className="panel-card" style={{ marginBottom: 10 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setExpandidoId(expandidoId === `sugestao-${s.id}` ? null : `sugestao-${s.id}`)}
          >
            <h3 className="panel-title" style={{ margin: 0 }}>
              {s.titulo}
            </h3>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
              {expandidoId === `sugestao-${s.id}` ? "Fechar" : "Ver texto"}
            </span>
          </div>
          {expandidoId === `sugestao-${s.id}` && (
            <p
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                fontSize: "0.86rem",
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              {s.texto}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

type ModeloRede = {
  id: string;
  titulo: string;
  publico: string;
  mensagem: string;
};

const MODELOS_REDE: ModeloRede[] = [
  {
    id: "novo-na-area",
    titulo: "Anúncio geral (novo na área)",
    publico: "Pra quem nunca trabalhou com perfume nem com nenhum produto da linha.",
    mensagem:
      "Oi, tudo bem? Quero te contar uma novidade: comecei a trabalhar com a Ozonteck, marca de perfumaria, linha capilar e bem-estar. Os produtos são de excelente qualidade, fiquei surpresa de verdade, principalmente com a linha de perfumes. Vamos marcar uma visita essa semana pra eu te mostrar de perto?",
  },
  {
    id: "ja-trabalha-com-perfume",
    titulo: "Já trabalha com perfumaria",
    publico: "Pra quem já vende perfume ou produtos parecidos, de outra marca.",
    mensagem:
      "Oi, tudo bem? Comecei a trabalhar com uma linha nova, a Ozonteck. Fábrica própria em Guarapari, no Espírito Santo, e a qualidade me surpreendeu de verdade, principalmente a perfumaria. Vamos marcar uma visita pra eu te mostrar os produtos?",
  },
  {
    id: "convite-multinivel",
    titulo: "Convite pra conhecer a empresa",
    publico: "Pra quem já faz multinível e entende de duplicação de rede.",
    mensagem:
      "Oi, tudo bem? Comecei um projeto novo e queria te convidar pra conhecer a empresa por trás dele, a Ozonteck. Tenho um horário livre terça ou quarta, qual funciona melhor pra você?",
  },
];

function TabRede() {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  function copiar(modelo: ModeloRede) {
    navigator.clipboard.writeText(modelo.mensagem);
    setCopiadoId(modelo.id);
    setTimeout(() => setCopiadoId(null), 2000);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Rede</h1>
        <p>
          Modelos prontos pra convidar contatos. Copie, cole no WhatsApp e adicione o nome da
          pessoa no início, se quiser (o WhatsApp não troca isso sozinho).
        </p>
      </div>

      {MODELOS_REDE.map((modelo) => (
        <div key={modelo.id} className="panel-card" style={{ marginBottom: 14 }}>
          <h2 className="panel-title">{modelo.titulo}</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 10 }}>
            {modelo.publico}
          </p>
          <p
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              fontSize: "0.86rem",
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            {modelo.mensagem}
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => copiar(modelo)}>
            {copiadoId === modelo.id ? "Copiado!" : "Copiar mensagem"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- Cadastro (onboarding) ---------------------------- */

function TelaCadastro({
  perfil,
  onCompleto,
  onSair,
}: {
  perfil: Perfil;
  onCompleto: (p: Perfil) => void;
  onSair: () => void;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [whatsapp, setWhatsapp] = useState(perfil.whatsapp);
  const [email, setEmail] = useState(perfil.email);
  const [cpf, setCpf] = useState(perfil.cpf);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro("");
    if (!nome.trim()) {
      setErro("Informe seu nome completo.");
      return;
    }
    if (whatsapp.replace(/\D/g, "").length < 10) {
      setErro("Informe um WhatsApp válido, com DDD.");
      return;
    }
    if (!validarCpf(cpf)) {
      setErro("CPF inválido. Confira os números digitados.");
      return;
    }
    setEnviando(true);
    try {
      const atualizado = await completarCadastro({
        nome: nome.trim(),
        whatsapp,
        email,
        cpf,
      });
      onCompleto(atualizado);
    } catch (e: any) {
      setErro(
        e?.code === "23505"
          ? "Este CPF já está cadastrado em outra conta."
          : "Não foi possível salvar. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: "left" }}>
        <img
          src={LOGO_URL}
          alt="Avance Vendas"
          className="login-logo"
          style={{ display: "block", margin: "0 auto 12px" }}
        />
        <div className="login-brand" style={{ textAlign: "center" }}>
          Avance Vendas
          <span>Complete seu cadastro</span>
        </div>
        <p className="login-subtitle" style={{ textAlign: "center" }}>
          Antes de continuar, precisamos de mais alguns dados.
        </p>

        {erro && <div className="login-error">{erro}</div>}

        <div className="form-grid">
          <div className="form-row">
            <label>Nome completo</label>
            <input
              className="text-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>WhatsApp</label>
            <input
              className="text-input"
              placeholder="(00) 00000-0000"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input
              className="text-input"
              type="email"
              value={email}
              disabled
              readOnly
              style={{ opacity: 0.7, cursor: "not-allowed" }}
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Confirmado automaticamente pela sua conta Google.
            </span>
          </div>
          <div className="form-row">
            <label>CPF</label>
            <input
              className="text-input"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          disabled={enviando}
          onClick={confirmar}
        >
          {enviando ? "Salvando..." : "Concluir cadastro"}
        </button>
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
          onClick={onSair}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Shell ---------------------------- */

const TABS_BARRA = [
  { id: "inicio", label: "Início", Icon: IconInicio },
  { id: "estoque", label: "Estoque", Icon: IconEstoque },
  { id: "clientes", label: "Clientes", Icon: IconClientes },
  { id: "vendas", label: "Vendas", Icon: IconVendas },
] as const;

const TABS_MENU = [
  { id: "financeiro", label: "Financeiro", Icon: IconFinanceiro },
  { id: "campanha", label: "Campanha", Icon: IconCampanha },
  { id: "catalogo", label: "Catálogo", Icon: IconCatalogo },
  { id: "materiais", label: "Materiais", Icon: IconMateriais },
  { id: "templates", label: "Templates", Icon: IconTemplates },
  { id: "audios", label: "Áudios", Icon: IconAudio },
  { id: "rede", label: "Rede", Icon: IconRede },
  { id: "perfil", label: "Perfil", Icon: IconPerfil },
] as const;

const TABS = [...TABS_BARRA, ...TABS_MENU] as const;

function PainelShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function abaValida(valor: string | null): (typeof TABS)[number]["id"] {
    return TABS.some((t) => t.id === valor) ? (valor as (typeof TABS)[number]["id"]) : "inicio";
  }

  const [aba, setAbaEstado] = useState<(typeof TABS)[number]["id"]>(() =>
    abaValida(searchParams.get("aba"))
  );
  // Abas já visitadas continuam montadas (só ficam escondidas), pra trocar
  // de aba não precisar buscar tudo de novo no servidor toda vez.
  const [abasVisitadas, setAbasVisitadas] = useState<Set<(typeof TABS)[number]["id"]>>(
    () => new Set([abaValida(searchParams.get("aba"))])
  );
  const [vendaClienteId, setVendaClienteId] = useState<string | null>(null);
  const [vendaProdutoId, setVendaProdutoId] = useState<string | null>(null);
  const [clienteEditarId, setClienteEditarId] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const atual = TABS.find((t) => t.id === aba)!;

  function marcarVisitada(id: (typeof TABS)[number]["id"]) {
    setAbasVisitadas((atualSet) => (atualSet.has(id) ? atualSet : new Set(atualSet).add(id)));
  }

  // Mantem a aba sincronizada com a URL (?aba=...): trocar de aba empilha uma
  // entrada no historico do navegador, e o botao voltar troca de aba em vez
  // de sair do app inteiro (que era o problema antes).
  function irParaAba(novaAba: (typeof TABS)[number]["id"]) {
    setAbaEstado(novaAba);
    marcarVisitada(novaAba);
    router.push(`/painel?aba=${novaAba}`, { scroll: false });
  }

  useEffect(() => {
    const paramAba = abaValida(searchParams.get("aba"));
    setAbaEstado((atualAba) => (atualAba === paramAba ? atualAba : paramAba));
    marcarVisitada(paramAba);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  useEffect(() => {
    getPerfil()
      .then(setPerfil)
      .finally(() => setCarregandoPerfil(false));
  }, []);

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (carregandoPerfil) {
    return (
      <div className="app-shell">
        <div className="empty-state" style={{ margin: "auto" }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (perfil && !perfil.cadastroCompleto) {
    return <TelaCadastro perfil={perfil} onCompleto={setPerfil} onSair={sair} />;
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-inner">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMenuAberto(true)}
            title="Menu"
            aria-label="Abrir menu"
            style={{
              width: 38,
              height: 38,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconMenu className="icon-sm" />
          </button>
          <img src={LOGO_URL} alt="Avance Vendas" className="top-bar-logo" />
          <div className="brand">
            Avance Vendas
            <span>{atual.label}</span>
          </div>
        </div>
      </header>
      <main className="main">
        {abasVisitadas.has("inicio") && (
          <div style={{ display: aba === "inicio" ? "block" : "none" }}>
            <TabInicio
              ativo={aba === "inicio"}
              onCompletarCadastro={(clienteId) => {
                setClienteEditarId(clienteId);
                irParaAba("clientes");
              }}
            />
          </div>
        )}
        {abasVisitadas.has("estoque") && (
          <div style={{ display: aba === "estoque" ? "block" : "none" }}>
            <TabEstoque
              ativo={aba === "estoque"}
              onVenderProduto={(produtoId) => {
                setVendaProdutoId(produtoId);
                irParaAba("vendas");
              }}
            />
          </div>
        )}
        {abasVisitadas.has("clientes") && (
          <div style={{ display: aba === "clientes" ? "block" : "none" }}>
            <TabClientes
              ativo={aba === "clientes"}
              onNovaVenda={(clienteId) => {
                setVendaClienteId(clienteId);
                irParaAba("vendas");
              }}
              clienteParaEditar={clienteEditarId}
              aoConsumirClienteParaEditar={() => setClienteEditarId(null)}
            />
          </div>
        )}
        {abasVisitadas.has("vendas") && (
          <div style={{ display: aba === "vendas" ? "block" : "none" }}>
            <TabVendas
              ativo={aba === "vendas"}
              clientePreSelecionado={vendaClienteId}
              aoConsumirPreSelecao={() => setVendaClienteId(null)}
              produtoPreSelecionado={vendaProdutoId}
              aoConsumirProdutoPreSelecao={() => setVendaProdutoId(null)}
              onCompletarWhatsapp={(clienteId) => {
                setClienteEditarId(clienteId);
                irParaAba("clientes");
              }}
            />
          </div>
        )}
        {abasVisitadas.has("financeiro") && (
          <div style={{ display: aba === "financeiro" ? "block" : "none" }}>
            <TabFinanceiro ativo={aba === "financeiro"} />
          </div>
        )}
        {abasVisitadas.has("campanha") && (
          <div style={{ display: aba === "campanha" ? "block" : "none" }}>
            <TabCampanha ativo={aba === "campanha"} />
          </div>
        )}
        {abasVisitadas.has("catalogo") && (
          <div style={{ display: aba === "catalogo" ? "block" : "none" }}>
            <TabCatalogo />
          </div>
        )}
        {abasVisitadas.has("materiais") && (
          <div style={{ display: aba === "materiais" ? "block" : "none" }}>
            <TabMateriais ativo={aba === "materiais"} />
          </div>
        )}
        {abasVisitadas.has("templates") && (
          <div style={{ display: aba === "templates" ? "block" : "none" }}>
            <TabTemplates />
          </div>
        )}
        {abasVisitadas.has("audios") && (
          <div style={{ display: aba === "audios" ? "block" : "none" }}>
            <TabAudios ativo={aba === "audios"} />
          </div>
        )}
        {abasVisitadas.has("rede") && (
          <div style={{ display: aba === "rede" ? "block" : "none" }}>
            <TabRede />
          </div>
        )}
        {abasVisitadas.has("perfil") && (
          <div style={{ display: aba === "perfil" ? "block" : "none" }}>
            <TabPerfil />
          </div>
        )}
      </main>
      <nav className="bottom-nav">
        {TABS_BARRA.map((t) => (
          <button
            key={t.id}
            className={"bottom-nav-item " + (aba === t.id ? "active" : "")}
            onClick={() => irParaAba(t.id)}
          >
            <t.Icon className="icon" />
            {t.label}
          </button>
        ))}
      </nav>

      {menuAberto && (
        <div className="side-menu-overlay" onClick={() => setMenuAberto(false)}>
          <div className="side-menu" onClick={(e) => e.stopPropagation()}>
            <div className="side-menu-header">
              <img src={LOGO_URL} alt="Avance Vendas" className="login-logo" style={{ width: 40, height: 40 }} />
              <div className="brand" style={{ marginBottom: 0 }}>
                Avance Vendas
              </div>
              <button
                className="sheet-close"
                onClick={() => setMenuAberto(false)}
                aria-label="Fechar menu"
              >
                ×
              </button>
            </div>
            <div className="side-menu-items">
              {TABS_MENU.map((t) => (
                <button
                  key={t.id}
                  className={"side-menu-item " + (aba === t.id ? "active" : "")}
                  onClick={() => {
                    irParaAba(t.id);
                    setMenuAberto(false);
                  }}
                >
                  <t.Icon className="icon" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="side-menu-footer">
              <button className="side-menu-item" onClick={sair}>
                <IconSair className="icon" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PainelPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <div className="empty-state" style={{ margin: "auto" }}>
            Carregando...
          </div>
        </div>
      }
    >
      <PainelShell />
    </Suspense>
  );
}
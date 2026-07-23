"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/store";
import { extrairItensNotaFiscal, casarComCatalogo, type ItemNotaFiscal } from "@/lib/nota-fiscal";

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
    ? `Olá, ${venda.clienteNome}! 👋`
    : "Olá! 👋";
  return (
    `${saudacao}\n\nAqui está o resumo do seu pedido:\n\n${itens}\n\n` +
    `Total: ${currency(venda.total)}\n\nObrigado pela preferência! 💙`
  );
}

function mensagemAniversario(nome: string): string {
  return `Oi ${nome}! 🎉 Passando aqui pra desejar um feliz aniversário! Que seu dia seja ótimo. Qualquer coisa que precisar, é só chamar! 💛`;
}

function mensagemRenovarPedido(nome: string, ultimoProduto?: string): string {
  const referencia = ultimoProduto
    ? `Vi que você levou ${ultimoProduto} — já deu tempo de acabar?`
    : "Já deu tempo de acabar algum produto?";
  return `Oi ${nome}, tudo bem? Faz um tempinho desde seu último pedido. ${referencia} Posso te ajudar a repor quando quiser! 😊`;
}

function mensagemPosVenda(nome: string): string {
  return `Oi ${nome}! Já faz alguns dias da sua última compra — queria saber como está sendo sua experiência com os produtos! Ficou alguma dúvida ou posso ajudar em algo? 💬`;
}

type TipoTarefa = "aniversario" | "renovar" | "pos_venda";

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

/* ---------------------------- Início (Dashboard) ---------------------------- */

function TabInicio() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mensagensEditadas, setMensagensEditadas] = useState<Record<string, string>>({});
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([getProdutos(), getClientes(), getVendas()])
      .then(([p, c, v]) => {
        setProdutos(p);
        setClientes(c);
        setVendas(v);
      })
      .finally(() => setCarregando(false));
  }, []);

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

  // Última venda concluída por cliente, pra citar o produto na mensagem de renovação.
  const ultimaVendaPorCliente = new Map<string, Venda>();
  for (const v of vendasConcluidas) {
    if (!v.clienteId) continue;
    const atual = ultimaVendaPorCliente.get(v.clienteId);
    if (!atual || new Date(v.data) > new Date(atual.data)) {
      ultimaVendaPorCliente.set(v.clienteId, v);
    }
  }

  const diaHoje = agora.getDate();
  const mesHoje = agora.getMonth() + 1;

  const tarefasAniversario: Tarefa[] = clientes
    .filter(
      (c) => c.telefone && c.aniversarioDia === diaHoje && c.aniversarioMes === mesHoje
    )
    .map((c) => ({
      id: `aniversario-${c.id}`,
      tipo: "aniversario" as const,
      clienteId: c.id,
      clienteNome: c.nome,
      telefone: c.telefone,
      dataReferencia: "Hoje",
      mensagemPadrao: mensagemAniversario(c.nome),
    }));

  const tarefasRenovar: Tarefa[] = clientes
    .filter(
      (c) => c.telefone && c.proximoFollowup && new Date(c.proximoFollowup) <= agora
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
        dataReferencia: new Date(c.proximoFollowup!).toLocaleDateString("pt-BR"),
        mensagemPadrao: mensagemRenovarPedido(c.nome, ultimoProduto),
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
        mensagemPadrao: mensagemPosVenda(cliente.nome),
        vendaId: v.id,
      };
    });

  const tarefas = [...tarefasAniversario, ...tarefasRenovar, ...tarefasPosVenda].filter(
    (t) => !dispensados.has(t.id)
  );

  async function concluirTarefa(t: Tarefa) {
    if (t.tipo === "renovar") {
      setClientes(await limparFollowupCliente(t.clienteId));
    } else if (t.tipo === "pos_venda" && t.vendaId) {
      setVendas(await marcarPosVendaContatado(t.vendaId));
    } else {
      setDispensados((prev) => new Set(prev).add(t.id));
    }
    setExpandido(null);
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

      <div className="panel-card" style={{ marginTop: 16 }}>
        <h2 className="panel-title">Tarefas de hoje</h2>
        {tarefas.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhuma tarefa por aqui 🎉</div>
            <p>
              Aniversários, renovações de pedido e follow-ups de pós-venda
              aparecem aqui quando surgirem.
            </p>
          </div>
        ) : (
          <div className="list">
            {tarefas.map((t) => {
              const aberto = expandido === t.id;
              const mensagem = mensagensEditadas[t.id] ?? t.mensagemPadrao;
              const badgeClasse =
                t.tipo === "aniversario"
                  ? "badge-warn"
                  : t.tipo === "renovar"
                  ? "badge-low"
                  : "badge-ok";
              const label =
                t.tipo === "aniversario"
                  ? "Aniversário"
                  : t.tipo === "renovar"
                  ? "Renovar pedido"
                  : "Pós-venda";
              const emoji =
                t.tipo === "aniversario" ? "🎂" : t.tipo === "renovar" ? "🔁" : "💬";

              return (
                <div
                  key={t.id}
                  className="row-card"
                  style={{ flexDirection: "column", alignItems: "stretch" }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                    onClick={() => setExpandido(aberto ? null : t.id)}
                  >
                    <div className="row-card-media-placeholder">{emoji}</div>
                    <div className="row-card-body">
                      <div className="row-card-title">{t.clienteNome}</div>
                      <div className="row-card-sub">
                        <span className={"badge " + badgeClasse}>{label}</span>{" "}
                        · {t.dataReferencia}
                      </div>
                    </div>
                  </div>

                  {aberto && (
                    <div className="row-card-expand">
                      <textarea
                        className="textarea-input"
                        rows={4}
                        value={mensagem}
                        onChange={(e) =>
                          setMensagensEditadas((m) => ({ ...m, [t.id]: e.target.value }))
                        }
                      />
                      <div className="row-card-actions">
                        <a
                          className="btn btn-primary"
                          href={linkWhatsApp(t.telefone, mensagem)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => concluirTarefa(t)}
                        >
                          📱 Enviar no WhatsApp
                        </a>
                        <button className="btn btn-ghost" onClick={() => concluirTarefa(t)}>
                          Marcar como feito
                        </button>
                      </div>
                    </div>
                  )}
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

function TabEstoque({ onVenderProduto }: { onVenderProduto: (produtoId: string) => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ranking, setRanking] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [ocultarZerados, setOcultarZerados] = useState(true);
  const [detalhes, setDetalhes] = useState<Produto | null>(null);
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [ajusteValor, setAjusteValor] = useState(0);
  const [entradaAberta, setEntradaAberta] = useState(false);
  const [buscaEntrada, setBuscaEntrada] = useState("");
  const [itensEntrada, setItensEntrada] = useState<
    { produto: Produto; quantidade: number }[]
  >([]);
  const [importandoNota, setImportandoNota] = useState(false);
  const [progressoNota, setProgressoNota] = useState<{ atual: number; total: number } | null>(
    null
  );
  const [erroImportacao, setErroImportacao] = useState("");
  const [naoEncontrados, setNaoEncontrados] = useState<ItemNotaFiscal[]>([]);

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .finally(() => setCarregando(false));
    // Ranking é só um "extra" visual — se falhar (ex: RPC indisponível),
    // não deve travar o carregamento do estoque.
    getRankingProdutos()
      .then(setRanking)
      .catch(() => {});
  }, []);

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
    if (!ajuste) return;
    const delta = ajusteValor - ajuste.estoque;
    if (delta !== 0) {
      setProdutos(await ajustarEstoque(ajuste.id, delta));
    }
    setAjuste(null);
  }

  function fecharEntrada() {
    setEntradaAberta(false);
    setBuscaEntrada("");
    setItensEntrada([]);
    setNaoEncontrados([]);
    setErroImportacao("");
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
      const itens = await extrairItensNotaFiscal(file, (atual, total) =>
        setProgressoNota({ atual, total })
      );
      if (itens.length === 0) {
        setErroImportacao(
          "Não encontrei itens nesse PDF. Confira se é uma nota fiscal da Ozonteck."
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
    if (itensEntrada.length === 0) return;
    let atualizados = produtos;
    for (const item of itensEntrada) {
      atualizados = await ajustarEstoque(item.produto.id, item.quantidade);
    }
    setProdutos(atualizados);
    fecharEntrada();
  }

  if (carregando) {
    return <div className="empty-state">Carregando produtos...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <h1>Estoque</h1>
          <button className="btn btn-primary btn-sm" onClick={() => setEntradaAberta(true)}>
            Entrada
          </button>
        </div>
        <p>Catálogo, quantidade disponível e preço.</p>
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
                  onClick={() => setDetalhes(p)}
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

            <div className="stock-detail-media">
              {detalhes.imagem ? (
                <img src={detalhes.imagem} alt={detalhes.nome} decoding="async" />
              ) : (
                <span className="stock-card-placeholder">
                  {detalhes.nome.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

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
                  margin: "0 0 16px",
                }}
              >
                {detalhes.descricaoCurta}
              </p>
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
              <button className="btn btn-ghost" onClick={() => setAjuste(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={confirmarAjuste}>
                Salvar
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
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Entrada de estoque</h2>

            <label
              className="btn btn-ghost btn-block"
              style={{
                cursor: importandoNota ? "not-allowed" : "pointer",
                opacity: importandoNota ? 0.6 : 1,
                marginBottom: importandoNota ? 8 : 12,
              }}
            >
              {importandoNota ? "Lendo nota fiscal..." : "📄 Importar nota fiscal (PDF)"}
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
            {naoEncontrados.length > 0 && (
              <div
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                  Não encontrados no catálogo — adicione manualmente:
                </div>
                {naoEncontrados.map((i, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      padding: "3px 0",
                    }}
                  >
                    <span>{i.descricao}</span>
                    <span>{i.quantidade} un.</span>
                  </div>
                ))}
              </div>
            )}

            <input
              className="search-input"
              placeholder="Digite o nome do perfume..."
              value={buscaEntrada}
              onChange={(e) => setBuscaEntrada(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div
              style={{
                display: "grid",
                gap: 6,
                maxHeight: 200,
                overflowY: "auto",
                marginBottom: 16,
              }}
            >
              {resultadosEntrada.length === 0 ? (
                <div className="empty-state" style={{ padding: "20px 0" }}>
                  Nenhum produto encontrado.
                </div>
              ) : (
                resultadosEntrada.map((p) => (
                  <div
                    key={p.id}
                    className="cart-line"
                    style={{ cursor: "pointer" }}
                    onClick={() => adicionarItemEntrada(p)}
                  >
                    <span>{p.nome}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      {p.estoque} em estoque
                    </span>
                  </div>
                ))
              )}
            </div>

            {itensEntrada.length > 0 && (
              <>
                <div className="panel-title" style={{ fontSize: "0.85rem" }}>
                  Produtos nesta entrada ({itensEntrada.length})
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

            <div className="form-actions">
              <button
                className="btn btn-ghost"
                onClick={fecharEntrada}
                disabled={importandoNota}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={itensEntrada.length === 0}
                onClick={confirmarEntrada}
              >
                Confirmar entrada (
                {itensEntrada.reduce((s, i) => s + i.quantidade, 0)} un.)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Clientes ---------------------------- */

function TabClientes({
  onNovaVenda,
  clienteParaEditar,
  aoConsumirClienteParaEditar,
}: {
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

  useEffect(() => {
    Promise.all([getClientes(), getVendas()])
      .then(([c, v]) => {
        setClientes(c);
        setVendas(v);
      })
      .finally(() => setCarregando(false));
  }, []);

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
    if (!termo) return clientes;
    return clientes.filter(
      (c) => c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo)
    );
  }, [clientes, busca]);

  function totalGasto(clienteId: string) {
    return vendas
      .filter((v) => v.clienteId === clienteId && v.status === "concluida")
      .reduce((s, v) => s + v.total, 0);
  }

  if (carregando) {
    return <div className="empty-state">Carregando clientes...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Clientes</h1>
        <p>Cadastro e histórico de relacionamento.</p>
      </div>

      <div className="kpi-scroll">
        <div className="kpi-card">
          <div className="label">Clientes</div>
          <div className="value">{clientes.length}</div>
        </div>
      </div>

      <div className="panel-card">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button
            className="btn btn-primary btn-block"
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
              })
            }
          >
            + Novo cliente
          </button>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="title">Nenhum cliente cadastrado</div>
            <p>Cadastre o primeiro cliente para começar a registrar vendas.</p>
          </div>
        ) : (
          <div className="list">
            {filtrados.map((c) => (
              <div
                key={c.id}
                className="row-card"
                style={{ cursor: "pointer" }}
                onClick={() => setDetalhes(c)}
              >
                <div className="row-card-media-placeholder">
                  {c.nome.slice(0, 1).toUpperCase() || "?"}
                </div>
                <div className="row-card-body">
                  <div className="row-card-title">{c.nome}</div>
                </div>
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
                onClick={async () => {
                  if (confirm("Remover este cliente?")) {
                    setClientes(await removeCliente(detalhes.id));
                    setDetalhes(null);
                  }
                }}
              >
                Remover
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
              <button className="btn btn-ghost" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (editando && editando.nome.trim()) {
                    setClientes(await upsertCliente(editando));
                    setEditando(null);
                  }
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Vendas ---------------------------- */

function TabVendas({
  clientePreSelecionado,
  aoConsumirPreSelecao,
  produtoPreSelecionado,
  aoConsumirProdutoPreSelecao,
  onCompletarWhatsapp,
}: {
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
  const [clienteAvulso, setClienteAvulso] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [carrinho, setCarrinho] = useState<ItemVenda[]>([]);
  const [revendedor, setRevendedor] = useState(false);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [vendaEditando, setVendaEditando] = useState<Venda | null>(null);
  const [detalhes, setDetalhes] = useState<Venda | null>(null);
  const [recebendo, setRecebendo] = useState<Venda | null>(null);
  const [formaRecebimento, setFormaRecebimento] = useState("Pix");
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    const [p, c, v] = await Promise.all([getProdutos(), getClientes(), getVendas()]);
    setProdutos(p);
    setClientes(c);
    setVendas(v);
  }

  useEffect(() => {
    recarregar().finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (clientePreSelecionado) {
      setVendaEditando(null);
      setCarrinho([]);
      setClienteSelecionado(clientePreSelecionado);
      setClienteAvulso("");
      setFormaPagamento("Pix");
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
        setClienteAvulso("");
        setFormaPagamento("Pix");
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
    const disponiveis = produtos.filter((p) => p.ativo && p.estoque > 0);
    return termo
      ? disponiveis.filter((p) => p.nome.toLowerCase().includes(termo))
      : disponiveis;
  }, [produtos, buscaProduto]);

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
    setClienteAvulso("");
    setFormaPagamento("Pix");
    setRevendedor(false);
    setSheetAberto(true);
  }

  function abrirEdicaoVenda(v: Venda) {
    setVendaEditando(v);
    setCarrinho(v.itens.map((i) => ({ ...i })));
    setClienteSelecionado(v.clienteId ?? "");
    setClienteAvulso(v.clienteId ? "" : v.clienteNome);
    setFormaPagamento(v.formaPagamento);
    setRevendedor(v.tipoVenda === "revendedor");
    setSheetAberto(true);
  }

  function fecharSheet() {
    setSheetAberto(false);
    setVendaEditando(null);
    setCarrinho([]);
    setClienteSelecionado("");
    setClienteAvulso("");
    setRevendedor(false);
  }

  const totalCarrinho = carrinho.reduce(
    (s, i) => s + i.quantidade * i.precoUnitario,
    0
  );
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
                  onClick={async () => {
                    if (confirm("Cancelar esta venda? O estoque será devolvido.")) {
                      await cancelarVenda(detalhes.id);
                      await recarregar();
                      setDetalhes(null);
                    }
                  }}
                >
                  Cancelar
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    await reativarVenda(detalhes.id);
                    await recarregar();
                    setDetalhes(null);
                  }}
                >
                  Reativar
                </button>
              )}
            </div>
            {detalhes.status === "cancelada" && (
              <button
                className="btn btn-danger btn-block"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  if (
                    confirm(
                      "Excluir este registro definitivamente? Essa ação não pode ser desfeita."
                    )
                  ) {
                    setVendas(await excluirVenda(detalhes.id));
                    setDetalhes(null);
                  }
                }}
              >
                Excluir registro
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
              <button className="btn btn-ghost" onClick={() => setRecebendo(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setVendas(await receberVenda(recebendo.id, formaRecebimento));
                  setRecebendo(null);
                }}
              >
                Confirmar recebimento
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetAberto && (
        <div className="sheet-overlay" onClick={fecharSheet}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>{vendaEditando ? "Editar venda" : "Nova venda"}</h2>

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
            <div
              style={{
                display: "grid",
                gap: 8,
                maxHeight: 200,
                overflowY: "auto",
                marginBottom: 16,
              }}
            >
              {produtosFiltrados.map((p) => {
                const disponivel = estoqueDisponivel(p);
                const precoUsar = revendedor ? p.custo : p.preco;
                return (
                  <div
                    key={p.id}
                    className="cart-line"
                    style={{
                      cursor: disponivel > 0 ? "pointer" : "not-allowed",
                      opacity: disponivel > 0 ? 1 : 0.45,
                    }}
                    onClick={() => {
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
                    }}
                  >
                    <span>
                      {p.nome}{" "}
                      <span style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
                        ({disponivel} un.)
                      </span>
                    </span>
                    <span>{currency(precoUsar)}</span>
                  </div>
                );
              })}
            </div>

            {carrinho.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {carrinho.map((item) => (
                  <div key={item.produtoId} className="cart-line">
                    <span>{item.nome}</span>
                    <div className="qty-control">
                      <button onClick={() => ajustarQtdCarrinho(item.produtoId, -1)}>−</button>
                      <span style={{ minWidth: 16, textAlign: "center" }}>{item.quantidade}</span>
                      <button onClick={() => ajustarQtdCarrinho(item.produtoId, 1)}>+</button>
                    </div>
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
                    {currency(totalCarrinho)}
                  </span>
                </div>
              </div>
            )}

            <div className="form-grid">
              <div className="form-row">
                <label>Cliente cadastrado</label>
                <select
                  className="select-input"
                  value={clienteSelecionado}
                  onChange={(e) => setClienteSelecionado(e.target.value)}
                >
                  <option value="">— Cliente avulso —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              {!clienteSelecionado && (
                <div className="form-row">
                  <label>Nome do cliente avulso (opcional)</label>
                  <input
                    className="text-input"
                    value={clienteAvulso}
                    onChange={(e) => setClienteAvulso(e.target.value)}
                  />
                </div>
              )}
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
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={fecharSheet}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={carrinho.length === 0 || salvando}
                onClick={async () => {
                  if (carrinho.length === 0) return;
                  setSalvando(true);
                  const cliente = clientes.find((c) => c.id === clienteSelecionado);
                  const dadosVenda = {
                    clienteId: cliente ? cliente.id : null,
                    clienteNome: cliente ? cliente.nome : clienteAvulso.trim() || "Cliente avulso",
                    itens: carrinho,
                    formaPagamento,
                    tipoVenda: revendedor ? ("revendedor" as const) : ("cliente" as const),
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Financeiro ---------------------------- */

function TabFinanceiro() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("Despesa operacional");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);

  useEffect(() => {
    Promise.all([getFinanceiro(), getProdutos()])
      .then(([f, p]) => {
        setLancamentos(f);
        setProdutos(p);
      })
      .finally(() => setCarregando(false));
  }, []);

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
                    onClick={async () => {
                      if (confirm("Remover este lançamento?")) {
                        setLancamentos(await removerLancamento(l.id));
                      }
                    }}
                  >
                    Remover
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
              <button className="btn btn-ghost" onClick={() => setSheetAberto(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (descricao.trim() && valor > 0) {
                    setLancamentos(await addLancamento({ tipo, categoria, descricao, valor }));
                    setSheetAberto(false);
                    setDescricao("");
                    setValor(0);
                  }
                }}
              >
                Salvar
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
            <label>Meta de pontuação</label>
            <input
              type="number"
              inputMode="decimal"
              className="text-input"
              value={metaPontuacao}
              onChange={(e) => setMetaPontuacao(Number(e.target.value))}
            />
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

const TABS = [
  { id: "inicio", label: "Início", Icon: IconInicio },
  { id: "estoque", label: "Estoque", Icon: IconEstoque },
  { id: "clientes", label: "Clientes", Icon: IconClientes },
  { id: "vendas", label: "Vendas", Icon: IconVendas },
  { id: "financeiro", label: "Financeiro", Icon: IconFinanceiro },
  { id: "perfil", label: "Perfil", Icon: IconPerfil },
] as const;

export default function PainelPage() {
  const [aba, setAba] = useState<(typeof TABS)[number]["id"]>("inicio");
  const [vendaClienteId, setVendaClienteId] = useState<string | null>(null);
  const [vendaProdutoId, setVendaProdutoId] = useState<string | null>(null);
  const [clienteEditarId, setClienteEditarId] = useState<string | null>(null);
  const router = useRouter();
  const atual = TABS.find((t) => t.id === aba)!;

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
          <img src={LOGO_URL} alt="Avance Vendas" className="top-bar-logo" />
          <div className="brand">
            Avance Vendas
            <span>{atual.label}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm top-bar-actions"
            onClick={sair}
            title="Sair"
          >
            <IconSair className="icon-sm" />
            Sair
          </button>
        </div>
      </header>
      <main className="main">
        {aba === "inicio" && <TabInicio />}
        {aba === "estoque" && (
          <TabEstoque
            onVenderProduto={(produtoId) => {
              setVendaProdutoId(produtoId);
              setAba("vendas");
            }}
          />
        )}
        {aba === "clientes" && (
          <TabClientes
            onNovaVenda={(clienteId) => {
              setVendaClienteId(clienteId);
              setAba("vendas");
            }}
            clienteParaEditar={clienteEditarId}
            aoConsumirClienteParaEditar={() => setClienteEditarId(null)}
          />
        )}
        {aba === "vendas" && (
          <TabVendas
            clientePreSelecionado={vendaClienteId}
            aoConsumirPreSelecao={() => setVendaClienteId(null)}
            produtoPreSelecionado={vendaProdutoId}
            aoConsumirProdutoPreSelecao={() => setVendaProdutoId(null)}
            onCompletarWhatsapp={(clienteId) => {
              setClienteEditarId(clienteId);
              setAba("clientes");
            }}
          />
        )}
        {aba === "financeiro" && <TabFinanceiro />}
        {aba === "perfil" && <TabPerfil />}
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"bottom-nav-item " + (aba === t.id ? "active" : "")}
            onClick={() => setAba(t.id)}
          >
            <t.Icon className="icon" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
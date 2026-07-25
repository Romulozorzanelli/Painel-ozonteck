"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getCatalogoPublico,
  CATEGORIAS_CATALOGO,
  type CatalogoPublico,
  type ProdutoCatalogoPublico,
} from "@/lib/store";

const LOGO_URL =
  "https://ghqsqqegblhseocxmwwx.supabase.co/storage/v1/object/public/brand-assets/Screenshot_20260722_100709_ChatGPT.jpg";

const LABEL_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS_CATALOGO.map((c) => [c.valor, c.label])
);

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function linkWhatsApp(telefone: string, mensagem: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(mensagem)}`;
}

// Tira o "17 ML" / "100 ML" do final do nome, pra usar como título comum
// quando os dois tamanhos do mesmo perfume viram um item só.
function nomeSemTamanho(nome: string): string {
  return nome.replace(/\s+(17|100)\s*ml\.?$/i, "").trim();
}

// Os dois tamanhos de um mesmo perfume compartilham a base do id.
function idBase(id: string): string {
  return id.replace(/-(17|100)-ml$/i, "");
}

type ItemCatalogo =
  | {
      tipo: "variante";
      chave: string;
      nome: string;
      vendasTotais: number;
      tamanhos: { tamanho: "17ml" | "100ml"; produto: ProdutoCatalogoPublico }[];
    }
  | { tipo: "simples"; chave: string; vendasTotais: number; produto: ProdutoCatalogoPublico };

function agruparPerfumaria(produtos: ProdutoCatalogoPublico[]): ItemCatalogo[] {
  const p17 = produtos.filter((p) => p.categoria === "perfumaria_17ml");
  const p100 = produtos.filter((p) => p.categoria === "perfumaria_100ml");
  const usados17 = new Set<string>();
  const itens: ItemCatalogo[] = [];

  for (const produto100 of p100) {
    const base = idBase(produto100.id);
    const par17 = p17.find((p) => idBase(p.id) === base);
    if (par17) {
      usados17.add(par17.id);
      itens.push({
        tipo: "variante",
        chave: base,
        nome: nomeSemTamanho(produto100.nome),
        vendasTotais: produto100.vendasTotais + par17.vendasTotais,
        tamanhos: [
          { tamanho: "17ml", produto: par17 },
          { tamanho: "100ml", produto: produto100 },
        ],
      });
    } else {
      itens.push({
        tipo: "simples",
        chave: produto100.id,
        vendasTotais: produto100.vendasTotais,
        produto: produto100,
      });
    }
  }

  for (const produto17 of p17) {
    if (!usados17.has(produto17.id)) {
      itens.push({
        tipo: "simples",
        chave: produto17.id,
        vendasTotais: produto17.vendasTotais,
        produto: produto17,
      });
    }
  }

  return itens;
}

function nomeItem(item: ItemCatalogo): string {
  return item.tipo === "variante" ? item.nome : item.produto.nome;
}

// Ranking de força de mercado (pesquisa externa sobre a referência de cada
// perfume: vendas globais, listas de mais vendidos e prêmios de leitores).
// Usado só como critério de ordenação por baixo dos panos, nunca aparece
// pro cliente. Quanto menor o número, mais forte a referência.
// Chave = id sem o sufixo de tamanho (mesma lógica de idBase).
const RANKING_MERCADO_PERFUMARIA: Record<string, number> = {
  // Feminino
  "madame-vi": 1,
  cinderela: 2,
  "vida-bella": 3,
  angelical: 4,
  "alem-17-ml": 5,
  "seduction-17-ml": 6,
  "blue-sky-17-ml": 7,
  grecia: 8,
  "famma-17-ml": 9,
  scandaloza: 10,
  "vip-girl-vip": 11,
  "vg-sexy": 12,
  "303-for-woman-17-ml": 13,
  "dg-red": 14,
  "fantastica-bry-17-ml": 15,
  aaliyah: 16,
  // Masculino
  "soul-17-ml": 1,
  presidente: 2,
  soberano: 3,
  maximum: 4,
  "oud-royale": 5,
  "303-vip-men-17-ml": 6,
  "gouf-blue-17-ml": 7,
  "easy-line-17-ml": 8,
  "venum-17-ml": 9,
  capadocia: 10,
  "gouf-tradicional-17-ml": 11,
  "303-men-17-ml": 12,
  "speed-black": 13,
  fera: 14,
  sentimento: 15,
};

function rankingMercado(item: ItemCatalogo): number {
  return RANKING_MERCADO_PERFUMARIA[item.chave] ?? 999;
}

// Ordem geral (outras categorias): vendas reais do catálogo, depois nome.
function ordenarPorPopularidade(itens: ItemCatalogo[]): ItemCatalogo[] {
  return [...itens].sort((a, b) => {
    if (b.vendasTotais !== a.vendasTotais) return b.vendasTotais - a.vendasTotais;
    return nomeItem(a).localeCompare(nomeItem(b), "pt-BR");
  });
}

// Perfumaria: vendas reais primeiro (isso é o que vira o badge "Mais
// vendido"), e quando não há venda real ainda pra desempatar, usa o
// ranking de mercado fixo em vez de ordem alfabética.
function ordenarPerfumaria(itens: ItemCatalogo[]): ItemCatalogo[] {
  return [...itens].sort((a, b) => {
    const rankA = rankingMercado(a);
    const rankB = rankingMercado(b);
    if (rankA !== rankB) return rankA - rankB;
    if (b.vendasTotais !== a.vendasTotais) return b.vendasTotais - a.vendasTotais;
    return nomeItem(a).localeCompare(nomeItem(b), "pt-BR");
  });
}

function tamanhoPadrao(item: Extract<ItemCatalogo, { tipo: "variante" }>): "17ml" | "100ml" {
  return item.tamanhos.some((t) => t.tamanho === "100ml") ? "100ml" : "17ml";
}

function sexoDoItem(item: ItemCatalogo): "masculino" | "feminino" | null {
  return item.tipo === "variante" ? item.tamanhos[0].produto.sexo : item.produto.sexo;
}

type ItemCarrinho = {
  chave: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem: string | null;
};

function montarMensagemPedido(itens: ItemCarrinho[], total: number): string {
  const linhas = itens
    .map((i) => `${i.quantidade}x ${i.nome} - ${currency(i.preco * i.quantidade)}`)
    .join("\n");
  return `Oi! Fiz uma seleção no seu catálogo e queria fechar esse pedido:\n\n${linhas}\n\nTotal: ${currency(total)}`;
}

// Estrelas decorativas (nota de confiança visual), sem número de avaliações.
function Estrelas() {
  return (
    <div className="catalogo-estrelas">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="var(--cat-star, var(--warn))">
          <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7Z" />
        </svg>
      ))}
    </div>
  );
}

function IconCarrinho({ className }: { className?: string }) {
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
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2.2l2.3 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7.5H6.2" />
    </svg>
  );
}

function IconFiltro({ className }: { className?: string }) {
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
      <path d="M3.5 5h17L14 13v6l-4 2v-8L3.5 5Z" />
    </svg>
  );
}

export default function CatalogoPublicoPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [catalogo, setCatalogo] = useState<CatalogoPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroSexo, setFiltroSexo] = useState<"todos" | "feminino" | "masculino">("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  useEffect(() => {
    getCatalogoPublico(params.slug)
      .then((c) => {
        if (!c) {
          setNaoEncontrado(true);
        } else {
          setCatalogo(c);
        }
      })
      .catch(() => setNaoEncontrado(true))
      .finally(() => setCarregando(false));
  }, [params.slug]);

  const temPerfumaria = useMemo(
    () =>
      !!catalogo &&
      catalogo.produtos.some(
        (p) => p.categoria === "perfumaria_17ml" || p.categoria === "perfumaria_100ml"
      ),
    [catalogo]
  );

  const itensPerfumaria = useMemo(
    () => (catalogo && temPerfumaria ? ordenarPerfumaria(agruparPerfumaria(catalogo.produtos)) : []),
    [catalogo, temPerfumaria]
  );

  const porOutraCategoria = useMemo(() => {
    const mapa = new Map<string, ItemCatalogo[]>();
    if (!catalogo) return mapa;
    for (const p of catalogo.produtos) {
      if (p.categoria === "perfumaria_17ml" || p.categoria === "perfumaria_100ml") continue;
      const lista = mapa.get(p.categoria) ?? [];
      lista.push({ tipo: "simples", chave: p.id, vendasTotais: p.vendasTotais, produto: p });
      mapa.set(p.categoria, lista);
    }
    for (const [categoria, lista] of mapa) {
      mapa.set(categoria, ordenarPorPopularidade(lista));
    }
    return mapa;
  }, [catalogo]);

  // Mapa de todos os itens (perfumaria + outras categorias), pra resolver o
  // item aberto a partir do parâmetro da URL.
  const mapaItens = useMemo(() => {
    const mapa = new Map<string, ItemCatalogo>();
    for (const i of itensPerfumaria) mapa.set(i.chave, i);
    for (const lista of porOutraCategoria.values()) for (const i of lista) mapa.set(i.chave, i);
    return mapa;
  }, [itensPerfumaria, porOutraCategoria]);

  const maisVendidosChaves = useMemo(() => {
    const todos = [...itensPerfumaria, ...Array.from(porOutraCategoria.values()).flat()];
    return new Set(
      todos
        .filter((i) => i.vendasTotais > 0)
        .sort((a, b) => b.vendasTotais - a.vendasTotais)
        .slice(0, 3)
        .map((i) => i.chave)
    );
  }, [itensPerfumaria, porOutraCategoria]);

  // Categorias disponíveis pros chips de filtro, na ordem em que aparecem.
  const categoriasDisponiveis = useMemo(() => {
    const lista: { chave: string; label: string }[] = [];
    if (temPerfumaria) lista.push({ chave: "perfumaria", label: "Perfumaria" });
    for (const chave of porOutraCategoria.keys()) {
      lista.push({ chave, label: LABEL_CATEGORIA[chave] ?? chave });
    }
    return lista;
  }, [temPerfumaria, porOutraCategoria]);

  const mostraPerfumaria =
    temPerfumaria && (filtroCategoria === "todas" || filtroCategoria === "perfumaria");

  const itensPerfumariaFiltrados = useMemo(() => {
    if (filtroSexo === "todos") return itensPerfumaria;
    return itensPerfumaria.filter((i) => sexoDoItem(i) === filtroSexo);
  }, [itensPerfumaria, filtroSexo]);

  // Tela de detalhe fica representada na própria URL (?p=chave&t=tamanho),
  // exatamente como o app principal faz com "?aba=". Isso faz o botão
  // voltar do navegador fechar a tela de detalhe em vez de sair do site.
  const chaveAberta = searchParams.get("p");
  const tamanhoAberto = (searchParams.get("t") as "17ml" | "100ml" | null) ?? null;
  const itemAberto = chaveAberta ? mapaItens.get(chaveAberta) ?? null : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chaveAberta]);

  function abrirDetalhe(item: ItemCatalogo, tamanho: "17ml" | "100ml" | null) {
    const qs = new URLSearchParams();
    qs.set("p", item.chave);
    if (tamanho) qs.set("t", tamanho);
    router.push(`/catalogo/${params.slug}?${qs.toString()}`, { scroll: false });
  }

  function trocarTamanhoDetalhe(t: "17ml" | "100ml") {
    if (!chaveAberta) return;
    const qs = new URLSearchParams();
    qs.set("p", chaveAberta);
    qs.set("t", t);
    router.replace(`/catalogo/${params.slug}?${qs.toString()}`, { scroll: false });
  }

  function fecharDetalhe() {
    router.back();
  }

  function adicionarAoCarrinho(produto: ProdutoCatalogoPublico, nomeExibido: string) {
    setCarrinho((atual) => {
      const idx = atual.findIndex((i) => i.chave === produto.id);
      if (idx >= 0) {
        const copia = [...atual];
        copia[idx] = { ...copia[idx], quantidade: copia[idx].quantidade + 1 };
        return copia;
      }
      return [
        ...atual,
        { chave: produto.id, nome: nomeExibido, preco: produto.preco, quantidade: 1, imagem: produto.imagem },
      ];
    });
  }

  function alterarQuantidade(chave: string, novaQtd: number) {
    setCarrinho((atual) => {
      if (novaQtd <= 0) return atual.filter((i) => i.chave !== chave);
      return atual.map((i) => (i.chave === chave ? { ...i, quantidade: novaQtd } : i));
    });
  }

  function removerDoCarrinho(chave: string) {
    setCarrinho((atual) => atual.filter((i) => i.chave !== chave));
  }

  const totalCarrinho = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.quantidade, 0);

  if (carregando) {
    return (
      <div className="login-shell catalogo-tema-claro">
        <div className="empty-state">Carregando catálogo...</div>
      </div>
    );
  }

  if (naoEncontrado || !catalogo) {
    return (
      <div className="login-shell catalogo-tema-claro">
        <div className="login-card">
          <img src={LOGO_URL} alt="Avance Vendas" className="login-logo" />
          <p className="login-subtitle">
            Esse catálogo não existe ou não está disponível no momento.
          </p>
        </div>
      </div>
    );
  }

  const tituloExibido = catalogo.titulo || "Catálogo";
  const subtitulo = catalogo.nomeRevendedor
    ? `Produtos selecionados por ${catalogo.nomeRevendedor}`
    : "Toque num produto pra ver detalhes";

  return (
    <div className="app-shell catalogo-tema-claro">
      <div className="top-bar">
        <div className="top-bar-inner">
          {itemAberto ? (
            <>
              <button className="catalogo-voltar" onClick={fecharDetalhe}>
                ←
              </button>
              <div className="brand">{nomeItem(itemAberto)}</div>
            </>
          ) : (
            <>
              <img src={LOGO_URL} alt="Avance Vendas" className="top-bar-logo" />
              <div className="brand">Catálogo</div>
            </>
          )}
          <div className="top-bar-actions">
            <button className="catalogo-cart-btn" onClick={() => setCarrinhoAberto(true)}>
              <IconCarrinho className="icon-sm" />
              {qtdCarrinho > 0 && <span className="catalogo-cart-count">{qtdCarrinho}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="main">
        {itemAberto ? (
          <TelaDetalheProduto
            item={itemAberto}
            tamanho={tamanhoAberto ?? (itemAberto.tipo === "variante" ? tamanhoPadrao(itemAberto) : null)}
            onTrocarTamanho={trocarTamanhoDetalhe}
            whatsapp={catalogo.whatsapp}
            onAdicionar={adicionarAoCarrinho}
          />
        ) : (
          <>
            <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h1>{tituloExibido}</h1>
                <p>{subtitulo}</p>
              </div>
              {(categoriasDisponiveis.length > 1 || temPerfumaria) && (
                <button className="catalogo-cart-btn" style={{ flexShrink: 0 }} onClick={() => setFiltrosAbertos(true)}>
                  <IconFiltro className="icon-sm" />
                  {(filtroCategoria !== "todas" || filtroSexo !== "todos") && (
                    <span className="catalogo-cart-count">•</span>
                  )}
                </button>
              )}
            </div>

            {catalogo.produtos.length === 0 && (
              <div className="empty-state">
                <div className="title">Nenhum produto disponível</div>
                Esse catálogo ainda não tem produtos publicados.
              </div>
            )}

            {mostraPerfumaria && (
              <div style={{ marginBottom: 26 }}>
                <h2 className="panel-title">Perfumaria</h2>
                <div className="catalogo-grid">
                  {itensPerfumariaFiltrados.map((item) => (
                    <CardCatalogo
                      key={item.chave}
                      item={item}
                      maisVendido={maisVendidosChaves.has(item.chave)}
                      onAbrir={abrirDetalhe}
                    />
                  ))}
                </div>
              </div>
            )}

            {Array.from(porOutraCategoria.entries())
              .filter(([categoria]) => filtroCategoria === "todas" || filtroCategoria === categoria)
              .map(([categoria, itens]) => (
                <div key={categoria} style={{ marginBottom: 26 }}>
                  <h2 className="panel-title">{LABEL_CATEGORIA[categoria] ?? categoria}</h2>
                  <div className="catalogo-grid">
                    {itens.map((item) => (
                      <CardCatalogo
                        key={item.chave}
                        item={item}
                        maisVendido={maisVendidosChaves.has(item.chave)}
                        onAbrir={abrirDetalhe}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>

      {carrinhoAberto && (
        <div className="sheet-overlay" onClick={() => setCarrinhoAberto(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>Seu carrinho</h2>
              <button className="sheet-close" onClick={() => setCarrinhoAberto(false)}>
                ✕
              </button>
            </div>

            {carrinho.length === 0 ? (
              <div className="empty-state">Carrinho vazio.</div>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  {carrinho.map((item) => (
                    <div key={item.chave} className="catalogo-carrinho-linha">
                      <span style={{ flex: 1, fontSize: "0.86rem" }}>{item.nome}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--cat-muted)", whiteSpace: "nowrap" }}>
                        {currency(item.preco)}
                      </span>
                      <div className="qty-control">
                        <button onClick={() => alterarQuantidade(item.chave, item.quantidade - 1)}>
                          −
                        </button>
                        <span style={{ minWidth: 20, textAlign: "center" }}>{item.quantidade}</span>
                        <button onClick={() => alterarQuantidade(item.chave, item.quantidade + 1)}>
                          +
                        </button>
                      </div>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => removerDoCarrinho(item.chave)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-line" style={{ fontWeight: 700, marginBottom: 14 }}>
                  <span>Total</span>
                  <span>{currency(totalCarrinho)}</span>
                </div>

                {catalogo.whatsapp ? (
                  <a
                    className="btn btn-primary btn-block"
                    href={linkWhatsApp(catalogo.whatsapp, montarMensagemPedido(carrinho, totalCarrinho))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setCarrinhoAberto(false)}
                  >
                    Enviar pedido no WhatsApp
                  </a>
                ) : (
                  <button className="btn btn-ghost btn-block" disabled>
                    WhatsApp indisponível
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {filtrosAbertos && (
        <div className="sheet-overlay" onClick={() => setFiltrosAbertos(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>Filtrar</h2>
              <button className="sheet-close" onClick={() => setFiltrosAbertos(false)}>
                ✕
              </button>
            </div>

            {categoriasDisponiveis.length > 1 && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: "0.78rem", color: "var(--cat-muted)", marginBottom: 8 }}>
                  Categoria
                </p>
                <div className="catalogo-filtros" style={{ overflow: "visible", flexWrap: "wrap" }}>
                  <button
                    className={"catalogo-filtro-chip " + (filtroCategoria === "todas" ? "active" : "")}
                    onClick={() => setFiltroCategoria("todas")}
                  >
                    Todos
                  </button>
                  {categoriasDisponiveis.map((c) => (
                    <button
                      key={c.chave}
                      className={"catalogo-filtro-chip " + (filtroCategoria === c.chave ? "active" : "")}
                      onClick={() => setFiltroCategoria(c.chave)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {temPerfumaria && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: "0.78rem", color: "var(--cat-muted)", marginBottom: 8 }}>
                  Perfumaria
                </p>
                <div className="catalogo-filtros" style={{ overflow: "visible", flexWrap: "wrap" }}>
                  {(["todos", "feminino", "masculino"] as const).map((s) => (
                    <button
                      key={s}
                      className={"catalogo-filtro-chip " + (filtroSexo === s ? "active" : "")}
                      onClick={() => setFiltroSexo(s)}
                    >
                      {s === "todos" ? "Todos" : s === "feminino" ? "Feminino" : "Masculino"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-block" onClick={() => setFiltrosAbertos(false)}>
              Ver resultados
            </button>
            {(filtroCategoria !== "todas" || filtroSexo !== "todos") && (
              <button
                className="btn btn-ghost btn-block"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setFiltroCategoria("todas");
                  setFiltroSexo("todos");
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CardCatalogo({
  item,
  maisVendido,
  onAbrir,
}: {
  item: ItemCatalogo;
  maisVendido: boolean;
  onAbrir: (item: ItemCatalogo, tamanhoAtual: "17ml" | "100ml" | null) => void;
}) {
  const padraoInicial = item.tipo === "variante" ? tamanhoPadrao(item) : null;
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState<"17ml" | "100ml" | null>(padraoInicial);

  const atual =
    item.tipo === "variante"
      ? item.tamanhos.find((t) => t.tamanho === tamanhoSelecionado)?.produto ?? item.tamanhos[0].produto
      : item.produto;
  const nome = item.tipo === "variante" ? item.nome : item.produto.nome;

  return (
    <div className="catalogo-item" onClick={() => onAbrir(item, tamanhoSelecionado)}>
      <div className="catalogo-item-media">
        {atual.imagem ? (
          <img src={atual.imagem} alt={nome} />
        ) : (
          <span className="catalogo-item-placeholder">{nome.slice(0, 1)}</span>
        )}
        {maisVendido && (
          <span className="badge badge-info catalogo-item-badge-left">Mais vendido</span>
        )}
      </div>
      <div className="catalogo-item-nome">{nome}</div>
      <Estrelas />
      <div className="catalogo-item-preco">{currency(atual.preco)}</div>
      {item.tipo === "variante" && (
        <div className="catalogo-size-toggle">
          {item.tamanhos.map((t) => (
            <button
              key={t.tamanho}
              className={"catalogo-size-pill " + (tamanhoSelecionado === t.tamanho ? "active" : "")}
              onClick={(e) => {
                e.stopPropagation();
                setTamanhoSelecionado(t.tamanho);
              }}
            >
              {t.tamanho}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TelaDetalheProduto({
  item,
  tamanho,
  onTrocarTamanho,
  whatsapp,
  onAdicionar,
}: {
  item: ItemCatalogo;
  tamanho: "17ml" | "100ml" | null;
  onTrocarTamanho: (t: "17ml" | "100ml") => void;
  whatsapp: string;
  onAdicionar: (produto: ProdutoCatalogoPublico, nomeExibido: string) => void;
}) {
  const [adicionado, setAdicionado] = useState(false);
  const produto =
    item.tipo === "variante"
      ? item.tamanhos.find((t) => t.tamanho === tamanho)?.produto ?? item.tamanhos[0].produto
      : item.produto;
  const nome = nomeItem(item);
  const nomeExibido = item.tipo === "variante" ? `${nome} (${tamanho})` : nome;

  function adicionar() {
    onAdicionar(produto, nomeExibido);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1800);
  }

  return (
    <div>
      <div className="catalogo-media-fixa">
        {produto.imagem ? (
          <img src={produto.imagem} alt={nome} />
        ) : (
          <span className="catalogo-item-placeholder" style={{ fontSize: "2.2rem" }}>
            {nome.slice(0, 1)}
          </span>
        )}
      </div>

      <h1 style={{ marginBottom: 4 }}>{nome}</h1>
      <Estrelas />

      {item.tipo === "variante" && (
        <div className="catalogo-size-toggle" style={{ maxWidth: 200, marginTop: 12 }}>
          {item.tamanhos.map((t) => (
            <button
              key={t.tamanho}
              className={"catalogo-size-pill " + (tamanho === t.tamanho ? "active" : "")}
              style={{ fontSize: "0.78rem", padding: "7px 0" }}
              onClick={() => onTrocarTamanho(t.tamanho)}
            >
              {t.tamanho}
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--cat-accent)", marginTop: 14 }}>
        {currency(produto.preco)}
      </div>

      <p style={{ color: "var(--cat-muted)", fontSize: "0.78rem", marginTop: 14 }}>
        {produto.familiaOlfativa}
      </p>
      <p className="sheet-descricao">{produto.descricaoCurta}</p>

      <button className="btn btn-primary btn-block" onClick={adicionar}>
        {adicionado ? "Adicionado!" : "Adicionar ao carrinho"}
      </button>

      {whatsapp && (
        <a
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
          href={linkWhatsApp(whatsapp, `Oi! Vi o ${nomeExibido} no seu catálogo e queria saber mais.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Perguntar no WhatsApp
        </a>
      )}
    </div>
  );
}

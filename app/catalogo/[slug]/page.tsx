"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

// Os dois tamanhos de um mesmo perfume compartilham a base do id
// (ex: "soberano-100-ml" e "soberano" | "madame-vi-17-ml" e "madame-vi-100-ml").
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

// Junta perfumaria 17ml e 100ml do mesmo perfume num item só (com seletor de
// tamanho), e deixa como item único quem não tem par nos dois tamanhos.
// A popularidade do item combinado soma a venda dos dois tamanhos.
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

// Ordena por popularidade (mais vendido primeiro), empate por nome.
function ordenarPorPopularidade(itens: ItemCatalogo[]): ItemCatalogo[] {
  return [...itens].sort((a, b) => {
    if (b.vendasTotais !== a.vendasTotais) return b.vendasTotais - a.vendasTotais;
    return nomeItem(a).localeCompare(nomeItem(b), "pt-BR");
  });
}

function tamanhoPadrao(item: Extract<ItemCatalogo, { tipo: "variante" }>): "17ml" | "100ml" {
  return item.tamanhos.some((t) => t.tamanho === "100ml") ? "100ml" : "17ml";
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

// Estrelas decorativas (nota de confiança visual), sem número de avaliações
// atrelado, já que o sistema ainda não tem avaliação real de cliente.
function Estrelas() {
  return (
    <div className="catalogo-estrelas">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="var(--gold)">
          <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7Z" />
        </svg>
      ))}
    </div>
  );
}

export default function CatalogoPublicoPage() {
  const params = useParams<{ slug: string }>();
  const [catalogo, setCatalogo] = useState<CatalogoPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [detalhe, setDetalhe] = useState<{ item: ItemCatalogo; tamanho: "17ml" | "100ml" | null } | null>(
    null
  );
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [detalhe]);

  const temPerfumaria = useMemo(
    () =>
      !!catalogo &&
      catalogo.produtos.some(
        (p) => p.categoria === "perfumaria_17ml" || p.categoria === "perfumaria_100ml"
      ),
    [catalogo]
  );

  const itensPerfumaria = useMemo(
    () => (catalogo && temPerfumaria ? ordenarPorPopularidade(agruparPerfumaria(catalogo.produtos)) : []),
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

  // Top 3 mais vendidos do catálogo inteiro (todas as categorias juntas),
  // só entra quem já vendeu pelo menos 1 unidade.
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
        {
          chave: produto.id,
          nome: nomeExibido,
          preco: produto.preco,
          quantidade: 1,
          imagem: produto.imagem,
        },
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
      <div className="login-shell">
        <div className="empty-state">Carregando catálogo...</div>
      </div>
    );
  }

  if (naoEncontrado || !catalogo) {
    return (
      <div className="login-shell">
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
    <div className="app-shell">
      <div className="top-bar">
        <div className="top-bar-inner">
          {detalhe ? (
            <>
              <button className="catalogo-voltar" onClick={() => setDetalhe(null)}>
                ←
              </button>
              <div className="brand">{nomeItem(detalhe.item)}</div>
            </>
          ) : (
            <>
              <img src={LOGO_URL} alt="Avance Vendas" className="top-bar-logo" />
              <div className="brand">{tituloExibido}</div>
            </>
          )}
        </div>
      </div>

      <div className="main" style={{ paddingBottom: carrinho.length > 0 ? 84 : undefined }}>
        {detalhe ? (
          <TelaDetalheProduto
            item={detalhe.item}
            tamanho={detalhe.tamanho}
            onTrocarTamanho={(t) => setDetalhe({ item: detalhe.item, tamanho: t })}
            whatsapp={catalogo.whatsapp}
            onAdicionar={adicionarAoCarrinho}
          />
        ) : (
          <>
            <div className="page-header">
              <h1>{tituloExibido}</h1>
              <p>{subtitulo}</p>
            </div>

            {catalogo.produtos.length === 0 && (
              <div className="empty-state">
                <div className="title">Nenhum produto disponível</div>
                Esse catálogo ainda não tem produtos publicados.
              </div>
            )}

            {temPerfumaria && (
              <div style={{ marginBottom: 26 }}>
                <h2 className="panel-title">Perfumaria</h2>
                <div className="catalogo-grid">
                  {itensPerfumaria.map((item) => (
                    <CardCatalogo
                      key={item.chave}
                      item={item}
                      maisVendido={maisVendidosChaves.has(item.chave)}
                      onAbrir={(i, t) => setDetalhe({ item: i, tamanho: t })}
                    />
                  ))}
                </div>
              </div>
            )}

            {Array.from(porOutraCategoria.entries()).map(([categoria, itens]) => (
              <div key={categoria} style={{ marginBottom: 26 }}>
                <h2 className="panel-title">{LABEL_CATEGORIA[categoria] ?? categoria}</h2>
                <div className="catalogo-grid">
                  {itens.map((item) => (
                    <CardCatalogo
                      key={item.chave}
                      item={item}
                      maisVendido={maisVendidosChaves.has(item.chave)}
                      onAbrir={(i, t) => setDetalhe({ item: i, tamanho: t })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {carrinho.length > 0 && !carrinhoAberto && (
        <button className="catalogo-carrinho-bar" onClick={() => setCarrinhoAberto(true)}>
          <span>
            {qtdCarrinho} {qtdCarrinho === 1 ? "item" : "itens"} no carrinho
          </span>
          <span>{currency(totalCarrinho)}</span>
        </button>
      )}

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
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
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
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState<"17ml" | "100ml" | null>(
    padraoInicial
  );

  const atual = item.tipo === "variante"
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
        {!atual.disponivel && (
          <span className="badge badge-low catalogo-item-badge">Indisponível</span>
        )}
      </div>
      <div className="catalogo-item-nome">{nome}</div>
      <Estrelas />
      <div className="catalogo-item-preco">{currency(atual.preco)}</div>
      <p className="catalogo-item-desc">{atual.descricaoCurta || atual.familiaOlfativa}</p>
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

      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--gold)", marginTop: 14 }}>
        {currency(produto.preco)}
      </div>

      {!produto.disponivel && (
        <span className="badge badge-low" style={{ marginTop: 8, display: "inline-block" }}>
          Indisponível no momento, ainda dá pra pedir
        </span>
      )}

      <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 14 }}>
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

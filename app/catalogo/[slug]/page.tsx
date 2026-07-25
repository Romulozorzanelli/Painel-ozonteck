"use client";

import { useEffect, useState } from "react";
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
// quando os dois tamanhos do mesmo perfume viram um card só.
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
      tamanhos: { tamanho: "17ml" | "100ml"; produto: ProdutoCatalogoPublico }[];
    }
  | { tipo: "simples"; chave: string; produto: ProdutoCatalogoPublico };

// Junta perfumaria 17ml e 100ml do mesmo perfume num card só (com seletor de
// tamanho), e deixa como card único quem não tem par nos dois tamanhos.
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
        tamanhos: [
          { tamanho: "17ml", produto: par17 },
          { tamanho: "100ml", produto: produto100 },
        ],
      });
    } else {
      itens.push({ tipo: "simples", chave: produto100.id, produto: produto100 });
    }
  }

  for (const produto17 of p17) {
    if (!usados17.has(produto17.id)) {
      itens.push({ tipo: "simples", chave: produto17.id, produto: produto17 });
    }
  }

  return itens.sort((a, b) => {
    const nomeA = a.tipo === "variante" ? a.nome : a.produto.nome;
    const nomeB = b.tipo === "variante" ? b.nome : b.produto.nome;
    return nomeA.localeCompare(nomeB, "pt-BR");
  });
}

export default function CatalogoPublicoPage() {
  const params = useParams<{ slug: string }>();
  const [catalogo, setCatalogo] = useState<CatalogoPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [produtoAberto, setProdutoAberto] = useState<ProdutoCatalogoPublico | null>(null);

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

  const temPerfumaria = catalogo.produtos.some(
    (p) => p.categoria === "perfumaria_17ml" || p.categoria === "perfumaria_100ml"
  );
  const itensPerfumaria = temPerfumaria ? agruparPerfumaria(catalogo.produtos) : [];

  const porOutraCategoria = new Map<string, ProdutoCatalogoPublico[]>();
  for (const p of catalogo.produtos) {
    if (p.categoria === "perfumaria_17ml" || p.categoria === "perfumaria_100ml") continue;
    const lista = porOutraCategoria.get(p.categoria) ?? [];
    lista.push(p);
    porOutraCategoria.set(p.categoria, lista);
  }

  const tituloExibido = catalogo.titulo || "Catálogo";
  const subtitulo = catalogo.nomeRevendedor
    ? `Produtos selecionados por ${catalogo.nomeRevendedor}`
    : "Toque num produto pra ver detalhes";

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="top-bar-inner">
          <img src={LOGO_URL} alt="Avance Vendas" className="top-bar-logo" />
          <div className="brand">{tituloExibido}</div>
        </div>
      </div>

      <div className="main">
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
          <div style={{ marginBottom: 22 }}>
            <h2 className="panel-title">Perfumaria</h2>
            <div className="catalogo-grid">
              {itensPerfumaria.map((item) => (
                <CardCatalogo key={item.chave} item={item} onAbrir={setProdutoAberto} />
              ))}
            </div>
          </div>
        )}

        {Array.from(porOutraCategoria.entries()).map(([categoria, produtos]) => (
          <div key={categoria} style={{ marginBottom: 22 }}>
            <h2 className="panel-title">{LABEL_CATEGORIA[categoria] ?? categoria}</h2>
            <div className="catalogo-grid">
              {produtos.map((p) => (
                <CardCatalogo
                  key={p.id}
                  item={{ tipo: "simples", chave: p.id, produto: p }}
                  onAbrir={setProdutoAberto}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {produtoAberto && (
        <div className="sheet-overlay" onClick={() => setProdutoAberto(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2>{produtoAberto.nome}</h2>
              <button className="sheet-close" onClick={() => setProdutoAberto(null)}>
                ✕
              </button>
            </div>

            {produtoAberto.imagem && (
              <div className="stock-detail-media" style={{ marginBottom: 12 }}>
                <img src={produtoAberto.imagem} alt={produtoAberto.nome} />
              </div>
            )}

            <p className="sheet-descricao">
              {produtoAberto.descricaoCurta || produtoAberto.familiaOlfativa}
            </p>

            <div className="stock-card-footer" style={{ marginBottom: 14 }}>
              <span className="stock-card-price" style={{ fontSize: "1.1rem" }}>
                {currency(produtoAberto.preco)}
              </span>
              {!produtoAberto.disponivel && <span className="badge badge-low">Indisponível</span>}
            </div>

            {catalogo.whatsapp ? (
              <a
                className="btn btn-primary btn-block"
                href={linkWhatsApp(
                  catalogo.whatsapp,
                  `Oi! Vi o ${produtoAberto.nome} no seu catálogo e queria saber mais.`
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar no WhatsApp
              </a>
            ) : (
              <button className="btn btn-ghost btn-block" disabled>
                WhatsApp indisponível
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
  onAbrir,
}: {
  item: ItemCatalogo;
  onAbrir: (p: ProdutoCatalogoPublico) => void;
}) {
  const padraoInicial = item.tipo === "variante" ? ultimoTamanhoDisponivel(item) : null;
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState<"17ml" | "100ml" | null>(
    padraoInicial
  );

  if (item.tipo === "simples") {
    const p = item.produto;
    return (
      <div className="catalogo-card" onClick={() => onAbrir(p)}>
        <div className="catalogo-card-media">
          {p.imagem ? (
            <img src={p.imagem} alt={p.nome} />
          ) : (
            <span className="catalogo-card-placeholder">{p.nome.slice(0, 1)}</span>
          )}
          {!p.disponivel && (
            <span className="badge badge-low catalogo-card-badge">Indisponível</span>
          )}
        </div>
        <div className="catalogo-card-body">
          <span className="catalogo-card-tag">{p.familiaOlfativa}</span>
          <span className="catalogo-card-title">{p.nome}</span>
          <span className="catalogo-card-price">{currency(p.preco)}</span>
        </div>
      </div>
    );
  }

  const atual =
    item.tamanhos.find((t) => t.tamanho === tamanhoSelecionado)?.produto ??
    item.tamanhos[0].produto;

  return (
    <div className="catalogo-card">
      <div className="catalogo-card-media" onClick={() => onAbrir(atual)}>
        {atual.imagem ? (
          <img src={atual.imagem} alt={atual.nome} />
        ) : (
          <span className="catalogo-card-placeholder">{item.nome.slice(0, 1)}</span>
        )}
        {!atual.disponivel && (
          <span className="badge badge-low catalogo-card-badge">Indisponível</span>
        )}
      </div>
      <div className="catalogo-card-body">
        <span className="catalogo-card-tag">{atual.familiaOlfativa}</span>
        <span className="catalogo-card-title" onClick={() => onAbrir(atual)}>
          {item.nome}
        </span>
        <span className="catalogo-card-price">{currency(atual.preco)}</span>
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
      </div>
    </div>
  );
}

// Padrão: 100ml selecionado quando existe (maior ticket); cai pro 17ml se
// por algum motivo o 100ml não estiver na lista.
function ultimoTamanhoDisponivel(
  item: Extract<ItemCatalogo, { tipo: "variante" }>
): "17ml" | "100ml" {
  return item.tamanhos.some((t) => t.tamanho === "100ml") ? "100ml" : "17ml";
}

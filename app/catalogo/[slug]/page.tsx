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

  const porCategoria = new Map<string, ProdutoCatalogoPublico[]>();
  for (const p of catalogo.produtos) {
    const lista = porCategoria.get(p.categoria) ?? [];
    lista.push(p);
    porCategoria.set(p.categoria, lista);
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

        {Array.from(porCategoria.entries()).map(([categoria, produtos]) => (
          <div key={categoria} style={{ marginBottom: 22 }}>
            <h2 className="panel-title">{LABEL_CATEGORIA[categoria] ?? categoria}</h2>
            <div className="stock-grid">
              {produtos.map((p) => (
                <div key={p.id} className="stock-card" onClick={() => setProdutoAberto(p)}>
                  <div className="stock-card-media">
                    {p.imagem ? (
                      <img src={p.imagem} alt={p.nome} />
                    ) : (
                      <span className="stock-card-placeholder">{p.nome.slice(0, 1)}</span>
                    )}
                    {!p.disponivel && (
                      <span className="badge badge-low stock-card-badge">Indisponível</span>
                    )}
                  </div>
                  <div className="stock-card-body">
                    <span className="stock-card-tag">{p.familiaOlfativa}</span>
                    <span className="stock-card-title">{p.nome}</span>
                    <div className="stock-card-footer">
                      <span className="stock-card-price">{currency(p.preco)}</span>
                    </div>
                  </div>
                </div>
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

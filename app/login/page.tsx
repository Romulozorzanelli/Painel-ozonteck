"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LOGO_URL =
  "https://ghqsqqegblhseocxmwwx.supabase.co/storage/v1/object/public/brand-assets/Screenshot_20260722_100709_ChatGPT.jpg";
const WHATSAPP_URL = "https://wa.me/5527988998483";

export default function LoginPage() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sobreAberto, setSobreAberto] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("erro") === "auth") {
      setErro("Não foi possível concluir o login. Tente novamente.");
    }
  }, []);

  async function entrarComGoogle() {
    setErro("");
    setCarregando(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setErro("Não foi possível iniciar o login. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <img src={LOGO_URL} alt="Avance Vendas" className="login-logo" />
        <div className="login-brand">
          Avance Vendas
          <span>Painel do revendedor</span>
        </div>
        <p className="login-subtitle">
          Estoque, clientes, vendas e financeiro da sua revenda em um só lugar.
        </p>

        <ul className="login-features">
          <li>Estoque com controle de quantidade e alerta de reposição</li>
          <li>Clientes e vendas, com histórico completo de cada um</li>
          <li>Financeiro: entradas, saídas e saldo sempre atualizados</li>
        </ul>

        {erro && <p className="login-error">{erro}</p>}
        <button
          className="btn btn-primary btn-block"
          onClick={entrarComGoogle}
          disabled={carregando}
        >
          {carregando ? "Redirecionando..." : "Entrar com Google"}
        </button>

        <p className="login-hint">
          Primeiro acesso? Depois de entrar, vamos pedir nome, WhatsApp e CPF
          pra liberar seu painel.
        </p>
        <p className="login-privacy">
          Seus dados ficam privados — cada conta só acessa as próprias
          informações.
        </p>

        <button
          type="button"
          className="login-sobre-link"
          onClick={() => setSobreAberto(true)}
        >
          Sobre o app
        </button>
      </div>

      {sobreAberto && (
        <div className="sheet-overlay" onClick={() => setSobreAberto(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>Sobre o app</h2>
            <p className="sheet-descricao">
              Avance Vendas é o painel de gestão pra revendedores: estoque,
              clientes, vendas e financeiro, tudo em um só lugar.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Desenvolvido por{" "}
              <strong style={{ color: "var(--text)" }}>@romuloautomacoes</strong>.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="sheet-whatsapp-link"
            >
              Falar no WhatsApp: (27) 98899-8483
            </a>
            <p className="login-privacy">
              Seus dados ficam privados — cada conta só acessa as próprias
              informações.
            </p>
            <button
              className="btn btn-ghost btn-block"
              style={{ marginTop: 12 }}
              onClick={() => setSobreAberto(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

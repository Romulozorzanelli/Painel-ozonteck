"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LOGO_URL =
  "https://ghqsqqegblhseocxmwwx.supabase.co/storage/v1/object/public/brand-assets/Screenshot_20260722_100709_ChatGPT.jpg";

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
          <span>Acesso restrito</span>
        </div>
        <p className="login-subtitle">Entre com sua conta Google para continuar.</p>
        {erro && <p className="login-error">{erro}</p>}
        <button
          className="btn btn-primary btn-block"
          onClick={entrarComGoogle}
          disabled={carregando}
        >
          {carregando ? "Redirecionando..." : "Entrar com Google"}
        </button>

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
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Desenvolvido por{" "}
              <strong style={{ color: "var(--text)" }}>@romuloautomacoes</strong>.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              Contato: (27) 98899-8483
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

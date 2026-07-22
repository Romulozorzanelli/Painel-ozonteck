"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

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
        <div className="login-brand">
          Painel Ozonteck
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
      </div>
    </div>
  );
}

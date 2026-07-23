"use client";

import { useEffect, useRef } from "react";

// Verifica a cada X minutos (e sempre que a aba volta a ficar visivel/em
// foco) se a versao publicada mudou. Se mudou, recarrega a pagina sozinho,
// sem avisar — pra garantir que ninguem fique preso numa versao antiga do
// app depois de um deploy, mesmo com a aba aberta ha muito tempo.
const INTERVALO_MS = 3 * 60 * 1000; // 3 minutos

export default function VersionCheck() {
  const jaRecarregou = useRef(false);

  useEffect(() => {
    const versaoAtual = process.env.NEXT_PUBLIC_BUILD_SHA;
    // Em desenvolvimento local (sem SHA de deploy) a checagem nao faz sentido.
    if (!versaoAtual || versaoAtual === "dev") return;

    async function checar() {
      if (jaRecarregou.current) return;
      try {
        const resposta = await fetch(`/api/version?_=${Date.now()}`, {
          cache: "no-store",
        });
        if (!resposta.ok) return;
        const { sha } = await resposta.json();
        if (sha && sha !== versaoAtual) {
          jaRecarregou.current = true;
          window.location.reload();
        }
      } catch {
        // Falha de rede na checagem: ignora e tenta de novo no proximo ciclo.
      }
    }

    const intervalo = setInterval(checar, INTERVALO_MS);

    function aoFicarVisivel() {
      if (document.visibilityState === "visible") checar();
    }
    document.addEventListener("visibilitychange", aoFicarVisivel);
    window.addEventListener("focus", checar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoFicarVisivel);
      window.removeEventListener("focus", checar);
    };
  }, []);

  return null;
}

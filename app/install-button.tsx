"use client";

import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (installed) {
    return <p className="about-text-sm">App já instalado neste aparelho.</p>;
  }

  if (deferredPrompt) {
    return (
      <button className="btn btn-primary btn-block" onClick={handleInstall}>
        Instalar app
      </button>
    );
  }

  return (
    <p className="about-text-sm">
      No Android: toque no menu (⋮) do navegador e escolha "Adicionar à tela inicial" ou
      "Instalar app". No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".
    </p>
  );
}

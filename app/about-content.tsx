"use client";

import InstallButton from "./install-button";

function IconWhatsapp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.47 14.38c-.29-.15-1.71-.84-1.97-.94-.27-.1-.46-.15-.66.15-.19.29-.75.94-.92 1.13-.17.19-.34.22-.63.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.51.07-.78.36-.27.29-1.02 1-1.02 2.43 0 1.43 1.04 2.82 1.19 3.01.15.19 2.05 3.13 4.96 4.39.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.11.55-.08 1.71-.7 1.96-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34Z" />
      <path d="M12.02 2C6.5 2 2.03 6.44 2.03 11.92c0 1.85.5 3.58 1.38 5.07L2 22l5.19-1.36a10.02 10.02 0 0 0 4.83 1.23h.01c5.52 0 9.99-4.44 9.99-9.92C22 6.47 17.54 2 12.02 2Zm0 18.17h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.08.81.82-3-.2-.31a8.15 8.15 0 0 1-1.26-4.42c0-4.52 3.69-8.2 8.23-8.2 2.2 0 4.26.86 5.82 2.41a8.13 8.13 0 0 1 2.41 5.8c0 4.52-3.69 8.2-8.23 8.2Z" />
    </svg>
  );
}

export default function AboutContent() {
  return (
    <div className="about-section">
      <h2 className="panel-title">Sobre o Avance Vendas</h2>
      <p className="about-text">
        Toda ferramenta criada aqui é pensada pra ajudar você, consultor(a) do time Avance, a
        controlar estoque e vendas com mais facilidade no dia a dia. Toda sugestão de melhoria é
        muito bem-vinda.
      </p>

      <div className="about-install">
        <div className="about-subtitle">Instalar como aplicativo</div>
        <InstallButton />
      </div>

      <div className="about-footer">
        <p className="about-text-sm">
          Criado por{" "}
          <a href="https://instagram.com/romuloautomacoes" target="_blank" rel="noopener noreferrer">
            @romuloautomacoes
          </a>
        </p>
        <a
          className="whatsapp-link"
          href="https://wa.me/5527988998483"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconWhatsapp className="icon-sm" />
          Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}

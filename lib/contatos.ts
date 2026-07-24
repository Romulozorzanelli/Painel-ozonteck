export type ContatoImportado = {
  nome: string;
  telefone: string;
  email: string;
  origem?: string;
  sexo?: "masculino" | "feminino" | null;
  emRelacionamento?: boolean | null;
  temFilhos?: boolean | null;
  aniversarioDia?: number | null;
  aniversarioMes?: number | null;
};

// Le o conteudo de um arquivo .vcf (vCard) e devolve os contatos com nome e
// telefone. Isomorfico: nao usa nenhuma API exclusiva de navegador, funciona
// tanto no upload manual (client) quanto no recebimento via Web Share Target
// (server).
export function extrairContatosVCard(texto: string): ContatoImportado[] {
  // Desdobra linhas continuadas (RFC 6350: uma linha que comeca com espaco
  // ou tab e continuacao da linha anterior).
  const desdobrado = texto.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const blocos = desdobrado.split(/BEGIN:VCARD/i).slice(1);

  const contatos: ContatoImportado[] = [];

  for (const bloco of blocos) {
    const linhas = bloco.split(/\r?\n/);
    let nome = "";
    let nomeEstruturado = "";
    let telefone = "";
    let email = "";

    for (const linhaRaw of linhas) {
      const linha = linhaRaw.trim();
      if (!linha || /^END:VCARD/i.test(linha)) continue;

      const idx = linha.indexOf(":");
      if (idx === -1) continue;

      const chaveCompleta = linha.slice(0, idx).toUpperCase();
      const chave = chaveCompleta.split(";")[0];
      const valor = linha.slice(idx + 1).trim();
      if (!valor) continue;

      if (chave === "FN" && !nome) {
        nome = valor;
      } else if (chave === "N" && !nomeEstruturado) {
        // Formato: Sobrenome;Nome;NomeDoMeio;Prefixo;Sufixo
        const partes = valor.split(";");
        nomeEstruturado = [partes[1], partes[0]].filter(Boolean).join(" ").trim();
      } else if (chave === "TEL" && !telefone) {
        telefone = valor;
      } else if (chave === "EMAIL" && !email) {
        email = valor;
      }
    }

    const nomeFinal = (nome || nomeEstruturado).trim();
    if (nomeFinal && telefone) {
      contatos.push({ nome: nomeFinal, telefone, email });
    }
  }

  return contatos;
}

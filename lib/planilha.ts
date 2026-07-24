import type { ContatoImportado } from "./contatos";

// ATENÇÃO: use esta função apenas em código que roda no navegador (client
// component). A biblioteca "xlsx" tem vulnerabilidades conhecidas sem
// correção no caminho de leitura de arquivos (prototype pollution / ReDoS).
// Rodando só no navegador do próprio usuário que sobe o arquivo, o risco
// fica contido na sessão dele e nunca afeta o servidor ou outras contas.
//
// A biblioteca também é carregada sob demanda (import dinâmico), pra não
// pesar o carregamento inicial do app pra quem nunca usa essa função.

function normalizarSimNao(valor: unknown): boolean | null {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = String(valor).trim().toLowerCase();
  if (["sim", "s", "yes", "true", "1"].includes(texto)) return true;
  if (["não", "nao", "n", "no", "false", "0"].includes(texto)) return false;
  return null;
}

function normalizarSexo(valor: unknown): "masculino" | "feminino" | null {
  const texto = String(valor ?? "").trim().toLowerCase();
  if (texto.startsWith("m")) return "masculino";
  if (texto.startsWith("f")) return "feminino";
  return null;
}

function acharColuna(linha: Record<string, unknown>, ...pistas: string[]): unknown {
  const chaves = Object.keys(linha);
  for (const pista of pistas) {
    const chave = chaves.find((k) => k.toLowerCase().includes(pista));
    if (chave) return linha[chave];
  }
  return "";
}

export async function extrairContatosPlanilha(buffer: ArrayBuffer): Promise<ContatoImportado[]> {
  const XLSX = await import("xlsx");
  const livro = XLSX.read(buffer, { type: "array" });
  const primeiraAba = livro.SheetNames[0];
  if (!primeiraAba) return [];
  const planilha = livro.Sheets[primeiraAba];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, { defval: "" });

  const contatos: ContatoImportado[] = [];
  for (const linha of linhas) {
    const nome = String(acharColuna(linha, "nome") || "").trim();
    const telefone = String(acharColuna(linha, "telefone", "whatsapp", "celular") || "").trim();
    if (!nome || !telefone) continue;

    const dia = Number(acharColuna(linha, "dia"));
    const mes = Number(acharColuna(linha, "mes", "mês"));

    contatos.push({
      nome,
      telefone,
      email: String(acharColuna(linha, "email", "e-mail") || "").trim(),
      origem: String(acharColuna(linha, "origem") || "").trim() || undefined,
      sexo: normalizarSexo(acharColuna(linha, "sexo")),
      emRelacionamento: normalizarSimNao(acharColuna(linha, "relacionamento")),
      temFilhos: normalizarSimNao(acharColuna(linha, "filho")),
      aniversarioDia: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
      aniversarioMes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : null,
    });
  }

  return contatos;
}

// Leitura de itens de uma nota fiscal (DANFE) em PDF, direto no navegador.
// Não depende de servidor: usa pdfjs-dist pra extrair o texto do PDF e um
// interpretador calibrado pro layout de nota da Ozonteck (código, descrição,
// NCM, CST, CFOP, UN, quantidade, preço unitário, preço total).

export type ItemNotaFiscal = {
  codigo: string;
  descricao: string;
  quantidade: number;
};

type ItemPosicionado = { texto: string; x: number; y: number };

function parseNumeroBr(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

// Junta os fragmentos de texto do PDF em linhas, agrupando por proximidade
// vertical (o pdf.js devolve os textos soltos, fora de ordem de leitura).
function montarLinhas(itens: ItemPosicionado[]): string[] {
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: ItemPosicionado[][] = [];

  for (const item of ordenados) {
    const linha = linhas.find((l) => Math.abs(l[0].y - item.y) < 3);
    if (linha) {
      linha.push(item);
    } else {
      linhas.push([item]);
    }
  }

  return linhas.map((linha) =>
    linha
      .sort((a, b) => a.x - b.x)
      .map((i) => i.texto)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Linha de item da nota, ex:
// "40713 SOUL 17 ML 33030020 000 5.102 UN 13,0000 15,0000 195,00 195,00 33,15 0,00 17,0000 0,00"
const REGEX_ITEM =
  /^(\d{4,6})\s+(.+?)\s+(\d{7,8})\s+(\d{3})\s+([\d.]{4,6})\s+UN\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/;

export async function extrairItensNotaFiscal(file: File): Promise<ItemNotaFiscal[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const itensEncontrados: ItemNotaFiscal[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();

    const posicionados: ItemPosicionado[] = conteudo.items
      .filter((i: any) => typeof i.str === "string" && i.str.trim())
      .map((i: any) => ({
        texto: i.str.trim(),
        x: i.transform[4],
        y: i.transform[5],
      }));

    const linhas = montarLinhas(posicionados);

    for (const linha of linhas) {
      const m = linha.match(REGEX_ITEM);
      if (!m) continue;
      const [, codigo, descricao, , , , qtdeStr] = m;
      itensEncontrados.push({
        codigo,
        descricao: descricao.trim(),
        quantidade: parseNumeroBr(qtdeStr),
      });
    }
  }

  return itensEncontrados;
}

function normalizar(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Casa os itens extraídos da nota com o catálogo do usuário pelo nome.
export function casarComCatalogo<T extends { id: string; nome: string }>(
  itens: ItemNotaFiscal[],
  produtos: T[]
): { casados: { produto: T; quantidade: number }[]; naoEncontrados: ItemNotaFiscal[] } {
  const casados: { produto: T; quantidade: number }[] = [];
  const naoEncontrados: ItemNotaFiscal[] = [];

  for (const item of itens) {
    const alvo = normalizar(item.descricao);
    const produto = produtos.find((p) => normalizar(p.nome) === alvo);
    if (produto) {
      const existente = casados.find((c) => c.produto.id === produto.id);
      if (existente) {
        existente.quantidade += item.quantidade;
      } else {
        casados.push({ produto, quantidade: item.quantidade });
      }
    } else {
      naoEncontrados.push(item);
    }
  }

  return { casados, naoEncontrados };
}

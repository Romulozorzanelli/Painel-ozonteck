import { createClient } from "./supabase/client";
import { SEED_PRODUCTS } from "./seed-products";

export type Produto = {
  id: string;
  nome: string;
  familiaOlfativa: string;
  descricaoCurta: string;
  imagem: string | null;
  custo: number;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  ativo: boolean;
  categoria: string;
};

// Categorias fixas usadas pra classificar o catálogo (campo produtos.categoria)
// e pra seleção de quais linhas aparecem no Catálogo público de cada revendedor.
export const CATEGORIAS_CATALOGO: { valor: string; label: string }[] = [
  { valor: "perfumaria_17ml", label: "Perfumaria 17ml" },
  { valor: "perfumaria_100ml", label: "Perfumaria 100ml" },
  { valor: "linha_capilar", label: "Linha Capilar" },
  { valor: "nutraceuticos", label: "Nutracêuticos" },
  { valor: "bem_estar", label: "Bem-estar" },
  { valor: "acessorios", label: "Acessórios" },
  { valor: "combos", label: "Combos" },
];

export type CatalogoConfig = {
  slug: string;
  titulo: string;
  categoriasSelecionadas: string[];
  ativo: boolean;
};

export type ProdutoCatalogoPublico = {
  id: string;
  nome: string;
  imagem: string | null;
  preco: number;
  familiaOlfativa: string;
  descricaoCurta: string;
  disponivel: boolean;
  categoria: string;
  sexo: "masculino" | "feminino" | null;
  vendasTotais: number;
};

export type CatalogoPublico = {
  titulo: string;
  nomeRevendedor: string;
  fotoRevendedor: string | null;
  whatsapp: string;
  produtos: ProdutoCatalogoPublico[];
};

export type Perfil = {
  id: string;
  nome: string;
  whatsapp: string;
  email: string;
  cpf: string;
  foto: string | null;
  graduacao: string;
  metaPontuacao: number;
  metaVenda: number;
  cadastroCompleto: boolean;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  origem: string;
  observacoes: string;
  aniversarioDia: number | null;
  aniversarioMes: number | null;
  proximoFollowup: string | null;
  criadoEm: string;
  boasVindasContatado: boolean;
  sexo: "masculino" | "feminino" | null;
  emRelacionamento: boolean | null;
  temFilhos: boolean | null;
  inatividadeContatadaEm: string | null;
  aniversarioPedido: boolean;
};

export type ItemVenda = {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
};

export type Venda = {
  id: string;
  data: string;
  clienteId: string | null;
  clienteNome: string;
  itens: ItemVenda[];
  total: number;
  formaPagamento: string;
  status: "concluida" | "cancelada";
  tipoVenda: "cliente" | "revendedor";
  posVendaContatado: boolean;
  indicacaoPedida: boolean;
};

export type Lancamento = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  vendaId?: string | null;
};

/* ---------------------------- Mapeamento de linhas ---------------------------- */

function produtoFromRow(row: any): Produto {
  return {
    id: row.id,
    nome: row.nome,
    familiaOlfativa: row.familia_olfativa,
    descricaoCurta: row.descricao_curta,
    imagem: row.imagem,
    custo: Number(row.custo),
    preco: Number(row.preco),
    estoque: row.estoque,
    estoqueMinimo: row.estoque_minimo,
    ativo: row.ativo,
    categoria: row.categoria ?? "",
  };
}

function clienteFromRow(row: any): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    origem: row.origem,
    observacoes: row.observacoes,
    aniversarioDia: row.aniversario_dia,
    aniversarioMes: row.aniversario_mes,
    proximoFollowup: row.proximo_followup,
    criadoEm: row.criado_em,
    boasVindasContatado: row.boas_vindas_contatado ?? false,
    sexo: row.sexo ?? null,
    emRelacionamento: row.em_relacionamento ?? null,
    temFilhos: row.tem_filhos ?? null,
    inatividadeContatadaEm: row.inatividade_contatada_em ?? null,
    aniversarioPedido: row.aniversario_pedido ?? false,
  };
}

function vendaFromRow(row: any): Venda {
  return {
    id: row.id,
    data: row.data,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    total: Number(row.total),
    formaPagamento: row.forma_pagamento,
    status: row.status,
    tipoVenda: row.tipo_venda ?? "cliente",
    posVendaContatado: row.pos_venda_contatado ?? false,
    indicacaoPedida: row.indicacao_pedida ?? false,
    itens: (row.venda_itens ?? []).map((i: any) => ({
      produtoId: i.produto_id,
      nome: i.nome,
      quantidade: i.quantidade,
      precoUnitario: Number(i.preco_unitario),
    })),
  };
}

function lancamentoFromRow(row: any): Lancamento {
  return {
    id: row.id,
    data: row.data,
    tipo: row.tipo,
    categoria: row.categoria,
    descricao: row.descricao,
    valor: Number(row.valor),
    vendaId: row.venda_id,
  };
}

/* ---------------------------- Produtos ---------------------------- */

async function seedProdutosIniciais() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const rows = SEED_PRODUCTS.map((p) => ({
    id: p.slug,
    owner_id: user.id,
    nome: p.nome,
    familia_olfativa: p.familiaOlfativa,
    descricao_curta: p.descricaoCurta,
    imagem: p.imagem,
    custo: p.custo,
    preco: p.preco,
    estoque: p.estoqueInicial,
    estoque_minimo: 3,
    ativo: true,
  }));

  await supabase.from("produtos").upsert(rows, { onConflict: "id,owner_id" });
}

export async function getProdutos(): Promise<Produto[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;

  if (!data || data.length === 0) {
    await seedProdutosIniciais();
    const { data: seeded } = await supabase
      .from("produtos")
      .select("*")
      .order("nome", { ascending: true });
    return (seeded ?? []).map(produtoFromRow);
  }

  return data.map(produtoFromRow);
}

// Ranking global de produtos mais vendidos (agregado de todas as contas,
// via função no banco que só devolve produto + total — nunca dados
// individuais de venda). Retorna um mapa produto_id -> unidades vendidas.
export async function getRankingProdutos(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ranking_produtos_vendidos");
  if (error) throw error;

  const ranking: Record<string, number> = {};
  for (const row of data ?? []) {
    ranking[row.produto_id] = Number(row.total_vendido);
  }
  return ranking;
}

// Só permite editar produtos que já existem no catálogo — o cadastro de
// produtos novos foi desativado.
export async function upsertProduto(produto: Produto): Promise<Produto[]> {
  const supabase = createClient();
  const { data: existente } = await supabase
    .from("produtos")
    .select("id")
    .eq("id", produto.id)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("produtos")
      .update({
        nome: produto.nome,
        familia_olfativa: produto.familiaOlfativa,
        descricao_curta: produto.descricaoCurta,
        imagem: produto.imagem,
        custo: produto.custo,
        preco: produto.preco,
        estoque: produto.estoque,
        estoque_minimo: produto.estoqueMinimo,
        ativo: produto.ativo,
      })
      .eq("id", produto.id);
  }

  return getProdutos();
}

export async function removeProduto(id: string): Promise<Produto[]> {
  const supabase = createClient();
  await supabase.from("produtos").delete().eq("id", id);
  return getProdutos();
}

export async function ajustarEstoque(id: string, delta: number): Promise<Produto[]> {
  const supabase = createClient();
  const { data } = await supabase.from("produtos").select("estoque").eq("id", id).single();
  if (data) {
    const novoEstoque = Math.max(0, data.estoque + delta);
    await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", id);
  }
  return getProdutos();
}

/* ---------------------------- Clientes ---------------------------- */

export async function getClientes(): Promise<Cliente[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(clienteFromRow);
}

// Normaliza telefone pro formato +DDI DDD numero, so digitos alem do "+"
// (ex: "+5527998834350"). Aceita qualquer formatacao de entrada (com
// parenteses, espaco, traco) e adiciona o DDI 55 se nao tiver.
export function normalizarTelefone(input: string): string {
  const digitos = (input || "").replace(/\D/g, "");
  if (!digitos) return "";
  const comDDI = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `+${comDDI}`;
}

export async function upsertCliente(cliente: Cliente): Promise<Cliente[]> {
  const supabase = createClient();
  const telefone = normalizarTelefone(cliente.telefone);

  if (cliente.id) {
    await supabase
      .from("clientes")
      .update({
        nome: cliente.nome,
        telefone,
        email: cliente.email,
        origem: cliente.origem,
        observacoes: cliente.observacoes,
        aniversario_dia: cliente.aniversarioDia,
        aniversario_mes: cliente.aniversarioMes,
        proximo_followup: cliente.proximoFollowup || null,
        sexo: cliente.sexo,
        em_relacionamento: cliente.emRelacionamento,
        tem_filhos: cliente.temFilhos,
      })
      .eq("id", cliente.id);
  } else {
    // Cliente novo: sem id ainda, deixa o banco gerar (default gen_random_uuid()).
    await supabase.from("clientes").insert({
      nome: cliente.nome,
      telefone,
      email: cliente.email,
      origem: cliente.origem,
      observacoes: cliente.observacoes,
      aniversario_dia: cliente.aniversarioDia,
      aniversario_mes: cliente.aniversarioMes,
      proximo_followup: cliente.proximoFollowup || null,
      sexo: cliente.sexo,
      em_relacionamento: cliente.emRelacionamento,
      tem_filhos: cliente.temFilhos,
    });
  }

  return getClientes();
}

export async function removeCliente(id: string): Promise<Cliente[]> {
  const supabase = createClient();
  await supabase.from("clientes").delete().eq("id", id);
  return getClientes();
}

// Importacao em massa (vinda de .vcf). Pula quem ja tem telefone cadastrado,
// pra nao duplicar. owner_id e preenchido sozinho pelo default da coluna
// (auth.uid()), nao precisa setar aqui.
export async function importarClientes(
  contatos: {
    nome: string;
    telefone: string;
    email: string;
    origem?: string;
    sexo?: "masculino" | "feminino" | null;
    emRelacionamento?: boolean | null;
    temFilhos?: boolean | null;
    aniversarioDia?: number | null;
    aniversarioMes?: number | null;
  }[]
): Promise<{ importados: number; clientes: Cliente[] }> {
  const supabase = createClient();
  const existentes = await getClientes();
  const telefonesExistentes = new Set(
    existentes.map((c) => normalizarTelefone(c.telefone)).filter(Boolean)
  );

  const vistosNesseLote = new Set<string>();
  const linhas: {
    nome: string;
    telefone: string;
    email: string;
    origem: string;
    sexo: "masculino" | "feminino" | null;
    em_relacionamento: boolean | null;
    tem_filhos: boolean | null;
    aniversario_dia: number | null;
    aniversario_mes: number | null;
  }[] = [];

  for (const c of contatos) {
    const telefone = normalizarTelefone(c.telefone);
    if (!telefone || telefonesExistentes.has(telefone) || vistosNesseLote.has(telefone)) {
      continue;
    }
    vistosNesseLote.add(telefone);
    linhas.push({
      nome: c.nome,
      telefone,
      email: c.email || "",
      origem: c.origem || "Importado dos contatos",
      sexo: c.sexo ?? null,
      em_relacionamento: c.emRelacionamento ?? null,
      tem_filhos: c.temFilhos ?? null,
      aniversario_dia: c.aniversarioDia ?? null,
      aniversario_mes: c.aniversarioMes ?? null,
    });
  }

  if (linhas.length > 0) {
    await supabase.from("clientes").insert(linhas);
  }

  return { importados: linhas.length, clientes: await getClientes() };
}

/* ---------------------------- Vendas ---------------------------- */

export async function getVendas(): Promise<Venda[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendas")
    .select("*, venda_itens(*)")
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(vendaFromRow);
}

export async function registrarVenda(input: {
  clienteId: string | null;
  clienteNome: string;
  itens: ItemVenda[];
  formaPagamento: string;
  tipoVenda: "cliente" | "revendedor";
}) {
  const supabase = createClient();
  const total = input.itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0);

  const { data: venda, error } = await supabase
    .from("vendas")
    .insert({
      cliente_id: input.clienteId,
      cliente_nome: input.clienteNome || "Cliente avulso",
      total,
      forma_pagamento: input.formaPagamento,
      status: "concluida",
      tipo_venda: input.tipoVenda,
    })
    .select("id")
    .single();

  if (error || !venda) throw error;

  await supabase.from("venda_itens").insert(
    input.itens.map((i) => ({
      venda_id: venda.id,
      produto_id: i.produtoId,
      nome: i.nome,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    }))
  );

  for (const item of input.itens) {
    await ajustarEstoque(item.produtoId, -item.quantidade);
  }

  // "A receber" ainda não é dinheiro em caixa — só lança a entrada quando
  // for efetivamente recebido (via receberVenda).
  if (input.formaPagamento !== "A receber") {
    await addLancamento({
      tipo: "entrada",
      categoria: "Venda",
      descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
      valor: total,
      vendaId: venda.id,
    });
  }
}

export async function atualizarVenda(
  vendaId: string,
  input: {
    clienteId: string | null;
    clienteNome: string;
    itens: ItemVenda[];
    formaPagamento: string;
    tipoVenda: "cliente" | "revendedor";
  }
) {
  const supabase = createClient();

  const { data: vendaAtual } = await supabase
    .from("vendas")
    .select("status")
    .eq("id", vendaId)
    .single();
  const eraCancelada = vendaAtual?.status === "cancelada";

  // Só devolve ao estoque os itens antigos se a venda estava ativa — se já
  // estava cancelada, esses itens já tinham sido devolvidos no cancelamento.
  if (!eraCancelada) {
    const { data: itensAntigos } = await supabase
      .from("venda_itens")
      .select("*")
      .eq("venda_id", vendaId);

    for (const item of itensAntigos ?? []) {
      await ajustarEstoque(item.produto_id, item.quantidade);
    }
  }

  await supabase.from("venda_itens").delete().eq("venda_id", vendaId);

  const total = input.itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0);

  await supabase
    .from("vendas")
    .update({
      cliente_id: input.clienteId,
      cliente_nome: input.clienteNome || "Cliente avulso",
      total,
      forma_pagamento: input.formaPagamento,
      status: "concluida",
      tipo_venda: input.tipoVenda,
    })
    .eq("id", vendaId);

  await supabase.from("venda_itens").insert(
    input.itens.map((i) => ({
      venda_id: vendaId,
      produto_id: i.produtoId,
      nome: i.nome,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    }))
  );

  for (const item of input.itens) {
    await ajustarEstoque(item.produtoId, -item.quantidade);
  }

  if (eraCancelada) {
    // Editar uma venda cancelada a reativa: remove o estorno gerado no
    // cancelamento e lança a entrada novamente com o valor atualizado
    // (a menos que a nova forma de pagamento seja "A receber").
    await supabase
      .from("lancamentos")
      .delete()
      .eq("venda_id", vendaId)
      .eq("categoria", "Estorno");

    if (input.formaPagamento !== "A receber") {
      await addLancamento({
        tipo: "entrada",
        categoria: "Venda",
        descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
        valor: total,
        vendaId,
      });
    }
  } else {
    const { data: lancamento } = await supabase
      .from("lancamentos")
      .select("id")
      .eq("venda_id", vendaId)
      .eq("tipo", "entrada")
      .maybeSingle();

    if (input.formaPagamento === "A receber") {
      // Virou "A receber": remove a entrada que já tinha sido lançada.
      if (lancamento) {
        await supabase.from("lancamentos").delete().eq("id", lancamento.id);
      }
    } else if (lancamento) {
      await supabase
        .from("lancamentos")
        .update({
          valor: total,
          descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
        })
        .eq("id", lancamento.id);
    } else {
      // Antes era "A receber" (sem entrada lançada) e agora tem forma de
      // pagamento real: lança a entrada pela primeira vez.
      await addLancamento({
        tipo: "entrada",
        categoria: "Venda",
        descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
        valor: total,
        vendaId,
      });
    }
  }
}

// Reativa uma venda cancelada sem alterar itens: volta o status para
// concluída, desconta o estoque de novo e remove o lançamento de estorno.
export async function reativarVenda(id: string) {
  const supabase = createClient();
  const { data: venda } = await supabase
    .from("vendas")
    .select("*, venda_itens(*)")
    .eq("id", id)
    .single();

  if (venda && venda.status === "cancelada") {
    await supabase.from("vendas").update({ status: "concluida" }).eq("id", id);

    for (const item of venda.venda_itens ?? []) {
      await ajustarEstoque(item.produto_id, -item.quantidade);
    }

    await supabase
      .from("lancamentos")
      .delete()
      .eq("venda_id", id)
      .eq("categoria", "Estorno");
  }
}

export async function cancelarVenda(id: string) {
  const supabase = createClient();
  const { data: venda } = await supabase
    .from("vendas")
    .select("*, venda_itens(*)")
    .eq("id", id)
    .single();

  if (venda && venda.status !== "cancelada") {
    await supabase.from("vendas").update({ status: "cancelada" }).eq("id", id);

    for (const item of venda.venda_itens ?? []) {
      await ajustarEstoque(item.produto_id, item.quantidade);
    }

    // Só estorna se realmente tinha entrada lançada (não era "A receber").
    if (venda.forma_pagamento !== "A receber") {
      await addLancamento({
        tipo: "saida",
        categoria: "Estorno",
        descricao: `Cancelamento da venda de ${venda.cliente_nome || "cliente avulso"}`,
        valor: Number(venda.total),
        vendaId: venda.id,
      });
    }
  }
}

export async function receberVenda(id: string, formaPagamento: string): Promise<Venda[]> {
  const supabase = createClient();
  const { data: venda } = await supabase.from("vendas").select("*").eq("id", id).single();

  if (venda && venda.forma_pagamento === "A receber") {
    await supabase.from("vendas").update({ forma_pagamento: formaPagamento }).eq("id", id);

    await addLancamento({
      tipo: "entrada",
      categoria: "Venda",
      descricao: `Venda para ${venda.cliente_nome || "cliente avulso"}`,
      valor: Number(venda.total),
      vendaId: id,
    });
  }

  return getVendas();
}

export async function excluirVenda(id: string): Promise<Venda[]> {
  const supabase = createClient();
  // Remove os lancamentos financeiros ligados a essa venda (entrada + estorno),
  // pra nao deixar registro orfao no Financeiro. venda_itens sai junto via cascade.
  await supabase.from("lancamentos").delete().eq("venda_id", id);
  await supabase.from("vendas").delete().eq("id", id);
  return getVendas();
}

export async function marcarPosVendaContatado(id: string): Promise<Venda[]> {
  const supabase = createClient();
  await supabase.from("vendas").update({ pos_venda_contatado: true }).eq("id", id);
  return getVendas();
}

export async function marcarIndicacaoPedida(id: string): Promise<Venda[]> {
  const supabase = createClient();
  await supabase.from("vendas").update({ indicacao_pedida: true }).eq("id", id);
  return getVendas();
}

export async function limparFollowupCliente(id: string): Promise<Cliente[]> {
  const supabase = createClient();
  await supabase.from("clientes").update({ proximo_followup: null }).eq("id", id);
  return getClientes();
}

export async function marcarInatividadeContatada(id: string): Promise<Cliente[]> {
  const supabase = createClient();
  await supabase
    .from("clientes")
    .update({ inatividade_contatada_em: new Date().toISOString() })
    .eq("id", id);
  return getClientes();
}

export async function marcarAniversarioPedido(id: string): Promise<Cliente[]> {
  const supabase = createClient();
  await supabase.from("clientes").update({ aniversario_pedido: true }).eq("id", id);
  return getClientes();
}

/* ---------------------------- Templates de mensagem ---------------------------- */

export async function getTemplates(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("templates_mensagem").select("tipo, texto");
  if (error) throw error;
  const mapa: Record<string, string> = {};
  for (const row of data ?? []) mapa[row.tipo] = row.texto;
  return mapa;
}

export async function salvarTemplate(tipo: string, texto: string): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("Usuário não autenticado.");
  await supabase
    .from("templates_mensagem")
    .upsert({ owner_id: ownerId, tipo, texto, atualizado_em: new Date().toISOString() }, {
      onConflict: "owner_id,tipo",
    });
}

export async function restaurarTemplatePadrao(tipo: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("templates_mensagem").delete().eq("tipo", tipo);
}

export async function marcarBoasVindasContatado(id: string): Promise<Cliente[]> {
  const supabase = createClient();
  await supabase.from("clientes").update({ boas_vindas_contatado: true }).eq("id", id);
  return getClientes();
}

/* ---------------------------- Financeiro ---------------------------- */

export async function getFinanceiro(): Promise<Lancamento[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(lancamentoFromRow);
}

export async function addLancamento(l: {
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  vendaId?: string | null;
}): Promise<Lancamento[]> {
  const supabase = createClient();
  await supabase.from("lancamentos").insert({
    tipo: l.tipo,
    categoria: l.categoria,
    descricao: l.descricao,
    valor: l.valor,
    venda_id: l.vendaId ?? null,
  });
  return getFinanceiro();
}

export async function removerLancamento(id: string): Promise<Lancamento[]> {
  const supabase = createClient();
  await supabase.from("lancamentos").delete().eq("id", id);
  return getFinanceiro();
}

/* ---------------------------- Perfil (cadastro) ---------------------------- */

function perfilFromRow(row: any): Perfil {
  return {
    id: row.id,
    nome: row.nome ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    cpf: row.cpf ?? "",
    foto: row.foto ?? null,
    graduacao: row.graduacao ?? "",
    metaPontuacao: Number(row.meta_pontuacao ?? 0),
    metaVenda: Number(row.meta_venda ?? 0),
    cadastroCompleto: !!row.cadastro_completo,
  };
}

export function validarCpf(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  function calcDigito(base: string, pesoInicial: number) {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  const d1 = calcDigito(cpf.slice(0, 9), 10);
  const d2 = calcDigito(cpf.slice(0, 9) + d1, 11);
  return cpf === cpf.slice(0, 9) + d1 + d2;
}

export async function getPerfil(): Promise<Perfil | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    // Usuário novo: ainda não existe linha em perfis, cadastro pendente.
    return {
      id: user.id,
      nome: (user.user_metadata?.full_name || user.user_metadata?.name || "") as string,
      whatsapp: "",
      email: user.email ?? "",
      cpf: "",
      foto: null,
      graduacao: "",
      metaPontuacao: 0,
      metaVenda: 0,
      cadastroCompleto: false,
    };
  }
  return perfilFromRow(data);
}

export async function completarCadastro(dados: {
  nome: string;
  whatsapp: string;
  email: string;
  cpf: string;
}): Promise<Perfil> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("perfis")
    .upsert({
      id: user.id,
      nome: dados.nome,
      whatsapp: normalizarTelefone(dados.whatsapp),
      email: dados.email,
      cpf: dados.cpf.replace(/\D/g, ""),
      cadastro_completo: true,
    })
    .select()
    .single();

  if (error) throw error;
  return perfilFromRow(data);
}

export async function atualizarPerfil(dados: {
  nome: string;
  whatsapp: string;
  email: string;
  cpf: string;
  foto: string | null;
  graduacao: string;
  metaPontuacao: number;
  metaVenda: number;
}): Promise<Perfil> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("perfis")
    .upsert({
      id: user.id,
      nome: dados.nome,
      whatsapp: normalizarTelefone(dados.whatsapp),
      email: dados.email,
      cpf: dados.cpf.replace(/\D/g, ""),
      foto: dados.foto,
      graduacao: dados.graduacao,
      meta_pontuacao: dados.metaPontuacao,
      meta_venda: dados.metaVenda,
      cadastro_completo: true,
    })
    .select()
    .single();

  if (error) throw error;
  return perfilFromRow(data);
}

export async function uploadFotoPerfil(blob: Blob): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  // Sempre exportado como JPEG pelo recorte no navegador (canvas).
  const caminho = `${user.id}/foto-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("perfil-fotos")
    .upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("perfil-fotos").getPublicUrl(caminho);
  return data.publicUrl;
}

/* ---------------------------- Materiais de apoio ---------------------------- */

export type MaterialApoio = {
  id: string;
  titulo: string;
  categoria: "catalogo_mes" | "apresentacao_negocio" | "imagens_linha" | "outros";
  arquivoUrl: string;
  arquivoNome: string;
  tipoArquivo: string;
  descricao: string;
  tamanhoBytes: number | null;
  criadoEm: string;
};

function materialApoioFromRow(row: any): MaterialApoio {
  return {
    id: row.id,
    titulo: row.titulo,
    categoria: row.categoria,
    arquivoUrl: row.arquivo_url,
    arquivoNome: row.arquivo_nome,
    tipoArquivo: row.tipo_arquivo,
    descricao: row.descricao ?? "",
    tamanhoBytes: row.tamanho_bytes ?? null,
    criadoEm: row.criado_em,
  };
}

export async function getMateriaisApoio(): Promise<MaterialApoio[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("materiais_apoio")
    .select("*")
    .order("categoria", { ascending: true })
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(materialApoioFromRow);
}

/* ---------------------------- Catálogo (config do revendedor) ---------------------------- */

function catalogoConfigFromRow(row: any): CatalogoConfig {
  return {
    slug: row.slug,
    titulo: row.titulo ?? "",
    categoriasSelecionadas: row.categorias_selecionadas ?? [],
    ativo: !!row.ativo,
  };
}

export async function getCatalogoConfig(): Promise<CatalogoConfig | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("catalogo_config")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ? catalogoConfigFromRow(data) : null;
}

// Checa disponibilidade de slug via função do banco (não vaza nenhum outro
// dado, só true/false). slugAtual evita falso "ocupado" quando o revendedor
// salva de novo sem mudar o próprio link.
export async function verificarSlugDisponivel(
  slug: string,
  slugAtual?: string
): Promise<boolean> {
  if (slugAtual && slug === slugAtual) return true;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("catalogo_slug_disponivel", {
    p_slug: slug,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function salvarCatalogoConfig(dados: {
  slug: string;
  titulo: string;
  categoriasSelecionadas: string[];
  ativo: boolean;
}): Promise<CatalogoConfig> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("catalogo_config")
    .upsert(
      {
        owner_id: user.id,
        slug: dados.slug,
        titulo: dados.titulo,
        categorias_selecionadas: dados.categoriasSelecionadas,
        ativo: dados.ativo,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return catalogoConfigFromRow(data);
}

/* ---------------------------- Catálogo público (rota sem login) ---------------------------- */

// Chama a função catalogo_publico(slug) no banco (SECURITY DEFINER), que
// já devolve só os campos seguros pra exibição pública — nunca custo, nunca
// estoque exato, só disponível/indisponível. Não depende de nenhuma
// política de leitura anônima nas tabelas reais.
export async function getCatalogoPublico(slug: string): Promise<CatalogoPublico | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("catalogo_publico", { p_slug: slug });
  if (error) throw error;
  if (!data) return null;

  return {
    titulo: data.titulo ?? "",
    nomeRevendedor: data.nome_revendedor ?? "",
    fotoRevendedor: data.foto_revendedor ?? null,
    whatsapp: data.whatsapp ?? "",
    produtos: (data.produtos ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      imagem: p.imagem,
      preco: Number(p.preco),
      familiaOlfativa: p.familia_olfativa,
      descricaoCurta: p.descricao_curta,
      disponivel: !!p.disponivel,
      categoria: p.categoria,
      sexo: p.sexo === "masculino" || p.sexo === "feminino" ? p.sexo : null,
      vendasTotais: Number(p.vendas_totais ?? 0),
    })),
  };
}

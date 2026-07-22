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
  criadoEm: string;
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
    criadoEm: row.criado_em,
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

  await supabase.from("produtos").upsert(rows, { onConflict: "id" });
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

export async function upsertCliente(cliente: Cliente): Promise<Cliente[]> {
  const supabase = createClient();
  const { data: existente } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", cliente.id)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("clientes")
      .update({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        origem: cliente.origem,
        observacoes: cliente.observacoes,
      })
      .eq("id", cliente.id);
  } else {
    await supabase.from("clientes").insert({
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email,
      origem: cliente.origem,
      observacoes: cliente.observacoes,
    });
  }

  return getClientes();
}

export async function removeCliente(id: string): Promise<Cliente[]> {
  const supabase = createClient();
  await supabase.from("clientes").delete().eq("id", id);
  return getClientes();
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

  await addLancamento({
    tipo: "entrada",
    categoria: "Venda",
    descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
    valor: total,
    vendaId: venda.id,
  });
}

export async function atualizarVenda(
  vendaId: string,
  input: {
    clienteId: string | null;
    clienteNome: string;
    itens: ItemVenda[];
    formaPagamento: string;
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
    // cancelamento e lança a entrada novamente com o valor atualizado.
    await supabase
      .from("lancamentos")
      .delete()
      .eq("venda_id", vendaId)
      .eq("categoria", "Estorno");

    await addLancamento({
      tipo: "entrada",
      categoria: "Venda",
      descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
      valor: total,
      vendaId,
    });
  } else {
    const { data: lancamento } = await supabase
      .from("lancamentos")
      .select("id")
      .eq("venda_id", vendaId)
      .eq("tipo", "entrada")
      .maybeSingle();

    if (lancamento) {
      await supabase
        .from("lancamentos")
        .update({
          valor: total,
          descricao: `Venda para ${input.clienteNome || "cliente avulso"}`,
        })
        .eq("id", lancamento.id);
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

    await addLancamento({
      tipo: "saida",
      categoria: "Estorno",
      descricao: `Cancelamento da venda de ${venda.cliente_nome || "cliente avulso"}`,
      valor: Number(venda.total),
      vendaId: venda.id,
    });
  }
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
      whatsapp: dados.whatsapp,
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
      whatsapp: dados.whatsapp,
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

export async function uploadFotoPerfil(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const extensao = file.name.split(".").pop() || "jpg";
  const caminho = `${user.id}/foto-${Date.now()}.${extensao}`;

  const { error } = await supabase.storage
    .from("perfil-fotos")
    .upload(caminho, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("perfil-fotos").getPublicUrl(caminho);
  return data.publicUrl;
}

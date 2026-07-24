import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extrairContatosVCard } from "@/lib/contatos";
import { normalizarTelefone } from "@/lib/store";

// Recebe o POST disparado quando o usuario compartilha um .vcf direto pro
// app instalado no Android (Web Share Target, registrado no manifest.json).
// Nao existe telefone/nota-fiscal em iOS pra essa rota, mas ela nao faz
// nenhum mal ser chamada la tambem (so nao ha como o Safari disparar isso).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  try {
    const formData = await request.formData();
    const arquivo = formData.get("contatos");

    if (!(arquivo instanceof File)) {
      return NextResponse.redirect(
        new URL("/painel?aba=clientes&importar_erro=1", request.url),
        303
      );
    }

    const texto = await arquivo.text();
    const contatos = extrairContatosVCard(texto);

    const { data: existentesData } = await supabase.from("clientes").select("telefone");
    const existentes = new Set(
      (existentesData ?? []).map((c: { telefone: string }) => normalizarTelefone(c.telefone))
    );

    const vistos = new Set<string>();
    const linhas: { nome: string; telefone: string; email: string; origem: string }[] = [];
    for (const c of contatos) {
      const telefone = normalizarTelefone(c.telefone);
      if (!telefone || existentes.has(telefone) || vistos.has(telefone)) continue;
      vistos.add(telefone);
      linhas.push({
        nome: c.nome,
        telefone,
        email: c.email || "",
        origem: "Compartilhado (Android)",
      });
    }

    if (linhas.length > 0) {
      await supabase.from("clientes").insert(linhas);
    }

    return NextResponse.redirect(
      new URL(`/painel?aba=clientes&importados=${linhas.length}`, request.url),
      303
    );
  } catch {
    return NextResponse.redirect(
      new URL("/painel?aba=clientes&importar_erro=1", request.url),
      303
    );
  }
}

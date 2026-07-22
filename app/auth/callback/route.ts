import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/painel";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Usa URL absoluta para garantir redirecionamento correto
      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl.toString());
    }
    console.error("[v0] Erro ao trocar código OAuth:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?erro=auth`);
}

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/painel";

  if (code) {
    // Monta a resposta de redirecionamento antes de criar o cliente,
    // para que os cookies da sessão sejam gravados diretamente nela.
    const redirectUrl = new URL(next, origin);
    const response = NextResponse.redirect(redirectUrl.toString());

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        // Usa o parser nativo do NextRequest (o mesmo que o middleware já
        // usa) em vez de fazer parsing manual do header "cookie" — o parser
        // manual não lida corretamente com todos os casos (cookies
        // fatiados, valores com caracteres especiais), causando falhas
        // intermitentes de "code verifier" e "state" no login.
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: any;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=auth`);
}

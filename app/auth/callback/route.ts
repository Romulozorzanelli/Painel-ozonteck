import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/painel";

  if (code) {
    const redirectUrl = new URL(next, origin);
    const redirectTarget = redirectUrl.pathname + redirectUrl.search;

    // Em vez de um redirect HTTP puro, devolve um documento HTML mínimo que
    // faz o redirecionamento via JavaScript. Isso evita um bug conhecido de
    // alguns navegadores mobile (Chrome/Safari): ao chegar numa página
    // através de uma cadeia de redirecionamentos vinda de um domínio
    // externo (Google), o navegador às vezes ignora a meta tag de viewport
    // da página de destino e trava em "modo desktop" (sem trava de zoom,
    // layout largo). Forçar uma navegação via JS a partir de um documento
    // próprio, same-origin, resolve isso de forma confiável.
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<title>Entrando...</title>
</head>
<body style="background:#060a17;margin:0;">
<script>window.location.replace(${JSON.stringify(redirectTarget)});</script>
</body>
</html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

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

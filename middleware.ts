import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Deixa o callback do OAuth passar sem nenhuma interferência
  if (path.startsWith("/auth")) {
    return NextResponse.next({ request });
  }

  // Catálogo público: vitrine sem login, cada revendedor compartilha o
  // próprio link (/catalogo/[slug]).
  if (path.startsWith("/catalogo")) {
    return NextResponse.next({ request });
  }

  // Materiais de apoio: arquivos estáticos (pdf, imagens), baixados de
  // dentro do app já autenticado, mas servidos como arquivo público comum.
  if (path.startsWith("/materiais")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
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
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = path.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|api/version|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx)$).*)",
  ],
};

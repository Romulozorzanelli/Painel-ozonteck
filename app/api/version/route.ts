import { NextResponse } from "next/server";

// Sempre executado no servidor a cada request (nunca cacheado em CDN/edge),
// pra que o cliente consiga saber com certeza qual é a versao publicada
// agora, mesmo que a aba dele esteja aberta ha muito tempo com codigo antigo.
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json(
    { sha },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

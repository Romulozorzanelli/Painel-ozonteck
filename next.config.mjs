/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expoe o commit atual (fornecido automaticamente pela Vercel em cada
  // build) pro codigo do cliente, pra comparar com /api/version e detectar
  // quando uma aba aberta esta rodando uma versao antiga do app.
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
  },
};

export default nextConfig;

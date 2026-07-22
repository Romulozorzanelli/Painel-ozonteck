const CACHE_NAME = "ozonteck-static-v1";
const STATIC_ASSETS_REGEX = /\/_next\/static\//;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Estratégia deliberadamente conservadora: só cacheia arquivos estáticos
// imutáveis do Next.js (JS/CSS com hash no nome) e os ícones do PWA.
// Páginas, autenticação e qualquer dado do Supabase (estoque, clientes,
// vendas, financeiro) sempre vão direto pra rede — nunca cacheados —
// pra nunca mostrar informação de negócio desatualizada.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isStaticAsset =
    STATIC_ASSETS_REGEX.test(url.pathname) || url.pathname.startsWith("/icons/");

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});

export type SeedProduct = {
  slug: string;
  nome: string;
  familiaOlfativa: string;
  descricaoCurta: string;
  imagem: string | null;
  custo: number;
  preco: number;
  estoqueInicial: number;
};

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "capadocia",
    nome: "Capadócia",
    familiaOlfativa: "Fougère Aromático",
    descricaoCurta:
      "Fougère aromático clássico, elegância e modernidade — perfumaria masculina.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/e3326db1-820a-4198-c096-ea6d6a634100/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "cinderela",
    nome: "Cinderela",
    familiaOlfativa: "Âmbar Floral",
    descricaoCurta: "Fragrância ousada e sofisticada, ideal para mulheres marcantes.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/b2c68def-5a8b-4b15-3236-a51d0ef03100/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "dg-red",
    nome: "DG Red",
    familiaOlfativa: "Floral Frutado",
    descricaoCurta: "Fragrância floral e sofisticada para mulheres que valorizam elegância.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/cd6b45c5-c2c4-424c-a23c-84a1ed1d3d00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "grecia",
    nome: "Grécia",
    familiaOlfativa: "Âmbar Floral",
    descricaoCurta: "Exala charme e feminilidade com notas elegantes.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/afb09b06-5a1f-4de7-7385-d761427b4d00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "fera",
    nome: "Fera",
    familiaOlfativa: "Âmbar Amadeirado",
    descricaoCurta:
      "Fragrância oriental amadeirada, sensual e provocante, para homens ousados.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/7e85edfb-52b3-443f-c179-0ba1ce95a500/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "maximum",
    nome: "Maximum",
    familiaOlfativa: "Amadeirado Especiado",
    descricaoCurta:
      "Fragrância amadeirada com notas frescas, ideal para homens sofisticados.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/20bea3a4-cc2c-4a3f-6930-0cba3d048d00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "presidente",
    nome: "Presidente",
    familiaOlfativa: "Amadeirado Especiado",
    descricaoCurta: "Fragrância sofisticada amadeirada com toques especiados sedutores.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/66317d03-025b-4ac7-b0d0-939c37848200/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "sentimento",
    nome: "Sentimento",
    familiaOlfativa: "Âmbar Amadeirado",
    descricaoCurta: "Fragrância masculina marcante, com notas amadeiradas intensas.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/f52c103a-769b-4113-83fa-deb0e4664c00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "vip-girl-vip",
    nome: "VIP Girl",
    familiaOlfativa: "Floral Frutal",
    descricaoCurta:
      "Fragrância floral frutada, audaz e elegante, ideal para noites glamorosas.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/3e294876-4deb-4c9a-0f9f-c994ba030400/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "soberano",
    nome: "Soberano",
    familiaOlfativa: "Amadeirado Aquático",
    descricaoCurta: "Aroma amadeirado aquático para homens confiantes e invencíveis.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/dd376491-c91c-4cc5-5b6d-fd0691df3900/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "vg-sexy",
    nome: "VG Sexy",
    familiaOlfativa: "Âmbar Floral",
    descricaoCurta: "Fragrância sedutora e envolvente, exala poder, charme e sensualidade.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/a297710a-47db-40dd-2e69-995d49329200/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "speed-black",
    nome: "Speed Black",
    familiaOlfativa: "Aromático Fougère",
    descricaoCurta: "Fragrância sofisticada e versátil, perfeita para o homem moderno.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/70ea4507-c4b4-4458-729a-cbbf92633400/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "303-vip-men",
    nome: "303 VIP Men",
    familiaOlfativa: "Âmbar Amadeirado",
    descricaoCurta: "Perfume âmbar amadeirado, inspirado na vida noturna de Nova York.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/e4642291-0518-4c2a-f0cc-e6f107f79700/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "max-boss",
    nome: "Max Boss",
    familiaOlfativa: "Âmbar Amadeirado",
    descricaoCurta: "Fragrância luxuosa e sofisticada, aromas ambarados e amadeirados.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/1be0865b-a7f4-43d2-c374-1fcb85568200/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "303-men",
    nome: "303 Men",
    familiaOlfativa: "Amadeirado Aromático",
    descricaoCurta: "Amadeirado aromático, clássico e versátil para o dia a dia.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/928e38dc-a543-498f-8e7f-bd5a7b886200/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "alem",
    nome: "Alem",
    familiaOlfativa: "Âmbar Amadeirado Oriental",
    descricaoCurta: "Perfume oriental amadeirado, com notas de cítricos, jasmim e âmbar.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/699e45f4-696f-4514-7fd7-86ae2a659c00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "fantastica-bry",
    nome: "Fantástica Bry",
    familiaOlfativa: "Floral Frutal Gourmet",
    descricaoCurta: "Perfume doce e envolvente com notas frutadas e gourmand.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/1cbf3706-2cb9-4a48-72ea-050873492400/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "venum",
    nome: "Venum",
    familiaOlfativa: "Amadeirado Aromático",
    descricaoCurta:
      "Fragrância inovadora que eleva autoconfiança, notas amadeiradas e cítricas.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/a9522bf2-e49e-497e-7108-e197c677da00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "vida-bella",
    nome: "Vida Bella",
    familiaOlfativa: "Floral Frutal Gourmand",
    descricaoCurta: "Fragrância floral frutada que celebra a felicidade e a autenticidade.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/4e6db350-fb39-492e-eb1c-0cb85d8fa800/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "seduction",
    nome: "Seduction",
    familiaOlfativa: "Floral Frutada",
    descricaoCurta: "Fragrância floral frutada, luxuosa e irresistivelmente sedutora.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/4be1686b-78c3-4fbe-98e2-10531624f800/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "gouf-blue",
    nome: "Gouf Blue",
    familiaOlfativa: "Aromático Fougère",
    descricaoCurta: "Equilibra frescor e elegância, perfeito para homens livres e vitais.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/5fa8229f-7e61-4ac4-76f8-9cb63349a300/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "303-for-woman",
    nome: "303 For Woman",
    familiaOlfativa: "Floral Amadeirado",
    descricaoCurta: "Floral amadeirado, sofisticado e marcante, para a mulher urbana.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/7112054c-21c7-43e9-d4f8-e2a6564d2200/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "angelical",
    nome: "Angelical",
    familiaOlfativa: "Âmbar Baunilha",
    descricaoCurta: "Fragrância ultrafeminina que equilibra doçura e poder celestial.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/61ee753b-04c0-409b-71eb-529d12f61e00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "blue-sky",
    nome: "Blue Sky",
    familiaOlfativa: "Floral Frutal",
    descricaoCurta: "Leveza de um dia de verão mediterrâneo, frescor e leveza.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/0360eb21-628b-4b3a-1115-47bef4b64200/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "famma",
    nome: "Famma",
    familiaOlfativa: "Chypre Floral Frutado",
    descricaoCurta: "Glamour moderno com notas de manga, jasmim, baunilha e sândalo.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/b7664a9f-8636-41ef-2a95-78294ccbb300/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "gouf-tradicional",
    nome: "Gouf Tradicional",
    familiaOlfativa: "Chipre Amadeirado",
    descricaoCurta: "Combina frescor e profundidade para homens elegantes e livres.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/2cba3d5d-5ebe-42dd-d792-55a4b841ea00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "madame-vi",
    nome: "Madame VI",
    familiaOlfativa: "Âmbar Floral",
    descricaoCurta: "Reflexo olfativo da liberdade, complexa e sofisticada.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/17bb40ce-5847-48d7-3137-58f7cda52d00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "scandaloza",
    nome: "Scandaloza",
    familiaOlfativa: "Oriental Floral",
    descricaoCurta: "Fragrância ousada, vibrante e sedutora com notas cítricas e florais.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/31369baf-6077-4d83-9d29-a997e493df00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "docurinha",
    nome: "Doçurinha",
    familiaOlfativa: "Floral Frutal",
    descricaoCurta:
      "Fragrância doce e vibrante, com notas de morango, mandarina e baunilha.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/b69fbb1f-1bc0-4b50-38be-624fcb208b00/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "aventura",
    nome: "Aventura",
    familiaOlfativa: "Cítrico Aromático",
    descricaoCurta: "Frescor vibrante de limão e abacaxi, com toque aromático final.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/a697e5fa-72cf-41ac-1a74-d8407c50d400/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "soul",
    nome: "Soul",
    familiaOlfativa: "Aromático Fougère",
    descricaoCurta: "Fragrância fougère aromática que une frescor e virilidade.",
    imagem:
      "https://imagedelivery.net/v_9vOoLYYctZBzCMdLIuNQ/52669f43-7826-4c91-fb36-f44311282000/fullhd",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "easy-line",
    nome: "Easy Line",
    familiaOlfativa: "Amadeirado",
    descricaoCurta:
      "Fragrância amadeirada com notas de maçã, gengibre e bergamota, versátil do casual ao formal.",
    imagem: "https://ozon-faos-develop.s3.amazonaws.com/products/943dcf59-e725-4c2b-97ba-aed1b358442a.webp",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "sublime",
    nome: "Sublime",
    familiaOlfativa: "Floral Amadeirado",
    descricaoCurta: "Fragrância sofisticada que une elegância floral e toques amadeirados.",
    imagem: "https://ozon-faos-develop.s3.amazonaws.com/products/e64e50e6-97dd-4817-934b-91f8dd88ff45.webp",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "rhino-royale",
    nome: "Rhino Royale",
    familiaOlfativa: "Amadeirado Especiado",
    descricaoCurta: "Fragrância amadeirada e marcante, para homens que buscam presença e sofisticação.",
    imagem: "https://ozon-faos-develop.s3.amazonaws.com/products/8894a80f-ac84-4c6a-8a53-8722f91e9df9.webp",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
  {
    slug: "laboom",
    nome: "Laboom",
    familiaOlfativa: "Floral Frutal",
    descricaoCurta: "Fragrância floral frutada vibrante e envolvente, cheia de energia.",
    imagem: "https://ozon-faos-develop.s3.amazonaws.com/products/610ec866-b07a-45d9-b41f-f3e109030a8d.webp",
    custo: 15,
    preco: 45,
    estoqueInicial: 0,
  },
];

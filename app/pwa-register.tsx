"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falha silenciosa — o app funciona normalmente sem o service worker,
        // só perde o benefício de cache de assets estáticos.
      });
    }
  }, []);

  return null;
}

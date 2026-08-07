/* Service worker — cache offline do painel.
   Estratégia: network-first para navegação/JS/CSS (sempre pega a versão nova
   quando há internet), com fallback para o cache quando offline. */
"use strict";

const CACHE = "bzn-painel-v3";
const ESSENCIAIS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/util.js",
  "./js/store.js",
  "./js/nuvem.js",
  "./js/anexos.js",
  "./js/csv.js",
  "./js/charts.js",
  "./js/app.js",
  "./js/views/dashboard.js",
  "./js/views/cursos.js",
  "./js/views/turmas.js",
  "./js/views/professores.js",
  "./js/views/alunos.js",
  "./js/views/chamada.js",
  "./js/views/atendimentos.js",
  "./js/views/pacientes.js",
  "./js/views/agenda.js",
  "./js/views/financeiro.js",
  "./js/views/assistencia.js",
  "./js/views/documentacao.js",
  "./js/views/graficos.js",
  "./js/views/relatorios.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys().then(chaves =>
      Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  // deixa passar direto tudo que não é do próprio site (ex.: chamadas à nuvem/Supabase)
  if (new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(req)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});

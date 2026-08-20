/* Sincronização com a nuvem (Supabase).
   Modelo simples e robusto: o banco inteiro do painel é guardado como UMA
   linha (id=1) na tabela "painel", coluna "dados" (jsonb). Cada aparelho
   envia o estado quando algo muda e, por verificação periódica, recebe o que
   os outros salvaram. Estratégia de conflito: o último a salvar prevalece.

   Só faz qualquer coisa se estiver CONFIGURADA (endereço + chave). Sem isso,
   o app continua 100% local, exatamente como antes. */
"use strict";

const Nuvem = (() => {
  const K_URL = "bzn-nuvem-url";
  const K_KEY = "bzn-nuvem-key";
  const INTERVALO = 7000; // verifica a nuvem a cada 7s

  let url = localStorage.getItem(K_URL) || "";
  let key = localStorage.getItem(K_KEY) || "";
  let timerPoll = null;
  let timerEnvio = null;
  let ultimoRemoto = "";   // "atualizado_em" já conhecido (evita reaplicar)
  let enviando = false;
  let ligado = false;

  function configurada() { return !!(url && key); }
  function endereco() { return url; }

  function normalizaUrl(u) {
    return String(u || "").trim().replace(/\/+$/, "");
  }

  function salvarConfig(u, k) {
    url = normalizaUrl(u);
    key = String(k || "").trim();
    localStorage.setItem(K_URL, url);
    localStorage.setItem(K_KEY, key);
  }

  function limparConfig() {
    url = ""; key = "";
    localStorage.removeItem(K_URL);
    localStorage.removeItem(K_KEY);
    pararPolling();
    ligado = false;
  }

  function cabecalhos(extra) {
    return Object.assign({ "apikey": key, "Authorization": "Bearer " + key }, extra || {});
  }

  function hash(str) {
    // djb2 — só para comparar se dois estados são idênticos
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return String(h);
  }

  async function baixar() {
    const r = await fetch(`${url}/rest/v1/painel?id=eq.1&select=dados,atualizado_em`, {
      headers: cabecalhos(), cache: "no-store"
    });
    if (!r.ok) {
      let dica = "";
      if (r.status === 401 || r.status === 403) dica = " — chave inválida ou sem permissão";
      if (r.status === 404) dica = " — tabela 'painel' não encontrada (rode o passo 3 do guia)";
      throw new Error("HTTP " + r.status + dica);
    }
    const linhas = await r.json();
    return (linhas && linhas[0]) ? linhas[0] : null;
  }

  async function enviarEstado(dados, por) {
    const carimbo = new Date().toISOString();
    const r = await fetch(`${url}/rest/v1/painel?id=eq.1`, {
      method: "PATCH",
      headers: cabecalhos({ "Content-Type": "application/json", "Prefer": "return=minimal" }),
      body: JSON.stringify({ dados: dados, atualizado_em: carimbo, atualizado_por: por || "app" })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    ultimoRemoto = carimbo; // nosso próprio envio: não reaplicar na próxima verificação
    return carimbo;
  }

  /* envio com atraso curto: agrupa várias alterações seguidas num só envio */
  function agendarEnvio() {
    if (!configurada()) return;
    clearTimeout(timerEnvio);
    timerEnvio = setTimeout(enviarAgora, 1200);
  }

  async function enviarAgora() {
    if (!configurada() || enviando) return;
    enviando = true;
    try {
      const local = Store.snapshot();
      // PROTEÇÃO ANTI-PERDA: nunca sobrescrever a nuvem cheia com um estado vazio.
      // Se este aparelho está sem dados (ex.: navegador novo ainda não sincronizado),
      // em vez de apagar a nuvem, traz os dados dela para cá.
      if (!temConteudo(local)) {
        const linha = await baixar();
        if (linha && temConteudo(linha.dados)) {
          ultimoRemoto = linha.atualizado_em || ultimoRemoto;
          if (hash(JSON.stringify(linha.dados)) !== hash(Store.exportarJSON())) {
            Store.aplicarRemoto(linha.dados);
            if (typeof App !== "undefined" && App.render) App.render();
            if (typeof U !== "undefined" && U.toast) U.toast("Dados recuperados da nuvem.");
          }
          marcarStatus("ok");
          return; // não envia o vazio
        }
      }
      await enviarEstado(local, quem());
      marcarStatus("ok");
    } catch (e) {
      marcarStatus("erro", e.message);
    } finally {
      enviando = false;
    }
  }

  function quem() {
    try { return (App && App.nivel && App.nivel()) || "app"; } catch (e) { return "app"; }
  }

  function temConteudo(d) {
    if (!d) return false;
    const cols = ["alunos", "pacientes", "assistidos", "professores", "turmas",
      "matriculas", "chamadas", "atendimentos", "lancamentos", "eventos",
      "documentos", "listaEspera", "profsociais", "profsaude"];
    return cols.some(c => Array.isArray(d[c]) && d[c].length > 0);
  }

  async function verificar() {
    if (!configurada()) return;
    try {
      const linha = await baixar();
      if (!linha) return;
      if (linha.atualizado_em && linha.atualizado_em === ultimoRemoto) return; // nada novo
      ultimoRemoto = linha.atualizado_em || ultimoRemoto;
      const remotoStr = JSON.stringify(linha.dados || {});
      const localStr = Store.exportarJSON();
      if (hash(remotoStr) !== hash(localStr) && temConteudo(linha.dados)) {
        Store.aplicarRemoto(linha.dados);
        if (typeof App !== "undefined" && App.render) App.render();
        if (typeof U !== "undefined" && U.toast) U.toast("Dados atualizados da nuvem.");
      }
      marcarStatus("ok");
    } catch (e) {
      marcarStatus("erro", e.message);
    }
  }

  function iniciarPolling() {
    pararPolling();
    timerPoll = setInterval(verificar, INTERVALO);
  }
  function pararPolling() {
    if (timerPoll) { clearInterval(timerPoll); timerPoll = null; }
  }

  /* status observável para a tela de configuração */
  let status = { estado: "desligado", msg: "", quando: 0 };
  function marcarStatus(estado, msg) {
    status = { estado, msg: msg || "", quando: Date.now() };
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("nuvem-status"));
    }
  }
  function statusAtual() { return status; }

  /* liga a sincronização: na 1ª conexão decide quem "semeia" a nuvem.
     - nuvem já tem dados -> este aparelho recebe (a nuvem manda);
     - nuvem vazia e este aparelho tem dados -> envia os dados locais;
     - ambos vazios -> apenas começa a acompanhar. */
  async function iniciar() {
    if (!configurada() || ligado) return;
    ligado = true;
    try {
      const linha = await baixar();
      if (linha && temConteudo(linha.dados)) {
        ultimoRemoto = linha.atualizado_em || "";
        const remotoStr = JSON.stringify(linha.dados);
        if (hash(remotoStr) !== hash(Store.exportarJSON())) {
          Store.aplicarRemoto(linha.dados);
          if (typeof App !== "undefined" && App.render) App.render();
        }
      } else if (temConteudo(Store.snapshot())) {
        await enviarEstado(Store.snapshot(), quem()); // semeia a nuvem
      }
      marcarStatus("ok");
    } catch (e) {
      marcarStatus("erro", e.message);
    }
    iniciarPolling();
  }

  /* teste manual de conexão (usado na tela de configuração) */
  async function testar() {
    if (!configurada()) return { ok: false, msg: "Preencha o endereço e a chave da nuvem." };
    try {
      const linha = await baixar();
      if (linha === null) {
        return { ok: false, msg: "Conectou, mas a linha inicial não existe. Rode o código do passo 3 do guia." };
      }
      return { ok: true, msg: "Conexão OK! A nuvem respondeu corretamente." };
    } catch (e) {
      return { ok: false, msg: "Não conectou: " + e.message };
    }
  }

  return {
    configurada, endereco, salvarConfig, limparConfig,
    agendarEnvio, enviarAgora, verificar, iniciar, testar,
    statusAtual
  };
})();

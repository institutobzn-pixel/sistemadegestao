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
  const K_OFF = "bzn-nuvem-off";   // marca de "desconectei este aparelho de propósito"
  const INTERVALO = 7000; // verifica a nuvem a cada 7s

  /* Projeto do Instituto embutido: qualquer computador já abre conectado, sem
     ninguém precisar digitar endereço nem chave. A chave publicável pode ficar
     aqui à vista — sozinha ela não lê nem escreve nada, porque a regra da
     tabela exige uma sessão autenticada (e-mail e senha). */
  const URL_PADRAO = "https://pyiqjmweldihsfheqgli.supabase.co";
  const KEY_PADRAO = "sb_publishable_ZJman0R-WkiuT-wJk8RYfA_e1dfklvz";

  const desligado = localStorage.getItem(K_OFF) === "1";
  let url = localStorage.getItem(K_URL) || (desligado ? "" : URL_PADRAO);
  let key = localStorage.getItem(K_KEY) || (desligado ? "" : KEY_PADRAO);
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
    localStorage.removeItem(K_OFF);
  }

  function limparConfig() {
    url = ""; key = "";
    localStorage.removeItem(K_URL);
    localStorage.removeItem(K_KEY);
    /* sem esta marca o aparelho voltaria a usar a configuração embutida
       no próximo recarregamento, e o "Desconectar" não valeria de nada */
    localStorage.setItem(K_OFF, "1");
    pararPolling();
    ligado = false;
  }

  /* O apikey é sempre a chave publicável — é ela que identifica o projeto.
     O Authorization é que muda: com conta, vai o token do usuário; sem conta,
     a própria chave publicável, que é como o app funcionava antes.
     É assíncrono porque renovar um token expirado é chamada de rede. */
  async function cabecalhos(extra) {
    let autorizacao = key;
    if (typeof Auth !== "undefined" && Auth.logado()) {
      const t = await Auth.token();
      if (t) autorizacao = t;
    }
    return Object.assign({ "apikey": key, "Authorization": "Bearer " + autorizacao }, extra || {});
  }

  function hash(str) {
    // djb2 — só para comparar se dois estados são idênticos
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return String(h);
  }

  async function baixar() {
    const r = await fetch(`${url}/rest/v1/painel?id=eq.1&select=dados,atualizado_em`, {
      headers: await cabecalhos(), cache: "no-store"
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
      headers: await cabecalhos({ "Content-Type": "application/json", "Prefer": "return=minimal" }),
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
      // PROTEÇÃO ANTI-PERDA: antes de enviar, busca a nuvem e mescla protegido —
      // nenhuma coleção cheia na nuvem é apagada por uma cópia local desatualizada.
      let paraEnviar = local;
      const linha = await baixar();
      if (linha && linha.dados) {
        paraEnviar = mesclarProtegido(local, linha.dados); // local vence, mas não zera coleções da nuvem
        if (hash(JSON.stringify(paraEnviar)) !== hash(Store.exportarJSON())) {
          // alguma coleção foi recuperada da nuvem → reflete aqui também
          Store.aplicarRemoto(paraEnviar);
          if (typeof App !== "undefined" && App.render) App.render();
          if (typeof U !== "undefined" && U.toast) U.toast("Dados recuperados da nuvem.");
        }
      }
      await enviarEstado(paraEnviar, quem());
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

  const COLS = ["cursos", "professores", "equipe", "turmas", "alunos", "matriculas",
    "chamadas", "pacientes", "profsaude", "atendimentos", "eventos", "lancamentos",
    "assistidos", "listaEspera", "compromissosAS", "legislacaoAS", "profsociais",
    "documentos", "linksImagens"];

  function temConteudo(d) {
    if (!d) return false;
    return COLS.some(c => Array.isArray(d[c]) && d[c].length > 0);
  }

  /* Mescla protegida: devolve `preferido`, MAS para cada coleção que ficou vazia
     em `preferido` e está cheia em `base`, mantém a de `base`. Assim uma cópia
     desatualizada (sem uma coleção inteira) nunca apaga essa coleção da outra.
     Deleções de registros individuais dentro de uma coleção cheia continuam valendo. */
  function mesclarProtegido(preferido, base) {
    const out = Object.assign({}, base, preferido);
    for (const c of COLS) {
      const pref = Array.isArray(preferido && preferido[c]) ? preferido[c] : [];
      const bas = Array.isArray(base && base[c]) ? base[c] : [];
      out[c] = (pref.length === 0 && bas.length > 0) ? bas : pref;
    }
    return out;
  }

  async function verificar() {
    if (!configurada()) return;
    try {
      const linha = await baixar();
      if (!linha) return;
      if (linha.atualizado_em && linha.atualizado_em === ultimoRemoto) return; // nada novo
      ultimoRemoto = linha.atualizado_em || ultimoRemoto;
      // mescla protegida: a nuvem manda, mas não apaga uma coleção que só existe aqui
      const combinado = mesclarProtegido(linha.dados || {}, Store.snapshot());
      const localStr = Store.exportarJSON();
      if (hash(JSON.stringify(combinado)) !== hash(localStr) && temConteudo(combinado)) {
        Store.aplicarRemoto(combinado);
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
        // mescla protegida: junta o que a nuvem tem com o que só existe aqui
        const combinado = mesclarProtegido(linha.dados, Store.snapshot());
        if (hash(JSON.stringify(combinado)) !== hash(Store.exportarJSON())) {
          Store.aplicarRemoto(combinado);
          if (typeof App !== "undefined" && App.render) App.render();
        }
        // se a fusão recuperou coleções que faltavam na nuvem, devolve para a nuvem
        if (hash(JSON.stringify(combinado)) !== hash(JSON.stringify(linha.dados))) {
          agendarEnvio();
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
        /* a nuvem respondeu, mas devolveu vazio. Quase sempre é a regra de
           acesso fazendo o seu trabalho: sem login, não se vê nada. */
        const temConta = (typeof Auth !== "undefined") && Auth.logado();
        return { ok: false, msg: temConta
          ? "Conectou, mas a linha inicial não existe. Rode o código do passo 3 do guia."
          : "Conectou à nuvem, mas os dados só aparecem depois que você entrar com seu e-mail e senha." };
      }
      return { ok: true, msg: "Conexão OK! A nuvem respondeu corretamente." };
    } catch (e) {
      return { ok: false, msg: "Não conectou: " + e.message };
    }
  }

  function chavePublica() { return key; }

  return {
    configurada, endereco, chavePublica, salvarConfig, limparConfig,
    agendarEnvio, enviarAgora, verificar, iniciar, testar,
    statusAtual
  };
})();

/* Ação reutilizável: abre o formulário de conexão com a nuvem, baixa os dados
   e recarrega. Usada por qualquer tela vazia ("este aparelho ainda não trouxe
   os dados") — professor, profissional de saúde, etc. */
Actions.conectarNuvem = () => {
  const urlAtual = Nuvem.configurada() ? Nuvem.endereco() : "";
  App.abrirModal("Trazer os dados do instituto", `
    <p style="font-size:0.9rem; margin-bottom:12px;">
      Este aparelho ainda não baixou os dados. Cole o endereço e a chave (o admin fornece,
      ou use o link/QR de acesso). Depois é só entrar com o seu PIN.
    </p>
    <div class="field">
      <label for="cn-url">Endereço (Project URL)</label>
      <input id="cn-url" type="text" placeholder="https://xxxxxxxx.supabase.co" value="${urlAtual}">
    </div>
    <div class="field">
      <label for="cn-key">Chave publicável (anon / public)</label>
      <input id="cn-key" type="text" placeholder="sb_publishable_..." autocomplete="off">
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="conectarNuvemOk">Baixar dados</button>
    </div>`);
};

Actions.conectarNuvemOk = async () => {
  const u = (document.getElementById("cn-url").value || "").trim();
  const k = (document.getElementById("cn-key").value || "").trim();
  if (!/^https:\/\/.+\.supabase\.co/i.test(u)) { alert("O endereço deve ser parecido com https://xxxxxxxx.supabase.co"); return; }
  if (!k) { alert("Cole a chave publicável (anon / public)."); return; }
  Nuvem.salvarConfig(u, k);
  U.toast("Conectando…");
  const r = await Nuvem.testar();
  if (!r.ok) { alert("Não foi possível conectar.\n\n" + r.msg); return; }
  await Nuvem.iniciar();
  App.fecharModal();
  U.toast("Dados baixados! Agora entre com seu PIN.");
  App.render();
};

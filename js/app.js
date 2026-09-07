/* Roteador, navegação e modal */
"use strict";

/* registra o service worker (PWA — instalável e offline) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* Conexão automática com a nuvem:
   - se o link trouxer ?nuvem=<url>&chave=<chave> (o "link mágico" que o
     admin compartilha), configura, baixa os dados e limpa a URL;
   - senão, apenas religa a sincronização se este aparelho já estava conectado. */
window.addEventListener("load", async () => {
  if (typeof Nuvem === "undefined") return;
  const params = new URLSearchParams(location.search);
  const u = params.get("nuvem");
  const k = params.get("chave");
  if (u && k) {
    Nuvem.salvarConfig(u, k);
    try {
      const r = await Nuvem.testar();
      if (r.ok) await Nuvem.iniciar();
    } catch (e) { /* ignora — segue como app normal */ }
    // remove a chave da barra de endereço (não fica no histórico)
    history.replaceState(null, "", location.pathname + (location.hash || ""));
    if (typeof App !== "undefined" && App.render) App.render();
  } else if (Nuvem.configurada()) {
    Nuvem.iniciar();
  }
});

const App = (() => {
  const rotas = {
    dashboard: () => Views.dashboard(),
    cursos: () => Views.cursos(),
    turmas: () => Views.turmas(),
    professores: sub => Views.professores(sub),
    alunos: () => Views.alunos(),
    aluno: id => Views.alunoDetalhe(id),
    chamada: id => Views.chamada(id),
    indicadores: sub => sub === "relatorios" ? Views.relatorios() : Views.graficos(),
    /* rotas antigas continuam funcionando */
    graficos: () => Views.graficos(),
    relatorios: () => Views.relatorios(),
    atendimentos: sub => Views.atendimentos(sub),
    paciente: id => Views.pacienteDetalhe(id),
    professor: () => Views.professorArea(),
    agenda: () => Views.agenda(),
    documentacao: sub => Views.documentacao(sub),
    financeiro: sub => Views.financeiro(sub),
    assistencia: sub => Views.assistencia(sub),
    assistido: id => Views.assistidoDetalhe(id),
    seguranca: () => Views.seguranca()
  };

  const CHAVE_NIVEL = "bzn-nivel";
  const nivel = () => sessionStorage.getItem(CHAVE_NIVEL) || "";

  /* admin e presidente têm acesso total (inclusive Logins e Financeiro) */
  const ehAdmin = () => { const n = nivel(); return n === "admin" || n === "presidente"; };

  /* permissões por nível: admin, presidente e secretaria têm acesso completo
     à operação (só admin/presidente gerenciam senhas/PINs). */
  function rotaPermitida() {
    const n = nivel();
    return n === "admin" || n === "presidente" || n === "secretaria";
  }

  function render() {
    const hash = location.hash.replace(/^#\//, "") || "dashboard";
    const [rota, param] = hash.split("/");
    const fn = rotas[rota] || rotas.dashboard;

    /* portão de entrada: sem login, só as áreas restritas de professor e
       profissional de saúde (que têm PIN próprio) */
    /* rotas com controle próprio: PIN de professor, de profissional e do financeiro */
    const asLogado = sessionStorage.getItem("bzn-as-logado") === "1";
    const profSaudeLogado = !!sessionStorage.getItem("bzn-prof-logado");
    const rotaLivre = rota === "professor" ||
      (rota === "atendimentos" && (param === "minha-area" || param === "meus-pacientes")) ||
      /* a ficha do paciente confere, ela mesma, se é de quem está logado */
      (rota === "paciente" && profSaudeLogado) ||
      rota === "financeiro" ||
      rota === "assistencia" || rota === "assistido" ||
      /* a equipe da assistência social também consulta os Indicadores */
      ((rota === "indicadores" || rota === "graficos" || rota === "relatorios") && asLogado);
    const btnSair = document.getElementById("btn-sair-sistema");
    if (!nivel() && !rotaLivre) {
      if (btnSair) btnSair.hidden = true;
      renderPortao();
      return;
    }
    if (btnSair) {
      btnSair.hidden = !nivel();
      btnSair.textContent = nivel() ? "Sair (" + ({ admin: "admin", presidente: "presidente", secretaria: "secretaria" }[nivel()] || "") + ")" : "Sair";
    }
    const btnSeg = document.getElementById("btn-seguranca");
    if (btnSeg) btnSeg.hidden = !ehAdmin();

    /* versões dos botões dentro do menu ☰ (celular) */
    const navLogins = document.getElementById("nav-logins");
    if (navLogins) navLogins.hidden = !ehAdmin();
    const navSair = document.getElementById("nav-sair");
    if (navSair) navSair.hidden = !nivel();

    document.querySelectorAll("#nav-tabs a").forEach(a => {
      const r = a.dataset.route;
      a.classList.toggle("active",
        r === rota ||
        (rota === "aluno" && r === "alunos") ||
        (rota === "paciente" && r === "atendimentos") ||
        (rota === "professor" && r === "professores") ||
        (rota === "assistido" && r === "assistencia") ||
        ((rota === "graficos" || rota === "relatorios") && r === "indicadores"));
    });
    document.getElementById("nav-tabs").classList.remove("open");

    const view = document.getElementById("view");
    view.innerHTML = fn(param) || "";
    view.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", ev => {
        ev.stopPropagation();
        const { action, id } = el.dataset;
        if (Actions[action]) Actions[action](id, el);
      });
    });
    if (Views.aposRender) Views.aposRender(rota, param);
    window.scrollTo(0, 0);
  }

  /* ---------- portão de entrada (perfis: admin, presidência, secretaria) ---------- */
  let portaoTentouBaixar = false;
  function renderPortao() {
    document.querySelectorAll("#nav-tabs a").forEach(a => a.classList.remove("active"));
    const view = document.getElementById("view");
    const primeiraVez = !Store.temSenha("admin");
    const nuvemCfg = (typeof Nuvem !== "undefined") && Nuvem.configurada();

    /* Se o aparelho está ligado à nuvem mas ainda sem dados, NÃO peça "criar
       senha" — mostre que está baixando. Evita criar senha duplicada por engano
       e a confusão de "a área sumiu". A tela de login aparece após o download. */
    if (primeiraVez && nuvemCfg && !portaoTentouBaixar) {
      portaoTentouBaixar = true;
      view.innerHTML = `
        <div class="panel" style="max-width:440px; margin:40px auto 0;">
          <h3 style="margin-bottom:2px;">Trazendo os dados do instituto…</h3>
          <p class="panel-sub">Este aparelho está conectado à nuvem e está baixando os cadastros e as senhas. A tela de login aparece sozinha em instantes.</p>
          <div class="form-actions"><button class="btn accent" id="portao-baixar">Baixar agora</button></div>
        </div>`;
      const baixar = async () => { try { await Nuvem.verificar(); } catch (e) {} render(); };
      const b = document.getElementById("portao-baixar");
      if (b) b.addEventListener("click", baixar);
      baixar();
      window.scrollTo(0, 0);
      return;
    }

    view.innerHTML = `
      <div class="panel" style="max-width:440px; margin:40px auto 0;">
        <h3 style="margin-bottom:2px;">${primeiraVez ? "Primeiro acesso neste aparelho" : "Acesso restrito"}</h3>
        <p class="panel-sub">${primeiraVez
          ? "Se o instituto <strong>já usa</strong> o sistema, clique em <strong>“☁️ Trazer os dados”</strong> abaixo — <strong>não crie senha nova</strong>. Crie a senha só se for a primeiríssima vez do instituto."
          : "Escolha seu perfil e digite a senha."}</p>
        ${primeiraVez ? `<div class="form-actions" style="margin-bottom:6px;">
          <a href="#" id="portao-nuvem-top" class="btn accent" style="width:100%; justify-content:center; text-decoration:none;">&#9729;&#65039; Trazer os dados do instituto (nuvem)</a>
        </div>
        <details style="margin-bottom:6px;"><summary style="cursor:pointer; font-size:0.85rem; color:var(--text-muted);">É a primeiríssima vez do instituto? Criar o sistema do zero</summary>` : ""}
        <div class="form-grid" style="grid-template-columns:1fr;">
          ${primeiraVez ? "" : `
          <div class="field">
            <label for="portao-perfil">Perfil</label>
            <select id="portao-perfil">
              <option value="admin">Administração</option>
              <option value="presidente">Presidência</option>
              <option value="secretaria">Secretaria</option>
            </select>
          </div>`}
          <div class="field">
            <label for="portao-senha">${primeiraVez ? "Nova senha do administrador (mínimo 4 caracteres)" : "Senha"}</label>
            <input id="portao-senha" type="password" autocomplete="${primeiraVez ? "new-password" : "current-password"}">
          </div>
          ${primeiraVez ? `
          <div class="field">
            <label for="portao-confirma">Confirme a senha</label>
            <input id="portao-confirma" type="password" autocomplete="new-password">
          </div>
          <div class="field">
            <label for="portao-pergunta">Pergunta de segurança (obrigatória — protege a recuperação da senha)</label>
            <input id="portao-pergunta" placeholder="ex.: Qual o nome do seu primeiro cachorro?">
          </div>
          <div class="field">
            <label for="portao-resposta">Resposta secreta</label>
            <input id="portao-resposta" placeholder="só o administrador deve saber">
          </div>` : ""}
        </div>
        <div class="form-actions">
          <button class="btn accent" id="portao-entrar">${primeiraVez ? "Criar senha e entrar" : "Entrar"}</button>
        </div>
        ${primeiraVez ? "</details>" : ""}
        <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border); font-size:0.82rem; display:flex; flex-direction:column; gap:6px;">
          <a href="#/professor">&#128274; Sou professor — entrar com meu PIN</a>
          <a href="#/atendimentos/minha-area">&#128274; Sou profissional de saúde — entrar com meu PIN</a>
          <a href="#/assistencia">&#128274; Sou da assistência social — entrar com meu PIN</a>
          <a href="#/financeiro">&#128274; Sou gestor(a) financeiro(a) — entrar com meu PIN</a>
          <a href="#" id="portao-nuvem">&#9729;&#65039; Já usamos a nuvem — trazer os dados deste instituto</a>
          ${primeiraVez ? "" : `<a href="#" id="portao-esqueci" style="color:var(--text-muted);">Esqueci a senha do administrador</a>`}
        </div>
      </div>`;

    const senha = document.getElementById("portao-senha");
    const aviso = msg => {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.hidden = false;
      setTimeout(() => { el.hidden = true; }, 2600);
    };
    const entrar = () => {
      const v = senha.value;
      if (primeiraVez) {
        const conf = document.getElementById("portao-confirma").value;
        const pergunta = document.getElementById("portao-pergunta").value.trim();
        const resposta = document.getElementById("portao-resposta").value.trim();
        if (v.length < 4) { alert("A senha deve ter pelo menos 4 caracteres."); return; }
        if (v !== conf) { alert("As senhas não conferem. Digite igual nos dois campos."); return; }
        if (!pergunta || !resposta) { alert("Cadastre a pergunta de segurança e a resposta.\nElas protegem a recuperação da senha — sem elas, qualquer pessoa poderia redefinir seu acesso."); return; }
        Store.definirSenha("admin", v);
        Store.definirPerguntaSeguranca(pergunta, resposta);
        sessionStorage.setItem(CHAVE_NIVEL, "admin");
        render();
        return;
      }
      const perfil = document.getElementById("portao-perfil").value;
      if (!Store.temSenha(perfil)) {
        alert("Este perfil ainda não tem senha cadastrada.\nPeça ao administrador para criar em Indicadores → Relatórios → Segurança.");
        return;
      }
      if (!Store.conferirSenha(perfil, v)) {
        senha.value = "";
        senha.focus();
        aviso("Senha incorreta.");
        return;
      }
      sessionStorage.setItem(CHAVE_NIVEL, perfil);
      render();
    };
    document.getElementById("portao-entrar").addEventListener("click", entrar);
    view.querySelectorAll("input").forEach(i =>
      i.addEventListener("keydown", ev => { if (ev.key === "Enter") entrar(); }));

    /* trazer os dados da nuvem num computador novo (antes de logar) */
    const abrirNuvemPortao = ev => {
      if (ev) ev.preventDefault();
      const urlAtual = (typeof Nuvem !== "undefined" && Nuvem.configurada()) ? Nuvem.endereco() : "";
      abrirModal("Trazer os dados da nuvem", `
        <p style="font-size:0.9rem; margin-bottom:12px;">
          Use isto num computador novo para baixar os dados que já estão na nuvem
          (inclui as senhas e PINs). Depois é só entrar normalmente.
        </p>
        <div class="field">
          <label for="pn-url">Endereço (Project URL)</label>
          <input id="pn-url" type="text" placeholder="https://xxxxxxxx.supabase.co" value="${urlAtual}">
        </div>
        <div class="field">
          <label for="pn-key">Chave publicável (anon / public)</label>
          <input id="pn-key" type="text" placeholder="sb_publishable_..." autocomplete="off">
        </div>
        <div class="form-actions">
          <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
          <button type="button" class="btn accent" id="pn-connect">Baixar dados</button>
        </div>`);
      const btn = document.getElementById("pn-connect");
      if (btn) btn.addEventListener("click", async () => {
        const u = (document.getElementById("pn-url").value || "").trim();
        const k = (document.getElementById("pn-key").value || "").trim();
        if (!/^https:\/\/.+\.supabase\.co/i.test(u)) { alert("O endereço deve ser parecido com https://xxxxxxxx.supabase.co"); return; }
        if (!k) { alert("Cole a chave publicável (anon / public)."); return; }
        Nuvem.salvarConfig(u, k);
        aviso("Conectando à nuvem…");
        const r = await Nuvem.testar();
        if (!r.ok) { alert("Não foi possível conectar.\n\n" + r.msg); return; }
        await Nuvem.iniciar();
        fecharModal();
        aviso("Dados baixados! Agora entre com sua senha.");
        render();
      });
    };
    const linkNuvem = document.getElementById("portao-nuvem");
    if (linkNuvem) linkNuvem.addEventListener("click", abrirNuvemPortao);
    const linkNuvemTop = document.getElementById("portao-nuvem-top");
    if (linkNuvemTop) linkNuvemTop.addEventListener("click", abrirNuvemPortao);

    /* recuperação: redefine só a senha do admin, mantendo todos os dados.
       Só funciona neste computador (quem tem acesso físico já controla tudo). */
    const esqueci = document.getElementById("portao-esqueci");
    if (esqueci) esqueci.addEventListener("click", ev => {
      ev.preventDefault();
      /* a recuperação SÓ funciona com a pergunta de segurança — sem ela,
         não permitimos redefinir (evita que qualquer pessoa troque o acesso) */
      if (!Store.temPerguntaSeguranca()) {
        alert("A recuperação está bloqueada porque não há pergunta de segurança cadastrada.\n\nEntre com a sua senha e cadastre a pergunta em ⚙ Logins. Se realmente perdeu a senha, será preciso apoio técnico neste computador.");
        return;
      }
      const resp = prompt("Pergunta de segurança:\n\n" + Store.perguntaSeguranca());
      if (resp === null) return;
      if (!Store.conferirResposta(resp)) { alert("Resposta incorreta. A senha não foi alterada."); return; }
      const nova = prompt("Digite a NOVA senha do administrador (mínimo 4 caracteres):");
      if (nova === null) return;
      if (nova.trim().length < 4) { alert("A senha deve ter pelo menos 4 caracteres."); return; }
      const conf = prompt("Digite a nova senha de novo para confirmar:");
      if (nova !== conf) { alert("As senhas não conferem. Nada foi alterado."); return; }
      Store.definirSenha("admin", nova);
      sessionStorage.setItem(CHAVE_NIVEL, "admin");
      aviso("Senha do administrador redefinida.");
      render();
    });

    // não focar a senha quando ela está dentro do "criar sistema" recolhido
    // (evita abrir sozinho o formulário de criar senha num aparelho novo)
    if (senha && !primeiraVez) senha.focus();
    window.scrollTo(0, 0);
  }

  /* ---------- modal ---------- */
  const backdrop = document.getElementById("modal-backdrop");
  const modalBody = document.getElementById("modal-body");
  const modalTitle = document.getElementById("modal-title");

  function abrirModal(titulo, html, aoEnviar) {
    modalTitle.textContent = titulo;
    modalBody.innerHTML = html;
    backdrop.hidden = false;
    const form = modalBody.querySelector("form");
    if (form && aoEnviar) {
      form.addEventListener("submit", ev => {
        ev.preventDefault();
        const dados = Object.fromEntries(new FormData(form).entries());
        if (aoEnviar(dados, form) !== false) fecharModal();
      });
    }
    modalBody.querySelectorAll("[data-modal-action]").forEach(el => {
      el.addEventListener("click", () => {
        const a = el.dataset.modalAction;
        if (a === "cancelar") fecharModal();
        else if (Actions[a]) Actions[a](el.dataset.id, el);
      });
    });
    const primeiro = modalBody.querySelector("input, select, textarea");
    if (primeiro) primeiro.focus();
  }

  function fecharModal() {
    backdrop.hidden = true;
    modalBody.innerHTML = "";
  }

  document.getElementById("modal-close").addEventListener("click", fecharModal);
  backdrop.addEventListener("click", ev => { if (ev.target === backdrop) fecharModal(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !backdrop.hidden) fecharModal(); });

  document.getElementById("menu-btn").addEventListener("click", () => {
    document.getElementById("nav-tabs").classList.toggle("open");
  });

  const btnSeguranca = document.getElementById("btn-seguranca");
  if (btnSeguranca) btnSeguranca.addEventListener("click", () => { location.hash = "#/seguranca"; });

  const sair = () => {
    sessionStorage.removeItem(CHAVE_NIVEL);
    document.getElementById("nav-tabs").classList.remove("open");
    location.hash = "#/dashboard";
    render();
  };
  const btnSairSistema = document.getElementById("btn-sair-sistema");
  if (btnSairSistema) btnSairSistema.addEventListener("click", sair);
  const navSairLink = document.getElementById("nav-sair");
  if (navSairLink) navSairLink.addEventListener("click", ev => { ev.preventDefault(); sair(); });

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", render);

  return { render, abrirModal, fecharModal, nivel, ehAdmin };
})();

/* Assistência Social: cadastro de atendidos (com documentos e necessidades
   especiais), lista de espera por área, agenda interna e legislação.
   Acesso: admin ou PIN próprio da assistência social. */
"use strict";

const CHAVE_AS_LOGADO = "bzn-as-logado";
const AS = {
  logado: () => sessionStorage.getItem(CHAVE_AS_LOGADO) === "1" || App.ehAdmin()
};

function subnavAS(ativa) {
  const abas = [
    ["", "Atendidos"], ["espera", "Lista de espera"],
    ["agenda", "Agenda interna"],
    ["legislacao", "Legislação e documentos"]
  ];
  return `<div class="subtabs">${abas.map(([slug, rotulo]) =>
    `<a href="#/assistencia${slug ? "/" + slug : ""}" class="${ativa === slug ? "active" : ""}">${rotulo}</a>`).join("")}</div>`;
}

let filtroAssistidos = "";

Views.assistencia = sub => {
  if (!AS.logado()) return viewLoginAS();
  if (sub === "espera") return viewEsperaAS();
  if (sub === "agenda") return viewAgendaAS();
  if (sub === "legislacao") return viewLegislacaoAS();
  return viewAssistidosAS();
};

function viewLoginAS() {
  return `
    <div class="page-head">
      <div>
        <h2>Assistência Social</h2>
        <p>Área restrita à equipe da assistência social e ao administrador.</p>
      </div>
    </div>
    <div class="panel" style="max-width:440px;">
      <h3>Entrar na assistência social</h3>
      <p class="panel-sub">Digite o PIN da assistência social</p>
      ${Store.temPinAssistencia() ? `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field">
          <label for="as-pin">PIN</label>
          <input id="as-pin" type="password" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos" autocomplete="off">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn accent" data-action="entrarAS">Entrar</button>
      </div>`
      : `<div class="alert-box info"><span class="ico">&#128274;</span><div>
          <p>O PIN da assistência social ainda não foi criado.<br>
          Peça ao administrador: botão <strong>&#9881; Logins</strong> no topo do sistema.</p>
        </div></div>`}
    </div>`;
}

Actions.entrarAS = () => {
  const pin = document.getElementById("as-pin").value.trim();
  if (!Store.conferirPinAssistencia(pin)) {
    U.toast("PIN incorreto.");
    document.getElementById("as-pin").value = "";
    return;
  }
  sessionStorage.setItem(CHAVE_AS_LOGADO, "1");
  U.toast("Bem-vindo(a) à assistência social!");
  App.render();
};
Actions.sairAS = () => {
  sessionStorage.removeItem(CHAVE_AS_LOGADO);
  location.hash = "#/dashboard";
  App.render();
};

/* ---------------- atendidos ---------------- */

function viewAssistidosAS() {
  const todos = U.ordenarPorNome(Store.col("assistidos"));
  const filtro = filtroAssistidos.trim().toLowerCase();
  const lista = filtro
    ? todos.filter(p => (p.nome + " " + (p.cpf || "") + " " + (p.telefone || "")).toLowerCase().includes(filtro))
    : todos;

  let html = "";
  let letraAtual = "";
  for (const p of lista) {
    const letra = (p.nome[0] || "?").toUpperCase();
    if (letra !== letraAtual) {
      letraAtual = letra;
      html += `<div class="alpha-letter">${letra}</div>`;
    }
    html += `
      <div class="aluno-row" data-action="verAssistido" data-id="${p.id}">
        <span class="avatar cor-${(letra.charCodeAt(0) % 8) + 1}">${U.iniciais(p.nome)}</span>
        <div class="a-info">
          <div class="a-nome">${U.esc(p.nome)}</div>
          <div class="a-sub">${U.esc(p.telefone || p.whatsapp || "")}${(p.telefone || p.whatsapp) && p.email ? " · " : ""}${U.esc(p.email || "")}</div>
        </div>
        <div class="a-chips">
          ${p.necessidadesEspeciais === "sim" ? `<span class="pill warn">nec. especiais</span>` : ""}
          ${(p.documentos || []).length ? `<span class="chip">&#128196; ${p.documentos.length}</span>` : ""}
        </div>
      </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Assistência Social</h2>
        <p>Cadastro das pessoas atendidas, em ordem alfabética. Clique para abrir a ficha.</p>
      </div>
      <div class="head-actions">
        ${!App.ehAdmin() ? `<button class="btn ghost" data-action="sairAS">Sair da assistência</button>` : ""}
        <input class="search-input" id="busca-assistido" type="search" placeholder="Buscar por nome, CPF ou telefone…" value="${U.esc(filtroAssistidos)}">
        <button class="btn accent" data-action="novoAssistido">+ Novo atendido</button>
      </div>
    </div>
    ${subnavAS("")}
    <div class="panel">
      ${lista.length ? html : `<div class="empty-note">${filtro ? "Ninguém encontrado para essa busca." : "Nenhuma pessoa cadastrada ainda."}</div>`}
    </div>`;
}

Views.assistidoDetalhe = id => {
  if (!AS.logado()) return viewLoginAS();
  const p = Store.get("assistidos", id);
  if (!p) return `<div class="panel"><div class="empty-note">Cadastro não encontrado.</div></div>`;
  const idade = U.idade(p.nascimento);
  const item = (k, v) => `<div class="detail-item"><div class="k">${k}</div><div class="v">${v || "—"}</div></div>`;
  const compromissos = Store.col("compromissosAS")
    .filter(c => c.assistidoId === p.id)
    .sort((a, b) => (b.data + (b.hora || "")).localeCompare(a.data + (a.hora || "")));

  return `
    <div class="page-head">
      <div>
        <h2>${U.esc(p.nome)}</h2>
        <p>${idade !== null ? idade + " anos · " : ""}Assistência social${p.necessidadesEspeciais === "sim" ? " · portador(a) de necessidades especiais" : ""}.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="voltarAssistidos">&larr; Voltar</button>
        <button class="btn accent" data-action="editarAssistido" data-id="${p.id}">Editar cadastro</button>
      </div>
    </div>

    <div class="grid-2-even">
      <div class="panel">
        <h3>Dados pessoais</h3>
        <p class="panel-sub">Cadastro</p>
        <div class="detail-grid">
          ${item("CPF", U.esc(p.cpf))}
          ${item("RG", U.esc(p.rg))}
          ${item("Data de nascimento", p.nascimento ? U.fmtData(p.nascimento) + (idade !== null ? ` (${idade} anos)` : "") : "")}
          ${item("Sexo", U.esc(p.sexo))}
          ${item("Telefone", U.esc(p.telefone))}
          ${item("WhatsApp", U.esc(p.whatsapp))}
          ${item("E-mail", U.esc(p.email))}
          ${item("Endereço", U.esc([p.endereco, p.bairro, p.cidade].filter(Boolean).join(", ")))}
          ${item("Responsável", U.esc(p.responsavel))}
          ${item("Escolaridade", U.esc(p.escolaridade))}
          ${item("Profissão", U.esc(p.profissao))}
          ${item("Estado civil", U.esc(p.estadoCivil))}
        </div>
      </div>
      <div class="panel">
        <h3>Situação social</h3>
        <p class="panel-sub">Dados sensíveis — uso interno</p>
        <div class="detail-grid">
          ${item("Encaminhado por", U.esc(p.encaminhadoPor))}
          ${item("Situação socioeconômica", U.esc(p.situacaoSocio))}
          ${item("Benefícios sociais", U.esc(p.beneficios))}
          ${item("Atingido pelas enchentes", p.atingidoEnchente === "sim" ? "Sim" : p.atingidoEnchente === "nao" ? "Não" : "")}
          ${item("Necessidades especiais", p.necessidadesEspeciais === "sim" ? "Sim" : p.necessidadesEspeciais === "nao" ? "Não" : "")}
          ${item("Descrição das necessidades", U.esc(p.necessidadesDesc))}
          ${item("Observações", U.esc(p.observacoes))}
        </div>
        ${(p.documentos || []).length ? `
        <div style="margin-top:14px;">
          <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:6px;">Documentos</div>
          <div class="cross-chips">${Anexos.links(p.documentos)}</div>
        </div>` : ""}
      </div>
    </div>

    <div class="panel">
      <h3>Compromissos desta pessoa</h3>
      <p class="panel-sub">Agendamentos feitos na agenda interna</p>
      ${compromissos.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Compromisso</th><th>Responsável</th><th>Status</th></tr></thead>
        <tbody>${compromissos.map(c => `
          <tr>
            <td style="white-space:nowrap">${U.fmtData(c.data)} ${U.esc(c.hora || "")}</td>
            <td>${U.esc(c.titulo)}</td>
            <td>${U.esc(c.responsavel || "—")}</td>
            <td><span class="pill ${{ agendado: "info", realizado: "ok", cancelado: "warn" }[c.status] || "muted"}">${U.esc(c.status)}</span></td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty-note">Nenhum compromisso registrado. Use a sub-aba Agenda interna.</div>`}
    </div>

    <div class="head-actions">
      <button class="btn danger" data-action="excluirAssistido" data-id="${p.id}">Excluir cadastro</button>
    </div>`;
};

function abrirFormAssistido(p) {
  const optEnc = (() => {
    const opcoes = [...Store.config.encaminhamentos];
    if (p.encaminhadoPor && !opcoes.some(o => o.toLowerCase() === p.encaminhadoPor.toLowerCase())) opcoes.push(p.encaminhadoPor);
    return ['<option value="">— selecione —</option>']
      .concat(opcoes.map(o => `<option value="${U.esc(o)}" ${o === p.encaminhadoPor ? "selected" : ""}>${U.esc(o)}</option>`)).join("");
  })();

  App.abrirModal(p.id ? "Editar atendido" : "Novo atendido", `
    <form>
      <div class="form-grid">
        <div class="form-section">Dados pessoais</div>
        <div class="field full">
          <label for="fas-nome">Nome completo *</label>
          <input id="fas-nome" name="nome" required value="${U.esc(p.nome)}">
        </div>
        <div class="field"><label for="fas-cpf">CPF</label><input id="fas-cpf" name="cpf" value="${U.esc(p.cpf)}"></div>
        <div class="field"><label for="fas-rg">RG</label><input id="fas-rg" name="rg" value="${U.esc(p.rg)}"></div>
        <div class="field"><label for="fas-nasc">Data de nascimento</label><input id="fas-nasc" name="nascimento" type="date" value="${U.esc(p.nascimento)}"></div>
        <div class="field">
          <label for="fas-sexo">Sexo</label>
          <select id="fas-sexo" name="sexo">
            <option value="" ${!p.sexo ? "selected" : ""}>— selecione —</option>
            <option value="F" ${p.sexo === "F" ? "selected" : ""}>Feminino</option>
            <option value="M" ${p.sexo === "M" ? "selected" : ""}>Masculino</option>
            <option value="Outro" ${p.sexo === "Outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>
        <div class="field"><label for="fas-tel">Telefone</label><input id="fas-tel" name="telefone" value="${U.esc(p.telefone)}"></div>
        <div class="field"><label for="fas-zap">WhatsApp</label><input id="fas-zap" name="whatsapp" value="${U.esc(p.whatsapp)}"></div>
        <div class="field full"><label for="fas-email">E-mail</label><input id="fas-email" name="email" type="email" value="${U.esc(p.email)}"></div>
        <div class="field full"><label for="fas-end">Endereço (rua e número)</label><input id="fas-end" name="endereco" value="${U.esc(p.endereco)}"></div>
        <div class="field"><label for="fas-bairro">Bairro</label><input id="fas-bairro" name="bairro" value="${U.esc(p.bairro)}"></div>
        <div class="field"><label for="fas-cidade">Cidade</label><input id="fas-cidade" name="cidade" value="${U.esc(p.cidade)}"></div>
        <div class="field"><label for="fas-resp">Responsável (quando menor)</label><input id="fas-resp" name="responsavel" value="${U.esc(p.responsavel)}"></div>
        <div class="field"><label for="fas-esc">Escolaridade</label><input id="fas-esc" name="escolaridade" value="${U.esc(p.escolaridade)}"></div>
        <div class="field"><label for="fas-escola">Escola</label><input id="fas-escola" name="escola" value="${U.esc(p.escola)}"></div>
        <div class="field"><label for="fas-prof">Profissão</label><input id="fas-prof" name="profissao" value="${U.esc(p.profissao)}"></div>
        <div class="field"><label for="fas-civil">Estado civil</label><input id="fas-civil" name="estadoCivil" value="${U.esc(p.estadoCivil)}"></div>

        <div class="form-section">Situação social</div>
        <div class="field"><label for="fas-enc">Encaminhado por</label><select id="fas-enc" name="encaminhadoPor">${optEnc}</select></div>
        <div class="field"><label for="fas-socio">Situação socioeconômica</label><input id="fas-socio" name="situacaoSocio" value="${U.esc(p.situacaoSocio)}"></div>
        <div class="field"><label for="fas-benef">Recebe benefícios sociais?</label><input id="fas-benef" name="beneficios" value="${U.esc(p.beneficios)}"></div>
        <div class="field">
          <label for="fas-ench">Atingido pelas enchentes?</label>
          <select id="fas-ench" name="atingidoEnchente">
            <option value="" ${!p.atingidoEnchente ? "selected" : ""}>Não informado</option>
            <option value="sim" ${p.atingidoEnchente === "sim" ? "selected" : ""}>Sim</option>
            <option value="nao" ${p.atingidoEnchente === "nao" ? "selected" : ""}>Não</option>
          </select>
        </div>
        <div class="field full"><label for="fas-enchdet">Detalhes do impacto das enchentes</label><textarea id="fas-enchdet" name="impactoEnchentes">${U.esc(p.impactoEnchentes)}</textarea></div>
        <div class="field">
          <label for="fas-ne">É portador de necessidades especiais?</label>
          <select id="fas-ne" name="necessidadesEspeciais">
            <option value="" ${!p.necessidadesEspeciais ? "selected" : ""}>Não informado</option>
            <option value="sim" ${p.necessidadesEspeciais === "sim" ? "selected" : ""}>Sim</option>
            <option value="nao" ${p.necessidadesEspeciais === "nao" ? "selected" : ""}>Não</option>
          </select>
        </div>
        <div class="field full">
          <label for="fas-nedesc">Descreva as necessidades especiais</label>
          <textarea id="fas-nedesc" name="necessidadesDesc" placeholder="Descreva a condição, apoios necessários, laudos, etc.">${U.esc(p.necessidadesDesc)}</textarea>
        </div>
        <div class="field full"><label for="fas-obs">Observações</label><textarea id="fas-obs" name="observacoes">${U.esc(p.observacoes)}</textarea></div>
        ${Anexos.campoHTML("Documentos (PDF ou foto)", "RG, laudos, comprovantes, termos. Até 5 arquivos.")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar cadastro</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    let salvo;
    try {
      salvo = Store.upsert("assistidos", { id: p.id || undefined, ...dados, nome: dados.nome.trim(), documentos: Anexos.lista() });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova algum documento e tente novamente.");
      return false;
    }
    U.toast("Cadastro salvo.");
    if (!p.id) location.hash = "#/assistido/" + salvo.id;
    else App.render();
  });
  Anexos.iniciar(p.documentos, 5);
  Anexos.ligar();
}

const ASSISTIDO_VAZIO = {
  nome: "", cpf: "", rg: "", nascimento: "", sexo: "", endereco: "", bairro: "", cidade: "",
  telefone: "", whatsapp: "", email: "", responsavel: "", escolaridade: "", escola: "",
  profissao: "", estadoCivil: "", encaminhadoPor: "", situacaoSocio: "", beneficios: "",
  atingidoEnchente: "", impactoEnchentes: "", necessidadesEspeciais: "", necessidadesDesc: "",
  observacoes: "", documentos: []
};

Actions.novoAssistido = () => abrirFormAssistido({ ...ASSISTIDO_VAZIO });
Actions.editarAssistido = id => abrirFormAssistido(Store.get("assistidos", id));
Actions.verAssistido = id => { location.hash = "#/assistido/" + id; };
Actions.voltarAssistidos = () => { location.hash = "#/assistencia"; };
Actions.excluirAssistido = id => {
  const p = Store.get("assistidos", id);
  if (confirm(`Excluir o cadastro de "${p.nome}"?`)) {
    Store.remover("assistidos", id);
    Store.col("compromissosAS").filter(c => c.assistidoId === id)
      .forEach(c => Store.upsert("compromissosAS", { ...c, assistidoId: "" }));
    U.toast("Cadastro excluído.");
    location.hash = "#/assistencia";
  }
};

/* ---------------- lista de espera ---------------- */

function viewEsperaAS() {
  const grupos = Store.esperaPorArea();
  const finalizados = Store.col("listaEspera")
    .filter(e => e.status === "atendido" || e.status === "desistiu")
    .sort((a, b) => (b.dataEntrada || "").localeCompare(a.dataEntrada || ""));

  let blocos = "";
  for (const [area, pessoas] of grupos) {
    blocos += `
      <div class="panel">
        <h3>${U.esc(area)} <span class="pill info">${pessoas.length} na fila</span></h3>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Nome</th><th>Contato</th><th>Entrada</th><th>Espera</th><th>Status</th><th></th></tr></thead>
          <tbody>${pessoas.map((e, i) => {
            const dias = e.dataEntrada ? Math.floor((Date.now() - new Date(e.dataEntrada + "T00:00:00")) / 86400000) : null;
            return `<tr>
              <td style="font-weight:800;">${i + 1}º</td>
              <td>${U.esc(e.nome)}</td>
              <td>${U.esc(e.telefone || "—")}</td>
              <td>${U.fmtData(e.dataEntrada)}</td>
              <td>${dias !== null ? `<span class="pill ${dias > 60 ? "bad" : dias > 30 ? "warn" : "muted"}">${dias} ${U.plural(dias, "dia", "dias")}</span>` : "—"}</td>
              <td><span class="pill ${e.status === "chamado" ? "warn" : "info"}">${U.esc(e.status)}</span></td>
              <td style="white-space:nowrap;">
                ${e.status === "aguardando" ? `<button class="btn sm ghost" data-action="esperaStatus" data-id="${e.id}:chamado">Chamar</button>` : ""}
                <button class="btn sm ghost" data-action="esperaStatus" data-id="${e.id}:atendido">Atendido</button>
                <button class="icon-btn" data-action="esperaStatus" data-id="${e.id}:desistiu" title="Desistiu">&#10005;</button>
              </td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Lista de espera</h2>
        <p>Filas por área, em ordem de chegada, com o tempo de espera de cada pessoa.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="csvEspera">Exportar planilha</button>
        <button class="btn accent" data-action="novaEspera">+ Adicionar à fila</button>
      </div>
    </div>
    ${subnavAS("espera")}
    ${blocos || `<div class="panel"><div class="empty-note">Ninguém aguardando no momento.<br>Use <strong>+ Adicionar à fila</strong>.</div></div>`}
    ${finalizados.length ? `
    <div class="panel">
      <h3>Histórico (atendidos e desistências)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Nome</th><th>Área</th><th>Entrada</th><th>Situação</th><th></th></tr></thead>
        <tbody>${finalizados.slice(0, 30).map(e => `
          <tr>
            <td>${U.esc(e.nome)}</td><td>${U.esc(e.area)}</td><td>${U.fmtData(e.dataEntrada)}</td>
            <td><span class="pill ${e.status === "atendido" ? "ok" : "muted"}">${U.esc(e.status)}</span></td>
            <td><button class="icon-btn" data-action="excluirEspera" data-id="${e.id}" title="Excluir" aria-label="Excluir">&#128465;</button></td>
          </tr>`).join("")}</tbody>
      </table></div>
    </div>` : ""}`;
}

Actions.novaEspera = () => {
  const optAreas = Store.config.areasEspera.map(a => `<option value="${U.esc(a)}">${U.esc(a)}</option>`).join("");
  App.abrirModal("Adicionar à lista de espera", `
    <form>
      <div class="form-grid">
        <div class="field full"><label for="fe2-nome">Nome completo *</label><input id="fe2-nome" name="nome" required></div>
        <div class="field"><label for="fe2-tel">Telefone/WhatsApp</label><input id="fe2-tel" name="telefone"></div>
        <div class="field">
          <label for="fe2-area">Área *</label>
          <div style="display:flex; gap:6px;">
            <select id="fe2-area" name="area" style="flex:1;">${optAreas}</select>
            <button type="button" class="btn ghost sm" data-modal-action="novaAreaEspera" title="Adicionar área">+</button>
          </div>
        </div>
        <div class="field"><label for="fe2-data">Data de entrada na fila</label><input id="fe2-data" name="dataEntrada" type="date" value="${U.hojeISO()}"></div>
        <div class="field full"><label for="fe2-obs">Observações</label><textarea id="fe2-obs" name="obs"></textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Adicionar à fila</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    Store.upsert("listaEspera", { ...dados, nome: dados.nome.trim(), status: "aguardando" });
    U.toast("Adicionado à lista de espera.");
    App.render();
  });
};

Actions.novaAreaEspera = () => {
  const nome = prompt("Nova área de atendimento (ex.: Fonoaudiologia, Jurídico):");
  if (!nome) return;
  const salvo = Store.addAreaEspera(nome);
  const sel = document.getElementById("fe2-area");
  if (sel && salvo) {
    sel.insertAdjacentHTML("beforeend", `<option value="${U.esc(salvo)}">${U.esc(salvo)}</option>`);
    sel.value = salvo;
  }
};

Actions.esperaStatus = ref => {
  const [id, status] = String(ref).split(":");
  const e = Store.col("listaEspera").find(x => x.id === id);
  if (!e) return;
  Store.upsert("listaEspera", { ...e, status });
  U.toast(status === "chamado" ? "Marcado como chamado." : status === "atendido" ? "Movido para atendidos." : "Registrada a desistência.");
  App.render();
};

Actions.excluirEspera = id => {
  if (confirm("Excluir este registro da lista de espera?")) {
    Store.remover("listaEspera", id);
    App.render();
  }
};

Actions.csvEspera = () => {
  const cab = ["Área", "Posição", "Nome", "Telefone", "Entrada", "Dias de espera", "Status", "Observações"];
  const linhas = [];
  for (const [area, pessoas] of Store.esperaPorArea()) {
    pessoas.forEach((e, i) => {
      const dias = e.dataEntrada ? Math.floor((Date.now() - new Date(e.dataEntrada + "T00:00:00")) / 86400000) : "";
      linhas.push(U.linhaCSV([area, i + 1, e.nome, e.telefone, U.fmtData(e.dataEntrada), dias, e.status, e.obs]));
    });
  }
  U.baixarArquivo("lista-de-espera-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Lista de espera exportada.");
};

/* ---------------- agenda interna ---------------- */

function viewAgendaAS() {
  const hoje = U.hojeISO();
  const todos = [...Store.col("compromissosAS")];
  const proximos = todos.filter(c => c.data >= hoje && c.status === "agendado")
    .sort((a, b) => (a.data + (a.hora || "")).localeCompare(b.data + (b.hora || "")));
  const passados = todos.filter(c => !(c.data >= hoje && c.status === "agendado"))
    .sort((a, b) => (b.data + (b.hora || "")).localeCompare(a.data + (a.hora || "")));

  const linha = c => {
    const pessoa = c.assistidoId ? Store.get("assistidos", c.assistidoId) : null;
    return `<tr>
      <td style="white-space:nowrap">${U.fmtData(c.data)} ${U.esc(c.hora || "")}</td>
      <td>${U.esc(c.titulo)}</td>
      <td>${pessoa ? `<a href="#/assistido/${pessoa.id}">${U.esc(pessoa.nome)}</a>` : "—"}</td>
      <td>${U.esc(c.responsavel || "—")}</td>
      <td><span class="pill ${{ agendado: "info", realizado: "ok", cancelado: "warn" }[c.status] || "muted"}">${U.esc(c.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" data-action="editarCompromisso" data-id="${c.id}" title="Editar" aria-label="Editar">&#9998;</button>
        <button class="icon-btn" data-action="excluirCompromisso" data-id="${c.id}" title="Excluir" aria-label="Excluir">&#128465;</button>
      </td>
    </tr>`;
  };
  const cab = `<thead><tr><th>Data</th><th>Compromisso</th><th>Pessoa</th><th>Responsável</th><th>Status</th><th></th></tr></thead>`;

  return `
    <div class="page-head">
      <div>
        <h2>Agenda interna</h2>
        <p>Agendamentos de atendimentos e compromissos da assistência social.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoCompromisso">+ Novo compromisso</button>
      </div>
    </div>
    ${subnavAS("agenda")}
    <div class="panel">
      <h3>Próximos</h3>
      ${proximos.length ? `<div class="table-wrap"><table>${cab}<tbody>${proximos.map(linha).join("")}</tbody></table></div>`
        : `<div class="empty-note">Nenhum compromisso futuro.</div>`}
    </div>
    <div class="panel">
      <h3>Histórico</h3>
      ${passados.length ? `<div class="table-wrap"><table>${cab}<tbody>${passados.map(linha).join("")}</tbody></table></div>`
        : `<div class="empty-note">Nenhum registro.</div>`}
    </div>`;
}

function abrirFormCompromisso(c) {
  const optPessoas = ['<option value="">— sem vínculo —</option>']
    .concat(U.ordenarPorNome(Store.col("assistidos")).map(p =>
      `<option value="${p.id}" ${c.assistidoId === p.id ? "selected" : ""}>${U.esc(p.nome)}</option>`)).join("");
  App.abrirModal(c.id ? "Editar compromisso" : "Novo compromisso", `
    <form>
      <div class="form-grid">
        <div class="field full"><label for="fc-titulo">Compromisso *</label>
          <input id="fc-titulo" name="titulo" required placeholder="ex.: Atendimento social, visita, reunião com CRAS" value="${U.esc(c.titulo)}"></div>
        <div class="field"><label for="fc-data">Data *</label><input id="fc-data" name="data" type="date" required value="${U.esc(c.data)}"></div>
        <div class="field"><label for="fc-hora">Hora</label><input id="fc-hora" name="hora" type="time" value="${U.esc(c.hora)}"></div>
        <div class="field"><label for="fc-pessoa">Pessoa atendida (opcional)</label><select id="fc-pessoa" name="assistidoId">${optPessoas}</select></div>
        <div class="field"><label for="fc-resp">Responsável</label><input id="fc-resp" name="responsavel" value="${U.esc(c.responsavel)}"></div>
        <div class="field">
          <label for="fc-status">Status</label>
          <select id="fc-status" name="status">
            ${["agendado", "realizado", "cancelado"].map(s => `<option value="${s}" ${(c.status || "agendado") === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field full"><label for="fc-obs">Observações</label><textarea id="fc-obs" name="obs">${U.esc(c.obs)}</textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar compromisso</button>
      </div>
    </form>`, dados => {
    if (!dados.titulo.trim() || !dados.data) return false;
    Store.upsert("compromissosAS", { id: c.id || undefined, ...dados, titulo: dados.titulo.trim() });
    U.toast("Compromisso salvo.");
    App.render();
  });
}

Actions.novoCompromisso = () => abrirFormCompromisso({ titulo: "", data: U.hojeISO(), hora: "", assistidoId: "", responsavel: "", status: "agendado", obs: "" });
Actions.editarCompromisso = id => abrirFormCompromisso(Store.col("compromissosAS").find(x => x.id === id));
Actions.excluirCompromisso = id => {
  if (confirm("Excluir este compromisso?")) {
    Store.remover("compromissosAS", id);
    App.render();
  }
};

/* ---------------- profissionais da assistência social ---------------- */

function viewProfSociais() {
  const profs = U.ordenarPorNome(Store.col("profsociais"));
  const cards = profs.map((p, i) => {
    const registros = [p.cress && "CRESS " + p.cress, p.formacao].filter(Boolean).join(" · ");
    return `
      <div class="entity-card cor-${(i % 8) + 1}">
        <div class="e-head">
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="avatar">${U.iniciais(p.nome)}</span>
            <div>
              <div class="e-title">${U.esc(p.nome)}</div>
              <div class="e-meta">${U.esc(p.funcao || "")}</div>
            </div>
          </div>
          <div class="e-actions">
            <button class="icon-btn" data-action="editarProfSocial" data-id="${p.id}" title="Editar" aria-label="Editar profissional">&#9998;</button>
            <button class="icon-btn" data-action="excluirProfSocial" data-id="${p.id}" title="Excluir" aria-label="Excluir profissional">&#128465;</button>
          </div>
        </div>
        ${registros ? `<div class="e-meta">${U.esc(registros)}</div>` : ""}
        <div class="e-meta">
          ${p.dias ? "Atende: " + U.esc(p.dias) : ""}${p.dias && p.horarios ? " · " : ""}${U.esc(p.horarios || "")}<br>
          ${U.esc(p.telefone || "")}${p.telefone && p.email ? " · " : ""}${U.esc(p.email || "")}
        </div>
        ${(p.documentos || []).length ? `<div class="cross-chips">${Anexos.links(p.documentos)}</div>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Assistente Social</h2>
        <p>Equipe da assistência social: assistentes sociais e apoio, com registro, contato e documentos.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoProfSocial">+ Novo profissional</button>
      </div>
    </div>
    ${subnavEquipe("assistente-social")}
    ${profs.length ? `<div class="grid-cards">${cards}</div>`
      : `<div class="panel"><div class="empty-note">Nenhum profissional cadastrado ainda.</div></div>`}
  `;
}

function abrirFormProfSocial(p) {
  App.abrirModal(p.id ? "Editar profissional" : "Novo profissional da assistência", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fps2-nome">Nome completo *</label>
          <input id="fps2-nome" name="nome" required value="${U.esc(p.nome)}">
        </div>
        <div class="field">
          <label for="fps2-funcao">Função / cargo</label>
          <input id="fps2-funcao" name="funcao" placeholder="ex.: Assistente social, Psicóloga, Apoio" value="${U.esc(p.funcao)}">
        </div>
        <div class="field">
          <label for="fps2-cress">CRESS (registro profissional)</label>
          <input id="fps2-cress" name="cress" placeholder="ex.: 10ª Região 12345" value="${U.esc(p.cress)}">
        </div>
        <div class="field full">
          <label for="fps2-form">Formação</label>
          <input id="fps2-form" name="formacao" value="${U.esc(p.formacao)}">
        </div>
        <div class="field">
          <label for="fps2-dias">Dias de atendimento</label>
          <input id="fps2-dias" name="dias" placeholder="ex.: Seg a Sex" value="${U.esc(p.dias)}">
        </div>
        <div class="field">
          <label for="fps2-hor">Horários</label>
          <input id="fps2-hor" name="horarios" placeholder="ex.: 8h–17h" value="${U.esc(p.horarios)}">
        </div>
        <div class="field">
          <label for="fps2-tel">Telefone</label>
          <input id="fps2-tel" name="telefone" value="${U.esc(p.telefone)}">
        </div>
        <div class="field">
          <label for="fps2-email">E-mail</label>
          <input id="fps2-email" name="email" type="email" value="${U.esc(p.email)}">
        </div>
        <div class="field full">
          <label for="fps2-obs">Observações</label>
          <textarea id="fps2-obs" name="obs">${U.esc(p.obs)}</textarea>
        </div>
        ${Anexos.campoHTML("Documentos (PDF ou foto)", "Diploma, registro, contrato, etc. Até 5 arquivos.")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar profissional</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    try {
      Store.upsert("profsociais", { id: p.id || undefined, ...dados, nome: dados.nome.trim(), documentos: Anexos.lista() });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova algum documento e tente novamente.");
      return false;
    }
    U.toast("Profissional salvo.");
    App.render();
  });
  Anexos.iniciar(p.documentos, 5);
  Anexos.ligar();
}

Actions.novoProfSocial = () => abrirFormProfSocial({
  nome: "", funcao: "", cress: "", formacao: "", dias: "", horarios: "",
  telefone: "", email: "", obs: "", documentos: []
});
Actions.editarProfSocial = id => abrirFormProfSocial(Store.get("profsociais", id));
Actions.excluirProfSocial = id => {
  const p = Store.get("profsociais", id);
  if (confirm(`Excluir o profissional "${p.nome}"?`)) {
    Store.remover("profsociais", id);
    U.toast("Profissional excluído.");
    App.render();
  }
};

/* ---------------- legislação e documentos ---------------- */

function viewLegislacaoAS() {
  const itens = [...Store.col("legislacaoAS")].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  return `
    <div class="page-head">
      <div>
        <h2>Legislação e documentos</h2>
        <p>Links de leis e normas (LOAS, ECA, LGPD…) e arquivos internos da assistência social.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novaLegislacao">+ Adicionar item</button>
      </div>
    </div>
    ${subnavAS("legislacao")}
    <div class="panel">
      ${itens.length ? `<div class="grid-cards">${itens.map((i, idx) => `
        <div class="entity-card cor-${(idx % 8) + 1}">
          <div class="e-head">
            <div class="e-title">${i.tipo === "link" ? "&#128279;" : "&#128196;"} ${U.esc(i.titulo)}</div>
            <div class="e-actions">
              <button class="icon-btn" data-action="excluirLegislacao" data-id="${i.id}" title="Excluir" aria-label="Excluir">&#128465;</button>
            </div>
          </div>
          ${i.obs ? `<div class="e-meta">${U.esc(i.obs)}</div>` : ""}
          <div>
            ${i.tipo === "link"
              ? `<a class="btn sm ghost" href="${U.esc(i.url)}" target="_blank" rel="noopener" style="text-decoration:none;">Abrir link &#8599;</a>`
              : (i.arquivo ? `<a class="btn sm ghost" href="${i.arquivo.dataUrl}" download="${U.esc(i.arquivo.nome)}" style="text-decoration:none;">Baixar ${U.esc(i.arquivo.nome)}</a>` : "")}
          </div>
        </div>`).join("")}</div>`
      : `<div class="empty-note">Nenhum item ainda.<br>Adicione links de legislação ou envie documentos em PDF.</div>`}
    </div>`;
}

Actions.novaLegislacao = () => {
  App.abrirModal("Adicionar legislação ou documento", `
    <form>
      <div class="form-grid">
        <div class="field full"><label for="fl2-titulo">Título *</label>
          <input id="fl2-titulo" name="titulo" required placeholder="ex.: LOAS — Lei Orgânica da Assistência Social"></div>
        <div class="field full">
          <label for="fl2-tipo">Tipo</label>
          <select id="fl2-tipo" name="tipo">
            <option value="link">Link (site, lei, Google Drive)</option>
            <option value="arquivo">Arquivo (PDF/foto, até 2 MB)</option>
          </select>
        </div>
        <div class="field full" id="fl2-url-area">
          <label for="fl2-url">Endereço (URL)</label>
          <input id="fl2-url" name="url" placeholder="https://…">
        </div>
        <div class="field full" id="fl2-arq-area" hidden>
          ${Anexos.campoHTML("Arquivo", "Um arquivo por item.")}
        </div>
        <div class="field full"><label for="fl2-obs">Observações</label><textarea id="fl2-obs" name="obs"></textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar</button>
      </div>
    </form>`, dados => {
    if (!dados.titulo.trim()) return false;
    if (dados.tipo === "link") {
      if (!dados.url.trim()) { alert("Informe o endereço (URL)."); return false; }
      let url = dados.url.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      Store.upsert("legislacaoAS", { titulo: dados.titulo.trim(), tipo: "link", url, obs: dados.obs });
    } else {
      const arqs = Anexos.lista();
      if (!arqs.length) { alert("Anexe o arquivo."); return false; }
      try {
        Store.upsert("legislacaoAS", { titulo: dados.titulo.trim(), tipo: "arquivo", arquivo: arqs[0], obs: dados.obs });
      } catch (e) {
        alert("Não foi possível salvar: armazenamento cheio. Prefira o tipo Link para arquivos grandes.");
        return false;
      }
    }
    U.toast("Item salvo.");
    App.render();
  });
  Anexos.iniciar([], 1);
  Anexos.ligar();
  const selTipo = document.getElementById("fl2-tipo");
  selTipo.addEventListener("change", () => {
    document.getElementById("fl2-url-area").hidden = selTipo.value !== "link";
    document.getElementById("fl2-arq-area").hidden = selTipo.value !== "arquivo";
  });
};

Actions.excluirLegislacao = id => {
  if (confirm("Excluir este item?")) {
    Store.remover("legislacaoAS", id);
    App.render();
  }
};

/* busca com foco preservado */
const aposRenderAS = Views.aposRender;
Views.aposRender = (rota, param) => {
  if (aposRenderAS) aposRenderAS(rota, param);
  if (rota !== "assistencia" || param) return;
  const campo = document.getElementById("busca-assistido");
  if (campo) {
    campo.addEventListener("input", () => {
      filtroAssistidos = campo.value;
      const pos = campo.selectionStart;
      App.render();
      const novo = document.getElementById("busca-assistido");
      if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
    });
  }
};

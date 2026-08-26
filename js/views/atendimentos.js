/* Módulo de Atendimentos clínicos: agenda, profissionais e relatórios.
   O cadastro de pacientes fica em js/views/pacientes.js. */
"use strict";

/* helpers compartilhados do módulo */
const AT = {
  espCorIndex(nome) {
    const i = Store.config.especialidades.findIndex(e => e === nome);
    return i >= 0 ? (i % 8) + 1 : 8;
  },
  espChip(nome) {
    return nome ? `<span class="chip cor-${AT.espCorIndex(nome)}">${U.esc(nome)}</span>` : "—";
  },
  statusPill(status) {
    const cls = {
      agendado: "muted", confirmado: "info", realizado: "ok", faltou: "bad", cancelado: "warn"
    }[status] || "muted";
    return `<span class="pill ${cls}">${U.esc(status)}</span>`;
  },
  subnav(ativa) {
    const abas = [
      ["", "Agenda"], ["pacientes", "Pacientes"],
      ["profissionais", "Profissionais"], ["relatorios", "Relatórios"],
      ["minha-area", "Minha área"]
    ];
    return `<div class="subtabs">${abas.map(([slug, rotulo]) =>
      `<a href="#/atendimentos${slug ? "/" + slug : ""}" class="${ativa === slug ? "active" : ""}">${rotulo}</a>`
    ).join("")}</div>`;
  }
};

const STATUS_ATEND = ["agendado", "confirmado", "realizado", "faltou", "cancelado"];

let filtroAgenda = { status: "", especialidade: "" };

Views.atendimentos = param => {
  if (param === "pacientes") return Views.pacientesLista();
  if (param === "profissionais") return viewProfSaude();
  if (param === "relatorios") return viewRelatoriosAtend();
  if (param === "minha-area") return viewMinhaArea();
  return viewAgenda();
};

/* ---------------- agenda ---------------- */

function linhaAtendimento(a) {
  const pac = Store.get("pacientes", a.pacienteId);
  const prof = Store.get("profsaude", a.profissionalId);
  return `
    <tr>
      <td style="white-space:nowrap">${U.fmtData(a.data)} ${U.esc(a.hora || "")}</td>
      <td>${pac ? `<a href="#/paciente/${pac.id}">${U.esc(pac.nome)}</a>` : "—"}</td>
      <td>${AT.espChip(a.especialidade)}</td>
      <td>${U.esc(prof ? prof.nome : "—")}</td>
      <td>${U.esc(a.tipoConsulta || "—")} · ${U.esc(a.formato || "—")} · ${U.esc(a.modalidade || "—")}</td>
      <td>${AT.statusPill(a.status)}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" data-action="editarAtend" data-id="${a.id}" title="Editar" aria-label="Editar atendimento">&#9998;</button>
        <button class="icon-btn" data-action="excluirAtend" data-id="${a.id}" title="Excluir" aria-label="Excluir atendimento">&#128465;</button>
      </td>
    </tr>`;
}

function viewAgenda() {
  const hoje = U.hojeISO();
  let lista = [...Store.col("atendimentos")];
  if (filtroAgenda.status) lista = lista.filter(a => a.status === filtroAgenda.status);
  if (filtroAgenda.especialidade) lista = lista.filter(a => a.especialidade === filtroAgenda.especialidade);

  const proximos = lista
    .filter(a => a.data >= hoje && ["agendado", "confirmado"].includes(a.status))
    .sort((x, y) => (x.data + (x.hora || "")).localeCompare(y.data + (y.hora || "")));
  const historico = lista
    .filter(a => !(a.data >= hoje && ["agendado", "confirmado"].includes(a.status)))
    .sort((x, y) => (y.data + (y.hora || "")).localeCompare(x.data + (x.hora || "")));

  const selStatus = `<select id="fil-status" class="search-input" style="min-width:auto;">
    <option value="">Todos os status</option>
    ${STATUS_ATEND.map(s => `<option value="${s}" ${filtroAgenda.status === s ? "selected" : ""}>${s}</option>`).join("")}
  </select>`;
  const selEsp = `<select id="fil-esp" class="search-input" style="min-width:auto;">
    <option value="">Todas as especialidades</option>
    ${Store.config.especialidades.map(e => `<option value="${U.esc(e)}" ${filtroAgenda.especialidade === e ? "selected" : ""}>${U.esc(e)}</option>`).join("")}
  </select>`;

  const cab = `<thead><tr><th>Data</th><th>Paciente</th><th>Especialidade</th><th>Profissional</th><th>Tipo</th><th>Status</th><th></th></tr></thead>`;

  return `
    <div class="page-head">
      <div>
        <h2>Atendimentos</h2>
        <p>Agenda de Psicologia, Psiquiatria e Neuropsicopedagogia. Clique no paciente para abrir a ficha.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoAtend">+ Novo atendimento</button>
      </div>
    </div>
    ${AT.subnav("")}

    <div class="panel">
      <div class="head-actions" style="margin-bottom:14px;">${selStatus}${selEsp}</div>
      <h3>Próximos atendimentos</h3>
      <p class="panel-sub">Agendados e confirmados a partir de hoje</p>
      ${proximos.length ? `<div class="table-wrap"><table>${cab}<tbody>${proximos.map(linhaAtendimento).join("")}</tbody></table></div>`
        : `<div class="empty-note">Nenhum atendimento futuro${filtroAgenda.status || filtroAgenda.especialidade ? " com esses filtros" : ""}.</div>`}
    </div>

    <div class="panel">
      <h3>Histórico</h3>
      <p class="panel-sub">Realizados, faltas, cancelados e registros passados</p>
      ${historico.length ? `<div class="table-wrap"><table>${cab}<tbody>${historico.map(linhaAtendimento).join("")}</tbody></table></div>`
        : `<div class="empty-note">Nenhum registro no histórico.</div>`}
    </div>
  `;
}

function abrirFormAtend(a) {
  const pacs = U.ordenarPorNome(Store.col("pacientes"));
  if (!pacs.length) { U.toast("Cadastre um paciente primeiro (aba Pacientes)."); return; }
  const profs = U.ordenarPorNome(Store.col("profsaude"));

  const optPac = pacs.map(p => `<option value="${p.id}" ${a.pacienteId === p.id ? "selected" : ""}>${U.esc(p.nome)}</option>`).join("");
  const optProf = ['<option value="">— sem profissional —</option>']
    .concat(profs.map(p => `<option value="${p.id}" data-esp="${U.esc(p.especialidade)}" ${a.profissionalId === p.id ? "selected" : ""}>${U.esc(p.nome + " (" + p.especialidade + ")")}</option>`)).join("");
  const optEsp = Store.config.especialidades.map(e =>
    `<option value="${U.esc(e)}" ${a.especialidade === e ? "selected" : ""}>${U.esc(e)}</option>`).join("");

  const radios = (nome, opcoes, atual) => opcoes.map(o =>
    `<label style="display:inline-flex; align-items:center; gap:5px; margin-right:14px; font-size:0.85rem;">
      <input type="radio" name="${nome}" value="${o}" ${atual === o ? "checked" : ""}> ${o}
    </label>`).join("");

  App.abrirModal(a.id ? "Editar atendimento" : "Novo atendimento", `
    <form>
      <div class="form-grid">
        <div class="field">
          <label for="fat-data">Data *</label>
          <input id="fat-data" name="data" type="date" required value="${U.esc(a.data || U.hojeISO())}">
        </div>
        <div class="field">
          <label for="fat-hora">Hora</label>
          <input id="fat-hora" name="hora" type="time" value="${U.esc(a.hora)}">
        </div>
        <div class="field">
          <label for="fat-pac">Paciente *</label>
          <select id="fat-pac" name="pacienteId" required>${optPac}</select>
        </div>
        <div class="field">
          <label for="fat-prof">Profissional</label>
          <select id="fat-prof" name="profissionalId">${optProf}</select>
        </div>
        <div class="field">
          <label for="fat-esp">Especialidade *</label>
          <select id="fat-esp" name="especialidade" required>${optEsp}</select>
        </div>
        <div class="field">
          <label for="fat-status">Status</label>
          <select id="fat-status" name="status">
            ${STATUS_ATEND.map(s => `<option value="${s}" ${(a.status || "agendado") === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field full"><label>Tipo de consulta</label><div>${radios("tipoConsulta", ["primeira", "retorno"], a.tipoConsulta || "primeira")}</div></div>
        <div class="field full"><label>Formato</label><div>${radios("formato", ["individual", "grupo"], a.formato || "individual")}</div></div>
        <div class="field full"><label>Modalidade</label><div>${radios("modalidade", ["presencial", "online"], a.modalidade || "presencial")}</div></div>
        <div class="field full">
          <label for="fat-obs">Observações administrativas</label>
          <textarea id="fat-obs" name="obs">${U.esc(a.obs)}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar atendimento</button>
      </div>
    </form>`, dados => {
    if (!dados.data || !dados.pacienteId) return false;
    Store.upsert("atendimentos", { id: a.id || undefined, ...dados });
    U.toast("Atendimento salvo.");
    App.render();
  });

  /* ao escolher o profissional, preenche a especialidade automaticamente */
  const selProf = document.getElementById("fat-prof");
  selProf.addEventListener("change", () => {
    const esp = selProf.selectedOptions[0]?.dataset.esp;
    if (esp) document.getElementById("fat-esp").value = esp;
  });
}

Actions.novoAtend = () => abrirFormAtend({
  data: U.hojeISO(), hora: "", pacienteId: "", profissionalId: "",
  especialidade: Store.config.especialidades[0], tipoConsulta: "primeira",
  formato: "individual", modalidade: "presencial", status: "agendado", obs: ""
});
Actions.editarAtend = id => abrirFormAtend(Store.col("atendimentos").find(x => x.id === id));
Actions.excluirAtend = id => {
  if (confirm("Excluir este atendimento?")) {
    Store.remover("atendimentos", id);
    U.toast("Atendimento excluído.");
    App.render();
  }
};
/* usado pela ficha do paciente */
Actions.novoAtendPaciente = pacienteId => abrirFormAtend({
  data: U.hojeISO(), hora: "", pacienteId, profissionalId: "",
  especialidade: Store.config.especialidades[0], tipoConsulta: "primeira",
  formato: "individual", modalidade: "presencial", status: "agendado", obs: ""
});

/* ---------------- profissionais de saúde ---------------- */

function viewProfSaude() {
  const profs = U.ordenarPorNome(Store.col("profsaude"));
  const cards = profs.map(p => {
    const qtd = Store.col("atendimentos").filter(a => a.profissionalId === p.id).length;
    const registros = [p.crp && "CRP " + p.crp, p.crm && p.crm, p.registro].filter(Boolean).join(" · ");
    return `
      <div class="entity-card cor-${AT.espCorIndex(p.especialidade)}">
        <div class="e-head">
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="avatar">${U.iniciais(p.nome)}</span>
            <div>
              <div class="e-title">${U.esc(p.nome)}</div>
              <div class="e-meta">${U.esc(registros || "")}</div>
            </div>
          </div>
          <div class="e-actions">
            <button class="icon-btn" data-action="editarProfSaude" data-id="${p.id}" title="Editar" aria-label="Editar profissional">&#9998;</button>
            <button class="icon-btn" data-action="excluirProfSaude" data-id="${p.id}" title="Excluir" aria-label="Excluir profissional">&#128465;</button>
          </div>
        </div>
        <div class="cross-chips">${AT.espChip(p.especialidade)}</div>
        <div class="e-meta">
          ${p.dias ? "Atende: " + U.esc(p.dias) : ""}${p.dias && p.horarios ? " · " : ""}${U.esc(p.horarios || "")}<br>
          ${U.esc(p.telefone || "")}${p.telefone && p.email ? " · " : ""}${U.esc(p.email || "")}<br>
          ${qtd} ${U.plural(qtd, "atendimento registrado", "atendimentos registrados")}
        </div>
        ${(p.arquivos || []).length ? `<div class="cross-chips">${Anexos.links(p.arquivos)}</div>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Profissionais de saúde</h2>
        <p>Equipe clínica: psicólogos, psiquiatras e neuropsicopedagogos, com registro e horários.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoProfSaude">+ Novo profissional</button>
      </div>
    </div>
    ${AT.subnav("profissionais")}
    ${profs.length ? `<div class="grid-cards">${cards}</div>`
      : `<div class="panel"><div class="empty-note">Nenhum profissional cadastrado ainda.</div></div>`}
  `;
}

function abrirFormProfSaude(p) {
  const optEsp = Store.config.especialidades.map(e =>
    `<option value="${U.esc(e)}" ${p.especialidade === e ? "selected" : ""}>${U.esc(e)}</option>`).join("");
  App.abrirModal(p.id ? "Editar profissional" : "Novo profissional", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fps-nome">Nome completo *</label>
          <input id="fps-nome" name="nome" required value="${U.esc(p.nome)}">
        </div>
        <div class="field">
          <label for="fps-esp">Especialidade *</label>
          <div style="display:flex; gap:6px;">
            <select id="fps-esp" name="especialidade" style="flex:1;">${optEsp}</select>
            <button type="button" class="btn ghost sm" data-modal-action="novaEspecialidade" title="Adicionar especialidade">+</button>
          </div>
        </div>
        <div class="field">
          <label for="fps-crp">CRP</label>
          <input id="fps-crp" name="crp" placeholder="ex.: 07/12345" value="${U.esc(p.crp)}">
        </div>
        <div class="field">
          <label for="fps-crm">CRM</label>
          <input id="fps-crm" name="crm" placeholder="ex.: CRM-RS 45678" value="${U.esc(p.crm)}">
        </div>
        <div class="field">
          <label for="fps-reg">Outro registro profissional</label>
          <input id="fps-reg" name="registro" placeholder="ex.: ABPp 3321" value="${U.esc(p.registro)}">
        </div>
        <div class="field">
          <label for="fps-dias">Dias de atendimento</label>
          <input id="fps-dias" name="dias" placeholder="ex.: Seg, Qua e Sex" value="${U.esc(p.dias)}">
        </div>
        <div class="field">
          <label for="fps-hor">Horários</label>
          <input id="fps-hor" name="horarios" placeholder="ex.: 13h–18h" value="${U.esc(p.horarios)}">
        </div>
        <div class="field">
          <label for="fps-tel">Telefone</label>
          <input id="fps-tel" name="telefone" value="${U.esc(p.telefone)}">
        </div>
        <div class="field">
          <label for="fps-email">E-mail</label>
          <input id="fps-email" name="email" type="email" value="${U.esc(p.email)}">
        </div>
        ${App.ehAdmin() ? `
        <div class="form-section">Acesso à "Minha área" (somente admin/presidência altera)</div>
        <div class="field">
          <label for="fps-pin">PIN de acesso (4 a 6 dígitos)</label>
          <input id="fps-pin" name="pinNovo" type="password" inputmode="numeric" minlength="4" maxlength="6"
            placeholder="${p.pinHash ? "já cadastrado — preencha para trocar" : "defina o PIN do profissional"}" autocomplete="new-password">
        </div>` : ""}
        ${Anexos.campoHTML("Documentos (PDF)", "Registro no conselho, contrato, comprovantes, etc. Até 5 arquivos.")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar profissional</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    const { pinNovo, ...resto } = dados;
    const obj = { id: p.id || undefined, ...resto, nome: dados.nome.trim(), pinHash: p.pinHash || "", arquivos: Anexos.lista() };
    if (pinNovo && pinNovo.trim()) {
      if (!/^\d{4,6}$/.test(pinNovo.trim())) { alert("O PIN deve ter de 4 a 6 dígitos numéricos."); return false; }
      obj.pinHash = U.hashPin(pinNovo.trim());
    }
    try {
      Store.upsert("profsaude", obj);
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova algum anexo e tente novamente.");
      return false;
    }
    U.toast("Profissional salvo.");
    App.render();
  });
  Anexos.iniciar(p.arquivos, 5);
  Anexos.ligar();
}

Actions.novoProfSaude = () => abrirFormProfSaude({
  nome: "", especialidade: Store.config.especialidades[0], crp: "", crm: "", registro: "",
  dias: "", horarios: "", telefone: "", email: "", pinHash: "", arquivos: []
});
Actions.editarProfSaude = id => abrirFormProfSaude(Store.get("profsaude", id));
Actions.excluirProfSaude = id => {
  const p = Store.get("profsaude", id);
  if (confirm(`Excluir o profissional "${p.nome}"?\nOs atendimentos dele ficam no histórico, sem profissional vinculado.`)) {
    Store.remover("profsaude", id);
    U.toast("Profissional excluído.");
    App.render();
  }
};
Actions.novaEspecialidade = () => {
  const nome = prompt("Nova especialidade (ex.: Fonoaudiologia):");
  if (!nome) return;
  const salvo = Store.addEspecialidade(nome);
  const sel = document.getElementById("fps-esp");
  if (sel && salvo) {
    sel.insertAdjacentHTML("beforeend", `<option value="${U.esc(salvo)}">${U.esc(salvo)}</option>`);
    sel.value = salvo;
  }
  U.toast("Especialidade adicionada.");
};

/* ---------------- relatórios do módulo ---------------- */

function viewRelatoriosAtend() {
  const r = Store.resumoAtendimentos();
  const fin = Store.resumoFinanceiro();
  const cruz = Store.cruzamentoAtendimentos();

  if (!r.total && !r.pacientes) {
    return `
      <div class="page-head"><div><h2>Relatórios de atendimentos</h2>
      <p>Gráficos, planilhas e cruzamento de dados do módulo clínico.</p></div></div>
      ${AT.subnav("relatorios")}
      <div class="panel"><div class="empty-note">Ainda não há pacientes ou atendimentos registrados.</div></div>`;
  }

  const donutEsp = Charts.donut(
    r.porEspecialidade.map(x => ({ label: x.nome, value: x.qtd, color: `var(--p${AT.espCorIndex(x.nome)})` })),
    { subtitulo: "atendimentos" });

  const corStatus = { agendado: "#A8A296", confirmado: "var(--p4)", realizado: "var(--good)", faltou: "var(--danger)", cancelado: "var(--warn)" };
  const donutStatus = Charts.donut(
    Object.entries(r.porStatus).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: k, value: v, color: corStatus[k] })),
    { subtitulo: "atendimentos" });

  const barsProf = Charts.bars(
    Store.atendimentosPorProfissional().filter(x => x.qtd > 0)
      .map(x => ({ label: x.profissional.nome, value: x.qtd, color: `var(--p${AT.espCorIndex(x.profissional.especialidade)})` })));

  const barsMod = Charts.bars(
    r.porModalidade.map((x, i) => ({ label: x.nome, value: x.qtd, color: Charts.cor.p(i + 3) })));

  const linhasCruz = cruz.multi.map(x => `
    <tr>
      <td><a href="#/paciente/${x.paciente.id}">${U.esc(x.paciente.nome)}</a></td>
      <td>${x.especialidades.length}</td>
      <td><div class="cross-chips">${x.especialidades.map(AT.espChip).join("")}</div></td>
    </tr>`).join("");

  const pagantes = U.ordenarPorNome(Store.col("pacientes").filter(p => p.tipoAtendimento === "pago"));
  const linhasPag = pagantes.map(p => `
    <tr>
      <td><a href="#/paciente/${p.id}">${U.esc(p.nome)}</a></td>
      <td>${p.cobranca === "mensal" ? "Mensal" : "Por consulta"}</td>
      <td>${U.moeda(p.valor)}</td>
    </tr>`).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Relatórios de atendimentos</h2>
        <p>Gráficos, financeiro, planilhas e cruzamento de especialidades por paciente.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="imprimir">Imprimir / PDF</button>
      </div>
    </div>
    ${AT.subnav("relatorios")}

    <section class="stat-strip">
      <div class="stat-card" style="--stat-color: var(--navy-strong)">
        <span class="label">Pacientes</span>
        <span class="value">${r.pacientes}</span>
        <span class="delta">${fin.pagantes} ${U.plural(fin.pagantes, "pagante", "pagantes")} · ${fin.gratuitos} ${U.plural(fin.gratuitos, "gratuito", "gratuitos")}</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--accent)">
        <span class="label">Atendimentos</span>
        <span class="value">${r.total}</span>
        <span class="delta">${r.proximos} ${U.plural(r.proximos, "próximo agendado", "próximos agendados")}</span>
      </div>
      <div class="stat-card" style="--stat-color: ${r.taxaFalta !== null && r.taxaFalta > 20 ? "var(--danger)" : "var(--good)"}">
        <span class="label">Taxa de faltas</span>
        <span class="value">${r.taxaFalta !== null ? r.taxaFalta + "%" : "—"}</span>
        <span class="delta">faltas sobre realizados + faltas</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--p5)">
        <span class="label">Receita prevista no mês</span>
        <span class="value" style="font-size:1.4rem;">${U.moeda(fin.previstoMes)}</span>
        <span class="delta">${U.moeda(fin.mensal)} mensal + ${U.moeda(fin.porConsultaMes)} por consulta</span>
      </div>
    </section>

    <section class="grid-2-even">
      <div class="panel">
        <h3>Atendimentos por especialidade</h3>
        <p class="panel-sub">Psicologia, Psiquiatria e Neuropsicopedagogia</p>
        ${donutEsp}
      </div>
      <div class="panel">
        <h3>Situação dos atendimentos</h3>
        <p class="panel-sub">Agendado, confirmado, realizado, faltou e cancelado</p>
        ${donutStatus}
      </div>
    </section>

    <section class="grid-2-even">
      <div class="panel">
        <h3>Atendimentos por profissional</h3>
        <p class="panel-sub">Total de registros por membro da equipe</p>
        ${barsProf}
      </div>
      <div class="panel">
        <h3>Presencial × online</h3>
        <p class="panel-sub">Modalidade dos atendimentos</p>
        ${barsMod}
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <h3>Pacientes com mais de uma especialidade</h3>
        <p class="panel-sub">Cruzamento de dados: quem usa mais de um serviço</p>
        ${cruz.multi.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Paciente</th><th>Nº</th><th>Especialidades</th></tr></thead>
          <tbody>${linhasCruz}</tbody>
        </table></div>
        ${cruz.combos.length ? `<div class="combo-note">Combinação mais comum: <strong>${U.esc(cruz.combos[0][0])}</strong> (${cruz.combos[0][1]} ${U.plural(cruz.combos[0][1], "paciente", "pacientes")}).</div>` : ""}`
        : `<div class="empty-note">Nenhum paciente com mais de uma especialidade ainda.</div>`}
      </div>
      <div class="panel">
        <h3>Atendimentos pagos</h3>
        <p class="panel-sub">Pacientes pagantes e forma de cobrança</p>
        ${pagantes.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Paciente</th><th>Cobrança</th><th>Valor</th></tr></thead>
          <tbody>${linhasPag}</tbody>
        </table></div>` : `<div class="empty-note">Nenhum paciente pagante cadastrado.</div>`}
      </div>
    </section>

    <div class="panel">
      <h3>Exportar planilhas (CSV — abre no Excel)</h3>
      <p class="panel-sub">Dados do módulo de atendimentos</p>
      <div class="head-actions">
        <button class="btn" data-action="csvPacientes">Pacientes (cadastro completo)</button>
        <button class="btn" data-action="csvAtendimentos">Agenda de atendimentos</button>
        <button class="btn" data-action="csvCruzAtend">Especialidades por paciente</button>
      </div>
    </div>
  `;
}

/* ---------------- Minha área (área restrita do profissional) ---------------- */

const CHAVE_PROF_LOGADO = "bzn-prof-logado";

function profLogado() {
  const id = sessionStorage.getItem(CHAVE_PROF_LOGADO);
  if (!id) return null;
  const p = Store.get("profsaude", id);
  if (!p) { sessionStorage.removeItem(CHAVE_PROF_LOGADO); return null; }
  return p;
}

function viewMinhaArea() {
  const prof = profLogado();
  if (!prof) return viewLoginProf();

  const meus = Store.col("atendimentos").filter(a => a.profissionalId === prof.id);
  const hoje = U.hojeISO();
  const proximos = meus
    .filter(a => a.data >= hoje && ["agendado", "confirmado"].includes(a.status))
    .sort((x, y) => (x.data + (x.hora || "")).localeCompare(y.data + (y.hora || "")));
  const historico = meus
    .filter(a => !(a.data >= hoje && ["agendado", "confirmado"].includes(a.status)))
    .sort((x, y) => (y.data + (y.hora || "")).localeCompare(x.data + (x.hora || "")));

  const realizados = meus.filter(a => a.status === "realizado").length;
  const faltas = meus.filter(a => a.status === "faltou").length;
  const taxaFalta = (realizados + faltas) ? Math.round((faltas / (realizados + faltas)) * 100) : null;

  /* pacientes deste profissional (dados administrativos, sem informações clínicas) */
  const idsPac = [...new Set(meus.map(a => a.pacienteId))];
  const pacientes = U.ordenarPorNome(idsPac.map(id => Store.get("pacientes", id)).filter(Boolean));
  const linhasPac = pacientes.map(p => {
    const doPac = meus.filter(a => a.pacienteId === p.id);
    const ultimo = doPac.filter(a => a.status === "realizado").sort((x, y) => y.data.localeCompare(x.data))[0];
    const fin = p.tipoAtendimento === "pago"
      ? `<span class="pill info">pago</span> ${p.cobranca === "mensal" ? U.moeda(p.valor) + "/mês" : U.moeda(p.valor) + "/consulta"}`
      : `<span class="pill ok">gratuito</span>`;
    return `<tr>
      <td>${U.esc(p.nome)}</td>
      <td>${U.esc(p.whatsapp || p.telefone || "—")}</td>
      <td>${fin}</td>
      <td>${doPac.length}</td>
      <td>${ultimo ? U.fmtData(ultimo.data) : "—"}</td>
    </tr>`;
  }).join("");

  const linhaMinha = a => {
    const pac = Store.get("pacientes", a.pacienteId);
    return `<tr>
      <td style="white-space:nowrap">${U.fmtData(a.data)} ${U.esc(a.hora || "")}</td>
      <td>${U.esc(pac ? pac.nome : "—")}</td>
      <td>${U.esc(a.tipoConsulta || "—")} · ${U.esc(a.formato || "—")} · ${U.esc(a.modalidade || "—")}</td>
      <td>${AT.statusPill(a.status)}</td>
      <td><button class="icon-btn" data-action="editarAtend" data-id="${a.id}" title="Atualizar status" aria-label="Atualizar atendimento">&#9998;</button></td>
    </tr>`;
  };
  const cab = `<thead><tr><th>Data</th><th>Paciente</th><th>Tipo</th><th>Status</th><th></th></tr></thead>`;

  return `
    <div class="page-head">
      <div>
        <h2>Minha área — ${U.esc(prof.nome)}</h2>
        <p>${U.esc(prof.especialidade)} · seus pacientes e sua agenda. Dados administrativos apenas — o sistema não guarda informações clínicas.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="sairProf">Sair da minha área</button>
      </div>
    </div>
    ${AT.subnav("minha-area")}

    <section class="stat-strip">
      <div class="stat-card" style="--stat-color: var(--p${AT.espCorIndex(prof.especialidade)})">
        <span class="label">Meus pacientes</span>
        <span class="value">${pacientes.length}</span>
        <span class="delta">${pacientes.filter(p => p.tipoAtendimento === "pago").length} pagantes · ${pacientes.filter(p => p.tipoAtendimento !== "pago").length} gratuitos</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--accent)">
        <span class="label">Atendimentos</span>
        <span class="value">${meus.length}</span>
        <span class="delta">${realizados} realizados</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--navy-strong)">
        <span class="label">Próximos</span>
        <span class="value">${proximos.length}</span>
        <span class="delta">agendados e confirmados</span>
      </div>
      <div class="stat-card" style="--stat-color: ${taxaFalta !== null && taxaFalta > 20 ? "var(--danger)" : "var(--good)"}">
        <span class="label">Taxa de faltas</span>
        <span class="value">${taxaFalta !== null ? taxaFalta + "%" : "—"}</span>
        <span class="delta">dos meus atendimentos</span>
      </div>
    </section>

    <div class="panel">
      <h3>Minha agenda — próximos</h3>
      <p class="panel-sub">Somente os seus atendimentos</p>
      ${proximos.length ? `<div class="table-wrap"><table>${cab}<tbody>${proximos.map(linhaMinha).join("")}</tbody></table></div>`
        : `<div class="empty-note">Nenhum atendimento futuro.</div>`}
    </div>

    <div class="panel">
      <h3>Meus pacientes</h3>
      <p class="panel-sub">Contato, condição financeira e histórico — sem dados clínicos</p>
      ${pacientes.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Paciente</th><th>Contato</th><th>Financeiro</th><th>Atendimentos</th><th>Último realizado</th></tr></thead>
        <tbody>${linhasPac}</tbody>
      </table></div>` : `<div class="empty-note">Você ainda não tem pacientes vinculados.</div>`}
    </div>

    <div class="panel">
      <h3>Histórico dos meus atendimentos</h3>
      <p class="panel-sub">Realizados, faltas e cancelados</p>
      ${historico.length ? `<div class="table-wrap"><table>${cab}<tbody>${historico.map(linhaMinha).join("")}</tbody></table></div>`
        : `<div class="empty-note">Nenhum registro ainda.</div>`}
    </div>
  `;
}

function viewLoginProf() {
  const profs = U.ordenarPorNome(Store.col("profsaude"));
  return `
    <div class="page-head">
      <div>
        <h2>Minha área</h2>
        <p>Acesso restrito: cada profissional vê apenas os próprios pacientes e a própria agenda.</p>
      </div>
    </div>
    ${AT.subnav("minha-area")}

    <div class="panel" style="max-width:480px;">
      <h3>Entrar</h3>
      <p class="panel-sub">Escolha seu nome e digite seu PIN</p>
      ${profs.length ? `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field">
          <label for="login-prof">Profissional</label>
          <select id="login-prof">
            ${profs.map(p => `<option value="${p.id}">${U.esc(p.nome + " — " + p.especialidade)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="login-pin">PIN</label>
          <input id="login-pin" type="password" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos" autocomplete="off">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn accent" data-action="entrarProf">Entrar</button>
      </div>
      <div class="alert-box info" style="margin-top:14px;">
        <span class="ico">&#128274;</span>
        <div><p>O PIN é cadastrado pela secretaria no formulário do profissional (aba Profissionais). Esta área organiza o acesso no dia a dia, mas os dados continuam no navegador deste computador.</p></div>
      </div>`
      : `<div class="empty-note" style="text-align:left;">
          <p style="margin:0 0 8px;"><strong>Nenhum profissional aparece neste aparelho.</strong></p>
          <p style="margin:0 0 12px; font-size:0.9rem;">Se o instituto já usa o sistema, é porque <strong>este computador ainda não baixou os dados</strong> da nuvem. Traga-os uma vez (depois é só entrar com o PIN):</p>
          <button class="btn accent" data-action="conectarNuvem">&#9729;&#65039; Trazer os dados do instituto</button>
          <p style="margin:12px 0 0; font-size:0.82rem; color:var(--text-muted);">Se for a primeiríssima vez do instituto, cadastre a equipe na aba <strong>Profissionais</strong> (entrando como admin).</p>
        </div>`}
    </div>
  `;
}

Actions.entrarProf = () => {
  const id = document.getElementById("login-prof").value;
  const pin = document.getElementById("login-pin").value.trim();
  const p = Store.get("profsaude", id);
  if (!p) return;
  if (!p.pinHash) { alert("Este profissional ainda não tem PIN cadastrado.\nPeça para a secretaria definir o PIN na aba Profissionais → editar."); return; }
  if (U.hashPin(pin) !== p.pinHash) {
    U.toast("PIN incorreto.");
    document.getElementById("login-pin").value = "";
    document.getElementById("login-pin").focus();
    return;
  }
  sessionStorage.setItem(CHAVE_PROF_LOGADO, p.id);
  U.toast(`Bem-vindo(a), ${p.nome.split(" ")[0]}!`);
  App.render();
};

Actions.sairProf = () => {
  sessionStorage.removeItem(CHAVE_PROF_LOGADO);
  U.toast("Você saiu da sua área.");
  App.render();
};

/* filtros da agenda */
const aposRenderAtend = Views.aposRender;
Views.aposRender = (rota, param) => {
  if (aposRenderAtend) aposRenderAtend(rota, param);
  if (rota !== "atendimentos") return;
  const fs = document.getElementById("fil-status");
  const fe = document.getElementById("fil-esp");
  if (fs) fs.addEventListener("change", () => { filtroAgenda.status = fs.value; App.render(); });
  if (fe) fe.addEventListener("change", () => { filtroAgenda.especialidade = fe.value; App.render(); });
};

/* exportações CSV do módulo */
Actions.csvPacientes = () => {
  const cab = ["Nome", "CPF", "RG", "Nascimento", "Idade", "Sexo", "Endereço", "Bairro", "Cidade",
    "Telefone", "WhatsApp", "E-mail", "Responsável", "Escolaridade", "Escola", "Profissão",
    "Estado civil", "Encaminhado por", "Situação socioeconômica", "Benefícios sociais",
    "Atingido pelas enchentes", "Impacto das enchentes",
    "Tipo de atendimento", "Cobrança", "Valor", "Especialidades que usa", "Observações"];
  const linhas = U.ordenarPorNome(Store.col("pacientes")).map(p => U.linhaCSV([
    p.nome, p.cpf, p.rg, U.fmtData(p.nascimento), U.idade(p.nascimento) ?? "", p.sexo,
    p.endereco, p.bairro, p.cidade, p.telefone, p.whatsapp, p.email, p.responsavel,
    p.escolaridade, p.escola, p.profissao, p.estadoCivil, p.encaminhadoPor,
    p.situacaoSocio, p.beneficios,
    p.atingidoEnchente === "sim" ? "Sim" : p.atingidoEnchente === "nao" ? "Não" : "",
    p.impactoEnchentes,
    p.tipoAtendimento === "pago" ? "Pago" : "Gratuito",
    p.tipoAtendimento === "pago" ? (p.cobranca === "mensal" ? "Mensal" : "Por consulta") : "",
    p.tipoAtendimento === "pago" ? p.valor : "",
    Store.especialidadesDoPaciente(p.id).join(" + "), p.observacoes
  ]));
  U.baixarArquivo("pacientes-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha de pacientes exportada.");
};

Actions.csvAtendimentos = () => {
  const cab = ["Data", "Hora", "Paciente", "Profissional", "Especialidade", "Tipo de consulta",
    "Formato", "Modalidade", "Status", "Observações"];
  const linhas = [...Store.col("atendimentos")]
    .sort((x, y) => (x.data + (x.hora || "")).localeCompare(y.data + (y.hora || "")))
    .map(a => {
      const pac = Store.get("pacientes", a.pacienteId);
      const prof = Store.get("profsaude", a.profissionalId);
      return U.linhaCSV([U.fmtData(a.data), a.hora, pac ? pac.nome : "", prof ? prof.nome : "",
        a.especialidade, a.tipoConsulta, a.formato, a.modalidade, a.status, a.obs]);
    });
  U.baixarArquivo("atendimentos-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha de atendimentos exportada.");
};

Actions.csvCruzAtend = () => {
  const cab = ["Paciente", "Nº de especialidades", "Especialidades"];
  const linhas = U.ordenarPorNome(Store.col("pacientes")).map(p => {
    const es = Store.especialidadesDoPaciente(p.id);
    return U.linhaCSV([p.nome, es.length, es.join(" + ")]);
  });
  U.baixarArquivo("especialidades-por-paciente-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha de cruzamento exportada.");
};

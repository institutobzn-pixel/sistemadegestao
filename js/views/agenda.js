/* Agenda geral do instituto: eventos com local, data, horário e palestrante.
   A lista mostra todos os eventos agendados, agrupados por mês. */
"use strict";

const TIPOS_EVENTO = [
  ["curso", "Curso", 1],
  ["workshop", "Workshop", 2],
  ["palestra", "Palestra", 5],
  ["imersao", "Imersão", 6],
  ["evento", "Evento", 3],
  ["reuniao", "Reunião", 4],
  ["outro", "Outro", 8]
];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function tipoEventoChip(tipo) {
  const t = TIPOS_EVENTO.find(x => x[0] === tipo) || TIPOS_EVENTO[5];
  return `<span class="chip cor-${t[2]}">${t[1]}</span>`;
}

/* todos os eventos, do mais antigo ao mais recente */
function eventosOrdenados() {
  return Store.col("eventos")
    .filter(e => e.data)
    .sort((x, y) => (x.data + (x.horaInicio || "")).localeCompare(y.data + (y.horaInicio || "")));
}

Views.agenda = () => {
  const eventos = eventosOrdenados();

  /* agrupa por mês/ano */
  let corpo = "";
  let grupoAtual = "";
  for (const e of eventos) {
    const ano = e.data.slice(0, 4);
    const mes = Number(e.data.slice(5, 7)) - 1;
    const grupo = `${MESES[mes]} de ${ano}`;
    if (grupo !== grupoAtual) {
      grupoAtual = grupo;
      corpo += `<div class="alpha-letter">${grupo}</div>`;
    }

    const t = e.turmaId ? Store.get("turmas", e.turmaId) : null;
    const c = t ? Store.get("cursos", t.cursoId) : null;
    const hora = e.horaInicio ? e.horaInicio + (e.horaFim ? "–" + e.horaFim : "") : "dia todo";
    const dia = e.data.slice(8, 10);
    const mesCurto = MESES[mes].slice(0, 3);

    const detalhes = [];
    if (e.responsavel) detalhes.push("Palestrante: " + U.esc(e.responsavel));
    if (e.obs) detalhes.push(U.esc(e.obs));

    corpo += `
      <div class="aluno-row" style="cursor:pointer;" data-action="editarEvento" data-id="${e.id}" title="Clique para editar">
        <div style="min-width:92px; text-align:center; flex-shrink:0;">
          <div style="font-weight:800; font-size:1.3rem; line-height:1.1;">${dia}</div>
          <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted);">${mesCurto} ${ano}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${hora}</div>
        </div>
        <div class="a-info">
          <div class="a-nome">${U.esc(e.titulo)}</div>
          <div class="a-sub">${detalhes.join(" · ") || "Sem palestrante informado"}</div>
        </div>
        <div class="a-chips" style="align-items:center;">
          ${e.sala
            ? `<span class="pill info">${U.esc(e.sala)}</span>`
            : `<span class="pill">sem local</span>`}
          ${tipoEventoChip(e.tipo)}
          ${c ? `<span class="chip cor-${c.corIndex}">${U.esc(c.nome)}</span>` : ""}
          <button class="icon-btn" data-action="editarEvento" data-id="${e.id}" title="Editar" aria-label="Editar evento">&#9998;</button>
          <button class="icon-btn" data-action="excluirEvento" data-id="${e.id}" title="Excluir" aria-label="Excluir evento">&#128465;</button>
        </div>
      </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Agenda</h2>
        <p>Eventos do instituto: local, data, horário e palestrante. Clique em um evento para editar.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="csvAgenda">Exportar planilha</button>
        <button class="btn ghost" data-action="imprimir">Imprimir / PDF</button>
        <button class="btn accent" data-action="novoEvento">+ Novo evento</button>
      </div>
    </div>

    <div class="panel">
      ${eventos.length ? corpo : `<div class="empty-note">Nenhum evento agendado ainda.<br>Use <strong>+ Novo evento</strong> para criar o primeiro.</div>`}
    </div>
  `;
};

function abrirFormEvento(e) {
  const optSalas = ['<option value="">— sem local definido —</option>']
    .concat(Store.config.salas.map(s => `<option value="${U.esc(s)}" ${e.sala === s ? "selected" : ""}>${U.esc(s)}</option>`)).join("");
  const optTipos = TIPOS_EVENTO.map(([v, r]) => `<option value="${v}" ${e.tipo === v ? "selected" : ""}>${r}</option>`).join("");
  const optTurmas = ['<option value="">— sem vínculo com turma —</option>']
    .concat(Store.col("turmas").map(t => {
      const c = Store.get("cursos", t.cursoId);
      return `<option value="${t.id}" ${e.turmaId === t.id ? "selected" : ""}>${U.esc((c ? c.nome : "?") + " — " + t.nome)}</option>`;
    })).join("");

  App.abrirModal(e.id ? "Editar evento" : "Novo evento", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fe-titulo">Título *</label>
          <input id="fe-titulo" name="titulo" required placeholder="ex.: Palestra: Saúde Financeira" value="${U.esc(e.titulo)}">
        </div>
        <div class="field">
          <label for="fe-tipo">Tipo</label>
          <select id="fe-tipo" name="tipo">${optTipos}</select>
        </div>
        <div class="field">
          <label for="fe-sala">Espaço / local</label>
          <div style="display:flex; gap:6px;">
            <select id="fe-sala" name="sala" style="flex:1;">${optSalas}</select>
            <button type="button" class="btn ghost sm" data-modal-action="novaSala" title="Adicionar espaço">+</button>
          </div>
        </div>
        <div class="field">
          <label for="fe-data">Data *</label>
          <input id="fe-data" name="data" type="date" required value="${U.esc(e.data)}">
        </div>
        <div class="field">
          <label for="fe-ini">Hora de início</label>
          <input id="fe-ini" name="horaInicio" type="time" value="${U.esc(e.horaInicio)}">
        </div>
        <div class="field">
          <label for="fe-fim">Hora de término</label>
          <input id="fe-fim" name="horaFim" type="time" value="${U.esc(e.horaFim)}">
        </div>
        <div class="field full">
          <label for="fe-resp">Palestrante / responsável</label>
          <input id="fe-resp" name="responsavel" placeholder="quem conduz a atividade" value="${U.esc(e.responsavel)}">
        </div>
        <div class="field full">
          <label for="fe-turma">Turma vinculada (opcional)</label>
          <select id="fe-turma" name="turmaId">${optTurmas}</select>
        </div>
        <div class="field full">
          <label for="fe-obs">Observações</label>
          <textarea id="fe-obs" name="obs">${U.esc(e.obs)}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar evento</button>
      </div>
    </form>`, dados => {
    if (!dados.titulo.trim() || !dados.data) return false;
    const novo = { id: e.id || undefined, ...dados, titulo: dados.titulo.trim() };
    const conflito = Store.conflitoSala(novo);
    if (conflito && !confirm(
      `Atenção: a ${novo.sala} já está reservada em ${U.fmtData(novo.data)} ` +
      `(${conflito.horaInicio || "dia todo"}${conflito.horaFim ? "–" + conflito.horaFim : ""}) para "${conflito.titulo}".\n\nSalvar mesmo assim?`)) {
      return false;
    }
    Store.upsert("eventos", novo);
    U.toast("Evento salvo.");
    App.render();
  });
}

Actions.novoEvento = () => abrirFormEvento({
  titulo: "", tipo: "evento", data: U.hojeISO(), horaInicio: "", horaFim: "",
  sala: "", turmaId: "", responsavel: "", obs: ""
});
Actions.editarEvento = id => abrirFormEvento(Store.col("eventos").find(x => x.id === id));
Actions.excluirEvento = id => {
  const e = Store.col("eventos").find(x => x.id === id);
  if (e && confirm(`Excluir o evento "${e.titulo}"?`)) {
    Store.remover("eventos", id);
    U.toast("Evento excluído.");
    App.render();
  }
};
Actions.novaSala = () => {
  const nome = prompt("Novo espaço/local (ex.: Sala 6, Cozinha comunitária):");
  if (!nome) return;
  const salvo = Store.addSala(nome);
  const sel = document.getElementById("fe-sala");
  if (sel && salvo) {
    sel.insertAdjacentHTML("beforeend", `<option value="${U.esc(salvo)}">${U.esc(salvo)}</option>`);
    sel.value = salvo;
  }
  U.toast("Espaço adicionado.");
};

Actions.csvAgenda = () => {
  const cab = ["Data", "Início", "Término", "Título", "Tipo", "Espaço", "Turma vinculada", "Palestrante", "Observações"];
  const linhas = eventosOrdenados().map(e => {
    const t = e.turmaId ? Store.get("turmas", e.turmaId) : null;
    const c = t ? Store.get("cursos", t.cursoId) : null;
    const rotulo = (TIPOS_EVENTO.find(x => x[0] === e.tipo) || ["", "Outro"])[1];
    return U.linhaCSV([U.fmtData(e.data), e.horaInicio, e.horaFim, e.titulo, rotulo, e.sala,
      c ? c.nome + " — " + t.nome : "", e.responsavel, e.obs]);
  });
  U.baixarArquivo("agenda-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Agenda exportada.");
};

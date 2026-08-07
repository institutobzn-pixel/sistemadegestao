/* Lista de chamada: registro de presença por turma e data */
"use strict";

let chamadaAtual = { turmaId: "", data: U.hojeISO(), conteudo: "", presencas: {} };

Views.chamada = turmaIdParam => {
  const turmas = Store.col("turmas").filter(t => t.status === "em andamento" || t.status === "planejada");
  const todasTurmas = Store.col("turmas");

  if (turmaIdParam && chamadaAtual.turmaId !== turmaIdParam) {
    chamadaAtual = { turmaId: turmaIdParam, data: U.hojeISO(), conteudo: "", presencas: {} };
  }
  if (!chamadaAtual.turmaId && turmas.length) chamadaAtual.turmaId = turmas[0].id;

  const turmaSel = Store.get("turmas", chamadaAtual.turmaId);
  const curso = turmaSel ? Store.get("cursos", turmaSel.cursoId) : null;

  const opts = (turmas.length ? turmas : todasTurmas).map(t => {
    const c = Store.get("cursos", t.cursoId);
    return `<option value="${t.id}" ${t.id === chamadaAtual.turmaId ? "selected" : ""}>${U.esc((c ? c.nome : "?") + " — " + t.nome)}</option>`;
  }).join("");

  let listaAlunos = "";
  let historicoHTML = "";

  if (turmaSel) {
    const mats = Store.matriculasDaTurma(turmaSel.id).filter(m => m.status === "cursando" || m.status === "concluido");
    const alunos = U.ordenarPorNome(mats.map(m => Store.get("alunos", m.alunoId)).filter(Boolean));

    // chamada já registrada nesta data?
    const existente = Store.col("chamadas").find(c => c.turmaId === turmaSel.id && c.data === chamadaAtual.data);
    const presencas = existente ? existente.presencas : chamadaAtual.presencas;

    listaAlunos = alunos.length ? alunos.map(a => {
      const marcado = presencas[a.id];
      const p = Store.presencaAluno(turmaSel.id, a.id);
      return `
        <div class="chamada-aluno">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <span class="avatar cor-${curso ? curso.corIndex : 8}">${U.iniciais(a.nome)}</span>
            <div>
              <div style="font-weight:600; font-size:0.9rem;">${U.esc(a.nome)}</div>
              <div style="font-size:0.74rem; color:var(--text-muted);">
                ${p.total ? `frequência: ${p.pct}% (${p.presentes}/${p.total})` : "sem registros ainda"}
              </div>
            </div>
          </div>
          <div class="presenca-toggle" data-aluno="${a.id}">
            <button type="button" class="tp ${marcado === true ? "sel-p" : ""}" data-v="1">Presente</button>
            <button type="button" class="tf ${marcado === false ? "sel-f" : ""}" data-v="0">Falta</button>
          </div>
        </div>`;
    }).join("") : `<div class="empty-note">Nenhum aluno matriculado nesta turma.<br>Matricule alunos pela ficha de cada aluno.</div>`;

    const historico = Store.col("chamadas")
      .filter(c => c.turmaId === turmaSel.id)
      .sort((a, b) => b.data.localeCompare(a.data));
    historicoHTML = historico.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Conteúdo</th><th>Presentes</th><th></th></tr></thead>
        <tbody>${historico.map(c => {
          const total = Object.keys(c.presencas).length;
          const pres = Object.values(c.presencas).filter(Boolean).length;
          return `<tr>
            <td>${U.fmtData(c.data)}</td>
            <td>${U.esc(c.conteudo || "—")}</td>
            <td><span class="pill ${pres / total >= 0.75 ? "ok" : "warn"}">${pres}/${total}</span></td>
            <td style="white-space:nowrap">
              <button class="btn sm ghost" data-action="abrirChamadaData" data-id="${c.data}">Editar</button>
              <button class="icon-btn" data-action="excluirChamada" data-id="${c.id}" title="Excluir" aria-label="Excluir chamada">&#128465;</button>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : `<div class="empty-note">Nenhuma chamada registrada para esta turma.</div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Lista de chamada</h2>
        <p>Escolha a turma e a data, marque presença ou falta e salve. Cada data gera um registro no relatório de presença.</p>
      </div>
      <div class="head-actions">
        <button class="btn" data-action="importarChamada" title="Importar chamada de uma planilha (CSV)">&#128196; Importar chamada</button>
      </div>
    </div>

    ${todasTurmas.length ? `
    <div class="panel">
      <div class="form-grid" style="align-items:end;">
        <div class="field">
          <label for="ch-turma">Turma</label>
          <select id="ch-turma">${opts}</select>
        </div>
        <div class="field">
          <label for="ch-data">Data da aula</label>
          <input id="ch-data" type="date" value="${U.esc(chamadaAtual.data)}">
        </div>
        <div class="field full">
          <label for="ch-cont">Conteúdo da aula (opcional)</label>
          <input id="ch-cont" placeholder="ex.: Módulo 3 — Planejamento de conteúdo" value="${U.esc(chamadaAtual.conteudo)}">
        </div>
      </div>
    </div>

    <div class="panel">
      <h3>${curso ? U.esc(curso.nome) + " — " + U.esc(turmaSel.nome) : "Alunos"}</h3>
      <p class="panel-sub">${U.fmtData(chamadaAtual.data)}${turmaSel && turmaSel.horario ? " · " + U.esc(turmaSel.horario) : ""}</p>
      <div id="ch-lista">${listaAlunos}</div>
      <div class="form-actions">
        <button class="btn accent" data-action="salvarChamada">Salvar chamada</button>
      </div>
    </div>

    <div class="panel">
      <h3>Chamadas anteriores desta turma</h3>
      <p class="panel-sub">Clique em Editar para corrigir uma chamada já feita</p>
      ${historicoHTML}
    </div>`
    : `<div class="panel"><div class="empty-note">Nenhuma turma cadastrada.<br>Crie uma turma primeiro, na aba <strong>Turmas</strong>.</div></div>`}
  `;
};

/* interações da tela de chamada (selects e toggles) */
const aposRenderAnterior = Views.aposRender;
Views.aposRender = (rota, param) => {
  if (aposRenderAnterior) aposRenderAnterior(rota, param);
  if (rota !== "chamada") return;

  const selTurma = document.getElementById("ch-turma");
  const inpData = document.getElementById("ch-data");
  const inpCont = document.getElementById("ch-cont");
  if (!selTurma) return;

  selTurma.addEventListener("change", () => {
    chamadaAtual = { turmaId: selTurma.value, data: inpData.value, conteudo: "", presencas: {} };
    location.hash = "#/chamada/" + selTurma.value;
    App.render();
  });
  inpData.addEventListener("change", () => {
    chamadaAtual.data = inpData.value;
    chamadaAtual.presencas = {};
    App.render();
  });
  if (inpCont) inpCont.addEventListener("input", () => { chamadaAtual.conteudo = inpCont.value; });

  document.querySelectorAll(".presenca-toggle").forEach(tg => {
    const alunoId = tg.dataset.aluno;
    tg.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        const v = b.dataset.v === "1";
        chamadaAtual.presencas[alunoId] = v;
        tg.querySelector(".tp").classList.toggle("sel-p", v);
        tg.querySelector(".tf").classList.toggle("sel-f", !v);
      });
    });
  });
};

Actions.salvarChamada = () => {
  const turma = Store.get("turmas", chamadaAtual.turmaId);
  if (!turma) return;
  const data = document.getElementById("ch-data").value;
  const conteudo = document.getElementById("ch-cont").value.trim();
  if (!data) { U.toast("Escolha a data da aula."); return; }

  const mats = Store.matriculasDaTurma(turma.id).filter(m => m.status === "cursando" || m.status === "concluido");
  if (!mats.length) { U.toast("Matricule alunos nesta turma primeiro."); return; }

  const existente = Store.col("chamadas").find(c => c.turmaId === turma.id && c.data === data);
  const base = existente ? { ...existente.presencas } : {};

  // quem não foi tocado no toggle: mantém o que havia; se novo, marca presente por padrão
  const presencas = {};
  for (const m of mats) {
    if (m.alunoId in chamadaAtual.presencas) presencas[m.alunoId] = chamadaAtual.presencas[m.alunoId];
    else if (m.alunoId in base) presencas[m.alunoId] = base[m.alunoId];
    else presencas[m.alunoId] = true;
  }

  Store.upsert("chamadas", {
    id: existente ? existente.id : undefined,
    turmaId: turma.id, data, conteudo, presencas
  });
  chamadaAtual.presencas = {};
  U.toast(existente ? "Chamada atualizada." : "Chamada salva.");
  App.render();
};

Actions.abrirChamadaData = data => {
  chamadaAtual.data = data;
  chamadaAtual.presencas = {};
  App.render();
};

Actions.excluirChamada = id => {
  if (confirm("Excluir esta chamada?")) {
    Store.remover("chamadas", id);
    U.toast("Chamada excluída.");
    App.render();
  }
};

/* ==================== importar chamada de planilha (CSV) ====================
   Formato esperado (o mais comum): uma coluna com o NOME do aluno e várias
   colunas cujo cabeçalho é uma DATA (03/07, 03/07/2026, 2026-07-03…). Nas
   células, a presença: P/1/x/sim = presente; F/0/falta = ausente; vazio = ignora. */

let impChamada = null;

Actions.importarChamada = () => {
  if (!chamadaAtual.turmaId) { U.toast("Escolha uma turma primeiro."); return; }
  const turma = Store.get("turmas", chamadaAtual.turmaId);
  const curso = turma ? Store.get("cursos", turma.cursoId) : null;
  const anoAtual = new Date().getFullYear();
  const anos = [];
  for (let a = anoAtual + 1; a >= anoAtual - 6; a--) anos.push(`<option value="${a}" ${a === anoAtual ? "selected" : ""}>${a}</option>`);
  App.abrirModal("Importar chamada", `
    <p style="font-size:0.9rem; margin-bottom:10px;">
      Turma: <strong>${U.esc((curso ? curso.nome + " — " : "") + (turma ? turma.nome : ""))}</strong>
    </p>
    <p style="font-size:0.86rem; color:var(--text-muted); margin-bottom:12px;">
      A planilha deve ter uma coluna com o <strong>nome</strong> do aluno e uma coluna para cada <strong>data</strong>
      (cabeçalho tipo 03/07 ou 03/07/2026). Nas células: <em>P</em>/1/x = presente, <em>F</em>/0 = falta.
    </p>
    <div class="field" style="max-width:160px;">
      <label for="chi-ano">Ano (para datas sem ano)</label>
      <select id="chi-ano">${anos.join("")}</select>
    </div>
    <div class="field">
      <label for="chi-file">Arquivo CSV</label>
      <input id="chi-file" type="file" accept=".csv,text/csv,text/plain">
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="processarChamada">Ler planilha</button>
    </div>`);
};

Actions.processarChamada = () => {
  const fileEl = document.getElementById("chi-file");
  const ano = document.getElementById("chi-ano").value;
  const arq = fileEl && fileEl.files[0];
  if (!arq) { alert("Escolha o arquivo CSV."); return; }
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const { header, linhas } = CSV.parse(fr.result);
      if (!header.length || !linhas.length) { alert("A planilha parece vazia."); return; }

      const dateCols = header.map((h, i) => ({ i, iso: CSV.parseDataFlex(h, ano) }))
        .filter(x => x.iso || CSV.pareceData(header[x.i]))
        .map(x => ({ i: x.i, iso: x.iso || CSV.parseDataFlex(header[x.i], ano) }))
        .filter(x => x.iso);
      if (!dateCols.length) {
        alert("Não encontrei colunas de data no cabeçalho.\nO cabeçalho de cada aula deve ser uma data (ex.: 03/07 ou 03/07/2026).");
        return;
      }
      let nomeIdx = header.findIndex(h => /nome|aluno|estudante|participante/i.test(h));
      if (nomeIdx < 0) nomeIdx = header.findIndex((h, i) => !dateCols.some(d => d.i === i));
      if (nomeIdx < 0) nomeIdx = 0;

      impChamada = { turmaId: chamadaAtual.turmaId, header, linhas, nomeIdx, dateCols, ano };

      // pré-visualização: reconhecimento de alunos
      const mapaAlunos = new Map();
      for (const a of Store.col("alunos")) mapaAlunos.set(CSV.normNome(a.nome), a);
      const reconhecidos = [], naoRec = [];
      for (const row of linhas) {
        const nome = (row[nomeIdx] || "").trim();
        if (!nome) continue;
        (mapaAlunos.has(CSV.normNome(nome)) ? reconhecidos : naoRec).push(nome);
      }
      const listaDatas = dateCols.map(d => U.fmtData(d.iso)).join(", ");
      App.abrirModal("Importar chamada — conferir", `
        <p style="font-size:0.9rem; margin-bottom:8px;">
          Encontrei <strong>${dateCols.length} ${U.plural(dateCols.length, "data", "datas")}</strong>:
          <span style="color:var(--text-muted);">${U.esc(listaDatas)}</span>
        </p>
        <p style="font-size:0.9rem;">Alunos reconhecidos: <strong>${reconhecidos.length}</strong>${naoRec.length ? ` · <span style="color:var(--danger);">${naoRec.length} não encontrado(s)</span>` : ""}</p>
        ${naoRec.length ? `<p style="font-size:0.8rem; color:var(--text-muted);">Não estão cadastrados (a presença deles será ignorada): ${U.esc(naoRec.slice(0, 10).join(", "))}${naoRec.length > 10 ? "…" : ""}.<br>Importe esses alunos primeiro (aba Alunos) se quiser registrar a presença deles.</p>` : ""}
        <div class="form-actions">
          <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
          <button type="button" class="btn accent" data-modal-action="confirmarImportChamada">Importar chamada</button>
        </div>`);
    } catch (e) {
      alert("Não foi possível ler: " + (e.message || e));
    }
  };
  fr.readAsText(arq, "utf-8");
};

Actions.confirmarImportChamada = () => {
  if (!impChamada) return;
  const { turmaId, linhas, nomeIdx, dateCols } = impChamada;
  const mapaAlunos = new Map();
  for (const a of Store.col("alunos")) mapaAlunos.set(CSV.normNome(a.nome), a.id);

  // garante matrícula dos reconhecidos (para aparecerem na turma)
  const naTurma = new Set(Store.matriculasDaTurma(turmaId).map(m => m.alunoId));

  let datasImport = 0, marcacoes = 0;
  try {
    for (const dc of dateCols) {
      const existente = Store.col("chamadas").find(c => c.turmaId === turmaId && c.data === dc.iso);
      const presencas = existente ? { ...existente.presencas } : {};
      let algum = false;
      for (const row of linhas) {
        const nome = (row[nomeIdx] || "").trim();
        if (!nome) continue;
        const alunoId = mapaAlunos.get(CSV.normNome(nome));
        if (!alunoId) continue;
        const v = CSV.presencaCelula(row[dc.i]);
        if (v === null) continue;
        presencas[alunoId] = v;
        algum = true;
        marcacoes++;
        if (!naTurma.has(alunoId)) {
          Store.upsert("matriculas", { alunoId, turmaId, status: "cursando", data: U.hojeISO(), bolsa: false });
          naTurma.add(alunoId);
        }
      }
      if (algum) {
        Store.upsert("chamadas", { id: existente ? existente.id : undefined, turmaId, data: dc.iso, conteudo: existente ? existente.conteudo : "", presencas });
        datasImport++;
      }
    }
  } catch (e) {
    alert("Não foi possível importar: " + (e.message || e));
    return;
  }
  impChamada = null;
  App.fecharModal();
  App.render();
  U.toast(`${datasImport} ${U.plural(datasImport, "chamada importada", "chamadas importadas")} · ${marcacoes} ${U.plural(marcacoes, "marcação", "marcações")}.`);
};

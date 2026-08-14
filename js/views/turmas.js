/* Turmas: ofertas de cada curso, com professor, período e vagas */
"use strict";

const STATUS_TURMA = ["planejada", "em andamento", "concluída", "cancelada"];

function pillTurma(status) {
  const cls = { "planejada": "info", "em andamento": "ok", "concluída": "info", "cancelada": "bad" }[status] || "info";
  return `<span class="pill ${cls}">${U.esc(status)}</span>`;
}

Views.turmas = () => {
  const turmas = [...Store.col("turmas")].sort((a, b) => (b.dataInicio || "").localeCompare(a.dataInicio || ""));
  const linhas = turmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    const p = Store.get("professores", t.professorId);
    const qtd = Store.matriculasDaTurma(t.id).length;
    const media = Store.presencaMediaTurma(t.id);
    return `
      <tr>
        <td><span class="chip cor-${c ? c.corIndex : 8}">${U.esc(c ? c.nome : "—")}</span></td>
        <td>${U.esc(t.nome)}</td>
        <td>${U.esc(p ? p.nome : "—")}</td>
        <td>${U.fmtData(t.dataInicio)} – ${U.fmtData(t.dataFim)}</td>
        <td>${U.esc(t.horario || "—")}</td>
        <td>${qtd}${t.vagas ? " / " + t.vagas : ""}</td>
        <td>${media !== null ? media + "%" : "—"}</td>
        <td>${pillTurma(t.status)}</td>
        <td style="white-space:nowrap">
          <button class="btn sm ghost" data-action="addAlunosTurma" data-id="${t.id}">+ Alunos</button>
          <button class="btn sm ghost" data-action="irChamada" data-id="${t.id}">Chamada</button>
          <button class="icon-btn" data-action="editarTurma" data-id="${t.id}" title="Editar" aria-label="Editar turma">&#9998;</button>
          <button class="icon-btn" data-action="excluirTurma" data-id="${t.id}" title="Excluir" aria-label="Excluir turma">&#128465;</button>
        </td>
      </tr>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Turmas</h2>
        <p>Cada turma é uma edição de um curso, com professor, período, horário e vagas.</p>
      </div>
      <div class="head-actions">
        <button class="btn" data-action="importarInscritos" title="Importar lista de inscritos de uma planilha (CSV)">&#128196; Importar inscritos</button>
        <button class="btn accent" data-action="novaTurma">+ Nova turma</button>
      </div>
    </div>
    <div class="panel">
      ${turmas.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Curso</th><th>Turma</th><th>Professor</th><th>Período</th>
            <th>Horário</th><th>Alunos</th><th>Presença</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>` : `<div class="empty-note">Nenhuma turma cadastrada ainda.<br>Cadastre um curso e depois crie a primeira turma dele.</div>`}
    </div>
  `;
};

function abrirFormTurma(t) {
  const cursosOpts = U.ordenarPorNome(Store.col("cursos")).map(c =>
    `<option value="${c.id}" ${t.cursoId === c.id ? "selected" : ""}>${U.esc(c.nome)}</option>`).join("");
  const profOpts = ['<option value="">— sem professor —</option>']
    .concat(U.ordenarPorNome(Store.col("professores")).map(p =>
      `<option value="${p.id}" ${t.professorId === p.id ? "selected" : ""}>${U.esc(p.nome)}</option>`)).join("");
  const statusOpts = STATUS_TURMA.map(s =>
    `<option value="${s}" ${t.status === s ? "selected" : ""}>${s}</option>`).join("");

  App.abrirModal(t.id ? "Editar turma" : "Nova turma", `
    <form>
      <div class="form-grid">
        <div class="field">
          <label for="ft-curso">Curso *</label>
          <div style="display:flex; gap:6px;">
            <select id="ft-curso" name="cursoId" required style="flex:1;">${cursosOpts || '<option value="">— nenhum curso ainda —</option>'}</select>
            <button type="button" class="btn ghost sm" data-modal-action="novoCursoRapido" title="Criar novo curso">+</button>
          </div>
        </div>
        <div class="field">
          <label for="ft-nome">Nome da turma *</label>
          <input id="ft-nome" name="nome" required placeholder="ex.: Turma A" value="${U.esc(t.nome)}">
        </div>
        <div class="field">
          <label for="ft-prof">Professor</label>
          <select id="ft-prof" name="professorId">${profOpts}</select>
        </div>
        <div class="field">
          <label for="ft-status">Status</label>
          <select id="ft-status" name="status">${statusOpts}</select>
        </div>
        <div class="field">
          <label for="ft-ini">Data de início</label>
          <input id="ft-ini" name="dataInicio" type="date" value="${U.esc(t.dataInicio)}">
        </div>
        <div class="field">
          <label for="ft-fim">Data de término</label>
          <input id="ft-fim" name="dataFim" type="date" value="${U.esc(t.dataFim)}">
        </div>
        <div class="field">
          <label for="ft-hor">Dias e horário</label>
          <input id="ft-hor" name="horario" placeholder="ex.: Ter e Qui, 19h–21h" value="${U.esc(t.horario)}">
        </div>
        <div class="field">
          <label for="ft-local">Local / sala</label>
          <input id="ft-local" name="local" value="${U.esc(t.local)}">
        </div>
        <div class="field">
          <label for="ft-vagas">Vagas</label>
          <input id="ft-vagas" name="vagas" type="number" min="0" value="${U.esc(t.vagas)}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar turma</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim() || !dados.cursoId) return false;
    Store.upsert("turmas", {
      id: t.id || undefined, ...dados,
      nome: dados.nome.trim(),
      vagas: Number(dados.vagas) || 0
    });
    U.toast("Turma salva.");
    App.render();
  });
}

/* cria um curso na hora, sem sair do formulário de turma */
Actions.novoCursoRapido = () => {
  const nome = prompt("Nome do novo curso:");
  if (!nome || !nome.trim()) return;
  const c = Store.upsert("cursos", {
    nome: nome.trim(), ementa: "", corIndex: (Store.col("cursos").length % 8) + 1, status: "ativo",
    modulos: [], modalidade: "curso", tipoCurso: "gratuito", valor: 0, cobranca: ""
  });
  const sel = document.getElementById("ft-curso");
  if (sel) {
    const opt = document.createElement("option");
    opt.value = c.id; opt.textContent = c.nome; opt.selected = true;
    // remove o placeholder "— nenhum curso ainda —", se existir
    const ph = [...sel.options].find(o => o.value === "");
    if (ph) ph.remove();
    sel.appendChild(opt);
  }
  U.toast("Curso criado.");
};

Actions.novaTurma = () => abrirFormTurma({ cursoId: "", professorId: "", nome: "", dataInicio: "", dataFim: "", horario: "", local: "", vagas: "", status: "planejada" });
Actions.editarTurma = id => abrirFormTurma(Store.get("turmas", id));
Actions.excluirTurma = id => {
  const t = Store.get("turmas", id);
  const c = Store.get("cursos", t.cursoId);
  if (confirm(`Excluir a turma "${t.nome}" de ${c ? c.nome : "curso removido"}?\nMatrículas e chamadas dela também serão removidas.`)) {
    Store.remover("turmas", id);
    U.toast("Turma excluída.");
    App.render();
  }
};
Actions.irChamada = id => { location.hash = "#/chamada/" + id; };

/* ============ importar inscritos por curso (matricula numa turma) ============ */

let impInscritos = null;

Actions.importarInscritos = () => {
  const turmas = Store.col("turmas").filter(t => t.status !== "cancelada");
  if (!turmas.length) { U.toast("Cadastre uma turma antes de importar inscritos."); return; }
  const opts = turmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    return `<option value="${t.id}">${U.esc((c ? c.nome : "?") + " — " + t.nome)}</option>`;
  }).join("");
  App.abrirModal("Importar inscritos por curso", `
    <p style="font-size:0.9rem; margin-bottom:12px;">
      Escolha a turma e envie a planilha (CSV) com a lista de inscritos.
      Basta ter uma coluna com o <strong>nome</strong> — as demais (telefone, CPF, e-mail…) são reconhecidas se existirem.
      Cada pessoa é matriculada na turma escolhida.
    </p>
    <div class="field">
      <label for="ins-turma">Turma</label>
      <select id="ins-turma">${opts}</select>
    </div>
    <div class="field">
      <label for="ins-file">Arquivo CSV</label>
      <input id="ins-file" type="file" accept=".csv,text/csv,text/plain">
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="processarInscritos">Importar</button>
    </div>`);
};

Actions.processarInscritos = () => {
  const turmaId = document.getElementById("ins-turma").value;
  const fileEl = document.getElementById("ins-file");
  const arq = fileEl && fileEl.files[0];
  if (!arq) { alert("Escolha o arquivo CSV."); return; }
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const { header, linhas } = CSV.parse(fr.result);
      if (!header.length || !linhas.length) { alert("A planilha parece vazia."); return; }
      const acha = regs => { for (const r of regs) { const i = header.findIndex(h => r.test(h)); if (i >= 0) return i; } return -1; };
      let iNome = acha([/nome\s*complet/i, /^nome$/i, /aluno/i, /estudante/i, /participante/i, /inscrit/i]);
      if (iNome < 0) iNome = 0; // sem cabeçalho claro: usa a 1ª coluna
      const iTel = acha([/whats/i, /celular/i, /telefone/i, /contato/i, /\bfone\b/i]);
      const iCpf = acha([/cpf/i]);
      const iEmail = acha([/e-?mail/i]);
      const iNasc = acha([/nascimento/i, /\bnasc\b/i, /anivers/i]);

      const idxExist = new Map();
      for (const a of Store.col("alunos")) idxExist.set(CSV.normNome(a.nome), a);
      const jaNaTurma = new Set(Store.matriculasDaTurma(turmaId).map(m => m.alunoId));

      let novos = 0, reuse = 0, mats = 0, pulados = 0;
      for (const row of linhas) {
        const nome = (row[iNome] || "").trim();
        if (!nome) { pulados++; continue; }
        let aluno = idxExist.get(CSV.normNome(nome));
        if (!aluno) {
          aluno = Store.upsert("alunos", {
            nome, nascimento: iNasc >= 0 ? CSV.parseDataFlex(row[iNasc]) : "", cpf: iCpf >= 0 ? (row[iCpf] || "").trim() : "",
            telefone: iTel >= 0 ? (row[iTel] || "").trim() : "", email: iEmail >= 0 ? (row[iEmail] || "").trim() : "",
            endereco: "", bairro: "", cidade: "", cep: "", responsavel: "", encaminhamento: "",
            atingidoEnchente: "", impactoEnchentes: "", rendaFamiliar: "", beneficios: "", moradiaAtual: "",
            necessidades: "", observacoes: "", termos: []
          });
          idxExist.set(CSV.normNome(nome), aluno);
          novos++;
        } else reuse++;
        if (!jaNaTurma.has(aluno.id)) {
          Store.upsert("matriculas", { alunoId: aluno.id, turmaId, status: "cursando", data: U.hojeISO(), bolsa: false });
          jaNaTurma.add(aluno.id);
          mats++;
        }
      }
      App.fecharModal();
      App.render();
      U.toast(`${mats} ${U.plural(mats, "inscrito matriculado", "inscritos matriculados")}${novos ? ` · ${novos} ${U.plural(novos, "aluno novo", "alunos novos")}` : ""}${reuse ? ` · ${reuse} já existiam` : ""}.`);
    } catch (e) {
      alert("Não foi possível importar: " + (e.message || e));
    }
  };
  fr.readAsText(arq, "utf-8");
};

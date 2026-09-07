/* Alunos: cadastro geral em ordem alfabética + ficha com histórico de cursos */
"use strict";

let filtroAlunos = "";

Views.alunos = () => {
  const todos = U.ordenarPorNome(Store.col("alunos"));
  const filtro = filtroAlunos.trim().toLowerCase();
  const lista = filtro
    ? todos.filter(a => (a.nome + " " + (a.cpf || "") + " " + (a.email || "")).toLowerCase().includes(filtro))
    : todos;

  let html = "";
  let letraAtual = "";
  for (const a of lista) {
    const letra = (a.nome[0] || "?").toUpperCase();
    if (letra !== letraAtual) {
      letraAtual = letra;
      html += `<div class="alpha-letter">${letra}</div>`;
    }
    const cursos = Store.cursosDoAluno(a.id);
    html += `
      <div class="aluno-row" data-action="verAluno" data-id="${a.id}">
        <span class="avatar cor-${(letra.charCodeAt(0) % 8) + 1}">${U.iniciais(a.nome)}</span>
        <div class="a-info">
          <div class="a-nome">${U.esc(a.nome)}</div>
          <div class="a-sub">${U.esc(a.telefone || "")}${a.telefone && a.email ? " · " : ""}${U.esc(a.email || "")}</div>
        </div>
        <div class="a-chips">
          ${cursos.slice(0, 3).map(x => `<span class="chip cor-${x.curso.corIndex}">${U.esc(x.curso.nome)}</span>`).join("")}
          ${cursos.length > 3 ? `<span class="chip">+${cursos.length - 3}</span>` : ""}
        </div>
      </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Alunos</h2>
        <p>Cadastro geral em ordem alfabética. Clique em um aluno para ver a ficha completa e o histórico de cursos.</p>
      </div>
      <div class="head-actions">
        <input class="search-input" id="busca-aluno" type="search" placeholder="Buscar por nome, CPF ou e-mail…" value="${U.esc(filtroAlunos)}">
        <button class="btn" data-action="importarAlunos" title="Importar de planilha Google/Excel (CSV)">&#128196; Importar planilha</button>
        <button class="btn accent" data-action="novoAluno">+ Novo aluno</button>
      </div>
    </div>
    <div class="panel">
      ${lista.length ? html : `<div class="empty-note">${filtro ? "Nenhum aluno encontrado para essa busca." : "Nenhum aluno cadastrado ainda."}</div>`}
    </div>
  `;
};

Views.aposRender = rota => {
  if (rota === "alunos") {
    const campo = document.getElementById("busca-aluno");
    if (campo) {
      campo.addEventListener("input", () => {
        filtroAlunos = campo.value;
        // re-renderiza só a lista mantendo o foco no campo
        const pos = campo.selectionStart;
        App.render();
        const novo = document.getElementById("busca-aluno");
        if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
      });
    }
  }
};

Views.alunoDetalhe = id => {
  const a = Store.get("alunos", id);
  if (!a) return `<div class="panel"><div class="empty-note">Aluno não encontrado.</div></div>`;

  const cursos = Store.cursosDoAluno(a.id);
  const mats = Store.matriculasDoAluno(a.id);
  const idade = U.idade(a.nascimento);

  const item = (k, v) => `<div class="detail-item"><div class="k">${k}</div><div class="v">${v || "—"}</div></div>`;

  const linhasMat = mats.map(m => {
    const t = Store.get("turmas", m.turmaId);
    const c = t ? Store.get("cursos", t.cursoId) : null;
    const p = t ? Store.presencaAluno(t.id, a.id) : { pct: null };
    const pillCls = { cursando: "ok", concluido: "info", trancado: "warn", desistente: "bad" }[m.status] || "info";
    const ehPago = c && c.tipoCurso === "pago";
    return `
      <tr>
        <td><span class="chip cor-${c ? c.corIndex : 8}">${U.esc(c ? c.nome : "curso removido")}</span>
          ${ehPago ? (m.bolsa ? `<span class="pill ok">bolsista</span>` : `<span class="pill info">pagante</span>`) : ""}</td>
        <td>${U.esc(t ? t.nome : "—")}</td>
        <td>${t ? U.fmtData(t.dataInicio) + " – " + U.fmtData(t.dataFim) : "—"}</td>
        <td>${p.pct !== null ? p.pct + "%" : "—"}</td>
        <td><span class="pill ${pillCls}">${U.esc(m.status)}</span></td>
        <td><button class="icon-btn" data-action="editarMatricula" data-id="${m.id}" title="Alterar status" aria-label="Alterar status da matrícula">&#9998;</button></td>
      </tr>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>${U.esc(a.nome)}</h2>
        <p>${cursos.length ? `Já participou de ${cursos.length} ${U.plural(cursos.length, "curso", "cursos diferentes")} no instituto.` : "Ainda não tem matrículas."}</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="voltarAlunos">&larr; Voltar</button>
        <button class="btn" data-action="matricular" data-id="${a.id}">Matricular em turma</button>
        <button class="btn accent" data-action="editarAluno" data-id="${a.id}">Editar cadastro</button>
      </div>
    </div>

    ${cursos.length ? `
    <div class="panel">
      <h3>Trajetória no instituto</h3>
      <p class="panel-sub">Cursos que este aluno já fez ou está fazendo</p>
      <div class="cross-chips">
        ${cursos.map(x => `<span class="chip cor-${x.curso.corIndex}">${U.esc(x.curso.nome)}</span>`).join("")}
      </div>
    </div>` : ""}

    <div class="panel">
      <h3>Matrículas</h3>
      <p class="panel-sub">Histórico completo de turmas</p>
      ${mats.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Curso</th><th>Turma</th><th>Período</th><th>Presença</th><th>Status</th><th></th></tr></thead>
        <tbody>${linhasMat}</tbody>
      </table></div>` : `<div class="empty-note">Nenhuma matrícula. Use o botão <strong>Matricular em turma</strong>.</div>`}
    </div>

    <div class="grid-2-even">
      <div class="panel">
        <h3>Dados pessoais</h3>
        <p class="panel-sub">Informações de cadastro</p>
        <div class="detail-grid">
          ${item("Data de nascimento", a.nascimento ? U.fmtData(a.nascimento) + (idade !== null ? ` (${idade} anos)` : "") : "")}
          ${item("CPF", U.esc(a.cpf))}
          ${item("Telefone", U.esc(a.telefone))}
          ${item("E-mail", U.esc(a.email))}
          ${item("Endereço", U.esc([a.endereco, a.bairro, a.cidade].filter(Boolean).join(", ")))}
          ${item("CEP", U.esc(a.cep))}
          ${item("Nome do responsável", U.esc(a.responsavel))}
          ${item("Encaminhamento", U.esc(a.encaminhamento))}
        </div>
      </div>
      <div class="panel">
        <h3>Situação social</h3>
        <p class="panel-sub">Dados sensíveis — uso interno do instituto</p>
        <div class="detail-grid">
          ${item("Atingido pelas enchentes", a.atingidoEnchente === "sim" ? "Sim" : a.atingidoEnchente === "nao" ? "Não" : "")}
          ${item("Impacto das enchentes", U.esc(a.impactoEnchentes))}
          ${item("Renda familiar", U.esc(a.rendaFamiliar))}
          ${item("Benefícios sociais", U.esc(a.beneficios))}
          ${item("Moradia atual", U.esc(a.moradiaAtual))}
          ${item("Necessidades de apoio", U.esc(a.necessidades))}
          ${item("Observações", U.esc(a.observacoes))}
        </div>
        ${(a.termos || []).length ? `
          <div style="margin-top:14px;">
            <div class="k" style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:6px;">Termos e documentos</div>
            <div class="cross-chips">${Anexos.links(a.termos)}</div>
          </div>` : ""}
      </div>
    </div>

    ${U.carimbo(a)}

    <div class="head-actions">
      <button class="btn danger" data-action="excluirAluno" data-id="${a.id}">Excluir aluno</button>
    </div>
  `;
};

/* monta as <option> do select de encaminhamento, incluindo um valor legado
   que porventura não esteja mais na lista de opções */
function opcoesEncaminhamento(atual) {
  const opcoes = [...Store.config.encaminhamentos];
  if (atual && !opcoes.some(o => o.toLowerCase() === atual.toLowerCase())) opcoes.push(atual);
  return ['<option value="">— selecione —</option>']
    .concat(opcoes.map(o =>
      `<option value="${U.esc(o)}" ${o === atual ? "selected" : ""}>${U.esc(o)}</option>`))
    .join("");
}

function abrirFormAluno(a) {
  App.abrirModal(a.id ? "Editar aluno" : "Novo aluno", `
    <form>
      <div class="form-grid">
        <div class="form-section">Dados pessoais</div>
        <div class="field full">
          <label for="fa-nome">Nome completo *</label>
          <input id="fa-nome" name="nome" required value="${U.esc(a.nome)}">
        </div>
        <div class="field">
          <label for="fa-nasc">Data de nascimento</label>
          <input id="fa-nasc" name="nascimento" type="date" value="${U.esc(a.nascimento)}">
        </div>
        <div class="field">
          <label for="fa-cpf">CPF</label>
          <input id="fa-cpf" name="cpf" placeholder="000.000.000-00" value="${U.esc(a.cpf)}">
        </div>
        <div class="field">
          <label for="fa-tel">Telefone</label>
          <input id="fa-tel" name="telefone" value="${U.esc(a.telefone)}">
        </div>
        <div class="field">
          <label for="fa-email">E-mail</label>
          <input id="fa-email" name="email" type="email" value="${U.esc(a.email)}">
        </div>
        <div class="form-section">Endereço</div>
        <div class="field full">
          <label for="fa-end">Rua e número</label>
          <input id="fa-end" name="endereco" value="${U.esc(a.endereco)}">
        </div>
        <div class="field">
          <label for="fa-bairro">Bairro</label>
          <input id="fa-bairro" name="bairro" value="${U.esc(a.bairro)}">
        </div>
        <div class="field">
          <label for="fa-cidade">Cidade</label>
          <input id="fa-cidade" name="cidade" value="${U.esc(a.cidade)}">
        </div>
        <div class="field">
          <label for="fa-cep">CEP</label>
          <input id="fa-cep" name="cep" value="${U.esc(a.cep)}">
        </div>
        <div class="form-section">Vínculos</div>
        <div class="field">
          <label for="fa-resp">Nome do responsável</label>
          <input id="fa-resp" name="responsavel" value="${U.esc(a.responsavel)}">
        </div>
        <div class="field">
          <label for="fa-enc">Encaminhamento (origem)</label>
          <div style="display:flex; gap:6px;">
            <select id="fa-enc" name="encaminhamento" style="flex:1;">
              ${opcoesEncaminhamento(a.encaminhamento)}
            </select>
            <button type="button" class="btn ghost sm" data-modal-action="novoEncaminhamento" title="Adicionar nova origem">+</button>
          </div>
        </div>
        <div class="form-section">Situação social</div>
        <div class="field">
          <label for="fa-ate">Atingido pelas enchentes?</label>
          <select id="fa-ate" name="atingidoEnchente">
            <option value="" ${!a.atingidoEnchente ? "selected" : ""}>Não informado</option>
            <option value="sim" ${a.atingidoEnchente === "sim" ? "selected" : ""}>Sim</option>
            <option value="nao" ${a.atingidoEnchente === "nao" ? "selected" : ""}>Não</option>
          </select>
        </div>
        <div class="field full">
          <label for="fa-ench">Detalhes do impacto das enchentes</label>
          <textarea id="fa-ench" name="impactoEnchentes">${U.esc(a.impactoEnchentes)}</textarea>
        </div>
        <div class="field">
          <label for="fa-renda">Renda familiar</label>
          <input id="fa-renda" name="rendaFamiliar" value="${U.esc(a.rendaFamiliar)}">
        </div>
        <div class="field">
          <label for="fa-benef">Benefícios sociais</label>
          <input id="fa-benef" name="beneficios" placeholder="ex.: Bolsa Família" value="${U.esc(a.beneficios)}">
        </div>
        <div class="field">
          <label for="fa-morad">Moradia atual</label>
          <input id="fa-morad" name="moradiaAtual" value="${U.esc(a.moradiaAtual)}">
        </div>
        <div class="field">
          <label for="fa-nec">Necessidades de apoio</label>
          <input id="fa-nec" name="necessidades" placeholder="ex.: transporte, alimentação" value="${U.esc(a.necessidades)}">
        </div>
        <div class="field full">
          <label for="fa-obs">Observações</label>
          <textarea id="fa-obs" name="observacoes">${U.esc(a.observacoes)}</textarea>
        </div>
        ${Anexos.campoHTML("Termos e documentos (PDF)", "Termo de consentimento, autorização de imagem, etc. Até 5 arquivos.")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar aluno</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    let salvo;
    try {
      salvo = Store.upsert("alunos", { id: a.id || undefined, ...dados, nome: dados.nome.trim(), termos: Anexos.lista() });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova algum anexo e tente novamente.");
      return false;
    }
    U.toast("Aluno salvo.");
    if (!a.id) location.hash = "#/aluno/" + salvo.id;
    else App.render();
  }, a);
  Anexos.iniciar(a.termos, 5);
  Anexos.ligar();
}

Actions.novoAluno = () => abrirFormAluno({
  nome: "", nascimento: "", cpf: "", telefone: "", email: "",
  endereco: "", bairro: "", cidade: "", cep: "",
  responsavel: "", encaminhamento: "", atingidoEnchente: "", impactoEnchentes: "",
  rendaFamiliar: "", beneficios: "", moradiaAtual: "", necessidades: "", observacoes: "", termos: []
});

/* adiciona uma nova origem de encaminhamento sem fechar o formulário do aluno */
Actions.novoEncaminhamento = () => {
  const nome = prompt("Nova origem de encaminhamento (ex.: UBS, Igreja, Indicação):");
  if (!nome) return;
  const salvo = Store.addEncaminhamento(nome);
  if (!salvo) return;
  const sel = document.getElementById("fa-enc");
  if (sel) {
    sel.innerHTML = opcoesEncaminhamento(salvo);
    sel.value = salvo;
  }
  U.toast("Origem adicionada.");
};
Actions.editarAluno = id => abrirFormAluno(Store.get("alunos", id));
Actions.verAluno = id => { location.hash = "#/aluno/" + id; };
Actions.voltarAlunos = () => { location.hash = "#/alunos"; };
Actions.excluirAluno = id => {
  const a = Store.get("alunos", id);
  if (confirm(`Excluir o aluno "${a.nome}"?\nAs matrículas e presenças dele também serão removidas.`)) {
    Store.remover("alunos", id);
    U.toast("Aluno excluído.");
    location.hash = "#/alunos";
  }
};

Actions.matricular = alunoId => {
  const turmas = Store.col("turmas").filter(t => t.status !== "cancelada");
  if (!turmas.length) { U.toast("Cadastre uma turma antes de matricular."); return; }
  const jaMatriculado = new Set(Store.matriculasDoAluno(alunoId).map(m => m.turmaId));
  const opts = turmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    const marcado = jaMatriculado.has(t.id) ? " (já matriculado)" : "";
    const pago = c && c.tipoCurso === "pago" ? " — PAGO" : "";
    return `<option value="${t.id}" data-pago="${c && c.tipoCurso === "pago" ? "1" : ""}" ${jaMatriculado.has(t.id) ? "disabled" : ""}>${U.esc((c ? c.nome : "?") + " — " + t.nome + pago + marcado)}</option>`;
  }).join("");

  App.abrirModal("Matricular em turma", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fm-turma">Turma</label>
          <select id="fm-turma" name="turmaId" required>${opts}</select>
        </div>
        <div class="field">
          <label for="fm-status">Status inicial</label>
          <select id="fm-status" name="status">
            <option value="cursando">cursando</option>
            <option value="concluido">concluído</option>
            <option value="trancado">trancado</option>
            <option value="desistente">desistente</option>
          </select>
        </div>
        <div class="field">
          <label for="fm-data">Data da matrícula</label>
          <input id="fm-data" name="data" type="date" value="${U.hojeISO()}">
        </div>
        <div class="field full" id="fm-bolsa-area" hidden>
          <label style="display:inline-flex; align-items:center; gap:8px; text-transform:none; font-size:0.86rem;">
            <input type="checkbox" name="bolsa" value="1"> Aluno bolsista (isento de pagamento neste curso)
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Matricular</button>
      </div>
    </form>`, dados => {
    if (!dados.turmaId) return false;
    Store.upsert("matriculas", { alunoId, turmaId: dados.turmaId, status: dados.status, data: dados.data, bolsa: !!dados.bolsa });
    U.toast("Matrícula registrada.");
    App.render();
  });

  /* mostra a opção de bolsa apenas quando a turma escolhida é de curso pago */
  const selTurma = document.getElementById("fm-turma");
  const bolsaArea = document.getElementById("fm-bolsa-area");
  const atualizarBolsa = () => {
    bolsaArea.hidden = !selTurma.selectedOptions[0]?.dataset.pago;
    if (bolsaArea.hidden) bolsaArea.querySelector("input").checked = false;
  };
  selTurma.addEventListener("change", atualizarBolsa);
  atualizarBolsa();
};

Actions.editarMatricula = matId => {
  const m = Store.col("matriculas").find(x => x.id === matId);
  if (!m) return;
  const t = Store.get("turmas", m.turmaId);
  const c = t ? Store.get("cursos", t.cursoId) : null;
  const ehPago = c && c.tipoCurso === "pago";
  App.abrirModal("Alterar matrícula", `
    <form>
      <p style="margin:0 0 14px; font-size:0.88rem;">
        <span class="chip cor-${c ? c.corIndex : 8}">${U.esc(c ? c.nome : "curso removido")}</span>
        &nbsp;${U.esc(t ? t.nome : "")}
        ${ehPago ? `&nbsp;<span class="pill info">curso pago · ${U.moeda(c.valor)}${c.cobranca === "mensal" ? "/mês" : ""}</span>` : ""}
      </p>
      <div class="form-grid">
        <div class="field full">
          <label for="fem-status">Status</label>
          <select id="fem-status" name="status">
            ${["cursando", "concluido", "trancado", "desistente"].map(s =>
              `<option value="${s}" ${m.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
        ${ehPago ? `
        <div class="field full">
          <label style="display:inline-flex; align-items:center; gap:8px; text-transform:none; font-size:0.86rem;">
            <input type="checkbox" name="bolsa" value="1" ${m.bolsa ? "checked" : ""}> Aluno bolsista (isento de pagamento neste curso)
          </label>
        </div>` : ""}
      </div>
      <div class="form-actions">
        <button type="button" class="btn danger" data-modal-action="removerMatricula" data-id="${m.id}">Remover matrícula</button>
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar</button>
      </div>
    </form>`, dados => {
    Store.upsert("matriculas", { ...m, status: dados.status, bolsa: ehPago ? !!dados.bolsa : false });
    U.toast("Matrícula atualizada.");
    App.render();
  });
};

Actions.removerMatricula = matId => {
  if (confirm("Remover esta matrícula?")) {
    Store.remover("matriculas", matId);
    App.fecharModal();
    U.toast("Matrícula removida.");
    App.render();
  }
};

/* ================= importação de alunos por planilha (CSV) =================
   Roda 100% no navegador — o arquivo não sai do computador. O usuário escolhe
   de qual coluna vem cada campo (com palpites automáticos), confere a prévia e
   importa. Colunas desconhecidas são ignoradas; campos ausentes ficam em branco.
   Se a coluna de curso/turma for indicada, o aluno já é matriculado. */

let impAlunos = null;

/* campos do app + rótulo + palavras que ajudam a adivinhar a coluna */
const CAMPOS_ALUNO = [
  ["nome", "Nome *", [/nome\s*complet/i, /^nome$/i, /nome do aluno/i, /^aluno/i, /estudante/i, /participante/i]],
  ["nascimento", "Data de nascimento", [/nascimento/i, /\bnasc\b/i, /data.*nasc/i, /dt.*nasc/i, /anivers/i]],
  ["cpf", "CPF", [/cpf/i]],
  ["telefone", "Telefone / celular", [/whats/i, /celular/i, /telefone/i, /contato/i, /\bfone\b/i, /\btel\b/i]],
  ["email", "E-mail", [/e-?mail/i]],
  ["endereco", "Endereço (rua)", [/endere/i, /logradouro/i, /^rua/i]],
  ["bairro", "Bairro", [/bairro/i]],
  ["cidade", "Cidade", [/cidade/i, /munic/i]],
  ["cep", "CEP", [/cep/i]],
  ["responsavel", "Responsável", [/respons/i, /^m[aã]e/i, /^pai/i, /filia/i]],
  ["curso", "Curso/Turma (matricula o aluno)", [/curso/i, /turma/i, /oficina/i, /forma[çc][aã]o/i, /modalidade/i]],
  ["observacoes", "Observações", [/observa/i, /\bobs\b/i, /coment/i]]
];

/* lê um CSV respeitando aspas, quebras de linha dentro de aspas e ; ou , */
function parseCSVAlunos(texto) {
  texto = String(texto || "").replace(/^﻿/, "");
  const primeira = texto.split(/\r?\n/)[0] || "";
  const sep = (primeira.split(";").length > primeira.split(",").length) ? ";" : ",";
  const linhas = [];
  let campo = "", linha = [], dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentro) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
      else campo += c;
    } else {
      if (c === '"') dentro = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
      else if (c === '\r') { /* ignora */ }
      else campo += c;
    }
  }
  if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
  const limpas = linhas.filter(l => l.some(x => (x || "").trim() !== ""));
  const header = (limpas.shift() || []).map(h => (h || "").trim());
  return { header, linhas: limpas };
}

function mapearAutoAlunos(header) {
  const usados = new Set();
  const mapa = {};
  for (const [campo, , regexes] of CAMPOS_ALUNO) {
    let idx = -1;
    for (const rx of regexes) {
      idx = header.findIndex((h, i) => !usados.has(i) && rx.test(h));
      if (idx >= 0) break;
    }
    mapa[campo] = idx;
    if (idx >= 0) usados.add(idx);
  }
  return mapa;
}

/* aceita 03/07/2010, 2010-07-03, 3-7-2010, etc. */
function parseDataFlexAluno(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (parseInt(y, 10) > 30 ? "19" : "20") + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return "";
}

function chaveAlunoImport(nome, cpf, nasc) {
  const cpfd = String(cpf || "").replace(/\D/g, "");
  return String(nome || "").trim().toLowerCase() + "|" + (cpfd || nasc || "");
}

function acharOuCriarCursoTurma(nomeCurso) {
  const nc = String(nomeCurso || "").trim();
  let curso = Store.col("cursos").find(c => (c.nome || "").trim().toLowerCase() === nc.toLowerCase());
  let cursoCriado = false, turmaCriada = false;
  if (!curso) {
    curso = Store.upsert("cursos", {
      nome: nc, ementa: "", corIndex: (Store.col("cursos").length % 8) + 1, status: "ativo",
      modulos: [], modalidade: "curso", tipoCurso: "gratuito", valor: 0, cobranca: ""
    });
    cursoCriado = true;
  }
  let turma = Store.col("turmas").find(t => t.cursoId === curso.id);
  if (!turma) {
    turma = Store.upsert("turmas", {
      cursoId: curso.id, professorId: "", nome: "Turma importada", dataInicio: "", dataFim: "",
      horario: "", local: "", vagas: 0, status: "em andamento"
    });
    turmaCriada = true;
  }
  return { turma, cursoCriado, turmaCriada };
}

Actions.importarAlunos = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv,text/plain";
  input.onchange = () => {
    const arq = input.files[0];
    if (!arq) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const { header, linhas } = parseCSVAlunos(fr.result);
        if (!header.length || !linhas.length) { alert("A planilha parece vazia ou sem cabeçalho.\nDica: exporte do Google Sheets em Arquivo → Fazer download → CSV."); return; }
        impAlunos = { header, linhas };
        abrirMapeamentoAlunos();
      } catch (e) {
        alert("Não consegui ler o arquivo: " + (e.message || e));
      }
    };
    fr.readAsText(arq, "utf-8");
  };
  input.click();
};

function abrirMapeamentoAlunos() {
  const { header } = impAlunos;
  const auto = impAlunos.mapa || mapearAutoAlunos(header);
  const optCols = sel => ['<option value="-1">— ignorar —</option>']
    .concat(header.map((h, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${U.esc(h || ("Coluna " + (i + 1)))}</option>`))
    .join("");
  const linhasMap = CAMPOS_ALUNO.map(([campo, rotulo]) => `
    <div class="field">
      <label for="map-${campo}">${rotulo}</label>
      <select id="map-${campo}">${optCols(auto[campo] == null ? -1 : auto[campo])}</select>
    </div>`).join("");
  App.abrirModal("Importar alunos — conferir colunas", `
    <p style="font-size:0.9rem; margin-bottom:12px;">
      Encontrei <strong>${impAlunos.linhas.length} ${U.plural(impAlunos.linhas.length, "linha", "linhas")}</strong>
      e ${header.length} colunas. Confira de qual coluna vem cada informação — já preenchi os palpites.
      O que não usar, deixe em <em>“ignorar”</em>.
    </p>
    <div class="form-grid">${linhasMap}</div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="preverImportAlunos">Pré-visualizar</button>
    </div>`);
}

Actions.preverImportAlunos = () => {
  if (!impAlunos) return;
  const mapa = {};
  for (const [campo] of CAMPOS_ALUNO) {
    const sel = document.getElementById("map-" + campo);
    mapa[campo] = sel ? parseInt(sel.value, 10) : -1;
  }
  if (mapa.nome < 0) { alert("Escolha qual coluna tem o NOME do aluno — é obrigatório."); return; }
  impAlunos.mapa = mapa;

  const val = (row, campo) => { const i = mapa[campo]; return (i >= 0 && i < row.length) ? String(row[i] || "").trim() : ""; };
  const comNome = impAlunos.linhas.filter(r => val(r, "nome"));
  const amostra = comNome.slice(0, 5).map(r => {
    const nasc = parseDataFlexAluno(val(r, "nascimento"));
    return `<tr>
      <td>${U.esc(val(r, "nome"))}</td>
      <td>${nasc ? U.fmtData(nasc) : "—"}</td>
      <td>${U.esc(val(r, "telefone") || "—")}</td>
      <td>${U.esc(val(r, "curso") || "—")}</td></tr>`;
  }).join("");

  App.abrirModal("Importar alunos — prévia", `
    <p style="font-size:0.9rem; margin-bottom:10px;">
      Vou importar <strong>${comNome.length} ${U.plural(comNome.length, "aluno", "alunos")}</strong>. Amostra dos primeiros:
    </p>
    <div class="table-wrap"><table>
      <thead><tr><th>Nome</th><th>Nascimento</th><th>Telefone</th><th>Curso/Turma</th></tr></thead>
      <tbody>${amostra}</tbody>
    </table></div>
    ${mapa.curso >= 0 ? `<p style="font-size:0.82rem; color:var(--text-muted); margin-top:8px;">Cada aluno será matriculado na turma do curso indicado (o curso/turma é criado se ainda não existir).</p>` : ""}
    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Alunos repetidos (mesmo nome + CPF/nascimento) não são duplicados. Você pode excluir alunos depois, um a um.</p>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="voltarMapeamentoAlunos">Voltar</button>
      <button type="button" class="btn accent" data-modal-action="confirmarImportAlunos">Importar ${comNome.length}</button>
    </div>`);
};

Actions.voltarMapeamentoAlunos = () => abrirMapeamentoAlunos();

Actions.confirmarImportAlunos = () => {
  if (!impAlunos || !impAlunos.mapa) return;
  const { linhas, mapa } = impAlunos;
  const val = (row, campo) => { const i = mapa[campo]; return (i >= 0 && i < row.length) ? String(row[i] || "").trim() : ""; };
  const idxExist = new Map();
  for (const a of Store.col("alunos")) idxExist.set(chaveAlunoImport(a.nome, a.cpf, a.nascimento), a.id);

  let novos = 0, reuse = 0, mats = 0, cursosC = 0, turmasC = 0, pulados = 0;
  try {
    for (const row of linhas) {
      const nome = val(row, "nome");
      if (!nome) { pulados++; continue; }
      const nascimento = parseDataFlexAluno(val(row, "nascimento"));
      const cpf = val(row, "cpf");
      const chave = chaveAlunoImport(nome, cpf, nascimento);
      let alunoId = idxExist.get(chave);
      if (!alunoId) {
        const a = Store.upsert("alunos", {
          nome, nascimento, cpf, telefone: val(row, "telefone"), email: val(row, "email"),
          endereco: val(row, "endereco"), bairro: val(row, "bairro"), cidade: val(row, "cidade"), cep: val(row, "cep"),
          responsavel: val(row, "responsavel"), encaminhamento: "", atingidoEnchente: "", impactoEnchentes: "",
          rendaFamiliar: "", beneficios: "", moradiaAtual: "", necessidades: "", observacoes: val(row, "observacoes"), termos: []
        });
        alunoId = a.id;
        idxExist.set(chave, alunoId);
        novos++;
      } else reuse++;

      const nomeCurso = val(row, "curso");
      if (nomeCurso) {
        const { turma, cursoCriado, turmaCriada } = acharOuCriarCursoTurma(nomeCurso);
        if (cursoCriado) cursosC++;
        if (turmaCriada) turmasC++;
        if (!Store.matriculasDoAluno(alunoId).some(m => m.turmaId === turma.id)) {
          Store.upsert("matriculas", { alunoId, turmaId: turma.id, status: "cursando", data: U.hojeISO(), bolsa: false });
          mats++;
        }
      }
    }
  } catch (e) {
    alert("Não foi possível concluir a importação: " + (e.message || e) + "\nO armazenamento pode estar cheio.");
    return;
  }

  impAlunos = null;
  App.fecharModal();
  App.render();
  const extra = [
    mats ? `${mats} ${U.plural(mats, "matrícula", "matrículas")}` : "",
    cursosC ? `${cursosC} ${U.plural(cursosC, "curso criado", "cursos criados")}` : "",
    reuse ? `${reuse} já existiam` : ""
  ].filter(Boolean).join(" · ");
  U.toast(`${novos} ${U.plural(novos, "aluno importado", "alunos importados")}${extra ? " · " + extra : ""}.`);
};

/* Professores, funcionários e colaboradores: cadastro completo com
   documentos, PIX, data de início e arquivos anexados */
"use strict";

const MAX_ARQUIVOS = 5;       // "pelo menos 3" — deixamos 5 espaços
let arquivosForm = [];        // anexos da pessoa em edição no modal

function subnavEquipe(ativa) {
  return `<div class="subtabs">
    <a href="#/professores" class="${ativa === "professores" ? "active" : ""}">Professores</a>
    <a href="#/professores/equipe" class="${ativa === "equipe" ? "active" : ""}">Funcionários e colaboradores</a>
    <a href="#/professores/assistente-social" class="${ativa === "assistente-social" ? "active" : ""}">Assistente Social</a>
  </div>`;
}

/* campos comuns a professores, funcionários e colaboradores */
/* O vínculo turma↔professor vivia só dentro de cada turma: para dar três
   turmas a alguém era preciso abrir as três. Como é esse vínculo que faz a
   área do professor deixar de ficar vazia, ele passa a estar também aqui, no
   cadastro da pessoa — onde se pensa "quais turmas são da Maiara". */
function turmasCheckHTML(p) {
  const turmas = Store.col("turmas").slice().sort((a, b) =>
    (b.dataInicio || "").localeCompare(a.dataInicio || ""));
  if (!turmas.length) {
    return `<div class="empty-note" style="padding:16px;">Nenhuma turma cadastrada ainda. Crie as turmas na aba <strong>Turmas</strong> e volte aqui.</div>`;
  }
  return `<div class="turmas-check">${turmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    const dono = t.professorId && t.professorId !== p.id ? Store.get("professores", t.professorId) : null;
    return `
      <label class="turma-check">
        <input type="checkbox" class="chk-turma" value="${t.id}" ${t.professorId === p.id ? "checked" : ""}>
        <span>
          <strong>${U.esc(c ? c.nome : "—")}</strong> · ${U.esc(t.nome)}
          ${t.horario ? ` · ${U.esc(t.horario)}` : ""}
          <em style="color:var(--text-muted); font-style:normal;"> — ${U.esc(t.status)}</em>
          ${dono ? `<em style="color:var(--danger); font-style:normal;"> · hoje é de ${U.esc(dono.nome.split(" ")[0])}</em>` : ""}
        </span>
      </label>`;
  }).join("")}</div>`;
}

/* Grava o que foi marcado. Só mexe nas turmas que realmente mudaram, para não
   reescrever a coleção inteira a cada salvamento. */
function aplicarTurmasDoProfessor(profId) {
  const caixas = document.querySelectorAll(".chk-turma");
  if (!caixas.length) return;   // o campo não estava na tela (sem permissão)
  caixas.forEach(cx => {
    const t = Store.get("turmas", cx.value);
    if (!t) return;
    const eraDele = t.professorId === profId;
    if (cx.checked && !eraDele) Store.upsert("turmas", { ...t, professorId: profId });
    else if (!cx.checked && eraDele) Store.upsert("turmas", { ...t, professorId: "" });
  });
}

function camposPessoaisHTML(p, prefixo) {
  return `
    <div class="field">
      <label for="${prefixo}-nasc">Data de nascimento</label>
      <input id="${prefixo}-nasc" name="nascimento" type="date" value="${U.esc(p.nascimento)}">
    </div>
    <div class="field">
      <label for="${prefixo}-inicio">Início no instituto</label>
      <input id="${prefixo}-inicio" name="dataInicio" type="date" value="${U.esc(p.dataInicio)}">
    </div>
    <div class="field">
      <label for="${prefixo}-cpf">CPF</label>
      <input id="${prefixo}-cpf" name="cpf" placeholder="000.000.000-00" value="${U.esc(p.cpf)}">
    </div>
    <div class="field">
      <label for="${prefixo}-cnpj">CNPJ (se tiver)</label>
      <input id="${prefixo}-cnpj" name="cnpj" placeholder="00.000.000/0001-00" value="${U.esc(p.cnpj)}">
    </div>
    <div class="field full">
      <label for="${prefixo}-end">Endereço (rua e número)</label>
      <input id="${prefixo}-end" name="endereco" value="${U.esc(p.endereco)}">
    </div>
    <div class="field">
      <label for="${prefixo}-bairro">Bairro</label>
      <input id="${prefixo}-bairro" name="bairro" value="${U.esc(p.bairro)}">
    </div>
    <div class="field">
      <label for="${prefixo}-cidade">Cidade</label>
      <input id="${prefixo}-cidade" name="cidade" value="${U.esc(p.cidade)}">
    </div>
    <div class="field">
      <label for="${prefixo}-cep">CEP</label>
      <input id="${prefixo}-cep" name="cep" value="${U.esc(p.cep)}">
    </div>
    <div class="field">
      <label for="${prefixo}-pix">Chave PIX (opcional)</label>
      <input id="${prefixo}-pix" name="pix" placeholder="CPF, telefone, e-mail ou aleatória" value="${U.esc(p.pix)}">
    </div>
    <div class="form-section">Arquivos (RG, comprovantes, contratos… até ${MAX_ARQUIVOS})</div>
    <div class="full">
      <div id="arq-lista" class="cross-chips"></div>
      <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
        <button type="button" class="btn ghost sm" data-modal-action="addArquivos">+ Anexar arquivos</button>
        <span id="arq-contagem" style="font-size:0.78rem; color:var(--text-muted);"></span>
      </div>
      <input type="file" id="arq-input" multiple hidden>
    </div>`;
}

function renderArquivosForm() {
  const lista = document.getElementById("arq-lista");
  const cont = document.getElementById("arq-contagem");
  if (!lista) return;
  lista.innerHTML = arquivosForm.map((a, i) => `
    <span class="chip">&#128196; ${U.esc(a.nome)}
      <button type="button" class="icon-btn arq-remover" data-i="${i}" style="padding:0 2px;" title="Remover" aria-label="Remover arquivo">&#10005;</button>
    </span>`).join("");
  cont.textContent = `${arquivosForm.length} de ${MAX_ARQUIVOS}`;
  lista.querySelectorAll(".arq-remover").forEach(b => {
    b.onclick = () => { arquivosForm.splice(Number(b.dataset.i), 1); renderArquivosForm(); };
  });
}

function ligarUploadArquivos() {
  renderArquivosForm();
  const input = document.getElementById("arq-input");
  if (!input) return;
  input.addEventListener("change", async () => {
    const arquivos = [...input.files];
    input.value = "";
    for (const arq of arquivos) {
      if (arquivosForm.length >= MAX_ARQUIVOS) { U.toast(`Limite de ${MAX_ARQUIVOS} arquivos atingido.`); break; }
      try {
        if (arq.type.startsWith("image/")) {
          arquivosForm.push({ nome: arq.name, dataUrl: await U.comprimirImagem(arq) });
        } else {
          if (arq.size > 1.5 * 1024 * 1024) { alert(`"${arq.name}" é muito grande (máx. 1,5 MB por arquivo que não seja imagem).`); continue; }
          const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onerror = () => rej(new Error("falha na leitura"));
            r.onload = () => res(r.result);
            r.readAsDataURL(arq);
          });
          arquivosForm.push({ nome: arq.name, dataUrl });
        }
      } catch (e) {
        alert(`"${arq.name}": ${e.message}`);
      }
    }
    renderArquivosForm();
  });
}

Actions.addArquivos = () => {
  if (arquivosForm.length >= MAX_ARQUIVOS) { U.toast(`Limite de ${MAX_ARQUIVOS} arquivos atingido.`); return; }
  document.getElementById("arq-input").click();
};

function linksArquivos(p) {
  return (p.arquivos || []).map(a =>
    `<a class="chip" href="${a.dataUrl}" download="${U.esc(a.nome)}" style="text-decoration:none;">&#128196; ${U.esc(a.nome)}</a>`).join("");
}

/* ---------------- professores ---------------- */

Views.professores = param => {
  if (param === "equipe") return viewEquipe();
  if (param === "assistente-social") return viewProfSociais();
  const profs = U.ordenarPorNome(Store.col("professores"));
  const cards = profs.map((p, i) => {
    const turmas = Store.col("turmas").filter(t => t.professorId === p.id);
    const cursos = [...new Set(turmas.map(t => Store.get("cursos", t.cursoId)).filter(Boolean))];
    return `
      <div class="entity-card cor-${(i % 8) + 1}">
        <div class="e-head">
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="avatar">${U.iniciais(p.nome)}</span>
            <div>
              <div class="e-title">${U.esc(p.nome)}</div>
              <div class="e-meta">${U.esc(p.formacao || "")}</div>
            </div>
          </div>
          <div class="e-actions">
            <button class="icon-btn" data-action="editarProf" data-id="${p.id}" title="Editar" aria-label="Editar professor">&#9998;</button>
            <button class="icon-btn" data-action="excluirProf" data-id="${p.id}" title="Excluir" aria-label="Excluir professor">&#128465;</button>
          </div>
        </div>
        ${cursos.length ? `<div class="cross-chips">${cursos.map(c =>
          `<span class="chip cor-${c.corIndex}">${U.esc(c.nome)}</span>`).join("")}</div>` : ""}
        ${p.experiencia ? `<div class="e-meta">${U.esc(p.experiencia)}</div>` : ""}
        <div class="e-meta">
          ${U.esc(p.telefone || "")}${p.telefone && p.email ? " · " : ""}${U.esc(p.email || "")}
          ${p.dataInicio ? `<br>No instituto desde ${U.fmtData(p.dataInicio)}` : ""}
        </div>
        ${(p.arquivos || []).length ? `<div class="cross-chips">${linksArquivos(p)}</div>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Professores</h2>
        <p>Corpo docente do instituto, com dados completos, documentos e anexos.</p>
      </div>
      <div class="head-actions">
        <a class="btn ghost" href="#/professor" style="text-decoration:none;">&#128274; Área do professor</a>
        <button class="btn accent" data-action="novoProf">+ Novo professor</button>
      </div>
    </div>
    ${subnavEquipe("professores")}
    ${profs.length ? `<div class="grid-cards">${cards}</div>`
      : `<div class="panel"><div class="empty-note">Nenhum professor cadastrado ainda.</div></div>`}
  `;
};

function abrirFormProf(p) {
  arquivosForm = [...(p.arquivos || [])];
  App.abrirModal(p.id ? "Editar professor" : "Novo professor", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fp-nome">Nome completo *</label>
          <input id="fp-nome" name="nome" required value="${U.esc(p.nome)}">
        </div>
        <div class="field">
          <label for="fp-tel">Telefone</label>
          <input id="fp-tel" name="telefone" value="${U.esc(p.telefone)}">
        </div>
        <div class="field">
          <label for="fp-email">E-mail</label>
          <input id="fp-email" name="email" type="email" value="${U.esc(p.email)}">
        </div>
        <div class="field full">
          <label for="fp-form">Formação</label>
          <input id="fp-form" name="formacao" value="${U.esc(p.formacao)}">
        </div>
        <div class="field full">
          <label for="fp-exp">Experiência profissional</label>
          <textarea id="fp-exp" name="experiencia">${U.esc(p.experiencia)}</textarea>
        </div>
        ${App.ehAdmin() || App.nivel() === "secretaria" ? `
        <div class="form-section">Turmas deste professor</div>
        <div class="field full">
          <p class="panel-sub" style="margin:0 0 8px;">Marque as turmas que são dele. É isto que faz as turmas e a chamada aparecerem na área dele quando entrar.</p>
          ${turmasCheckHTML(p)}
        </div>` : ""}
        <div class="form-section">Documentos e dados pessoais</div>
        ${camposPessoaisHTML(p, "fp")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar professor</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    const obj = {
      id: p.id || undefined, ...dados, nome: dados.nome.trim(),
      arquivos: arquivosForm.slice(0, MAX_ARQUIVOS)
    };
    let salvo;
    try {
      salvo = Store.upsert("professores", obj);
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova anexos e tente novamente.");
      return false;
    }
    aplicarTurmasDoProfessor(salvo.id);
    U.toast("Professor salvo.");
    App.render();
  }, p);
  ligarUploadArquivos();
}

const PROF_VAZIO = {
  nome: "", telefone: "", email: "", formacao: "", experiencia: "",
  nascimento: "", dataInicio: "", cpf: "", cnpj: "", endereco: "", bairro: "",
  cidade: "", cep: "", pix: "", arquivos: []
};

Actions.novoProf = () => abrirFormProf({ ...PROF_VAZIO });
Actions.editarProf = id => abrirFormProf(Store.get("professores", id));
Actions.excluirProf = id => {
  const p = Store.get("professores", id);
  if (confirm(`Excluir o professor "${p.nome}"?`)) {
    Store.remover("professores", id);
    U.toast("Professor excluído.");
    App.render();
  }
};

/* ---------------- funcionários e colaboradores ---------------- */

function viewEquipe() {
  const pessoas = U.ordenarPorNome(Store.col("equipe"));
  const cards = pessoas.map((p, i) => `
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
          <button class="icon-btn" data-action="editarEquipe" data-id="${p.id}" title="Editar" aria-label="Editar registro">&#9998;</button>
          <button class="icon-btn" data-action="excluirEquipe" data-id="${p.id}" title="Excluir" aria-label="Excluir registro">&#128465;</button>
        </div>
      </div>
      <div class="cross-chips">
        <span class="pill ${p.tipo === "colaborador" ? "info" : "ok"}">${p.tipo === "colaborador" ? "Colaborador(a)" : "Funcionário(a)"}</span>
      </div>
      <div class="e-meta">
        ${U.esc(p.telefone || "")}${p.telefone && p.email ? " · " : ""}${U.esc(p.email || "")}
        ${p.dataInicio ? `<br>No instituto desde ${U.fmtData(p.dataInicio)}` : ""}
      </div>
      ${(p.arquivos || []).length ? `<div class="cross-chips">${linksArquivos(p)}</div>` : ""}
    </div>`).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Funcionários e colaboradores</h2>
        <p>Registro da equipe do instituto, com documentos, PIX e anexos.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoEquipe">+ Novo registro</button>
      </div>
    </div>
    ${subnavEquipe("equipe")}
    ${pessoas.length ? `<div class="grid-cards">${cards}</div>`
      : `<div class="panel"><div class="empty-note">Nenhum funcionário ou colaborador registrado ainda.</div></div>`}
  `;
}

function abrirFormEquipe(p) {
  arquivosForm = [...(p.arquivos || [])];
  App.abrirModal(p.id ? "Editar registro" : "Novo funcionário/colaborador", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fq-nome">Nome completo *</label>
          <input id="fq-nome" name="nome" required value="${U.esc(p.nome)}">
        </div>
        <div class="field">
          <label for="fq-tipo">Tipo *</label>
          <select id="fq-tipo" name="tipo">
            <option value="funcionario" ${p.tipo !== "colaborador" ? "selected" : ""}>Funcionário(a)</option>
            <option value="colaborador" ${p.tipo === "colaborador" ? "selected" : ""}>Colaborador(a)</option>
          </select>
        </div>
        <div class="field">
          <label for="fq-funcao">Função / cargo</label>
          <input id="fq-funcao" name="funcao" placeholder="ex.: Secretaria, Limpeza, Voluntária" value="${U.esc(p.funcao)}">
        </div>
        <div class="field">
          <label for="fq-tel">Telefone</label>
          <input id="fq-tel" name="telefone" value="${U.esc(p.telefone)}">
        </div>
        <div class="field">
          <label for="fq-email">E-mail</label>
          <input id="fq-email" name="email" type="email" value="${U.esc(p.email)}">
        </div>
        <div class="form-section">Documentos e dados pessoais</div>
        ${camposPessoaisHTML(p, "fq")}
        <div class="field full">
          <label for="fq-obs">Observações</label>
          <textarea id="fq-obs" name="observacoes">${U.esc(p.observacoes)}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar registro</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    try {
      Store.upsert("equipe", {
        id: p.id || undefined, ...dados, nome: dados.nome.trim(),
        arquivos: arquivosForm.slice(0, MAX_ARQUIVOS)
      });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova anexos e tente novamente.");
      return false;
    }
    U.toast("Registro salvo.");
    App.render();
  }, p);
  ligarUploadArquivos();
}

Actions.novoEquipe = () => abrirFormEquipe({ ...PROF_VAZIO, tipo: "funcionario", funcao: "", observacoes: "" });
Actions.editarEquipe = id => abrirFormEquipe(Store.get("equipe", id));
Actions.excluirEquipe = id => {
  const p = Store.get("equipe", id);
  if (confirm(`Excluir o registro de "${p.nome}"?`)) {
    Store.remover("equipe", id);
    U.toast("Registro excluído.");
    App.render();
  }
};

/* -------------- Área do professor (acesso restrito por conta) -------------- */

const CHAVE_PROFESSOR_LOGADO = "bzn-professor-logado";

function professorLogado() {
  const id = sessionStorage.getItem(CHAVE_PROFESSOR_LOGADO);
  if (!id) return null;
  const p = Store.get("professores", id);
  if (!p) { sessionStorage.removeItem(CHAVE_PROFESSOR_LOGADO); return null; }
  return p;
}

Views.professorArea = () => {
  const prof = professorLogado();
  if (!prof) {
    return `
      <div class="page-head">
        <div>
          <h2>Área do professor</h2>
          <p>Acesso restrito: cada professor vê apenas as próprias turmas, alunos e chamadas.</p>
        </div>
        ${App.ehAdmin() ? `<div class="head-actions"><a class="btn ghost" href="#/professores" style="text-decoration:none;">&larr; Voltar</a></div>` : ""}
      </div>
      ${U.painelSoConta("Entrar na sua área", "Esta área é aberta pela sua conta")}
    `;
  }

  /* logado: turmas, alunos e estatísticas do professor */
  const minhasTurmas = Store.col("turmas").filter(t => t.professorId === prof.id)
    .sort((a, b) => (b.dataInicio || "").localeCompare(a.dataInicio || ""));
  const idsAlunos = new Set();
  minhasTurmas.forEach(t => Store.matriculasDaTurma(t.id).forEach(m => idsAlunos.add(m.alunoId)));

  const medias = minhasTurmas.map(t => Store.presencaMediaTurma(t.id)).filter(x => x !== null);
  const mediaGeral = medias.length ? Math.round(medias.reduce((a, b) => a + b, 0) / medias.length) : null;
  const risco = Store.alunosEmRisco().filter(x => x.turma.professorId === prof.id);

  const linhasTurmas = minhasTurmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    const qtd = Store.matriculasDaTurma(t.id).length;
    const media = Store.presencaMediaTurma(t.id);
    return `
      <tr>
        <td><span class="chip cor-${c ? c.corIndex : 8}">${U.esc(c ? c.nome : "—")}</span></td>
        <td>${U.esc(t.nome)}</td>
        <td>${U.esc(t.horario || "—")}</td>
        <td>${qtd}</td>
        <td>${media !== null ? media + "%" : "—"}</td>
        <td>${U.esc(t.status)}</td>
        <td><button class="btn sm accent" data-action="irChamada" data-id="${t.id}">Fazer chamada</button></td>
      </tr>`;
  }).join("");

  const blocosAlunos = minhasTurmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    const mats = Store.matriculasDaTurma(t.id);
    if (!mats.length) return "";
    const linhas = mats.map(m => ({ m, aluno: Store.get("alunos", m.alunoId) }))
      .filter(x => x.aluno)
      .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"))
      .map(({ m, aluno }) => {
        const p = Store.presencaAluno(t.id, aluno.id);
        const cls = p.pct === null ? "info" : p.pct >= Store.config.presencaMinima ? "ok" : "bad";
        return `<tr>
          <td>${U.esc(aluno.nome)}</td>
          <td>${U.esc(aluno.telefone || "—")}</td>
          <td><span class="pill ${cls}">${p.pct !== null ? p.pct + "%" : "sem registros"}</span></td>
          <td>${U.esc(m.status)}</td>
        </tr>`;
      }).join("");
    return `
      <div class="panel">
        <h3><span class="chip cor-${c ? c.corIndex : 8}">${U.esc(c ? c.nome : "—")}</span> ${U.esc(t.nome)}</h3>
        <p class="panel-sub">Alunos e frequência — contato apenas, sem dados sociais</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Aluno</th><th>Telefone</th><th>Frequência</th><th>Matrícula</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table></div>
      </div>`;
  }).join("");

  /* os cursos das turmas dele, sem repetir: a ementa é do curso, não da turma */
  const meusCursos = [];
  const jaVistos = new Set();
  for (const t of minhasTurmas) {
    if (!t.cursoId || jaVistos.has(t.cursoId)) continue;
    const c = Store.get("cursos", t.cursoId);
    if (c) { jaVistos.add(c.id); meusCursos.push(c); }
  }

  const blocosCursos = meusCursos.map(c => {
    const mods = c.modulos || [];
    const ch = mods.reduce((soma, m) => soma + (Number(m.horas) || 0), 0);
    const fotos = c.fotos || [];
    return `
      <div class="panel">
        <h3><span class="chip cor-${c.corIndex || 8}">${U.esc(c.nome)}</span></h3>
        <p class="panel-sub">${mods.length} ${U.plural(mods.length, "módulo", "módulos")} · ${ch}h de carga horária</p>
        ${c.ementa
          ? `<p style="white-space:pre-wrap;">${U.esc(c.ementa)}</p>`
          : `<div class="empty-note" style="padding:18px;">A ementa deste curso ainda não foi preenchida pela secretaria.</div>`}
        ${mods.length ? `<div class="cross-chips">${mods.map(m =>
          `<span class="chip">${U.esc(m.nome)} · ${m.horas || 0}h</span>`).join("")}</div>` : ""}
        ${fotos.length ? `<div class="foto-strip">${fotos.map((f, i) =>
          `<img src="${f}" alt="Foto ${i + 1} de ${U.esc(c.nome)}" loading="lazy" data-action="verFoto" data-id="${c.id}:${i}">`).join("")}</div>` : ""}
        <div class="form-actions">
          <button class="btn ghost sm" data-action="addFotoCurso" data-id="${c.id}">&#128247; Adicionar fotos da aula</button>
          <span style="font-size:0.78rem; color:var(--text-muted); align-self:center;">${fotos.length} de ${MAX_FOTOS}</span>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Área do professor — ${U.esc(prof.nome)}</h2>
        <p>Suas turmas, seus alunos e a chamada, tudo num lugar só.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="sairProfessor">Sair da minha área</button>
      </div>
    </div>

    <section class="stat-strip">
      <div class="stat-card" style="--stat-color: var(--navy-accent)">
        <span class="label">Minhas turmas</span>
        <span class="value">${minhasTurmas.length}</span>
        <span class="delta">${minhasTurmas.filter(t => t.status === "em andamento").length} em andamento</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--accent)">
        <span class="label">Meus alunos</span>
        <span class="value">${idsAlunos.size}</span>
        <span class="delta">alunos distintos</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--good)">
        <span class="label">Presença média</span>
        <span class="value">${mediaGeral !== null ? mediaGeral + "%" : "—"}</span>
        <span class="delta">das minhas turmas</span>
      </div>
      <div class="stat-card" style="--stat-color: ${risco.length ? "var(--danger)" : "var(--good)"}">
        <span class="label">Alunos em risco</span>
        <span class="value">${risco.length}</span>
        <span class="delta">abaixo de ${Store.config.presencaMinima}% de presença</span>
      </div>
    </section>

    <div class="panel">
      <h3>Minhas turmas</h3>
      <p class="panel-sub">Clique em "Fazer chamada" para registrar a presença de hoje</p>
      ${minhasTurmas.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Curso</th><th>Turma</th><th>Horário</th><th>Alunos</th><th>Presença</th><th>Status</th><th></th></tr></thead>
        <tbody>${linhasTurmas}</tbody>
      </table></div>` : `<div class="empty-note">Você ainda não tem turmas vinculadas.</div>`}
    </div>

    ${risco.length ? `
    <div class="panel">
      <h3>Alunos em risco nas minhas turmas</h3>
      <p class="panel-sub">Frequência abaixo do mínimo de ${Store.config.presencaMinima}%</p>
      ${risco.map(x => `
        <div class="alert-box warn">
          <span class="ico">&#9888;</span>
          <div>
            <strong>${U.esc(x.aluno ? x.aluno.nome : "—")} — ${x.pct}%</strong>
            <p>${U.esc(x.curso ? x.curso.nome : "")} · ${U.esc(x.turma.nome)}</p>
          </div>
        </div>`).join("")}
    </div>` : ""}

    ${blocosAlunos}

    ${blocosCursos}

    <div class="panel">
      <div class="head-actions" style="justify-content:space-between; align-items:center; width:100%;">
        <h3 style="margin:0;">Meus dados</h3>
        <button class="btn sm" data-action="editarMeusDados">&#9998; Editar</button>
      </div>
      <p class="panel-sub">Mantenha o contato em dia: é por aqui que a secretaria fala com você.</p>
      <div class="rolar"><table>
        <tbody>
          ${[["Nome", prof.nome], ["Telefone", prof.telefone], ["E-mail", prof.email],
             ["Formação", prof.formacao], ["Experiência", prof.experiencia]]
            .map(([r, v]) => `<tr>
              <th style="width:130px;">${r}</th>
              <td>${v ? U.esc(v) : '<span style="color:var(--text-muted);">— não informado —</span>'}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>
    </div>

    <input type="file" id="prof-foto-input" accept="image/*" multiple hidden>
  `;
};

/* O professor edita o próprio contato, e só isso: nome e documentos continuam
   com a secretaria, que é quem responde pelo cadastro perante o instituto. */
Actions.editarMeusDados = () => {
  const prof = professorLogado();
  if (!prof) return;
  App.abrirModal("Meus dados", `
    <form>
      <p class="panel-sub" style="margin-top:0;">${U.esc(prof.nome)}</p>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field">
          <label for="md-tel">Telefone</label>
          <input id="md-tel" name="telefone" value="${U.esc(prof.telefone || "")}">
        </div>
        <div class="field">
          <label for="md-email">E-mail</label>
          <input id="md-email" name="email" type="email" value="${U.esc(prof.email || "")}">
        </div>
        <div class="field">
          <label for="md-form">Formação</label>
          <input id="md-form" name="formacao" value="${U.esc(prof.formacao || "")}">
        </div>
        <div class="field">
          <label for="md-exp">Experiência profissional</label>
          <textarea id="md-exp" name="experiencia">${U.esc(prof.experiencia || "")}</textarea>
        </div>
      </div>
      <p class="panel-sub">Para trocar seu nome ou seus documentos, fale com a secretaria.</p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar</button>
      </div>
    </form>`, dados => {
    Store.upsert("professores", { ...prof, ...dados });
    U.toast("Dados atualizados.");
    App.render();
  }, prof);
};

/* Fotos da aula: o professor acrescenta à galeria do curso que ele dá. Não
   remove — tirar foto do registro de um curso é decisão da secretaria. */
Actions.addFotoCurso = cursoId => {
  const inp = document.getElementById("prof-foto-input");
  if (!inp) return;
  inp.dataset.curso = cursoId;
  inp.click();
};

const aposRenderProfAnterior = Views.aposRender;
Views.aposRender = (rota, param) => {
  if (aposRenderProfAnterior) aposRenderProfAnterior(rota, param);
  if (rota !== "professor") return;
  const inp = document.getElementById("prof-foto-input");
  if (!inp) return;
  inp.onchange = async () => {
    const c = Store.get("cursos", inp.dataset.curso);
    const arquivos = [...inp.files];
    inp.value = "";
    if (!c || !arquivos.length) return;
    const fotos = [...(c.fotos || [])];
    let novas = 0;
    for (const arq of arquivos) {
      if (fotos.length >= MAX_FOTOS) { U.toast(`Limite de ${MAX_FOTOS} fotos por curso.`); break; }
      if (!arq.type.startsWith("image/")) { U.toast(`"${arq.name}" não é uma imagem.`); continue; }
      try { fotos.push(await U.comprimirImagem(arq)); novas++; } catch (e) { /* ignora a que falhar */ }
    }
    if (!novas) return;
    try {
      Store.upsert("cursos", { ...c, fotos });
    } catch (e) {
      alert("Não foi possível salvar as fotos: o armazenamento do navegador está cheio.");
      return;
    }
    U.toast(`${novas} ${U.plural(novas, "foto adicionada", "fotos adicionadas")}.`);
    App.render();
  };
};

Actions.sairProfessor = () => {
  sessionStorage.removeItem(CHAVE_PROFESSOR_LOGADO);
  U.toast("Você saiu da sua área.");
  App.render();
};

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
        <div class="form-section">Documentos e dados pessoais</div>
        ${camposPessoaisHTML(p, "fp")}
        ${App.ehAdmin() ? `
        <div class="form-section">Acesso à "Área do professor" (somente admin/presidência altera)</div>
        <div class="field">
          <label for="fp-pin">PIN de acesso (4 a 6 dígitos)</label>
          <input id="fp-pin" name="pinNovo" type="password" inputmode="numeric" minlength="4" maxlength="6"
            placeholder="${p.pinHash ? "já cadastrado — preencha para trocar" : "defina o PIN do professor"}" autocomplete="new-password">
        </div>` : ""}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar professor</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    const { pinNovo, ...resto } = dados;
    const obj = {
      id: p.id || undefined, ...resto, nome: dados.nome.trim(),
      pinHash: p.pinHash || "", arquivos: arquivosForm.slice(0, MAX_ARQUIVOS)
    };
    if (pinNovo && pinNovo.trim()) {
      if (!/^\d{4,6}$/.test(pinNovo.trim())) { alert("O PIN deve ter de 4 a 6 dígitos numéricos."); return false; }
      obj.pinHash = U.hashPin(pinNovo.trim());
    }
    try {
      Store.upsert("professores", obj);
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova anexos e tente novamente.");
      return false;
    }
    U.toast("Professor salvo.");
    App.render();
  });
  ligarUploadArquivos();
}

const PROF_VAZIO = {
  nome: "", telefone: "", email: "", formacao: "", experiencia: "", pinHash: "",
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
  });
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

/* ---------------- Área do professor (acesso restrito por PIN) ---------------- */

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
    const profs = U.ordenarPorNome(Store.col("professores"));
    return `
      <div class="page-head">
        <div>
          <h2>Área do professor</h2>
          <p>Acesso restrito: cada professor vê apenas as próprias turmas, alunos e chamadas.</p>
        </div>
        <div class="head-actions"><a class="btn ghost" href="#/professores" style="text-decoration:none;">&larr; Voltar</a></div>
      </div>
      <div class="panel" style="max-width:480px;">
        <h3>Entrar</h3>
        <p class="panel-sub">Escolha seu nome e digite seu PIN</p>
        ${profs.length ? `
        <div class="form-grid" style="grid-template-columns:1fr;">
          <div class="field">
            <label for="login-professor">Professor</label>
            <select id="login-professor">
              ${profs.map(p => `<option value="${p.id}">${U.esc(p.nome)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="login-pin-prof">PIN</label>
            <input id="login-pin-prof" type="password" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos" autocomplete="off">
          </div>
        </div>
        <div class="form-actions">
          <button class="btn accent" data-action="entrarProfessor">Entrar</button>
        </div>
        <div class="alert-box info" style="margin-top:14px;">
          <span class="ico">&#128274;</span>
          <div><p>O PIN é cadastrado pela secretaria no formulário do professor (aba Professores → editar).</p></div>
        </div>`
        : `<div class="empty-note" style="text-align:left;">
            <p style="margin:0 0 8px;"><strong>Nenhum professor aparece neste aparelho.</strong></p>
            <p style="margin:0 0 12px; font-size:0.9rem;">Se o instituto já usa o sistema, é porque <strong>este computador ainda não baixou os dados</strong> da nuvem. Traga-os uma vez (depois é só entrar com o PIN):</p>
            <button class="btn accent" data-action="conectarNuvem">&#9729;&#65039; Trazer os dados do instituto</button>
          </div>`}
      </div>
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
      <div class="stat-card" style="--stat-color: var(--navy-strong)">
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
  `;
};

Actions.entrarProfessor = () => {
  const id = document.getElementById("login-professor").value;
  const pin = document.getElementById("login-pin-prof").value.trim();
  const p = Store.get("professores", id);
  if (!p) return;
  if (!p.pinHash) { alert("Este professor ainda não tem PIN cadastrado.\nPeça para a secretaria definir o PIN na aba Professores → editar."); return; }
  if (U.hashPin(pin) !== p.pinHash) {
    U.toast("PIN incorreto.");
    document.getElementById("login-pin-prof").value = "";
    document.getElementById("login-pin-prof").focus();
    return;
  }
  sessionStorage.setItem(CHAVE_PROFESSOR_LOGADO, p.id);
  U.toast(`Bem-vindo(a), ${p.nome.split(" ")[0]}!`);
  App.render();
};

Actions.sairProfessor = () => {
  sessionStorage.removeItem(CHAVE_PROFESSOR_LOGADO);
  U.toast("Você saiu da sua área.");
  App.render();
};

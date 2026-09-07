/* Cursos: lista, ementa, módulos, carga horária */
"use strict";

Views.cursos = () => {
  const cursos = U.ordenarPorNome(Store.col("cursos"));
  const cards = cursos.map(c => {
    const ch = Store.cargaHoraria(c);
    const turmas = Store.col("turmas").filter(t => t.cursoId === c.id);
    const alunos = new Set(
      Store.col("matriculas").filter(m => turmas.some(t => t.id === m.turmaId)).map(m => m.alunoId)
    ).size;
    return `
      <div class="entity-card cor-${c.corIndex}">
        <div class="e-head">
          <div>
            <div class="e-title">${U.esc(c.nome)}</div>
            <span class="chip">${{ workshop: "Workshop", palestra: "Palestra", imersao: "Imersão" }[c.modalidade] || "Curso"}</span>
            <span class="chip">${c.status === "ativo" ? "Ativo" : "Inativo"}</span>
            ${c.tipoCurso === "pago"
              ? `<span class="pill info">pago · ${U.moeda(c.valor)}${c.cobranca === "mensal" ? "/mês" : ""}</span>`
              : `<span class="pill ok">gratuito</span>`}
          </div>
          <div class="e-actions">
            <button class="icon-btn" data-action="editarCurso" data-id="${c.id}" title="Editar" aria-label="Editar curso">&#9998;</button>
            <button class="icon-btn" data-action="excluirCurso" data-id="${c.id}" title="Excluir" aria-label="Excluir curso">&#128465;</button>
          </div>
        </div>
        <div class="e-meta">
          ${c.modulos.length} ${U.plural(c.modulos.length, "módulo", "módulos")} · ${ch}h de carga horária<br>
          ${turmas.length} ${U.plural(turmas.length, "turma", "turmas")} · ${alunos} ${U.plural(alunos, "aluno", "alunos")}
        </div>
        ${c.ementa ? `<div class="e-meta">${U.esc(c.ementa).slice(0, 160)}${c.ementa.length > 160 ? "…" : ""}</div>` : ""}
        ${c.modulos.length ? `<div class="cross-chips">${c.modulos.map(m =>
          `<span class="chip">${U.esc(m.nome)} · ${m.horas || 0}h</span>`).join("")}</div>` : ""}
        ${(c.fotos || []).length ? `<div class="foto-strip">${c.fotos.map((f, i) =>
          `<img src="${f}" alt="Foto ${i + 1} de ${U.esc(c.nome)}" loading="lazy" data-action="verFoto" data-id="${c.id}:${i}">`).join("")}</div>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Cursos</h2>
        <p>Ementa, módulos e carga horária de cada curso oferecido pelo instituto.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoCurso">+ Novo curso</button>
      </div>
    </div>
    ${cursos.length ? `<div class="grid-cards">${cards}</div>`
      : `<div class="panel"><div class="empty-note">Nenhum curso cadastrado ainda.<br>Clique em <strong>+ Novo curso</strong> para começar.</div></div>`}
  `;
};

function formCursoHTML(c) {
  const modRows = (c.modulos.length ? c.modulos : [{ nome: "", descricao: "", horas: "" }])
    .map(m => modRowHTML(m)).join("");
  const corOpts = [1, 2, 3, 4, 5, 6, 7, 8].map(i =>
    `<option value="${i}" ${c.corIndex === i ? "selected" : ""}>Cor ${i}</option>`).join("");
  return `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="f-nome">Nome do curso *</label>
          <input id="f-nome" name="nome" required value="${U.esc(c.nome)}">
        </div>
        <div class="field full">
          <label for="f-ementa">Ementa</label>
          <textarea id="f-ementa" name="ementa">${U.esc(c.ementa)}</textarea>
        </div>
        <div class="field">
          <label for="f-modalidade">Modalidade</label>
          <select id="f-modalidade" name="modalidade">
            <option value="curso" ${(c.modalidade || "curso") === "curso" ? "selected" : ""}>Curso</option>
            <option value="workshop" ${c.modalidade === "workshop" ? "selected" : ""}>Workshop</option>
            <option value="palestra" ${c.modalidade === "palestra" ? "selected" : ""}>Palestra</option>
            <option value="imersao" ${c.modalidade === "imersao" ? "selected" : ""}>Imersão</option>
          </select>
        </div>
        <div class="field">
          <label for="f-status">Status</label>
          <select id="f-status" name="status">
            <option value="ativo" ${c.status === "ativo" ? "selected" : ""}>Ativo</option>
            <option value="inativo" ${c.status === "inativo" ? "selected" : ""}>Inativo</option>
          </select>
        </div>
        <div class="field">
          <label for="f-cor">Cor no painel</label>
          <select id="f-cor" name="corIndex">${corOpts}</select>
        </div>
        <div class="form-section">Financeiro</div>
        <div class="field">
          <label for="f-tipo">Tipo de curso</label>
          <select id="f-tipo" name="tipoCurso">
            <option value="gratuito" ${c.tipoCurso !== "pago" ? "selected" : ""}>Gratuito</option>
            <option value="pago" ${c.tipoCurso === "pago" ? "selected" : ""}>Pago</option>
          </select>
        </div>
        <div class="field">
          <label for="f-cobr">Cobrança</label>
          <select id="f-cobr" name="cobranca" ${c.tipoCurso !== "pago" ? "disabled" : ""}>
            <option value="unico" ${c.cobranca !== "mensal" ? "selected" : ""}>Valor único</option>
            <option value="mensal" ${c.cobranca === "mensal" ? "selected" : ""}>Mensal</option>
          </select>
        </div>
        <div class="field">
          <label for="f-valor">Valor (R$)</label>
          <input id="f-valor" name="valor" type="number" min="0" step="0.01" value="${U.esc(c.valor || "")}" ${c.tipoCurso !== "pago" ? "disabled" : ""}>
        </div>
        <div class="field full" style="font-size:0.78rem; color:var(--text-muted);">
          Em cursos pagos é possível marcar alunos como <strong>bolsistas</strong> na hora da matrícula.
        </div>
        <div class="form-section">Fotos (até 8 imagens)</div>
        <div class="full">
          <div id="foto-galeria" class="foto-galeria"></div>
          <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
            <button type="button" class="btn ghost sm" data-modal-action="addFotos">+ Adicionar fotos</button>
            <span id="foto-contagem" style="font-size:0.78rem; color:var(--text-muted);"></span>
          </div>
          <input type="file" id="foto-input" accept="image/*" multiple hidden>
        </div>
        <div class="form-section">Módulos (nome · descrição · horas)</div>
        <div class="full" id="mod-lista">${modRows}</div>
        <div class="full">
          <button type="button" class="btn ghost sm" data-modal-action="addModulo">+ Adicionar módulo</button>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar curso</button>
      </div>
    </form>`;
}

function modRowHTML(m) {
  return `
    <div class="mod-row">
      <input placeholder="Nome do módulo" class="mod-nome" value="${U.esc(m.nome)}">
      <input placeholder="Descrição" class="mod-desc" value="${U.esc(m.descricao)}">
      <input placeholder="Horas" type="number" min="0" class="mod-horas" value="${U.esc(m.horas)}">
      <button type="button" class="icon-btn mod-remover" title="Remover módulo" aria-label="Remover módulo">&#10005;</button>
    </div>`;
}

function lerModulos() {
  return [...document.querySelectorAll("#mod-lista .mod-row")]
    .map(r => ({
      nome: r.querySelector(".mod-nome").value.trim(),
      descricao: r.querySelector(".mod-desc").value.trim(),
      horas: Number(r.querySelector(".mod-horas").value) || 0
    }))
    .filter(m => m.nome);
}

function ligarRemocaoModulos() {
  document.querySelectorAll("#mod-lista .mod-remover").forEach(b => {
    b.onclick = () => b.closest(".mod-row").remove();
  });
}

const MAX_FOTOS = 8;
let fotosForm = []; // fotos do curso em edição no modal

function renderFotosForm() {
  const gal = document.getElementById("foto-galeria");
  const cont = document.getElementById("foto-contagem");
  if (!gal) return;
  gal.innerHTML = fotosForm.map((f, i) => `
    <div class="foto-thumb">
      <img src="${f}" alt="Foto ${i + 1}">
      <button type="button" class="foto-remover" data-i="${i}" title="Remover foto" aria-label="Remover foto">&#10005;</button>
    </div>`).join("");
  cont.textContent = `${fotosForm.length} de ${MAX_FOTOS}`;
  gal.querySelectorAll(".foto-remover").forEach(b => {
    b.onclick = () => { fotosForm.splice(Number(b.dataset.i), 1); renderFotosForm(); };
  });
}

function abrirFormCurso(c) {
  fotosForm = [...(c.fotos || [])];
  App.abrirModal(c.id ? "Editar curso" : "Novo curso", formCursoHTML(c), dados => {
    if (!dados.nome.trim()) return false;
    try {
      Store.upsert("cursos", {
        id: c.id || undefined,
        nome: dados.nome.trim(),
        ementa: dados.ementa.trim(),
        status: dados.status,
        modalidade: dados.modalidade || "curso",
        corIndex: Number(dados.corIndex) || 1,
        modulos: lerModulos(),
        fotos: fotosForm.slice(0, MAX_FOTOS),
        tipoCurso: dados.tipoCurso,
        cobranca: dados.tipoCurso === "pago" ? (dados.cobranca || "unico") : "",
        valor: dados.tipoCurso === "pago" ? (Number(dados.valor) || 0) : 0
      });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova algumas fotos e tente novamente.");
      return false;
    }
    U.toast("Curso salvo.");
    App.render();
  }, c);
  ligarRemocaoModulos();
  renderFotosForm();
  /* habilita/desabilita campos financeiros conforme o tipo */
  const selTipo = document.getElementById("f-tipo");
  selTipo.addEventListener("change", () => {
    const pago = selTipo.value === "pago";
    document.getElementById("f-cobr").disabled = !pago;
    document.getElementById("f-valor").disabled = !pago;
  });
  /* upload de fotos */
  const input = document.getElementById("foto-input");
  input.addEventListener("change", async () => {
    const arquivos = [...input.files];
    input.value = "";
    for (const arq of arquivos) {
      if (fotosForm.length >= MAX_FOTOS) { U.toast(`Limite de ${MAX_FOTOS} fotos atingido.`); break; }
      try {
        fotosForm.push(await U.comprimirImagem(arq));
      } catch (e) {
        alert(`"${arq.name}": ${e.message}`);
      }
    }
    renderFotosForm();
  });
}

Actions.addFotos = () => {
  if (fotosForm.length >= MAX_FOTOS) { U.toast(`Limite de ${MAX_FOTOS} fotos atingido.`); return; }
  document.getElementById("foto-input").click();
};

/* visualização ampliada da foto (clique no card) */
Actions.verFoto = ref => {
  const [cursoId, idx] = String(ref).split(":");
  const c = Store.get("cursos", cursoId);
  const fotos = (c && c.fotos) || [];
  let i = Number(idx) || 0;
  if (!fotos.length) return;
  const corpo = () => `
    <div style="text-align:center;">
      <img src="${fotos[i]}" alt="Foto ${i + 1} de ${U.esc(c.nome)}" style="max-width:100%; max-height:70vh; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
        <button type="button" class="btn ghost sm" id="foto-ant" ${fotos.length < 2 ? "hidden" : ""}>&larr; Anterior</button>
        <span style="font-size:0.8rem; color:var(--text-muted);">${i + 1} de ${fotos.length}</span>
        <button type="button" class="btn ghost sm" id="foto-prox" ${fotos.length < 2 ? "hidden" : ""}>Próxima &rarr;</button>
      </div>
    </div>`;
  App.abrirModal(c.nome, corpo());
  const religar = () => {
    document.getElementById("modal-body").innerHTML = corpo();
    ligar();
  };
  const ligar = () => {
    const a = document.getElementById("foto-ant"), p = document.getElementById("foto-prox");
    if (a) a.onclick = () => { i = (i - 1 + fotos.length) % fotos.length; religar(); };
    if (p) p.onclick = () => { i = (i + 1) % fotos.length; religar(); };
  };
  ligar();
};

Actions.novoCurso = () => abrirFormCurso({ nome: "", ementa: "", status: "ativo", corIndex: (Store.col("cursos").length % 8) + 1, modulos: [] });
Actions.editarCurso = id => abrirFormCurso(Store.get("cursos", id));
Actions.addModulo = () => {
  document.getElementById("mod-lista").insertAdjacentHTML("beforeend", modRowHTML({ nome: "", descricao: "", horas: "" }));
  ligarRemocaoModulos();
};
Actions.excluirCurso = id => {
  const c = Store.get("cursos", id);
  if (confirm(`Excluir o curso "${c.nome}"?\nAs turmas, matrículas e chamadas dele também serão removidas.`)) {
    Store.remover("cursos", id);
    U.toast("Curso excluído.");
    App.render();
  }
};

/* Documentação: documentos institucionais, formulários para download e
   links de imagens das atividades (organizados por assunto).
   Cada documento pode ser um arquivo enviado (PDF/imagem) ou um link externo
   (ex.: Google Drive) — o link evita encher o armazenamento do navegador. */
"use strict";

function subnavDoc(ativa) {
  const abas = [
    ["", "Documentos"], ["formularios", "Formulários"], ["imagens", "Links de imagens"]
  ];
  return `<div class="subtabs">${abas.map(([slug, rotulo]) =>
    `<a href="#/documentacao${slug ? "/" + slug : ""}" class="${ativa === slug ? "active" : ""}">${rotulo}</a>`
  ).join("")}</div>`;
}

Views.documentacao = param => {
  if (param === "imagens") return viewLinksImagens();
  return viewDocumentos(param === "formularios" ? "formulario" : "documento");
};

/* ---------- documentos e formulários (mesma estrutura, categorias diferentes) ---------- */

function viewDocumentos(categoria) {
  const ehForm = categoria === "formulario";
  const docs = Store.col("documentos")
    .filter(d => d.categoria === categoria)
    .sort((a, b) => (a.assunto || "").localeCompare(b.assunto || "", "pt-BR") || (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"));

  /* agrupa por assunto */
  let corpo = "";
  let assuntoAtual = null;
  for (const d of docs) {
    const assunto = d.assunto || "Sem assunto";
    if (assunto !== assuntoAtual) {
      assuntoAtual = assunto;
      corpo += `<div class="alpha-letter">${U.esc(assunto)}</div>`;
    }
    const alvo = d.tipo === "link" ? d.url : (d.arquivo && d.arquivo.dataUrl);
    const baixar = d.tipo === "link" ? `target="_blank" rel="noopener"` : `download="${U.esc((d.arquivo && d.arquivo.nome) || d.titulo)}"`;
    corpo += `
      <div class="aluno-row" style="cursor:default;">
        <span style="font-size:1.3rem;">${d.tipo === "link" ? "&#128279;" : "&#128196;"}</span>
        <div class="a-info">
          <div class="a-nome">${U.esc(d.titulo)}</div>
          <div class="a-sub">${d.tipo === "link" ? "Link externo" : U.esc((d.arquivo && d.arquivo.nome) || "")}${d.data ? " · " + U.fmtData(d.data) : ""}</div>
        </div>
        <div class="a-chips" style="align-items:center;">
          ${alvo ? `<a class="btn sm ghost" href="${alvo}" ${baixar} style="text-decoration:none;">${d.tipo === "link" ? "Abrir" : "Baixar"}</a>` : ""}
          <button class="icon-btn" data-action="editarDoc" data-id="${d.id}" title="Editar" aria-label="Editar">&#9998;</button>
          <button class="icon-btn" data-action="excluirDoc" data-id="${d.id}" title="Excluir" aria-label="Excluir">&#128465;</button>
        </div>
      </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Documentação</h2>
        <p>${ehForm
          ? "Formulários do instituto para baixar, imprimir e preencher (fichas de matrícula, autorizações, etc.)."
          : "Documentos institucionais em PDF: estatuto, atas, relatórios, projetos e histórico do instituto."}</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoDoc" data-id="${categoria}">+ ${ehForm ? "Novo formulário" : "Novo documento"}</button>
      </div>
    </div>
    ${subnavDoc(ehForm ? "formularios" : "")}
    <div class="panel">
      ${docs.length ? corpo : `<div class="empty-note">Nenhum ${ehForm ? "formulário" : "documento"} cadastrado ainda.<br>
        Use <strong>+ ${ehForm ? "Novo formulário" : "Novo documento"}</strong> para enviar um PDF ou colar um link.</div>`}
    </div>
  `;
}

function abrirFormDoc(d) {
  const ehForm = d.categoria === "formulario";
  const assuntos = [...new Set(Store.col("documentos").map(x => x.assunto).filter(Boolean))];
  App.abrirModal(d.id ? "Editar" : (ehForm ? "Novo formulário" : "Novo documento"), `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fd-titulo">Título *</label>
          <input id="fd-titulo" name="titulo" required placeholder="${ehForm ? "ex.: Ficha de matrícula 2026" : "ex.: Estatuto do Instituto"}" value="${U.esc(d.titulo)}">
        </div>
        <div class="field">
          <label for="fd-assunto">Assunto / categoria</label>
          <input id="fd-assunto" name="assunto" list="fd-assuntos" placeholder="ex.: Matrículas, Jurídico, Prestação de contas" value="${U.esc(d.assunto)}">
          <datalist id="fd-assuntos">${assuntos.map(a => `<option value="${U.esc(a)}">`).join("")}</datalist>
        </div>
        <div class="field">
          <label for="fd-data">Data</label>
          <input id="fd-data" name="data" type="date" value="${U.esc(d.data)}">
        </div>
        <div class="field full">
          <label for="fd-tipo">Como incluir</label>
          <select id="fd-tipo" name="tipo">
            <option value="arquivo" ${d.tipo !== "link" ? "selected" : ""}>Enviar arquivo (PDF/imagem)</option>
            <option value="link" ${d.tipo === "link" ? "selected" : ""}>Colar um link (Google Drive, etc.)</option>
          </select>
        </div>
        <div class="field full" id="fd-area-arquivo">
          ${Anexos.campoHTML("Arquivo", "Ideal para arquivos pequenos. Para documentos grandes ou muitos arquivos, prefira o link.")}
        </div>
        <div class="field full" id="fd-area-link" style="display:none;">
          <label for="fd-url">Link do arquivo</label>
          <input id="fd-url" name="url" placeholder="https://drive.google.com/..." value="${U.esc(d.url)}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar</button>
      </div>
    </form>`, dados => {
    if (!dados.titulo.trim()) return false;
    const obj = {
      id: d.id || undefined, categoria: d.categoria,
      titulo: dados.titulo.trim(), assunto: dados.assunto.trim(), data: dados.data,
      tipo: dados.tipo, url: dados.tipo === "link" ? (dados.url || "").trim() : "",
      arquivo: dados.tipo === "arquivo" ? (Anexos.lista()[0] || null) : null
    };
    if (obj.tipo === "link" && !obj.url) { alert("Cole o link do arquivo."); return false; }
    if (obj.tipo === "arquivo" && !obj.arquivo) { alert("Envie um arquivo ou troque para a opção de link."); return false; }
    try {
      Store.upsert("documentos", obj);
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nUse a opção de LINK para este arquivo.");
      return false;
    }
    U.toast("Documento salvo.");
    App.render();
  }, d);

  /* alterna entre enviar arquivo e colar link; só 1 arquivo aqui */
  Anexos.iniciar(d.arquivo ? [d.arquivo] : [], 1);
  Anexos.ligar();
  const selTipo = document.getElementById("fd-tipo");
  const alterna = () => {
    const link = selTipo.value === "link";
    document.getElementById("fd-area-arquivo").style.display = link ? "none" : "";
    document.getElementById("fd-area-link").style.display = link ? "" : "none";
  };
  selTipo.addEventListener("change", alterna);
  alterna();
}

Actions.novoDoc = categoria => abrirFormDoc({ categoria: categoria || "documento", titulo: "", assunto: "", data: U.hojeISO(), tipo: "arquivo", url: "", arquivo: null });
Actions.editarDoc = id => abrirFormDoc(Store.col("documentos").find(x => x.id === id));
Actions.excluirDoc = id => {
  const d = Store.col("documentos").find(x => x.id === id);
  if (d && confirm(`Excluir "${d.titulo}"?`)) {
    Store.remover("documentos", id);
    U.toast("Excluído.");
    App.render();
  }
};

/* ---------- links de imagens das atividades (por assunto) ---------- */

function viewLinksImagens() {
  const links = Store.col("linksImagens")
    .sort((a, b) => (a.assunto || "").localeCompare(b.assunto || "", "pt-BR") || (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"));

  let corpo = "";
  let assuntoAtual = null;
  for (const l of links) {
    const assunto = l.assunto || "Sem assunto";
    if (assunto !== assuntoAtual) {
      assuntoAtual = assunto;
      corpo += `<div class="alpha-letter">${U.esc(assunto)}</div>`;
    }
    corpo += `
      <div class="aluno-row" style="cursor:default;">
        <span style="font-size:1.3rem;">&#128247;</span>
        <div class="a-info">
          <div class="a-nome">${U.esc(l.titulo || "(sem título)")}</div>
          <div class="a-sub">${U.esc(l.obs || l.url)}</div>
        </div>
        <div class="a-chips" style="align-items:center;">
          <a class="btn sm ghost" href="${U.esc(l.url)}" target="_blank" rel="noopener" style="text-decoration:none;">Abrir</a>
          <button class="icon-btn" data-action="editarLink" data-id="${l.id}" title="Editar" aria-label="Editar">&#9998;</button>
          <button class="icon-btn" data-action="excluirLink" data-id="${l.id}" title="Excluir" aria-label="Excluir">&#128465;</button>
        </div>
      </div>`;
  }

  return `
    <div class="page-head">
      <div>
        <h2>Documentação</h2>
        <p>Links das imagens das atividades, organizados por assunto — acesso rápido para montar cards e artes.</p>
      </div>
      <div class="head-actions">
        <button class="btn accent" data-action="novoLink">+ Novo link</button>
      </div>
    </div>
    ${subnavDoc("imagens")}
    <div class="panel">
      ${links.length ? corpo : `<div class="empty-note">Nenhum link cadastrado ainda.<br>
        Cole links de álbuns/pastas de imagens (Google Fotos, Drive, Instagram…) agrupados por assunto.</div>`}
    </div>
  `;
}

function abrirFormLink(l) {
  const assuntos = [...new Set(Store.col("linksImagens").map(x => x.assunto).filter(Boolean))];
  App.abrirModal(l.id ? "Editar link" : "Novo link de imagens", `
    <form>
      <div class="form-grid">
        <div class="field">
          <label for="fl-assunto">Assunto *</label>
          <input id="fl-assunto" name="assunto" list="fl-assuntos" required placeholder="ex.: Formatura 2025, Social Media" value="${U.esc(l.assunto)}">
          <datalist id="fl-assuntos">${assuntos.map(a => `<option value="${U.esc(a)}">`).join("")}</datalist>
        </div>
        <div class="field">
          <label for="fl-titulo">Título</label>
          <input id="fl-titulo" name="titulo" placeholder="ex.: Fotos da turma B" value="${U.esc(l.titulo)}">
        </div>
        <div class="field full">
          <label for="fl-url">Link *</label>
          <input id="fl-url" name="url" required placeholder="https://photos.google.com/..." value="${U.esc(l.url)}">
        </div>
        <div class="field full">
          <label for="fl-obs">Observações</label>
          <input id="fl-obs" name="obs" placeholder="ex.: usar nas artes do Instagram" value="${U.esc(l.obs)}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar link</button>
      </div>
    </form>`, dados => {
    if (!dados.assunto.trim() || !dados.url.trim()) return false;
    Store.upsert("linksImagens", { id: l.id || undefined, ...dados, assunto: dados.assunto.trim(), url: dados.url.trim() });
    U.toast("Link salvo.");
    App.render();
  }, l);
}

Actions.novoLink = () => abrirFormLink({ assunto: "", titulo: "", url: "", obs: "" });
Actions.editarLink = id => abrirFormLink(Store.col("linksImagens").find(x => x.id === id));
Actions.excluirLink = id => {
  const l = Store.col("linksImagens").find(x => x.id === id);
  if (l && confirm(`Excluir o link "${l.titulo || l.url}"?`)) {
    Store.remover("linksImagens", id);
    U.toast("Link excluído.");
    App.render();
  }
};

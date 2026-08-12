/* Área Financeira: extrato SICOOB (OFX/CSV), vendas/assinaturas da Guru (CSV),
   lançamentos manuais, categorias, gráficos e exportação.
   Acesso: admin ou gestor financeiro (PIN definido pelo admin). */
"use strict";

const CHAVE_FIN_LOGADO = "bzn-fin-logado";

const Fin = {
  logado: () => sessionStorage.getItem(CHAVE_FIN_LOGADO) === "1" || App.ehAdmin()
};

let filtroFin = { ano: String(new Date().getFullYear()), mes: 0 };
let importPendente = null; // {linhas, origem, mapa} aguardando confirmação

function subnavFin(ativa) {
  return `<div class="subtabs">
    <a href="#/financeiro" class="${ativa === "mov" ? "active" : ""}">Movimentações</a>
    <a href="#/financeiro/relatorios" class="${ativa === "relatorios" ? "active" : ""}">Relatórios</a>
  </div>`;
}

Views.financeiro = sub => {
  if (!Fin.logado()) return viewLoginFin();
  if (sub === "relatorios") return viewRelatoriosFin();

  const prefixo = filtroFin.mes ? `${filtroFin.ano}-${String(filtroFin.mes).padStart(2, "0")}` : filtroFin.ano;
  const r = Store.resumoFin(prefixo);
  const anos = Store.anosFin();
  const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  const selAno = `<select id="fin-ano" class="search-input" style="min-width:auto;">
    ${anos.map(a => `<option value="${a}" ${a === filtroFin.ano ? "selected" : ""}>${a}</option>`).join("")}
  </select>`;
  const selMes = `<select id="fin-mes" class="search-input" style="min-width:auto;">
    <option value="0">Ano inteiro</option>
    ${MESES_ABREV.map((m, i) => `<option value="${i + 1}" ${filtroFin.mes === i + 1 ? "selected" : ""}>${m.toUpperCase()}</option>`).join("")}
  </select>`;

  /* gráfico entradas × saídas por mês (do ano selecionado) */
  const anoTodo = Store.resumoFin(filtroFin.ano);
  const barrasMes = anoTodo.porMes.map(([mes, v]) => {
    const rotulo = MESES_ABREV[Number(mes.slice(5, 7)) - 1] || mes;
    return { rotulo, entradas: v.entradas, saidas: v.saidas };
  });
  const maxMes = Math.max(1, ...barrasMes.flatMap(b => [b.entradas, b.saidas]));
  const grafMeses = barrasMes.length ? `
    <div class="chart-bars">${barrasMes.map(b => `
      <div class="bar-row">
        <span class="bar-label" style="width:60px;">${b.rotulo}</span>
        <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
          <div class="bar-track" style="height:10px;"><div class="bar-fill" style="width:${Math.round((b.entradas / maxMes) * 100)}%; background:var(--good);"></div></div>
          <div class="bar-track" style="height:10px;"><div class="bar-fill" style="width:${Math.round((b.saidas / maxMes) * 100)}%; background:var(--danger);"></div></div>
        </div>
        <span class="bar-count" style="width:auto; min-width:120px; font-size:0.74rem; text-align:right;">
          <span style="color:var(--good);">+${U.moeda(b.entradas)}</span><br>
          <span style="color:var(--danger);">−${U.moeda(b.saidas)}</span>
        </span>
      </div>`).join("")}</div>
    <div style="display:flex; gap:14px; margin-top:10px; font-size:0.76rem; color:var(--text-muted);">
      <span><span class="dot" style="background:var(--good); display:inline-block;"></span> Entradas</span>
      <span><span class="dot" style="background:var(--danger); display:inline-block;"></span> Saídas</span>
    </div>`
    : `<div class="empty-note">Sem lançamentos em ${filtroFin.ano}.</div>`;

  /* despesas por categoria (período filtrado) */
  const despesas = r.porCategoria.filter(([, v]) => v < 0);
  const grafDespesas = despesas.length
    ? Charts.donut(despesas.map(([cat, v], i) => ({
        label: cat, value: Math.round(-v), color: Charts.cor.p(i)
      })), { subtitulo: "em despesas" })
    : `<div class="empty-note">Sem despesas no período.</div>`;

  const optCat = l => ['<option value="">— categorizar —</option>']
    .concat(Store.config.categoriasFin.map(c =>
      `<option value="${U.esc(c)}" ${l.categoria === c ? "selected" : ""}>${U.esc(c)}</option>`)).join("");

  const linhas = r.lancamentos.map(l => `
    <tr>
      <td style="white-space:nowrap">${U.fmtData(l.data)}</td>
      <td>${U.esc(l.descricao || "—")}
        ${l.origem !== "manual" ? `<span class="pill ${l.origem === "guru" ? "info" : "muted"}" style="margin-left:4px;">${l.origem}</span>` : ""}</td>
      <td style="white-space:nowrap; font-weight:700; color:${(Number(l.valor) || 0) >= 0 ? "var(--good)" : "var(--danger)"};">
        ${(Number(l.valor) || 0) >= 0 ? "+" : "−"}${U.moeda(Math.abs(Number(l.valor) || 0))}</td>
      <td><select class="fin-cat" data-id="${l.id}" style="font-size:0.78rem; padding:4px 6px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); max-width:180px;">${optCat(l)}</select></td>
      <td style="white-space:nowrap">
        <button class="icon-btn" data-action="anexosLanc" data-id="${l.id}" title="Notas fiscais / comprovantes" aria-label="Notas fiscais">
          &#128206;${(l.anexos || []).length ? `<span style="font-size:0.68rem; font-weight:800; color:var(--accent);">${l.anexos.length}</span>` : ""}
        </button>
        <button class="icon-btn" data-action="excluirLanc" data-id="${l.id}" title="Excluir" aria-label="Excluir lançamento">&#128465;</button>
      </td>
    </tr>`).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Financeiro</h2>
        <p>Extrato SICOOB, vendas e assinaturas da Guru e lançamentos manuais — categorize e exporte para prestação de contas.</p>
      </div>
      <div class="head-actions">
        ${!App.ehAdmin() ? `<button class="btn ghost" data-action="sairFin">Sair do financeiro</button>` : ""}
        <button class="btn ghost" data-action="csvFinanceiro">Exportar planilha</button>
        <button class="btn ghost" data-action="imprimir">Imprimir / PDF</button>
      </div>
    </div>
    ${subnavFin("mov")}

    <div class="panel">
      <h3>Importar movimentações</h3>
      <p class="panel-sub">O sistema ignora automaticamente lançamentos já importados (sem duplicar)</p>
      <div class="head-actions">
        <button class="btn" data-action="importarSicoob">&#127974; Extrato SICOOB (OFX ou CSV)</button>
        <button class="btn" data-action="colarExtrato">&#128203; Colar extrato SICOOB (texto)</button>
        <button class="btn" data-action="importarGuru">&#128722; Vendas/assinaturas Guru (CSV)</button>
        <button class="btn accent" data-action="novoLanc">+ Lançamento manual</button>
        <input type="file" id="fin-arquivo" accept=".ofx,.csv,.txt" hidden>
      </div>
    </div>

    <section class="stat-strip">
      <div class="stat-card" style="--stat-color: var(--good)">
        <span class="label">Entradas</span>
        <span class="value" style="font-size:1.4rem;">${U.moeda(r.entradas)}</span>
        <span class="delta">${filtroFin.mes ? "no mês" : "no ano"} selecionado</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--danger)">
        <span class="label">Saídas</span>
        <span class="value" style="font-size:1.4rem;">${U.moeda(r.saidas)}</span>
        <span class="delta">${r.lancamentos.filter(l => l.valor < 0).length} lançamentos</span>
      </div>
      <div class="stat-card" style="--stat-color: ${r.saldo >= 0 ? "var(--good)" : "var(--danger)"}">
        <span class="label">Saldo do período</span>
        <span class="value" style="font-size:1.4rem;">${r.saldo >= 0 ? "" : "−"}${U.moeda(Math.abs(r.saldo))}</span>
        <span class="delta">entradas − saídas</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--navy-strong)">
        <span class="label">Lançamentos</span>
        <span class="value">${r.lancamentos.length}</span>
        <span class="delta">${r.lancamentos.filter(l => !l.categoria).length} sem categoria</span>
      </div>
    </section>

    <section class="grid-2-even">
      <div class="panel">
        <h3>Entradas × saídas por mês (${filtroFin.ano})</h3>
        <p class="panel-sub">Movimento mensal do ano</p>
        ${grafMeses}
      </div>
      <div class="panel">
        <h3>Despesas por categoria</h3>
        <p class="panel-sub">Período selecionado</p>
        ${grafDespesas}
      </div>
    </section>

    <div class="panel">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
        <div>
          <h3>Lançamentos</h3>
          <p class="panel-sub" style="margin:0;">Use o seletor de cada linha para categorizar</p>
        </div>
        <div class="head-actions">${selAno}${selMes}
          <button class="btn ghost sm" data-action="novaCategoriaFin">+ Nova categoria</button>
        </div>
      </div>
      ${r.lancamentos.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Categoria</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>` : `<div class="empty-note">Nenhum lançamento no período.<br>Importe o extrato do SICOOB ou o relatório da Guru acima.</div>`}
    </div>
  `;
};

/* ---------------- relatórios do financeiro ---------------- */

function viewRelatoriosFin() {
  const fc = Store.resumoFinanceiroCursos();
  const fa = Store.resumoFinanceiro();
  const pagantes = U.ordenarPorNome(Store.col("pacientes").filter(p => p.tipoAtendimento === "pago"));

  const linhasCursos = fc.porCurso.map(x => `
    <tr>
      <td><span class="chip cor-${x.curso.corIndex}">${U.esc(x.curso.nome)}</span></td>
      <td>${U.moeda(x.valor)}${x.curso.cobranca === "mensal" ? "/mês" : " (único)"}</td>
      <td>${x.pagantes}</td>
      <td>${x.bolsistas}</td>
      <td style="font-weight:700">${U.moeda(x.previsto)}${x.curso.cobranca === "mensal" ? "/mês" : ""}</td>
    </tr>`).join("");

  const linhasAtend = pagantes.map(p => `
    <tr>
      <td>${U.esc(p.nome)}</td>
      <td>${p.cobranca === "mensal" ? "Mensal" : "Por consulta"}</td>
      <td>${U.moeda(p.valor)}</td>
      <td>${Store.atendimentosDoPaciente(p.id).filter(a => a.status === "realizado").length}</td>
    </tr>`).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Financeiro — Relatórios</h2>
        <p>Receitas previstas dos cursos e dos atendimentos, com download separado de cada relatório.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="imprimir">Imprimir / PDF</button>
      </div>
    </div>
    ${subnavFin("relatorios")}

    <div class="panel">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <h3>Relatório dos cursos pagos</h3>
          <p class="panel-sub">Pagantes, bolsistas e receita prevista por curso (matrículas não desistentes)</p>
        </div>
        <button class="btn" data-action="csvRelCursos">&#11015; Baixar relatório dos cursos</button>
      </div>
      ${fc.porCurso.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Curso</th><th>Valor</th><th>Pagantes</th><th>Bolsistas</th><th>Receita prevista</th></tr></thead>
        <tbody>${linhasCursos}</tbody>
      </table></div>
      <div class="combo-note">Total previsto: <strong>${U.moeda(fc.receitaMensal)}/mês</strong> em mensalidades${fc.receitaUnica ? ` + <strong>${U.moeda(fc.receitaUnica)}</strong> em valores únicos` : ""}. Bolsistas não geram cobrança.</div>`
      : `<div class="empty-note">Nenhum curso pago cadastrado.</div>`}
    </div>

    <div class="panel">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <h3>Relatório dos atendimentos pagos</h3>
          <p class="panel-sub">Pacientes pagantes, forma de cobrança e consultas realizadas</p>
        </div>
        <button class="btn" data-action="csvRelAtend">&#11015; Baixar relatório dos atendimentos</button>
      </div>
      ${pagantes.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Paciente</th><th>Cobrança</th><th>Valor</th><th>Consultas realizadas</th></tr></thead>
        <tbody>${linhasAtend}</tbody>
      </table></div>
      <div class="combo-note">Receita prevista no mês: <strong>${U.moeda(fa.previstoMes)}</strong> (${U.moeda(fa.mensal)} em mensalidades + ${U.moeda(fa.porConsultaMes)} por consulta) · ${fa.pagantes} ${U.plural(fa.pagantes, "pagante", "pagantes")} · ${fa.gratuitos} gratuitos.</div>`
      : `<div class="empty-note">Nenhum paciente pagante cadastrado.</div>`}
    </div>

    <div class="panel">
      <h3>Extrato e movimentações</h3>
      <p class="panel-sub">A planilha completa do extrato (SICOOB, Guru e manuais) continua na aba Movimentações</p>
      <div class="head-actions">
        <button class="btn ghost" data-action="csvFinanceiro">Exportar extrato do período selecionado</button>
      </div>
    </div>
  `;
}

Actions.csvRelCursos = () => {
  const fc = Store.resumoFinanceiroCursos();
  const cab = ["Curso", "Cobrança", "Valor", "Pagantes", "Bolsistas", "Receita prevista"];
  const linhas = fc.porCurso.map(x => U.linhaCSV([
    x.curso.nome, x.curso.cobranca === "mensal" ? "Mensal" : "Valor único",
    String(x.valor).replace(".", ","), x.pagantes, x.bolsistas, String(x.previsto).replace(".", ",")
  ]));
  linhas.push(U.linhaCSV([]));
  linhas.push(U.linhaCSV(["TOTAL", "", "", "", "", "Mensal: " + U.moeda(fc.receitaMensal) + " | Único: " + U.moeda(fc.receitaUnica)]));
  U.baixarArquivo("relatorio-financeiro-cursos-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Relatório dos cursos baixado.");
};

Actions.csvRelAtend = () => {
  const fa = Store.resumoFinanceiro();
  const pagantes = U.ordenarPorNome(Store.col("pacientes").filter(p => p.tipoAtendimento === "pago"));
  const cab = ["Paciente", "Cobrança", "Valor", "Consultas realizadas"];
  const linhas = pagantes.map(p => U.linhaCSV([
    p.nome, p.cobranca === "mensal" ? "Mensal" : "Por consulta",
    String(p.valor).replace(".", ","),
    Store.atendimentosDoPaciente(p.id).filter(a => a.status === "realizado").length
  ]));
  linhas.push(U.linhaCSV([]));
  linhas.push(U.linhaCSV(["TOTAL PREVISTO NO MÊS", "", String(fa.previstoMes).replace(".", ","), ""]));
  U.baixarArquivo("relatorio-financeiro-atendimentos-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Relatório dos atendimentos baixado.");
};

function viewLoginFin() {
  return `
    <div class="page-head">
      <div>
        <h2>Financeiro</h2>
        <p>Área restrita ao administrador e ao gestor financeiro.</p>
      </div>
    </div>
    <div class="panel" style="max-width:440px;">
      <h3>Entrar no financeiro</h3>
      <p class="panel-sub">Digite o PIN do gestor financeiro</p>
      ${Store.temPinFinanceiro() ? `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field">
          <label for="fin-pin">PIN</label>
          <input id="fin-pin" type="password" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos" autocomplete="off">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn accent" data-action="entrarFin">Entrar</button>
      </div>`
      : `<div class="alert-box info"><span class="ico">&#128274;</span><div>
          <p>O PIN do gestor financeiro ainda não foi criado.<br>
          Peça ao administrador: <strong>Indicadores &rarr; Relatórios &rarr; Segurança e logins</strong>.</p>
        </div></div>`}
    </div>
  `;
}

Actions.entrarFin = () => {
  const pin = document.getElementById("fin-pin").value.trim();
  if (!Store.conferirPinFinanceiro(pin)) {
    U.toast("PIN incorreto.");
    document.getElementById("fin-pin").value = "";
    return;
  }
  sessionStorage.setItem(CHAVE_FIN_LOGADO, "1");
  U.toast("Bem-vindo(a) ao financeiro!");
  App.render();
};
Actions.sairFin = () => {
  sessionStorage.removeItem(CHAVE_FIN_LOGADO);
  location.hash = "#/dashboard";
  App.render();
};

/* ---------------- importações ---------------- */

function lerArquivoFin(aoLer) {
  const input = document.getElementById("fin-arquivo");
  input.onchange = () => {
    const arq = input.files[0];
    input.value = "";
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => aoLer(String(leitor.result), arq.name);
    leitor.readAsText(arq, "ISO-8859-1"); // bancos costumam usar Latin-1; UTF-8 também funciona na prática
  };
  input.click();
}

/* números em formato brasileiro: "1.234,56", "-150,00", "R$ 200,00", "200.00" */
function parseValorBR(s) {
  if (s == null) return NaN;
  let t = String(s).replace(/R\$\s*/i, "").trim();
  let negativo = /^-|^\(/.test(t) || /\bD\b$/i.test(t);
  if (/\bC\b$/i.test(t)) negativo = false;
  t = t.replace(/[()CD\s]/gi, "").replace(/^-/, "");
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const v = parseFloat(t);
  return isNaN(v) ? NaN : (negativo ? -v : v);
}

/* datas: "03/07/2026", "2026-07-03", "20260703" */
function parseDataBR(s) {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

/* OFX do SICOOB (e de qualquer banco) */
function parseOFX(texto) {
  const out = [];
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const b of blocos) {
    const pega = tag => {
      const m = b.match(new RegExp("<" + tag + ">([^<\\r\\n]*)", "i"));
      return m ? m[1].trim() : "";
    };
    const data = parseDataBR(pega("DTPOSTED"));
    const valor = parseValorBR(pega("TRNAMT"));
    const descricao = pega("MEMO") || pega("NAME") || "Lançamento";
    if (data && !isNaN(valor)) out.push({ data, valor, descricao });
  }
  return out;
}

/* CSV genérico com detecção de separador e cabeçalho */
function parseCSVLinhas(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  const sep = (texto.match(/;/g) || []).length >= (texto.match(/,/g) || []).length ? ";" : ",";
  return linhas.map(l => {
    const celulas = [];
    let atual = "", dentro = false;
    for (const ch of l) {
      if (ch === '"') dentro = !dentro;
      else if (ch === sep && !dentro) { celulas.push(atual.trim()); atual = ""; }
      else atual += ch;
    }
    celulas.push(atual.trim());
    return celulas;
  });
}

/* tenta achar colunas de data, descrição e valor a partir do cabeçalho */
function importarCSVGenerico(texto, origem) {
  const linhas = parseCSVLinhas(texto);
  if (linhas.length < 2) { alert("O arquivo parece vazio ou num formato não reconhecido."); return; }

  let idxCab = linhas.findIndex(l =>
    l.some(c => /data/i.test(c)) && l.some(c => /valor|liquido|líquido|amount|total/i.test(c)));
  if (idxCab < 0) idxCab = 0;
  const cab = linhas[idxCab].map(c => c.toLowerCase());

  const acha = regs => {
    for (const r of regs) {
      const i = cab.findIndex(c => r.test(c));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iData = acha([/^data/i, /data.*(transa|venda|pagamento|lan)/i, /dia/i]);
  const iValor = acha([/liquido|líquido/i, /^valor$/i, /valor/i, /total/i, /amount/i]);
  const iDesc = acha([/hist[óo]rico/i, /descri/i, /produto/i, /nome.*produto/i, /memo/i, /lan[çc]amento/i]);
  const iStatus = acha([/status|situa/i]);

  if (iData < 0 || iValor < 0) {
    alert("Não encontrei as colunas de data e valor no arquivo.\nMe envie um exemplo do arquivo (sem dados sensíveis) que eu ajusto a importação para o seu formato.");
    return;
  }

  const registros = [];
  for (let i = idxCab + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.length < 2) continue;
    if (iStatus >= 0 && l[iStatus] && /cancelad|estornad|recusad|pendente|aguardando/i.test(l[iStatus])) continue;
    const data = parseDataBR(l[iData]);
    let valor = parseValorBR(l[iValor]);
    if (!data || isNaN(valor) || valor === 0) continue;
    if (origem === "guru" && valor < 0) valor = -valor; // vendas da Guru são receitas
    const descricao = (iDesc >= 0 ? l[iDesc] : "") || (origem === "guru" ? "Venda Guru" : "Lançamento");
    registros.push({ data, valor, descricao });
  }

  confirmarImportacao(registros, origem);
}

function confirmarImportacao(registros, origem) {
  if (!registros.length) { alert("Nenhum lançamento válido encontrado no arquivo."); return; }
  const previa = registros.slice(0, 6).map(r =>
    `<tr><td>${U.fmtData(r.data)}</td><td>${U.esc(r.descricao.slice(0, 40))}</td>
     <td style="color:${r.valor >= 0 ? "var(--good)" : "var(--danger)"}; font-weight:700;">${r.valor >= 0 ? "+" : "−"}${U.moeda(Math.abs(r.valor))}</td></tr>`).join("");
  App.abrirModal(`Importar ${origem === "guru" ? "da Guru" : "do SICOOB"}`, `
    <p style="font-size:0.9rem; margin-bottom:12px;">
      Encontrei <strong>${registros.length} ${U.plural(registros.length, "lançamento", "lançamentos")}</strong>. Prévia:
    </p>
    <div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead>
      <tbody>${previa}</tbody>
    </table></div>
    ${registros.length > 6 ? `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:6px;">… e mais ${registros.length - 6}.</p>` : ""}
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="confirmarImport">Importar</button>
    </div>`);
  importPendente = { registros, origem };
}

Actions.confirmarImport = () => {
  if (!importPendente) return;
  try {
    const { novos, pulados } = Store.importarLancamentos(importPendente.registros, importPendente.origem);
    U.toast(`${novos} importados${pulados ? ` · ${pulados} já existiam (pulados)` : ""}.`);
  } catch (e) {
    alert("Não foi possível importar: o armazenamento do navegador está cheio.");
  }
  importPendente = null;
  App.fecharModal();
  App.render();
};

Actions.importarSicoob = () => lerArquivoFin((texto, nome) => {
  if (/\.ofx$/i.test(nome) || /<OFX/i.test(texto)) {
    confirmarImportacao(parseOFX(texto), "sicoob");
  } else {
    importarCSVGenerico(texto, "sicoob");
  }
});

Actions.importarGuru = () => lerArquivoFin(texto => importarCSVGenerico(texto, "guru"));

/* ---------------- colar extrato SICOOB em texto ---------------- */

/* Lê o extrato detalhado do SICOOB colado como texto.
   Formato: "DD/MM  DESCRIÇÃO  1.234,56C" (C=crédito/entrada, D=débito/saída),
   seguido de linhas de detalhe (Pix, nome, CPF, DOC.) que viram complemento
   da descrição. Linhas de "SALDO DO DIA"/"SALDO ANTERIOR" são ignoradas. */
function parseExtratoTextoSicoob(texto, ano) {
  const linhas = String(texto || "").split(/\r?\n/);
  const cabecalho = /^\s*(\d{2})\/(\d{2})\s+(.+?)\s+([\d.]+,\d{2})\s*([CD])\s*$/;
  const registros = [];
  let atual = null;

  const fechar = () => {
    if (atual && !isNaN(atual.valor)) registros.push(atual);
    atual = null;
  };

  for (const linhaBruta of linhas) {
    const linha = linhaBruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;

    const m = linhaBruta.match(cabecalho);
    if (m) {
      const desc = m[3].trim();
      // ignora linhas de saldo (não são lançamentos)
      if (/saldo/i.test(desc)) { fechar(); continue; }
      fechar();
      const dd = m[1], mm = m[2];
      const bruto = parseValorBR(m[4]);
      const valor = m[5].toUpperCase() === "D" ? -Math.abs(bruto) : Math.abs(bruto);
      atual = { data: `${ano}-${mm}-${dd}`, valor, descricao: desc };
      continue;
    }

    // linha de saldo isolada — encerra o lançamento em aberto
    if (/saldo\s+(do\s+dia|anterior|atual|bloqueado)/i.test(linha)) { fechar(); continue; }

    // linha de detalhe: acrescenta à descrição do lançamento atual
    if (atual) {
      const extra = linha
        .replace(/\bDOC\.?:?\s*/i, "")
        .replace(/\b\d{3}\.?\*{2,3}\.?\*{2,3}-?\*{2}\b/g, "") // CPF mascarado
        .trim();
      if (extra && atual.descricao.length < 90) {
        atual.descricao = (atual.descricao + " · " + extra).slice(0, 120);
      }
    }
  }
  fechar();
  return registros;
}

Actions.colarExtrato = () => {
  const anoAtual = new Date().getFullYear();
  const opts = [];
  for (let a = anoAtual + 1; a >= anoAtual - 6; a--) {
    opts.push(`<option value="${a}"${a === anoAtual ? " selected" : ""}>${a}</option>`);
  }
  App.abrirModal("Colar extrato SICOOB (texto)", `
    <p style="font-size:0.9rem; margin-bottom:10px;">
      Copie o extrato detalhado do app/internet banking do SICOOB e cole abaixo.
      O sistema lê cada lançamento (crédito <b>C</b> = entrada, débito <b>D</b> = saída)
      e ignora as linhas de <em>“Saldo do dia”</em>.
    </p>
    <div class="field" style="max-width:160px;">
      <label for="extrato-ano">Ano do extrato *</label>
      <select id="extrato-ano">${opts.join("")}</select>
    </div>
    <div class="field">
      <label for="extrato-texto">Texto do extrato</label>
      <textarea id="extrato-texto" rows="10" placeholder="01/06  Recebimento Pix  110,00C&#10;    Fulano de Tal&#10;03/06  Pagamento Pix  80,00D&#10;..."
        style="width:100%; font-family:monospace; font-size:0.82rem;"></textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="processarExtrato">Ler extrato</button>
    </div>`);
};

Actions.processarExtrato = () => {
  const ta = document.getElementById("extrato-texto");
  const sel = document.getElementById("extrato-ano");
  const texto = ta ? ta.value : "";
  const ano = sel ? sel.value : String(new Date().getFullYear());
  if (!texto.trim()) { alert("Cole o texto do extrato antes de continuar."); return; }
  const registros = parseExtratoTextoSicoob(texto, ano);
  if (!registros.length) {
    alert("Não reconheci nenhum lançamento.\nConfira se colou o extrato detalhado (com data, descrição e valor terminando em C ou D).");
    return;
  }
  confirmarImportacao(registros, "sicoob");
};

/* ---------------- lançamento manual, categorias, exclusão ---------------- */

Actions.novoLanc = () => {
  const optCat = Store.config.categoriasFin.map(c => `<option value="${U.esc(c)}">${U.esc(c)}</option>`).join("");
  App.abrirModal("Lançamento manual", `
    <form>
      <div class="form-grid">
        <div class="field">
          <label for="fl-data">Data *</label>
          <input id="fl-data" name="data" type="date" required value="${U.hojeISO()}">
        </div>
        <div class="field">
          <label for="fl-tipo">Tipo</label>
          <select id="fl-tipo" name="tipo">
            <option value="entrada">Entrada (receita)</option>
            <option value="saida">Saída (despesa)</option>
          </select>
        </div>
        <div class="field">
          <label for="fl-valor">Valor (R$) *</label>
          <input id="fl-valor" name="valor" type="number" min="0.01" step="0.01" required>
        </div>
        <div class="field">
          <label for="fl-cat">Categoria</label>
          <select id="fl-cat" name="categoria"><option value="">— selecione —</option>${optCat}</select>
        </div>
        <div class="field full">
          <label for="fl-desc">Descrição *</label>
          <input id="fl-desc" name="descricao" required placeholder="ex.: Doação da empresa X">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar lançamento</button>
      </div>
    </form>`, dados => {
    const v = Number(dados.valor) || 0;
    if (!dados.data || !dados.descricao.trim() || v <= 0) return false;
    Store.importarLancamentos([{
      data: dados.data, descricao: dados.descricao.trim(),
      valor: dados.tipo === "saida" ? -v : v, categoria: dados.categoria
    }], "manual");
    U.toast("Lançamento salvo.");
    App.render();
  });
};

/* notas fiscais / comprovantes de um lançamento */
Actions.anexosLanc = id => {
  const l = Store.col("lancamentos").find(x => x.id === id);
  if (!l) return;
  App.abrirModal("Notas fiscais e comprovantes", `
    <form>
      <p style="font-size:0.88rem; margin-bottom:4px;">
        <strong>${U.esc(l.descricao || "Lançamento")}</strong> · ${U.fmtData(l.data)} ·
        <span style="font-weight:700; color:${(Number(l.valor) || 0) >= 0 ? "var(--good)" : "var(--danger)"};">
          ${(Number(l.valor) || 0) >= 0 ? "+" : "−"}${U.moeda(Math.abs(Number(l.valor) || 0))}</span>
      </p>
      ${(l.anexos || []).length ? `
      <div style="margin:10px 0;">
        <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;">Arquivos salvos (clique para baixar)</div>
        <div class="cross-chips">${Anexos.links(l.anexos)}</div>
      </div>` : ""}
      <div class="form-grid" style="grid-template-columns:1fr;">
        ${Anexos.campoHTML("Anexar / gerenciar arquivos", "Nota fiscal em PDF ou foto do comprovante. Até 3 por lançamento.")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar anexos</button>
      </div>
    </form>`, () => {
    try {
      Store.upsert("lancamentos", { ...l, anexos: Anexos.lista() });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nDica: para notas grandes, digitalize em qualidade menor ou guarde na área Documentação com link.");
      return false;
    }
    U.toast("Anexos salvos.");
    App.render();
  });
  Anexos.iniciar(l.anexos, 3);
  Anexos.ligar();
};

Actions.novaCategoriaFin = () => {
  const nome = prompt("Nova categoria (ex.: Eventos, Transporte):");
  if (!nome) return;
  Store.addCategoriaFin(nome);
  U.toast("Categoria adicionada.");
  App.render();
};

Actions.excluirLanc = id => {
  if (confirm("Excluir este lançamento?")) {
    Store.remover("lancamentos", id);
    U.toast("Lançamento excluído.");
    App.render();
  }
};

Actions.csvFinanceiro = () => {
  const prefixo = filtroFin.mes ? `${filtroFin.ano}-${String(filtroFin.mes).padStart(2, "0")}` : filtroFin.ano;
  const r = Store.resumoFin(prefixo);
  const cab = ["Data", "Descrição", "Valor", "Tipo", "Categoria", "Origem", "Notas anexadas"];
  const linhas = r.lancamentos.map(l => U.linhaCSV([
    U.fmtData(l.data), l.descricao, String(l.valor).replace(".", ","),
    (Number(l.valor) || 0) >= 0 ? "Entrada" : "Saída", l.categoria, l.origem,
    (l.anexos || []).length ? (l.anexos.length + " (" + l.anexos.map(a => a.nome).join(", ") + ")") : ""
  ]));
  linhas.push(U.linhaCSV([]));
  linhas.push(U.linhaCSV(["TOTAIS", "", "", "Entradas: " + U.moeda(r.entradas), "Saídas: " + U.moeda(r.saidas), "Saldo: " + U.moeda(r.saldo)]));
  U.baixarArquivo(`financeiro-${prefixo}-instituto-bzn.csv`, "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha financeira exportada.");
};

/* filtros e categorização inline */
const aposRenderFin = Views.aposRender;
Views.aposRender = (rota, param) => {
  if (aposRenderFin) aposRenderFin(rota, param);
  if (rota !== "financeiro") return;
  const sa = document.getElementById("fin-ano");
  const sm = document.getElementById("fin-mes");
  if (sa) sa.addEventListener("change", () => { filtroFin.ano = sa.value; App.render(); });
  if (sm) sm.addEventListener("change", () => { filtroFin.mes = Number(sm.value); App.render(); });
  document.querySelectorAll(".fin-cat").forEach(sel => {
    sel.addEventListener("change", () => {
      const l = Store.col("lancamentos").find(x => x.id === sel.dataset.id);
      if (l) { Store.upsert("lancamentos", { ...l, categoria: sel.value }); U.toast("Categoria salva."); }
    });
  });
};

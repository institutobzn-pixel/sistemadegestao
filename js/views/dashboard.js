/* Painel: métricas gerais, alunos por curso, situação das matrículas,
   trajetória entre cursos e alertas de presença */
"use strict";

Views.dashboard = () => {
  const r = Store.resumo();
  const porCurso = Store.alunosPorCurso();
  const cruz = Store.cruzamento();
  const risco = Store.alunosEmRisco();
  const temDados = r.totalMatriculas > 0 || Store.col("alunos").length > 0;

  /* barras de alunos por curso */
  const max = Math.max(1, ...porCurso.map(x => x.qtd));
  const barras = porCurso
    .filter(x => x.curso.status === "ativo" || x.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd)
    .map(x => `
      <div class="bar-row cor-${x.curso.corIndex}">
        <span class="bar-label"><span class="dot"></span>${U.esc(x.curso.nome)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((x.qtd / max) * 100)}%"></div></div>
        <span class="bar-count">${x.qtd}</span>
      </div>`).join("");

  /* donut da situação das matrículas */
  const s = r.porStatus;
  const total = r.totalMatriculas || 1;
  const seg = [
    ["Cursando", s.cursando, "var(--p4)"],
    ["Concluído", s.concluido, "var(--good)"],
    ["Trancado", s.trancado, "var(--warn)"],
    ["Desistente", s.desistente, "var(--danger)"]
  ];
  let offset = 25;
  const arcos = seg.map(([, qtd, cor]) => {
    const frac = (qtd / total) * 100;
    const svg = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${cor}" stroke-width="6"
      stroke-dasharray="${frac} ${100 - frac}" stroke-dashoffset="${offset}"></circle>`;
    offset -= frac;
    return qtd > 0 ? svg : "";
  }).join("");
  const legenda = seg.map(([nome, qtd, cor]) =>
    `<li><span class="dot" style="background:${cor}"></span>${nome} <span class="n">${qtd}</span></li>`).join("");

  /* trajetória: top alunos multi-curso */
  const trajetoria = cruz.multi.slice(0, 4).map(x => `
    <div style="padding:10px 0; border-bottom:1px solid var(--border);">
      <div style="font-weight:600; font-size:0.9rem; margin-bottom:6px;">
        ${U.esc(x.aluno.nome)}
        <span style="font-weight:400; color:var(--text-muted); font-size:0.78rem;">· ${x.cursos.length} cursos</span>
      </div>
      <div class="cross-chips">
        ${x.cursos.map(y => `<span class="chip cor-${y.curso.corIndex}">${U.esc(y.curso.nome)}</span>`).join("")}
      </div>
    </div>`).join("");

  /* alertas */
  const alertas = risco.slice(0, 5).map(x => `
    <div class="alert-box warn">
      <span class="ico">&#9888;</span>
      <div>
        <strong>${U.esc(x.aluno ? x.aluno.nome : "Aluno removido")} — ${x.pct}% de presença</strong>
        <p>${U.esc(x.curso ? x.curso.nome : "")} · ${U.esc(x.turma.nome)} · mínimo exigido: ${Store.config.presencaMinima}%</p>
      </div>
    </div>`).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Visão geral</h2>
        <p>Resumo de matrículas, presença e trajetória dos alunos entre os cursos do instituto.</p>
      </div>
    </div>

    <section class="stat-strip">
      <div class="stat-card" style="--stat-color: var(--navy-accent)">
        <span class="label">Alunos únicos</span>
        <span class="value">${r.alunosUnicos}</span>
        <span class="delta">cadastrados no instituto</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--accent)">
        <span class="label">Matrículas ativas</span>
        <span class="value">${r.matriculasAtivas}</span>
        <span class="delta">em ${r.turmasAndamento} ${U.plural(r.turmasAndamento, "turma em andamento", "turmas em andamento")}</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--good)">
        <span class="label">Presença média</span>
        <span class="value">${r.presencaMedia !== null ? r.presencaMedia + "%" : "—"}</span>
        <span class="delta">${r.presencaMedia !== null ? "média das turmas com chamadas" : "sem chamadas registradas"}</span>
      </div>
      <div class="stat-card" style="--stat-color: var(--p5)">
        <span class="label">Cursos ativos</span>
        <span class="value">${r.cursosAtivos}</span>
        <span class="delta">${r.totalMatriculas} ${U.plural(r.totalMatriculas, "matrícula no total", "matrículas no total")}</span>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <h3>Alunos por curso</h3>
        <p class="panel-sub">Alunos distintos que passaram por cada curso</p>
        ${barras || `<div class="empty-note">Sem matrículas ainda.</div>`}
        ${cruz.multi.length ? `
        <div class="combo-note">
          <strong>${cruz.multi.length} ${U.plural(cruz.multi.length, "aluno", "alunos")}</strong> já ${U.plural(cruz.multi.length, "fez", "fizeram")} mais de um curso.
          ${cruz.combos.length ? `Combinação mais comum: <strong>${U.esc(cruz.combos[0][0])}</strong> (${cruz.combos[0][1]} ${U.plural(cruz.combos[0][1], "aluno", "alunos")}).` : ""}
        </div>` : ""}
      </div>

      <div class="panel">
        <h3>Situação das matrículas</h3>
        <p class="panel-sub">Todas as turmas, todos os períodos</p>
        ${r.totalMatriculas ? `
        <div class="donut-wrap">
          <svg class="donut" viewBox="0 0 42 42" aria-hidden="true">
            <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--surface-2)" stroke-width="6"></circle>
            ${arcos}
            <text x="21" y="20.5" text-anchor="middle" class="donut-center" style="font-size:8px; font-weight:800;">${r.totalMatriculas}</text>
            <text x="21" y="26.5" text-anchor="middle" class="donut-center-sub" style="font-size:2.8px;">MATRÍCULAS</text>
          </svg>
          <div class="legend"><ul>${legenda}</ul></div>
        </div>` : `<div class="empty-note">Sem matrículas ainda.</div>`}
      </div>
    </section>

    ${secaoAniversariantes()}

    ${secaoAtendimentosDash()}

    <section class="grid-2">
      <div class="panel">
        <h3>Trajetória entre cursos</h3>
        <p class="panel-sub">Cruzamento: quais cursos cada aluno já fez</p>
        ${trajetoria || `<div class="empty-note">Nenhum aluno com mais de um curso ainda.</div>`}
        ${cruz.multi.length > 4 ? `<p style="margin:12px 0 0; font-size:0.8rem;"><a href="#/indicadores/relatorios">Ver relatório completo &rarr;</a></p>` : ""}
      </div>

      <div class="panel">
        <h3>Alertas de presença</h3>
        <p class="panel-sub">Frequência mínima exigida: ${Store.config.presencaMinima}%</p>
        ${alertas || `<div class="alert-box ok"><span class="ico">&#10003;</span><div>
          <strong>Nenhum aluno abaixo do mínimo</strong>
          <p>Todos os alunos das turmas em andamento estão com a frequência em dia.</p>
        </div></div>`}
      </div>
    </section>
  `;
};

/* aviso de aniversariantes do mês (todas as áreas), destacando os de hoje */
function secaoAniversariantes() {
  const hoje = new Date();
  const lista = Store.aniversariantes(hoje.getMonth() + 1);
  if (!lista.length) return "";
  const diaHoje = hoje.getDate();
  const deHoje = lista.filter(x => x.dia === diaHoje);
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `
    <section class="panel">
      <h3>&#127874; Aniversariantes de ${meses[hoje.getMonth()]}</h3>
      <p class="panel-sub">${deHoje.length
        ? `Hoje: ${deHoje.map(x => x.nome.split(" ")[0]).join(", ")} &#127881; Não esqueça os parabéns!`
        : "Alunos, professores, equipe, profissionais e pacientes"}</p>
      <div class="cross-chips">
        ${lista.map(x => `
          <span class="chip ${x.dia === diaHoje ? "cor-3" : ""}" ${x.dia === diaHoje ? 'style="font-weight:800;"' : ""}>
            ${x.dia === diaHoje ? "&#127874; " : ""}dia ${x.dia} · ${U.esc(x.nome)}
            <span style="font-weight:400; opacity:0.75;">(${x.origem})</span>
          </span>`).join("")}
      </div>
    </section>`;
}

/* resumo do módulo de atendimentos e da gratuidade no painel inicial */
function secaoAtendimentosDash() {
  const ra = Store.resumoAtendimentos();
  if (!ra.pacientes && !ra.total) return "";
  const g = Store.resumoGratuidade();
  const hoje = ra.hoje;
  return `
    <section class="panel">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <h3>Atendimentos clínicos</h3>
          <p class="panel-sub" style="margin-bottom:14px;">Psicologia, Psiquiatria e Neuropsicopedagogia</p>
        </div>
        <a href="#/atendimentos" style="font-size:0.82rem; font-weight:600;">Abrir módulo &rarr;</a>
      </div>
      <div class="stat-strip">
        <div class="stat-card" style="--stat-color: var(--navy-accent)">
          <span class="label">Pacientes</span>
          <span class="value">${ra.pacientes}</span>
          <span class="delta">${g.pacGratuitos} gratuitos · ${g.pacPagos} pagos</span>
        </div>
        <div class="stat-card" style="--stat-color: var(--accent)">
          <span class="label">Hoje</span>
          <span class="value">${hoje}</span>
          <span class="delta">${ra.proximos} ${U.plural(ra.proximos, "próximo agendado", "próximos agendados")}</span>
        </div>
        <div class="stat-card" style="--stat-color: ${ra.taxaFalta !== null && ra.taxaFalta > 20 ? "var(--danger)" : "var(--good)"}">
          <span class="label">Taxa de faltas</span>
          <span class="value">${ra.taxaFalta !== null ? ra.taxaFalta + "%" : "—"}</span>
          <span class="delta">nos atendimentos</span>
        </div>
        <div class="stat-card" style="--stat-color: var(--good)">
          <span class="label">Pessoas sem custo</span>
          <span class="value">${g.pessoasGratuitas}</span>
          <span class="delta">em todo o instituto</span>
        </div>
      </div>
    </section>`;
}

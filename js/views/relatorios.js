/* Relatórios: presença por turma, cruzamento de cursos, exportações e backup */
"use strict";

Views.relatorios = () => {
  const turmas = Store.col("turmas");
  const cruz = Store.cruzamento();
  const min = Store.config.presencaMinima;

  /* presença por turma */
  const blocosTurmas = turmas.map(t => {
    const c = Store.get("cursos", t.cursoId);
    const mats = Store.matriculasDaTurma(t.id);
    if (!mats.length) return "";
    const linhas = U.ordenarPorNome(
      mats.map(m => ({ m, aluno: Store.get("alunos", m.alunoId) })).filter(x => x.aluno),
      // ordena pelo nome do aluno
    ).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"))
     .map(({ m, aluno }) => {
      const p = Store.presencaAluno(t.id, aluno.id);
      const cls = p.pct === null ? "info" : p.pct >= min ? "ok" : "bad";
      return `<tr>
        <td>${U.esc(aluno.nome)}</td>
        <td>${p.total ? `${p.presentes}/${p.total}` : "—"}</td>
        <td><span class="pill ${cls}">${p.pct !== null ? p.pct + "%" : "sem registros"}</span></td>
        <td>${U.esc(m.status)}</td>
      </tr>`;
    }).join("");
    const media = Store.presencaMediaTurma(t.id);
    return `
      <div class="panel">
        <h3><span class="chip cor-${c ? c.corIndex : 8}">${U.esc(c ? c.nome : "curso removido")}</span> ${U.esc(t.nome)}</h3>
        <p class="panel-sub">${U.fmtData(t.dataInicio)} – ${U.fmtData(t.dataFim)} · presença média: ${media !== null ? media + "%" : "—"} · status: ${U.esc(t.status)}</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Aluno</th><th>Presenças</th><th>Frequência</th><th>Matrícula</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table></div>
      </div>`;
  }).join("");

  /* cruzamento */
  const linhasCruz = cruz.multi.map(x => `
    <tr>
      <td>${U.esc(x.aluno.nome)}</td>
      <td>${x.cursos.length}</td>
      <td><div class="cross-chips">${x.cursos.map(y =>
        `<span class="chip cor-${y.curso.corIndex}">${U.esc(y.curso.nome)}</span>`).join("")}</div></td>
    </tr>`).join("");

  const linhasCombos = cruz.combos.slice(0, 8).map(([combo, qtd]) => `
    <tr><td>${U.esc(combo)}</td><td style="font-weight:700">${qtd}</td></tr>`).join("");

  return `
    <div class="page-head">
      <div>
        <h2>Indicadores</h2>
        <p>Relatório de presença por turma, cruzamento de cursos por aluno, exportações e backup dos dados.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="imprimir">Imprimir / PDF</button>
      </div>
    </div>
    ${subnavIndicadores("relatorios")}

    <div class="panel">
      <h3>Exportar planilhas (CSV — abre no Excel)</h3>
      <p class="panel-sub">Arquivos com ponto e vírgula, prontos para prestação de contas</p>
      <div class="head-actions">
        <button class="btn" data-action="csvAlunos">Alunos (cadastro completo)</button>
        <button class="btn" data-action="csvPresenca">Presenças por turma</button>
        <button class="btn" data-action="csvCruzamento">Cursos por aluno</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <h3>Alunos com mais de um curso</h3>
        <p class="panel-sub">Cruzamento de dados: trajetória de formação de cada aluno</p>
        ${cruz.multi.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Aluno</th><th>Nº de cursos</th><th>Cursos</th></tr></thead>
          <tbody>${linhasCruz}</tbody>
        </table></div>` : `<div class="empty-note">Nenhum aluno com mais de um curso ainda.</div>`}
      </div>
      <div class="panel">
        <h3>Combinações mais comuns</h3>
        <p class="panel-sub">Pares de cursos feitos pelas mesmas pessoas</p>
        ${cruz.combos.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Combinação</th><th>Alunos</th></tr></thead>
          <tbody>${linhasCombos}</tbody>
        </table></div>` : `<div class="empty-note">Ainda não há combinações registradas.</div>`}
      </div>
    </div>

    ${painelFinanceiroCursos()}

    ${blocosTurmas || `<div class="panel"><div class="empty-note">Nenhuma turma com matrículas para gerar relatório de presença.</div></div>`}

    <div class="panel">
      <h3>Backup dos dados</h3>
      <p class="panel-sub">Os dados ficam salvos neste navegador. Exporte o backup com frequência e guarde o arquivo em local seguro (contém dados pessoais — LGPD).</p>
      <div class="head-actions">
        <button class="btn" data-action="backupExportar">Exportar backup (.json)</button>
        <button class="btn ghost" data-action="backupImportar">Importar backup</button>
        <input type="file" id="arquivo-backup" accept=".json,application/json" hidden>
        ${App.ehAdmin() ? `<button class="btn danger" data-action="apagarTudo">Apagar todos os dados</button>` : ""}
      </div>
    </div>

    ${App.ehAdmin() ? `
    <div class="panel">
      <h3>Segurança e logins</h3>
      <p class="panel-sub">Somente o administrador cria e troca as senhas dos perfis. Os PINs de professores e profissionais são definidos nos respectivos cadastros.</p>
      <div class="head-actions">
        <button class="btn" data-action="senhaPerfil" data-id="admin">Trocar senha do admin</button>
        <button class="btn" data-action="senhaPerfil" data-id="secretaria">${Store.temSenha("secretaria") ? "Trocar" : "Criar"} senha da secretaria</button>
        <button class="btn" data-action="pinFinanceiro">${Store.temPinFinanceiro() ? "Trocar" : "Criar"} PIN do gestor financeiro</button>
      </div>
      <div class="combo-note" style="margin-top:14px;">
        <strong>Admin</strong>: acesso total, inclusive gerenciar senhas e PINs ·
        <strong>Secretaria</strong>: operação completa, sem gerenciar logins.
        Professores e profissionais de saúde entram com PIN próprio, vendo apenas o que é deles.
      </div>
    </div>` : ""}
  `;
};

/* financeiro dos cursos pagos (só aparece se houver curso pago) */
function painelFinanceiroCursos() {
  const f = Store.resumoFinanceiroCursos();
  if (!f.porCurso.length) return "";
  const linhas = f.porCurso.map(x => `
    <tr>
      <td><span class="chip cor-${x.curso.corIndex}">${U.esc(x.curso.nome)}</span></td>
      <td>${U.moeda(x.valor)}${x.curso.cobranca === "mensal" ? "/mês" : " (único)"}</td>
      <td>${x.pagantes}</td>
      <td>${x.bolsistas}</td>
      <td style="font-weight:700">${U.moeda(x.previsto)}${x.curso.cobranca === "mensal" ? "/mês" : ""}</td>
    </tr>`).join("");
  return `
    <div class="panel">
      <h3>Financeiro dos cursos pagos</h3>
      <p class="panel-sub">Pagantes, bolsistas e receita prevista (matrículas não desistentes)</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Curso</th><th>Valor</th><th>Pagantes</th><th>Bolsistas</th><th>Receita prevista</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      <div class="combo-note">
        Total previsto: <strong>${U.moeda(f.receitaMensal)}/mês</strong> em mensalidades
        ${f.receitaUnica ? ` + <strong>${U.moeda(f.receitaUnica)}</strong> em valores únicos` : ""}.
        Bolsistas não geram cobrança.
      </div>
    </div>`;
}

/* ---------- exportações ---------- */

Actions.imprimir = () => window.print();

Actions.csvAlunos = () => {
  const cab = ["Nome", "Nascimento", "CPF", "Telefone", "E-mail", "Endereço", "Bairro", "Cidade", "CEP",
    "Responsável", "Encaminhamento", "Atingido pelas enchentes", "Impacto das enchentes", "Renda familiar", "Benefícios",
    "Moradia atual", "Necessidades", "Condição", "Observações", "Cursos que fez"];
  const linhas = U.ordenarPorNome(Store.col("alunos")).map(a => U.linhaCSV([
    a.nome, U.fmtData(a.nascimento), a.cpf, a.telefone, a.email, a.endereco, a.bairro, a.cidade, a.cep,
    a.responsavel, a.encaminhamento,
    a.atingidoEnchente === "sim" ? "Sim" : a.atingidoEnchente === "nao" ? "Não" : "",
    a.impactoEnchentes, a.rendaFamiliar, a.beneficios,
    a.moradiaAtual, a.necessidades,
    { gratuito: "Gratuito", pago: "Pago" }[Store.condicaoAluno(a.id)],
    a.observacoes,
    Store.cursosDoAluno(a.id).map(x => x.curso.nome).join(" + ")
  ]));
  U.baixarArquivo("alunos-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha de alunos exportada.");
};

Actions.csvPresenca = () => {
  const cab = ["Curso", "Turma", "Aluno", "Presenças", "Aulas", "Frequência %", "Status da matrícula"];
  const linhas = [];
  for (const t of Store.col("turmas")) {
    const c = Store.get("cursos", t.cursoId);
    for (const m of Store.matriculasDaTurma(t.id)) {
      const a = Store.get("alunos", m.alunoId);
      if (!a) continue;
      const p = Store.presencaAluno(t.id, a.id);
      linhas.push(U.linhaCSV([c ? c.nome : "", t.nome, a.nome, p.presentes, p.total, p.pct !== null ? p.pct : "", m.status]));
    }
  }
  U.baixarArquivo("presencas-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha de presenças exportada.");
};

Actions.csvCruzamento = () => {
  const cab = ["Aluno", "Nº de cursos", "Cursos"];
  const linhas = U.ordenarPorNome(Store.col("alunos")).map(a => {
    const cs = Store.cursosDoAluno(a.id);
    return U.linhaCSV([a.nome, cs.length, cs.map(x => x.curso.nome).join(" + ")]);
  });
  U.baixarArquivo("cursos-por-aluno-instituto-bzn.csv", "﻿" + [U.linhaCSV(cab), ...linhas].join("\n"), "text/csv;charset=utf-8");
  U.toast("Planilha de cruzamento exportada.");
};

/* ---------- contas de e-mail (Supabase Auth) ---------- */

const PAPEIS_CONTA = [
  ["admin", "Administração"],
  ["presidente", "Presidência"],
  ["secretaria", "Secretaria"],
  ["financeiro", "Gestor financeiro"],
  ["servico_social", "Serviço social"],
  ["prof_saude", "Profissional de saúde"],
  ["professor", "Professor(a)"]
];
const rotuloPapel = p => (PAPEIS_CONTA.find(x => x[0] === p) || ["", p])[1];

function painelContas() {
  const conectada = typeof Nuvem !== "undefined" && Nuvem.configurada();
  const lista = Store.contas();
  const linhas = lista.map(c => {
    let vinculo = "";
    if (c.papel === "prof_saude") {
      const p = Store.get("profsaude", c.profsaudeId);
      vinculo = p ? p.nome : "<em>profissional não encontrado</em>";
    } else if (c.papel === "professor") {
      const p = Store.get("professores", c.professorId);
      vinculo = p ? p.nome : "<em>professor não encontrado</em>";
    }
    return `<tr>
      <td>${U.esc(c.email)}</td>
      <td>${U.esc(c.nome || "—")}</td>
      <td>${U.esc(rotuloPapel(c.papel))}${vinculo ? " · " + vinculo : ""}</td>
      <td>${c.senhaProvisoria ? `<span class="pill warn">provisória</span>` : `<span class="pill ok">própria</span>`}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn" data-action="editarConta" data-id="${U.esc(c.email)}" title="Editar" aria-label="Editar conta">&#9998;</button>
        <button class="icon-btn" data-action="removerConta" data-id="${U.esc(c.email)}" title="Remover" aria-label="Remover conta">&#128465;</button>
      </td>
    </tr>`;
  }).join("");

  return `
    <div class="panel">
      <h3>&#128100; Contas de acesso por e-mail</h3>
      <p class="panel-sub">
        Cada pessoa entra com e-mail e senha próprios. A senha é criada e guardada
        pelo Supabase, não por este sistema — aqui você define apenas qual perfil
        cada conta tem.
      </p>
      ${conectada ? "" : `<div class="alert-box warn" style="margin-bottom:12px;">
        <span class="ico">&#9888;&#65039;</span>
        <div><p>A nuvem ainda não está conectada neste aparelho. As contas só funcionam com a nuvem configurada.</p></div>
      </div>`}
      ${lista.length ? `<div class="table-wrap"><table>
        <thead><tr><th>E-mail</th><th>Nome</th><th>Perfil</th><th>Senha</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>` : `<div class="empty-note">Nenhuma conta cadastrada ainda.</div>`}
      <div class="head-actions" style="margin-top:12px;">
        <button class="btn accent" data-action="novaConta">+ Nova conta</button>
      </div>
      <div class="alert-box info" style="margin-top:14px;">
        <span class="ico">&#128274;</span>
        <div><p>Cadastrar aqui <strong>não cria</strong> a conta no Supabase. Crie-a primeiro no painel do
        Supabase, em <strong>Authentication → Users → Add user</strong>, com o mesmo e-mail — e depois
        registre o perfil dela aqui.</p></div>
      </div>
    </div>`;
}

function abrirFormConta(c) {
  const optPapel = PAPEIS_CONTA.map(([v, r]) =>
    `<option value="${v}" ${c.papel === v ? "selected" : ""}>${r}</option>`).join("");
  const optPS = ['<option value="">— selecione —</option>'].concat(
    U.ordenarPorNome(Store.col("profsaude")).map(p =>
      `<option value="${p.id}" ${c.profsaudeId === p.id ? "selected" : ""}>${U.esc(p.nome)}</option>`)).join("");
  const optPR = ['<option value="">— selecione —</option>'].concat(
    U.ordenarPorNome(Store.col("professores")).map(p =>
      `<option value="${p.id}" ${c.professorId === p.id ? "selected" : ""}>${U.esc(p.nome)}</option>`)).join("");

  App.abrirModal(c.email ? "Editar conta" : "Nova conta", `
    <form>
      <div class="form-grid">
        <div class="field full">
          <label for="fc-email">E-mail *</label>
          <input id="fc-email" name="email" type="email" required value="${U.esc(c.email || "")}"
                 ${c.email ? "readonly" : ""} placeholder="pessoa@institutobzn.org">
        </div>
        <div class="field full">
          <label for="fc-nome">Nome</label>
          <input id="fc-nome" name="nome" value="${U.esc(c.nome || "")}">
        </div>
        <div class="field full">
          <label for="fc-papel">Perfil</label>
          <select id="fc-papel" name="papel">${optPapel}</select>
        </div>
        <div class="field full" id="campo-ps" hidden>
          <label for="fc-ps">Qual profissional de saúde</label>
          <select id="fc-ps" name="profsaudeId">${optPS}</select>
        </div>
        <div class="field full" id="campo-pr" hidden>
          <label for="fc-pr">Qual professor(a)</label>
          <select id="fc-pr" name="professorId">${optPR}</select>
        </div>
        <div class="field full">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="senhaProvisoria" ${c.senhaProvisoria !== false ? "checked" : ""}>
            <span>Senha provisória — pedir que a pessoa crie a dela no primeiro acesso</span>
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar conta</button>
      </div>
    </form>`, dados => {
    if (!String(dados.email || "").trim()) return false;
    if (dados.papel === "prof_saude" && !dados.profsaudeId) {
      alert("Escolha a qual profissional de saúde esta conta pertence.");
      return false;
    }
    if (dados.papel === "professor" && !dados.professorId) {
      alert("Escolha a qual professor(a) esta conta pertence.");
      return false;
    }
    Store.salvarConta(dados);
    U.toast("Conta salva.");
    App.render();
  }, c.email ? c : null);

  /* mostra o vínculo só para os perfis que precisam dele */
  const sel = document.getElementById("fc-papel");
  const ajustar = () => {
    document.getElementById("campo-ps").hidden = sel.value !== "prof_saude";
    document.getElementById("campo-pr").hidden = sel.value !== "professor";
  };
  sel.addEventListener("change", ajustar);
  ajustar();
}

Actions.novaConta = () => abrirFormConta({ email: "", nome: "", papel: "secretaria", profsaudeId: "", professorId: "", senhaProvisoria: true });
Actions.editarConta = email => {
  const c = Store.contaPorEmail(email);
  if (c) abrirFormConta(c);
};
Actions.removerConta = email => {
  if (!confirm(`Remover o acesso de "${email}"?\n\nA conta continua existindo no Supabase — remova lá também para bloquear a entrada por completo.`)) return;
  Store.removerConta(email);
  U.toast("Conta removida deste sistema.");
  App.render();
};

/* ---------- conexão com a nuvem (Supabase) ---------- */

function painelNuvem() {
  const conectada = typeof Nuvem !== "undefined" && Nuvem.configurada();
  const endereco = conectada ? Nuvem.endereco() : "";
  return `
    <div class="panel" style="border:2px solid ${conectada ? "var(--good)" : "var(--border)"};">
      <h3>&#9729;&#65039; Nuvem — dados compartilhados entre computadores</h3>
      <p class="panel-sub">
        ${conectada
          ? `<strong style="color:var(--good);">Conectado ✓</strong> a <code>${U.esc(endereco)}</code>.
             O que cada pessoa salvar aparece para as outras (atualiza sozinho em poucos segundos).`
          : `<strong>Ainda não conectado.</strong> Enquanto isso, os dados ficam só neste navegador.
             Conecte à nuvem para a equipe acessar de máquinas diferentes vendo os mesmos dados.`}
      </p>
      <div class="head-actions">
        <button class="btn accent" data-action="nuvemConfig">${conectada ? "Alterar conexão" : "Conectar à nuvem"}</button>
        ${conectada ? `
          <button class="btn" data-action="nuvemTestar">Testar conexão</button>
          <button class="btn ghost" data-action="nuvemEnviar">Enviar dados agora</button>
          <button class="btn danger" data-action="nuvemDesconectar">Desconectar</button>` : ""}
      </div>
      ${conectada ? `<p style="font-size:0.8rem; color:var(--text-muted); margin-top:10px;">
        Dica: se duas pessoas editarem exatamente ao mesmo tempo, vale a última que salvar. Para o dia a dia da equipe, isso não costuma ser problema.</p>` : ""}
    </div>`;
}

Actions.nuvemConfig = () => {
  if (!App.ehAdmin()) { U.toast("Apenas o administrador configura a nuvem."); return; }
  const urlAtual = (typeof Nuvem !== "undefined" && Nuvem.configurada()) ? Nuvem.endereco() : "";
  App.abrirModal("Conectar à nuvem", `
    <p style="font-size:0.9rem; margin-bottom:12px;">
      Cole abaixo os dados do seu projeto Supabase (veja o guia passo a passo).
      A <strong>chave publicável</strong> pode ser usada aqui com segurança.
    </p>
    <div class="field">
      <label for="nv-url">Endereço (Project URL)</label>
      <input id="nv-url" type="text" placeholder="https://xxxxxxxx.supabase.co" value="${U.esc(urlAtual)}">
    </div>
    <div class="field">
      <label for="nv-key">Chave publicável (anon / public)</label>
      <input id="nv-key" type="text" placeholder="sb_publishable_..." autocomplete="off">
    </div>
    <p style="font-size:0.8rem; color:var(--text-muted);">Ao conectar, este aparelho passa a sincronizar automaticamente.</p>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
      <button type="button" class="btn accent" data-modal-action="nuvemSalvar">Conectar</button>
    </div>`);
};

Actions.nuvemSalvar = async () => {
  const url = (document.getElementById("nv-url").value || "").trim();
  const key = (document.getElementById("nv-key").value || "").trim();
  if (!/^https:\/\/.+\.supabase\.co/i.test(url)) {
    alert("O endereço deve ser parecido com https://xxxxxxxx.supabase.co");
    return;
  }
  if (!key) { alert("Cole a chave publicável (anon / public)."); return; }
  Nuvem.salvarConfig(url, key);
  U.toast("Testando a conexão…");
  const r = await Nuvem.testar();
  if (!r.ok) {
    alert("Não foi possível conectar.\n\n" + r.msg + "\n\nConfira o endereço e a chave e tente de novo.");
    return;
  }
  await Nuvem.iniciar();
  App.fecharModal();
  U.toast("Nuvem conectada! Sincronizando…");
  App.render();
};

Actions.nuvemTestar = async () => {
  U.toast("Testando…");
  const r = await Nuvem.testar();
  alert(r.ok ? "✅ " + r.msg : "⚠️ " + r.msg);
};

Actions.nuvemEnviar = async () => {
  U.toast("Enviando para a nuvem…");
  await Nuvem.enviarAgora();
  U.toast("Dados enviados para a nuvem.");
};

Actions.nuvemDesconectar = () => {
  if (!confirm("Desconectar este aparelho da nuvem?\n\nOs dados continuam guardados aqui neste navegador, mas param de sincronizar com os outros computadores.")) return;
  Nuvem.limparConfig();
  U.toast("Desconectado da nuvem.");
  App.render();
};

/* ---------- backup ---------- */

Actions.backupExportar = () => {
  U.baixarArquivo(`backup-instituto-bzn-${U.hojeISO()}.json`, Store.exportarJSON(), "application/json");
  U.toast("Backup exportado. Guarde o arquivo em local seguro.");
};

Actions.backupImportar = () => {
  const input = document.getElementById("arquivo-backup");
  input.onchange = () => {
    const arq = input.files[0];
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        if (!confirm("Importar este backup?\nOs dados atuais serão substituídos pelos do arquivo.")) return;
        Store.importarJSON(leitor.result);
        U.toast("Backup importado.");
        App.render();
      } catch (e) {
        alert("Não foi possível importar: " + e.message);
      }
      input.value = "";
    };
    leitor.readAsText(arq);
  };
  input.click();
};

/* ---------------- página Segurança e logins (somente admin) ---------------- */

Views.seguranca = () => {
  if (!App.ehAdmin()) {
    return `<div class="panel" style="max-width:440px; margin:40px auto 0;">
      <div class="empty-note">Somente o <strong>administrador</strong> ou a <strong>presidência</strong> acessam a área de segurança.<br>
      Entre com o perfil Administração ou Presidência para gerenciar senhas e PINs.</div></div>`;
  }
  const item = (titulo, descricao, botoes) => `
    <div class="panel">
      <h3>${titulo}</h3>
      <p class="panel-sub">${descricao}</p>
      <div class="head-actions">${botoes}</div>
    </div>`;
  return `
    <div class="page-head">
      <div>
        <h2>&#9881; Segurança e logins</h2>
        <p>Central do administrador: todas as senhas e PINs do sistema são criados e trocados aqui (e apenas por você).</p>
      </div>
    </div>

    <div class="panel" style="border:2px solid var(--accent);">
      <h3>&#128190; Backup dos dados (faça sempre!)</h3>
      <p class="panel-sub">
        Enquanto o sistema é local, <strong>todos os dados ficam guardados só neste navegador</strong>.
        Exporte um backup com frequência e guarde o arquivo em local seguro (Google Drive, pen drive).
        É a sua proteção se o computador falhar — e serve para levar os dados para outro computador ou para a nuvem depois.
        O arquivo contém dados pessoais: trate com cuidado (LGPD).
      </p>
      <div class="head-actions">
        <button class="btn accent" data-action="backupExportar">&#11015;&#65039; Baixar backup agora (.json)</button>
        <button class="btn ghost" data-action="backupImportar">&#11014;&#65039; Restaurar backup de um arquivo</button>
        <input type="file" id="arquivo-backup" accept=".json,application/json" hidden>
      </div>
    </div>

    ${painelNuvem()}

    ${painelContas()}

    ${item("Senha do administrador",
      "A senha principal do sistema. Guarde em local seguro — quem a tem controla todos os acessos.",
      `<button class="btn" data-action="senhaPerfil" data-id="admin">Trocar senha do admin</button>`)}

    ${item("Senha da presidência",
      `Acesso total, igual ao administrador (todas as áreas, Financeiro e esta página de logins). ${Store.temSenha("presidente") ? "<strong>Status: criada ✓</strong>" : "<strong>Status: ainda não criada</strong>"}`,
      `<button class="btn accent" data-action="senhaPerfil" data-id="presidente">${Store.temSenha("presidente") ? "Trocar" : "Criar"} senha da presidência</button>`)}

    ${item("Pergunta de segurança",
      `Protege a recuperação de senha na tela de entrada: quem clicar em "Esqueci a senha" precisa acertar a resposta. ${Store.temPerguntaSeguranca() ? `<strong>Status: cadastrada ✓</strong> — "${U.esc(Store.perguntaSeguranca())}"` : "<strong>Status: não cadastrada — recomendado criar</strong>"}`,
      `<button class="btn accent" data-action="perguntaSeguranca">${Store.temPerguntaSeguranca() ? "Trocar" : "Cadastrar"} pergunta de segurança</button>`)}

    ${item("Senha da secretaria",
      `Compartilhada pela equipe da secretaria. Operação completa (cadastros, chamada, atendimentos, agenda, relatórios), sem gerenciar logins nem acessar o financeiro. ${Store.temSenha("secretaria") ? "<strong>Status: criada ✓</strong>" : "<strong>Status: ainda não criada</strong>"}`,
      `<button class="btn accent" data-action="senhaPerfil" data-id="secretaria">${Store.temSenha("secretaria") ? "Trocar" : "Criar"} senha da secretaria</button>`)}

    ${item("PIN do gestor financeiro",
      `Dá acesso exclusivo à aba Financeiro (extrato, Guru, notas fiscais e relatórios). ${Store.temPinFinanceiro() ? "<strong>Status: criado ✓</strong>" : "<strong>Status: ainda não criado</strong>"}`,
      `<button class="btn accent" data-action="pinFinanceiro">${Store.temPinFinanceiro() ? "Trocar" : "Criar"} PIN do gestor financeiro</button>`)}

    ${item("PIN da assistência social",
      `Dá acesso exclusivo à aba Assistência (atendidos, lista de espera, agenda interna e legislação). ${Store.temPinAssistencia() ? "<strong>Status: criado ✓</strong>" : "<strong>Status: ainda não criado</strong>"}`,
      `<button class="btn accent" data-action="pinAssistencia">${Store.temPinAssistencia() ? "Trocar" : "Criar"} PIN da assistência social</button>`)}

    ${item("PINs dos professores",
      "Cada professor tem um PIN individual, definido no cadastro dele (o campo só aparece para o admin). Com o PIN, ele acessa apenas as próprias turmas e chamadas.",
      `<a class="btn ghost" href="#/professores" style="text-decoration:none;">Abrir cadastro de professores &rarr;</a>`)}

    ${item("PINs dos profissionais de saúde",
      "Mesmo esquema: PIN individual no cadastro de cada profissional, com acesso restrito aos próprios pacientes e agenda.",
      `<a class="btn ghost" href="#/atendimentos/profissionais" style="text-decoration:none;">Abrir cadastro de profissionais &rarr;</a>`)}

    <div class="panel">
      <h3>Quem acessa o quê</h3>
      <p class="panel-sub">Resumo das permissões</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Perfil</th><th>Como entra</th><th>O que vê</th></tr></thead>
        <tbody>
          <tr><td><span class="pill info">Admin</span></td><td>Perfil "Administração" + senha</td><td>Tudo, inclusive esta página e o Financeiro</td></tr>
          <tr><td><span class="pill info">Presidência</span></td><td>Perfil "Presidência" + senha</td><td>Acesso total, igual ao admin</td></tr>
          <tr><td><span class="pill ok">Secretaria</span></td><td>Perfil "Secretaria" + senha</td><td>Operação completa, exceto logins e Financeiro</td></tr>
          <tr><td><span class="pill warn">Gestor financeiro</span></td><td>Aba Financeiro + PIN</td><td>Somente o Financeiro</td></tr>
          <tr><td><span class="pill muted">Professor</span></td><td>"Sou professor" + nome + PIN</td><td>Somente as turmas e alunos dele</td></tr>
          <tr><td><span class="pill muted">Profissional</span></td><td>"Sou profissional de saúde" + nome + PIN</td><td>Somente os pacientes e agenda dele</td></tr>
          <tr><td><span class="pill bad">Colaborador</span></td><td>Não tem acesso</td><td>Apenas cadastro interno (aba Professores &rarr; Funcionários e colaboradores)</td></tr>
        </tbody>
      </table></div>
    </div>
  `;
};

/* criar/trocar senha de um perfil. Estar logado como admin já é a autorização
   (não pedimos a senha atual de novo — evita ficar preso se ela for esquecida). */
Actions.senhaPerfil = perfil => {
  if (!App.ehAdmin()) { U.toast("Apenas o administrador ou a presidência alteram senhas."); return; }
  const rotulo = { admin: "do administrador", presidente: "da presidência", secretaria: "da secretaria" }[perfil];
  const nova = prompt(`Digite a nova senha ${rotulo} (mínimo 4 caracteres):`);
  if (nova === null) return;
  if (nova.trim().length < 4) { alert("A nova senha deve ter pelo menos 4 caracteres."); return; }
  const conf = prompt("Digite a nova senha de novo para confirmar:");
  if (conf === null) return;
  if (nova !== conf) { alert("As senhas não conferem. Nada foi alterado."); return; }
  Store.definirSenha(perfil, nova);
  U.toast(`Senha ${rotulo} salva.`);
  App.render();
};

Actions.perguntaSeguranca = () => {
  if (!App.ehAdmin()) { U.toast("Apenas o administrador altera isto."); return; }
  const pergunta = prompt("Pergunta de segurança:\n(ex.: Qual o nome do seu primeiro cachorro?)", Store.perguntaSeguranca());
  if (pergunta === null) return;
  if (!pergunta.trim()) { alert("Digite uma pergunta."); return; }
  const resposta = prompt("Resposta secreta:\n(não diferencia maiúsculas/acentos)");
  if (resposta === null) return;
  if (!resposta.trim()) { alert("Digite a resposta."); return; }
  Store.definirPerguntaSeguranca(pergunta, resposta);
  U.toast("Pergunta de segurança salva.");
  App.render();
};

Actions.pinAssistencia = () => {
  if (!App.ehAdmin()) { U.toast("Apenas o administrador altera o PIN."); return; }
  const pin = prompt("Novo PIN da assistência social (4 a 6 dígitos):");
  if (pin === null) return;
  if (!/^\d{4,6}$/.test(pin.trim())) { alert("O PIN deve ter de 4 a 6 dígitos numéricos."); return; }
  Store.definirPinAssistencia(pin.trim());
  U.toast("PIN da assistência social salvo.");
  App.render();
};

Actions.pinFinanceiro = () => {
  if (!App.ehAdmin()) { U.toast("Apenas o administrador altera o PIN."); return; }
  const pin = prompt("Novo PIN do gestor financeiro (4 a 6 dígitos):");
  if (pin === null) return;
  if (!/^\d{4,6}$/.test(pin.trim())) { alert("O PIN deve ter de 4 a 6 dígitos numéricos."); return; }
  Store.definirPinFinanceiro(pin.trim());
  U.toast("PIN do financeiro salvo.");
  App.render();
};

Actions.apagarTudo = () => {
  if (confirm("Apagar TODOS os cadastros deste navegador?\n\nSerão removidos: alunos, turmas, chamadas, matrículas, pacientes, atendimentos, assistidos, lançamentos financeiros, agenda e documentos.\n\nSUAS SENHAS, PINs e a pergunta de segurança são MANTIDOS.\n\nEssa ação não pode ser desfeita. Exporte um backup antes, se precisar.")) {
    if (confirm("Tem certeza? Esta é a limpeza para começar a alimentar o sistema com os dados reais do instituto.")) {
      Store.limparTudo();
      U.toast("Cadastros apagados. Logins mantidos. Pronto para usar!");
      App.render();
    }
  }
};

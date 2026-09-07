/* Pacientes do módulo de atendimentos: lista alfabética, ficha e cadastro
   (com área financeira: gratuito/pago, cobrança mensal ou por consulta). */
"use strict";

/* Aviso usado quando alguém chega a uma ficha que não lhe pertence.
   Esconder a aba não basta: a rota continua digitável na barra de endereço. */
function avisoSemAcessoPaciente() {
  return `
    <div class="page-head">
      <div>
        <h2>Acesso restrito</h2>
        <p>Cada profissional acessa apenas os próprios pacientes, pela sua área.</p>
      </div>
    </div>
    <div class="panel"><div class="empty-note">
      Esta ficha não está entre os seus pacientes.<br>
      <a href="#/atendimentos/meus-pacientes">Voltar para os meus pacientes</a>
    </div></div>`;
}

/* A rota antiga da lista geral continua existindo — links e favoritos antigos
   apontam para ela — mas não lista mais ninguém: explica onde os pacientes
   passaram a ficar. */
Views.pacientesLista = () => `
  <div class="page-head">
    <div>
      <h2>Pacientes</h2>
      <p>Cada paciente pertence ao profissional que o atende.</p>
    </div>
  </div>
  ${AT.subnav("")}
  <div class="panel"><div class="empty-note">
    Não há mais uma lista geral de pacientes.<br>
    Os pacientes ficam em <strong>Minha área → Pacientes</strong>, dentro da área
    de cada profissional.<br><br>
    <a href="#/atendimentos/minha-area">Ir para Minha área</a>
  </div></div>`;

Views.pacienteDetalhe = id => {
  const p = Store.get("pacientes", id);
  if (!p) return `<div class="panel"><div class="empty-note">Paciente não encontrado.</div></div>`;

  /* Só abre a ficha quem é administração ou o profissional dono do paciente.
     Fecha também a secretaria, que não passa pelo login por PIN e chegaria
     aqui pelos links de nome da agenda e dos relatórios. */
  const prof = (typeof profLogado === "function") ? profLogado() : null;
  const podeVer = App.ehAdmin() ||
    (prof && pacientesDoProf(prof).some(x => x.id === p.id));
  if (!podeVer) return avisoSemAcessoPaciente();

  const esps = Store.especialidadesDoPaciente(p.id);
  const ats = Store.atendimentosDoPaciente(p.id);
  const idade = U.idade(p.nascimento);

  const item = (k, v) => `<div class="detail-item"><div class="k">${k}</div><div class="v">${v || "—"}</div></div>`;

  const linhasAt = ats.map(a => {
    const prof = Store.get("profsaude", a.profissionalId);
    return `
      <tr>
        <td style="white-space:nowrap">${U.fmtData(a.data)} ${U.esc(a.hora || "")}</td>
        <td>${AT.espChip(a.especialidade)}</td>
        <td>${U.esc(prof ? prof.nome : "—")}</td>
        <td>${U.esc(a.tipoConsulta || "—")} · ${U.esc(a.formato || "—")} · ${U.esc(a.modalidade || "—")}</td>
        <td>${AT.statusPill(a.status)}</td>
        <td><button class="icon-btn" data-action="editarAtend" data-id="${a.id}" title="Editar" aria-label="Editar atendimento">&#9998;</button></td>
      </tr>`;
  }).join("");

  const financeiro = p.tipoAtendimento === "pago"
    ? `Pago · ${p.cobranca === "mensal" ? "mensalidade de " + U.moeda(p.valor) : U.moeda(p.valor) + " por consulta"}`
    : "Gratuito";

  return `
    <div class="page-head">
      <div>
        <h2>${U.esc(p.nome)}</h2>
        <p>${idade !== null ? idade + " anos · " : ""}${esps.length ? "Acompanhamento em " + esps.join(", ") : "Sem atendimentos registrados ainda"}.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" data-action="voltarPacientes">&larr; Voltar</button>
        <button class="btn" data-action="novoAtendPaciente" data-id="${p.id}">+ Agendar atendimento</button>
        <button class="btn accent" data-action="editarPaciente" data-id="${p.id}">Editar cadastro</button>
      </div>
    </div>

    ${esps.length ? `
    <div class="panel">
      <h3>Especialidades que utiliza</h3>
      <p class="panel-sub">Cruzamento de dados deste paciente</p>
      <div class="cross-chips">${esps.map(AT.espChip).join("")}</div>
    </div>` : ""}

    <div class="panel">
      <h3>Histórico de atendimentos</h3>
      <p class="panel-sub">${ats.length} ${U.plural(ats.length, "registro", "registros")}</p>
      ${ats.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Especialidade</th><th>Profissional</th><th>Tipo</th><th>Status</th><th></th></tr></thead>
        <tbody>${linhasAt}</tbody>
      </table></div>` : `<div class="empty-note">Nenhum atendimento. Use <strong>+ Agendar atendimento</strong>.</div>`}
    </div>

    <div class="grid-2-even">
      <div class="panel">
        <h3>Dados pessoais</h3>
        <p class="panel-sub">Cadastro</p>
        <div class="detail-grid">
          ${item("CPF", U.esc(p.cpf))}
          ${item("RG", U.esc(p.rg))}
          ${item("Data de nascimento", p.nascimento ? U.fmtData(p.nascimento) + (idade !== null ? ` (${idade} anos)` : "") : "")}
          ${item("Sexo", U.esc(p.sexo))}
          ${item("Telefone", U.esc(p.telefone))}
          ${item("WhatsApp", U.esc(p.whatsapp))}
          ${item("E-mail", U.esc(p.email))}
          ${item("Endereço", U.esc([p.endereco, p.bairro, p.cidade].filter(Boolean).join(", ")))}
          ${item("Responsável", U.esc(p.responsavel))}
          ${item("Escolaridade", U.esc(p.escolaridade))}
          ${item("Escola", U.esc(p.escola))}
          ${item("Profissão", U.esc(p.profissao))}
          ${item("Estado civil", U.esc(p.estadoCivil))}
        </div>
      </div>
      <div class="panel">
        <h3>Dados sociais e financeiros</h3>
        <p class="panel-sub">Dados sensíveis — uso interno do instituto</p>
        <div class="detail-grid">
          ${item("Encaminhado por", U.esc(p.encaminhadoPor))}
          ${item("Situação socioeconômica", U.esc(p.situacaoSocio))}
          ${item("Benefícios sociais", U.esc(p.beneficios))}
          ${item("Atingido pelas enchentes", p.atingidoEnchente === "sim" ? "Sim" : p.atingidoEnchente === "nao" ? "Não" : "")}
          ${item("Impacto das enchentes", U.esc(p.impactoEnchentes))}
          ${item("Necessidades especiais", p.necessidadesEspeciais === "sim" ? "Sim" : p.necessidadesEspeciais === "nao" ? "Não" : "")}
          ${item("Descrição das necessidades", U.esc(p.necessidadesDesc))}
          ${item("Atendimento", financeiro)}
          ${item("Observações", U.esc(p.observacoes))}
        </div>
        ${(p.termos || []).length ? `
          <div style="margin-top:14px;">
            <div class="k" style="font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:6px;">Termos e documentos</div>
            <div class="cross-chips">${Anexos.links(p.termos)}</div>
          </div>` : ""}
      </div>
    </div>

    ${U.carimbo(p)}

    <div class="head-actions">
      <button class="btn danger" data-action="excluirPaciente" data-id="${p.id}">Excluir paciente</button>
    </div>
  `;
};

function abrirFormPaciente(p) {
  const optEnc = (() => {
    const opcoes = [...Store.config.encaminhamentos];
    if (p.encaminhadoPor && !opcoes.some(o => o.toLowerCase() === p.encaminhadoPor.toLowerCase())) opcoes.push(p.encaminhadoPor);
    return ['<option value="">— selecione —</option>']
      .concat(opcoes.map(o => `<option value="${U.esc(o)}" ${o === p.encaminhadoPor ? "selected" : ""}>${U.esc(o)}</option>`)).join("");
  })();

  App.abrirModal(p.id ? "Editar paciente" : "Novo paciente", `
    <form>
      <div class="form-grid">
        <div class="form-section">Dados pessoais</div>
        <div class="field full">
          <label for="fpc-nome">Nome completo *</label>
          <input id="fpc-nome" name="nome" required value="${U.esc(p.nome)}">
        </div>
        <div class="field">
          <label for="fpc-cpf">CPF</label>
          <input id="fpc-cpf" name="cpf" placeholder="000.000.000-00" value="${U.esc(p.cpf)}">
        </div>
        <div class="field">
          <label for="fpc-rg">RG</label>
          <input id="fpc-rg" name="rg" value="${U.esc(p.rg)}">
        </div>
        <div class="field">
          <label for="fpc-nasc">Data de nascimento</label>
          <input id="fpc-nasc" name="nascimento" type="date" value="${U.esc(p.nascimento)}">
        </div>
        <div class="field">
          <label for="fpc-sexo">Sexo</label>
          <select id="fpc-sexo" name="sexo">
            <option value="" ${!p.sexo ? "selected" : ""}>— selecione —</option>
            <option value="F" ${p.sexo === "F" ? "selected" : ""}>Feminino</option>
            <option value="M" ${p.sexo === "M" ? "selected" : ""}>Masculino</option>
            <option value="Outro" ${p.sexo === "Outro" ? "selected" : ""}>Outro</option>
          </select>
        </div>
        <div class="field">
          <label for="fpc-tel">Telefone</label>
          <input id="fpc-tel" name="telefone" value="${U.esc(p.telefone)}">
        </div>
        <div class="field">
          <label for="fpc-zap">WhatsApp</label>
          <input id="fpc-zap" name="whatsapp" value="${U.esc(p.whatsapp)}">
        </div>
        <div class="field full">
          <label for="fpc-email">E-mail</label>
          <input id="fpc-email" name="email" type="email" value="${U.esc(p.email)}">
        </div>
        <div class="field full">
          <label for="fpc-end">Endereço (rua e número)</label>
          <input id="fpc-end" name="endereco" value="${U.esc(p.endereco)}">
        </div>
        <div class="field">
          <label for="fpc-bairro">Bairro</label>
          <input id="fpc-bairro" name="bairro" value="${U.esc(p.bairro)}">
        </div>
        <div class="field">
          <label for="fpc-cidade">Cidade</label>
          <input id="fpc-cidade" name="cidade" value="${U.esc(p.cidade)}">
        </div>
        <div class="field">
          <label for="fpc-resp">Responsável (quando menor)</label>
          <input id="fpc-resp" name="responsavel" value="${U.esc(p.responsavel)}">
        </div>
        <div class="field">
          <label for="fpc-esc">Escolaridade</label>
          <input id="fpc-esc" name="escolaridade" value="${U.esc(p.escolaridade)}">
        </div>
        <div class="field">
          <label for="fpc-escola">Escola</label>
          <input id="fpc-escola" name="escola" value="${U.esc(p.escola)}">
        </div>
        <div class="field">
          <label for="fpc-prof">Profissão</label>
          <input id="fpc-prof" name="profissao" value="${U.esc(p.profissao)}">
        </div>
        <div class="field">
          <label for="fpc-civil">Estado civil</label>
          <input id="fpc-civil" name="estadoCivil" placeholder="ex.: Solteiro(a)" value="${U.esc(p.estadoCivil)}">
        </div>
        <div class="form-section">Dados sociais</div>
        <div class="field">
          <label for="fpc-enc">Encaminhado por</label>
          <select id="fpc-enc" name="encaminhadoPor">${optEnc}</select>
        </div>
        <div class="field">
          <label for="fpc-socio">Situação socioeconômica</label>
          <input id="fpc-socio" name="situacaoSocio" placeholder="ex.: Baixa renda" value="${U.esc(p.situacaoSocio)}">
        </div>
        <div class="field">
          <label for="fpc-benef">Recebe benefícios sociais?</label>
          <input id="fpc-benef" name="beneficios" placeholder="ex.: Bolsa Família, BPC" value="${U.esc(p.beneficios)}">
        </div>
        <div class="field">
          <label for="fpc-ne">É portador de necessidades especiais?</label>
          <select id="fpc-ne" name="necessidadesEspeciais">
            <option value="" ${!p.necessidadesEspeciais ? "selected" : ""}>Não informado</option>
            <option value="sim" ${p.necessidadesEspeciais === "sim" ? "selected" : ""}>Sim</option>
            <option value="nao" ${p.necessidadesEspeciais === "nao" ? "selected" : ""}>Não</option>
          </select>
        </div>
        <div class="field full">
          <label for="fpc-nedesc">Descreva as necessidades especiais</label>
          <textarea id="fpc-nedesc" name="necessidadesDesc" placeholder="Condição, apoios necessários, laudos, etc.">${U.esc(p.necessidadesDesc)}</textarea>
        </div>
        <div class="field">
          <label for="fpc-ench">Atingido pelas enchentes?</label>
          <select id="fpc-ench" name="atingidoEnchente">
            <option value="" ${!p.atingidoEnchente ? "selected" : ""}>Não informado</option>
            <option value="sim" ${p.atingidoEnchente === "sim" ? "selected" : ""}>Sim</option>
            <option value="nao" ${p.atingidoEnchente === "nao" ? "selected" : ""}>Não</option>
          </select>
        </div>
        <div class="field full">
          <label for="fpc-enchdet">Detalhes do impacto das enchentes</label>
          <textarea id="fpc-enchdet" name="impactoEnchentes">${U.esc(p.impactoEnchentes)}</textarea>
        </div>
        <div class="form-section">Financeiro</div>
        <div class="field">
          <label for="fpc-tipo">Tipo de atendimento</label>
          <select id="fpc-tipo" name="tipoAtendimento">
            <option value="gratuito" ${p.tipoAtendimento !== "pago" ? "selected" : ""}>Gratuito</option>
            <option value="pago" ${p.tipoAtendimento === "pago" ? "selected" : ""}>Pago</option>
          </select>
        </div>
        <div class="field">
          <label for="fpc-cob">Forma de cobrança</label>
          <select id="fpc-cob" name="cobranca" ${p.tipoAtendimento !== "pago" ? "disabled" : ""}>
            <option value="mensal" ${p.cobranca === "mensal" ? "selected" : ""}>Mensal</option>
            <option value="consulta" ${p.cobranca !== "mensal" ? "selected" : ""}>Por consulta</option>
          </select>
        </div>
        <div class="field">
          <label for="fpc-valor">Valor (R$)</label>
          <input id="fpc-valor" name="valor" type="number" min="0" step="0.01" value="${U.esc(p.valor || "")}" ${p.tipoAtendimento !== "pago" ? "disabled" : ""}>
        </div>
        <div class="field full">
          <label for="fpc-obs">Observações</label>
          <textarea id="fpc-obs" name="observacoes">${U.esc(p.observacoes)}</textarea>
        </div>
        ${Anexos.campoHTML("Termos e documentos (PDF)", "Termo de consentimento, contrato terapêutico, etc. Até 5 arquivos.")}
      </div>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-modal-action="cancelar">Cancelar</button>
        <button type="submit" class="btn accent">Salvar paciente</button>
      </div>
    </form>`, dados => {
    if (!dados.nome.trim()) return false;
    let salvo;
    try {
      salvo = Store.upsert("pacientes", {
        id: p.id || undefined, ...dados,
        /* o vínculo com o profissional não é campo do formulário — preservar
           aqui evita que uma edição desfaça o que a área dele criou */
        profissionalId: p.profissionalId || "",
        nome: dados.nome.trim(),
        cobranca: dados.tipoAtendimento === "pago" ? (dados.cobranca || "consulta") : "",
        valor: dados.tipoAtendimento === "pago" ? (Number(dados.valor) || 0) : 0,
        termos: Anexos.lista()
      });
    } catch (e) {
      alert("Não foi possível salvar: o armazenamento do navegador está cheio.\nRemova algum anexo e tente novamente.");
      return false;
    }
    U.toast("Paciente salvo.");
    if (!p.id) location.hash = "#/paciente/" + salvo.id;
    else App.render();
  }, p);
  Anexos.iniciar(p.termos, 5);
  Anexos.ligar();

  /* habilita/desabilita os campos financeiros conforme o tipo */
  const selTipo = document.getElementById("fpc-tipo");
  selTipo.addEventListener("change", () => {
    const pago = selTipo.value === "pago";
    document.getElementById("fpc-cob").disabled = !pago;
    document.getElementById("fpc-valor").disabled = !pago;
  });
}

Actions.novoPaciente = () => abrirFormPaciente({
  nome: "", cpf: "", rg: "", nascimento: "", sexo: "", endereco: "", bairro: "", cidade: "",
  telefone: "", whatsapp: "", email: "", responsavel: "", escolaridade: "", escola: "",
  profissao: "", estadoCivil: "", encaminhadoPor: "", situacaoSocio: "", beneficios: "",
  atingidoEnchente: "", impactoEnchentes: "", necessidadesEspeciais: "", necessidadesDesc: "",
  observacoes: "", tipoAtendimento: "gratuito", cobranca: "", valor: "", termos: [],
  profissionalId: ""
});
Actions.editarPaciente = id => abrirFormPaciente(Store.get("pacientes", id));
Actions.verPaciente = id => { location.hash = "#/paciente/" + id; };

/* de onde a ficha veio: da área do profissional ou de um link da agenda
   e dos relatórios, que é por onde a administração chega a um paciente */
function rotaListaPacientes() {
  return (typeof profLogado === "function" && profLogado())
    ? "#/atendimentos/meus-pacientes"
    : "#/atendimentos";
}
Actions.voltarPacientes = () => { location.hash = rotaListaPacientes(); };
Actions.excluirPaciente = id => {
  const p = Store.get("pacientes", id);
  if (confirm(`Excluir o paciente "${p.nome}"?\nO histórico de atendimentos dele também será removido.`)) {
    Store.remover("pacientes", id);
    U.toast("Paciente excluído.");
    location.hash = rotaListaPacientes();
  }
};

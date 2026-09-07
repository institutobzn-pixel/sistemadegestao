/* Camada de dados — localStorage.
   Estrutura pensada para migração futura a um banco (Cloudflare D1):
   cada coleção é uma "tabela" com ids, e as funções de consulta
   concentram as regras de negócio. */
"use strict";

const Store = (() => {
  const KEY = "bzn-painel-v1";

  const vazio = () => ({
    cursos: [],       // {id, nome, ementa, corIndex, status, modulos:[{nome, descricao, horas}],
                      //  modalidade: curso|workshop|palestra,
                      //  tipoCurso: gratuito|pago, valor, cobranca: mensal|unico,
                      //  fotos: [dataURL, ...] (até 8, comprimidas)}
    eventos: [],      // {id, titulo, tipo: curso|workshop|palestra|evento|reuniao|outro,
                      //  data, horaInicio, horaFim, sala, turmaId, responsavel, obs}
    lancamentos: [],  // financeiro — {id, data, descricao, valor (positivo=entrada, negativo=saída),
                      //  origem: sicoob|guru|manual, categoria, obs, chave (p/ evitar duplicados),
                      //  anexos: [{nome, dataUrl}] (notas fiscais/comprovantes)}

    /* módulo de assistência social */
    assistidos: [],   // mesmos dados dos pacientes + necessidades especiais e documentos
                      // {id, nome, cpf, rg, nascimento, sexo, endereco, bairro, cidade, telefone,
                      //  whatsapp, email, responsavel, escolaridade, escola, profissao, estadoCivil,
                      //  encaminhadoPor, situacaoSocio, beneficios, atingidoEnchente, impactoEnchentes,
                      //  necessidadesEspeciais: sim|nao|"", necessidadesDesc, observacoes,
                      //  documentos: [{nome, dataUrl}]}
    listaEspera: [],  // {id, nome, telefone, area, dataEntrada, obs,
                      //  status: aguardando|chamado|atendido|desistiu}
    compromissosAS: [],// agenda interna — {id, data, hora, titulo, assistidoId, responsavel, obs,
                      //  status: agendado|realizado|cancelado}
    legislacaoAS: [], // {id, titulo, tipo: link|arquivo, url, arquivo:{nome,dataUrl}, obs}
    profsociais: [],  // equipe da assistência social — {id, nome, funcao, cress, formacao,
                      //  telefone, email, dias, horarios, documentos:[{nome,dataUrl}], obs}
    documentos: [],   // {id, categoria: documento|formulario, titulo, assunto, data,
                      //  tipo: arquivo|link, arquivo:{nome,dataUrl}, url}
    linksImagens: [], // {id, assunto, titulo, url, obs}
    professores: [],  // {id, nome, telefone, email, formacao, experiencia, nascimento, cpf, cnpj,
                      //  endereco, bairro, cidade, cep, pix, dataInicio, arquivos:[{nome, dataUrl}], pinHash}
    equipe: [],       // funcionários e colaboradores — {id, nome, tipo: funcionario|colaborador, funcao,
                      //  telefone, email, nascimento, cpf, cnpj, endereco, bairro, cidade, cep,
                      //  pix, dataInicio, arquivos:[{nome, dataUrl}], observacoes}
    turmas: [],       // {id, cursoId, professorId, nome, dataInicio, dataFim, horario, local, vagas, status}
    alunos: [],       // {id, nome, nascimento, cpf, telefone, email, endereco, bairro, cidade, cep,
                      //  responsavel, encaminhamento, atingidoEnchente, impactoEnchentes, rendaFamiliar,
                      //  beneficios, moradiaAtual, necessidades, observacoes}
    matriculas: [],   // {id, alunoId, turmaId, status: cursando|concluido|trancado|desistente, data,
                      //  bolsa: true|false (bolsista em curso pago)}
    chamadas: [],     // {id, turmaId, data, conteudo, presencas: {alunoId: true|false}}

    /* módulo de atendimentos clínicos */
    pacientes: [],    // {id, nome, cpf, rg, nascimento, sexo, endereco, bairro, cidade, telefone,
                      //  whatsapp, email, responsavel, escolaridade, escola, profissao, estadoCivil,
                      //  encaminhadoPor, situacaoSocio, beneficios, observacoes,
                      //  atingidoEnchente: sim|nao|"", impactoEnchentes,
                      //  tipoAtendimento: gratuito|pago, cobranca: mensal|consulta, valor}
    profsaude: [],    // {id, nome, especialidade, crp, crm, registro, dias, horarios, telefone, email}
    atendimentos: [], // {id, data, hora, pacienteId, profissionalId, especialidade,
                      //  tipoConsulta: primeira|retorno, formato: individual|grupo,
                      //  modalidade: presencial|online,
                      //  status: agendado|confirmado|realizado|faltou|cancelado, obs}

    config: {
      presencaMinima: 75,
      encaminhamentos: ["Demanda espontânea", "CRAS", "Escolas"],
      especialidades: ["Psicologia", "Psiquiatria", "Neuropsicopedagogia"],
      salas: ["Sala 1", "Sala 2", "Sala 3", "Sala 4", "Sala 5", "Auditório", "Hall Superior", "Hall de Entrada"]
    }
  });

  let db = null;

  function carregar() {
    try {
      const raw = localStorage.getItem(KEY);
      db = raw ? Object.assign(vazio(), JSON.parse(raw)) : vazio();
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      db = vazio();
    }
    if (db.cursos.length === 0 && !localStorage.getItem(KEY)) {
      seedCursos();
    }
    carregarMigracoes();
  }

  // migrações leves para backups/dados antigos/dados vindos da nuvem
  function carregarMigracoes() {
    if (!db.config) db.config = {};
    if (db.config.presencaMinima == null) db.config.presencaMinima = 75;
    if (!Array.isArray(db.config.encaminhamentos) || !db.config.encaminhamentos.length) {
      db.config.encaminhamentos = ["Demanda espontânea", "CRAS", "Escolas"];
    }
    if (!Array.isArray(db.config.especialidades) || !db.config.especialidades.length) {
      db.config.especialidades = ["Psicologia", "Psiquiatria", "Neuropsicopedagogia"];
    }
    if (!Array.isArray(db.pacientes)) db.pacientes = [];
    if (!Array.isArray(db.profsaude)) db.profsaude = [];
    if (!Array.isArray(db.atendimentos)) db.atendimentos = [];
    if (!Array.isArray(db.eventos)) db.eventos = [];
    if (!Array.isArray(db.equipe)) db.equipe = [];
    if (!Array.isArray(db.lancamentos)) db.lancamentos = [];
    if (!Array.isArray(db.assistidos)) db.assistidos = [];
    if (!Array.isArray(db.listaEspera)) db.listaEspera = [];
    if (!Array.isArray(db.compromissosAS)) db.compromissosAS = [];
    if (!Array.isArray(db.legislacaoAS)) db.legislacaoAS = [];
    if (!Array.isArray(db.profsociais)) db.profsociais = [];
    if (!Array.isArray(db.config.areasEspera) || !db.config.areasEspera.length) {
      db.config.areasEspera = [...db.config.especialidades, "Assistência Social", "Cursos"];
    }
    if (!Array.isArray(db.config.categoriasFin) || !db.config.categoriasFin.length) {
      db.config.categoriasFin = ["Doações", "Mensalidades", "Vendas Guru", "Subvenções",
        "Aluguel", "Materiais", "Pessoal", "Contas (luz, água, internet)", "Outros"];
    }
    if (!Array.isArray(db.documentos)) db.documentos = [];
    if (!Array.isArray(db.linksImagens)) db.linksImagens = [];
    if (!Array.isArray(db.config.salas) || !db.config.salas.length) {
      db.config.salas = ["Sala 1", "Sala 2", "Sala 3", "Sala 4", "Sala 5", "Auditório", "Hall Superior", "Hall de Entrada"];
    }
  }

  /* senhas de acesso por nível (organizacional — os dados seguem no navegador)
     admin: gerencia tudo, inclusive as senhas; secretaria: operação completa;
     usuario: visualização básica. A senha antiga (senhaGeralHash) vira a de admin. */
  const CAMPO_SENHA = { admin: "senhaGeralHash", presidente: "senhaPresidenteHash", secretaria: "senhaSecretariaHash" };

  function temSenha(nivel) { return !!db.config[CAMPO_SENHA[nivel]]; }
  function definirSenha(nivel, senha) {
    db.config[CAMPO_SENHA[nivel]] = U.hashPin(String(senha));
    salvar();
  }
  function removerSenha(nivel) {
    delete db.config[CAMPO_SENHA[nivel]];
    salvar();
  }
  function conferirSenha(nivel, senha) {
    return temSenha(nivel) && U.hashPin(String(senha)) === db.config[CAMPO_SENHA[nivel]];
  }
  /* ---------- contas de e-mail (Supabase Auth) ----------
     A conta autentica no Supabase; o papel dela é definido aqui, pelo
     administrador. Guardado no config, então sincroniza junto com o resto. */
  function contas() {
    if (!Array.isArray(db.config.contas)) db.config.contas = [];
    return db.config.contas;
  }
  const normEmail = e => String(e || "").trim().toLowerCase();

  function contaPorEmail(email) {
    const e = normEmail(email);
    return contas().find(c => normEmail(c.email) === e) || null;
  }

  function salvarConta(c) {
    const lista = contas();
    const e = normEmail(c.email);
    if (!e) throw new Error("E-mail obrigatório.");
    const i = lista.findIndex(x => normEmail(x.email) === e);
    const registro = {
      email: e,
      nome: String(c.nome || "").trim(),
      papel: c.papel || "secretaria",
      profsaudeId: c.profsaudeId || "",
      professorId: c.professorId || ""
    };
    if (i >= 0) lista[i] = registro; else lista.push(registro);
    salvar();
    return registro;
  }

  function removerConta(email) {
    const e = normEmail(email);
    db.config.contas = contas().filter(c => normEmail(c.email) !== e);
    salvar();
  }

  /* pergunta de segurança — protege a recuperação da senha do admin.
     A resposta é guardada como hash, normalizada (minúsculas, sem acentos/espaços). */
  function normalizaResposta(s) {
    return String(s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  }
  function temPerguntaSeguranca() { return !!(db.config.perguntaSeg && db.config.respostaSegHash); }
  function perguntaSeguranca() { return db.config.perguntaSeg || ""; }
  function definirPerguntaSeguranca(pergunta, resposta) {
    db.config.perguntaSeg = String(pergunta || "").trim();
    db.config.respostaSegHash = U.hashPin(normalizaResposta(resposta));
    salvar();
  }
  function conferirResposta(resposta) {
    return temPerguntaSeguranca() && U.hashPin(normalizaResposta(resposta)) === db.config.respostaSegHash;
  }

  /* compatibilidade com chamadas antigas */
  function temSenhaGeral() { return temSenha("admin"); }
  function definirSenhaGeral(senha) { definirSenha("admin", senha); }
  function conferirSenhaGeral(senha) { return conferirSenha("admin", senha); }

  /* ---------- assistência social ---------- */

  function temPinAssistencia() { return !!db.config.pinAssistenciaHash; }
  function definirPinAssistencia(pin) {
    db.config.pinAssistenciaHash = U.hashPin(String(pin));
    salvar();
  }
  function conferirPinAssistencia(pin) {
    return temPinAssistencia() && U.hashPin(String(pin)) === db.config.pinAssistenciaHash;
  }

  function addAreaEspera(nome) {
    const n = String(nome || "").trim();
    if (!n) return false;
    if (!db.config.areasEspera.some(x => x.toLowerCase() === n.toLowerCase())) {
      db.config.areasEspera.push(n);
      salvar();
    }
    return n;
  }

  /* lista de espera agrupada por área, em ordem de chegada */
  function esperaPorArea() {
    const grupos = new Map();
    const aguardando = db.listaEspera
      .filter(e => e.status === "aguardando" || e.status === "chamado")
      .sort((a, b) => (a.dataEntrada || "").localeCompare(b.dataEntrada || ""));
    for (const e of aguardando) {
      const area = e.area || "Sem área";
      if (!grupos.has(area)) grupos.set(area, []);
      grupos.get(area).push(e);
    }
    return grupos;
  }

  /* ---------- financeiro ---------- */

  /* PIN do gestor financeiro (definido pelo admin) */
  function temPinFinanceiro() { return !!db.config.pinFinanceiroHash; }
  function definirPinFinanceiro(pin) {
    db.config.pinFinanceiroHash = U.hashPin(String(pin));
    salvar();
  }
  function conferirPinFinanceiro(pin) {
    return temPinFinanceiro() && U.hashPin(String(pin)) === db.config.pinFinanceiroHash;
  }

  function addCategoriaFin(nome) {
    const n = String(nome || "").trim();
    if (!n) return false;
    if (!db.config.categoriasFin.some(x => x.toLowerCase() === n.toLowerCase())) {
      db.config.categoriasFin.push(n);
      salvar();
    }
    return n;
  }

  /* chave de deduplicação de um lançamento */
  function chaveLancamento(l) {
    return [l.data, String(l.valor), (l.descricao || "").trim().toLowerCase().slice(0, 60)].join("|");
  }

  /* importa uma lista de lançamentos, pulando os que já existem */
  function importarLancamentos(lista, origem) {
    const existentes = new Set(db.lancamentos.map(l => l.chave || chaveLancamento(l)));
    let novos = 0, pulados = 0;
    for (const l of lista) {
      const chave = chaveLancamento(l);
      if (existentes.has(chave)) { pulados++; continue; }
      existentes.add(chave);
      db.lancamentos.push({
        id: U.uid(), data: l.data, descricao: l.descricao, valor: l.valor,
        origem: origem || l.origem || "manual",
        categoria: l.categoria || (origem === "guru" ? "Vendas Guru" : ""),
        obs: l.obs || "", chave
      });
      novos++;
    }
    salvar();
    return { novos, pulados };
  }

  /* resumo por período (anoMes "2026-07" ou ano "2026"; vazio = tudo) */
  function resumoFin(prefixo) {
    const lan = db.lancamentos.filter(l => !prefixo || (l.data || "").startsWith(prefixo));
    let entradas = 0, saidas = 0;
    const porCategoria = new Map();
    const porMes = new Map();
    for (const l of lan) {
      const v = Number(l.valor) || 0;
      if (v >= 0) entradas += v; else saidas += -v;
      const cat = l.categoria || "Sem categoria";
      porCategoria.set(cat, (porCategoria.get(cat) || 0) + v);
      const mes = (l.data || "").slice(0, 7);
      const m = porMes.get(mes) || { entradas: 0, saidas: 0 };
      if (v >= 0) m.entradas += v; else m.saidas += -v;
      porMes.set(mes, m);
    }
    return {
      lancamentos: lan.sort((a, b) => (b.data || "").localeCompare(a.data || "")),
      entradas, saidas, saldo: entradas - saidas,
      porCategoria: [...porCategoria.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])),
      porMes: [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    };
  }

  function anosFin() {
    const anos = new Set(db.lancamentos.map(l => (l.data || "").slice(0, 4)).filter(Boolean));
    anos.add(String(new Date().getFullYear()));
    return [...anos].sort();
  }

  function addSala(nome) {
    const n = String(nome || "").trim();
    if (!n) return false;
    if (!db.config.salas.some(x => x.toLowerCase() === n.toLowerCase())) {
      db.config.salas.push(n);
      salvar();
    }
    return n;
  }

  /* anos disponíveis na agenda: de 2025 até o maior ano com evento (ou o atual) + 1,
     assim os próximos anos vão surgindo automaticamente */
  function anosAgenda() {
    const atual = new Date().getFullYear();
    let max = atual;
    for (const e of db.eventos) {
      const a = Number((e.data || "").slice(0, 4));
      if (a > max) max = a;
    }
    const anos = [];
    for (let a = 2025; a <= max + 1; a++) anos.push(a);
    return anos;
  }

  /* eventos de um ano, ordenados por data/hora */
  function eventosDoAno(ano) {
    return db.eventos
      .filter(e => (e.data || "").startsWith(String(ano)))
      .sort((x, y) => (x.data + (x.horaInicio || "")).localeCompare(y.data + (y.horaInicio || "")));
  }

  /* conflito de sala: mesmo local, mesma data e horários sobrepostos */
  function conflitoSala(evento) {
    if (!evento.sala || !evento.data) return null;
    for (const e of db.eventos) {
      if (e.id === evento.id || e.sala !== evento.sala || e.data !== evento.data) continue;
      const ini1 = evento.horaInicio || "00:00", fim1 = evento.horaFim || "23:59";
      const ini2 = e.horaInicio || "00:00", fim2 = e.horaFim || "23:59";
      if (ini1 < fim2 && ini2 < fim1) return e;
    }
    return null;
  }

  function addEspecialidade(nome) {
    const n = String(nome || "").trim();
    if (!n) return false;
    if (!db.config.especialidades.some(x => x.toLowerCase() === n.toLowerCase())) {
      db.config.especialidades.push(n);
      salvar();
    }
    return n;
  }

  /* mantém as opções de encaminhamento sempre atualizadas com o que já foi usado */
  function addEncaminhamento(nome) {
    const n = String(nome || "").trim();
    if (!n) return false;
    if (!db.config.encaminhamentos.some(x => x.toLowerCase() === n.toLowerCase())) {
      db.config.encaminhamentos.push(n);
      db.config.encaminhamentos.sort((a, b) => a.localeCompare(b, "pt-BR"));
      salvar();
    }
    return n;
  }

  function gravarLocal() {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function salvar() {
    gravarLocal();
    // sincroniza com a nuvem, se configurada (não bloqueia a interface)
    if (typeof Nuvem !== "undefined" && Nuvem.configurada()) Nuvem.agendarEnvio();
  }

  /* devolve uma cópia dos dados atuais (para enviar à nuvem/backup) */
  function snapshot() {
    return JSON.parse(JSON.stringify(db));
  }

  /* substitui todos os dados pelos vindos da nuvem, SEM reenviar à nuvem
     (evita laço de sincronização). Grava apenas no navegador. */
  function aplicarRemoto(dados) {
    if (!dados || typeof dados !== "object") return;
    db = Object.assign(vazio(), dados);
    carregarMigracoes();
    gravarLocal();
  }

  /* Os 5 cursos iniciais do instituto */
  function seedCursos() {
    const nomes = [
      ["Empreendedorismo Resiliente", 1],
      ["Gestão Financeira para Empreendedores", 2],
      ["Social Media", 3],
      ["Educação Financeira", 4],
      ["Maquiagem Profissional", 5]
    ];
    db.cursos = nomes.map(([nome, corIndex]) => ({
      id: U.uid(), nome, ementa: "", corIndex, status: "ativo", modulos: [],
      modalidade: "curso", tipoCurso: "gratuito", valor: 0, cobranca: ""
    }));
    salvar();
  }

  /* ---------- CRUD genérico ---------- */
  const col = nome => db[nome];
  const get = (nome, id) => db[nome].find(x => x.id === id) || null;

  /* Carimbo de autoria: quem cadastrou e quem alterou por último.
     É registro de boa-fé para o trabalho do dia a dia — como tudo roda no
     navegador, não serve como prova contra adulteração. */
  function upsert(nome, obj) {
    const ator = U.atorAtual();
    const agora = U.agoraISO();
    if (obj.id) {
      const i = db[nome].findIndex(x => x.id === obj.id);
      if (i >= 0) {
        const anterior = db[nome][i];
        db[nome][i] = {
          ...anterior, ...obj,
          /* a criação é do registro, não desta edição */
          criadoPor: anterior.criadoPor || obj.criadoPor || "",
          criadoEm: anterior.criadoEm || obj.criadoEm || "",
          alteradoPor: ator, alteradoEm: agora
        };
        obj = db[nome][i];
      } else {
        db[nome].push(Object.assign(obj, { criadoPor: ator, criadoEm: agora }));
      }
    } else {
      obj.id = U.uid();
      obj.criadoPor = ator;
      obj.criadoEm = agora;
      db[nome].push(obj);
    }
    salvar();
    return obj;
  }

  function remover(nome, id) {
    db[nome] = db[nome].filter(x => x.id !== id);
    // integridade referencial simples
    if (nome === "cursos") {
      const turmasDoCurso = db.turmas.filter(t => t.cursoId === id).map(t => t.id);
      db.turmas = db.turmas.filter(t => t.cursoId !== id);
      db.matriculas = db.matriculas.filter(m => !turmasDoCurso.includes(m.turmaId));
      db.chamadas = db.chamadas.filter(c => !turmasDoCurso.includes(c.turmaId));
    }
    if (nome === "turmas") {
      db.matriculas = db.matriculas.filter(m => m.turmaId !== id);
      db.chamadas = db.chamadas.filter(c => c.turmaId !== id);
    }
    if (nome === "alunos") {
      db.matriculas = db.matriculas.filter(m => m.alunoId !== id);
      db.chamadas.forEach(c => { delete c.presencas[id]; });
    }
    if (nome === "professores") {
      db.turmas.forEach(t => { if (t.professorId === id) t.professorId = ""; });
    }
    if (nome === "pacientes") {
      db.atendimentos = db.atendimentos.filter(a => a.pacienteId !== id);
    }
    if (nome === "profsaude") {
      db.atendimentos.forEach(a => { if (a.profissionalId === id) a.profissionalId = ""; });
    }
    salvar();
  }

  /* ---------- consultas de negócio ---------- */

  function cargaHoraria(curso) {
    return (curso.modulos || []).reduce((s, m) => s + (Number(m.horas) || 0), 0);
  }

  function matriculasDaTurma(turmaId) {
    return db.matriculas.filter(m => m.turmaId === turmaId);
  }

  function matriculasDoAluno(alunoId) {
    return db.matriculas.filter(m => m.alunoId === alunoId);
  }

  function cursoDaTurma(turmaId) {
    const t = get("turmas", turmaId);
    return t ? get("cursos", t.cursoId) : null;
  }

  /* cursos distintos que o aluno fez/faz (cruzamento de dados) */
  function cursosDoAluno(alunoId) {
    const ids = new Set();
    const out = [];
    for (const m of matriculasDoAluno(alunoId)) {
      const c = cursoDaTurma(m.turmaId);
      if (c && !ids.has(c.id)) { ids.add(c.id); out.push({ curso: c, matricula: m }); }
    }
    return out;
  }

  /* presença de um aluno numa turma: {presentes, total, pct} */
  function presencaAluno(turmaId, alunoId) {
    const cs = db.chamadas.filter(c => c.turmaId === turmaId && alunoId in c.presencas);
    const total = cs.length;
    const presentes = cs.filter(c => c.presencas[alunoId]).length;
    return { presentes, total, pct: total ? Math.round((presentes / total) * 100) : null };
  }

  function presencaMediaTurma(turmaId) {
    const ms = matriculasDaTurma(turmaId);
    const pcts = ms.map(m => presencaAluno(turmaId, m.alunoId).pct).filter(p => p !== null);
    if (!pcts.length) return null;
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  function presencaMediaGeral() {
    const pcts = db.turmas.map(t => presencaMediaTurma(t.id)).filter(p => p !== null);
    if (!pcts.length) return null;
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  /* alunos abaixo da frequência mínima em turmas em andamento */
  function alunosEmRisco() {
    const min = db.config.presencaMinima;
    const out = [];
    for (const t of db.turmas.filter(t => t.status === "em andamento")) {
      for (const m of matriculasDaTurma(t.id).filter(m => m.status === "cursando")) {
        const p = presencaAluno(t.id, m.alunoId);
        if (p.pct !== null && p.pct < min) {
          out.push({ aluno: get("alunos", m.alunoId), turma: t, curso: get("cursos", t.cursoId), pct: p.pct });
        }
      }
    }
    return out;
  }

  /* contagem de alunos (matrículas únicas por aluno) por curso */
  function alunosPorCurso() {
    return db.cursos.map(c => {
      const turmaIds = db.turmas.filter(t => t.cursoId === c.id).map(t => t.id);
      const alunos = new Set(db.matriculas.filter(m => turmaIds.includes(m.turmaId)).map(m => m.alunoId));
      return { curso: c, qtd: alunos.size };
    });
  }

  /* alunos com 2+ cursos distintos e combinações mais comuns */
  function cruzamento() {
    const multi = [];
    const combos = new Map();
    for (const a of db.alunos) {
      const cs = cursosDoAluno(a.id);
      if (cs.length >= 2) {
        multi.push({ aluno: a, cursos: cs });
        const nomes = cs.map(x => x.curso.nome).sort((x, y) => x.localeCompare(y, "pt-BR"));
        for (let i = 0; i < nomes.length; i++) {
          for (let j = i + 1; j < nomes.length; j++) {
            const k = nomes[i] + " + " + nomes[j];
            combos.set(k, (combos.get(k) || 0) + 1);
          }
        }
      }
    }
    multi.sort((x, y) => y.cursos.length - x.cursos.length);
    const combosOrd = [...combos.entries()].sort((a, b) => b[1] - a[1]);
    return { multi, combos: combosOrd };
  }

  function resumo() {
    const ativas = db.matriculas.filter(m => m.status === "cursando").length;
    const porStatus = { cursando: 0, concluido: 0, trancado: 0, desistente: 0 };
    db.matriculas.forEach(m => { if (m.status in porStatus) porStatus[m.status]++; });
    return {
      alunosUnicos: db.alunos.length,
      matriculasAtivas: ativas,
      totalMatriculas: db.matriculas.length,
      porStatus,
      presencaMedia: presencaMediaGeral(),
      cursosAtivos: db.cursos.filter(c => c.status === "ativo").length,
      turmasAndamento: db.turmas.filter(t => t.status === "em andamento").length
    };
  }

  /* ---------- consultas para gráficos ---------- */

  /* presença média por turma, com curso e cor */
  function presencaPorTurma() {
    return db.turmas.map(t => {
      const c = get("cursos", t.cursoId);
      return { turma: t, curso: c, media: presencaMediaTurma(t.id), alunos: matriculasDaTurma(t.id).length };
    });
  }

  /* nº de alunos distintos por professor (via turmas que leciona) */
  function alunosPorProfessor() {
    return db.professores.map(p => {
      const turmaIds = db.turmas.filter(t => t.professorId === p.id).map(t => t.id);
      const alunos = new Set(db.matriculas.filter(m => turmaIds.includes(m.turmaId)).map(m => m.alunoId));
      return { professor: p, qtd: alunos.size, turmas: turmaIds.length };
    });
  }

  /* evolução da frequência (% presentes) aula a aula, numa turma */
  function evolucaoFrequencia(turmaId) {
    return db.chamadas
      .filter(c => c.turmaId === turmaId)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(c => {
        const total = Object.keys(c.presencas).length;
        const pres = Object.values(c.presencas).filter(Boolean).length;
        return { data: c.data, conteudo: c.conteudo, pct: total ? Math.round((pres / total) * 100) : 0, pres, total };
      });
  }

  /* alunos por origem de encaminhamento */
  function porEncaminhamento() {
    const cont = new Map();
    db.config.encaminhamentos.forEach(o => cont.set(o, 0));
    let semInfo = 0;
    for (const a of db.alunos) {
      const e = (a.encaminhamento || "").trim();
      if (!e) { semInfo++; continue; }
      cont.set(e, (cont.get(e) || 0) + 1);
    }
    const out = [...cont.entries()].map(([nome, qtd]) => ({ nome, qtd }));
    if (semInfo) out.push({ nome: "Não informado", qtd: semInfo, semInfo: true });
    return out;
  }

  /* atingidos pelas enchentes numa lista de pessoas (alunos ou pacientes) */
  function contarEnchente(lista) {
    let sim = 0, nao = 0, semInfo = 0;
    for (const a of lista) {
      const v = a.atingidoEnchente || (a.impactoEnchentes && a.impactoEnchentes.trim() ? "sim" : "");
      if (v === "sim") sim++;
      else if (v === "nao") nao++;
      else semInfo++;
    }
    return { sim, nao, semInfo, total: lista.length };
  }

  /* alunos atingidos pelas enchentes */
  function porImpactoEnchente() {
    return contarEnchente(db.alunos);
  }

  /* ---------- visão geral do instituto (todas as áreas) ---------- */

  /* enchente somando alunos dos cursos + pacientes dos atendimentos */
  function enchenteGeral() {
    const alunos = contarEnchente(db.alunos);
    const pacientes = contarEnchente(db.pacientes);
    return {
      alunos, pacientes,
      sim: alunos.sim + pacientes.sim,
      nao: alunos.nao + pacientes.nao,
      semInfo: alunos.semInfo + pacientes.semInfo,
      total: alunos.total + pacientes.total
    };
  }

  /* encaminhamentos somando as duas áreas */
  function encaminhamentoGeral() {
    const cont = new Map();
    db.config.encaminhamentos.forEach(o => cont.set(o, 0));
    let semInfo = 0;
    const registrar = e => {
      const v = (e || "").trim();
      if (!v) { semInfo++; return; }
      cont.set(v, (cont.get(v) || 0) + 1);
    };
    db.alunos.forEach(a => registrar(a.encaminhamento));
    db.pacientes.forEach(p => registrar(p.encaminhadoPor));
    const out = [...cont.entries()].map(([nome, qtd]) => ({ nome, qtd })).filter(x => x.qtd > 0);
    out.sort((a, b) => b.qtd - a.qtd);
    if (semInfo) out.push({ nome: "Não informado", qtd: semInfo, semInfo: true });
    return out;
  }

  /* condição do aluno nos cursos: apenas gratuito ou pago.
     Quem cursa qualquer curso pago conta como "pago" (bolsistas incluídos). */
  function condicaoAluno(alunoId) {
    for (const m of matriculasDoAluno(alunoId)) {
      const c = cursoDaTurma(m.turmaId);
      if (c && c.tipoCurso === "pago") return "pago";
    }
    return "gratuito";
  }

  /* gratuidade em todas as áreas: cursos (gratuitos × pagos, bolsistas contam
     como pagos) + atendimentos (pacientes gratuitos × pagos) */
  function resumoGratuidade() {
    const cond = { gratuito: [], pago: [] };
    db.alunos.forEach(a => cond[condicaoAluno(a.id)].push(a));
    const bolsistas = new Set(
      db.matriculas.filter(m => m.bolsa).map(m => m.alunoId)).size;

    const pacGratuitos = db.pacientes.filter(p => p.tipoAtendimento !== "pago");
    const pacPagos = db.pacientes.length - pacGratuitos.length;
    const idsGratuitos = new Set(pacGratuitos.map(p => p.id));
    const atGratuitos = db.atendimentos.filter(a => idsGratuitos.has(a.pacienteId));

    const cursosGratuitos = db.cursos.filter(c => c.tipoCurso !== "pago").length;
    const cursosPagos = db.cursos.length - cursosGratuitos;

    return {
      alunosGratuitos: cond.gratuito.length,
      alunosPagos: cond.pago.length,
      alunosBolsistas: bolsistas,
      cursosGratuitos, cursosPagos,
      pacGratuitos: pacGratuitos.length,
      pacPagos,
      pessoasGratuitas: cond.gratuito.length + pacGratuitos.length,
      atendimentosGratuitos: atGratuitos.length,
      atGratuitosPorEspecialidade: contarPor(atGratuitos, "especialidade"),
      enchenteGratuitos: contarEnchente([...cond.gratuito, ...pacGratuitos])
    };
  }

  /* aniversariantes de um mês (1-12), em todas as áreas do instituto */
  function aniversariantes(mes) {
    const out = [];
    const junta = (lista, origem) => {
      for (const p of lista) {
        const n = p.nascimento;
        if (!n || Number(n.slice(5, 7)) !== mes) continue;
        out.push({ nome: p.nome, origem, dia: Number(n.slice(8, 10)), nascimento: n });
      }
    };
    junta(db.alunos, "Aluno");
    junta(db.professores, "Professor");
    junta(db.profsaude, "Profissional de saúde");
    junta(db.equipe, "Equipe");
    junta(db.pacientes, "Paciente");
    return out.sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
  }

  /* ---------- consultas do módulo de atendimentos ---------- */

  function atendimentosDoPaciente(pacienteId) {
    return db.atendimentos
      .filter(a => a.pacienteId === pacienteId)
      .sort((a, b) => (b.data + (b.hora || "")).localeCompare(a.data + (a.hora || "")));
  }

  /* especialidades distintas que o paciente já usou (cruzamento) */
  function especialidadesDoPaciente(pacienteId) {
    const set = new Set();
    for (const a of atendimentosDoPaciente(pacienteId)) {
      if (a.especialidade) set.add(a.especialidade);
    }
    return [...set];
  }

  /* pacientes com 2+ especialidades e combinações mais comuns */
  function cruzamentoAtendimentos() {
    const multi = [];
    const combos = new Map();
    for (const p of db.pacientes) {
      const es = especialidadesDoPaciente(p.id);
      if (es.length >= 2) {
        multi.push({ paciente: p, especialidades: es });
        const ord = [...es].sort((x, y) => x.localeCompare(y, "pt-BR"));
        for (let i = 0; i < ord.length; i++) {
          for (let j = i + 1; j < ord.length; j++) {
            const k = ord[i] + " + " + ord[j];
            combos.set(k, (combos.get(k) || 0) + 1);
          }
        }
      }
    }
    multi.sort((x, y) => y.especialidades.length - x.especialidades.length);
    return { multi, combos: [...combos.entries()].sort((a, b) => b[1] - a[1]) };
  }

  function contarPor(lista, campo) {
    const m = new Map();
    lista.forEach(x => {
      const k = x[campo] || "—";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
  }

  function resumoAtendimentos() {
    const hoje = U.hojeISO();
    const at = db.atendimentos;
    const porStatus = { agendado: 0, confirmado: 0, realizado: 0, faltou: 0, cancelado: 0 };
    at.forEach(a => { if (a.status in porStatus) porStatus[a.status]++; });
    const realizados = porStatus.realizado;
    const faltas = porStatus.faltou;
    const taxaFalta = (realizados + faltas) ? Math.round((faltas / (realizados + faltas)) * 100) : null;
    return {
      pacientes: db.pacientes.length,
      profissionais: db.profsaude.length,
      total: at.length,
      hoje: at.filter(a => a.data === hoje && !["cancelado"].includes(a.status)).length,
      proximos: at.filter(a => a.data >= hoje && ["agendado", "confirmado"].includes(a.status)).length,
      porStatus, taxaFalta,
      porEspecialidade: contarPor(at, "especialidade"),
      porModalidade: contarPor(at.filter(a => a.modalidade), "modalidade"),
      porTipo: contarPor(at.filter(a => a.tipoConsulta), "tipoConsulta"),
      porFormato: contarPor(at.filter(a => a.formato), "formato")
    };
  }

  function atendimentosPorProfissional() {
    return db.profsaude.map(p => ({
      profissional: p,
      qtd: db.atendimentos.filter(a => a.profissionalId === p.id).length,
      realizados: db.atendimentos.filter(a => a.profissionalId === p.id && a.status === "realizado").length
    })).sort((a, b) => b.qtd - a.qtd);
  }

  /* financeiro dos cursos pagos: pagantes, bolsistas e receita prevista */
  function resumoFinanceiroCursos() {
    const porCurso = [];
    let receitaMensal = 0, receitaUnica = 0;
    for (const c of db.cursos.filter(c => c.tipoCurso === "pago")) {
      const turmaIds = db.turmas.filter(t => t.cursoId === c.id).map(t => t.id);
      const mats = db.matriculas.filter(m => turmaIds.includes(m.turmaId) && m.status !== "desistente");
      const bolsistas = mats.filter(m => m.bolsa).length;
      const pagantes = mats.length - bolsistas;
      const valor = Number(c.valor) || 0;
      const previsto = valor * pagantes;
      if (c.cobranca === "mensal") receitaMensal += previsto;
      else receitaUnica += previsto;
      porCurso.push({ curso: c, pagantes, bolsistas, valor, previsto });
    }
    return { porCurso, receitaMensal, receitaUnica, total: receitaMensal + receitaUnica };
  }

  /* financeiro: pagantes, gratuitos e receita estimada */
  function resumoFinanceiro() {
    const pagantes = db.pacientes.filter(p => p.tipoAtendimento === "pago");
    const gratuitos = db.pacientes.length - pagantes.length;
    let mensal = 0, porConsultaMes = 0;
    const mesAtual = U.hojeISO().slice(0, 7);
    for (const p of pagantes) {
      const v = Number(p.valor) || 0;
      if (p.cobranca === "mensal") mensal += v;
      else {
        const realizadosMes = db.atendimentos.filter(a =>
          a.pacienteId === p.id && a.status === "realizado" && a.data.startsWith(mesAtual)).length;
        porConsultaMes += v * realizadosMes;
      }
    }
    return { pagantes: pagantes.length, gratuitos, mensal, porConsultaMes, previstoMes: mensal + porConsultaMes };
  }

  /* ---------- backup ---------- */
  function exportarJSON() {
    return JSON.stringify(db, null, 2);
  }

  function importarJSON(texto) {
    const dados = JSON.parse(texto);
    if (!dados || !Array.isArray(dados.cursos) || !Array.isArray(dados.alunos)) {
      throw new Error("Arquivo não parece ser um backup válido do painel.");
    }
    db = Object.assign(vazio(), dados);
    salvar();
  }

  /* ---------- dados de demonstração ---------- */
  function carregarDemo() {
    const pinProfDemo = U.hashPin("1234"); // PIN dos professores de exemplo: 1234
    const profs = [
      { nome: "Carlos Mendes", telefone: "(51) 99911-2233", email: "carlos@exemplo.com", formacao: "Administração", experiencia: "15 anos como consultor de negócios; ex-gestor do Sebrae regional.", pinHash: pinProfDemo, nascimento: "1978-07-15", dataInicio: "2024-08-01" },
      { nome: "Fernanda Tavares", telefone: "(51) 99822-3344", email: "fernanda@exemplo.com", formacao: "Ciências Contábeis", experiencia: "Contadora, 9 anos de experiência com microempreendedores.", pinHash: pinProfDemo, nascimento: "1985-03-22", dataInicio: "2025-02-10" },
      { nome: "Juliana Lopes", telefone: "(51) 99733-4455", email: "juliana@exemplo.com", formacao: "Publicidade e Propaganda", experiencia: "Estrategista digital, agência própria há 6 anos.", pinHash: pinProfDemo, nascimento: "1991-07-03", dataInicio: "2025-02-10" }
    ].map(p => upsert("professores", p));

    const nomesAlunos = [
      "Maria da Silva Santos", "João Pedro Oliveira", "Ana Beatriz Costa",
      "Camila Rodrigues Farias", "Letícia Almeida Souza", "Rafael Nunes Barbosa",
      "Bruna Ferreira Lima", "Diego Martins Araújo", "Patrícia Gomes Ribeiro",
      "Lucas Cardoso Teixeira", "Juliana Mendes Rocha", "Gabriel Santos Pereira"
    ];
    const alunos = nomesAlunos.map((nome, i) => upsert("alunos", {
      nome,
      nascimento: `19${75 + i}-0${(i % 9) + 1}-1${i % 9}`,
      cpf: "", telefone: `(51) 9${8000 + i * 7}-${1000 + i * 11}`,
      email: nome.toLowerCase().split(" ")[0] + i + "@exemplo.com",
      endereco: `Rua Exemplo, ${100 + i}`, bairro: "Zona Norte", cidade: "Porto Alegre", cep: "",
      responsavel: "", encaminhamento: ["Demanda espontânea", "CRAS", "Escolas"][i % 3],
      atingidoEnchente: i % 4 === 0 ? "sim" : (i % 4 === 1 ? "sim" : (i % 4 === 2 ? "nao" : "")),
      impactoEnchentes: i % 4 === 0 ? "Perdeu a moradia na enchente de 2024; realocada." : (i % 4 === 1 ? "Casa atingida, sem perdas totais." : ""),
      rendaFamiliar: "", beneficios: i % 3 === 0 ? "Bolsa Família" : "", moradiaAtual: "", necessidades: "", observacoes: ""
    }));

    const cursos = db.cursos;
    // exemplo de curso pago com bolsas: Maquiagem Profissional
    cursos[4].tipoCurso = "pago"; cursos[4].valor = 150; cursos[4].cobranca = "unico";
    const turmas = [
      { cursoId: cursos[2].id, professorId: profs[2].id, nome: "Turma B", dataInicio: "2026-05-04", dataFim: "2026-08-28", horario: "Ter e Qui, 19h–21h", local: "Sala 2", vagas: 25, status: "em andamento" },
      { cursoId: cursos[0].id, professorId: profs[0].id, nome: "Turma A", dataInicio: "2026-04-06", dataFim: "2026-07-30", horario: "Seg e Qua, 19h–21h", local: "Sala 1", vagas: 30, status: "em andamento" },
      { cursoId: cursos[3].id, professorId: profs[1].id, nome: "Turma 1", dataInicio: "2026-02-02", dataFim: "2026-04-24", horario: "Sáb, 9h–12h", local: "Sala 1", vagas: 30, status: "concluída" },
      { cursoId: cursos[4].id, professorId: profs[2].id, nome: "Turma 1", dataInicio: "2026-03-02", dataFim: "2026-05-29", horario: "Sex, 14h–17h", local: "Sala 3", vagas: 20, status: "concluída" }
    ].map(t => upsert("turmas", t));

    const mat = (aluno, turma, status, bolsa) => upsert("matriculas", { alunoId: aluno.id, turmaId: turma.id, status, data: turma.dataInicio, bolsa: !!bolsa });

    // trajetórias: alguns alunos fazem vários cursos
    // turmas[3] é do curso pago (Maquiagem): Maria é bolsista, Ana é pagante
    mat(alunos[0], turmas[2], "concluido"); mat(alunos[0], turmas[3], "concluido", true); mat(alunos[0], turmas[0], "cursando");
    mat(alunos[1], turmas[1], "cursando"); mat(alunos[1], turmas[2], "concluido");
    mat(alunos[2], turmas[0], "cursando"); mat(alunos[2], turmas[3], "concluido");
    [3, 4, 5, 6, 7].forEach(i => mat(alunos[i], turmas[0], "cursando"));
    [4, 8, 9].forEach(i => mat(alunos[i], turmas[1], "cursando"));
    [8, 10, 11].forEach(i => mat(alunos[i], turmas[2], "concluido"));
    mat(alunos[10], turmas[3], "concluido");
    mat(alunos[11], turmas[1], "trancado");

    // chamadas da turma de Social Media (índices pares = mais faltas p/ 5 e 7)
    const smAlunos = matriculasDaTurma(turmas[0].id).map(m => m.alunoId);
    for (let s = 0; s < 8; s++) {
      const d = new Date(2026, 4, 5 + s * 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const presencas = {};
      smAlunos.forEach(id => {
        const idx = alunos.findIndex(a => a.id === id);
        presencas[id] = !((idx === 5 && s % 2 === 0) || (idx === 7 && s % 3 === 0));
      });
      upsert("chamadas", { turmaId: turmas[0].id, data: iso, conteudo: `Encontro ${s + 1}`, presencas });
    }

    /* --- módulo de atendimentos --- */
    // pergunta de segurança de exemplo (troque pela sua na página Segurança)
    definirPerguntaSeguranca("Qual o nome do seu primeiro cachorro?", "Bolinha");

    const pinDemo = U.hashPin("1234"); // PIN dos profissionais de exemplo: 1234
    const profSaude = [
      { nome: "Dra. Helena Souza", especialidade: "Psicologia", crp: "07/12345", crm: "", registro: "", dias: "Seg, Qua e Sex", horarios: "13h–18h", telefone: "(51) 99611-2020", email: "helena@exemplo.com", pinHash: pinDemo },
      { nome: "Dr. Marcos Antunes", especialidade: "Psiquiatria", crp: "", crm: "CRM-RS 45678", registro: "", dias: "Ter", horarios: "8h–12h", telefone: "(51) 99522-3030", email: "marcos@exemplo.com", pinHash: pinDemo },
      { nome: "Renata Borges", especialidade: "Neuropsicopedagogia", crp: "", crm: "", registro: "ABPp 3321", dias: "Qui e Sex", horarios: "9h–15h", telefone: "(51) 99433-4040", email: "renata@exemplo.com", pinHash: pinDemo }
    ].map(p => upsert("profsaude", p));

    const nomesPac = [
      ["Carla Souza Mendes", "F", "gratuito", "", 0],
      ["Pedro Henrique Alves", "M", "pago", "mensal", 200],
      ["Sofia Ramos Teixeira", "F", "gratuito", "", 0],
      ["Miguel Santos Rocha", "M", "pago", "consulta", 80],
      ["Laura Pereira Dias", "F", "gratuito", "", 0],
      ["Davi Oliveira Campos", "M", "gratuito", "", 0]
    ];
    const pacs = nomesPac.map(([nome, sexo, tipo, cobranca, valor], i) => upsert("pacientes", {
      nome, sexo,
      cpf: "", rg: "", nascimento: `${1988 + i * 4}-0${(i % 9) + 1}-2${i % 8}`,
      endereco: `Av. Modelo, ${200 + i}`, bairro: "Zona Norte", cidade: "Porto Alegre",
      telefone: `(51) 9${7000 + i * 9}-${2000 + i * 13}`, whatsapp: `(51) 9${7000 + i * 9}-${2000 + i * 13}`,
      email: nome.toLowerCase().split(" ")[0] + ".pac@exemplo.com",
      responsavel: i >= 4 ? "Responsável Exemplo" : "",
      escolaridade: i >= 4 ? "Ensino fundamental" : "Ensino médio",
      escola: i >= 4 ? "EMEF Zona Norte" : "", profissao: i < 4 ? "Autônomo(a)" : "",
      estadoCivil: i < 2 ? "Casado(a)" : "Solteiro(a)",
      encaminhadoPor: ["CRAS", "Escolas", "Demanda espontânea"][i % 3],
      situacaoSocio: i % 2 === 0 ? "Baixa renda" : "", beneficios: i % 3 === 0 ? "Bolsa Família" : "",
      atingidoEnchente: i % 3 === 0 ? "sim" : (i % 3 === 1 ? "nao" : ""),
      impactoEnchentes: i % 3 === 0 ? "Família desalojada na enchente de 2024." : "",
      observacoes: "", tipoAtendimento: tipo, cobranca, valor
    }));

    const at = (dias, hora, pac, prof, esp, tipoC, formato, mod, status) => {
      const d = new Date(2026, 5, 1 + dias);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      upsert("atendimentos", {
        data: iso, hora, pacienteId: pac.id, profissionalId: prof.id, especialidade: esp,
        tipoConsulta: tipoC, formato, modalidade: mod, status, obs: ""
      });
    };
    // Carla: Psicologia + Psiquiatria (cruzamento)
    at(1, "14:00", pacs[0], profSaude[0], "Psicologia", "primeira", "individual", "presencial", "realizado");
    at(8, "14:00", pacs[0], profSaude[0], "Psicologia", "retorno", "individual", "presencial", "realizado");
    at(9, "09:00", pacs[0], profSaude[1], "Psiquiatria", "primeira", "individual", "presencial", "realizado");
    at(36, "14:00", pacs[0], profSaude[0], "Psicologia", "retorno", "individual", "presencial", "agendado");
    // Pedro: Psicologia online (pagante mensal)
    at(2, "15:00", pacs[1], profSaude[0], "Psicologia", "primeira", "individual", "online", "realizado");
    at(16, "15:00", pacs[1], profSaude[0], "Psicologia", "retorno", "individual", "online", "faltou");
    at(30, "15:00", pacs[1], profSaude[0], "Psicologia", "retorno", "individual", "online", "realizado");
    // Sofia: Neuropsicopedagogia + Psicologia (cruzamento)
    at(4, "10:00", pacs[2], profSaude[2], "Neuropsicopedagogia", "primeira", "individual", "presencial", "realizado");
    at(18, "10:00", pacs[2], profSaude[2], "Neuropsicopedagogia", "retorno", "individual", "presencial", "realizado");
    at(25, "16:00", pacs[2], profSaude[0], "Psicologia", "primeira", "individual", "presencial", "realizado");
    // Miguel: Psiquiatria (pagante por consulta)
    at(9, "10:00", pacs[3], profSaude[1], "Psiquiatria", "primeira", "individual", "presencial", "realizado");
    at(37, "10:00", pacs[3], profSaude[1], "Psiquiatria", "retorno", "individual", "presencial", "confirmado");
    // Laura e Davi: grupo de Psicologia
    at(11, "17:00", pacs[4], profSaude[0], "Psicologia", "primeira", "grupo", "presencial", "realizado");
    at(11, "17:00", pacs[5], profSaude[0], "Psicologia", "primeira", "grupo", "presencial", "faltou");
    at(32, "17:00", pacs[4], profSaude[0], "Psicologia", "retorno", "grupo", "presencial", "agendado");
    at(32, "17:00", pacs[5], profSaude[0], "Psicologia", "retorno", "grupo", "presencial", "agendado");
    // Davi: Neuropsicopedagogia também
    at(12, "11:00", pacs[5], profSaude[2], "Neuropsicopedagogia", "primeira", "individual", "presencial", "cancelado");
    at(19, "11:00", pacs[5], profSaude[2], "Neuropsicopedagogia", "primeira", "individual", "presencial", "realizado");

    /* --- agenda de eventos e salas --- */
    [
      { titulo: "Aula — Social Media, Turma B", tipo: "curso", data: "2026-07-07", horaInicio: "19:00", horaFim: "21:00", sala: "Sala 2", turmaId: turmas[0].id, responsavel: "Juliana Lopes", obs: "" },
      { titulo: "Workshop de Fotografia com Celular", tipo: "workshop", data: "2026-07-18", horaInicio: "09:00", horaFim: "12:00", sala: "Sala 3", turmaId: "", responsavel: "Juliana Lopes", obs: "Inscrições abertas" },
      { titulo: "Palestra: Saúde Financeira da Família", tipo: "palestra", data: "2026-08-05", horaInicio: "19:00", horaFim: "20:30", sala: "Auditório", turmaId: "", responsavel: "Fernanda Tavares", obs: "Aberta à comunidade" },
      { titulo: "Feira de Empreendedoras da Zona Norte", tipo: "evento", data: "2026-09-12", horaInicio: "10:00", horaFim: "17:00", sala: "Hall de Entrada", turmaId: "", responsavel: "", obs: "Expositoras: alunas dos cursos" },
      { titulo: "Reunião de planejamento pedagógico", tipo: "reuniao", data: "2026-07-10", horaInicio: "14:00", horaFim: "16:00", sala: "Sala 1", turmaId: "", responsavel: "Coordenação", obs: "" },
      { titulo: "Palestra de encerramento do ano", tipo: "palestra", data: "2025-12-10", horaInicio: "19:00", horaFim: "21:00", sala: "Auditório", turmaId: "", responsavel: "Coordenação", obs: "Registro do ano anterior" }
    ].forEach(e => upsert("eventos", e));

    salvar();
  }

  /* limpa todos os cadastros, mas PRESERVA as configurações de acesso
     (senhas, PINs, pergunta de segurança, categorias, salas, especialidades)
     para o administrador não precisar reconfigurar tudo de novo */
  function limparTudo() {
    const config = db.config;
    db = vazio();
    db.config = config;
    seedCursos();
    salvar();
  }

  carregar();

  return {
    col, get, upsert, remover, salvar,
    cargaHoraria, matriculasDaTurma, matriculasDoAluno, cursoDaTurma, cursosDoAluno,
    presencaAluno, presencaMediaTurma, presencaMediaGeral, alunosEmRisco,
    alunosPorCurso, cruzamento, resumo,
    presencaPorTurma, alunosPorProfessor, evolucaoFrequencia, porEncaminhamento, porImpactoEnchente,
    addEncaminhamento, addEspecialidade, addSala,
    temSenhaGeral, definirSenhaGeral, conferirSenhaGeral,
    temSenha, definirSenha, removerSenha, conferirSenha,
    aniversariantes,
    temPerguntaSeguranca, perguntaSeguranca, definirPerguntaSeguranca, conferirResposta,
    temPinAssistencia, definirPinAssistencia, conferirPinAssistencia,
    addAreaEspera, esperaPorArea,
    temPinFinanceiro, definirPinFinanceiro, conferirPinFinanceiro,
    addCategoriaFin, importarLancamentos, resumoFin, anosFin,
    anosAgenda, eventosDoAno, conflitoSala,
    atendimentosDoPaciente, especialidadesDoPaciente, cruzamentoAtendimentos,
    resumoAtendimentos, atendimentosPorProfissional, resumoFinanceiro, resumoFinanceiroCursos,
    enchenteGeral, encaminhamentoGeral, resumoGratuidade, condicaoAluno,
    contas, contaPorEmail, salvarConta, removerConta,
    exportarJSON, importarJSON, limparTudo,
    snapshot, aplicarRemoto,
    get config() { return db.config; }
  };
})();

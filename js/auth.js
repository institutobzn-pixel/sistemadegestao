/* Autenticação pelo Supabase Auth — contas individuais por e-mail.

   Só entra em ação quando a nuvem está configurada. Sem nuvem, o app segue
   100% local e a entrada continua sendo pelo perfil com senha.

   Guarda a sessão no localStorage para sobreviver a recarregamentos. O
   access_token vale cerca de uma hora; renovar() troca pelo refresh_token
   antes de expirar, e token() faz isso sozinho quando alguém precisa. */
"use strict";

const Auth = (() => {
  const K_SESSAO = "bzn-auth-sessao";
  const MARGEM = 60_000; // renova 1 min antes de expirar

  let sessao = null;
  try {
    sessao = JSON.parse(localStorage.getItem(K_SESSAO) || "null");
  } catch (e) { sessao = null; }

  let renovando = null; // promessa em voo, para não renovar em paralelo

  function guardar(s) {
    sessao = s;
    try {
      if (s) localStorage.setItem(K_SESSAO, JSON.stringify(s));
      else localStorage.removeItem(K_SESSAO);
    } catch (e) { /* armazenamento cheio ou bloqueado */ }
  }

  function base() {
    return (typeof Nuvem !== "undefined" && Nuvem.configurada()) ? Nuvem.endereco() : "";
  }
  function chave() {
    return (typeof Nuvem !== "undefined" && Nuvem.chavePublica) ? Nuvem.chavePublica() : "";
  }

  function logado() { return !!(sessao && sessao.refresh_token); }
  function email() { return sessao && sessao.email ? sessao.email : ""; }

  /* devolve o corpo do erro do Supabase em português quando dá para traduzir */
  function mensagemErro(status, corpo) {
    const cod = (corpo && (corpo.error_code || corpo.error)) || "";
    const msg = (corpo && (corpo.error_description || corpo.msg || corpo.message)) || "";
    if (status === 400 && /invalid.*(grant|credentials)|invalid_grant/i.test(cod + msg)) {
      return "E-mail ou senha incorretos.";
    }
    if (status === 400 && /email.*not.*confirmed/i.test(cod + msg)) {
      return "Esta conta ainda não confirmou o e-mail. Peça ao administrador para confirmar no Supabase.";
    }
    if (status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
    if (status === 0) return "Sem conexão com a nuvem.";
    return msg || `Falha na autenticação (${status}).`;
  }

  async function pedirToken(corpo, tipo) {
    const url = base();
    if (!url) return { ok: false, msg: "A nuvem não está configurada neste aparelho." };
    let r, dados;
    try {
      r = await fetch(`${url}/auth/v1/token?grant_type=${tipo}`, {
        method: "POST",
        headers: { "apikey": chave(), "Content-Type": "application/json" },
        body: JSON.stringify(corpo)
      });
      dados = await r.json().catch(() => ({}));
    } catch (e) {
      return { ok: false, msg: "Sem conexão com a nuvem." };
    }
    if (!r.ok) return { ok: false, msg: mensagemErro(r.status, dados) };

    guardar({
      access_token: dados.access_token,
      refresh_token: dados.refresh_token,
      expira_em: Date.now() + (Number(dados.expires_in || 3600) * 1000),
      email: (dados.user && dados.user.email) || (sessao && sessao.email) || "",
      user_id: (dados.user && dados.user.id) || (sessao && sessao.user_id) || ""
    });
    return { ok: true };
  }

  function entrar(mail, senha) {
    return pedirToken({ email: String(mail || "").trim(), password: String(senha || "") }, "password");
  }

  async function renovar() {
    if (!logado()) return { ok: false, msg: "Sem sessão." };
    if (renovando) return renovando;
    renovando = pedirToken({ refresh_token: sessao.refresh_token }, "refresh_token")
      .finally(() => { renovando = null; });
    const r = await renovando;
    /* refresh_token inválido: a sessão morreu de vez */
    if (!r.ok && /invalid|expired|not found/i.test(r.msg)) sair();
    return r;
  }

  /* access_token válido, renovando se estiver perto de expirar */
  async function token() {
    if (!logado()) return "";
    if (Date.now() > (sessao.expira_em || 0) - MARGEM) {
      await renovar();
      if (!logado()) return "";
    }
    return sessao.access_token || "";
  }

  /* token já em mãos, sem esperar renovação — para montar cabeçalhos síncronos */
  function tokenAtual() {
    return (sessao && sessao.access_token) || "";
  }

  /* Troca a senha da própria conta. Usado no primeiro acesso, quando o
     administrador entregou uma senha provisória, e sempre que a pessoa
     quiser — sem passar por ninguém. */
  async function trocarSenha(nova) {
    const url = base();
    if (!url) return { ok: false, msg: "A nuvem não está configurada neste aparelho." };
    const t = await token();
    if (!t) return { ok: false, msg: "Sua sessão expirou. Entre de novo." };
    let r, dados;
    try {
      r = await fetch(`${url}/auth/v1/user`, {
        method: "PUT",
        headers: { "apikey": chave(), "Authorization": "Bearer " + t, "Content-Type": "application/json" },
        body: JSON.stringify({ password: String(nova) })
      });
      dados = await r.json().catch(() => ({}));
    } catch (e) {
      return { ok: false, msg: "Sem conexão com a nuvem." };
    }
    if (!r.ok) {
      const msg = (dados && (dados.msg || dados.message || dados.error_description)) || "";
      if (/at least|weak|short|6 characters/i.test(msg)) {
        return { ok: false, msg: "A senha é curta demais. Use pelo menos 6 caracteres." };
      }
      if (/same.*password|should be different/i.test(msg)) {
        return { ok: false, msg: "A nova senha precisa ser diferente da atual." };
      }
      return { ok: false, msg: msg || `Não foi possível trocar a senha (${r.status}).` };
    }
    return { ok: true };
  }

  function sair() {
    const url = base();
    const t = tokenAtual();
    guardar(null);
    /* avisa o servidor por cortesia; se falhar, a sessão local já se foi */
    if (url && t) {
      fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: { "apikey": chave(), "Authorization": "Bearer " + t }
      }).catch(() => {});
    }
  }

  return { entrar, sair, renovar, token, tokenAtual, logado, email, trocarSenha };
})();

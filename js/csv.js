/* Utilidades de importação de planilhas (CSV) — usadas por Alunos, Turmas e Chamada.
   Tudo roda no navegador; o arquivo nunca sai do computador. */
"use strict";

const CSV = (() => {
  /* lê CSV respeitando aspas, quebras internas e separador , ou ; (detecção automática) */
  function parse(texto) {
    texto = String(texto || "").replace(/^﻿/, "");
    const primeira = texto.split(/\r?\n/)[0] || "";
    const sep = (primeira.split(";").length > primeira.split(",").length) ? ";" : ",";
    const linhas = [];
    let campo = "", linha = [], dentro = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (dentro) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
        else campo += c;
      } else {
        if (c === '"') dentro = true;
        else if (c === sep) { linha.push(campo); campo = ""; }
        else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
        else if (c === '\r') { /* ignora */ }
        else campo += c;
      }
    }
    if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
    const limpas = linhas.filter(l => l.some(x => (x || "").trim() !== ""));
    const header = (limpas.shift() || []).map(h => (h || "").trim());
    return { header, linhas: limpas };
  }

  /* datas flexíveis: 03/07/2010, 2010-07-03, 3-7-2010, 01/03 (sem ano) */
  function parseDataFlex(s, anoPadrao) {
    const t = String(s || "").trim();
    if (!t) return "";
    let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      let y = m[3];
      if (y.length === 2) y = (parseInt(y, 10) > 30 ? "19" : "20") + y;
      return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    // dia/mês sem ano
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
    if (m && anoPadrao) return `${anoPadrao}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return "";
  }

  /* um cabeçalho parece uma data? */
  function pareceData(s) {
    return /^\s*\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?\s*$/.test(String(s || "")) ||
           /^\s*\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\s*$/.test(String(s || ""));
  }

  /* célula de presença → true (presente) / false (falta) / null (em branco) */
  function presencaCelula(s) {
    const t = String(s || "").trim().toLowerCase();
    if (t === "") return null;
    if (/^(p|pres|presente|1|x|s|sim|✓|v|ok)$/i.test(t)) return true;
    if (/^(f|falta|faltou|0|a|aus|ausente|n|nao|não|-)$/i.test(t)) return false;
    return null;
  }

  /* normaliza nome para comparar (minúsculas, sem acentos, espaços colapsados) */
  function normNome(s) {
    return String(s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  }

  return { parse, parseDataFlex, pareceData, presencaCelula, normNome };
})();

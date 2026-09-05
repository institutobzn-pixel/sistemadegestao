# Painel do Instituto Brasa Zona Norte

Sistema de gestão do instituto: cursos, turmas, alunos, chamada, atendimentos
clínicos, serviço social, agenda, documentação, financeiro e indicadores.

> **Para quem vai continuar o desenvolvimento (humano ou IA): leia este arquivo
> inteiro antes de mexer. Ele resume a arquitetura, as decisões e as armadilhas.**

---

## 1. O que é, tecnicamente

- **Aplicação 100% client-side**: HTML + CSS + JavaScript puro (sem framework,
  sem build, sem npm). Basta servir a pasta como site estático.
- **Hospedagem atual**: GitHub Pages (publica sozinho a cada `git push` na `main`).
- **Persistência local**: `localStorage`, chave `bzn-painel-v1`.
- **Sincronização entre aparelhos**: Supabase (opcional, configurado pelo usuário).
- **PWA**: instalável, funciona offline (`manifest.webmanifest` + `sw.js`).

### Estrutura de arquivos

```
index.html            # casca: topo, nav, modal, <script> de tudo (ordem importa)
sw.js                 # service worker (cache offline; lista ESSENCIAIS + versão do cache)
manifest.webmanifest  # PWA
css/style.css         # design system inteiro (tokens, componentes, tema claro/escuro, print)
js/util.js            # U (helpers) e o objeto global Actions {}
js/store.js           # Store: TODO o estado e as regras de negócio
js/nuvem.js           # Nuvem: sincronização com o Supabase + Actions.conectarNuvem
js/anexos.js          # Anexos: upload de arquivos (dataURL) reutilizável
js/csv.js             # CSV: parser + datas + presença + normalização de nome
js/charts.js          # gráficos em SVG puro (sem biblioteca)
js/views/*.js         # uma view por área; registram Views.x e Actions.x
js/app.js             # roteador (hash), portão de login, modal, render()
```

**Convenções**
- Roteamento por hash: `#/rota/param` → `App.render()` chama `Views[rota](param)`.
- Toda view devolve **string HTML**. Interatividade via `data-action="nome"`
  (dispara `Actions.nome(id, el)`) e, dentro de modais, `data-modal-action="nome"`.
- `App.abrirModal(titulo, html, aoEnviar)`; se houver `<form>` e `aoEnviar`, o
  submit entrega os campos como objeto.
- Sempre escapar texto do usuário com `U.esc(...)`.

---

## 2. Modelo de dados (`js/store.js`)

Um único objeto `db` guardado em `localStorage`. Coleções (arrays de `{id, ...}`):

`cursos, turmas, matriculas, alunos, chamadas, professores, equipe,
pacientes, profsaude, atendimentos, assistidos, listaEspera, compromissosAS,
legislacaoAS, profsociais, eventos, lancamentos, documentos, linksImagens`

mais `config` (senhas/PINs em hash, listas de opções, pergunta de segurança).

API principal: `Store.col(nome)`, `get`, `upsert`, `remover`, `salvar`,
`snapshot()`, `aplicarRemoto(dados)`, `exportarJSON()`, `importarJSON(txt)`,
`limparTudo()` + dezenas de consultas de negócio (presença, cruzamentos, resumos).

`remover()` faz integridade referencial simples (ex.: apagar turma remove
matrículas e chamadas dela).

### Acessos

| Perfil | Como entra | Alcance |
|---|---|---|
| Admin | perfil "Administração" + senha | tudo |
| Presidência | perfil "Presidência" + senha | tudo (igual admin) |
| Secretaria | perfil "Secretaria" + senha | operação, sem logins/financeiro |
| Gestor financeiro | PIN | só Financeiro |
| Serviço social | PIN | só Serviço Social |
| Professor | PIN individual (no cadastro dele) | só as turmas dele |
| Profissional de saúde | PIN individual | só os pacientes/agenda dele |
| Colaborador | **não acessa** | apenas cadastro interno |

`App.ehAdmin()` = admin **ou** presidente. Use-o em toda checagem de permissão.
Senhas/PINs são hash (`U.hashPin`) guardados em `config` — logo, **sincronizam
junto com os dados**.

---

## 3. Sincronização com a nuvem (`js/nuvem.js`) — leia com atenção

### Como funciona
O **banco inteiro** é gravado como **uma linha** (`id=1`) na tabela `painel` do
Supabase, coluna `dados` (jsonb). Cada aparelho:
- **envia** (debounce ~1,2 s) sempre que `Store.salvar()` roda;
- **verifica** a nuvem a cada 7 s e aplica o que mudou.

Configuração fica em `localStorage`: `bzn-nuvem-url` e `bzn-nuvem-key`.
Sem configuração, o app funciona 100% local (comportamento padrão).

### Proteção anti-perda (NÃO REMOVER)
Como é um "blob" com last-write-wins, uma cópia desatualizada poderia apagar
dados dos outros. Já aconteceu em produção (sumiram os professores). Por isso
existe `mesclarProtegido(preferido, base)`:

> Para **cada coleção**: se ela está **vazia** no lado que "vence" e **cheia** no
> outro, mantém a cheia. Ou seja, **uma coleção inteira nunca é apagada por uma
> cópia que não a tem**. Excluir registros individuais continua funcionando.

Ela é aplicada nas **três** direções: `enviarAgora`, `verificar` e `iniciar`.
Se for mexer na sincronização, preserve esse comportamento (há testes manuais
descritos na seção 7).

### Link mágico (onboarding da equipe)
```
<site>/?nuvem=<PROJECT_URL_encodado>&chave=<PUBLISHABLE_KEY>
```
Ao abrir, o app configura a nuvem, baixa tudo e **limpa a query da URL**
(`history.replaceState`). É assim que cada aparelho entra sem digitar nada.
A chave publicável (anon) é feita para ficar no cliente — mas só distribua à equipe.

### SQL da tabela (rodar no SQL Editor do Supabase)
```sql
create table if not exists painel (
  id smallint primary key default 1,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into painel (id) values (1) on conflict (id) do nothing;
alter table painel enable row level security;
drop policy if exists "acesso app" on painel;
create policy "acesso app" on painel
  for all to anon, authenticated using (true) with check (true);
```

---

## 4. Backup e restauração

- **⚙ Logins → Baixar backup**: gera `backup-instituto-bzn-AAAA-MM-DD.json`
  com **tudo** (dados + senhas/PINs em hash).
- **⚙ Logins → Restaurar backup**: substitui o estado local pelo do arquivo.
- É a rede de segurança e também o meio de **migrar** de conta/servidor.

---

## 5. Importação de planilhas (CSV)

Tudo roda no navegador; o arquivo não sai do computador.
- **Alunos** → "Importar planilha": detecta as colunas, o usuário confere o
  mapeamento numa tela, vê prévia, importa. Deduplica por nome + CPF/nascimento.
  Se houver coluna de curso, cria curso/turma e já matricula.
- **Turmas** → "Importar inscritos": escolhe a turma e matricula a lista.
- **Chamada** → "Importar chamada": formato matriz (nome nas linhas, datas nas
  colunas; `P/1/x` = presente, `F/0` = falta). Cria uma chamada por data.

---

## 6. Como migrar para outra conta / outro servidor

Ordem importa. **Faça o backup primeiro.**

1. **Backup**: no app atual, ⚙ Logins → *Baixar backup* (.json). Guarde.
2. **Código**: copie o repositório (fork, transferência, ou baixar ZIP e subir
   num repo novo). Não há segredos no código.
3. **Novo Supabase** (se trocar de conta): crie o projeto, rode o SQL da seção 3,
   copie o *Project URL* e a *chave publicável*.
4. **Hospedagem**: GitHub Pages (Settings → Pages → branch `main`) **ou**
   Cloudflare Pages. Na Cloudflare, se a conexão com o GitHub der problema, use
   **Direct Upload** (arrastar a pasta) — funciona igual, é site estático.
5. **Dados**: abra o site novo → conecte à nuvem nova (endereço + chave) →
   ⚙ Logins → *Restaurar backup*. O app sobe os dados para a nuvem nova.
6. **Equipe**: gere o novo **link mágico** (seção 3) e distribua/QR.

> ⚠️ **Trocar de domínio zera o `localStorage` de cada navegador** (é por origem).
> Isso **não** perde dados: eles estão na nuvem/no backup. Cada aparelho só
> precisa abrir o link mágico novo uma vez.

---

## 7. Como testar (sem servidor)

Abra `index.html` direto no navegador (`file://`) — funciona. Para testes
automatizados usamos Playwright headless com o Chromium do sistema, dirigindo
`Store`/`Nuvem`/`Actions` pelo `page.evaluate` e simulando o Supabase com um
`window.fetch` falso.

Cenários que **precisam continuar passando** ao mexer na nuvem:
1. Aparelho com dados + nuvem sem uma coleção → o aparelho **mantém** e **reenvia**.
2. Aparelho sem uma coleção + nuvem com ela → o envio **não apaga** a da nuvem.
3. Excluir **um** registro de uma coleção cheia → a exclusão **propaga**.

Ao adicionar um arquivo `js/*.js`: inclua em `index.html` **e** na lista
`ESSENCIAIS` do `sw.js`, subindo a versão do cache (`CACHE = "bzn-painel-vN"`).

---

## 8. Armadilhas conhecidas

- **Aparelho novo começa vazio**: a tela de entrada detecta isso e oferece
  "Trazer os dados do instituto" em vez de pedir para criar senha. As telas de
  login por PIN também oferecem (`Actions.conectarNuvem`).
- **Não sobrescrever a nuvem com estado vazio** (ver seção 3).
- **Cache do PWA**: depois de publicar, pode ser preciso `Ctrl+Shift+R`.
- **Limite do `localStorage`** (~5 MB): anexos são comprimidos; imagens viram
  JPEG ≤900 px. Muitos PDFs grandes podem estourar — os `try/catch` avisam.
- **Datas**: `<input type="date">` dispara `change` com anos incompletos; a
  chamada ignora anos fora de 2000–2100 para não recarregar no meio da digitação.

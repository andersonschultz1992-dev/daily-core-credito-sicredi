# Daily Core & Crédito — Sicredi

Painel de acompanhamento da Daily do time **Core & Crédito** (Coordenação de
DevOps · Confederação Sicredi). Aplicação **front-end estático** (HTML/CSS/JS
puro) publicado no **GitHub Pages**, com **Supabase** como única fonte de
dados — sem JSON local, sem login, sem IA, sem custo de API.

> **v9.0 — Agenda mensal + Entrega Trimestral**. A Agenda de Dailies passa a agrupar as datas salvas por **mês/ano**, com grupos expansíveis. A navegação superior traz a nova página **Entrega Trimestral**, com formulário de owners, número do épico, iniciativa e data de entrega; consulta histórica por trimestre, filtros, edição/exclusão e persistência no Supabase. Mantidos os recursos originais da daily (temas, cards, destaques, PNG, bloqueio global de edição). Para banco já existente, execute **somente a nova migração** `supabase/migration-entregas-trimestrais.sql`.

---

## 1. Estrutura do projeto

```
/
├── index.html
├── entrega-trimestral.html ← nova página independente
├── PROMPT-MELHORIAS-v9.md ← especificação técnica completa
├── css/
│   ├── style.css
│   └── trimestral.css ← navegação / agenda mensal / tela trimestral
├── js/
│   ├── trimestral.js   ← CRUD + bloqueio + filtros trimestrais
│   ├── app.js          ← lógica da aplicação
│   ├── config.js        ← credenciais do Supabase (edite aqui)
│   └── destaques.js      ← biblioteca de 34 destaques prontos
├── assets/
│   ├── fotos/             ← fotos padrão dos analistas
│   └── img/                 ← logo Sicredi (opcional)
└── supabase/
    ├── schema.sql            ← SQL completo: tabelas, índices e RLS
    ├── migration-edit-lock.sql ← migração do bloqueio para bancos antigos
    └── migration-entregas-trimestrais.sql ← execute em seu Supabase existente
```

Não há mais `data/analistas.json`, não há `admin.html`, não há
`supabase/functions/`. Tudo foi removido propositalmente.

---

## 2. Como funciona (visão geral)

- **Três temas visuais.** O botão de tema percorre Escuro → Claro →
  Cooperativo. A escolha fica salva no navegador. O modo Cooperativo usa
  `#3FA110`, `#146E37`, `#D7E6C8`, branco e amarelo como protagonistas,
  com cata-ventos animados ao fundo.
- **Supabase é a única fonte de dados.** Todas as dailies, analistas,
  entregas, destaques e bloqueios ficam em 7 tabelas (`dailies`,
  `analistas`, `entregas`, `destaques`, `destaques_cabecalho`,
  `app_edit_locks`, `entregas_trimestrais`) — ver
  `supabase/schema.sql`.
- **Bloqueio global de edição.** Ao clicar em **Editar**, o navegador
  adquire uma reserva atômica no Supabase. Enquanto ela estiver ativa,
  qualquer outra pessoa recebe um aviso para tentar novamente em
  instantes. O bloqueio é liberado ao salvar ou sair da edição e possui
  expiração automática para fechamentos abruptos.
- **Sem login.** Qualquer pessoa que abrir o link do app pode clicar em
  **Editar**, alterar o que quiser e **Salvar** — sem usuário, sem senha.
  É o mesmo nível de confiança que já existia quando os dados ficavam só
  no navegador; a diferença é que agora ficam compartilhados entre todo o
  time e com histórico permanente.
- **Sem IA.** Os destaques do cabeçalho (ex.: *"Evolução da
  observabilidade dos ambientes"*) são escolhidos manualmente, em Modo
  Edição, de uma lista fixa de 34 opções prontas (texto + ícone + cor) —
  zero chamadas de rede, zero custo, zero chave de API.
- **A daily de hoje aparece pronta para preencher — mas só é gravada
  quando tem conteúdo.** Ao abrir o app, ele verifica se já existe uma
  daily com a data de hoje:
  - **Se existir**, carrega normalmente.
  - **Se não existir**, monta uma estrutura **em memória** (rascunho),
    copiando o **roster de analistas** (nome, cargo, foto, cor, tags) da
    daily anterior mais recente — com **entregas, badge e destaques
    vazios**. Esse rascunho **não é gravado no banco** até você clicar em
    **Salvar** com algum conteúdo de fato (uma entrega, um badge ou um
    destaque). Isso evita criar registros vazios para dias em que ninguém
    preencheu nada. Na primeiríssima vez (banco vazio), o rascunho usa os
    4 integrantes padrão do time.
- **Excluir uma daily.** Em Modo Edição há um botão **Excluir** que remove
  por completo a daily atual do banco (com suas entregas, destaques e
  analistas, via `ON DELETE CASCADE`). Após excluir, o app carrega a daily
  mais recente que sobrou (ou monta um rascunho de hoje, se o banco ficou
  vazio). Pede confirmação antes, e a ação não pode ser desfeita.
- **Planejar datas futuras e consultar passadas.** O ícone de calendário
  ao lado de "Daily DEVOPS" abre um seletor de data: escolha qualquer dia
  (futuro ou passado). Se já houver daily naquela data, ela é carregada;
  se não, abre um rascunho vazio para preencher e salvar.
- **Histórico sempre disponível.** A "Agenda de Dailies" na lateral lista
  **apenas datas que têm daily salva**, agrupadas por mês/ano (rascunhos não preenchidos não
  aparecem) — escolher uma carrega aquela daily inteira na hora, sem
  recarregar a página.

---

## 3. Configurar o Supabase (obrigatório para persistência)

### 3.1 Criar o projeto e as tabelas

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** e execute todo o conteúdo de `supabase/schema.sql`.
   Isso cria as tabelas (inclusive `entregas_trimestrais`), índices, triggers
   de `updated_at` e as políticas de RLS (veja a seção de Segurança abaixo). Nenhuma daily vazia é criada automaticamente.

### 3.2 Atualizar um Supabase **já existente** (caso mais comum)

**Não execute `schema.sql` novamente se seu banco já possui as tabelas das dailies.**
No Dashboard do Supabase, abra **SQL Editor**, cole e execute o conteúdo de:

```text
supabase/migration-entregas-trimestrais.sql
```

Essa migração cria **apenas** a tabela `entregas_trimestrais`, os índices,
o trigger de atualização e as políticas necessárias. **Não exclui nem altera
as dailies atuais.** É segura para executar novamente se necessário.
Não precisa reexecutar `migration-edit-lock.sql` quando a edição já funciona.

Para conferir após a execução:

```sql
SELECT * FROM public.entregas_trimestrais ORDER BY data_entrega DESC LIMIT 10;
```

A tabela inicialmente estará vazia. Acesse o novo menu **Entrega Trimestral**
e clique em **Nova entrega** para começar a registrar.

### 3.3 Configurar as credenciais no front-end

Edite `js/config.js`:

```javascript
window.SUPABASE_CONFIG = {
  url:     'https://SEU-PROJETO.supabase.co',
  anonKey: 'SUA-CHAVE-ANON-PUBLICA',
};
```

Pegue os dois valores em **Settings → API** no painel do Supabase. A chave
`anon/public` é segura para uso no front-end — o controle de acesso é feito
pelas políticas de RLS (Row Level Security), não pelo sigilo da chave.

### 3.4 Modo demonstração (sem configurar nada)

Enquanto `js/config.js` mantiver os valores de exemplo (URL com `XXXXXXXXXX` ou
`anonKey` vazia), a tela das dailies **continua funcionando** — mostra um conjunto fixo
de dados de demonstração. A página trimestral exige uma conexão real com
o banco e mostra um aviso quando a conexão ou tabela não está disponível. Isso garante que o app nunca
abre em branco, mesmo antes de qualquer configuração de backend.

---

## 4. Publicando no GitHub Pages

1. Suba todo o conteúdo desta pasta para a raiz de um repositório no
   GitHub (branch `main`).
2. Em **Settings → Pages**, selecione a branch `main` e a pasta
   `/ (root)`.
3. Aguarde alguns minutos — o GitHub fornecerá uma URL no formato
   `https://<usuario>.github.io/<repositorio>/`.

### ⚠️ Não abra `index.html` direto pelo navegador (`file://`)

O app faz chamadas à API REST do Supabase via `fetch`, que **não funciona**
com o protocolo `file://`. Para testar localmente, sirva a pasta por HTTP:

```bash
python -m http.server 8000
# depois acesse http://localhost:8000
```

---

## 5. Uso no dia a dia

### Rotina da Daily

1. Abra o link do app — a daily de hoje já aparece pronta para preencher
   (com o time copiado da última daily). Enquanto você não salvar nada,
   ela é só um rascunho em memória, **não** ocupa um registro no banco.
2. Clique em **Editar**.
3. Preencha as entregas de cada analista (**Adicionar entrega**), ajuste
   badge/número se quiser, edite título/subtítulo/descrição se necessário.
4. Escolha de **1 a 4 Destaques da Daily** nos chips que aparecem no
   cabeçalho (biblioteca de 34 opções prontas — ver seção 6).
5. Adicione os **Destaques da Semana** no rodapé, se quiser
   (**Adicionar destaque**, texto livre).
6. Clique em **Salvar**. A daily é gravada no Supabase (visível para todo
   o time) — e é neste momento que ela passa a existir no banco e a
   aparecer na Agenda. Salvar uma daily totalmente vazia não cria registro
   (o app avisa para preencher algo antes).
7. Use o botão de tema para alternar entre **Escuro**, **Claro** e
   **Cooperativo**.
8. Clique em **Imagem** para gerar o PNG da página inteira para enviar no
   chat, se for o caso.

### Planejando dailies futuras / consultando passadas

Clique no ícone de calendário ao lado de "Daily DEVOPS" e escolha
qualquer data. Se já existir uma daily naquela data, ela é carregada;
se não, abre um rascunho vazio (com o time já preenchido) para você
planejar com antecedência. Preencha e clique em **Salvar** — quando
chegar o dia, os dados estarão lá. Datas passadas funcionam do mesmo
jeito: selecione e edite normalmente.

### Consultando dailies pelo histórico

A "Agenda de Dailies" na lateral agrupa **apenas as datas que têm daily
salva** por **mês e ano**, mais recente primeiro. Expanda/recolha qualquer mês. Rascunhos ainda não preenchidos não
aparecem ali. Clique em uma data para carregar aquela daily na hora.

### Excluir uma daily

Em Modo Edição, o botão **Excluir** (vermelho, ao lado de Salvar) remove
a daily atual por completo do banco — entregas, destaques e analistas
daquela data somem junto. O app pede confirmação antes; a ação **não pode
ser desfeita**. Depois de excluir, ele carrega a daily mais recente que
sobrou (ou abre um rascunho de hoje, se não houver mais nenhuma). Uma
daily que ainda é só rascunho (nunca salva) não precisa ser excluída —
basta navegar para outra data.

### Adicionar/remover analista

Em Modo Edição: **Add** (toolbar) adiciona um card novo em branco; o **×**
no canto do card remove. Mudanças só são persistidas ao clicar em
**Salvar**.

### Trocar foto

Clique na foto do card em Modo Edição. A imagem é redimensionada e
comprimida no navegador (máx. 480px, JPEG) antes de salvar — se o
analista já existir no Supabase, a foto é salva **imediatamente** (sem
precisar clicar em Salvar); se for um analista recém-adicionado (ainda sem
clicar em Salvar nenhuma vez), a foto fica pendente até o próximo Salvar.

### Trocar o ícone do indicador (badge)

Cada card tem um pequeno indicador abaixo do cargo (ícone + "Número" +
descrição). Em Modo Edição, clique no **ícone** (canto com o selo de
lápis) para abrir uma grade com os mesmos ícones já usados na biblioteca
de destaques — escolher um aplica na hora. Não é preciso clicar em Salvar
para ver a mudança, mas ela só persiste no Supabase no próximo Salvar (a
menos que o analista já exista e a alteração seja salva junto com o resto
dos campos do card).

---

## 6. Biblioteca de destaques (sem IA)

O arquivo `js/destaques.js` contém 34 destaques prontos, cada um com texto,
ícone (Font Awesome 6) e cor — por exemplo:

> 📈 Evolução da observabilidade dos ambientes
> 🎧 Suporte contínuo e sustentação dos ambientes
> ⚙️ Evolução da automação operacional
> 🚀 Aceleração dos pipelines de entrega
> 🛡️ Fortalecimento da estabilidade operacional

### Múltiplos destaques por daily (1 a 4)

Cada daily pode ter **de 1 a 4** destaques principais exibidos lado a lado
no cabeçalho. Em Modo Edição:

- Os destaques já escolhidos aparecem como **chips** coloridos, cada um
  com um **×** para remover.
- Logo abaixo, um seletor **"+ Adicionar destaque..."** lista apenas as
  opções da biblioteca **ainda não escolhidas** (evita duplicidade
  automaticamente).
- Ao atingir 4 destaques, o seletor de adicionar some e aparece o aviso
  "Máximo de 4 destaques por daily atingido — remova um para adicionar
  outro."
- Sair do Modo Edição sem nenhum destaque escolhido é permitido (a daily
  simplesmente não exibe nenhum chip no cabeçalho) — não há obrigação
  rígida de ter ao menos 1, embora o uso normal recomendado seja escolher
  pelo menos um destaque por daily.

**Para adicionar, editar ou remover opções da biblioteca**, edite apenas o
array `DESTAQUES_BIBLIOTECA` em `js/destaques.js` — nenhuma outra mudança
de código é necessária. Cada item segue o formato:

```javascript
{ chave: 'observabilidade', texto: 'Evolução da observabilidade dos ambientes', icone: 'fa-solid fa-chart-line', cor: '#259A6C' }
```

> Esses mesmos 34 ícones também alimentam o seletor de ícone do indicador
> (badge) de cada analista — ver seção 5, "Trocar o ícone do indicador".

---

## 7. Exportação e compartilhamento

A exportação usa duas estratégias: a captura normal e, se o navegador rejeitar o canvas, um **modo compatível automático** com menos pixels e efeitos gráficos simplificados. Imagens externas sem CORS são substituídas por um avatar local apenas no PNG, sem alterar os dados salvos.


- **Imagem (PNG)**: captura a página inteira — cabeçalho, destaque, todos
  os cards (com **todas** as entregas, mesmo as que ficam ocultas pelo
  scroll interno na tela) e rodapé.
- **Link**: copia a URL atual para a área de transferência, incluindo (no
  hash da URL) a busca, ordenação e a daily específica que estiver sendo
  visualizada — útil para compartilhar uma consulta já filtrada ou uma
  daily antiga específica.

Não há mais exportação/importação de JSON — não fazem sentido com os
dados persistidos em banco.

---

## 8. Estrutura do banco de dados

```
dailies                 analistas                entregas              destaques             destaques_cabecalho
─────────               ──────────               ─────────             ─────────             ───────────────────
id (uuid, pk)            id (uuid, pk)            id (uuid, pk)         id (uuid, pk)         id (uuid, pk)
data_daily (date, uniq)  daily_id (fk)            daily_id (fk)         daily_id (fk)         daily_id (fk)
titulo                   nome                     analista_id (fk)      texto                 chave
subtitulo                cargo                    texto                 icone                 texto
descricao                foto                      ordem                ordem                 icone
created_at / updated_at  badge_numero                                                          cor
                         badge_texto                                                            ordem
                         badge_icone
                         cor_tema
                         tags (text[])
                         ordem
```

- `destaques_cabecalho` guarda **de 1 a 4 linhas por daily** — os
  destaques principais exibidos no cabeçalho, escolhidos manualmente na
  biblioteca local (`js/destaques.js`). O campo `chave` identifica qual
  item da biblioteca foi escolhido (permite re-selecionar o item certo
  ao reabrir a daily em Modo Edição); `texto/icone/cor` são uma cópia do
  resultado, para a leitura não depender da biblioteca estar carregada.
  Um trigger no banco bloqueia um 5º registro por segurança (a interface
  já impede isso antes de chegar ao banco).
- `analistas.badge_icone` guarda o ícone do indicador de cada analista,
  escolhido na mesma grade de ícones da biblioteca de destaques — também
  é só texto (classe Font Awesome), sem geração nem chamada externa.
- `entregas`, `destaques` (rodapé) e `destaques_cabecalho` são apagados e
  reinseridos por inteiro a cada **Salvar** — simples e robusto, sem
  precisar reconciliar diffs.
- `ON DELETE CASCADE`: remover uma daily remove automaticamente seus
  analistas, entregas e destaques associados (de ambas as tabelas de
  destaque). É o que faz o botão **Excluir** limpar tudo de uma vez, sem
  deixar linhas órfãs.
- **Sem registros vazios.** Uma linha em `dailies` só passa a existir
  quando o usuário salva conteúdo de fato — o app trabalha com um rascunho
  em memória até lá (ver seção 2). Por isso o schema **não** semeia mais
  nenhuma daily de exemplo: o roster inicial é montado em memória pelo
  app, não gravado no banco.

> **Atenção a instalações antigas:** scripts anteriores do `schema.sql` contêm
> políticas `CREATE POLICY` não idempotentes. Não use o `schema.sql` completo
> como migração em um banco já existente. Use somente a migração incremental
> `migration-entregas-trimestrais.sql`. O `schema.sql` inclui rotinas legadas
> que migram destaques, mas deve ser tratado como script de instalação inicial.
> Nas versões antigas: se as colunas antigas `dailies.destaque_texto` /
> `destaque_icone` / `destaque_cor` (modelo de destaque único) ainda
> existirem, o script copia o valor para `destaques_cabecalho` e remove
> as colunas antigas. Basta rodar o arquivo de novo no SQL Editor —
> seguro reexecutar quantas vezes precisar.

Ver `supabase/schema.sql` para o SQL completo, comentado.

---

## 9. Segurança — leia antes de publicar

Por requisito explícito deste projeto, **não há autenticação**: qualquer
pessoa com o link do app pode visualizar **e editar/salvar**. As políticas
de RLS em `supabase/schema.sql` refletem isso: leitura E escrita públicas
em todas as tabelas.

Isso é adequado para uma **ferramenta interna de baixo risco**, como esta
Daily — o mesmo nível de confiança que já existia quando os dados ficavam
apenas no navegador de cada pessoa. Pontos a ter em mente:

- A chave `anon` do Supabase fica embutida no código público do GitHub
  Pages — ela foi concebida para ser pública, **mas as políticas RLS atuais
  concedem escrita irrestrita**. Não trate isso como proteção de segurança
  (e nunca use a chave `service_role` no front-end).
- Qualquer pessoa com o link pode editar ou até excluir dados. Para um
  app interno de equipe pequena isso costuma ser aceitável; não é
  recomendado para dados sensíveis ou públicos na internet sem mais
  controle.
- **Se no futuro for necessário restringir quem pode editar**, é possível
  reativar autenticação trocando as políticas de escrita por
  `USING (auth.role() = 'authenticated')` e habilitando login no Supabase
  Authentication — mas isso está fora do escopo desta versão, que
  prioriza simplicidade.

---

## 10. Compatibilidade

A arquitetura foi preparada para Chrome, Edge, Firefox e Safari (desktop e
mobile). Na v9.0, foram executadas verificações locais de renderização e
fluxos principais com dados simulados em Chromium em larguras de 1440, 390 e
320 px. **A v9.0 não foi validada com o Supabase de produção nem em um
iPhone físico**; recomenda-se realizar esses testes antes do uso da equipe.

Recursos usados: `fetch`, `@supabase/supabase-js` (via CDN), `Canvas`
(compressão de fotos), `URLSearchParams`, `clipboard API` (com fallback via
`execCommand` quando a API rejeita — comum no Safari fora de um gesto
direto do usuário), [html2canvas](https://html2canvas.hertzen.com/)
(exportação PNG, via CDN). Nenhuma dependência de build/bundler — tudo
roda direto no navegador.

---

## 11. Acessibilidade, contraste e experiência mobile

### Contraste nos três temas

Nos temas Escuro e Claro, o cabeçalho e o rodapé (`site-header`/`site-footer`)
usam, de propósito, um fundo escuro. No tema Cooperativo, esses elementos
usam gradientes em verde escuro e verde Sicredi, mantendo texto branco e
amarelo para contraste — um padrão
comum em dashboards corporativos ("masthead" institucional). Componentes
que vivem sobre esse fundo (toast, destaques do rodapé, seletor "Adicionar
destaque", chips de destaque) usam cores de texto **fixas e claras**
(tokens `--graphite-0xx`/`--green-4xx` etc.) em vez dos tokens que trocam
de cor com o tema — evita o problema de texto escuro sobre fundo escuro
que ocorreria se eles seguissem o tema normalmente. Já o **modal de
confirmação** e os demais cartões/inputs acompanham o tema normalmente
(fundo e texto trocam juntos), já que esses sim mudam de aparência entre
claro e escuro.

Caso adicione novos componentes no cabeçalho/rodapé/toast no futuro,
siga o mesmo padrão: cores de texto fixas (tokens brutos), não os tokens
semânticos `--text-primary/secondary/muted` nem `--bg-input` — esses só
devem ser usados em elementos cujo fundo também muda com o tema.

### Áreas de toque e zoom em mobile

- Botões de ação, ícones de remover e itens do seletor de ícones têm
  alvo de toque de pelo menos **40-44px** em telas ≤768px (o tamanho
  recomendado por Apple/Google), mesmo quando visualmente menores no
  desktop.
- Campos de formulário usados fora dos cards (busca, ordenação, seletor
  de data, seletor "Adicionar destaque") usam **fonte ≥16px em mobile**
  — abaixo disso o Safari/iOS aplica zoom automático ao focar o campo,
  o que esta versão evita deliberadamente.
- Modais (confirmação e seletor de ícone) têm altura máxima relativa à
  viewport (`max-height` baseado em `vh`), garantindo que os botões de
  ação fiquem sempre acessíveis mesmo em celulares no modo paisagem
  (telas baixas, ex. ~360px de altura).
- Pills/chips de destaque quebram linha e nunca forçam rolagem horizontal
  da página, mesmo com texto longo em telas estreitas (~320-360px).

---

## 12. Robustez e tratamento de erros

A aplicação foi revisada para não quebrar diante de cenários de borda
comuns em produção:

- **Sem dependência rígida de CDN.** Se a rede bloquear o SDK do Supabase
  ou a biblioteca de imagem (`html2canvas`), o app não estoura erro: cai
  no modo demonstração (no caso do Supabase) ou avisa com mensagem clara
  (no caso da exportação de imagem), em vez de travar a tela.
- **`localStorage` protegido.** Em navegação privada de alguns navegadores
  (ex.: Safari iOS) ou com armazenamento bloqueado, ler/gravar o tema
  pode lançar exceção. Isso é tratado — na pior hipótese o tema apenas não
  é lembrado entre sessões, sem afetar o resto do app.
- **Entrada de dados defensiva.** Funções de exibição (ex.: geração das
  iniciais do avatar) lidam com nomes vazios, só com espaços ou nulos sem
  lançar erro.
- **Operações de rede com tratamento de erro.** Salvar, excluir, carregar
  e trocar de data capturam falhas e mostram um aviso amigável, mantendo a
  interface utilizável.
- **Segurança contra injeção.** Todo dado vindo do banco/usuário é
  escapado antes de ir para o HTML (texto via escape de HTML; cores
  validadas contra um formato seguro antes de entrar em `style`),
  protegendo contra XSS mesmo que algum valor malicioso seja gravado nas
  tabelas. Como não há autenticação (ver seção 9), essa sanitização na
  leitura é a principal barreira — mantenha-a ao editar o código.

## Bloqueio de edição (v8.3)

Antes de publicar esta versão em um ambiente que já possui o banco criado, execute no SQL Editor do Supabase o arquivo `supabase/migration-edit-lock.sql`. Ele cria o bloqueio global atômico, com renovação automática e expiração de segurança em 120 segundos.

---

## 13. Nova página — Entrega Trimestral (v9.0)

Na navegação superior, clique em **Entrega Trimestral**. A interface possui:

- **Cadastro/edição/exclusão**: owners (um ou vários nomes), número do épico
  (ex.: `CORE-123`), iniciativa (texto livre) e data de entrega (calendário).
- **Histórico persistente**: cada entrega é um registro próprio em
  `public.entregas_trimestrais`; editar atualiza o registro e excluir remove
  somente a entrega selecionada, nunca uma daily.
- **Agrupamento automático** por trimestre e ano, calculado a partir da
  data de entrega (sem entrada duplicada de trimestre).
- **Pesquisa** por owners, número do épico ou iniciativa, além de filtros por
  ano e trimestre. O topo mostra quantidade total, entregas do trimestre
  atual e total de trimestres com registros.
- **Edição exclusiva entre as duas páginas**: o novo CRUD utiliza a mesma
  chave de bloqueio global das dailies, com renovação a cada 30 segundos,
  duração de 120 segundos e liberação no cancelamento/salvamento.

A interface funciona com os três temas já existentes, inclusive Safari no
smartphone, e não usa dados fictícios como se estivessem salvos: sem tabela
ou Supabase acessível, exibe instrução explícita de configuração.

### Publicar a versão no GitHub Pages

1. **Antes de subir o código**, execute a migração trimestral acima no SQL
   Editor do Supabase atual (se a aplicação já está em produção).
2. Faça backup do repositório atual e envie **todo o conteúdo interno** da
   pasta do ZIP para a raiz do repositório GitHub (substitua arquivos
   existentes e inclua os novos). Preserve `js/config.js` do pacote ou
   confira sua configuração de URL e chave pública.
3. Confirme que `index.html` e `entrega-trimestral.html` estão ambos na raiz.
   Reaplique a publicação `main / (root)` em Settings → Pages se necessário.
4. Teste uma daily histórica, o PNG, a troca de temas, a navegação entre as
   páginas, e um ciclo **criar → atualizar → recarregar → excluir** no histórico
   trimestral. Teste o bloqueio com duas abas ou dois navegadores distintos.

### Segurança existente (importante)

**O bloqueio evita edições simultâneas dentro da interface, mas não impede
requisições diretas à API.** Assim como a versão anterior, a RLS permite
escrita para a chave pública (`anon`) sem login. O GitHub Pages é público;
portanto, **não coloque informações confidenciais** nesta tabela sem antes
implantar autenticação e RLS restritiva. Nunca use a chave `service_role`
no navegador.

### Arquivos adicionados/alterados

| Arquivo | Ação |
| --- | --- |
| `index.html` | Navegação entre páginas |
| `js/app.js` | Agenda por mês/ano e seletor com grupos |
| `entrega-trimestral.html` | **Novo**: página de histórico trimestral |
| `js/trimestral.js` | **Novo**: CRUD, consulta, filtros, lock cooperativo |
| `css/trimestral.css` | **Novo**: layout responsivo, navegação e agenda |
| `supabase/schema.sql` | Novo schema para instalações do zero |
| `supabase/migration-entregas-trimestrais.sql` | **Novo**: migração para banco existente |
| `PROMPT-MELHORIAS-v9.md` | **Novo**: especificação técnica completa |
| `README.md` | Instruções de migração e publicação |

As imagens, `js/destaques.js`, `css/style.css`, `js/config.js` e
`supabase/migration-edit-lock.sql` foram mantidos.

# Daily Core & Crédito — Sicredi

Painel de acompanhamento da Daily do time **Core & Crédito** (Coordenação de
DevOps · Confederação Sicredi). Aplicação **front-end estático** (HTML/CSS/JS
puro) publicado no **GitHub Pages**, com **Supabase** como única fonte de
dados — sem JSON local, sem login, sem IA, sem custo de API.

> **v7.0** — volta à simplicidade: a versão anterior havia experimentado
> geração de destaques por IA (Anthropic/OpenAI) com painel administrativo
> autenticado. Esta versão remove tudo isso. O destaque executivo do
> cabeçalho agora é escolhido manualmente de uma biblioteca local com 34
> opções prontas, e qualquer pessoa que abrir o app pode editar e salvar
> diretamente — exatamente como nas primeiras versões, só que agora os
> dados ficam no Supabase (compartilhados entre todo o time) em vez do
> navegador local de cada um.

---

## 1. Estrutura do projeto

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          ← lógica da aplicação
│   ├── config.js        ← credenciais do Supabase (edite aqui)
│   └── destaques.js      ← biblioteca de 34 destaques prontos
├── assets/
│   ├── fotos/             ← fotos padrão dos analistas
│   └── img/                 ← logo Sicredi (opcional)
└── supabase/
    └── schema.sql            ← SQL completo: tabelas, índices, RLS, seed
```

Não há mais `data/analistas.json`, não há `admin.html`, não há
`supabase/functions/`. Tudo foi removido propositalmente.

---

## 2. Como funciona (visão geral)

- **Supabase é a única fonte de dados.** Todas as dailies, analistas,
  entregas e destaques ficam em 4 tabelas (`dailies`, `analistas`,
  `entregas`, `destaques`) — ver `supabase/schema.sql`.
- **Sem login.** Qualquer pessoa que abrir o link do app pode clicar em
  **Editar**, alterar o que quiser e **Salvar** — sem usuário, sem senha.
  É o mesmo nível de confiança que já existia quando os dados ficavam só
  no navegador; a diferença é que agora ficam compartilhados entre todo o
  time e com histórico permanente.
- **Sem IA.** O destaque do cabeçalho (ex.: *"Evolução da observabilidade
  dos ambientes"*) é escolhido manualmente, em Modo Edição, de uma lista
  fixa de 34 opções prontas (texto + ícone + cor) — zero chamadas de rede,
  zero custo, zero chave de API.
- **A daily de hoje é criada sozinha.** Ao abrir o app, ele verifica se já
  existe uma daily com a data de hoje:
  - **Se existir**, carrega normalmente.
  - **Se não existir**, cria automaticamente copiando o **roster de
    analistas** (nome, cargo, foto, cor, tags) da daily anterior mais
    recente — mas com **entregas, badge e destaque do cabeçalho vazios**,
    prontos para o time preencher do zero. Na primeiríssima vez que o app
    roda (banco totalmente vazio), ele semeia com os 4 integrantes padrão
    do time.
- **Histórico sempre disponível.** No lugar onde antes ficava a data
  "fixa" do cabeçalho, agora há um seletor — escolher uma data anterior
  carrega aquela daily inteira (cabeçalho, cards, destaques) na hora, sem
  recarregar a página.

---

## 3. Configurar o Supabase (obrigatório para persistência)

### 3.1 Criar o projeto e as tabelas

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** e execute todo o conteúdo de `supabase/schema.sql`.
   Isso cria as 4 tabelas, índices, um trigger de `updated_at` e as
   políticas de RLS (veja a seção de Segurança abaixo). Ao final, se o
   banco estiver vazio, o script semeia automaticamente a daily de hoje
   com o roster padrão do time (conveniência opcional — o app também sabe
   fazer isso sozinho).

### 3.2 Configurar as credenciais no front-end

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

### 3.3 Modo demonstração (sem configurar nada)

Enquanto `js/config.js` mantiver os valores padrão (URL com `XXXXXXXXXX` ou
`anonKey` vazia), o app **continua funcionando** — mostra um conjunto fixo
de dados de demonstração, com edição liberada normalmente, só que nada é
persistido entre recarregamentos da página. Isso garante que o app nunca
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

1. Abra o link do app — a daily de hoje já estará carregada (criada
   automaticamente se for a primeira vez no dia, com roster copiado de
   ontem e tudo mais vazio).
2. Clique em **Editar**.
3. Preencha as entregas de cada analista (**Adicionar entrega**), ajuste
   badge/número se quiser, edite título/subtítulo/descrição se necessário.
4. Escolha de **1 a 4 Destaques da Daily** nos chips que aparecem no
   cabeçalho (biblioteca de 34 opções prontas — ver seção 6).
5. Adicione os **Destaques da Semana** no rodapé, se quiser
   (**Adicionar destaque**, texto livre).
6. Clique em **Salvar**. Pronto — já está no Supabase, visível para todo
   o time.
7. Clique em **Imagem** para gerar o PNG da página inteira para enviar no
   chat, se for o caso.

### Consultando dailies anteriores

Use o seletor de data no cabeçalho (onde antes ficava só a data fixa) —
ele lista todas as dailies já registradas, mais recente primeiro. Escolher
uma data carrega aquela daily inteira na hora.

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
  analistas, entregas e destaques associados (de ambas as tabelas).

> **Atualizando de uma versão anterior?** O `schema.sql` migra
> automaticamente: se as colunas antigas `dailies.destaque_texto` /
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
  Pages — isso é esperado e seguro *desde que* as políticas de RLS estejam
  configuradas como no `schema.sql` (nunca use a chave `service_role` no
  front-end).
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

Testado em Chrome/Edge/Firefox/Safari recentes (desktop) e em Chrome,
Safari e **Samsung Internet** (Android/iPhone), nas resoluções Desktop
Full HD, Ultrawide, Notebook, iPad/Android (tablet, retrato e paisagem) e
iPhone/Android (celular, retrato e paisagem).

Recursos usados: `fetch`, `@supabase/supabase-js` (via CDN), `Canvas`
(compressão de fotos), `URLSearchParams`, `clipboard API` (com fallback via
`execCommand` quando a API rejeita — comum no Safari fora de um gesto
direto do usuário), [html2canvas](https://html2canvas.hertzen.com/)
(exportação PNG, via CDN). Nenhuma dependência de build/bundler — tudo
roda direto no navegador.

---

## 11. Acessibilidade, contraste e experiência mobile

### Contraste em ambos os temas

O cabeçalho e o rodapé (`site-header`/`site-footer`) usam, de propósito,
um fundo **sempre escuro** em ambos os temas claro/escuro — um padrão
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



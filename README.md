# pesquisa5.0

Site completo baseado nos layouts da pasta Stitch, implementado por etapas.

## Estrutura

- `site/index.html`: pagina inicial com navegação por etapas
- `site/pages/desktop/`: fluxo desktop
- `site/pages/mobile/`: fluxo mobile (PWA)

## Etapas implementadas

1. Base estrutural do site em `site/`
2. Publicação das telas desktop
3. Publicação das telas mobile
4. Navegação central e documentação
5. Padronização visual global com assets compartilhados (`site/assets/site.css` e `site/assets/site.js`)
6. Navegação lateral padronizada em todas as telas desktop — sidebar idêntica com itens consistentes, ícones corretos e estado ativo por página; sidebar adicionada ao `editor-perguntas.html`

## Como executar

Na raiz do projeto:

```bash
python3 -m http.server 8000
```

Depois abra no navegador:

- `http://localhost:8000/site/index.html`

## Backend (API funcional)

Foi adicionada uma API em Node.js com autenticação, pesquisas, respostas, SMTP e usuários.

### Iniciar API

```bash
cd backend
npm install
npm start
```

API disponível em:

- `http://localhost:3000/api`

### Login inicial

- E-mail: `admin@pulsecliente.local`
- Senha: `admin123`

### Telas funcionais (desktop)

- Login: `http://localhost:8000/site/pages/desktop/login.html`
- Dashboard: `http://localhost:8000/site/pages/desktop/dashboard.html`
- Pesquisas: `http://localhost:8000/site/pages/desktop/pesquisas.html`
- Editor: `http://localhost:8000/site/pages/desktop/editor-perguntas.html`
- Usuários: `http://localhost:8000/site/pages/desktop/usuarios.html`
- SMTP: `http://localhost:8000/site/pages/desktop/smtp.html`

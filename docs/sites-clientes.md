# Sites dos clientes: como ligar um site ao painel

Cada site entregue tem um registro em **Sites** (`/sites-clientes`), ligado ao cliente do CRM.
Os leads do formulário do site vão para `site_leads` e aparecem:

- no administrativo, em `/sites-clientes/<id>` (com troca de status);
- no portal do cliente (`/portal/<token>`), na aba **Meu site**.

Eles **não** entram em `/leads`, que é o funil da própria Slick.

## 1. Banco

Rode `supabase/migrations/20261110000000_sites_clientes.sql` no SQL Editor do Supabase (uma vez).

## 2. Cadastrar o site e gerar a chave

Sites → Novo site → escolha o cliente → **Gerar chave**. A chave (`slk_...`) aparece uma vez só.
No projeto do site (variáveis de ambiente na Vercel e no `.env.local`):

```
SLICK_API_URL=https://<endereço do administrativo>
SLICK_SITE_KEY=slk_...
```

## 3. Enviar o lead pelo servidor do site

A chave **não pode ir para o navegador**. Envie por uma server action (ou route handler):

```ts
// src/app/actions.ts (no site do cliente)
'use server'

export async function enviarLead(dados: {
  nome: string
  telefone?: string
  email?: string
  campos?: Record<string, string | string[]>  // demais perguntas do formulário
  pagina?: string
  utm?: Record<string, string>
  _hp?: string                                // campo escondido anti-robô
}) {
  const res = await fetch(`${process.env.SLICK_API_URL}/api/publico/sites/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-site-key': process.env.SLICK_SITE_KEY! },
    body: JSON.stringify({ formulario: 'contato', ...dados }),
    cache: 'no-store',
  })
  return res.ok
}
```

### Regras da API

| Campo | |
|---|---|
| `nome` | obrigatório |
| `telefone` ou `email` | pelo menos um |
| `formulario` | identifica o formulário do site (`contato`, `orcamento`...); padrão `contato` |
| `campos` | `{ chave: valor }` ou `[{ chave, rotulo, valor }]` (até 30) |
| `pagina`, `utm` | opcionais |
| `_hp` | se vier preenchido, a API responde 201 e descarta (robô) |

Respostas: `201` gravado · `401` chave errada · `403` site desativado · `422` campos inválidos (`erros` por campo).

Se o envio falhar, o site não deve travar o visitante (ex.: no Performei, o WhatsApp abre do mesmo jeito).

---

# Editor de conteúdo e área do cliente

## Como o cliente entra

1. No administrativo: **Sites → (site) → Acesso do cliente → Liberar** o e-mail da pessoa.
2. Mande o link `https://<administrativo>/entrar`. O cliente digita o e-mail e recebe um código de 6 dígitos.
   No portal (`/portal/<token>`, aba "Meu site") também tem o botão **Editar meu site**.
3. Em `/meu-site` ele edita o conteúdo (por seções) e vê os contatos do site.

O login do cliente **não é** o Supabase Auth (ver a migration `20261111000000_cliente_login_conteudo.sql`):
é um cookie próprio, conferido no servidor (`lib/cliente-auth`). Ele nunca acessa as telas da equipe.

Variáveis no administrativo (Vercel):

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Slick <acesso@slick.com.br>   # domínio verificado no Resend
```

Sem `RESEND_API_KEY`, em desenvolvimento o código aparece no terminal; em produção o login não funciona.

## Como um site fica editável

O site declara as seções e os campos e serve isso em `GET /api/slick/schema`. Modelo pronto no
Performei (`src/slick/`):

- `estrutura.ts`: seções, campos (`texto`, `textarea`, `imagem`, `link`, `lista`) e textos padrão;
- `conteudo.ts`: `getConteudo()` busca o publicado (`GET /api/publico/sites/conteudo`, cache de 5 min,
  tag `slick-conteudo`) e mistura com os padrões; sem painel, usa os padrões;
- `rico.tsx`: `*destaque*`, `**negrito**`, `~apagado~` sem HTML;
- `app/api/slick/schema` e `app/api/slick/revalidar` (o painel chama ao publicar, com o hash da chave).

Depois de publicar o site: no administrativo, **Editar conteúdo → Buscar estrutura no site**
(ou "Atualizar estrutura do site" quando mudar campos).

## Publicar

Rascunho salva sozinho. **Publicar** grava, guarda uma versão (Histórico → Carregar volta uma versão
antiga para o editor) e avisa o site; o site mostra o novo conteúdo na próxima visita.
Se o aviso falhar, o site atualiza sozinho em até 5 minutos.
Imagens vão para o bucket público `sites-conteudo` (JPG/PNG/WEBP/AVIF, até 5 MB).

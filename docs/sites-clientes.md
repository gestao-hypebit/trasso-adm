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

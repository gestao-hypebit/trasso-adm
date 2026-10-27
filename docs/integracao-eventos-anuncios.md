# Integração: eventos de funil → Gestão de Anúncios

Como o sistema de uma marca (ex.: Catálogo Place) avisa o administrativo da Slick
quando um cliente se cadastra, ativa, assina ou cancela. Com isso o painel
`/anuncios` calcula custo por cadastro, CAC e receita gerada por anúncio.

## 1. Pré-requisitos

1. No administrativo: **Anúncios → Configurações → Catálogo Place → Gerar chave de API**.
   A chave aparece uma vez só (`slk_…`). Trocar a chave invalida a anterior na hora.
2. No servidor do Catálogo Place, crie as variáveis:
   ```
   SLICK_ADMIN_URL=https://<domínio do administrativo>   # sem barra no final
   SLICK_EVENTOS_API_KEY=slk_...
   ```
   A chave é secreta: **só no backend**. Nunca no front-end, no app ou no repositório.

## 2. Capturar a origem do anúncio

Nos anúncios do Meta, preencha **Parâmetros de URL** (nível do anúncio) com:

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}
```

`{{campaign.id}}` e `{{ad.id}}` são preenchidos pelo próprio Meta, então a atribuição
não depende do nome da campanha.

No Catálogo Place:

- Na primeira visita, leia `utm_source`, `utm_campaign` e `utm_content` da URL e guarde
  (cookie de 1ª parte ou localStorage, ~30 dias, **primeiro toque**: não sobrescreva
  se já existir).
- No cadastro, salve esses três valores **junto do cliente** no banco. Os eventos
  seguintes (ativação, assinatura, cancelamento) reaproveitam os mesmos valores.
  O administrativo também atribui pelo histórico do cliente, mas mandar sempre é mais seguro.

## 2.1. Eventos do Meta Pixel (para o funil)

A aba **Anúncios → Funil** mostra o caminho de quem vê a página até quem assina.
As etapas do pixel só aparecem se o site disparar os eventos. Use **eventos padrão**:
nos insights dos anúncios, os personalizados chegam todos juntos, sem nome, e não
dá para separar um do outro.

| Momento | Chamada no site |
|---|---|
| Página carregada | `fbq('track', 'PageView')` (já vem no código base do pixel) |
| Clicou em "Teste grátis" | `fbq('track', 'InitiateCheckout')` |
| Concluiu o cadastro | `fbq('track', 'CompleteRegistration')` |
| Teste iniciado (se for um passo à parte) | `fbq('track', 'StartTrial', { value: 0, currency: 'BRL' })` |
| Pagou a assinatura | `fbq('track', 'Subscribe', { value: 89.9, currency: 'BRL' })` |

- Dispare cada evento **uma vez por ação** (ex.: no clique do botão, não a cada render).
- Se o cadastro/assinatura também for enviado pelo servidor (Conversions API), use o
  mesmo `eventID` no navegador e no servidor para o Meta não contar duas vezes.
- O pixel precisa estar atribuído ao Usuário do Sistema no Business Manager
  (Configurações do negócio → Usuários do sistema → Atribuir ativos → Conjuntos de
  dados/Pixels → "Ver"). Sem isso, o funil "Site (todo o tráfego)" não consegue ler os números.
- Os eventos do pixel medem o comportamento no site. Os números **reais** de cadastro e
  assinatura continuam vindo do endpoint abaixo, que é o que conta para CAC e receita.

## 3. Endpoint

```
POST {SLICK_ADMIN_URL}/api/publico/anuncios/eventos
Content-Type: application/json
x-api-key: {SLICK_EVENTOS_API_KEY}
```

Corpo: um evento, ou `{ "eventos": [ ... ] }` com até 100 eventos.

| Campo          | Obrigatório | Descrição |
|----------------|-------------|-----------|
| `marca`        | sim | `catalogo-place` (o slug da marca; precisa bater com a chave) |
| `evento_id`    | recomendado | ID único do evento no seu sistema. Reenviar o mesmo ID não duplica. Sem ele, o ID vira `tipo:cliente_id:data`. |
| `tipo`         | sim | `cadastro`, `ativacao`, `assinatura` ou `cancelamento` |
| `cliente_id`   | sim | ID interno do cliente no Catálogo Place. **Nunca** e-mail, nome, telefone ou CPF. |
| `data`         | sim | ISO 8601 com fuso, ex.: `2026-10-27T14:30:00-03:00`. Sem fuso = horário de Brasília. |
| `valor`        | só em `assinatura` | Valor **mensal** da assinatura em reais (ex.: `89.9`) |
| `utm_source`   | não | ex.: `meta` |
| `utm_campaign` | não | ID da campanha (`{{campaign.id}}`) |
| `utm_content`  | não | ID do anúncio (`{{ad.id}}`) |
| `ad_id`        | não | ID numérico do anúncio, se você tiver separado. Sem ele, um `utm_content` numérico vale como `ad_id`. |

### Quando disparar cada evento

| Evento | Quando |
|---|---|
| `cadastro` | A conta foi criada (início do teste grátis). |
| `ativacao` | O cliente fez a ação que mostra uso real, ex.: cadastrou o 1º produto. Uma vez por cliente. |
| `assinatura` | O 1º pagamento foi confirmado. Se mudar de plano, mande outra `assinatura` com o novo valor (vale a última). |
| `cancelamento` | A assinatura foi encerrada. Se voltar a assinar depois, mande uma nova `assinatura`. |

Envie **pelo servidor** e de forma assíncrona (fila/job ou `try/catch` sem travar o
fluxo do usuário). Em caso de falha (rede ou 5xx), tente de novo depois com o
**mesmo `evento_id`**.

## 4. Exemplos

```bash
curl -X POST "$SLICK_ADMIN_URL/api/publico/anuncios/eventos" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $SLICK_EVENTOS_API_KEY" \
  -d '{
    "marca": "catalogo-place",
    "evento_id": "cadastro-8812",
    "tipo": "cadastro",
    "cliente_id": "8812",
    "data": "2026-10-27T14:30:00-03:00",
    "utm_source": "meta",
    "utm_campaign": "120210000000000001",
    "utm_content": "120210000000000099"
  }'
```

Assinatura:

```json
{ "marca": "catalogo-place", "evento_id": "assinatura-8812-1", "tipo": "assinatura",
  "cliente_id": "8812", "data": "2026-11-03T09:12:00-03:00", "valor": 89.9,
  "utm_source": "meta", "utm_campaign": "120210000000000001", "utm_content": "120210000000000099" }
```

Node/TypeScript (no backend do Catálogo Place):

```ts
type EventoFunil = {
  evento_id: string
  tipo: 'cadastro' | 'ativacao' | 'assinatura' | 'cancelamento'
  cliente_id: string
  data: string
  valor?: number
  utm_source?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
}

export async function enviarEventoSlick(e: EventoFunil) {
  const url = process.env.SLICK_ADMIN_URL
  const chave = process.env.SLICK_EVENTOS_API_KEY
  if (!url || !chave) return
  try {
    const res = await fetch(`${url}/api/publico/anuncios/eventos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': chave },
      body: JSON.stringify({ marca: 'catalogo-place', ...e }),
      signal: AbortSignal.timeout(10_000),
    })
    // 4xx = erro no envio (não adianta repetir igual); 5xx = tentar de novo depois.
    if (!res.ok) console.error('[slick-eventos]', res.status, e.tipo, e.evento_id)
  } catch {
    console.error('[slick-eventos] falha de rede', e.tipo, e.evento_id)
  }
}
```

Não logue o corpo inteiro nem a chave: só tipo, `evento_id` e status.

## 5. Respostas

| Status | Significado |
|---|---|
| `201` | `{ ok, recebidos, gravados, repetidos }`. `repetidos` são `evento_id` já recebidos antes. |
| `400` | JSON inválido, ou lista vazia ou com mais de 100 eventos. |
| `401` | Chave ausente ou inválida. |
| `403` | `marca` diferente da marca da chave. |
| `422` | Validação: `{ erros: [{ indice, campo, mensagem }] }`. Nada do lote é gravado. |
| `500` | Erro do administrativo: tente de novo com o mesmo `evento_id`. |

## 6. Histórico (opcional)

Para ver o passado no painel, envie os eventos antigos em lotes de 100, com as datas
reais e `evento_id` estáveis (ex.: `cadastro-<id do cliente>`). Pode rodar o script
mais de uma vez sem duplicar.

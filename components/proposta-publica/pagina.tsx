import { notFound } from 'next/navigation'
import { Permanent_Marker } from 'next/font/google'
import { ArrowDown, CheckCircle2, ChevronDown, Clock, MessageCircle, RefreshCw, XCircle } from 'lucide-react'
import { getClienteByToken, registrarAcessoPortal } from '@/lib/portal/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { PERIODOS, parseItem, resumoInvestimento } from '@/lib/propostas/itens'
import { PdfDownloadLinkClient } from '@/components/portal/pdf-download-link-client'
import { DecisaoProposta } from '@/components/proposta-publica/decisao'
import { formatCurrency, formatDate, whatsappUrl, cn } from '@/lib/utils'

const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker' })

type Item = { id: string; descricao: string; quantidade: number; valor_unitario: number; ordem: number; recorrencia?: string }
type Proposta = {
  id: string; numero: string; titulo: string; descricao: string | null; status: string
  validade: string | null; condicoes_pagamento: string | null; observacoes: string | null
  created_at: string; enviada_em: string | null; aprovada_em: string | null
  desconto_percentual: number; valor_total: number; cliente_id: string
  clientes: { nome: string; empresa: string | null; email: string | null } | null
  responsavel: { nome: string } | null
  proposta_itens: Item[]
}

// Etapas reais do processo (as mesmas do site, sem prazos: cada projeto tem o seu).
// A proposta é a etapa 2.
const ETAPAS = [
  { titulo: 'Você conta o problema', descricao: 'Uma conversa pra entender seu negócio, seu público e o que precisa sair do papel.' },
  { titulo: 'Proposta clara, por escrito', descricao: 'Escopo, prazo e valor fechados antes de começar. Sem letra miúda.' },
  { titulo: 'Protótipo antes do código', descricao: 'Você clica nas telas e aprova antes de uma linha de código ser escrita.' },
  { titulo: 'Você acompanha cada etapa', descricao: 'Entregas que você vê de perto, até o projeto ir pro ar. E a gente segue junto depois.' },
]

const diaISO = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d)

// Texto livre, lido em blocos separados por linha em branco:
//   linha curta sozinha (sem pontuação final) → título de seção;
//   bloco com várias linhas, ou linhas com "•", "-" ou "*" → lista;
//   o resto → parágrafo. Itens depois de "Não incluso…" ganham um "×".
const MARCADOR = /^[-•*·–]\s+/
const ehTitulo = (linha: string) => linha.length <= 48 && !/[.:;,!?)]$/.test(linha) && !MARCADOR.test(linha)

type Secao = { titulo: string; blocos: string[][]; excluidos: boolean }

// Divide o texto em introdução (antes do 1º título) e seções com título.
function lerSecoes(texto: string) {
  const blocos = texto.split(/\r?\n\s*\r?\n/).map(b => b.split(/\r?\n/).map(l => l.trim()).filter(Boolean)).filter(b => b.length)
  const intro: string[][] = []
  const secoes: Secao[] = []
  blocos.forEach((linhas, i) => {
    if (linhas.length === 1 && ehTitulo(linhas[0]) && i < blocos.length - 1) {
      secoes.push({ titulo: linhas[0], blocos: [], excluidos: /n[ãa]o (est[áa] )?inclu/i.test(linhas[0]) })
    } else if (secoes.length) secoes[secoes.length - 1].blocos.push(linhas)
    else intro.push(linhas)
  })
  return { intro, secoes }
}

const itensDe = (blocos: string[][]) => blocos.reduce((n, b) => n + (b.length > 1 || MARCADOR.test(b[0]) ? b.length : 0), 0)

function Blocos({ blocos, excluidos = false }: { blocos: string[][]; excluidos?: boolean }) {
  return (
    <>
      {blocos.map((linhas, i) => linhas.length === 1 && !MARCADOR.test(linhas[0])
        ? <p key={i}>{linhas[0]}</p>
        : (
          <ul key={i} className="space-y-2.5">
            {linhas.map((l, k) => (
              <li key={k} className="flex gap-3">
                {excluidos
                  ? <span className="mt-[0.15em] w-1.5 shrink-0 text-center text-sm leading-none opacity-50" aria-hidden>×</span>
                  : <span className="pp-ponto mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A8F300]" />}
                <span className={cn(excluidos && 'opacity-60')}>{l.replace(MARCADOR, '')}</span>
              </li>
            ))}
          </ul>
        ))}
    </>
  )
}

// Textos curtos (observações, condições): tudo à mostra, títulos em linha.
function TextoLivre({ texto, className }: { texto: string; className?: string }) {
  const { intro, secoes } = lerSecoes(texto)
  return (
    <div className={cn('space-y-5', className)}>
      <Blocos blocos={intro} />
      {secoes.map((s) => (
        <div key={s.titulo} className="space-y-5">
          <h3 className="pp-display !mt-10 text-xl font-bold">{s.titulo}</h3>
          <Blocos blocos={s.blocos} excluidos={s.excluidos} />
        </div>
      ))}
    </div>
  )
}

// Descrição do projeto: a introdução fica à mostra e cada seção com título
// vira uma linha que abre e fecha, com a contagem de itens no resumo.
function DescricaoProjeto({ texto }: { texto: string }) {
  const { intro, secoes } = lerSecoes(texto)
  return (
    <div>
      {intro.length > 0 && (
        <div className="space-y-5 text-lg leading-relaxed text-[#F7F2FF]/75">
          <Blocos blocos={intro} />
        </div>
      )}
      {secoes.length > 0 && (
        <div className={cn('border-b border-white/10', intro.length > 0 && 'mt-10')}>
          {secoes.map((s) => {
            const qtd = itensDe(s.blocos)
            return (
              <details key={s.titulo} className="group border-t border-white/10">
                <summary className="pp-foco flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span className={cn('pp-display text-xl font-bold', s.excluidos && 'text-[#F7F2FF]/60')}>{s.titulo}</span>
                  <span className="flex shrink-0 items-center gap-3 text-sm text-[#F7F2FF]/45">
                    {qtd > 0 && `${qtd} ${qtd === 1 ? 'item' : 'itens'}`}
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="space-y-5 pb-7 text-[15px] leading-relaxed text-[#F7F2FF]/70">
                  <Blocos blocos={s.blocos} excluidos={s.excluidos} />
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Página da proposta para o cliente. Usada pelo link longo (/proposta/<token>/<id>)
// e pelo curto (/proposta/<slug>).
export async function PaginaProposta({ token, id }: { token: string; id: string }) {
  const cliente = await getClienteByToken(token)
  if (!cliente) notFound()

  const supabase = createServiceClient() as any
  const [{ data: proposta }, { data: config }] = await Promise.all([
    supabase
      .from('propostas')
      .select('*, clientes(nome, empresa, email), responsavel:profiles!propostas_responsavel_id_fkey(nome), proposta_itens(*)')
      .eq('id', id)
      .eq('cliente_id', cliente.id)
      .neq('status', 'rascunho')
      .maybeSingle() as Promise<{ data: Proposta | null }>,
    supabase.from('configuracoes_agencia').select('nome, logo_url, telefone, site').limit(1).maybeSingle(),
  ])
  if (!proposta) notFound()
  await registrarAcessoPortal(cliente.id)

  const agenciaNome: string = config?.nome ?? 'Slick'
  const logoUrl: string | null = config?.logo_url ?? null
  const itens = [...proposta.proposta_itens].sort((a, b) => a.ordem - b.ordem)
  const inv = resumoInvestimento(itens, proposta.desconto_percentual)
  const paraQuem = cliente.empresa || cliente.nome
  // Nome inteiro: "DJ Turin" não pode virar "DJ".
  const nomeCliente = cliente.nome.trim()

  const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
  const diasRestantes = proposta.validade ? Math.round((new Date(diaISO(proposta.validade)).getTime() - hoje.getTime()) / 86400000) : null
  const vencida = diasRestantes !== null && diasRestantes < 0
  const aberta = ['enviada', 'em_negociacao'].includes(proposta.status) && !vencida
  const aprovada = proposta.status === 'aprovada'

  const zap = whatsappUrl(config?.telefone, `Olá! Sou ${nomeCliente}${cliente.empresa ? `, da ${cliente.empresa}` : ''}. Estou vendo a proposta ${proposta.numero} — ${proposta.titulo} e queria conversar.`)

  // Valor que resume a proposta (barra fixa e topo do investimento).
  const principal = inv.mostraInicial
    ? { valor: inv.subtotalAvulso * inv.fator, sufixo: '' }
    : { valor: (inv.porPeriodo[0]?.valor ?? 0) * inv.fator, sufixo: PERIODOS[inv.porPeriodo[0]?.periodo ?? '']?.sufixo ?? '' }

  const etapaAtual = aprovada ? 2 : 1

  return (
    <div className={cn(marker.variable, 'pp min-h-screen bg-[#1A0533] text-[#F7F2FF] antialiased', aberta && 'pb-24')} style={{ fontFamily: 'var(--font-inter)' }}>
      <style>{`
        .pp-display { font-family: var(--font-space-grotesk); letter-spacing: -0.035em; }
        .pp-mono { font-family: var(--font-jetbrains-mono); letter-spacing: 0.08em; text-transform: uppercase; }
        .pp-marker { font-family: var(--font-marker); }
        .pp-tarja { background: linear-gradient(transparent 12%, #A8F300 12%, #A8F300 88%, transparent 88%); color: #1A0533; padding: 0 .18em; margin: 0 -.06em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
        .pp-foco:focus-visible { outline: 2px solid #A8F300; outline-offset: 3px; }
        @keyframes pp-sobe { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .pp-entra { animation: pp-sobe .7s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .pp-entra { animation: none; } }
      `}</style>

      {/* ── Topo ── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        {logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logoUrl} alt={agenciaNome} className="h-10 w-auto sm:h-12" />
          : <span className="pp-display text-xl font-bold lowercase">{agenciaNome}</span>}
        <div className="flex items-center gap-3">
          <span className="pp-mono hidden text-[11px] text-[#F7F2FF]/45 sm:inline">Proposta {proposta.numero}</span>
          <PdfDownloadLinkClient proposta={proposta} logoUrl={logoUrl} agenciaNome={agenciaNome} />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20">
        <p className="pp-mono pp-entra mb-6 text-xs text-[#F7F2FF]/55">
          Proposta para <span className="pp-tarja text-sm font-bold">{paraQuem}</span>
        </p>
        <h1 className="pp-display pp-entra max-w-4xl text-[2.6rem] font-bold leading-[0.98] sm:text-7xl" style={{ animationDelay: '80ms' }}>
          {proposta.titulo}
        </h1>
        <p className="pp-entra mt-7 max-w-xl text-lg leading-relaxed text-[#F7F2FF]/65" style={{ animationDelay: '160ms' }}>
          {nomeCliente}, aqui está tudo o que combinamos num lugar só: o que vamos fazer, quanto custa e como seguimos daqui.
        </p>

        {aprovada && (
          <div className="pp-entra mt-10 flex max-w-xl items-start gap-3 rounded-2xl border border-[#A8F300]/30 bg-[#A8F300]/[0.08] p-4" style={{ animationDelay: '220ms' }}>
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#A8F300]" />
            <p className="text-sm leading-relaxed">
              <strong>Proposta aprovada{proposta.aprovada_em ? ` em ${formatDate(proposta.aprovada_em)}` : ''}.</strong>{' '}
              <span className="text-[#F7F2FF]/70">O próximo passo é o contrato, que aparece no seu portal para assinar.</span>
            </p>
          </div>
        )}
        {proposta.status === 'recusada' && (
          <div className="mt-10 flex max-w-xl items-start gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#F7F2FF]/60" />
            <p className="text-sm leading-relaxed text-[#F7F2FF]/75">Esta proposta foi recusada. Se mudou de ideia ou quer outro formato, chama a gente no WhatsApp.</p>
          </div>
        )}
        {vencida && proposta.status !== 'aprovada' && proposta.status !== 'recusada' && (
          <div className="mt-10 flex max-w-xl items-start gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#F7F2FF]/60" />
            <p className="text-sm leading-relaxed text-[#F7F2FF]/75">A validade desta proposta terminou em {formatDate(proposta.validade!)}. Fala com a gente para receber uma versão atualizada.</p>
          </div>
        )}

        <dl className="pp-entra mt-14 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-6 sm:grid-cols-4" style={{ animationDelay: '260ms' }}>
          <div>
            <dt className="pp-mono text-[10px] text-[#F7F2FF]/40">Enviada em</dt>
            <dd className="mt-1 text-sm">{formatDate(proposta.enviada_em ?? proposta.created_at)}</dd>
          </div>
          {proposta.validade && (
            <div>
              <dt className="pp-mono text-[10px] text-[#F7F2FF]/40">Válida até</dt>
              <dd className="mt-1 text-sm">
                {formatDate(proposta.validade)}
                {aberta && diasRestantes !== null && <span className="block text-xs text-[#A8F300]">{diasRestantes === 0 ? 'vence hoje' : `faltam ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}`}</span>}
              </dd>
            </div>
          )}
          {proposta.responsavel?.nome && (
            <div>
              <dt className="pp-mono text-[10px] text-[#F7F2FF]/40">Quem cuida</dt>
              <dd className="mt-1 text-sm">{proposta.responsavel.nome}</dd>
            </div>
          )}
          <div>
            <dt className="pp-mono text-[10px] text-[#F7F2FF]/40">Investimento</dt>
            <dd className="mt-1">
              <a href="#investimento" className="pp-foco inline-flex items-center gap-1 text-sm font-semibold text-[#A8F300] hover:underline">
                {formatCurrency(principal.valor)}{principal.sufixo} <ArrowDown className="h-3.5 w-3.5" />
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* ── O que está incluso ── */}
      {itens.length > 0 && (
        <section className="border-t border-white/[0.07] bg-[#1D0435]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
            <div className="mb-12 flex items-end justify-between gap-6">
              <h2 className="pp-display text-4xl font-bold leading-none sm:text-5xl">O que está incluso</h2>
              <span className="pp-mono shrink-0 text-xs text-[#F7F2FF]/45">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
            </div>
            {[
              { titulo: 'Desenvolvimento', lista: inv.avulsos },
              { titulo: 'Serviços contínuos', lista: inv.recorrentes },
            ].filter(g => g.lista.length > 0).map((g, gi, grupos) => (
              <div key={g.titulo} className={gi > 0 ? 'mt-14' : ''}>
                {grupos.length > 1 && <p className="pp-mono mb-5 text-[11px] text-[#A8F300]">{g.titulo}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  {g.lista.map((item) => {
                    const { nome, features } = parseItem(item.descricao)
                    const periodo = PERIODOS[item.recorrencia ?? '']
                    return (
                      <article key={item.id} className="flex flex-col rounded-3xl border border-white/[0.09] bg-white/[0.02] p-7 sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="pp-display text-xl font-bold leading-tight sm:text-2xl">{nome}</h3>
                          {periodo && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7C3AED]/25 px-2.5 py-1 text-[11px] font-medium text-[#D9C9FF]">
                              <RefreshCw className="h-3 w-3" />{periodo.label}
                            </span>
                          )}
                        </div>
                        {features.length > 0 && (
                          <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed text-[#F7F2FF]/70">
                            {features.map((f, k) => (
                              <li key={k} className="flex gap-3"><span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A8F300]" />{f}</li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-auto pt-7 text-sm text-[#F7F2FF]/50">
                          <span className="font-semibold text-[#F7F2FF]">{formatCurrency(item.quantidade * item.valor_unitario)}</span>
                          {periodo && ` ${periodo.sufixo}`}
                          {item.quantidade > 1 && ` · ${item.quantidade} × ${formatCurrency(item.valor_unitario)}`}
                        </p>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Sobre o projeto ── */}
      {(proposta.descricao || proposta.observacoes) && (
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <h2 className="pp-display text-4xl font-bold leading-none sm:text-5xl">Sobre o projeto</h2>
          <div>
            {proposta.descricao && <DescricaoProjeto texto={proposta.descricao} />}
            {proposta.observacoes && (
              <div className="mt-10 rounded-2xl border-l-2 border-[#7C3AED] bg-white/[0.03] px-6 py-5">
                <p className="pp-mono mb-2 text-[10px] text-[#D9C9FF]">Observações</p>
                <TextoLivre texto={proposta.observacoes} className="text-[15px] leading-relaxed text-[#F7F2FF]/70" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Como é com a gente: marca a etapa em que o cliente está ── */}
      <section className="border-t border-white/[0.07]">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div className="lg:sticky lg:top-12 lg:self-start">
            <p className="pp-mono mb-5 text-[11px] text-[#F7F2FF]/45">Como é com a gente</p>
            <h2 className="pp-display text-4xl font-bold leading-[1.02] sm:text-5xl">
              Sem sumiço, sem tecniquês e sem <span className="pp-tarja">surpresa</span> no fim.
            </h2>
          </div>
          <ol className="border-b border-white/10">
            {ETAPAS.map((e, i) => {
              const atual = i === etapaAtual
              const feita = i < etapaAtual
              return (
                <li key={e.titulo} className="relative grid grid-cols-[2.5rem_1fr] gap-4 border-t border-white/10 py-8">
                  <span className={cn('pp-display pt-0.5 text-lg font-bold', atual ? 'text-[#A8F300]' : feita ? 'text-[#F7F2FF]/30' : 'text-[#F7F2FF]/45')}>{i + 1}</span>
                  <div>
                    <h3 className={cn('text-lg font-bold sm:text-xl', feita && 'text-[#F7F2FF]/45')}>
                      {feita && <CheckCircle2 className="mr-2 inline h-4 w-4 -translate-y-px text-[#A8F300]/70" />}
                      {e.titulo}
                    </h3>
                    <p className={cn('mt-2 max-w-lg text-[15px] leading-relaxed', feita ? 'text-[#F7F2FF]/35' : 'text-[#F7F2FF]/60')}>{e.descricao}</p>
                    {atual && (
                      <span className="pp-marker mt-3 inline-block -rotate-3 text-xl text-[#A8F300] lg:absolute lg:right-0 lg:top-6 lg:mt-0 lg:text-2xl">
                        <span className="lg:hidden">↑ </span><span className="hidden lg:inline">← </span>
                        {aprovada ? 'próximo passo' : 'você está aqui'}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* ── Investimento: muda para "papel" no momento da decisão ── */}
      <section id="investimento" className="scroll-mt-6 bg-[#F7F2FF] text-[#1A0533]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
          <p className="pp-mono mb-5 text-[11px] text-[#1A0533]/50">Investimento</p>
          <div className="grid gap-10 border-b border-[#1A0533]/10 pb-12 md:grid-cols-2">
            {inv.mostraInicial && (
              <div>
                <p className="text-sm font-medium text-[#1A0533]/60">{inv.recorrentes.length > 0 ? 'Investimento inicial' : 'Investimento total'}</p>
                {inv.temDesconto && <p className="mt-2 text-lg text-[#1A0533]/40 line-through">{formatCurrency(inv.subtotalAvulso)}</p>}
                <p className="pp-display mt-1 text-5xl font-bold leading-none sm:text-6xl">{formatCurrency(inv.subtotalAvulso * inv.fator)}</p>
                <p className="mt-3 text-sm text-[#1A0533]/55">Pagamento único</p>
              </div>
            )}
            {inv.recorrentes.length > 0 && (
              <div className={cn(inv.mostraInicial && 'md:border-l md:border-[#1A0533]/10 md:pl-10')}>
                <p className="text-sm font-medium text-[#1A0533]/60">Recorrência</p>
                {inv.temDesconto && inv.porPeriodo.length === 1 && <p className="mt-2 text-lg text-[#1A0533]/40 line-through">{formatCurrency(inv.subtotalRec)}</p>}
                {inv.porPeriodo.map((g, i) => (
                  <p key={g.periodo} className={cn('pp-display mt-1 font-bold leading-none', i === 0 ? 'text-5xl sm:text-6xl' : 'text-2xl')}>
                    {i > 0 && '+ '}{formatCurrency(g.valor * inv.fator)}
                    <span className="ml-1 text-lg font-medium text-[#1A0533]/50">{PERIODOS[g.periodo]?.sufixo ?? ''}</span>
                  </p>
                ))}
                <p className="mt-3 text-sm text-[#1A0533]/55">Enquanto o serviço estiver ativo</p>
              </div>
            )}
          </div>

          {inv.temDesconto && (
            <p className="mt-6 inline-flex rounded-full bg-[#1A0533] px-4 py-1.5 text-sm font-semibold text-[#A8F300]">
              {proposta.desconto_percentual}% de desconto · você economiza {formatCurrency(inv.economia)}
            </p>
          )}

          <div className="mt-10 grid gap-10 md:grid-cols-2">
            {proposta.condicoes_pagamento && (
              <div>
                <h3 className="mb-3 font-bold">Condições de pagamento</h3>
                <TextoLivre texto={proposta.condicoes_pagamento} className="text-[15px] leading-relaxed text-[#1A0533]/70 [&_.pp-ponto]:bg-[#7C3AED]" />
              </div>
            )}
            {proposta.validade && (
              <div>
                <h3 className="mb-3 font-bold">Validade</h3>
                <p className="text-[15px] leading-relaxed text-[#1A0533]/70">Valores garantidos até {formatDate(proposta.validade)}.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Decisão ── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28">
        {aberta ? (
          <div className="max-w-2xl">
            <h2 className="pp-display text-4xl font-bold leading-[1.02] sm:text-6xl">Tudo certo por aí, {nomeCliente}?</h2>
            <p className="mt-5 text-lg leading-relaxed text-[#F7F2FF]/65">
              Aprovando, a gente prepara o contrato e já agenda o começo. Se algo não fechou, recuse ou chama no WhatsApp que a gente ajusta.
            </p>
            <div className="mt-10">
              <DecisaoProposta token={token} propostaId={proposta.id} numero={proposta.numero} agenciaNome={agenciaNome} />
            </div>
            {zap && (
              <a href={zap} target="_blank" rel="noreferrer" className="pp-foco mt-8 inline-flex items-center gap-2 text-sm text-[#F7F2FF]/60 hover:text-[#A8F300]">
                <MessageCircle className="h-4 w-4" /> Prefere conversar antes? Fala com a gente no WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="max-w-2xl">
            <h2 className="pp-display text-4xl font-bold leading-[1.02] sm:text-5xl">{aprovada ? 'Bora começar.' : 'Ficou alguma dúvida?'}</h2>
            {zap && (
              <a href={zap} target="_blank" rel="noreferrer" className="pp-foco mt-8 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-medium hover:border-[#A8F300] hover:text-[#A8F300]">
                <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
              </a>
            )}
          </div>
        )}
        <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-[#F7F2FF]/40">
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#A8F300]" />{agenciaNome} · Proposta {proposta.numero}</span>
          <a href={`/portal/${token}`} className="pp-foco hover:text-[#F7F2FF]">Ir para o seu portal →</a>
        </footer>
      </section>

      {/* ── Barra fixa enquanto a proposta está aberta ── */}
      {aberta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#1A0533]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-xs text-[#F7F2FF]/50">{proposta.titulo}</p>
              <p className="text-sm font-semibold">{formatCurrency(principal.valor)}<span className="font-normal text-[#F7F2FF]/50">{principal.sufixo}</span></p>
            </div>
            <DecisaoProposta token={token} propostaId={proposta.id} numero={proposta.numero} agenciaNome={agenciaNome} compacto />
          </div>
        </div>
      )}
    </div>
  )
}

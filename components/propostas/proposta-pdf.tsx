'use client'

import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'

// Sem isso o react-pdf hifeniza palavras em português ("dig-ital").
Font.registerHyphenationCallback(word => [word])

const NOITE   = '#1A0533'
const VIOLETA = '#7C3AED'
const LIMA    = '#B8F000'
const ROSA    = '#E11D63'
const LAVANDA = '#E2D9F3'
const MUTED   = '#8A7BAE'
const TEXTO   = '#2B2240'
const SUAVE   = '#6B6280'
const LINHA   = '#ECE7F5'
const FUNDO   = '#F7F5FB'
const BRANCO  = '#FFFFFF'

const PAD = 48
const TOP = 40

const PERIODOS: Record<string, { label: string; sufixo: string }> = {
  mensal:     { label: 'Mensal',     sufixo: '/mês' },
  trimestral: { label: 'Trimestral', sufixo: '/trimestre' },
  anual:      { label: 'Anual',      sufixo: '/ano' },
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: TEXTO,
    backgroundColor: BRANCO,
    paddingTop: TOP,
    paddingBottom: 64,
  },

  // ─── CAPA (só na 1ª página) ───
  header: {
    marginTop: -TOP,
    backgroundColor: NOITE,
    paddingHorizontal: PAD,
    paddingTop: 28,
    paddingBottom: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { height: 34, maxWidth: 150, objectFit: 'contain' },
  logoTexto: { color: BRANCO, fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  headerRight: { alignItems: 'flex-end' },
  headerKicker: {
    color: LIMA, fontSize: 7, fontFamily: 'Helvetica-Bold',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
  },
  headerNumero: { color: BRANCO, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  limaLine: { height: 3, backgroundColor: LIMA },

  hero: { paddingHorizontal: PAD, paddingTop: 34, paddingBottom: 26 },
  heroTitulo: {
    color: NOITE, fontSize: 24, fontFamily: 'Helvetica-Bold',
    lineHeight: 1.2, marginBottom: 10, maxWidth: 440,
  },
  heroDescricao: { color: SUAVE, fontSize: 10, lineHeight: 1.6, maxWidth: 440 },

  metaRow: {
    flexDirection: 'row',
    marginHorizontal: PAD,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: LINHA,
    marginBottom: 30,
  },
  metaCell: { flex: 1, paddingVertical: 12, paddingRight: 12 },
  metaCellWide: { flex: 1.6, paddingVertical: 12, paddingRight: 12 },
  metaLabel: {
    color: MUTED, fontSize: 6.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4,
  },
  metaValue: { color: NOITE, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  metaSub: { color: SUAVE, fontSize: 8, marginTop: 2 },

  // ─── SEÇÕES ───
  body: { paddingHorizontal: PAD },
  section: { marginBottom: 26 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  sectionNum: { color: VIOLETA, fontSize: 9, fontFamily: 'Helvetica-Bold', width: 22 },
  sectionTitle: { color: NOITE, fontSize: 12, fontFamily: 'Helvetica-Bold' },
  sectionHint: { color: MUTED, fontSize: 8, marginLeft: 8 },

  // ─── TABELAS ───
  th: {
    flexDirection: 'row',
    paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: FUNDO, borderRadius: 3,
  },
  thText: {
    color: MUTED, fontSize: 6.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 9, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: LINHA,
  },
  colDesc: { flex: 1, paddingRight: 12 },
  colQtd:  { width: 36, textAlign: 'center' },
  colUnit: { width: 78, textAlign: 'right' },
  colPer:  { width: 70, textAlign: 'center' },
  colTot:  { width: 84, textAlign: 'right' },
  tdDesc: { color: TEXTO, fontSize: 9, lineHeight: 1.4 },
  tdMuted: { color: SUAVE, fontSize: 9 },
  tdBold: { color: NOITE, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  subRow: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline',
    paddingTop: 9, paddingHorizontal: 8,
  },
  subLabel: { color: SUAVE, fontSize: 8.5, marginRight: 14 },
  subValue: { color: NOITE, fontSize: 10, fontFamily: 'Helvetica-Bold', width: 110, textAlign: 'right' },

  // ─── RESUMO DO INVESTIMENTO ───
  resumo: {
    backgroundColor: NOITE, borderRadius: 8,
    paddingVertical: 20, paddingHorizontal: 22,
  },
  resumoCols: { flexDirection: 'row' },
  resumoCol: { flex: 1 },
  resumoDivider: { width: 1, backgroundColor: '#3A2560', marginHorizontal: 20 },
  resumoLabel: {
    color: LAVANDA, fontSize: 7, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6,
  },
  resumoValor: { color: LIMA, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  resumoSufixo: { color: LAVANDA, fontSize: 10, fontFamily: 'Helvetica' },
  resumoSub: { color: MUTED, fontSize: 8, marginTop: 5, lineHeight: 1.4 },
  resumoRiscado: { color: MUTED, fontSize: 8.5, textDecoration: 'line-through', marginBottom: 2 },
  descontoBadge: {
    flexDirection: 'row', alignSelf: 'flex-start',
    marginTop: 14, paddingVertical: 4, paddingHorizontal: 9,
    backgroundColor: '#2E1260', borderRadius: 99,
  },
  descontoText: { color: LIMA, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // ─── CONDIÇÕES ───
  dl: { borderTopWidth: 1, borderTopColor: LINHA },
  dlRow: {
    flexDirection: 'row', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: LINHA,
  },
  dt: {
    width: 130, color: MUTED, fontSize: 7, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1, textTransform: 'uppercase', paddingTop: 1.5,
  },
  dd: { flex: 1, color: TEXTO, fontSize: 9, lineHeight: 1.55 },

  // ─── ACEITE ───
  aceiteTexto: { color: SUAVE, fontSize: 8.5, lineHeight: 1.5, marginBottom: 40 },
  assinaturas: { flexDirection: 'row', gap: 40 },
  assinatura: { flex: 1, borderTopWidth: 1, borderTopColor: NOITE, paddingTop: 6 },
  assinaturaNome: { color: NOITE, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  assinaturaSub: { color: SUAVE, fontSize: 7.5, marginTop: 2 },

  // ─── RODAPÉ ───
  footer: {
    position: 'absolute', bottom: 24, left: PAD, right: PAD,
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: LINHA, paddingTop: 10,
  },
  footerMark: { width: 6, height: 6, backgroundColor: LIMA, borderRadius: 3, marginRight: 8 },
  footerText: { color: MUTED, fontSize: 7.5 },
  footerSpacer: { flex: 1 },
})

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Datas "YYYY-MM-DD" viram meia-noite UTC e voltam um dia no fuso BR.
function fmtDate(d: string) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d)
  return data.toLocaleDateString('pt-BR')
}

type Item = {
  id: string; descricao: string; quantidade: number
  valor_unitario: number; ordem: number; recorrencia?: string
}
type Proposta = {
  numero: string; titulo: string; descricao: string | null; status: string
  validade: string | null; condicoes_pagamento: string | null; observacoes: string | null
  created_at: string; desconto_percentual: number; valor_total: number
  clientes: { nome: string; empresa: string | null; email: string | null } | null
  proposta_itens: Item[]
}

function SectionHead({ num, title, hint }: { num: string; title: string; hint?: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionNum}>{num}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {hint && <Text style={s.sectionHint}>{hint}</Text>}
    </View>
  )
}

export function PropostaPDF({ proposta, logoUrl, agenciaNome }: {
  proposta: Proposta
  logoUrl: string | null
  agenciaNome: string
}) {
  const todos = [...(proposta.proposta_itens ?? [])].sort((a, b) => a.ordem - b.ordem)
  const avulsos     = todos.filter(i => !i.recorrencia || i.recorrencia === 'avulso')
  const recorrentes = todos.filter(i => i.recorrencia && i.recorrencia !== 'avulso')

  const total = (itens: Item[]) => itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0)
  const fator = 1 - (proposta.desconto_percentual ?? 0) / 100
  const temDesconto = proposta.desconto_percentual > 0

  const subtotalAvulso = total(avulsos)
  const subtotalRec    = total(recorrentes)

  // Recorrentes agrupados por periodicidade (mensal, trimestral, anual)
  const porPeriodo = Object.keys(PERIODOS)
    .map(p => ({ periodo: p, valor: total(recorrentes.filter(i => i.recorrencia === p)) }))
    .filter(g => g.valor > 0)
  const outrosPeriodos = recorrentes.filter(i => !PERIODOS[i.recorrencia ?? ''])
  if (outrosPeriodos.length) porPeriodo.push({ periodo: 'outro', valor: total(outrosPeriodos) })

  let secao = 0
  const proxima = () => String(++secao).padStart(2, '0')

  return (
    <Document title={`${proposta.numero} — ${proposta.titulo}`} author={agenciaNome}>
      <Page size="A4" style={s.page}>

        {/* ══════════ CAPA ══════════ */}
        <View style={s.header}>
          {logoUrl
            ? <Image src={logoUrl} style={s.logo} />
            : <Text style={s.logoTexto}>{agenciaNome}</Text>}
          <View style={s.headerRight}>
            <Text style={s.headerKicker}>Proposta comercial</Text>
            <Text style={s.headerNumero}>{proposta.numero}</Text>
          </View>
        </View>
        <View style={s.limaLine} />

        <View style={s.hero}>
          <Text style={s.heroTitulo}>{proposta.titulo}</Text>
          {proposta.descricao && <Text style={s.heroDescricao}>{proposta.descricao}</Text>}
        </View>

        <View style={s.metaRow}>
          {proposta.clientes && (
            <View style={s.metaCellWide}>
              <Text style={s.metaLabel}>Preparada para</Text>
              <Text style={s.metaValue}>{proposta.clientes.empresa || proposta.clientes.nome}</Text>
              {proposta.clientes.empresa && <Text style={s.metaSub}>{proposta.clientes.nome}</Text>}
              {proposta.clientes.email && <Text style={s.metaSub}>{proposta.clientes.email}</Text>}
            </View>
          )}
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Emitida em</Text>
            <Text style={s.metaValue}>{fmtDate(proposta.created_at)}</Text>
          </View>
          {proposta.validade && (
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Válida até</Text>
              <Text style={s.metaValue}>{fmtDate(proposta.validade)}</Text>
            </View>
          )}
        </View>

        {/* ══════════ CORPO ══════════ */}
        <View style={s.body}>

          {/* ── Serviços avulsos ── */}
          {avulsos.length > 0 && (
            <View style={s.section}>
              <SectionHead num={proxima()} title="Escopo do projeto" hint="pagamento único" />
              <View style={s.th}>
                <Text style={[s.thText, s.colDesc]}>Serviço / entregável</Text>
                <Text style={[s.thText, s.colQtd]}>Qtd</Text>
                <Text style={[s.thText, s.colUnit]}>Unitário</Text>
                <Text style={[s.thText, s.colTot]}>Total</Text>
              </View>
              {avulsos.map(item => (
                <View key={item.id} style={s.tr} wrap={false}>
                  <Text style={[s.tdDesc, s.colDesc]}>{item.descricao}</Text>
                  <Text style={[s.tdMuted, s.colQtd]}>{item.quantidade}</Text>
                  <Text style={[s.tdMuted, s.colUnit]}>{fmt(item.valor_unitario)}</Text>
                  <Text style={[s.tdBold, s.colTot]}>{fmt(item.quantidade * item.valor_unitario)}</Text>
                </View>
              ))}
              <View style={s.subRow}>
                <Text style={s.subLabel}>Subtotal</Text>
                <Text style={s.subValue}>{fmt(subtotalAvulso)}</Text>
              </View>
            </View>
          )}

          {/* ── Serviços recorrentes ── */}
          {recorrentes.length > 0 && (
            <View style={s.section}>
              <SectionHead num={proxima()} title="Serviços contínuos" hint="cobrança recorrente" />
              <View style={s.th}>
                <Text style={[s.thText, s.colDesc]}>Serviço</Text>
                <Text style={[s.thText, s.colPer]}>Período</Text>
                <Text style={[s.thText, s.colTot]}>Valor</Text>
              </View>
              {recorrentes.map(item => {
                const p = PERIODOS[item.recorrencia ?? '']
                return (
                  <View key={item.id} style={s.tr} wrap={false}>
                    <Text style={[s.tdDesc, s.colDesc]}>
                      {item.quantidade > 1 ? `${item.descricao} (${item.quantidade}×)` : item.descricao}
                    </Text>
                    <Text style={[s.tdMuted, s.colPer]}>{p?.label ?? item.recorrencia}</Text>
                    <Text style={[s.tdBold, s.colTot]}>
                      {fmt(item.quantidade * item.valor_unitario)}{p ? p.sufixo : ''}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* ── Resumo do investimento ── */}
          <View style={s.section} wrap={false}>
            <SectionHead num={proxima()} title="Investimento" />
            <View style={s.resumo}>
              <View style={s.resumoCols}>
                {(avulsos.length > 0 || recorrentes.length === 0) && (
                  <View style={s.resumoCol}>
                    <Text style={s.resumoLabel}>{recorrentes.length > 0 ? 'Investimento inicial' : 'Investimento total'}</Text>
                    {temDesconto && <Text style={s.resumoRiscado}>{fmt(subtotalAvulso)}</Text>}
                    <Text style={s.resumoValor}>{fmt(subtotalAvulso * fator)}</Text>
                    <Text style={s.resumoSub}>Pagamento único</Text>
                  </View>
                )}
                {avulsos.length > 0 && recorrentes.length > 0 && <View style={s.resumoDivider} />}
                {recorrentes.length > 0 && (
                  <View style={s.resumoCol}>
                    <Text style={s.resumoLabel}>Recorrente</Text>
                    {temDesconto && porPeriodo.length === 1 && <Text style={s.resumoRiscado}>{fmt(subtotalRec)}</Text>}
                    {porPeriodo.map((g, idx) => (
                      <Text key={g.periodo} style={idx === 0 ? s.resumoValor : [s.resumoValor, { fontSize: 14, marginTop: 4 }]}>
                        {idx > 0 ? '+ ' : ''}{fmt(g.valor * fator)}
                        <Text style={s.resumoSufixo}> {PERIODOS[g.periodo]?.sufixo ?? ''}</Text>
                      </Text>
                    ))}
                    <Text style={s.resumoSub}>Enquanto o serviço estiver ativo</Text>
                  </View>
                )}
              </View>
              {temDesconto && (
                <View style={s.descontoBadge}>
                  <Text style={s.descontoText}>
                    Desconto de {proposta.desconto_percentual}% aplicado · economia de {fmt((subtotalAvulso + subtotalRec) * (1 - fator))}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Condições ── */}
          {(proposta.condicoes_pagamento || proposta.validade || proposta.observacoes) && (
            <View style={s.section}>
              <SectionHead num={proxima()} title="Condições" />
              <View style={s.dl}>
                {proposta.condicoes_pagamento && (
                  <View style={s.dlRow} wrap={false}>
                    <Text style={s.dt}>Pagamento</Text>
                    <Text style={s.dd}>{proposta.condicoes_pagamento}</Text>
                  </View>
                )}
                {proposta.validade && (
                  <View style={s.dlRow} wrap={false}>
                    <Text style={s.dt}>Validade</Text>
                    <Text style={s.dd}>Esta proposta é válida até {fmtDate(proposta.validade)}.</Text>
                  </View>
                )}
                {proposta.observacoes && (
                  <View style={s.dlRow} wrap={false}>
                    <Text style={s.dt}>Observações</Text>
                    <Text style={s.dd}>{proposta.observacoes}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Aceite ── */}
          <View style={s.section} wrap={false}>
            <SectionHead num={proxima()} title="Aceite" />
            <Text style={s.aceiteTexto}>
              Ao assinar, as partes concordam com o escopo, os valores e as condições descritos nesta proposta.
            </Text>
            <View style={s.assinaturas}>
              <View style={s.assinatura}>
                <Text style={s.assinaturaNome}>{proposta.clientes?.empresa || proposta.clientes?.nome || 'Cliente'}</Text>
                <Text style={s.assinaturaSub}>Cliente · Data ___/___/______</Text>
              </View>
              <View style={s.assinatura}>
                <Text style={s.assinaturaNome}>{agenciaNome}</Text>
                <Text style={s.assinaturaSub}>Agência · Data ___/___/______</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ══════════ RODAPÉ ══════════ */}
        <View style={s.footer} fixed>
          <View style={s.footerMark} />
          <Text style={s.footerText}>{agenciaNome}  ·  {proposta.numero}</Text>
          <View style={s.footerSpacer} />
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

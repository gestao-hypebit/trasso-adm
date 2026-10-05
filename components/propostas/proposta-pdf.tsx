'use client'

import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'

// Sem isso o react-pdf hifeniza palavras em português ("dig-ital").
Font.registerHyphenationCallback(word => [word])

const NOITE   = '#1A0533'
const MEDIO   = '#2E1260'
const VIOLETA = '#7C3AED'
const LIMA    = '#B8F000'
const LAVANDA = '#E2D9F3'
const MUTED   = '#8A7BAE'
const TEXTO   = '#2B2240'
const SUAVE   = '#6B6280'
const LINHA   = '#ECE7F5'
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

  // ─── CABEÇALHO (só na 1ª página) ───
  header: {
    marginTop: -TOP,
    backgroundColor: NOITE,
    paddingHorizontal: PAD,
    paddingTop: 30,
    paddingBottom: 62,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 34,
  },
  logo: { width: 240, height: 60, objectFit: 'contain', objectPositionX: 'left' },
  logoTexto: { color: BRANCO, fontSize: 26, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  kicker: {
    color: LIMA, fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 10,
  },
  titulo: {
    color: BRANCO, fontSize: 30, fontFamily: 'Helvetica-Bold',
    lineHeight: 1.12, maxWidth: 460, marginBottom: 30,
  },

  infoGrid: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#3A2560',
    paddingTop: 14,
  },
  infoCell: { flex: 1, paddingRight: 14 },
  infoCellWide: { flex: 1.5, paddingRight: 14 },
  infoLabel: {
    color: MUTED, fontSize: 6.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5,
  },
  infoValue: { color: BRANCO, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  infoSub: { color: MUTED, fontSize: 8, marginTop: 2 },

  // ─── INVESTIMENTO (cartão sobreposto ao cabeçalho) ───
  invest: {
    marginTop: -38,
    marginHorizontal: PAD,
    backgroundColor: LIMA,
    borderRadius: 10,
    paddingVertical: 22,
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  investCols: { flexDirection: 'row' },
  investCol: { flex: 1 },
  investDivider: { width: 1, backgroundColor: '#9BC900', marginHorizontal: 22 },
  investLabel: {
    color: NOITE, fontSize: 7, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8, opacity: 0.7,
  },
  investValor: { color: NOITE, fontSize: 30, fontFamily: 'Helvetica-Bold', letterSpacing: -0.5 },
  investValorMenor: { color: NOITE, fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  investSufixo: { color: NOITE, fontSize: 11, fontFamily: 'Helvetica' },
  investRiscado: { color: NOITE, fontSize: 9, textDecoration: 'line-through', opacity: 0.55, marginBottom: 2 },
  investSub: { color: NOITE, fontSize: 8, marginTop: 6, opacity: 0.7 },
  investFoot: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: 18, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#9BC900',
  },
  investFootLabel: {
    width: 120, color: NOITE, fontSize: 7, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2, textTransform: 'uppercase', paddingTop: 1.5, opacity: 0.7,
  },
  investFootText: { flex: 1, color: NOITE, fontSize: 9, lineHeight: 1.5 },
  descontoPill: {
    alignSelf: 'flex-start', marginTop: 14,
    backgroundColor: NOITE, borderRadius: 99,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  descontoText: { color: LIMA, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  // ─── SEÇÕES ───
  body: { paddingHorizontal: PAD },
  section: { marginBottom: 34 },
  bigHead: { marginBottom: 16 },
  bigKicker: {
    color: VIOLETA, fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 6,
  },
  bigTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bigTitle: { color: NOITE, fontSize: 26, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3 },
  bigCount: { color: MUTED, fontSize: 9, marginBottom: 4 },
  bigBar: { width: 40, height: 4, backgroundColor: LIMA, marginTop: 10 },

  subHead: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 26, marginBottom: 4,
  },
  subHeadText: {
    color: NOITE, fontSize: 8, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.6, textTransform: 'uppercase', marginRight: 10,
  },
  subHeadLine: { flex: 1, height: 1, backgroundColor: LINHA },

  // ─── MÓDULOS ───
  modulo: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: LINHA,
  },
  moduloNum: {
    width: 40, color: VIOLETA, fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: -0.5,
  },
  moduloBody: { flex: 1, paddingRight: 16 },
  moduloNome: { color: NOITE, fontSize: 11, fontFamily: 'Helvetica-Bold', lineHeight: 1.35 },
  feature: { flexDirection: 'row', marginTop: 4 },
  featureDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: LIMA, marginTop: 4, marginRight: 8 },
  featureText: { flex: 1, color: SUAVE, fontSize: 8.5, lineHeight: 1.45 },
  moduloPreco: { width: 110, alignItems: 'flex-end' },
  moduloValor: { color: NOITE, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  moduloValorSufixo: { color: SUAVE, fontSize: 8, fontFamily: 'Helvetica' },
  moduloQtd: { color: MUTED, fontSize: 7.5, marginTop: 3 },

  // ─── SOBRE / OBSERVAÇÕES ───
  textoBloco: { color: TEXTO, fontSize: 9.5, lineHeight: 1.65 },
  notaBox: {
    marginTop: 18, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#F7F5FB', borderLeftWidth: 3, borderLeftColor: VIOLETA, borderRadius: 3,
  },
  notaLabel: {
    color: VIOLETA, fontSize: 6.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4,
  },
  notaText: { color: TEXTO, fontSize: 8.5, lineHeight: 1.55 },

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

// 1ª linha da descrição do item = nome do módulo; demais linhas = funcionalidades.
function parseItem(descricao: string) {
  const [nome, ...resto] = descricao.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return { nome: nome ?? '', features: resto.map(l => l.replace(/^[-•*·–]\s*/, '')) }
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
  responsavel?: { nome: string } | null
  proposta_itens: Item[]
}

function Modulo({ item, num }: { item: Item; num: number }) {
  const { nome, features } = parseItem(item.descricao)
  const periodo = PERIODOS[item.recorrencia ?? '']
  return (
    <View style={s.modulo} wrap={false}>
      <Text style={s.moduloNum}>{String(num).padStart(2, '0')}</Text>
      <View style={s.moduloBody}>
        <Text style={s.moduloNome}>{nome}</Text>
        {features.map((f, i) => (
          <View key={i} style={s.feature}>
            <View style={s.featureDot} />
            <Text style={s.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <View style={s.moduloPreco}>
        <Text style={s.moduloValor}>
          {fmt(item.quantidade * item.valor_unitario)}
          {periodo && <Text style={s.moduloValorSufixo}> {periodo.sufixo}</Text>}
        </Text>
        {item.quantidade > 1 && (
          <Text style={s.moduloQtd}>{item.quantidade} × {fmt(item.valor_unitario)}</Text>
        )}
        {!periodo && item.recorrencia && item.recorrencia !== 'avulso' && (
          <Text style={s.moduloQtd}>{item.recorrencia}</Text>
        )}
      </View>
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

  const cliente = proposta.clientes
  const mostraInicial = avulsos.length > 0 || recorrentes.length === 0

  return (
    <Document title={`${proposta.numero} — ${proposta.titulo}`} author={agenciaNome}>
      <Page size="A4" style={s.page}>

        {/* ══════════ CABEÇALHO ══════════ */}
        <View style={s.header}>
          <View style={s.headerTop}>
            {logoUrl
              ? <Image src={logoUrl} style={s.logo} />
              : <Text style={s.logoTexto}>{agenciaNome}</Text>}
          </View>

          <Text style={s.kicker}>Proposta comercial</Text>
          <Text style={s.titulo}>{proposta.titulo}</Text>

          <View style={s.infoGrid}>
            {cliente && (
              <View style={s.infoCellWide}>
                <Text style={s.infoLabel}>Cliente</Text>
                <Text style={s.infoValue}>{cliente.empresa || cliente.nome}</Text>
                {cliente.empresa && cliente.empresa !== cliente.nome && <Text style={s.infoSub}>{cliente.nome}</Text>}
              </View>
            )}
            {proposta.responsavel?.nome && (
              <View style={s.infoCell}>
                <Text style={s.infoLabel}>Responsável</Text>
                <Text style={s.infoValue}>{proposta.responsavel.nome}</Text>
                <Text style={s.infoSub}>{agenciaNome}</Text>
              </View>
            )}
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Data</Text>
              <Text style={s.infoValue}>{fmtDate(proposta.created_at)}</Text>
            </View>
            {proposta.validade && (
              <View style={s.infoCell}>
                <Text style={s.infoLabel}>Validade</Text>
                <Text style={s.infoValue}>{fmtDate(proposta.validade)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ══════════ INVESTIMENTO ══════════ */}
        <View style={s.invest} wrap={false}>
          <View style={s.investCols}>
            {mostraInicial && (
              <View style={s.investCol}>
                <Text style={s.investLabel}>{recorrentes.length > 0 ? 'Investimento inicial' : 'Investimento'}</Text>
                {temDesconto && <Text style={s.investRiscado}>{fmt(subtotalAvulso)}</Text>}
                <Text style={s.investValor}>{fmt(subtotalAvulso * fator)}</Text>
                <Text style={s.investSub}>Pagamento único</Text>
              </View>
            )}
            {mostraInicial && recorrentes.length > 0 && <View style={s.investDivider} />}
            {recorrentes.length > 0 && (
              <View style={s.investCol}>
                <Text style={s.investLabel}>Recorrência</Text>
                {temDesconto && porPeriodo.length === 1 && <Text style={s.investRiscado}>{fmt(subtotalRec)}</Text>}
                {porPeriodo.map((g, idx) => (
                  <Text key={g.periodo} style={idx === 0 ? s.investValor : s.investValorMenor}>
                    {idx > 0 ? '+ ' : ''}{fmt(g.valor * fator)}
                    <Text style={s.investSufixo}> {PERIODOS[g.periodo]?.sufixo ?? ''}</Text>
                  </Text>
                ))}
                <Text style={s.investSub}>Enquanto o serviço estiver ativo</Text>
              </View>
            )}
          </View>

          {temDesconto && (
            <View style={s.descontoPill}>
              <Text style={s.descontoText}>
                {proposta.desconto_percentual}% de desconto · economia de {fmt((subtotalAvulso + subtotalRec) * (1 - fator))}
              </Text>
            </View>
          )}

          {proposta.condicoes_pagamento && (
            <View style={s.investFoot}>
              <Text style={s.investFootLabel}>Condições de pagamento</Text>
              <Text style={s.investFootText}>{proposta.condicoes_pagamento}</Text>
            </View>
          )}
        </View>

        <View style={s.body}>

          {/* ══════════ FUNCIONALIDADES ══════════ */}
          {todos.length > 0 && (
            <View style={s.section}>
              <View style={s.bigHead} minPresenceAhead={80}>
                <View style={s.bigTitleRow}>
                  <Text style={s.bigTitle}>O que está incluso</Text>
                  <Text style={s.bigCount}>{todos.length} {todos.length === 1 ? 'item' : 'itens'}</Text>
                </View>
                <View style={s.bigBar} />
              </View>

              {avulsos.length > 0 && recorrentes.length > 0 && (
                <View style={s.subHead} minPresenceAhead={60}>
                  <Text style={s.subHeadText}>Desenvolvimento</Text>
                  <View style={s.subHeadLine} />
                </View>
              )}
              {avulsos.map((item, i) => <Modulo key={item.id} item={item} num={i + 1} />)}

              {recorrentes.length > 0 && (
                <>
                  {avulsos.length > 0 && (
                    <View style={s.subHead} minPresenceAhead={60}>
                      <Text style={s.subHeadText}>Serviços contínuos</Text>
                      <View style={s.subHeadLine} />
                    </View>
                  )}
                  {recorrentes.map((item, i) => <Modulo key={item.id} item={item} num={avulsos.length + i + 1} />)}
                </>
              )}
            </View>
          )}

          {/* ══════════ SOBRE O PROJETO ══════════ */}
          {(proposta.descricao || proposta.observacoes) && (
            <View style={s.section}>
              <View style={s.bigHead} minPresenceAhead={80}>
                <Text style={s.bigKicker}>Contexto</Text>
                <Text style={s.bigTitle}>Sobre o projeto</Text>
                <View style={s.bigBar} />
              </View>
              {proposta.descricao && <Text style={s.textoBloco}>{proposta.descricao}</Text>}
              {proposta.observacoes && (
                <View style={s.notaBox} wrap={false}>
                  <Text style={s.notaLabel}>Observações</Text>
                  <Text style={s.notaText}>{proposta.observacoes}</Text>
                </View>
              )}
            </View>
          )}
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

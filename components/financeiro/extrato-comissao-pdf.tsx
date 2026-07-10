'use client'

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const NOITE   = '#1A0533'
const MEDIO   = '#2E1260'
const VIOLETA = '#7C3AED'
const LIMA    = '#B8F000'
const ROSA    = '#FF4D8D'
const LAVANDA = '#E2D9F3'
const MUTED   = '#9B89C4'
const BRANCO  = '#FFFFFF'

const STATUS_LABELS: Record<string, string> = {
  pago: 'Pago', pendente: 'Pendente', cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pago:      { bg: '#D6F5D6', text: '#1A6B1A' },
  pendente:  { bg: '#FFF3CC', text: '#92670A' },
  cancelado: { bg: '#EBEBEB', text: '#555555' },
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: BRANCO, paddingBottom: 60 },

  header: { backgroundColor: NOITE, paddingTop: 36, paddingHorizontal: 48 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 28 },
  logoWrap: { flexDirection: 'column', gap: 10 },
  logo: { width: 200, height: 92, objectFit: 'contain', objectPositionX: 'left' },
  logoPlaceholder: { width: 200, height: 92, backgroundColor: MEDIO, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoPlaceholderText: { color: LIMA, fontSize: 36, fontFamily: 'Helvetica-Bold' },
  agenciaNome: { color: MUTED, fontSize: 7.5, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 },
  headerMeta: { alignItems: 'flex-end', paddingTop: 4 },
  tituloDoc: { color: LAVANDA, fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 4 },
  headerDate: { color: MUTED, fontSize: 8, marginTop: 2 },
  limaLine: { height: 4, backgroundColor: LIMA },

  body: { paddingHorizontal: 48, paddingTop: 32 },

  topSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 32 },
  indicadorBlock: { flex: 1 },
  sectionLabel: { color: MUTED, fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  indicadorNome: { color: NOITE, fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  indicadorSub: { color: '#666', fontSize: 8.5, marginBottom: 1.5 },
  periodoBlock: { flex: 1, borderLeftWidth: 2, borderLeftColor: LIMA, paddingLeft: 16 },
  periodoLabel: { color: NOITE, fontSize: 14, fontFamily: 'Helvetica-Bold', lineHeight: 1.3, marginBottom: 6 },
  periodoSub: { color: '#555', fontSize: 8.5, lineHeight: 1.6 },

  tableWrap: { marginBottom: 20 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: NOITE, paddingBottom: 6, paddingHorizontal: 4, marginBottom: 2 },
  thCompetencia: { width: 90, color: NOITE, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  thDesc: { flex: 1, color: NOITE, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  thVal: { width: 76, color: NOITE, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
  thStatus: { width: 70, color: NOITE, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0ECF9' },
  tableRowAlt: { backgroundColor: '#FAFAFE' },
  tdCompetencia: { width: 90, color: '#222', fontSize: 8.5, textTransform: 'capitalize' },
  tdDesc: { flex: 1, color: '#222', fontSize: 8.5 },
  tdVal: { width: 76, color: NOITE, fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  tdStatusWrap: { width: 70, alignItems: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },

  emptyState: { paddingVertical: 24, textAlign: 'center', color: MUTED, fontSize: 9 },

  totaisOuter: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 },
  totaisBox: { width: 230, borderTopWidth: 1, borderTopColor: '#E5E0F0', paddingTop: 12 },
  totaisRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totaisLabel: { color: MUTED, fontSize: 8.5 },
  totaisValue: { color: NOITE, fontSize: 8.5 },
  totaisPagoValue: { color: '#1A6B1A', fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  totaisDivider: { height: 1, backgroundColor: NOITE, marginVertical: 8 },
  totalFinalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalFinalLabel: { color: NOITE, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  totalFinalValue: { color: NOITE, fontSize: 18, fontFamily: 'Helvetica-Bold' },

  infoBox: { borderTopWidth: 2, borderTopColor: VIOLETA, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 12, backgroundColor: '#F7F4FE', borderRadius: 4, marginBottom: 20 },
  infoBoxLabel: { color: MUTED, fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5 },
  infoBoxValue: { color: NOITE, fontSize: 8.5, lineHeight: 1.4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 48, borderTopWidth: 1, borderTopColor: '#E8E3F4' },
  footerLima: { width: 3, height: 16, backgroundColor: LIMA, marginRight: 10, borderRadius: 2 },
  footerAgencia: { color: '#999', fontSize: 7.5, flex: 1 },
  footerTotal: { color: VIOLETA, fontSize: 8, fontFamily: 'Helvetica-Bold' },
})

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCompetencia(d: string) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export type ExtratoComissaoRow = {
  id: string
  competencia: string
  valor: number
  status: string
  clienteIndicadoNome: string
}

export type ExtratoIndicador = {
  nome: string
  tipo: string
  email: string | null
  telefone: string | null
  whatsapp: string | null
  chavePix: string | null
}

export function ExtratoComissaoPDF({
  indicador, comissoes, periodoLabel, logoUrl, agenciaNome,
}: {
  indicador: ExtratoIndicador
  comissoes: ExtratoComissaoRow[]
  periodoLabel: string
  logoUrl: string | null
  agenciaNome: string
}) {
  const totalPago = comissoes.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPendente = comissoes.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0)
  const totalGeral = comissoes.reduce((s, c) => s + c.valor, 0)
  const contato = [indicador.email, indicador.telefone ?? indicador.whatsapp].filter(Boolean)

  return (
    <Document title={`Extrato de Comissões — ${indicador.nome}`} author={agenciaNome}>
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View style={s.headerInner}>
            <View style={s.logoWrap}>
              {logoUrl ? (
                <Image src={logoUrl} style={s.logo} />
              ) : (
                <View style={s.logoPlaceholder}>
                  <Text style={s.logoPlaceholderText}>{agenciaNome[0]?.toUpperCase() ?? 'T'}</Text>
                </View>
              )}
              <Text style={s.agenciaNome}>{agenciaNome}</Text>
            </View>
            <View style={s.headerMeta}>
              <Text style={s.tituloDoc}>EXTRATO DE COMISSÕES</Text>
              <Text style={s.headerDate}>Emitido em {new Date().toLocaleDateString('pt-BR')}</Text>
              <Text style={s.headerDate}>{periodoLabel}</Text>
            </View>
          </View>
        </View>
        <View style={s.limaLine} />

        <View style={s.body}>
          <View style={s.topSection}>
            <View style={s.indicadorBlock}>
              <Text style={s.sectionLabel}>Extrato para</Text>
              <Text style={s.indicadorNome}>{indicador.nome}</Text>
              <Text style={s.indicadorSub}>{indicador.tipo === 'cliente' ? 'Cliente indicador' : 'Parceiro externo'}</Text>
              {contato.map((c, i) => <Text key={i} style={s.indicadorSub}>{c}</Text>)}
            </View>
            <View style={s.periodoBlock}>
              <Text style={s.periodoLabel}>Período</Text>
              <Text style={s.periodoSub}>{periodoLabel}</Text>
            </View>
          </View>

          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <Text style={s.thCompetencia}>Competência</Text>
              <Text style={s.thDesc}>Cliente indicado</Text>
              <Text style={s.thStatus}>Status</Text>
              <Text style={s.thVal}>Valor</Text>
            </View>

            {comissoes.length === 0 ? (
              <Text style={s.emptyState}>Nenhuma comissão neste período.</Text>
            ) : comissoes.map((c, idx) => {
              const sc = STATUS_COLORS[c.status] ?? STATUS_COLORS.pendente
              return (
                <View key={c.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                  <Text style={s.tdCompetencia}>{fmtCompetencia(c.competencia)}</Text>
                  <Text style={s.tdDesc}>{c.clienteIndicadoNome}</Text>
                  <View style={s.tdStatusWrap}>
                    <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusText, { color: sc.text }]}>{STATUS_LABELS[c.status] ?? c.status}</Text>
                    </View>
                  </View>
                  <Text style={s.tdVal}>{fmt(c.valor)}</Text>
                </View>
              )
            })}
          </View>

          <View style={s.totaisOuter}>
            <View style={s.totaisBox}>
              <View style={s.totaisRow}>
                <Text style={s.totaisLabel}>Já pago</Text>
                <Text style={s.totaisPagoValue}>{fmt(totalPago)}</Text>
              </View>
              <View style={s.totaisRow}>
                <Text style={s.totaisLabel}>Pendente</Text>
                <Text style={s.totaisValue}>{fmt(totalPendente)}</Text>
              </View>
              <View style={s.totaisDivider} />
              <View style={s.totalFinalRow}>
                <Text style={s.totalFinalLabel}>Total do período</Text>
                <Text style={s.totalFinalValue}>{fmt(totalGeral)}</Text>
              </View>
            </View>
          </View>

          {indicador.chavePix && (
            <View style={s.infoBox}>
              <Text style={s.infoBoxLabel}>Chave PIX para pagamento</Text>
              <Text style={s.infoBoxValue}>{indicador.chavePix}</Text>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <View style={s.footerLima} />
          <Text style={s.footerAgencia}>{agenciaNome} · Extrato de Comissões · {indicador.nome}</Text>
          <Text style={s.footerTotal}>{fmt(totalGeral)}</Text>
        </View>

      </Page>
    </Document>
  )
}

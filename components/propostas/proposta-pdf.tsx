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

const REC_LABELS: Record<string, string> = {
  mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:      { bg: '#EDE8F8', text: '#4B3D8A' },
  enviada:       { bg: '#DFF0FD', text: '#1A6FA8' },
  em_negociacao: { bg: '#FFF3CC', text: '#92670A' },
  aprovada:      { bg: '#D6F5D6', text: '#1A6B1A' },
  recusada:      { bg: '#FFE0E6', text: '#A81A35' },
  expirada:      { bg: '#EBEBEB', text: '#555555' },
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada', em_negociacao: 'Em Negociacao',
  aprovada: 'Aprovada', recusada: 'Recusada', expirada: 'Expirada',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: BRANCO,
    paddingBottom: 60,
  },

  // ─── HEADER ───
  header: {
    backgroundColor: NOITE,
    paddingTop: 36,
    paddingBottom: 0,
    paddingHorizontal: 48,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 28,
  },
  logoWrap: {
    flexDirection: 'column',
    gap: 10,
  },
  logo: {
    width: 200,
    height: 92,
    objectFit: 'contain',
    objectPositionX: 'left',
  },
  logoPlaceholder: {
    width: 200,
    height: 92,
    backgroundColor: MEDIO,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    color: LIMA,
    fontSize: 36,
    fontFamily: 'Helvetica-Bold',
  },
  agenciaNome: {
    color: MUTED,
    fontSize: 7.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  headerMeta: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  numeroProposta: {
    color: LAVANDA,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerDate: {
    color: MUTED,
    fontSize: 8,
    marginTop: 2,
  },
  // Lima line no fim do header
  limaLine: {
    height: 4,
    backgroundColor: LIMA,
  },

  // ─── BODY ───
  body: {
    paddingHorizontal: 48,
    paddingTop: 32,
  },

  // Seção Para + Título
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 32,
  },
  clientBlock: {
    flex: 1,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  clientNome: {
    color: NOITE,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  clientSub: {
    color: '#666',
    fontSize: 8.5,
    marginBottom: 1.5,
  },
  tituloBlock: {
    flex: 1.4,
    borderLeftWidth: 2,
    borderLeftColor: LIMA,
    paddingLeft: 16,
  },
  propTitulo: {
    color: NOITE,
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.3,
    marginBottom: 6,
  },
  propDescricao: {
    color: '#555',
    fontSize: 8.5,
    lineHeight: 1.6,
  },

  // ─── TABELA AVULSOS ───
  tableWrap: {
    marginBottom: 20,
  },
  tableSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  tableSectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E3F4',
  },
  tableSectionLabel: {
    color: MUTED,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: NOITE,
    paddingBottom: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  thDesc: {
    flex: 1,
    color: NOITE,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thQtd: {
    width: 40,
    color: NOITE,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thVal: {
    width: 76,
    color: NOITE,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECF9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFE',
  },
  tdDesc: {
    flex: 1,
    color: '#222',
    fontSize: 8.5,
  },
  tdQtd: {
    width: 40,
    color: '#666',
    fontSize: 8.5,
    textAlign: 'center',
  },
  tdVal: {
    width: 76,
    color: '#555',
    fontSize: 8.5,
    textAlign: 'right',
  },
  tdTotal: {
    width: 76,
    color: NOITE,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },

  // ─── TABELA RECORRENTES ───
  recBox: {
    backgroundColor: '#F4F0FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8CCF5',
    overflow: 'hidden',
    marginBottom: 20,
  },
  recHeader: {
    backgroundColor: VIOLETA,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  recHeaderIcon: {
    color: LIMA,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginRight: 2,
  },
  recHeaderTitle: {
    color: BRANCO,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  recHeaderSub: {
    color: LAVANDA,
    fontSize: 7.5,
  },
  recTableHead: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CCF5',
  },
  recThDesc: {
    flex: 1,
    color: VIOLETA,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recThPeriodo: {
    width: 72,
    color: VIOLETA,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recThVal: {
    width: 80,
    color: VIOLETA,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5FA',
    alignItems: 'center',
  },
  recTdDesc: {
    flex: 1,
    color: '#2A1A50',
    fontSize: 8.5,
  },
  recTdPeriodo: {
    width: 72,
    textAlign: 'center',
  },
  recPeriodoPill: {
    backgroundColor: VIOLETA,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  recPeriodoText: {
    color: BRANCO,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recTdVal: {
    width: 80,
    color: VIOLETA,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  recFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#EDE8FA',
  },
  recFooterLabel: {
    color: VIOLETA,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recFooterVal: {
    color: VIOLETA,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },

  // ─── TOTAIS ───
  totaisOuter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  totaisBox: {
    width: 230,
    borderTopWidth: 1,
    borderTopColor: '#E5E0F0',
    paddingTop: 12,
  },
  totaisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totaisLabel: {
    color: MUTED,
    fontSize: 8.5,
  },
  totaisValue: {
    color: NOITE,
    fontSize: 8.5,
  },
  totaisRecLabel: {
    color: VIOLETA,
    fontSize: 8.5,
  },
  totaisRecValue: {
    color: VIOLETA,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  totaisDescontoValue: {
    color: ROSA,
    fontSize: 8.5,
  },
  totaisDivider: {
    height: 1,
    backgroundColor: NOITE,
    marginVertical: 8,
  },
  totalFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  totalFinalLabel: {
    color: NOITE,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  totalFinalValue: {
    color: NOITE,
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },

  // ─── INFO BOXES ───
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  infoBox: {
    flex: 1,
    borderTopWidth: 2,
    borderTopColor: VIOLETA,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F7F4FE',
    borderRadius: 4,
  },
  infoBoxLabel: {
    color: MUTED,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  infoBoxValue: {
    color: NOITE,
    fontSize: 8.5,
    lineHeight: 1.4,
  },

  // ─── OBSERVAÇÕES ───
  obsWrap: {
    borderLeftWidth: 2,
    borderLeftColor: '#E5E0F0',
    paddingLeft: 12,
    marginBottom: 20,
  },
  obsLabel: {
    color: MUTED,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  obsText: {
    color: '#555',
    fontSize: 8.5,
    lineHeight: 1.6,
  },

  // ─── FOOTER ───
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    borderTopWidth: 1,
    borderTopColor: '#E8E3F4',
  },
  footerLima: {
    width: 3,
    height: 16,
    backgroundColor: LIMA,
    marginRight: 10,
    borderRadius: 2,
  },
  footerAgencia: {
    color: '#999',
    fontSize: 7.5,
    flex: 1,
  },
  footerNumero: {
    color: '#bbb',
    fontSize: 7.5,
    marginRight: 12,
  },
  footerTotal: {
    color: VIOLETA,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
})

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
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

export function PropostaPDF({ proposta, logoUrl, agenciaNome }: {
  proposta: Proposta
  logoUrl: string | null
  agenciaNome: string
}) {
  const todos = [...(proposta.proposta_itens ?? [])].sort((a, b) => a.ordem - b.ordem)
  const avulsos    = todos.filter(i => !i.recorrencia || i.recorrencia === 'avulso')
  const recorrentes = todos.filter(i => i.recorrencia && i.recorrencia !== 'avulso')

  const subtotalAvulso = avulsos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  const subtotalRec    = recorrentes.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  const subtotalGeral  = subtotalAvulso + subtotalRec
  const descontoValor  = subtotalGeral * (proposta.desconto_percentual / 100)
  const totalFinal     = subtotalGeral - descontoValor

  const sc = STATUS_COLORS[proposta.status] ?? STATUS_COLORS.rascunho

  return (
    <Document title={`${proposta.numero} — ${proposta.titulo}`} author={agenciaNome}>
      <Page size="A4" style={s.page}>

        {/* ══════════ HEADER ══════════ */}
        <View style={s.header}>
          <View style={s.headerInner}>

            {/* Logo + nome agência */}
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

            {/* Número + status + datas */}
            <View style={s.headerMeta}>
              <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                <Text style={[s.statusText, { color: sc.text }]}>{STATUS_LABELS[proposta.status] ?? proposta.status}</Text>
              </View>
              <Text style={s.numeroProposta}>{proposta.numero}</Text>
              <Text style={s.headerDate}>Emitida em {fmtDate(proposta.created_at)}</Text>
              {proposta.validade && (
                <Text style={s.headerDate}>Valida ate {fmtDate(proposta.validade)}</Text>
              )}
            </View>
          </View>
        </View>
        <View style={s.limaLine} />

        {/* ══════════ BODY ══════════ */}
        <View style={s.body}>

          {/* Para + Título lado a lado */}
          <View style={s.topSection}>
            {proposta.clientes && (
              <View style={s.clientBlock}>
                <Text style={s.sectionLabel}>Proposta para</Text>
                <Text style={s.clientNome}>{proposta.clientes.nome}</Text>
                {proposta.clientes.empresa && <Text style={s.clientSub}>{proposta.clientes.empresa}</Text>}
                {proposta.clientes.email && <Text style={s.clientSub}>{proposta.clientes.email}</Text>}
              </View>
            )}
            <View style={s.tituloBlock}>
              <Text style={s.propTitulo}>{proposta.titulo}</Text>
              {proposta.descricao && <Text style={s.propDescricao}>{proposta.descricao}</Text>}
            </View>
          </View>

          {/* ── Serviços Avulsos ── */}
          {avulsos.length > 0 && (
            <View style={s.tableWrap}>
              {recorrentes.length > 0 && (
                <View style={s.tableSectionHeader}>
                  <Text style={s.tableSectionLabel}>Servicos avulsos</Text>
                  <View style={s.tableSectionLine} />
                </View>
              )}

              <View style={s.tableHead}>
                <Text style={s.thDesc}>Servico / Entregavel</Text>
                <Text style={s.thQtd}>Qtd</Text>
                <Text style={s.thVal}>Unit.</Text>
                <Text style={s.thVal}>Total</Text>
              </View>

              {avulsos.map((item, idx) => (
                <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
                  <Text style={s.tdDesc}>{item.descricao}</Text>
                  <Text style={s.tdQtd}>{item.quantidade}</Text>
                  <Text style={s.tdVal}>{fmt(item.valor_unitario)}</Text>
                  <Text style={s.tdTotal}>{fmt(item.quantidade * item.valor_unitario)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Serviços Recorrentes ── */}
          {recorrentes.length > 0 && (
            <View style={s.recBox}>
              <View style={s.recHeader}>
                <Text style={s.recHeaderIcon}>↻</Text>
                <Text style={s.recHeaderTitle}>Servicos Recorrentes / Mensalidade</Text>
                <Text style={s.recHeaderSub}>cobranca periodica</Text>
              </View>

              <View style={s.recTableHead}>
                <Text style={s.recThDesc}>Servico</Text>
                <Text style={s.recThPeriodo}>Periodicidade</Text>
                <Text style={s.recThVal}>Valor / periodo</Text>
              </View>

              {recorrentes.map((item) => (
                <View key={item.id} style={s.recRow}>
                  <Text style={s.recTdDesc}>{item.descricao}</Text>
                  <View style={s.recTdPeriodo}>
                    <View style={s.recPeriodoPill}>
                      <Text style={s.recPeriodoText}>{REC_LABELS[item.recorrencia ?? ''] ?? item.recorrencia}</Text>
                    </View>
                  </View>
                  <Text style={s.recTdVal}>{fmt(item.quantidade * item.valor_unitario)}</Text>
                </View>
              ))}

              <View style={s.recFooter}>
                <Text style={s.recFooterLabel}>Total recorrente ·</Text>
                <Text style={s.recFooterVal}>{fmt(subtotalRec)}/mês</Text>
              </View>
            </View>
          )}

          {/* ── Totais ── */}
          <View style={s.totaisOuter}>
            <View style={s.totaisBox}>
              {avulsos.length > 0 && recorrentes.length > 0 && (
                <>
                  <View style={s.totaisRow}>
                    <Text style={s.totaisLabel}>Servicos avulsos</Text>
                    <Text style={s.totaisValue}>{fmt(subtotalAvulso)}</Text>
                  </View>
                  <View style={s.totaisRow}>
                    <Text style={s.totaisRecLabel}>↻ Recorrente/mes</Text>
                    <Text style={s.totaisRecValue}>{fmt(subtotalRec)}</Text>
                  </View>
                </>
              )}
              {proposta.desconto_percentual > 0 && (
                <View style={s.totaisRow}>
                  <Text style={s.totaisLabel}>Desconto ({proposta.desconto_percentual}%)</Text>
                  <Text style={s.totaisDescontoValue}>-{fmt(descontoValor)}</Text>
                </View>
              )}
              <View style={s.totaisDivider} />
              <View style={s.totalFinalRow}>
                <Text style={s.totalFinalLabel}>Total</Text>
                <Text style={s.totalFinalValue}>{fmt(totalFinal)}</Text>
              </View>
            </View>
          </View>

          {/* ── Info boxes ── */}
          {(proposta.condicoes_pagamento || proposta.validade) && (
            <View style={s.infoRow}>
              {proposta.condicoes_pagamento && (
                <View style={s.infoBox}>
                  <Text style={s.infoBoxLabel}>Condicoes de Pagamento</Text>
                  <Text style={s.infoBoxValue}>{proposta.condicoes_pagamento}</Text>
                </View>
              )}
              {proposta.validade && (
                <View style={s.infoBox}>
                  <Text style={s.infoBoxLabel}>Validade</Text>
                  <Text style={s.infoBoxValue}>Esta proposta e valida ate {fmtDate(proposta.validade)}.</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Observações ── */}
          {proposta.observacoes && (
            <View style={s.obsWrap}>
              <Text style={s.obsLabel}>Observacoes</Text>
              <Text style={s.obsText}>{proposta.observacoes}</Text>
            </View>
          )}
        </View>

        {/* ══════════ FOOTER ══════════ */}
        <View style={s.footer} fixed>
          <View style={s.footerLima} />
          <Text style={s.footerAgencia}>{agenciaNome}</Text>
          <Text style={s.footerNumero}>{proposta.numero}</Text>
          <Text style={s.footerTotal}>{fmt(totalFinal)}</Text>
        </View>

      </Page>
    </Document>
  )
}

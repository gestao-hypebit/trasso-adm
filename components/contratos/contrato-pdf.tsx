'use client'

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const NOITE   = '#1A0533'
const VIOLETA = '#7C3AED'
const LIMA    = '#B8F000'
const MUTED   = '#6B5B95'
const TEXTO   = '#1F1633'
const LINHA   = '#E4DDF3'

export type ContratoPDFData = {
  numero: string; titulo: string; tipo: string | null; status: string
  valor_total: number; data_inicio: string | null; data_fim: string | null
  condicoes_pagamento: string | null; clausulas: string | null
  assinado_em: string | null; assinado_nome?: string | null; assinado_ip?: string | null
  clientes: { nome: string; empresa: string | null; email: string | null; cpf_cnpj?: string | null } | null
}

export type AgenciaPDFData = {
  nome: string; cnpj: string | null; email: string | null; telefone: string | null
  endereco: string | null; cidade: string | null; logo_url: string | null
}

const TIPO_LABEL: Record<string, string> = { servico: 'Serviço', retainer: 'Retainer', pontual: 'Pontual', parceria: 'Parceria' }

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const data = (d: string | null) => {
  if (!d) return '—'
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d
  return new Date(iso).toLocaleDateString('pt-BR')
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: TEXTO, paddingBottom: 56 },
  header: { backgroundColor: NOITE, paddingVertical: 28, paddingHorizontal: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 140, height: 56, objectFit: 'contain' },
  logoTexto: { color: LIMA, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  numero: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  numeroSub: { color: '#B9A8E0', fontSize: 8, marginTop: 3, textAlign: 'right' },
  faixa: { height: 4, backgroundColor: VIOLETA },
  body: { paddingHorizontal: 48, paddingTop: 28 },
  titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NOITE, marginBottom: 18 },
  partes: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  parte: { flex: 1, padding: 12, borderWidth: 1, borderColor: LINHA, borderRadius: 6 },
  rotulo: { fontSize: 7.5, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  parteNome: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  parteLinha: { fontSize: 9, color: MUTED, marginTop: 1 },
  resumo: { flexDirection: 'row', borderWidth: 1, borderColor: LINHA, borderRadius: 6, marginBottom: 20 },
  resumoCel: { flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: LINHA },
  resumoValor: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  secaoTitulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: VIOLETA, marginBottom: 6, marginTop: 6 },
  paragrafo: { fontSize: 9.5, lineHeight: 1.55, marginBottom: 10 },
  assinaturas: { flexDirection: 'row', gap: 32, marginTop: 40 },
  assinatura: { flex: 1, borderTopWidth: 1, borderTopColor: TEXTO, paddingTop: 6 },
  assinaturaNome: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  assinaturaSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  aceite: { marginTop: 16, padding: 10, backgroundColor: '#F4FBE0', borderRadius: 6, fontSize: 8.5, color: '#3E5200' },
  rodape: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 7.5, color: MUTED, textAlign: 'center' },
})

export function ContratoPDF({ contrato, agencia }: { contrato: ContratoPDFData; agencia: AgenciaPDFData }) {
  return (
    <Document title={`${contrato.numero} — ${contrato.titulo}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {agencia.logo_url
            // eslint-disable-next-line jsx-a11y/alt-text
            ? <Image src={agencia.logo_url} style={s.logo} />
            : <Text style={s.logoTexto}>{agencia.nome}</Text>}
          <View>
            <Text style={s.numero}>CONTRATO {contrato.numero}</Text>
            <Text style={s.numeroSub}>{contrato.tipo ? TIPO_LABEL[contrato.tipo] ?? contrato.tipo : 'Prestação de serviços'}</Text>
          </View>
        </View>
        <View style={s.faixa} />

        <View style={s.body}>
          <Text style={s.titulo}>{contrato.titulo}</Text>

          <View style={s.partes}>
            <View style={s.parte}>
              <Text style={s.rotulo}>Contratante</Text>
              <Text style={s.parteNome}>{contrato.clientes?.empresa || contrato.clientes?.nome || '—'}</Text>
              {contrato.clientes?.empresa && <Text style={s.parteLinha}>{contrato.clientes.nome}</Text>}
              {contrato.clientes?.cpf_cnpj && <Text style={s.parteLinha}>CPF/CNPJ: {contrato.clientes.cpf_cnpj}</Text>}
              {contrato.clientes?.email && <Text style={s.parteLinha}>{contrato.clientes.email}</Text>}
            </View>
            <View style={s.parte}>
              <Text style={s.rotulo}>Contratada</Text>
              <Text style={s.parteNome}>{agencia.nome}</Text>
              {agencia.cnpj && <Text style={s.parteLinha}>CNPJ: {agencia.cnpj}</Text>}
              {(agencia.endereco || agencia.cidade) && (
                <Text style={s.parteLinha}>{[agencia.endereco, agencia.cidade].filter(Boolean).join(' — ')}</Text>
              )}
              {agencia.email && <Text style={s.parteLinha}>{agencia.email}</Text>}
            </View>
          </View>

          <View style={s.resumo}>
            <View style={s.resumoCel}>
              <Text style={s.rotulo}>Valor total</Text>
              <Text style={s.resumoValor}>{brl(contrato.valor_total)}</Text>
            </View>
            <View style={s.resumoCel}>
              <Text style={s.rotulo}>Início</Text>
              <Text style={s.resumoValor}>{data(contrato.data_inicio)}</Text>
            </View>
            <View style={[s.resumoCel, { borderRightWidth: 0 }]}>
              <Text style={s.rotulo}>Término</Text>
              <Text style={s.resumoValor}>{contrato.data_fim ? data(contrato.data_fim) : 'Indeterminado'}</Text>
            </View>
          </View>

          {contrato.condicoes_pagamento && (
            <View wrap={false}>
              <Text style={s.secaoTitulo}>Condições de pagamento</Text>
              <Text style={s.paragrafo}>{contrato.condicoes_pagamento}</Text>
            </View>
          )}

          {contrato.clausulas && (
            <View>
              <Text style={s.secaoTitulo}>Cláusulas</Text>
              <Text style={s.paragrafo}>{contrato.clausulas}</Text>
            </View>
          )}

          <View style={s.assinaturas} wrap={false}>
            <View style={s.assinatura}>
              <Text style={s.assinaturaNome}>{contrato.assinado_nome || contrato.clientes?.nome || 'Contratante'}</Text>
              <Text style={s.assinaturaSub}>Contratante</Text>
            </View>
            <View style={s.assinatura}>
              <Text style={s.assinaturaNome}>{agencia.nome}</Text>
              <Text style={s.assinaturaSub}>Contratada</Text>
            </View>
          </View>

          {contrato.assinado_em && (
            <Text style={s.aceite}>
              Aceite eletrônico registrado em {new Date(contrato.assinado_em).toLocaleString('pt-BR')}
              {contrato.assinado_nome ? ` por ${contrato.assinado_nome}` : ''}
              {contrato.assinado_ip ? ` (IP ${contrato.assinado_ip})` : ''}, via portal do cliente.
            </Text>
          )}
        </View>

        <Text style={s.rodape} render={({ pageNumber, totalPages }) => `${agencia.nome} · ${contrato.numero} · página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

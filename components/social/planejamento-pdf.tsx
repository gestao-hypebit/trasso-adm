'use client'

import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { APROVACAO, FORMATOS, REDES, nomePeriodo, ordenarPosts, type Post } from '@/lib/social/tipos'
import { formatDate } from '@/lib/utils'

// Sem isso o react-pdf hifeniza palavras em português ("dig-ital").
Font.registerHyphenationCallback(word => [word])

const NOITE   = '#1A0533'
const VIOLETA = '#7C3AED'
const LIMA    = '#B8F000'
const MUTED   = '#8A7BAE'
const TEXTO   = '#2B2240'
const SUAVE   = '#6B6280'
const LINHA   = '#ECE7F5'
const FUNDO   = '#F7F5FB'
const BRANCO  = '#FFFFFF'

const PAD = 40
const TOP = 36

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: TEXTO, backgroundColor: BRANCO, paddingTop: TOP, paddingBottom: 60 },

  header: { marginTop: -TOP, backgroundColor: NOITE, paddingHorizontal: PAD, paddingTop: 28, paddingBottom: 30, marginBottom: 26 },
  logo: { width: 200, height: 46, objectFit: 'contain', objectPositionX: 'left', marginBottom: 26 },
  logoTexto: { color: BRANCO, fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 26 },
  kicker: { color: LIMA, fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 8 },
  titulo: { color: BRANCO, fontSize: 26, fontFamily: 'Helvetica-Bold', lineHeight: 1.15, marginBottom: 4 },
  mes: { color: MUTED, fontSize: 12, marginBottom: 18 },
  objetivoLabel: { color: MUTED, fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  objetivo: { color: BRANCO, fontSize: 10, lineHeight: 1.5, maxWidth: 440, marginBottom: 18 },
  resumo: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#3A2560', paddingTop: 12 },
  resumoCel: { marginRight: 26 },
  resumoNum: { color: BRANCO, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  resumoLbl: { color: MUTED, fontSize: 7, marginTop: 2 },

  body: { paddingHorizontal: PAD },
  secao: { color: VIOLETA, fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },

  // Tabela de visão geral
  tabela: { marginBottom: 28, borderWidth: 1, borderColor: LINHA, borderRadius: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINHA, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  th: { color: SUAVE, fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  cData: { width: 78 },
  cFormato: { width: 74 },
  cRedes: { width: 92 },
  cTema: { flex: 1 },
  pill: { alignSelf: 'flex-start', borderRadius: 3, paddingVertical: 1.5, paddingHorizontal: 5 },
  pillTxt: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: NOITE },

  // Post
  post: { flexDirection: 'row', marginBottom: 18, borderWidth: 1, borderColor: LINHA, borderRadius: 8, overflow: 'hidden' },
  midia: { width: 150, height: 188, objectFit: 'cover', backgroundColor: FUNDO },
  semMidia: { width: 150, height: 188, backgroundColor: FUNDO, alignItems: 'center', justifyContent: 'center' },
  semMidiaTxt: { color: MUTED, fontSize: 7, textAlign: 'center', paddingHorizontal: 16 },
  postCorpo: { flex: 1, padding: 14 },
  postTopo: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' },
  postData: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: TEXTO, marginRight: 8, textTransform: 'capitalize' },
  postTitulo: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NOITE, lineHeight: 1.25, marginBottom: 8 },
  rotulo: { color: SUAVE, fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3, marginTop: 4 },
  texto: { fontSize: 8.5, lineHeight: 1.5, color: TEXTO },
  hashtags: { fontSize: 8, color: VIOLETA, marginTop: 4, lineHeight: 1.4 },
  roteiro: { fontSize: 8, lineHeight: 1.5, color: SUAVE },
  extra: { fontSize: 7, color: MUTED, marginTop: 4 },
  aprov: { marginLeft: 'auto', fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8 },

  footer: { position: 'absolute', bottom: 22, left: PAD, right: PAD, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: LINHA, paddingTop: 9 },
  footerMark: { width: 6, height: 6, backgroundColor: LIMA, borderRadius: 3, marginRight: 8 },
  footerText: { color: MUTED, fontSize: 7.5 },
  footerSpacer: { flex: 1 },
})

// O react-pdf só desenha PNG e JPG.
const imagemPdf = (urls: string[]) => urls.find((u) => /\.(png|jpe?g)(\?|$)/i.test(u)) ?? null

const corAprov = { pendente: '#B8860B', aprovado: '#4D7C0F', ajustes: '#DB2777' } as const

export function PlanejamentoPDF({ cliente, mes, fim, objetivo, posts, logoUrl, agenciaNome, comAprovacao }: {
  cliente: string
  mes: string
  fim: string | null
  objetivo: string | null
  posts: Post[]
  logoUrl: string | null
  agenciaNome: string
  comAprovacao: boolean
}) {
  const lista = ordenarPosts(posts)
  const periodo = nomePeriodo(mes, fim)
  const contagem = Object.entries(FORMATOS)
    .map(([k, f]) => ({ label: f.label, n: lista.filter((p) => p.formato === k).length }))
    .filter((c) => c.n > 0)

  return (
    <Document title={`Planejamento ${cliente} - ${periodo}`} author={agenciaNome}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {logoUrl ? <Image src={logoUrl} style={s.logo} /> : <Text style={s.logoTexto}>{agenciaNome.toLowerCase()}</Text>}
          <Text style={s.kicker}>Planejamento de social media</Text>
          <Text style={s.titulo}>{cliente}</Text>
          <Text style={s.mes}>{periodo}</Text>
          {objetivo && (
            <>
              <Text style={s.objetivoLabel}>Objetivo do mês</Text>
              <Text style={s.objetivo}>{objetivo}</Text>
            </>
          )}
          <View style={s.resumo}>
            <View style={s.resumoCel}><Text style={s.resumoNum}>{lista.length}</Text><Text style={s.resumoLbl}>posts</Text></View>
            {contagem.map((c) => (
              <View key={c.label} style={s.resumoCel}><Text style={s.resumoNum}>{c.n}</Text><Text style={s.resumoLbl}>{c.label}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.body}>
          <Text style={s.secao}>Calendário</Text>
          <View style={s.tabela}>
            <View style={[s.tr, { backgroundColor: FUNDO }]}>
              <Text style={[s.th, s.cData]}>Data</Text>
              <Text style={[s.th, s.cFormato]}>Formato</Text>
              <Text style={[s.th, s.cRedes]}>Redes</Text>
              <Text style={[s.th, s.cTema]}>Tema</Text>
            </View>
            {lista.map((p, i) => (
              <View key={p.id} style={[s.tr, i === lista.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
                <Text style={[s.cData, { fontSize: 8, textTransform: 'capitalize' }]}>{formatDate(p.data, 'EEE dd/MM')}{p.horario ? ` ${p.horario}` : ''}</Text>
                <View style={s.cFormato}><View style={[s.pill, { backgroundColor: FORMATOS[p.formato]?.cor }]}><Text style={s.pillTxt}>{FORMATOS[p.formato]?.label}</Text></View></View>
                <Text style={[s.cRedes, { fontSize: 7.5, color: SUAVE }]}>{p.redes.map((r) => REDES[r]?.label ?? r).join(', ')}</Text>
                <Text style={[s.cTema, { fontSize: 8.5 }]}>{p.titulo}</Text>
              </View>
            ))}
          </View>

          <Text style={s.secao} break={lista.length > 14}>Posts</Text>
          {lista.map((p) => {
            const img = imagemPdf(p.midias)
            return (
              <View key={p.id} style={s.post} wrap={false}>
                {img
                  ? <Image src={img} style={s.midia} />
                  : <View style={s.semMidia}><Text style={s.semMidiaTxt}>{p.midias.length ? 'Vídeo / mídia no link do planejamento' : 'Arte em produção'}</Text></View>}
                <View style={s.postCorpo}>
                  <View style={s.postTopo}>
                    <Text style={s.postData}>{formatDate(p.data, 'EEEE, dd/MM')}{p.horario ? ` · ${p.horario}` : ''}</Text>
                    <View style={[s.pill, { backgroundColor: FORMATOS[p.formato]?.cor, marginRight: 6 }]}><Text style={s.pillTxt}>{FORMATOS[p.formato]?.label}</Text></View>
                    <Text style={{ fontSize: 7, color: SUAVE }}>{p.redes.map((r) => REDES[r]?.label ?? r).join(' · ')}</Text>
                    {comAprovacao && <Text style={[s.aprov, { color: corAprov[p.aprovacao] }]}>{APROVACAO[p.aprovacao].label}</Text>}
                  </View>
                  <Text style={s.postTitulo}>{p.titulo}</Text>
                  {p.legenda && (
                    <>
                      <Text style={s.rotulo}>Legenda</Text>
                      <Text style={s.texto}>{p.legenda.length > 900 ? `${p.legenda.slice(0, 900)}…` : p.legenda}</Text>
                    </>
                  )}
                  {p.hashtags && <Text style={s.hashtags}>{p.hashtags}</Text>}
                  {p.roteiro && (
                    <>
                      <Text style={s.rotulo}>{p.formato === 'reels' || p.formato === 'video' ? 'Roteiro' : p.formato === 'carrossel' ? 'Slides' : 'Arte'}</Text>
                      <Text style={s.roteiro}>{p.roteiro.length > 600 ? `${p.roteiro.slice(0, 600)}…` : p.roteiro}</Text>
                    </>
                  )}
                  {p.cta && <Text style={s.extra}>CTA: {p.cta}</Text>}
                </View>
              </View>
            )
          })}
        </View>

        <View style={s.footer} fixed>
          <View style={s.footerMark} />
          <Text style={s.footerText}>{agenciaNome}  ·  {cliente}  ·  {periodo}</Text>
          <View style={s.footerSpacer} />
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

'use client'

import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/800.css'
import { forwardRef, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Clock, CreditCard, MapPin, MessageCircle, Store, Truck } from 'lucide-react'
import { ALTURA, LARGURA, fotosDaCapa, progressoDica, type DadosArte, type IconeInfo, type Lamina, type Tema } from '@/lib/social/artes'

// Arte de uma lâmina em tamanho real (1080 × 1350). Para mostrar menor, quem usa
// aplica `transform: scale()` num contêiner por fora; a exportação lê este nó.

const LADO = 64
const TOPO = 80
const BASE_RODAPE = 48
const FIM_CONTEUDO = 120 // acima do rodapé fixo

const ICONES: Record<IconeInfo, typeof MapPin> = {
  local: MapPin, horario: Clock, envio: Truck, whatsapp: MessageCircle, cartao: CreditCard, loja: Store,
}

export const Arte = forwardRef<HTMLDivElement, { tema: Tema; laminas: Lamina[]; indice: number }>(function Arte({ tema, laminas, indice }, ref) {
  const { template, dados } = laminas[indice]
  const c = tema.cores
  return (
    <div
      ref={ref}
      style={{
        width: LARGURA, height: ALTURA, position: 'relative', overflow: 'hidden', background: c.fundo, color: c.texto,
        fontFamily: `'${tema.fonte}', sans-serif`, fontWeight: 400, textAlign: 'left',
      }}
    >
      {template === 'capa' && <Capa tema={tema} d={dados} fotos={fotosDaCapa(dados, laminas)} />}
      {template === 'produto' && <Produto tema={tema} d={dados} />}
      {template === 'chamada' && <Chamada tema={tema} d={dados} />}
      {template === 'dica' && <Dica tema={tema} d={dados} progresso={progressoDica(laminas, indice)} />}
      {template === 'foto' && <FotoCheia tema={tema} d={dados} />}
      {template === 'info' && <Info tema={tema} d={dados} />}

      {template !== 'capa' && <div style={{ position: 'absolute', top: TOPO, right: LADO }}><Logo tema={tema} largura={90} /></div>}
      <div style={{ position: 'absolute', left: LADO, right: LADO, bottom: BASE_RODAPE, textAlign: 'center', color: c.secundario }}>
        <Ajustar max={22} min={14} linhas={1}>{tema.rodape}</Ajustar>
      </div>
    </div>
  )
})

// ─── Peças ───

// Texto que diminui a fonte (de `max` até `min`) até caber em `linhas` linhas sem
// estourar a largura. Se nem no mínimo couber, quebra a palavra no meio.
function Ajustar({ max, min = 20, linhas, altura = 1.08, style, children }: {
  max: number; min?: number; linhas: number; altura?: number; style?: CSSProperties; children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ajustar = () => {
      let t = max
      el.style.overflowWrap = 'normal'
      el.style.fontSize = `${t}px`
      const estoura = () => el.scrollHeight > Math.ceil(t * altura * linhas) + 2 || el.scrollWidth > el.clientWidth + 1
      while (t > min && estoura()) { t -= 2; el.style.fontSize = `${t}px` }
      if (estoura()) el.style.overflowWrap = 'anywhere'
    }
    ajustar()
    // Mede de novo quando a fonte terminar de carregar (a largura muda).
    let vivo = true
    document.fonts?.ready.then(() => vivo && ajustar())
    return () => { vivo = false }
  })
  return <div ref={ref} style={{ lineHeight: altura, width: '100%', ...style }}>{children}</div>
}

function Logo({ tema, largura }: { tema: Tema; largura: number }) {
  if (tema.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tema.logoUrl} alt="" crossOrigin="anonymous" style={{ width: largura, height: largura * 0.6, objectFit: 'contain', objectPosition: 'right center', display: 'block' }} />
  }
  return <div style={{ fontWeight: 800, fontSize: largura * 0.36, letterSpacing: '-0.02em', lineHeight: 1, color: tema.cores.texto }}>{tema.logoTexto}</div>
}

function Foto({ src, placeholder, tema, ajuste = 'contain', sombra = false }: {
  src?: string | null; placeholder?: string; tema: Tema; ajuste?: 'contain' | 'cover'; sombra?: boolean
}) {
  if (!src) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 28,
        border: `2px dashed ${tema.cores.secundario}55`, background: 'rgba(255,255,255,0.03)',
        color: tema.cores.secundario, fontSize: 26, fontWeight: 600, letterSpacing: '0.12em', textAlign: 'center', padding: 24,
      }}>
        {placeholder || 'FOTO'}
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {sombra && (
        <div style={{
          position: 'absolute', left: '15%', right: '15%', bottom: '2%', height: '9%', borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 70%)',
        }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" crossOrigin="anonymous" style={{
        position: 'relative', width: '100%', height: '100%', objectFit: ajuste, display: 'block',
        filter: sombra ? 'drop-shadow(0 28px 24px rgba(0,0,0,0.45))' : undefined,
      }} />
    </div>
  )
}

function Selo({ tema, children }: { tema: Tema; children: ReactNode }) {
  return (
    <div style={{
      display: 'inline-block', maxWidth: '100%', background: tema.cores.destaque, color: '#FFFFFF', borderRadius: 999,
      padding: '10px 28px', fontSize: 26, fontWeight: 600, lineHeight: 1.25,
    }}>
      {children}
    </div>
  )
}

// Pinta o trecho `destaque` do título com a cor de destaque (sem diferenciar maiúsculas).
function comDestaque(texto: string, destaque: string | undefined, cor: string) {
  const alvo = destaque?.trim()
  if (!alvo) return texto
  const partes: ReactNode[] = []
  const minusculo = texto.toLocaleLowerCase('pt-BR')
  const busca = alvo.toLocaleLowerCase('pt-BR')
  let i = 0
  for (let k = minusculo.indexOf(busca); k >= 0; k = minusculo.indexOf(busca, i)) {
    partes.push(texto.slice(i, k), <span key={k} style={{ color: cor }}>{texto.slice(k, k + alvo.length)}</span>)
    i = k + alvo.length
  }
  partes.push(texto.slice(i))
  return partes
}

const TITULO: CSSProperties = { fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }
const AREA: CSSProperties = { position: 'absolute', top: TOPO, left: LADO, right: LADO, bottom: FIM_CONTEUDO, display: 'flex', flexDirection: 'column' }

// ─── Templates ───

function Capa({ tema, d, fotos }: { tema: Tema; d: DadosArte; fotos: (string | null)[] }) {
  const c = tema.cores
  return (
    <div style={{ ...AREA, alignItems: 'center', textAlign: 'center' }}>
      <Logo tema={tema} largura={130} />
      {d.selo && <div style={{ marginTop: 36 }}><Selo tema={tema}>{d.selo}</Selo></div>}
      <div style={{ marginTop: d.selo ? 24 : 40, width: '100%' }}>
        <Ajustar max={110} min={48} linhas={3} altura={1.02} style={TITULO}>{comDestaque(d.titulo ?? '', d.destaque, c.destaque)}</Ajustar>
      </div>
      {d.subtitulo && <div style={{ marginTop: 18, width: '100%', color: c.apoio }}><Ajustar max={34} min={22} linhas={2} altura={1.25}>{d.subtitulo}</Ajustar></div>}

      <div style={{ flex: 1, minHeight: 0, width: '100%', marginTop: 40 }}>
        {fotos.length === 1 ? (
          <Foto src={fotos[0]} placeholder={d.placeholder} tema={tema} sombra />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: fotos.length > 2 ? '1fr 1fr' : '1fr', gap: 20, height: '100%' }}>
            {fotos.map((f, i) => (
              <div key={i} style={{ minHeight: 0, borderRadius: 28, background: f ? 'rgba(255,255,255,0.04)' : undefined, padding: f ? 16 : 0 }}>
                <Foto src={f} placeholder={d.placeholder} tema={tema} />
              </div>
            ))}
          </div>
        )}
      </div>

      {d.seta && <div style={{ marginTop: 28, color: c.apoio, fontSize: 28, fontWeight: 600 }}>{d.seta}</div>}
    </div>
  )
}

function Produto({ tema, d }: { tema: Tema; d: DadosArte }) {
  const c = tema.cores
  const numeros = (d.numeracoes ?? '').split(/[\s,;/]+/).filter(Boolean)
  return (
    <div style={AREA}>
      {/* A etiqueta divide a linha do topo com a logo: fica com o que sobra à esquerda. */}
      <div style={{ height: 54, paddingRight: 130, display: 'flex', alignItems: 'flex-start' }}>
        {d.categoria && (
          <div style={{
            border: `2px solid ${c.destaque}`, color: c.destaque, borderRadius: 999, padding: '8px 22px', maxWidth: '100%',
            fontSize: 24, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {d.categoria}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, margin: '24px 0 28px' }}>
        <Foto src={d.foto} placeholder={d.placeholder} tema={tema} sombra />
      </div>

      {d.marca && <div style={{ color: c.apoio, fontSize: 28, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.2 }}>{d.marca}</div>}
      {d.modelo && <div style={{ marginTop: 6 }}><Ajustar max={52} min={30} linhas={2} altura={1.1} style={{ fontWeight: 800, letterSpacing: '-0.01em' }}>{d.modelo}</Ajustar></div>}

      {d.preco && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 24, background: c.destaque, borderRadius: 20, padding: '16px 32px', color: '#FFFFFF' }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>{d.preco}</div>
          {d.parcelas && <div style={{ flex: 1, minWidth: 0 }}><Ajustar max={22} min={16} linhas={2} altura={1.25}>{d.parcelas}</Ajustar></div>}
        </div>
      )}

      {numeros.length > 0 && (
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {numeros.map((n, i) => (
            <div key={i} style={{
              width: 56, height: 56, borderRadius: '50%', border: `2px solid ${c.texto}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: n.length > 2 ? 17 : 22, fontWeight: 600,
            }}>
              {n}
            </div>
          ))}
        </div>
      )}
      {d.genero && <div style={{ marginTop: 16, color: c.apoio, fontSize: 24 }}>{d.genero}</div>}
    </div>
  )
}

function Chamada({ tema, d }: { tema: Tema; d: DadosArte }) {
  const c = tema.cores
  return (
    <div style={{ ...AREA, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      {d.linha1 && <Ajustar max={96} min={44} linhas={2} altura={1.02} style={TITULO}>{d.linha1}</Ajustar>}
      {d.linha2 && <div style={{ width: '100%', color: c.apoio }}><Ajustar max={96} min={44} linhas={2} altura={1.02} style={TITULO}>{d.linha2}</Ajustar></div>}
      {d.whatsapp && (
        <div style={{
          marginTop: 64, maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 20, background: c.destaque, color: '#FFFFFF',
          borderRadius: 999, padding: '26px 52px',
        }}>
          <MessageCircle size={56} strokeWidth={2.4} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.01em', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{d.whatsapp}</span>
        </div>
      )}
      {d.apoio && <div style={{ marginTop: 40, width: '100%', color: c.apoio }}><Ajustar max={30} min={20} linhas={2} altura={1.3}>{d.apoio}</Ajustar></div>}
    </div>
  )
}

function Dica({ tema, d, progresso }: { tema: Tema; d: DadosArte; progresso: string }) {
  const c = tema.cores
  return (
    <div style={AREA}>
      <div style={{ color: c.destaque, fontSize: 160, fontWeight: 800, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{d.numero}</div>
      <div style={{ marginTop: 40 }}>
        <Ajustar max={56} min={32} linhas={3} altura={1.12} style={{ fontWeight: 800, letterSpacing: '-0.015em' }}>{d.texto}</Ajustar>
      </div>
      <div style={{ flex: 1, minHeight: 0, margin: '40px 0 24px' }}>
        {d.foto && <Foto src={d.foto} tema={tema} sombra />}
      </div>
      <div style={{ color: c.secundario, fontSize: 24, fontWeight: 600, letterSpacing: '0.12em' }}>{progresso}</div>
    </div>
  )
}

function FotoCheia({ tema, d }: { tema: Tema; d: DadosArte }) {
  return (
    <>
      {d.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.foto} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, background: '#1E1A24', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tema.cores.secundario, fontSize: 30, fontWeight: 600, letterSpacing: '0.14em',
        }}>
          {d.placeholder || 'FOTO'}
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 28%, rgba(0,0,0,0) 52%)' }} />
      <div style={{ position: 'absolute', left: LADO, right: LADO, bottom: FIM_CONTEUDO }}>
        {d.selo && <div style={{ marginBottom: 24 }}><Selo tema={tema}>{d.selo}</Selo></div>}
        <Ajustar max={72} min={40} linhas={2} altura={1.04} style={TITULO}>{d.titulo}</Ajustar>
      </div>
    </>
  )
}

function Info({ tema, d }: { tema: Tema; d: DadosArte }) {
  const c = tema.cores
  return (
    <div style={{ ...AREA, justifyContent: 'center' }}>
      {d.titulo && <div style={{ marginBottom: 72, paddingRight: 130 }}><Ajustar max={80} min={44} linhas={2} altura={1.02} style={TITULO}>{d.titulo}</Ajustar></div>}
      {(d.itens ?? []).slice(0, 4).map((item, i) => {
        const Icone = ICONES[item.icone] ?? MapPin
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: i ? 44 : 0 }}>
            <div style={{ width: 88, height: 88, flexShrink: 0, borderRadius: '50%', background: `${c.destaque}26`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icone size={44} color={c.destaque} strokeWidth={2.2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Ajustar max={40} min={24} linhas={2} altura={1.2} style={{ fontWeight: 600 }}>{item.texto}</Ajustar>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { getFontEmbedCSS, toBlob } from 'html-to-image'
import { zipSync } from 'fflate'
import { ALTURA, LARGURA } from '@/lib/social/artes'

// Espera as imagens do nó carregarem (fotos vêm do bucket, podem chegar depois da fonte).
async function imagensProntas(no: HTMLElement) {
  await Promise.all(Array.from(no.querySelectorAll('img')).map((img) =>
    img.complete ? Promise.resolve() : new Promise((ok) => { img.onload = img.onerror = () => ok(null) }),
  ))
}

// PNG 1080 × 1350 de cada nó de arte (componente <Arte>), na ordem recebida.
export async function exportarPngs(nos: HTMLElement[]): Promise<Blob[]> {
  if (!nos.length) return []
  await document.fonts.ready
  await Promise.all(nos.map(imagensProntas))
  const opcoes = { width: LARGURA, height: ALTURA, pixelRatio: 1, fontEmbedCSS: await getFontEmbedCSS(nos[0]) }
  // A primeira chamada do html-to-image às vezes sai sem fonte ou imagem: aquece antes.
  await toBlob(nos[0], opcoes).catch(() => null)
  const blobs: Blob[] = []
  for (const no of nos) {
    const blob = await toBlob(no, opcoes)
    if (!blob) throw new Error('Não foi possível gerar a imagem.')
    blobs.push(blob)
  }
  return blobs
}

export const nomeLamina = (i: number) => `${String(i + 1).padStart(2, '0')}.png`

export async function baixarZip(blobs: Blob[], nome: string) {
  const arquivos: Record<string, Uint8Array> = {}
  for (const [i, b] of blobs.entries()) arquivos[nomeLamina(i)] = new Uint8Array(await b.arrayBuffer())
  const zip = zipSync(arquivos, { level: 0 }) // PNG já é comprimido
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// "Qual tênis é o seu?" → "qual-tenis-e-o-seu"
export const nomeArquivo = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'artes'

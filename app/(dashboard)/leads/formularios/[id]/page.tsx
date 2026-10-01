'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, Save, Lock } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormularioPreview } from '@/components/leads/formulario-preview'
import { createClient } from '@/lib/supabase/client'
import { cn, slugify } from '@/lib/utils'
import {
  CHAVE_NOME, campoTipoOpcoes, novoCampo, tiposComOpcoes, validarEstrutura,
  type Campo, type CampoTipo, type Formulario,
} from '@/lib/leads/formulario'

const SLUG_DO_SITE = 'site-contato'

function CampoEditor({ campo, primeiro, ultimo, onChange, onMove, onRemove }: {
  campo: Campo
  primeiro: boolean
  ultimo: boolean
  onChange: (c: Campo) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const fixo = campo.chave === CHAVE_NOME
  const temOpcoes = tiposComOpcoes.includes(campo.tipo)

  function mudarTipo(tipo: CampoTipo) {
    const precisaOpcoes = tiposComOpcoes.includes(tipo)
    onChange({
      ...campo,
      tipo,
      opcoes: precisaOpcoes ? (campo.opcoes?.length ? campo.opcoes : ['Opção 1', 'Opção 2']) : undefined,
      largura: precisaOpcoes || tipo === 'textarea' ? 'inteira' : campo.largura,
    })
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Pergunta</Label>
            <Input value={campo.rotulo} onChange={(e) => onChange({ ...campo, rotulo: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            {fixo ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.06] px-3 text-sm text-brand-lavanda/50">
                <Lock className="h-3.5 w-3.5" /> Nome do lead (fixo)
              </div>
            ) : (
              <Select value={campo.tipo} onValueChange={(v) => mudarTipo(v as CampoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {campoTipoOpcoes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label} <span className="text-brand-lavanda/40">· {t.descricao}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {temOpcoes ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Opções <span className="text-brand-lavanda/40">(uma por linha)</span></Label>
              <Textarea
                rows={Math.max(3, (campo.opcoes?.length ?? 0) + 1)}
                value={(campo.opcoes ?? []).join('\n')}
                onChange={(e) => onChange({ ...campo, opcoes: e.target.value.split('\n') })}
              />
            </div>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Texto de exemplo <span className="text-brand-lavanda/40">(placeholder)</span></Label>
              <Input value={campo.placeholder ?? ''} onChange={(e) => onChange({ ...campo, placeholder: e.target.value })} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <label className={cn('flex items-center gap-2 text-xs text-brand-lavanda/70', fixo && 'opacity-50')}>
              <input
                type="checkbox"
                checked={campo.obrigatorio}
                disabled={fixo}
                onChange={(e) => onChange({ ...campo, obrigatorio: e.target.checked })}
                className="h-4 w-4 accent-[#7C3AED]"
              />
              Obrigatório
            </label>
            <div className="flex rounded-lg border border-white/[0.08] p-0.5 text-xs">
              {(['metade', 'inteira'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onChange({ ...campo, largura: l })}
                  className={cn('rounded-md px-2.5 py-1', campo.largura === l ? 'bg-white/[0.08] text-brand-lavanda' : 'text-brand-lavanda/40 hover:text-brand-lavanda/70')}
                >
                  {l === 'metade' ? 'Meia linha' : 'Linha inteira'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={primeiro} onClick={() => onMove(-1)} title="Subir">
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={ultimo} onClick={() => onMove(1)} title="Descer">
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          {!fixo && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:text-brand-rosa" onClick={onRemove} title="Remover campo">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EditarFormularioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [form, setForm] = useState<Formulario | null>(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await (createClient() as any).from('formularios').select('*').eq('id', id).maybeSingle()
      if (!data) setNaoEncontrado(true)
      else setForm({ ...data, campos: data.campos ?? [] })
    }
    load()
  }, [id])

  function editar(parcial: Partial<Formulario>) {
    setForm((f) => (f ? { ...f, ...parcial } : f))
    setSujo(true)
    setMensagem(null)
  }

  function editarCampo(index: number, campo: Campo) {
    if (!form) return
    editar({ campos: form.campos.map((c, i) => (i === index ? campo : c)) })
  }

  function moverCampo(index: number, dir: -1 | 1) {
    if (!form) return
    const campos = [...form.campos]
    ;[campos[index], campos[index + dir]] = [campos[index + dir], campos[index]]
    editar({ campos })
  }

  async function salvar() {
    if (!form) return
    const campos = form.campos.map((c) => ({
      ...c,
      rotulo: c.rotulo.trim(),
      opcoes: c.opcoes?.map((o) => o.trim()).filter(Boolean),
    }))
    const problema = validarEstrutura(campos) ?? (!form.nome.trim() ? 'Dê um nome ao formulário.' : null) ?? (!form.slug ? 'Informe o identificador.' : null)
    if (problema) {
      setMensagem({ tipo: 'erro', texto: problema })
      return
    }

    setSalvando(true)
    const { error } = await (createClient() as any)
      .from('formularios')
      .update({
        nome: form.nome.trim(),
        slug: form.slug,
        titulo: form.titulo?.trim() || null,
        subtitulo: form.subtitulo?.trim() || null,
        botao_texto: form.botao_texto.trim() || 'Enviar',
        mensagem_sucesso: form.mensagem_sucesso.trim() || 'Recebemos sua mensagem!',
        campos,
        ativo: form.ativo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', form.id)
    setSalvando(false)

    if (error) {
      setMensagem({ tipo: 'erro', texto: error.code === '23505' ? 'Já existe um formulário com esse identificador.' : 'Não foi possível salvar.' })
      return
    }
    setForm({ ...form, campos })
    setSujo(false)
    setMensagem({ tipo: 'ok', texto: 'Salvo! O site pega a nova versão em até 1 minuto.' })
  }

  async function excluir() {
    if (!form) return
    if (!confirmarExclusao) {
      setConfirmarExclusao(true)
      return
    }
    const { error } = await (createClient() as any).from('formularios').delete().eq('id', form.id)
    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível excluir.' })
      return
    }
    router.push('/leads/formularios')
  }

  if (naoEncontrado) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Formulário" />
        <main className="p-4 md:p-6 text-sm text-brand-lavanda/50">Formulário não encontrado. <Link href="/leads/formularios" className="text-brand-lima">Voltar</Link></main>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Formulário" />
        <main className="p-4 md:p-6 text-sm text-brand-lavanda/40">Carregando...</main>
      </div>
    )
  }

  const ehDoSite = form.slug === SLUG_DO_SITE

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={form.nome} description="Construtor de formulário" />

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/leads/formularios" className="inline-flex items-center gap-1.5 text-xs text-brand-lavanda/50 hover:text-brand-lavanda">
            <ArrowLeft className="h-3.5 w-3.5" /> Formulários
          </Link>
          <div className="flex items-center gap-3">
            {mensagem && <p className={cn('text-xs', mensagem.tipo === 'ok' ? 'text-brand-lima' : 'text-brand-rosa')}>{mensagem.texto}</p>}
            <Button onClick={salvar} disabled={salvando || !sujo}>
              <Save className="h-4 w-4" /> {salvando ? 'Salvando…' : sujo ? 'Salvar alterações' : 'Salvo'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome interno</Label>
                  <Input value={form.nome} onChange={(e) => editar({ nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Identificador (slug)</Label>
                  <Input value={form.slug} onChange={(e) => editar({ slug: slugify(e.target.value) })} className="font-mono" />
                  <p className="text-[11px] text-brand-lavanda/40">
                    {ehDoSite ? 'Este é o formulário usado na seção de contato do site.' : `O site usa o formulário "${SLUG_DO_SITE}".`}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Título</Label>
                  <Input value={form.titulo ?? ''} onChange={(e) => editar({ titulo: e.target.value })} />
                  {ehDoSite && <p className="text-[11px] text-brand-lavanda/40">No site, a manchete &quot;Vamos traçar o próximo projeto?&quot; faz parte do design e não muda por aqui — subtítulo, campos, botão e mensagem sim.</p>}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Subtítulo</Label>
                  <Textarea rows={2} value={form.subtitulo ?? ''} onChange={(e) => editar({ subtitulo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto do botão</Label>
                  <Input value={form.botao_texto} onChange={(e) => editar({ botao_texto: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem após enviar</Label>
                  <Input value={form.mensagem_sucesso} onChange={(e) => editar({ mensagem_sucesso: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm text-brand-lavanda/80 sm:col-span-2">
                  <input type="checkbox" checked={form.ativo} onChange={(e) => editar({ ativo: e.target.checked })} className="h-4 w-4 accent-[#7C3AED]" />
                  No ar <span className="text-xs text-brand-lavanda/40">— pausado, o site mostra só o e-mail de contato</span>
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Campos</CardTitle>
                <Button size="sm" variant="outline" onClick={() => editar({ campos: [...form.campos, novoCampo()] })}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar campo
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.campos.map((campo, i) => (
                  <CampoEditor
                    key={campo.id}
                    campo={campo}
                    primeiro={i === 0}
                    ultimo={i === form.campos.length - 1}
                    onChange={(c) => editarCampo(i, c)}
                    onMove={(dir) => moverCampo(i, dir)}
                    onRemove={() => editar({ campos: form.campos.filter((_, j) => j !== i) })}
                  />
                ))}
                <p className="pt-1 text-[11px] text-brand-lavanda/40">
                  Campos de e-mail e telefone viram o contato do lead; um campo de texto com a pergunta &quot;Empresa&quot; preenche a empresa.
                </p>
              </CardContent>
            </Card>

            <Button variant="ghost" size="sm" onClick={excluir} className="text-brand-rosa/70 hover:text-brand-rosa">
              <Trash2 className="h-3.5 w-3.5" /> {confirmarExclusao ? 'Clique de novo para excluir (os leads recebidos são mantidos)' : 'Excluir formulário'}
            </Button>
          </div>

          <div className="xl:sticky xl:top-20 xl:self-start">
            <p className="mb-2 text-xs font-medium text-brand-lavanda/50">Pré-visualização</p>
            <FormularioPreview titulo={form.titulo ?? ''} subtitulo={form.subtitulo ?? ''} botao={form.botao_texto} campos={form.campos} />
          </div>
        </div>
      </main>
    </div>
  )
}

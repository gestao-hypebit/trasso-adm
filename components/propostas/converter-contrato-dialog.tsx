'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, FileCheck, FolderOpen, DollarSign, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { proximoNumeroContrato } from '@/lib/contratos/numero'
import { formatCurrency, toISODateLocal, addMonthsISO, cn } from '@/lib/utils'

type Item = { quantidade: number; valor_unitario: number; recorrencia: string | null }
type PropostaData = {
  id: string; numero: string; titulo: string; descricao: string | null; cliente_id: string | null
  condicoes_pagamento: string | null; desconto_percentual: number; valor_final: number
  responsavel_id: string | null
  proposta_itens: Item[]
}

const intervaloMeses: Record<string, number> = { mensal: 1, trimestral: 3, anual: 12 }

interface Props {
  propostaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Secao({ icon: Icon, titulo, ativo, onToggle, children }: {
  icon: React.FC<{ className?: string }>; titulo: string; ativo: boolean; onToggle?: (v: boolean) => void; children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-3 transition-colors', ativo ? 'border-brand-violeta/30 bg-brand-violeta/[0.04]' : 'border-white/[0.06]')}>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        {onToggle && (
          <input type="checkbox" checked={ativo} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-[#7C3AED]" />
        )}
        <Icon className="h-4 w-4 text-brand-violeta" />
        <span className="text-sm font-semibold text-brand-lavanda">{titulo}</span>
      </label>
      {ativo && children}
    </div>
  )
}

export function ConverterContratoDialog({ propostaId, open, onOpenChange }: Props) {
  const router = useRouter()
  const [proposta, setProposta] = useState<PropostaData | null>(null)
  const [contratoExistente, setContratoExistente] = useState<{ id: string; numero: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = toISODateLocal(new Date())
  const [contrato, setContrato] = useState({
    titulo: '', tipo: 'pontual', data_inicio: hoje, data_fim: '', valor_total: '', condicoes_pagamento: '', clausulas: '',
  })
  const [criarProjeto, setCriarProjeto] = useState(true)
  const [projeto, setProjeto] = useState({ nome: '', tipo: 'site', data_entrega: '' })
  const [gerarParcelas, setGerarParcelas] = useState(true)
  const [parcelas, setParcelas] = useState({ valor: '', quantidade: '1', primeiro_vencimento: hoje })
  const [gerarRecorrentes, setGerarRecorrentes] = useState(true)
  const [recorrentes, setRecorrentes] = useState({ meses: '12', primeiro_vencimento: addMonthsISO(hoje, 1) })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setErro(null)
    const supabase = createClient() as any
    async function load() {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('propostas')
          .select('id, numero, titulo, descricao, cliente_id, condicoes_pagamento, desconto_percentual, valor_final, responsavel_id, proposta_itens(quantidade, valor_unitario, recorrencia)')
          .eq('id', propostaId).single(),
        supabase.from('contratos').select('id, numero').eq('proposta_id', propostaId).limit(1).maybeSingle(),
      ])
      const prop = p as PropostaData | null
      setProposta(prop)
      setContratoExistente(c ?? null)
      if (prop) {
        const itens = prop.proposta_itens ?? []
        const avulso = itens.filter(i => !i.recorrencia || i.recorrencia === 'avulso')
          .reduce((s, i) => s + i.quantidade * i.valor_unitario, 0) * (1 - (prop.desconto_percentual ?? 0) / 100)
        const temRecorrente = itens.some(i => i.recorrencia && i.recorrencia !== 'avulso')
        setContrato((f) => ({
          ...f,
          titulo: prop.titulo,
          tipo: temRecorrente && avulso === 0 ? 'retainer' : 'pontual',
          valor_total: String(Number(prop.valor_final ?? 0).toFixed(2)),
          condicoes_pagamento: prop.condicoes_pagamento ?? '',
        }))
        setProjeto((f) => ({ ...f, nome: prop.titulo }))
        setParcelas((f) => ({ ...f, valor: avulso.toFixed(2) }))
        setGerarParcelas(avulso > 0)
        setGerarRecorrentes(temRecorrente)
      }
      setLoading(false)
    }
    load()
  }, [open, propostaId])

  const itensRecorrentes = (proposta?.proposta_itens ?? []).filter(i => i.recorrencia && i.recorrencia !== 'avulso')
  const valorParcela = Number(parcelas.valor || 0) / Math.max(1, Number(parcelas.quantidade || 1))

  async function handleConverter() {
    if (!proposta) return
    if (!contrato.titulo.trim()) { setErro('Informe o título do contrato.'); return }
    setSalvando(true)
    setErro(null)
    const supabase = createClient() as any

    try {
      const numero = await proximoNumeroContrato(supabase)
      const { data: novoContrato, error: errContrato } = await supabase.from('contratos').insert({
        numero,
        proposta_id: proposta.id,
        cliente_id: proposta.cliente_id,
        titulo: contrato.titulo.trim(),
        tipo: contrato.tipo,
        status: 'rascunho',
        valor_total: Number(contrato.valor_total || 0),
        data_inicio: contrato.data_inicio || null,
        data_fim: contrato.data_fim || null,
        condicoes_pagamento: contrato.condicoes_pagamento || null,
        clausulas: contrato.clausulas || null,
        responsavel_id: proposta.responsavel_id,
      }).select('id').single()
      if (errContrato) throw errContrato

      let projetoId: string | null = null
      if (criarProjeto) {
        const { data: novoProjeto, error: errProjeto } = await supabase.from('projetos').insert({
          nome: projeto.nome.trim() || contrato.titulo.trim(),
          descricao: proposta.descricao,
          cliente_id: proposta.cliente_id,
          contrato_id: novoContrato.id,
          tipo: projeto.tipo,
          status: 'backlog',
          prioridade: 'media',
          valor: Number(contrato.valor_total || 0),
          data_inicio: contrato.data_inicio || null,
          data_entrega: projeto.data_entrega || null,
          progresso: 0,
          responsavel_id: proposta.responsavel_id,
        }).select('id').single()
        if (errProjeto) throw errProjeto
        projetoId = novoProjeto.id
      }

      const { data: categorias } = await supabase.from('categorias_financeiras').select('id, nome').eq('tipo', 'receita')
      const categoriaId = (nome: string) =>
        (categorias ?? []).find((c: { nome: string }) => c.nome.toLowerCase() === nome.toLowerCase())?.id ?? null

      const lancamentos: Record<string, unknown>[] = []
      const base = { tipo: 'receita', status: 'pendente', cliente_id: proposta.cliente_id, projeto_id: projetoId }

      if (gerarParcelas && Number(parcelas.valor) > 0) {
        const qtd = Math.max(1, Math.floor(Number(parcelas.quantidade) || 1))
        const total = Number(parcelas.valor)
        const valorBase = Math.floor((total / qtd) * 100) / 100
        for (let i = 0; i < qtd; i++) {
          const valor = i === qtd - 1 ? Number((total - valorBase * (qtd - 1)).toFixed(2)) : valorBase
          lancamentos.push({
            ...base,
            descricao: qtd > 1 ? `${contrato.titulo} — parcela ${i + 1}/${qtd} (${numero})` : `${contrato.titulo} (${numero})`,
            valor,
            data: addMonthsISO(parcelas.primeiro_vencimento, i),
            categoria_id: categoriaId('Serviços prestados'),
            recorrente: false,
            frequencia: null,
          })
        }
      }

      if (gerarRecorrentes && itensRecorrentes.length > 0) {
        const meses = Math.max(1, Math.floor(Number(recorrentes.meses) || 12))
        const porFrequencia: Record<string, number> = {}
        for (const i of itensRecorrentes) {
          porFrequencia[i.recorrencia!] = (porFrequencia[i.recorrencia!] ?? 0) + i.quantidade * i.valor_unitario
        }
        for (const [freq, valor] of Object.entries(porFrequencia)) {
          const passo = intervaloMeses[freq] ?? 1
          for (let m = 0; m < meses; m += passo) {
            lancamentos.push({
              ...base,
              descricao: `${contrato.titulo} — ${freq} (${numero})`,
              valor: Number(valor.toFixed(2)),
              data: addMonthsISO(recorrentes.primeiro_vencimento, m),
              categoria_id: categoriaId('Mensalidade retainer') ?? categoriaId('Serviços prestados'),
              recorrente: true,
              frequencia: freq,
            })
          }
        }
      }

      if (lancamentos.length > 0) {
        const { error: errLanc } = await supabase.from('lancamentos').insert(lancamentos)
        if (errLanc) throw new Error(`Contrato criado, mas as parcelas falharam: ${errLanc.message}`)
      }

      onOpenChange(false)
      router.push(`/contratos/${novoContrato.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message
      setErro(msg ?? 'Erro ao converter proposta.')
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter em contrato</DialogTitle>
          <DialogDescription>
            {proposta ? `Proposta ${proposta.numero} · ${formatCurrency(proposta.valor_final)}` : 'Carregando proposta...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-lavanda/40" /></div>
        ) : !proposta ? (
          <p className="text-sm text-brand-lavanda/50 py-6">Proposta não encontrada.</p>
        ) : contratoExistente ? (
          <div className="py-4 space-y-3">
            <p className="text-sm text-brand-lavanda/70">
              Esta proposta já foi convertida no contrato <span className="font-mono text-brand-lavanda">{contratoExistente.numero}</span>.
            </p>
            <Link href={`/contratos/${contratoExistente.id}`}>
              <Button size="sm"><FileCheck className="h-4 w-4" /> Ver contrato</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <Secao icon={FileCheck} titulo="Contrato" ativo>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Título</Label>
                  <Input value={contrato.titulo} onChange={(e) => setContrato({ ...contrato, titulo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={contrato.tipo} onValueChange={(v) => setContrato({ ...contrato, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pontual">Pontual</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                      <SelectItem value="parceria">Parceria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor total (R$)</Label>
                  <Input type="number" step="0.01" value={contrato.valor_total} onChange={(e) => setContrato({ ...contrato, valor_total: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input type="date" value={contrato.data_inicio} onChange={(e) => setContrato({ ...contrato, data_inicio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Término (opcional)</Label>
                  <Input type="date" value={contrato.data_fim} onChange={(e) => setContrato({ ...contrato, data_fim: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Condições de pagamento</Label>
                  <Input value={contrato.condicoes_pagamento} onChange={(e) => setContrato({ ...contrato, condicoes_pagamento: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Cláusulas (opcional)</Label>
                  <Textarea rows={3} value={contrato.clausulas} onChange={(e) => setContrato({ ...contrato, clausulas: e.target.value })} placeholder="Você pode completar depois, na tela do contrato." />
                </div>
              </div>
            </Secao>

            <Secao icon={FolderOpen} titulo="Criar projeto vinculado" ativo={criarProjeto} onToggle={setCriarProjeto}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nome do projeto</Label>
                  <Input value={projeto.nome} onChange={(e) => setProjeto({ ...projeto, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={projeto.tipo} onValueChange={(v) => setProjeto({ ...projeto, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="site">Site</SelectItem>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="identidade_visual">Identidade Visual</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entrega prevista</Label>
                  <Input type="date" value={projeto.data_entrega} onChange={(e) => setProjeto({ ...projeto, data_entrega: e.target.value })} />
                </div>
              </div>
            </Secao>

            <Secao icon={DollarSign} titulo="Gerar parcelas no financeiro" ativo={gerarParcelas} onToggle={setGerarParcelas}>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={parcelas.valor} onChange={(e) => setParcelas({ ...parcelas, valor: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Parcelas</Label>
                  <Input type="number" min={1} max={48} value={parcelas.quantidade} onChange={(e) => setParcelas({ ...parcelas, quantidade: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>1º vencimento</Label>
                  <Input type="date" value={parcelas.primeiro_vencimento} onChange={(e) => setParcelas({ ...parcelas, primeiro_vencimento: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-brand-lavanda/50">
                {parcelas.quantidade}x de {formatCurrency(valorParcela)}, mensais, como receitas pendentes.
              </p>
            </Secao>

            {itensRecorrentes.length > 0 && (
              <Secao icon={RefreshCw} titulo="Gerar cobranças recorrentes" ativo={gerarRecorrentes} onToggle={setGerarRecorrentes}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Duração (meses)</Label>
                    <Input type="number" min={1} max={60} value={recorrentes.meses} onChange={(e) => setRecorrentes({ ...recorrentes, meses: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>1º vencimento</Label>
                    <Input type="date" value={recorrentes.primeiro_vencimento} onChange={(e) => setRecorrentes({ ...recorrentes, primeiro_vencimento: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-brand-lavanda/50">
                  Itens recorrentes da proposta: {itensRecorrentes.map(i => `${formatCurrency(i.quantidade * i.valor_unitario)} ${i.recorrencia}`).join(' + ')}
                </p>
              </Secao>
            )}

            {erro && <p className="text-xs text-brand-rosa break-words">{erro}</p>}
          </div>
        )}

        {!loading && proposta && !contratoExistente && (
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleConverter} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileCheck className="h-4 w-4" /> Converter</>}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

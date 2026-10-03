'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, toISODateLocal } from '@/lib/utils'
import { cicloLabel, formaLabel, type AssinaturaAsaas, type CobrancaAsaas } from '@/lib/asaas/rotulos'

// Toda alteração no Asaas passa por aqui: mostra o que vai acontecer e só
// manda depois do "Confirmar".
export type AcaoAsaas =
  | { tipo: 'vencimento'; cobranca: CobrancaAsaas }
  | { tipo: 'recebida'; cobranca: CobrancaAsaas }
  | { tipo: 'cancelar_fatura'; cobranca: CobrancaAsaas }
  | { tipo: 'editar_assinatura'; assinatura: AssinaturaAsaas }
  | { tipo: 'cancelar_assinatura'; assinatura: AssinaturaAsaas }

const FORMAS = ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED']

// "1.234,56" ou "1234.56" → 1234.56
const lerValor = (v: string) => Number(v.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
const mostrarValor = (n: number) => n.toFixed(2).replace('.', ',')

async function enviar(url: string, method: 'POST' | 'DELETE', corpo?: unknown) {
  const res = await fetch(url, {
    method,
    headers: corpo ? { 'content-type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
  return json
}

export function AcaoAsaasDialog({ acao, nome, onClose, onFeito }: {
  acao: AcaoAsaas | null
  nome: string
  onClose: () => void
  onFeito: (mensagem: string) => void
}) {
  const hoje = toISODateLocal(new Date())
  const [data, setData] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('')
  const [atualizarAbertas, setAtualizarAbertas] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setErro(null)
    setEnviando(false)
    setAtualizarAbertas(true)
    if (!acao) return
    if (acao.tipo === 'vencimento') {
      setData(acao.cobranca.vencimento < hoje ? hoje : acao.cobranca.vencimento)
      setValor(mostrarValor(acao.cobranca.valor))
    } else if (acao.tipo === 'recebida') {
      setData(hoje)
      setValor(mostrarValor(acao.cobranca.valor))
    } else if (acao.tipo === 'editar_assinatura') {
      setData(acao.assinatura.proximoVencimento)
      setValor(mostrarValor(acao.assinatura.valor))
      setForma(acao.assinatura.formaPagamento)
    }
  }, [acao, hoje])

  if (!acao) return null

  const cob = 'cobranca' in acao ? acao.cobranca : null
  const sub = 'assinatura' in acao ? acao.assinatura : null
  const destrutiva = acao.tipo === 'cancelar_fatura' || acao.tipo === 'cancelar_assinatura'

  const textos = {
    vencimento: {
      titulo: 'Mudar vencimento (2ª via)',
      descricao: 'A fatura passa a vencer na nova data. O link continua o mesmo, então dá para mandar de novo para o cliente.',
      botao: 'Mudar vencimento',
    },
    recebida: {
      titulo: 'Marcar como paga',
      descricao: 'Use quando o cliente pagou fora do Asaas (PIX direto, dinheiro…). A fatura fica como "recebida em dinheiro" no Asaas e o cliente não é avisado.',
      botao: 'Marcar como paga',
    },
    cancelar_fatura: {
      titulo: 'Cancelar fatura',
      descricao: 'A fatura é excluída no Asaas e o link para de funcionar. Isso não dá para desfazer.',
      botao: 'Cancelar fatura',
    },
    editar_assinatura: {
      titulo: 'Alterar assinatura',
      descricao: 'Muda a assinatura no Asaas. As próximas faturas já saem com os novos dados.',
      botao: 'Salvar no Asaas',
    },
    cancelar_assinatura: {
      titulo: 'Cancelar assinatura',
      descricao: 'A assinatura é encerrada no Asaas: não gera mais faturas, e as faturas em aberto dela são removidas. Faturas já pagas continuam lá. Isso não dá para desfazer.',
      botao: 'Cancelar assinatura',
    },
  }[acao.tipo]

  async function confirmar() {
    if (!acao) return
    setErro(null)
    const num = lerValor(valor)
    if ((acao.tipo === 'vencimento' || acao.tipo === 'recebida' || acao.tipo === 'editar_assinatura') && !(num > 0)) {
      setErro('Informe um valor válido.')
      return
    }
    if ((acao.tipo === 'vencimento' || acao.tipo === 'recebida' || acao.tipo === 'editar_assinatura') && !data) {
      setErro('Informe a data.')
      return
    }
    setEnviando(true)
    try {
      let mensagem = ''
      if (acao.tipo === 'vencimento') {
        await enviar(`/api/asaas/cobrancas/${acao.cobranca.id}`, 'POST', { acao: 'vencimento', vencimento: data, valor: num })
        mensagem = `Fatura agora vence em ${formatDate(data)}.`
      } else if (acao.tipo === 'recebida') {
        await enviar(`/api/asaas/cobrancas/${acao.cobranca.id}`, 'POST', { acao: 'recebida', data, valor: num })
        mensagem = 'Fatura marcada como paga.'
      } else if (acao.tipo === 'cancelar_fatura') {
        await enviar(`/api/asaas/cobrancas/${acao.cobranca.id}`, 'DELETE')
        mensagem = 'Fatura cancelada.'
      } else if (acao.tipo === 'editar_assinatura') {
        const s = acao.assinatura
        const mudou = {
          ...(num !== s.valor ? { valor: num } : {}),
          ...(data !== s.proximoVencimento ? { proximoVencimento: data } : {}),
          ...(forma !== s.formaPagamento ? { formaPagamento: forma } : {}),
        }
        if (!Object.keys(mudou).length) { onClose(); return }
        await enviar(`/api/asaas/assinaturas/${s.id}`, 'POST', { ...mudou, atualizarAbertas })
        mensagem = 'Assinatura atualizada.'
      } else {
        const r = await enviar(`/api/asaas/assinaturas/${acao.assinatura.id}`, 'DELETE')
        mensagem = r.faturasRemovidas ? `Assinatura cancelada (${r.faturasRemovidas} fatura(s) em aberto removida(s)).` : 'Assinatura cancelada.'
      }
      onFeito(mensagem)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao falar com o Asaas.')
      setEnviando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !enviando) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{textos.titulo}</DialogTitle>
          <DialogDescription>{textos.descricao}</DialogDescription>
        </DialogHeader>

        {/* Do que se trata */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
          <p className="font-medium text-brand-lavanda">{nome}</p>
          {cob && (
            <p className="text-xs text-brand-lavanda/50">
              Fatura de {formatCurrency(cob.valor)} · vence {formatDate(cob.vencimento)}{cob.descricao ? ` · ${cob.descricao}` : ''}
            </p>
          )}
          {sub && (
            <p className="text-xs text-brand-lavanda/50">
              Assinatura de {formatCurrency(sub.valor)} / {cicloLabel[sub.ciclo] ?? sub.ciclo} · {formaLabel[sub.formaPagamento] ?? sub.formaPagamento}
            </p>
          )}
        </div>

        {(acao.tipo === 'vencimento' || acao.tipo === 'recebida' || acao.tipo === 'editar_assinatura') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-brand-lavanda/80">
                {acao.tipo === 'recebida' ? 'Pago em' : acao.tipo === 'vencimento' ? 'Novo vencimento' : 'Vencimento da próxima fatura a gerar'}
              </Label>
              <Input type="date" value={data} min={acao.tipo === 'recebida' ? undefined : hoje} max={acao.tipo === 'recebida' ? hoje : undefined} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-brand-lavanda/80">{acao.tipo === 'recebida' ? 'Valor recebido (R$)' : 'Valor (R$)'}</Label>
              <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            {acao.tipo === 'editar_assinatura' && (
              <>
                <div className="col-span-2">
                  <Label className="mb-1.5 block text-xs text-brand-lavanda/80">Forma de pagamento</Label>
                  <select
                    value={forma}
                    onChange={(e) => setForma(e.target.value)}
                    className="h-9 w-full rounded-md border border-white/[0.1] bg-transparent px-3 text-sm text-brand-lavanda outline-none"
                  >
                    {FORMAS.map((f) => <option key={f} value={f} className="bg-brand-noite">{formaLabel[f]}</option>)}
                  </select>
                </div>
                <label className="col-span-2 flex items-start gap-2 text-xs text-brand-lavanda/70">
                  <input type="checkbox" className="mt-0.5 accent-[#B8F000]" checked={atualizarAbertas} onChange={(e) => setAtualizarAbertas(e.target.checked)} />
                  Aplicar o novo valor e a forma também às faturas já geradas e ainda não pagas
                </label>
              </>
            )}
          </div>
        )}

        {destrutiva && (
          <p className="flex items-start gap-2 rounded-lg border border-brand-rosa/20 bg-brand-rosa/[0.05] px-3 py-2 text-xs text-brand-rosa">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Essa alteração vale na conta real do Asaas.
          </p>
        )}

        {erro && <p className="text-xs text-brand-rosa">{erro}</p>}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>Voltar</Button>
          <Button variant={destrutiva ? 'destructive' : 'default'} onClick={confirmar} disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />} {textos.botao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

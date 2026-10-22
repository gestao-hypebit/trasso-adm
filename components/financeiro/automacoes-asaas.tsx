'use client'

import { useState } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Resultado = {
  assinaturas: { acompanhadas?: number; novos?: string[]; cancelamentos?: string[]; semCadastro?: string[]; pulado?: string; erro?: string }
  cobranca: { avisados?: number; pulado?: string; erro?: string }
}

// O que roda sozinho todo dia às 9h (e depois de cada aviso de pagamento do Asaas).
export function AutomacoesAsaas() {
  const [rodando, setRodando] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function rodar() {
    setRodando(true)
    setErro(null)
    try {
      const r = await fetch('/api/cron/diario')
      const json = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
      setRes(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao rodar.')
    } finally {
      setRodando(false)
    }
  }

  const a = res?.assinaturas
  const c = res?.cobranca
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-brand-lima" /> Automações</CardTitle>
          <Button size="sm" variant="outline" onClick={rodar} disabled={rodando}>
            {rodando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rodar agora'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-brand-lavanda/70">
        <ul className="list-disc space-y-1 pl-5 text-xs text-brand-lavanda/60">
          <li><b className="text-brand-lavanda/80">Metas sozinhas:</b> 1º pagamento de uma assinatura do Catálogo Place ou da Clubelly vira &quot;cliente novo&quot;; cancelamento depois de ter pago vira &quot;cancelamento&quot;. Você só completa o canal e o motivo.</li>
          <li><b className="text-brand-lavanda/80">Aviso de cancelamento</b> no sino, para tentar reter o cliente.</li>
          <li><b className="text-brand-lavanda/80">Sem cadastro:</b> quem pagou a 1ª fatura sem ter cliente no sistema gera um aviso para criar o cliente com os dados do Asaas.</li>
          <li><b className="text-brand-lavanda/80">Régua de cobrança:</b> avisa quem chegou em 3, 7 e 15 dias de atraso, com a lista em MRR e assinaturas.</li>
        </ul>
        <p className="text-[11px] text-brand-lavanda/40">
          Roda todo dia às 9h e logo depois de cada pagamento avisado pelo Asaas. Para o aviso de cancelamento chegar na hora, marque também os eventos de <b>Assinaturas</b> no webhook do Asaas (Integrações → Webhooks). Na primeira vez, o que já existe vira ponto de partida: nada antigo é lançado nas Metas.
        </p>
        {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        {res && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs space-y-1">
            {a?.pulado || a?.erro ? <p className="text-yellow-400">Assinaturas: {a.pulado ?? a.erro}</p> : (
              <p>
                {a?.acompanhadas ?? 0} assinaturas acompanhadas ·{' '}
                {a?.novos?.length ?? 0} novo(s){a?.novos?.length ? `: ${a.novos.join(', ')}` : ''} ·{' '}
                {a?.cancelamentos?.length ?? 0} cancelamento(s){a?.cancelamentos?.length ? `: ${a.cancelamentos.join(', ')}` : ''}
                {a?.semCadastro?.length ? ` · sem cadastro: ${a.semCadastro.join(', ')}` : ''}
              </p>
            )}
            {c?.pulado || c?.erro ? <p className="text-yellow-400">Cobrança: {c.pulado ?? c.erro}</p> : <p>Régua de cobrança: {c?.avisados ?? 0} aviso(s) novo(s) no sino.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

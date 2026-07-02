import { Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { ServicoContratado } from '@/lib/portal/servicos'

export function ServicoBadgeList({ servicos, extras }: { servicos: ServicoContratado[]; extras: string[] }) {
  if (servicos.length === 0 && extras.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Layers className="h-8 w-8 text-brand-lavanda/20 mx-auto mb-2" />
          <p className="text-sm text-brand-lavanda/40">Nenhum serviço contratado ainda.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-2">
          {servicos.map((s) => (
            <Badge key={s.id} variant="ativo" className="px-3 py-1.5 text-sm">
              {s.nome}{s.categoria ? ` · ${s.categoria}` : ''}
            </Badge>
          ))}
          {extras.map((descricao) => (
            <Badge key={descricao} variant="ativo" className="px-3 py-1.5 text-sm">{descricao}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, normalizarCabecalho, toCSV, downloadCSV } from '@/lib/csv'
import { origemOpcoes, segmentoOpcoes } from '@/lib/crm/opcoes'

const ALIASES: Record<string, string> = {
  nome: 'nome', name: 'nome', contato: 'nome',
  empresa: 'empresa', razao_social: 'empresa', company: 'empresa',
  email: 'email', e_mail: 'email',
  telefone: 'telefone', fone: 'telefone', celular: 'telefone', phone: 'telefone',
  whatsapp: 'whatsapp', whats: 'whatsapp', zap: 'whatsapp',
  cpf_cnpj: 'cpf_cnpj', cnpj: 'cpf_cnpj', cpf: 'cpf_cnpj', documento: 'cpf_cnpj',
  endereco: 'endereco', cidade: 'cidade', estado: 'estado', uf: 'estado', cep: 'cep',
  segmento: 'segmento', origem: 'origem', status: 'status', tipo: 'tipo', tags: 'tags',
  observacoes: 'observacoes', obs: 'observacoes', observacao: 'observacoes',
}

const MODELO_CABECALHO = ['nome', 'empresa', 'email', 'telefone', 'whatsapp', 'cpf_cnpj', 'cidade', 'estado', 'segmento', 'origem', 'status', 'tags', 'observacoes']

// Aceita tanto o valor interno ("catalogo_place") quanto o rótulo ("Catálogo Place").
function normalizarOpcao(valor: string, opcoes: { value: string; label: string }[]): string | null {
  const v = normalizarCabecalho(valor)
  if (!v) return null
  return opcoes.find((o) => o.value === v || normalizarCabecalho(o.label) === v)?.value ?? v
}

type Linha = Record<string, string>
type Previa = { validas: Record<string, unknown>[]; semNome: number; duplicadas: number; colunasIgnoradas: string[] }

export function ImportarClientesDialog({ open, onOpenChange, onImported }: {
  open: boolean; onOpenChange: (open: boolean) => void; onImported: (quantidade: number) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [colunasIgnoradas, setColunasIgnoradas] = useState<string[]>([])
  const [statusPadrao, setStatusPadrao] = useState('lead')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function reset() {
    setNomeArquivo(null); setLinhas([]); setColunasIgnoradas([]); setPrevia(null); setErro(null)
  }

  async function montarPrevia(ls: Linha[], status: string, ignoradas: string[]) {
    const { data: existentes } = await createClient().from('clientes').select('email')
    const emails = new Set((existentes ?? []).map((c: { email: string | null }) => c.email?.toLowerCase()).filter(Boolean))
    let semNome = 0, duplicadas = 0
    const validas: Record<string, unknown>[] = []
    for (const l of ls) {
      if (!l.nome?.trim()) { semNome++; continue }
      const email = l.email?.trim().toLowerCase() || null
      if (email && emails.has(email)) { duplicadas++; continue }
      if (email) emails.add(email)
      const statusLinha = normalizarCabecalho(l.status ?? '')
      const tipoLinha = normalizarCabecalho(l.tipo ?? '')
      validas.push({
        nome: l.nome.trim(),
        empresa: l.empresa?.trim() || null,
        email,
        telefone: l.telefone?.trim() || null,
        whatsapp: l.whatsapp?.trim() || null,
        cpf_cnpj: l.cpf_cnpj?.trim() || null,
        endereco: l.endereco?.trim() || null,
        cidade: l.cidade?.trim() || null,
        estado: l.estado?.trim().toUpperCase().slice(0, 2) || null,
        cep: l.cep?.trim() || null,
        segmento: l.segmento ? normalizarOpcao(l.segmento, segmentoOpcoes) : null,
        origem: l.origem ? normalizarOpcao(l.origem, origemOpcoes) : null,
        status: ['ativo', 'inativo', 'lead', 'prospecto'].includes(statusLinha) ? statusLinha : status,
        tipo: ['agencia', 'saas', 'ambos'].includes(tipoLinha) ? tipoLinha : 'agencia',
        tags: l.tags ? l.tags.split(/[,|]/).map((t) => t.trim()).filter(Boolean) : null,
        observacoes: l.observacoes?.trim() || null,
      })
    }
    setPrevia({ validas, semNome, duplicadas, colunasIgnoradas: ignoradas })
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErro(null)
    setNomeArquivo(file.name)
    const matriz = parseCSV(await file.text())
    if (matriz.length < 2) { setErro('O arquivo precisa ter uma linha de cabeçalho e pelo menos um cliente.'); return }
    const cabecalho = matriz[0].map((h) => ALIASES[normalizarCabecalho(h)] ?? null)
    if (!cabecalho.includes('nome')) { setErro('Não encontrei a coluna "nome" no cabeçalho.'); return }
    const ignoradas = matriz[0].filter((_, i) => !cabecalho[i]).map((h) => h.trim()).filter(Boolean)
    const ls = matriz.slice(1).map((row) => {
      const obj: Linha = {}
      cabecalho.forEach((col, i) => { if (col) obj[col] = row[i] ?? '' })
      return obj
    })
    setLinhas(ls)
    setColunasIgnoradas(ignoradas)
    await montarPrevia(ls, statusPadrao, ignoradas)
  }

  async function handleImportar() {
    if (!previa || previa.validas.length === 0) return
    setImportando(true)
    setErro(null)
    const supabase = createClient() as any
    for (let i = 0; i < previa.validas.length; i += 200) {
      const { error } = await supabase.from('clientes').insert(previa.validas.slice(i, i + 200))
      if (error) {
        setErro(`Erro na importação (${i} já importados): ${error.message}`)
        setImportando(false)
        if (i > 0) onImported(i)
        return
      }
    }
    setImportando(false)
    onImported(previa.validas.length)
    reset()
    onOpenChange(false)
  }

  function baixarModelo() {
    downloadCSV('modelo-clientes.csv', toCSV(MODELO_CABECALHO, [
      ['Maria Souza', 'Padaria Doce Traço', 'maria@exemplo.com', '(11) 3333-4444', '(11) 99999-8888', '', 'São Paulo', 'SP', 'Restaurante', 'Catálogo Place', 'lead', 'site, cardápio digital', 'Quer site novo'],
    ]))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>
            Envie um CSV (Excel → Salvar como → CSV). A única coluna obrigatória é &quot;nome&quot;. Clientes com e-mail já cadastrado são ignorados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {nomeArquivo ? 'Trocar arquivo' : 'Escolher arquivo CSV'}
            </Button>
            <Button variant="ghost" onClick={baixarModelo}><Download className="h-4 w-4" /> Modelo</Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleArquivo} />
          </div>

          <div className="space-y-1.5">
            <Label>Status para linhas sem status</Label>
            <Select value={statusPadrao} onValueChange={(v) => { setStatusPadrao(v); if (linhas.length) montarPrevia(linhas, v, colunasIgnoradas) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="prospecto">Prospecto</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {previa && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2 text-sm">
              <p className="flex items-center gap-2 text-brand-lavanda font-medium">
                <FileSpreadsheet className="h-4 w-4 text-brand-violeta" /> {nomeArquivo}
              </p>
              <p className="flex items-center gap-2 text-brand-lima"><CheckCircle2 className="h-4 w-4" /> {previa.validas.length} cliente(s) prontos para importar</p>
              {previa.duplicadas > 0 && <p className="text-xs text-brand-lavanda/60">{previa.duplicadas} ignorado(s): e-mail já cadastrado</p>}
              {previa.semNome > 0 && <p className="text-xs text-brand-lavanda/60">{previa.semNome} ignorado(s): sem nome</p>}
              {previa.colunasIgnoradas.length > 0 && (
                <p className="text-xs text-brand-lavanda/40">Colunas não reconhecidas: {previa.colunasIgnoradas.join(', ')}</p>
              )}
              {previa.validas.length > 0 && (
                <p className="text-xs text-brand-lavanda/40">
                  Ex.: {previa.validas.slice(0, 3).map((v) => v.nome as string).join(', ')}{previa.validas.length > 3 ? '…' : ''}
                </p>
              )}
            </div>
          )}

          {erro && <p className="text-xs text-brand-rosa">{erro}</p>}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importando}>Cancelar</Button>
          <Button onClick={handleImportar} disabled={importando || !previa || previa.validas.length === 0}>
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : `Importar ${previa?.validas.length ?? ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

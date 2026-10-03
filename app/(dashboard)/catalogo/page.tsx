import { redirect } from 'next/navigation'

// A lista de assinantes do Catálogo Place passou para Financeiro → MRR.
export default function CatalogoPage() {
  redirect('/financeiro/mrr?aba=catalogo')
}

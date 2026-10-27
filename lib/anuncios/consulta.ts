// O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas.
// `montar` recebe o intervalo e devolve a consulta com .range() aplicado.
export async function buscarTudo<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanho = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar(de, de + tamanho - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < tamanho) return out
  }
}

export function emBlocos<T>(lista: T[], tamanho = 500) {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho))
  return out
}

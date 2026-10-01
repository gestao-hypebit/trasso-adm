-- MRR calculado a partir dos lançamentos.
--
-- Categorias de receita marcadas como `recorrente` são tratadas como
-- mensalidades: a tela /financeiro/mrr soma os lançamentos dessas categorias
-- por cliente e mês para chegar no MRR, novos, churn e evolução.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table categorias_financeiras
  add column if not exists recorrente boolean not null default false;

-- Chute inicial: categorias de receita com cara de mensalidade já entram marcadas.
-- Dá para ajustar depois direto na tela de MRR.
update categorias_financeiras
set recorrente = true
where tipo = 'receita'
  and recorrente = false
  and nome ~* '(mensal|assinatura|cat[aá]logo|recorr|saas|plano|retainer|fee)';

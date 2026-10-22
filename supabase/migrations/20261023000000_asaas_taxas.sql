-- Taxa do Asaas em cada cobrança.
--
--   lancamentos.asaas_valor          valor cobrado do cliente (value)
--   lancamentos.asaas_valor_liquido  o que cai na conta (netValue)
--
-- Taxa = cobrado − líquido. Antes do pagamento o líquido é a estimativa do
-- Asaas; quando o pagamento cai, vira o valor final (depende da forma de pagamento).
-- As colunas são preenchidas pela integração: depois de rodar este arquivo, clique
-- em "Sincronizar agora" na tela do Asaas para preencher as cobranças que já existem.
--
-- Assim como as migrations anteriores, cole este arquivo inteiro no
-- SQL Editor do painel do Supabase e execute manualmente. É idempotente.

alter table lancamentos add column if not exists asaas_valor numeric(12, 2);
alter table lancamentos add column if not exists asaas_valor_liquido numeric(12, 2);

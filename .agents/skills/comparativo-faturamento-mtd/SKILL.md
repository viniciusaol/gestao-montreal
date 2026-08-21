---
name: comparativo-faturamento-mtd
description: Compara o faturamento Month-To-Date (MTD) do mês corrente até o dia de hoje com o mesmo período equivalente do mês anterior (01 até o mesmo dia do mês passado).
---

# Skill: Comparativo de Faturamento MTD (Month-To-Date vs Mês Anterior)

Esta skill permite calcular e apresentar o comparativo de evolução do faturamento acumulado no mês corrente (do dia 01 até o dia atual) em relação ao mesmo período do mês anterior (do dia 01 até o mesmo dia do mês passado).

## Quando Usar
Ativada quando o usuário solicitar:
- "comparação de faturamento até hoje com o mês passado"
- "comparativo MTD"
- "evolução do mês até hoje"
- "quanto faturamos até o dia de hoje em relação ao mês passado"

## Estrutura da Conciliação de Caixa Geral

1. **Faturamento Comissionável (Aulas/Planos):** Vendas de itens com categoria 'Aulas' ou descrição contendo aula/tênis/kids/baby.
2. **( + ) Locações de Quadra:** Vendas com categoria 'Locação' ou subcategoria 'Locação' ou descrição contendo locação/reserva.
3. **( + ) Lanchonete e Consumos:** Demais vendas operacionais e produtos de consumo.
4. **( + ) Ajustes e Aulas de Outro Mês:** Diferença de conciliação.
5. **( = ) Faturamento Recebido no Caixa:** Soma total de todos os itens de `vw_mt_faturamento_itens_pago` no período (exatamente como processado na interface do dashboard `app.js`, sem filtrar `is_canceled`).

## Regra de Consulta SQL (Alinhada 100% ao Dashboard `app.js`)
Consultar a view `vw_mt_faturamento_itens_pago` filtrando apenas pelo intervalo de datas (`pay_date >= 'YYYY-MM-01'` e `pay_date < 'YYYY-MM-DD + 1 dia'`) para ambos os meses (mês atual e mês anterior). A categorização das 3 linhas é feita exatamente com a mesma lógica do `app.js`:
- **Comissionável**: Descrição contendo `INTENSIV`, `aula`, `tênis`, `tenis`, `kids`, `baby` ou categoria `aulas`.
- **Locação**: Caso não seja aula e a categoria/descrição contenha `locação`, `locacao` ou `reserva`.
- **Consumo**: Todos os demais produtos/itens operacionais.

## Modelo de Resposta

```markdown
### 📊 Comparativo de Faturamento MTD (01 ao dia XX)

| Categoria | Mês Passado (01 a XX/MêsAnt) | Mês Corrente (01 a XX/MêsAtual) | Variação (R$) | Variação (%) |
| :--- | :---: | :---: | :---: | :---: |
| **Faturamento Comissionável (Aulas/Planos)** | R$ XX.XXX,XX | R$ XX.XXX,XX | +R$ X.XXX,XX | +XX,X% |
| **( + ) Locações de Quadra** | R$ XX.XXX,XX | R$ XX.XXX,XX | +R$ X.XXX,XX | +XX,X% |
| **( + ) Lanchonete e Consumos** | R$ XX.XXX,XX | R$ XX.XXX,XX | +R$ X.XXX,XX | +XX,X% |
| **( + ) Ajustes e Outros** | R$ 0,00 | R$ 0,00 | R$ 0,00 | 0,0% |
| **( = ) Total Recebido no Caixa** | **R$ XX.XXX,XX** | **R$ XX.XXX,XX** | **+R$ XX.XXX,XX** | **+XX,X%** |
```

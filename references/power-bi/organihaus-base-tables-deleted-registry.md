# OrganiHaus – Base Tables: Registro de Deleções

Arquivo de referência para itens deletados do modelo Base Tables. Mantém a definição original para eventual recriação.

---

## Como usar

Cada entrada registra:
- **O que foi deletado** (tabela, medida, ou coluna)
- **Data** da deleção
- **Motivo**
- **Dependências** (o que referenciava o item)
- **Definição original** para recriação

---

## 2026-05-04

### Tabela: `Time range avg selling price`

**Tipo:** Tabela calculada (GENERATESERIES)
**Motivo da deleção:** Única consumidora era a medida `$_dynamic_average_price` da pasta `Opportunity Cost Calculator`, que também foi deletada. O slicer de range da página `Inv - Aging` é de `f_aging_projection`, não desta tabela.
**Dependências:** Medida `$_dynamic_average_price` e medida auxiliar `Time range avg selling price Value` (ambas deletadas junto).
**Usado em visuals:** Nenhum visual ativo confirmado após auditoria dos `.json` do report.

**Definição TMDL original:**
```
table 'Time range avg selling price'
    lineageTag: 20043c9a-3fc6-466a-a64b-f637fbe43ff1

    measure 'Time range avg selling price Value' = SELECTEDVALUE('Time range avg selling price'[Time range avg selling price], 90)
        formatString: 0
        lineageTag: 4c32730e-de1c-4773-9c09-0a9e6c363bad

    column 'Time range avg selling price'
        formatString: 0
        lineageTag: 634277eb-cbaa-4c27-83f5-84a3c2b719f9
        summarizeBy: none
        sourceColumn: [Value]

        extendedProperty ParameterMetadata =
                {
                  "version": 0
                }

        annotation SummarizationSetBy = User

    partition 'Time range avg selling price' = calculated
        mode: import
        source = GENERATESERIES(1, 365, 1)

    annotation PBI_Id = 087e948462c54aa88a8111fff5858dc0
```

**Para recriar:** No Power BI Desktop → New Parameter → Numeric Range, min=1, max=365, increment=1. Ou colar a expressão `GENERATESERIES(1, 365, 1)` em uma nova tabela calculada.

---

### Medidas: Pasta `Opportunity Cost Calculator` (10 medidas)

**Tabela:** `Measurement Table`
**Motivo da deleção:** Funcionalidade de calculadora de custo de oportunidade / liquidação considerada não útil no momento. A tabela `Time range avg selling price` dependia destas medidas e foi deletada junto.
**Dependências:** Nenhuma medida fora desta pasta referenciava as medidas abaixo (exceto dependências internas entre elas). A tabela `Contracted liquidator rate` era usada por `gross_recovery_value` — verificar se ainda há outros consumidores dessa tabela antes de deletá-la também.

#### Medidas e suas definições DAX

**`$_estimated_liquidations_processing_fee`**
```dax
VAR SalesRegion = SELECTEDVALUE(SKUs[Sales Region])
VAR SizeTier = CALCULATE([i_amazon_fact_fee_preview_max_size_tier], ALL('Calendar'))
VAR NoTier = ISBLANK(SizeTier)
VAR IsOversize = SEARCH("Oversize", SizeTier, 1, 0) > 0
VAR ItemWeight = CALCULATE([i_amazon_storage_fee_item_weight], ALL('Calendar'))
VAR NoWeight = ISBLANK(ItemWeight)

// Taxas de processing fee por marketplace (US, GB, EU, CA)
// Fonte: Seller Central Help pages (links nos comentários do código original)
VAR ProcessingFeeUS = SWITCH(TRUE(),
    IsOversize, SWITCH(TRUE(), NoWeight, BLANK(), NoTier, BLANK(),
        ItemWeight <= 1.0, 0.60, ItemWeight <= 2, 0.70, ItemWeight <= 4, 0.90,
        ItemWeight <= 10, 1.20, ItemWeight > 10, 1.90 + ROUNDUP(ItemWeight - 10, 0) * 0.20),
    SWITCH(TRUE(), NoWeight, BLANK(), NoTier, BLANK(),
        ItemWeight <= 0.5, 0.25, ItemWeight <= 1, 0.30, ItemWeight <= 2, 0.35,
        ItemWeight > 2, 0.40 + ROUNDUP(ItemWeight - 2, 0) * 0.20))
// ProcessingFeeGB, ProcessingFeeEU, ProcessingFeeCA seguem lógica análoga com taxas locais
RETURN SWITCH(TRUE(),
    SalesRegion = "US", ProcessingFeeUS,
    SalesRegion = "GB", ProcessingFeeGB,
    SalesRegion = "EU", ProcessingFeeEU,
    SalesRegion = "CA", 0, BLANK())
```
*Nota: O DAX completo com as variáveis GB/EU estava no arquivo — lógica similar usando ItemWeight * 1000 em gramas. Recuperável do git history do Measurement Table.tmdl.*

**`$_dynamic_average_price`**
```dax
VAR DaysSelected = SELECTEDVALUE('Time range avg selling price'[Time range avg selling price])
VAR EndDate = TODAY() - 1
VAR StartDate = EndDate - DaysSelected
VAR DatesInBetween = CALCULATETABLE(DATESBETWEEN('Calendar'[Date], StartDate, EndDate))
// Calcula preço médio no range selecionado pelo slicer
```
*Nota: DAX completo recuperável do git history.*

**`gross_recovery_value`**
```dax
SELECTEDVALUE('Contracted liquidator rate'[Contracted liquidator rate]) * [$_dynamic_average_price]
```

**`liquidations_referral_fee`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

**`liquidations_processing_fee`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

**`net_recovery_value`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

**`shipping_weight`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

**`disposal_fee`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

**`%_margin_liquidation_order`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

**`sunk_cost_liquidations`** — DAX completo no git history (pasta: Opportunity Cost Calculator)

---

## Pendente de deleção (aguardando ação no Power BI Desktop)

| Item | Tipo | Status |
|---|---|---|
| Medidas `Opportunity Cost Calculator` (10) | Medidas DAX | Definições acima registradas — deletar no PBI Desktop |

---

## Itens auditados mas mantidos

| Item | Tipo | Decisão | Motivo |
|---|---|---|---|
| `z.dynamic_coupon_usage_percentage` | Tabela calculada (hidden) | Manter por ora | Sem visual ativo, mas segura para deletar quando conveniente |
| `shifting_fba_costs_aux_table` | Tabela calculada | Manter | Usada como slicer de alerta nas páginas Measure Comparison e Duplicate of Measure Comparison no Operations |
| `z.dynamic_SP_absolute` | Tabela calculada (hidden) | Manter | Ainda usada em 2 visuais da página Ads Performance — migrar para `z.dynamic_SP_all_metrics` antes de deletar |
| `z.dynamic_SP_relative` | Tabela calculada (hidden) | Manter | Ainda usada em 1 visual da página Ads Performance — migrar antes de deletar |
| `z.dynamic_traffic_channel` | Tabela calculada (hidden) | Manter | Usada em slicer + lineChart da página Traffic |

# OrganiHaus – Profitability Dashboard

## Visão Geral

Dashboard de rentabilidade da marca OrganiHaus. Exibe um P&L completo por SKU, marketplace e período, com conversão de moeda (Local / USD / EUR). O modelo de dados é independente — tem seu próprio SemanticModel, não herda do OrganiHaus Base Tables.

**Caminho do modelo:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\Organihaus - Profitability\OrganiHaus - Profitability.SemanticModel`

**Parâmetro base de caminho:** `path_to_files = G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\`

---

## Parâmetros e Funções Globais

| Nome | Tipo | Valor / Descrição |
|---|---|---|
| `path_to_files` | Parâmetro M | `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\` — prefixo de todos os caminhos de arquivo locais |
| `bigQuery_customFunction` | Função M | Conecta ao projeto BigQuery `amazon-sp-api-openbridge` e retorna uma tabela a partir de um nome de view/tabela passado como string |
| `payments_first_date` | Parâmetro M | Menor data disponível nos dados de Payments — usado para limitar o range de outras tabelas |

---

## Estrutura do P&L

O P&L é montado pela measure `[$_statement_financial]` via SWITCH no `account_id` da tabela `dim_statement_financial`. As seções e suas measures correspondentes são:

| Seção (level_1_item) | account_id | Measure DAX | Fonte dos dados |
|---|---|---|---|
| **Gross Sales** | product_sales | `$_product_sales` | fact_payments_date_range |
| | promo_rebates_plus_shipping_credits | `$_promotional_rebates_plus_shipping_credits` | fact_payments_date_range |
| | taxes_collected | `$_taxes_collected` | fact_payments_date_range |
| | gross_sales | `$_gross_sales` | calculado |
| **Net Sales** | product_refunds | `$_product_refunds` | fact_payments_date_range |
| | taxes_refunded | `$_taxes_refunded` | fact_payments_date_range |
| | taxes_withheld | `$_taxes_withheld` | fact_payments_date_range |
| | gst_provision | `$_gst_ca_provision` | fact_payments_storage_fee_with_gst |
| | net_sales | `$_net_sales` | calculado |
| **COGS** | cogs_net_of_refunds | `$_cogs_net_of_refunds` | fact_payments_date_range × fact_average_landed_cost |
| **Selling Fees** | selling_fees | `$_selling_fees` | fact_payments_date_range |
| | fulfillment_fees_plus_giftwrap_credits | `$_fulfillment_fee_plus_giftwrap_credits` | fact_payments_date_range + fact_fulfillment_fee_credits |
| **Advertising** | Sponsored_products | `$_sponsored_product_spend` | fact_sp_advertised_products |
| | Sponsored_display | `$_sponsored_display_spend` | fact_sd_advertised_product |
| **Amazon Fees** | amz_storage_fee | `$_amz_storage_fee` | fact_storage_fee_daily |
| | amz_long_term_storage_fee | `$_amz_long_term_storage_fee_actual` | fact_payments_date_range |
| | awd_storage_fee | `$_awd_storage_fee_actual` | fact_awd_monthly_storage_fee |
| | awd_proces_and_transp_fees | `$_awd_processing_transportation_fees` | fact_awd_monthly_processing_fee + fact_awd_monthly_transportation_fee |
| | returns_processing_fees | `$_returns_processing_fee` | fact_returns_processing_fee |
| | adjustments | `$_adjustments` | fact_payments_date_range |
| | landed_cost_on_adjustments | `$_landed_cost_on_adjustment` | fact_payments_date_range × fact_average_landed_cost |
| | removal_orders | `$_removal_order_fee` | fact_removal_order_detail |
| **Non-Apportioned Costs** | Sponsored_brands | `$_sponsored_brands_spend` | fact_sb_spend_by_sku |
| | vat_gb_eu | `$_vat_gb_eu` | fact_payments_date_range |
| | subscription_fee | `$_subscription_fee` | fact_payments_date_range |
| | coupon_fee | `$_coupon_fee` | fact_payments_date_range |
| | deal_fee | `$_deal_fee` | fact_payments_date_range |
| | grade_and_resell | `$_grade_and_resell_fee` | fact_payments_date_range |
| | fee_adjustment | `$_fee_adjustment` | fact_payments_date_range |
| **Other Expenses (Local Costs)** | photographer | `$_photograph_cost` | fact_P&L GERAL (Descrição = "Photography") |
| | logistic_storage_3pl | `$_logistic_storage_3pl_cost` | fact_P&L GERAL (Descrição = "3PL") |
| | professional_service_fee | `$_professional_service_fee` | fact_P&L GERAL (Descrição = "Professional Service Fee") |
| | bank_fee | `$_bank_fee` | fact_P&L GERAL (Descrição = "Bank Fee") |
| | training_and_education | `$_training_education` | fact_P&L GERAL (Descrição = "Training / Education") |
| | marketing_services | `$_marketing_services` | fact_P&L GERAL (Descrição = "Marketing Services") |
| | total_local_costs | `$_local_cost` | soma das 6 linhas acima |
| **General & Administrative** | wages | `$_wages_cost` | fact_P&L GERAL (Descrição = "Wages") |
| | fixed_costs_credit_card | `$_fixed_cost` | fact_P&L GERAL (Descrição = "Fixed Costs (Credit Card)") |
| | office_fixed_costs_roi | `$_office_cost` | fact_P&L GERAL (Descrição = "OFFICE COSTS") |
| | adjustments_credit_card | `$_adjustments_credit_card` | fact_P&L GERAL (Descrição = "Adjustments (Credit Card)") |
| **Net Income** | net_income | `$_net_income` | calculado |

---

## Tabelas do Modelo

### fact_payments_date_range
**Categoria:** Amazon Payments  
**Fonte:** CSVs exportados do Amazon Seller Central (Date Range Report), um folder por país:
```
path_to_files\amazon_seller_central\payments\payments_date_range_report\{us|gb|ca|de|it|fr|es|nl|pl|be|tr|mx|se}_payments\
```
**Transformações Power Query:**
1. Cada folder de país é lido como bronze (`bronze_{PAÍS}_Payments`) — extrai arquivos, combina, promove cabeçalhos
2. Todos os bronze são combinados em `fact_payments_date_range_compiled`
3. Join com `dim_type_mapping` (Type De-Para.csv) e `dim_description_mapping` (Description De-Para.xlsx) para padronizar tipo e descrição
4. Campos calculados adicionados: `taxes_collected`, `taxes_withheld`, `taxes_refunded`, `selling_fees`, `fulfillment_fee`, `fee_adjustment`
5. Filtros finais: remove Liquidations, Liquidation Adjustments e Return Processing Fee (tratados em tabelas separadas)
6. Liquidations são reincluídas via `fact_payments_date_range_liquidation` e combinadas com `Table.Combine`
7. Join com `fact_exchange_rates` para adicionar `exchange_rate_to_usd`, `exchange_rate_to_eur`, `exchange_rate_to_gbp`

**Arquivos de mapeamento:**
- `z. De-Para\Type De-Para.csv` → `dim_type_mapping` (tipo do lançamento)
- `z. De-Para\Description De-Para.xlsx` → `dim_description_mapping` (descrição do lançamento → nome padronizado)

---

### fact_P&L GERAL
**Categoria:** Custos manuais (Standalone)  
**Fonte:** `G:\Shared drives\Eleven Brands - Finance\10. PROFITABILITY\P&L BI.xlsx` → aba `P&L GERAL`  
**Responsável por alimentar:** time de Finanças

**Transformações Power Query:**
1. Lê aba `P&L GERAL` do Excel
2. Filtra linhas onde `BU` é null ou vazio
3. Adiciona coluna `Date` = último dia do mês calculado a partir de `Ano` + `Mês`
4. Seleciona colunas: Date, BU, Empresa, Descrição, Valor, Moeda Local, Categoria 1, Categoria 2
5. Join com `fact_exchange_rates` usando (Date, Moeda Local) para adicionar taxas de câmbio

**Como os dados são filtrados nas measures:** cada measure DAX filtra a coluna `Descrição` com um valor fixo (ex: `"Photography"`, `"3PL"`, `"Wages"`). Adicionando uma nova linha no Excel com uma Descrição correspondente, o valor aparece automaticamente no P&L.

---

### fact_average_landed_cost
**Categoria:** Custo (Standalone)  
**Fonte:** `path_to_files\standalone_files\Average Landed Cost - Base SKU.xlsx` → aba `DataBase`

**Transformações Power Query:**
1. Lê planilha, limpa nulls, arredonda `unit_cost` para cima (2 casas)
2. Cria chave `key_inventory_region_sku` = "Inventory Region | Base SKU"
3. Mapeia Inventory Region para moeda (US→USD, CA→CAD, EU→EUR, GB→GBP)
4. **Retropreenchimento 2021:** para cada SKU, usa o primeiro `unit_cost` registrado para preencher todos os dias de 01/01/2021 até o dia anterior ao primeiro registro
5. **Série diária 2022+:** expande cada SKU em uma linha por dia (de min_date até hoje), depois faz `Table.FillDown` nos buracos
6. Combina 2021 + 2022+ em uma tabela final

---

### Average Purchase Cost
**Categoria:** Custo (Standalone)  
**Fonte:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\Average Purchase Cost - Base SKU.xlsx` → aba `DataBase`

**Transformações Power Query:** idênticas ao `fact_average_landed_cost` — mesma lógica de retropreenchimento 2021 e série diária. Coluna de saída renomeada para `purchase_unit_cost`.

---

### Average Freight Cost
**Categoria:** Custo (Standalone)  
**Fonte:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\Average Freight Cost - Base SKU.xlsx` → aba `DataBase`

**Transformações Power Query:** mesma lógica das tabelas de custo acima. Coluna de saída: `freight_unit_cost`.

---

### fact_storage_fee_daily
**Categoria:** Amazon Fulfillment  
**Fonte:** BigQuery — `amazon-sp-api-openbridge.1_Gold_Aux.vw_full_daily_share_storage_fee`

**Transformações Power Query:**
1. Lê a view BigQuery via `bigQuery_customFunction`
2. Join com `fact_exchange_rates` para adicionar taxas de câmbio por data
3. Arredonda `estimated_daily_storage_fee` para 10 casas decimais

---

### fact_payments_storage_fee_with_gst
**Categoria:** Staging (GST Canada)  
**Fonte:** Derivada de `fact_storage_fee_daily` + `bronze_CA_Payments`

**Transformações Power Query:**
1. Filtra `fact_storage_fee_daily` para país = "CA"
2. Calcula `storage_fee_country_share_of_value` = fee diária ÷ fee mensal total por país
3. Filtra `bronze_CA_Payments` para marketplace = "CA" e description = "FBA Storage Fee"
4. Agrupa pagamentos CA por mês (deslocando 1 mês para trás — o pagamento de março refere-se a fevereiro)
5. Join das duas tabelas por mês, calcula `daily_storage_fee` = share × monthly_payment
6. Join final com `fact_exchange_rates`

**Propósito:** distribuir a taxa mensal de storage paga no Seller Central por SKU/dia, para permitir apportionment correto do GST canadense.

---

### fact_aged_inventory_surcharge
**Categoria:** Amazon Fulfillment  
**Fonte:** Arquivos de Seller Central combinados:
- `raw_us_ca_mx_aged_inventory_surcharge` (pasta de fulfillment US/CA/MX)
- `raw_gb_eu_aged_inventory_surcharge` (pasta de fulfillment GB/EU)

**Transformações Power Query:**
1. Combina US/CA/MX + GB/EU com `Table.Combine`
2. Nega o valor (`monthly_amount_charged × -1`)
3. Ajusta mês: `start_of_month = DateStartOfMonth(date_payment) - 1 mês`
4. Expande valor mensal em uma linha por dia (`List.Dates`), calcula `daily_amount_charged = total ÷ days_in_month`
5. Join com `fact_exchange_rates`

---

### fact_awd_monthly_storage_fee
**Categoria:** AWD (Amazon Warehousing & Distribution)  
**Fonte:** Arquivos de AWD: `path_to_files\amazon_seller_central\awd\awd_monthly_storage_fee\`

**Transformações Power Query:**
1. Seleciona colunas relevantes (sku, inventory_country, total_charged_amount, currency, month_of_charge)
2. Calcula `days_in_month` para o mês de cobrança
3. Expande para uma linha por dia (`List.Dates`), calcula `daily_charged_amount = total ÷ days_in_month`
4. Join com `fact_exchange_rates`

---

### fact_awd_monthly_processing_fee e fact_awd_monthly_transportation_fee
**Categoria:** AWD  
**Fonte:** Arquivos de AWD nas respectivas subpastas em `path_to_files\amazon_seller_central\awd\`

**Transformações Power Query:** nega os valores, seleciona colunas, join com `fact_exchange_rates`.

---

### fact_returns_processing_fee
**Categoria:** Amazon Payments (derivada)  
**Fonte:** `fact_payments_date_range_compiled` (filtrada)

**Transformações Power Query:**
1. Filtra `description_mapping = "Return Processing Fee"`
2. Extrai ASIN da coluna `Description` usando `Text.BetweenDelimiters(..., "ASIN: ", " (2")`
3. Join com `apportionments_returns_precessing_fee` para obter o share por SKU/país/ASIN
4. Calcula `fulfillment_fee = share × -OLD_fulfillment_fee` (nega o valor)

---

### fact_fulfillment_fee_credits
**Categoria:** Staging (FBA Credits Canada)  
**Fonte:** `fba_fee_ca_payments` (derivada de bronze_CA_Payments) + `fba_fee_credits_pl_geral` (derivada de fact_P&L GERAL)

**Transformações Power Query:**
1. Calcula `monthly_share_of_fba_fees` por SKU (share de cada SKU no total de FBA fees do mês)
2. Join com crédito FBA do mês vindo do P&L GERAL
3. Calcula `fba_fee = monthly_share × Valor_PL`
4. Arredonda para 6 casas decimais, join com `fact_exchange_rates`

---

### fact_removal_order_detail
**Categoria:** Amazon Fulfillment  
**Fonte:** Arquivos de Seller Central:
- `raw_us_ca_mx_removal_order_detail`
- `raw_gb_eu_removal_order_detail`

**Transformações Power Query:**
1. Combina registros de remoção normal + disposição desconhecida
2. Aplica lógica de apportionment para distribuir custos por país/SKU com fallback
3. Join com `fact_exchange_rates`

---

### fact_sb_spend_by_sku
**Categoria:** Advertising  
**Fonte:** BigQuery — `amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_sponsored_brands_spend`

**Transformações Power Query:**
1. Duplica coluna `key_marketplace_sku`, faz split por `" | "` para extrair `marketplace` e `sku`
2. Join com `fact_exchange_rates` por (data, moeda)
3. Seleciona colunas finais

---

### fact_sp_advertised_products e fact_sd_advertised_product
**Categoria:** Advertising  
**Fonte:** BigQuery (Gold layer, Amz Ads) — Sponsored Products e Sponsored Display respectivamente

**Transformações Power Query:** leitura direta do BigQuery, merge com `fact_exchange_rates`.

---

### fact_raw_allOrders
**Categoria:** Amazon Fulfillment  
**Fonte:** BigQuery — `amazon-sp-api-openbridge.1_Gold_Sales_Returns.vw_full_all_orders`

**Transformações Power Query:**
1. Seleciona apenas 3 colunas: `date_all_orders`, `amazon_order_id`, `sales_channel_temporary`
2. Remove duplicatas
3. Filtra para datas ≥ `payments_first_date - 1 ano`

**Coluna calculada:** `is_in_payments` — verifica via LOOKUPVALUE se o `amazon_order_id` existe em `fact_payments_date_range`.

---

### fact_abc_classification
**Categoria:** Standalone  
**Fonte:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_abc_classification.xlsx` → aba `Classification`

**Transformações Power Query:**
1. Promove cabeçalhos
2. Filtra para o `Refresh Date` mais recente (`List.Max`)
3. Seleciona colunas relevantes e aplica types

---

### dim_statement_financial
**Categoria:** Dimensão  
**Fonte:** `path_to_files\standalone_files\db_statement_items_financial.xlsx` → aba `financial_statement`

**Estrutura:**
- `account_id` — chave usada pelo SWITCH em `$_statement_financial`
- `account_description` — label exibido no P&L
- `level_1_item` — agrupamento de seção (ex: "Other Expenses", "Gross Sales")
- `level_2_item` — subagrupamento
- `level_1_sort` / `account_order` — controla ordem de exibição
- `highlight` — flag visual

**Transformações:** apenas `Table.TransformColumnTypes`.

---

### dim_statement_commercial
**Categoria:** Dimensão  
**Fonte:** `path_to_files\standalone_files\db_statement_items_commercial.xlsx` → aba `financial_statement`

Mesma estrutura que `dim_statement_financial`, mas para a visão comercial do P&L.

---

### SKUs
**Categoria:** Dimensão mestre  
**Fonte:** BigQuery (Gold/Silver layer) + `path_to_files\standalone_files\db_life_cycle.xlsx`

Tabela mestre de produtos com 100+ colunas: hierarquia de produto, regiões de inventário, canais de venda, classificação ABC, dimensões físicas, URLs, ciclo de vida (lifecycle dates).

---

### Calendar
**Categoria:** Dimensão temporal  
**Fonte:** Calculada em M (sem fonte externa)

Calendário de 2018 até hoje com granularidade diária. Implementa sistema **ISO 4-4-5** (544 custom), com semanas fiscais, períodos mensais/trimestrais/anuais e "544 weeks" para análises comparativas.

---

### raw_bq_inventoryLedgerByCountry
**Categoria:** Bronze (Inventário)  
**Fonte:** BigQuery — `amazon-sp-api-openbridge.3_Bronze_Aux.td_inventory_country`

Ledger de inventário bruto por país: balanços por warehouse, trânsito e disposição.

---

## Tabelas Auxiliares / Calculadas

| Tabela | Propósito |
|---|---|
| `dim_selector_currency` | Seletor de moeda no relatório (Local / USD / EUR) |
| `dim_selector_date` | Seletor de período |
| `z.dynamic_time_frame_switch` | Seletor de granularidade temporal (Daily/Weekly/Monthly/Quarterly/Yearly) |
| `dim_Final DRE-like` | Estrutura DRE alternativa (embedded JSON) |
| `Country` | Derivada de SKUs — mapeia país para BU (Business Unit) |
| `Display Format` | Calculation group para formatação condicional de moeda nas measures |
| `zz_Refresh_Control` | Tabela com timestamp do último refresh (ID=1) |
| `zz_sales_channel_temporary` | Mapeamento de sales_channel_temporary → Amazon/Etsy/Blank |
| `z_errorFile` | Tabela de diagnóstico que força erro proposital no refresh |

---

## Fluxo de Dados Simplificado

```
BigQuery (amazon-sp-api-openbridge)
  ├── vw_full_all_orders              → fact_raw_allOrders
  ├── vw_full_daily_share_storage_fee → fact_storage_fee_daily
  ├── vw_full_sponsored_brands_spend  → fact_sb_spend_by_sku
  ├── Gold Amz Ads (SP/SD)           → fact_sp/sd_advertised_products
  └── dim/silver layer               → SKUs, raw_bq_inventoryLedgerByCountry

Amazon Seller Central (CSVs/Excel em path_to_files\)
  ├── payments\{país}_payments\       → bronze_{PAÍS}_Payments
  │     └── combinados               → fact_payments_date_range
  ├── fulfillment\monthly_storage_fee → fact_storage_fee_daily (staging)
  ├── fulfillment\amazon_fulfilled_shipments → raw_usCaMx_allOrders
  ├── fulfillment\aged_inventory_surcharge   → fact_aged_inventory_surcharge
  ├── fulfillment\removal_order_detail       → fact_removal_order_detail
  └── awd\                           → fact_awd_monthly_{storage|processing|transportation}_fee

Standalone Excel (path_to_files\standalone_files\)
  ├── Average Landed Cost - Base SKU.xlsx → fact_average_landed_cost
  ├── Average Purchase Cost - Base SKU.xlsx → Average Purchase Cost
  ├── Average Freight Cost - Base SKU.xlsx  → Average Freight Cost
  ├── db_statement_items_financial.xlsx     → dim_statement_financial
  ├── db_statement_items_commercial.xlsx    → dim_statement_commercial
  ├── db_abc_classification.xlsx            → fact_abc_classification
  └── db_life_cycle.xlsx                   → (merge em SKUs)

Standalone Excel (fora de path_to_files)
  └── Eleven Brands - Finance\10. PROFITABILITY\P&L BI.xlsx
        aba P&L GERAL                → fact_P&L GERAL
                                        (Other Expenses, G&A, e demais custos manuais)
```

---

## Paginas e Visuais

O report tem 3 paginas visiveis ao usuario, 1 pagina de tooltip oculta e 3 paginas template sem dados.

---

### Pagina: Profit & Loss

Pagina principal. Exibe o P&L completo em formato de demonstrativo financeiro com drill-down por periodo e SKU.

#### Slicers

| Slicer | Campo |
|---|---|
| Periodo | `dim_selector_date[selector_date_name]` |
| Canal de vendas | `zz_sales_channel_temporary[sales_channel_grouped]` |
| SKU | `SKUs[SKU Consertado]` |
| Native Family | `SKUs[Native Family]` |
| Amazon Family | `SKUs[Amazon Family]` |
| Grade & Resell | `SKUs[is_grade_and_resell]` |
| Data | `Calendar[Date]` |
| Pais / BU | `Country[BU]` + `Country[Country]` |
| Moeda | `dim_selector_currency[Currency]` |

#### Visual: P&L Financeiro principal (pivotTable)

| Role | Campo |
|---|---|
| Rows | `dim_statement_financial[account_description]` (label: "Financial Statement") |
| Columns | `Calendar[Year-Month]` |
| Values | `medidas[$_statement_financial]` |

#### Visual: P&L Financeiro % (pivotTable)

| Role | Campo |
|---|---|
| Rows | `dim_statement_financial[account_description]` |
| Columns | `Calendar[Year-Month]` |
| Values | `medidas[%_statement_financial]` |

#### Visual: Commercial Statement (pivotTable)

| Role | Campo |
|---|---|
| Rows | `dim_statement_commercial[account_description]` (label: "Commercial Statement") |
| Columns | `Calendar[Year-Month]` |
| Values | `medidas[$_statement_commercial]` |

#### Visual: Breakdown por SKU (pivotTable detalhado)

| Role | Campo | Label no visual |
|---|---|---|
| Rows | `SKUs[Amazon Family]` | |
| Rows | `SKUs[Native Family]` | |
| Rows | `SKUs[SKU]` | SKU1 |
| Values | `medidas[u_units_sold]` | Units Sold |
| Values | `medidas[$_product_sales]` | Product Sales |
| Values | `medidas[$_product_refunds]` | Refunds |
| Values | `medidas[%_product_refunds_over_net_sales]` | %Refunds |
| Values | `medidas[$_promotional_rebates]` | Promo Rebates |
| Values | `medidas[$_selling_fees]` | Selling Fees |
| Values | `medidas[%_selling_fees_over_net_sales]` | %Selling Fees |
| Values | `medidas[$_fulfillment_fee]` | Fulfillment Fees |
| Values | `medidas[%_fulfillment_fee_over_net_sales]` | %Fulfillment Fees |
| Values | `medidas[$_total_sponsored_ads_spend]` | Ads Spend |
| Values | `medidas[%_tacos]` | % TACOS |
| Values | `medidas[$_total_sponsored_ads_spend_normalized_by_amazon_family]` | Ads Spend (Amazon Family) |
| Values | `medidas[%_tacos_amazon_family]` | % TACOS (Amazon Family) |
| Values | `medidas[$_amz_storage_fee]` | Storage Fee |
| Values | `medidas[%_amz_storage_fee_over_net_sales]` | % Storage Fee |
| Values | `medidas[$_cogs]` | COGS |
| Values | `medidas[$_cogs_refund]` | COGS Refund |
| Values | `medidas[%_cogs_plus_cogs_refund_over_product_sales]` | % COGS |
| Values | `medidas[$_partial_operational_profit]` | Operational Margin |
| Values | `medidas[%_partial_operational_profit_over_product_sales]` | % Operational Margin |
| Values | `medidas[$_partial_operational_profit_normalized_by_amazon_family]` | Operational Margin (TACOS Amazon Family) |
| Values | `medidas[%_partial_operational_profit_normalized_by_amazon_family_over_product_sales]` | % Operational Margin (TACOS Amazon Family) |

#### Visual: KPI Summary (cardVisual multi-metrica)

| Medida | Label |
|---|---|
| `medidas[u_units_sold]` | Units Sold |
| `medidas[$_net_sales]` | Net Sales |
| `medidas[%_product_refunds_over_net_sales]` | Refunds |
| `medidas[%_cogs_net_of_refunds_over_net_sales]` | COGS Net |
| `medidas[%_fulfillment_fee_over_net_sales]` | FBA Fee |
| `medidas[%_tacos]` | TACOS |
| `medidas[%_amz_awd_storage_fees_over_net_sales]` | Storage Fees |
| `medidas[%_awd_processing_transportation_fees_over_net_sales]` | AWD Fees |
| `medidas[%_contribution_margin_4_1_over_net_sales]` | Operational Margin |
| `medidas[%_net_income_over_net_sales]` | Net Margin |

#### Visual: Card de periodo

`medidas[q_count_difference_between_two_dates_for_visuals]` — exibe a quantidade de dias/semanas/meses no periodo selecionado.

---

### Pagina: Graphic Analysis

Analise grafica com KPIs YoY, graficos de tendencia e comparativo por SKU/familia.

#### Slicers

| Slicer | Campo |
|---|---|
| SKU | `SKUs[SKU Consertado]` |
| Moeda | `dim_selector_currency[Currency]` |
| Material | `SKUs[Rope or Fabric]` |
| Amazon Family | `SKUs[Amazon Family]` |
| Periodo | `dim_selector_date[selector_date_name]` |
| Pais / BU | `Country[BU]` + `Country[Country]` |
| Native Family | `SKUs[Native Family]` |
| Data | `Calendar[Date]` |
| Canal Etsy | `fact_payments_date_range[is_etsy]` |

#### Grafico 1: Tendencia por Data (lineStackedColumnComboChart)

| Role | Campo |
|---|---|
| Eixo X (Category) | `Calendar[Date]` |
| Barras (Y) | `medidas[$_partial_operational_profit]` |
| Linhas (Y2) | `medidas[$_net_sales]` |
| Linhas (Y2) | `medidas[$_total_expenses]` |

#### Grafico 2: Tendencia Mensal (lineStackedColumnComboChart)

| Role | Campo |
|---|---|
| Eixo X (Category) | `Calendar[Year-Month]` |
| Barras (Y) | `medidas[$_net_sales]` |
| Barras (Y) | `medidas[$_total_expenses]` |
| Linha (Y2) | `medidas[$_partial_operational_profit_normalized_by_amazon_family]` |

#### Grafico 3: Comparativo por SKU (lineStackedColumnComboChart)

| Role | Campo |
|---|---|
| Eixo X (Category) | `SKUs[Amazon Family]`, `SKUs[Native Family]`, `SKUs[SKU]` |
| Barras (Y) | `medidas[$_net_sales]` |
| Barras (Y) | `medidas[$_total_expenses]` |
| Linha (Y2) | `medidas[$_partial_operational_profit_normalized_by_amazon_family]` |
| Tooltip | `medidas[%_partial_operational_profit_normalized_by_amazon_family_over_product_sales]` |

#### KPI Cards

| Medida | Descricao |
|---|---|
| `medidas[%_contribution_margin_4_1_over_net_sales]` | Operational Margin % |
| `medidas[%_tacos]` | TACOS % |
| `medidas[$_cogs]` | COGS $ |
| `medidas[%_operational_margin_yoy]` | Variacao YoY da margem operacional |
| `medidas[$_net_average_price_commercial]` | Preco medio por unidade vendida |
| `medidas[$_partial_operational_profit]` | Lucro operacional parcial $ |
| `medidas[%_net_sales_yoy]` | Variacao YoY de Net Sales |
| `medidas[%_amz_storage_fee_over_net_sales]` | % Storage Fee (aparece 2x) |
| `medidas[%_net_income_over_net_sales]` | Net Margin % |
| `medidas[%_cogs_plus_cogs_refund_over_product_sales]` | % COGS (aparece 2x) |
| `medidas[%_units_sold_yoy]` | Variacao YoY de unidades |
| `medidas[%_tacos_yoy]` | Variacao YoY de TACOS |
| `medidas[%_fulfillment_fee_over_net_sales]` | % FBA Fee |
| `medidas[$_net_sales]` | Net Sales $ |
| `medidas[%_partial_operational_profit_over_product_sales]` | % Margem operacional parcial |
| `medidas[u_units_sold]` | Unidades vendidas |

---

### Pagina: Margin Comparisson

Analise de margem operacional com comparativo historico e curva de Pareto por familia de produto.

#### Slicers

| Slicer | Campo |
|---|---|
| Moeda | `dim_selector_currency[Currency]` |
| SKU | `SKUs[SKU]` (textSlicer) |
| Pais / BU | `Country[BU]` + `Country[Country]` |
| Ano | `Calendar[Year]` |
| Periodo | `dim_selector_date[selector_date_name]` |

#### Grafico 1: Pareto por Amazon Family (lineClusteredColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Eixo X (Category) | `SKUs[Amazon Family]` | |
| Barras (Y) | `medidas[$_partial_operational_profit]` | Partial Op. Profit |
| Linha (Y2) | `medidas[%_pareto_cummulative_partial_operational_profit_by_amazon_family]` | Cumm. Partial Op. Profit |

#### Grafico 2: Margem ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Eixo X (Category) | `Calendar[Quarter - Year]` | |
| Linhas (Y) | `medidas[%_operational_profit_over_product_sales]` | % Operational Margin |
| Linhas (Y) | `medidas[%_operational_profit_over_product_sales_annual]` | % Operational Margin (Annual Constant) |
| Linhas (Y) | `medidas[%_operational_profit_over_product_sales_last_year]` | % Operational Margin (Last Year) |
| Linhas (Y) | `medidas[%_operational_profit_over_product_sales_annual_last_year]` | % Operational Margin (Last Year - Annual Constant) |

#### KPI Card

Mesmo conjunto de metricas do card da pagina Profit & Loss (u_units_sold, $_net_sales, %_product_refunds_over_net_sales, %_cogs_net_of_refunds_over_net_sales, %_fulfillment_fee_over_net_sales, %_tacos, %_amz_awd_storage_fees_over_net_sales, %_awd_processing_transportation_fees_over_net_sales, %_contribution_margin_4_1_over_net_sales, %_net_income_over_net_sales).

#### HTML Visuals (medidas que renderizam HTML customizado)

| Medida | Funcao |
|---|---|
| `medidas[hamb_menu]` | Menu hamburguer de navegacao entre paginas |
| `medidas[ui_tooltip_awd_processing_transportation_fees]` | Tooltip explicativo sobre AWD Processing e Transportation Fees |
| `medidas[ui_tooltip_amz_awd_storage_fee]` | Tooltip explicativo sobre Amazon + AWD Storage Fee |

---

### Pagina: Graphic Analysis (Tooltip) - oculta

Usada como tooltip customizado acionado por hover nos visuais da pagina Graphic Analysis. Contem 5 cards:

| Visual | Medida |
|---|---|
| Card | `medidas[%_net_income_over_net_sales]` - Net Margin % |
| Card | `medidas[%_cogs_plus_cogs_refund_over_product_sales]` - % COGS |
| Card | `medidas[%_net_sales_yoy]` - Net Sales YoY |
| Card | `medidas[%_tacos_amazon_family]` - TACOS por Amazon Family |
| pivotTable | Rows: `dim_Final DRE-like[Account]`, Columns: `Calendar[Year-Month]`, Values: `medidas[Scommercial_demonstrative_OLD]` |

---

## Relacionamentos

Modelo Import puro, independente do Base Tables. Usa suas proprias tabelas `Calendar`, `SKUs` e `Country`. Diferente do Base Tables, muitas tabelas de fato aqui usam `SKU` simples como chave de join (nao chave composta), pois o modelo de Profitability e mais simples em termos de granularidade geografica.

**Padrao geral:**
- Tabelas de fato com data diaria → `Calendar.Date`
- Tabelas de fees mensais → `Calendar.'Start of Month'` (many-to-many)
- Joins de SKU: ora `SKUs.SKU` (direto), ora `SKUs.'Key Column: Country | SKU'` (composite)
- Joins de pais: `Country.Country` ou `Country.BU`

**Relacionamentos ativos:**

| De | Para | Tipo de chave |
|---|---|---|
| `fact_P&L GERAL.Date` | `Calendar.Date` | Data diaria |
| `fact_P&L GERAL.BU` | `Country.BU` | BU |
| `fact_sp_advertised_products.date_sp_advertised_products` | `Calendar.Date` | Data diaria |
| `fact_sp_advertised_products.advertised_sku` | `SKUs.SKU` | SKU simples |
| `fact_sp_advertised_products.marketplace` | `Country.Country` | Pais |
| `fact_sd_advertised_product.date_sb_advertised_products` | `Calendar.Date` | Data diaria |
| `fact_sd_advertised_product.advertised_sku` | `SKUs.SKU` | SKU simples |
| `fact_sd_advertised_product.marketplace` | `Country.Country` | Pais |
| `fact_storage_fee_daily.date_daily_share_of_storage_fee` | `Calendar.Date` | Data diaria |
| `fact_storage_fee_daily.sku` | `SKUs.SKU` | SKU simples |
| `fact_storage_fee_daily.country` | `Country.Country` | Pais |
| `fact_estimated_future_daily_storage_fee.date` | `Calendar.Date` | Data diaria |
| `fact_estimated_future_daily_storage_fee.sku` | `SKUs.SKU` | SKU simples |
| `fact_estimated_future_daily_storage_fee.marketplace` | `Country.Country` | Pais |
| `fact_awd_monthly_storage_fee.date` | `Calendar.Date` | Data diaria |
| `fact_awd_monthly_storage_fee.sku` | `SKUs.SKU` | SKU simples |
| `fact_awd_monthly_storage_fee.inventory_country` | `Country.Country` | Pais |
| `fact_awd_monthly_processing_fee.month_of_charge` | `Calendar.'Start of Month'` | Mes (many-many) |
| `fact_awd_monthly_processing_fee.key_inventory_country_sku` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_awd_monthly_transportation_fee.month_of_charge` | `Calendar.'Start of Month'` | Mes (many-many) |
| `fact_awd_monthly_transportation_fee.key_inventory_country_sku` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_payments_date_range.date_payments` | `Calendar.Date` | Data diaria |
| `fact_payments_date_range.Country` | `Country.Country` | Pais |
| `fact_payments_date_range.contenated_cols` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_payments_date_range.'Order Amazon ID'` | `fact_raw_allOrders.amazon_order_id` | Order ID |
| `fact_aged_inventory_surcharge.date_payment` | `Calendar.Date` | Data diaria |
| `fact_aged_inventory_surcharge.key_inventory_country_sku` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_removal_order_detail.date_payment` | `Calendar.Date` | Data diaria |
| `fact_removal_order_detail.key_inventory_country_sku` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_returns_processing_fee.date_payments` | `Calendar.Date` | Data diaria |
| `fact_returns_processing_fee.key_sales_country_sku` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_fulfillment_fee_credits.date_payments` | `Calendar.Date` | Data diaria |
| `fact_fulfillment_fee_credits.Country` | `Country.Country` | Pais |
| `fact_fulfillment_fee_credits.key_country_sku` | `SKUs.'Key Column: Country \| SKU'` | Chave composta |
| `fact_payments_storage_fee_with_gst.date_daily_share_of_storage_fee` | `Calendar.Date` | Data diaria |
| `fact_payments_storage_fee_with_gst.country` | `Country.Country` | Pais |
| `fact_payments_storage_fee_with_gst.sku` | `SKUs.SKU` | SKU simples |
| `fact_sb_spend_by_sku.date_sb` | `Calendar.Date` | Data diaria |
| `fact_sb_spend_by_sku.marketplace` | `Country.Country` | Pais |
| `fact_sb_spend_by_sku.key_marketplace_sku` | `SKUs.'Key Column: Marketplace \| SKU'` | Chave composta |
| `fact_raw_allOrders.sales_channel_temporary` | `zz_sales_channel_temporary.sales_channel_temporary` | Canal de vendas |
| `SKUs.Country` | `Country.Country` | Dim → Dim |

**Relacionamentos inativos:**

| De | Para | Motivo |
|---|---|---|
| `z.dynamic_time_frame_switch.'Start Date'` ↔ | `Calendar.Date` | Seletor de granularidade — inativo (bidir) |
| `fact_payments_date_range.date_all_orders` | `Calendar.Date` | Data alternativa de orders — inativo |
| `fact_payments_date_range.SKU` | `SKUs.SKU` | Join direto por SKU — inativo |
| `fact_aged_inventory_surcharge.date_inventory` | `Calendar.Date` | Data do inventario vs data de pagamento — inativo |
| `fact_removal_order_detail.date_request` | `Calendar.Date` | Data de requisicao vs data de pagamento — inativo |
| `fact_awd_monthly_processing_fee.transaction_date` | `Calendar.Date` | Data de transacao vs data mensal — inativo |
| `fact_awd_monthly_transportation_fee.transaction_date` | `Calendar.Date` | Data de transacao vs data mensal — inativo |

---

## Medidas DAX (medidas — tabela centralizada)

Total: ~190 medidas. Organizadas por dominio:

**Vendas e Receita:**
`$_gross_sales`, `$_product_sales`, `$_net_sales`, `$_net_sales_commercial`, `$_net_average_price`, `$_net_average_price_commercial`, `u_units_sold`, `$_promotional_rebates`, `$_promotional_rebates_plus_shipping_credits`, `$_shipping_credits`, `$_taxes_collected`, `$_taxes_refunded`, `$_taxes_withheld`, `$_vat_gb_eu`, `$_vat_gst_balance_taxes_collected_refunded_withheld`, `$_gst_ca_provision`, `$_subscription_fee`

**COGS e Custo do Produto:**
`$_cogs`, `$_cogs_refund`, `$_cogs_net_of_refunds`, `$_cogs_per_unit_sold`, `$_product_refunds`, `$_landed_cost_on_adjustment`, `$_other_credits`, `$_giftwrap_credits`, `$_gst_ca_fulfillment_fee_credits`, `$_gst_ca_storage_fee_credits`, `$_fee_adjustment`

**Fees Amazon:**
`$_selling_fees`, `$_fulfillment_fee`, `$_fulfillment_fee_plus_giftwrap_credits`, `$_fulfillment_fee_per_unit_sold`, `$_coupon_fee`, `$_deal_fee`, `$_removal_order_fee`, `$_returns_processing_fee`, `$_grade_and_resell_fee`

**Storage Fees:**
`$_amz_storage_fee`, `$_amz_storage_fee_actual`, `$_amz_long_term_storage_fee_actual`, `$_amz_storage_fee_forecast`, `$_amz_awd_storage_fees`, `$_awd_storage_fee_actual`, `$_awd_processing_fee`, `$_awd_transportation_fee`, `$_awd_processing_transportation_fees`, `$_amz_storage_fee_payments_with_gst`

**Ads Spend:**
`$_sponsored_product_spend`, `$_sponsored_brands_spend`, `$_sponsored_display_spend`, `$_total_sponsored_ads_spend`, `$_total_sponsored_ads_spend_normalized_by_amazon_family`

**Custos Operacionais (P&L GERAL):**
`$_photograph_cost`, `$_logistic_storage_3pl_cost`, `$_professional_service_fee`, `$_bank_fee`, `$_training_education`, `$_marketing_services`, `$_local_cost`, `$_wages_cost`, `$_fixed_cost`, `$_office_cost`, `$_adjustments_credit_card`, `$_total_general_and_administrative_costs`, `$_total_other_expenses_local_cost_plus_general_adm`

**Margens e Lucro:**
`$_comercial_margin`, `$_commercial_expenses`, `$_commercial_profit`, `$_contribution_margin_1` a `$_contribution_margin_5`, `$_contribution_margin_4_1`, `$_partial_operational_profit`, `$_net_income`, `$_net_income_commercial`, `$_total_expenses`, `$_total_expenses_commercial`, `$_total_other_expenses_commercial`, `$_adjustments`, `$_cummulative_partial_operational_profit_by_amazon_family`

**Margens Normalizadas por Amazon Family:**
`$_contribution_margin_3_normalized_by_amazon_family`, `$_contribution_margin_4_normalized_by_amazon_family`, `$_partial_operational_profit_normalized_by_amazon_family`, `$_total_sponsored_ads_spend_normalized_by_amazon_family`

**% Sobre Net Sales:**
`%_cogs_net_of_refunds_over_net_sales`, `%_fulfillment_fee_over_net_sales`, `%_selling_fees_over_net_sales`, `%_amz_storage_fee_over_net_sales`, `%_amz_awd_storage_fees_over_net_sales`, `%_awd_storage_fee_over_net_sales`, `%_awd_processing_transportation_fees_over_net_sales`, `%_tacos`, `%_net_income_over_net_sales`, `%_operational_profit_over_product_sales`, `%_partial_operational_profit_over_product_sales`, `%_product_refunds_over_net_sales`, ... (padrao: `%_[line]_over_net_sales` para todas as linhas do P&L)

**YoY e UI:**
`%_net_sales_yoy`, `%_tacos_yoy`, `%_units_sold_yoy`, `%_net_margin_yoy`, `%_cogs_margin_yoy`, `%_fulfillment_fee_margin_yoy`, `%_amz_storage_fee_yoy`, `%_operational_profit_yoy`, `%_operational_margin_yoy`, `%_product_refunds_yoy`, `%_net_average_price_yoy` — e versoes `ui_%_*_yoy` com formatacao de simbolo +/- para cards

**DRE / Statement:**
`$_statement_financial`, `$_statement_financial_format`, `$_statement_commercial`, `%_statement_financial`, `statements_highlight_flag`

**Auxiliares e UI:**
`hamb_menu`, `ui_storage_fee_status`, `ui_tooltip_amz_awd_storage_fee`, `ui_tooltip_awd_processing_transportation_fees`, `'Last Refresh Datetime'`, `q_count_difference_between_two_dates`, `q_count_difference_between_two_dates_for_visuals`, `x_arrow_up`, `x_arrow_down`, `r_ranking_criteria_partial_operational_profit_by_amazon_family`, `r_ranking_partial_operational_profit_by_amazon_family`, `%_pareto_cummulative_partial_operational_profit_by_amazon_family`

**Documentacao:** Eleven Brands · OrganiHaus - Profitability · Dados & Analytics

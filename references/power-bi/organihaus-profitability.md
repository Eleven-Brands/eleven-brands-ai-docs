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
- `account_description` — label exibido no P&L (coluna "Financial Statement" no matrix visual)
- `level_1_item` — agrupamento de seção
- `level_2_item` — subagrupamento
- `level_1_sort` / `account_order` — controla ordem de exibição
- `highlight` — flag visual (0 = normal, 1 = subtotal/bold, 2 = header/spacer)

**Linhas (account_order, account_description → account_id, level_1_item):**

| `account_order` | `account_description` (label no visual) | `account_id` | `level_1_item` |
|---|---|---|---|
| 2 | Units Sold | `units_sold` | Units Sold |
| 3 | Net Average Price | `net_average_price` | Net Average Price |
| 4 | Fulfillment Fee per Unit | `fulfillment_fees_per_unit` | Fulfillment Fee per Unit |
| 5 | COGS per Unit | `cogs_per_unit` | COGS per Unit |
| 7 | SALES *(header)* | `sales_header` | Sales Header |
| 8 | ( + ) Product Sales | `product_sales` | Gross Sales |
| 9 | ( - ) Promo Rebates + Ship. Credits | `promo_rebates_plus_shipping_credits` | Gross Sales |
| 10 | ( + ) Taxes Collected | `taxes_collected` | Gross Sales |
| 11 | ( = ) Gross Sales | `gross_sales` | Gross Sales |
| 13 | ( - ) Product Refunds | `product_refunds` | Net Sales Dec |
| 14 | ( - ) Taxes Refunded | `taxes_refunded` | Net Sales Dec |
| 15 | ( - ) Taxes Withheld | `taxes_withheld` | Net Sales Dec |
| 16 | ( - ) GST Provision | `gst_provision` | Net Sales Dec |
| 17 | ( = ) Net Sales | `net_sales` | Net Sales |
| 19 | OPERATIONAL EXPENSES *(header)* | `operational_expenses_header` | Operational Expenses Header |
| 20 | ( - ) COGS Net of Refunds | `cogs_net_of_refunds` | Net Cogs |
| 21 | ( = ) CM1 = Sales - COGS | `cm_1` | CM 1 |
| 22 | ( % ) Margin 1 | `margin_1` | % Margin 1 |
| 24 | ( - ) Selling Fees | `selling_fees` | Cost of Sales |
| 25 | ( - ) Fulfillment Fees + GiftWrap Credits | `fulfillment_fees_plus_giftwrap_credits` | Cost of Sales |
| 28 | ( = ) CM2 = CM1 - Cost of Sales | `cm_2` | CM 2 |
| 29 | ( % ) Margin 2 | `margin_2` | % Margin 2 |
| 31 | ( - ) Sponsored Products | `sponsored_products` | Sponsored Ads |
| 32 | ( - ) Sponsored Brands | `sponsored_brands` | Sponsored Ads |
| 33 | ( - ) Sponsored Display | `sponsored_display` | Sponsored Ads |
| 34 | ( = ) CM3 = CM2 - Ads | `cm_3` | CM 3 |
| 35 | ( % ) Margin 3 | `margin_3` | % Margin 3 |
| 37 | ( - ) AMZ Storage Fee | `amz_storage_fee` | Fixed Costs |
| 38 | ( - ) AWD Storage Fee | `awd_storage_fee` | Fixed Costs |
| 39 | ( - ) AWD Proces. & Transp. Fees | `awd_proces_and_transp_fees` | Fixed Costs |
| 40 | ( - ) AMZ Long Term Storage Fee | `amz_long_term_storage_fee` | Fixed Costs |
| 41 | ( - ) Returns Processing Fees | `returns_processing_fees` | Fixed Costs |
| 42 | ( - ) Adjustments | `adjustments` | Fixed Costs |
| 43 | ( - ) Landed Cost on Adjustments | `landed_cost_on_adjustments` | Fixed Costs |
| 44 | ( - ) Removal Orders | `removal_orders` | Fixed Costs |
| 45 | ( = ) CM4 = CM3 - Fixed Costs | `cm_4` | CM 4 |
| 46 | ( % ) Margin 4 | `margin_4` | % Margin 4 |
| 48 | ( - ) VAT (GB & EU only)* | `vat_gb_eu` | Non-Apportioned Costs |
| 49 | ( - ) Subscription Fee* | `subscription_fee` | Non-Apportioned Costs |
| 50 | ( - ) Coupon Fee* | `coupon_fee` | Non-Apportioned Costs |
| 51 | ( - ) Deal Fee* | `deal_fee` | Non-Apportioned Costs |
| 52 | ( - ) Grade & Resell* | `grade_and_resell` | Non-Apportioned Costs |
| 53 | ( - ) Fee Adjustment* | `fee_adjustment` | Non-Apportioned Costs |
| 54 | ( = ) CM 4.1 = CM4 - Non-Apportioned* | `cm_4_1` | CM 4.1 |
| 55 | ( % ) Margin 4.1* | `margin_4_1` | Margin 4.1 |
| 57 | OTHER EXPENSES *(header)* | `other_expenses_header` | Other Expenses Header |
| 58 | ( - ) Photographer* | `photographer` | Local Costs |
| 59 | ( - ) Logistic Storage (3PL)* | `logistic_storage_3pl` | Local Costs |
| 60 | ( - ) Professional Service Fee* | `professional_service_fee` | Local Costs |
| 61 | ( - ) Bank Fee* | `bank_fee` | Local Costs |
| 62 | ( - ) Training & Education* | `training_and_education` | Local Costs |
| 63 | ( - ) Marketing Services* | `marketing_services` | Local Costs |
| 64 | ( = ) Total Local Costs* | `total_local_costs` | Total Local Costs |
| 65 | ( = ) CM5 = CM4 - Local Costs | `cm_5` | CM 5 |
| 66 | ( % ) Margin 5 | `margin_5` | % Margin 5 |
| 68 | ( - ) Wages* | `wages` | Total General & ADM |
| 69 | ( - ) Fixed Costs (Credit Card)* | `fixed_costs_credit_card` | Total General & ADM |
| 70 | ( - ) Office Fixed Costs - (ROI)* | `office_fixed_costs_roi` | Total General & ADM |
| 71 | ( - ) Adjustments (Credit Card)* | `adjustments_credit_card` | Total General & ADM |
| 72 | ( = ) Total General & Adm* | `total_general_and_adm` | Total General & ADM |
| 74 | Net Income | `net_income` | Net Income After Taxes |
| 75 | % Net Margin | `net_margin` | Net Income |

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

## Medidas DAX — medidas (189 medidas)


### (sem pasta)

#### `teste vat`

**Depende de medidas:** `[$_gst_ca_provision]`, `[$_vat_gb_eu]`  
```dax
[$_gst_ca_provision] + [$_vat_gb_eu]
```


### DELETE?\CRUCIAL - CANNOT DELETE

#### `$_partial_operational_profit`

**Depende de medidas:** `[$_amz_awd_storage_fees]`, `[$_comercial_margin]`, `[$_other_credits]`, `[$_product_refunds]`, `[$_total_sponsored_ads_spend]`  
```dax
var partial_operational_profit = [$_comercial_margin] + [$_other_credits] + [$_product_refunds] + [$_total_sponsored_ads_spend] + [$_amz_awd_storage_fees]

RETURN
    partial_operational_profit
```

#### `$_commercial_expenses`

**Depende de medidas:** `[$_cogs]`, `[$_fulfillment_fee]`, `[$_selling_fees]`  
```dax
-( [$_selling_fees] + [$_fulfillment_fee] + [$_cogs] )
```

#### `%_partial_operational_profit_over_product_sales`

**Depende de medidas:** `[$_partial_operational_profit]`, `[$_product_sales]`  
```dax
DIVIDE([$_partial_operational_profit],[$_product_sales],0)
```

#### `$_net_average_price_commercial`

**Depende de medidas:** `[$_gross_sales]`, `[$_product_sales]`, `[$_promotional_rebates]`, `[u_units_sold]`  
**Depende de colunas:** `NOT fact_payments_date_range[Marketplace]`, `fact_payments_date_range[Marketplace]`  
```dax
// US & CA = Product Sales
    // GB & EU = Gross Sales (taxes are within price) 

    VAR _marketplaces = { "US", "CA" }
    VAR _us_ca = CALCULATE( [$_product_sales], fact_payments_date_range[Marketplace] IN  _marketplaces)
    VAR _gb_eu = CALCULATE( [$_gross_sales], NOT fact_payments_date_range[Marketplace] IN _marketplaces )
    VAR _sales = _us_ca + _gb_eu + [$_promotional_rebates]
    VAR _result = DIVIDE(_sales,[u_units_sold])

RETURN
    _result
```

#### `$_comercial_margin`

**Depende de medidas:** `[$_commercial_expenses]`, `[$_net_sales]`  
```dax
VAR margin = [$_net_sales] - [$_commercial_expenses]

RETURN
    margin
```

#### `%_TACOS_familia`

**Depende de medidas:** `[$_product_sales]`, `[$_total_sponsored_ads_spend]`  
**Depende de colunas:** `SKUs[Amazon Family]`, `SKUs[SKU Consertado]`  
```dax
-- Tacos da Familia, espelhado por SKU

var valor_total = CALCULATE(
    [$_total_sponsored_ads_spend],
    ALL(SKUs[SKU Consertado]),
        VALUES(SKUs[Amazon Family]
            )
             )


var sales = CALCULATE(
    [$_product_sales],
    ALL(SKUs[SKU Consertado]),
        VALUES(SKUs[Amazon Family]
            )
             )

RETURN
DIVIDE(valor_total,sales)
```

#### `$_net_sales_commercial`

**Depende de medidas:** `[$_giftwrap_credits]`, `[$_product_refunds]`, `[$_product_sales]`, `[$_promotional_rebates]`, `[$_shipping_credits]`  
```dax
VAR _net_sales = [$_product_sales] + [$_product_refunds] + [$_promotional_rebates] + [$_shipping_credits] + [$_giftwrap_credits]

RETURN
    _net_sales
```

#### `$_total_expenses`

**Depende de medidas:** `[$_adjustments]`, `[$_amz_long_term_storage_fee_actual]`, `[$_amz_storage_fee]`, `[$_awd_processing_transportation_fees]`, `[$_awd_storage_fee_actual]`, `[$_cogs_net_of_refunds]`, `[$_coupon_fee]`, `[$_deal_fee]`, `[$_fee_adjustment]`, `[$_fulfillment_fee_plus_giftwrap_credits]`, `[$_grade_and_resell_fee]`, `[$_landed_cost_on_adjustment]`, `[$_removal_order_fee]`, `[$_returns_processing_fee]`, `[$_selling_fees]`, `[$_sponsored_brands_spend]`, `[$_sponsored_display_spend]`, `[$_sponsored_product_spend]`, `[$_subscription_fee]`, `[$_vat_gb_eu]`  
```dax
VAR _cm1 = [$_cogs_net_of_refunds]     
    VAR _cm2 = [$_selling_fees] + [$_fulfillment_fee_plus_giftwrap_credits]     
    VAR _cm3 = [$_sponsored_product_spend] + [$_sponsored_display_spend]    
    VAR _cm4 = [$_amz_storage_fee] + [$_awd_storage_fee_actual] + [$_awd_processing_transportation_fees] + [$_amz_long_term_storage_fee_actual]  + [$_returns_processing_fee] + [$_adjustments] + [$_landed_cost_on_adjustment] + [$_removal_order_fee]
    VAR _cm4_1 = [$_sponsored_brands_spend] + [$_vat_gb_eu] + [$_subscription_fee] + [$_coupon_fee] + [$_deal_fee] + [$_grade_and_resell_fee] + [$_fee_adjustment]

RETURN
    _cm1 + _cm2 + _cm3 +_cm4 + _cm4_1
```


### DELETE?\Dep 0

#### `$_total_other_expenses_local_cost_plus_general_adm`

**Depende de medidas:** `[$_local_cost]`, `[$_total_general_and_administrative_costs]`  
```dax
[$_local_cost] + [$_total_general_and_administrative_costs]
```


### DELETE?\Dep 1

#### `%_cogs_plus_cogs_refund_over_product_sales`

**Depende de medidas:** `[$_cogs]`, `[$_cogs_refund]`, `[$_product_sales]`  
```dax
var valor = [$_cogs]+[$_cogs_refund]

RETURN
DIVIDE(-valor,[$_product_sales])
```

#### `$_partial_operational_profit_normalized_by_amazon_family`

**Depende de medidas:** `[$_amz_awd_storage_fees]`, `[$_comercial_margin]`, `[$_other_credits]`, `[$_product_refunds]`, `[$_total_sponsored_ads_spend_normalized_by_amazon_family]`  
```dax
var partial_operational_profit = [$_comercial_margin] + [$_other_credits] + [$_product_refunds] + [$_total_sponsored_ads_spend_normalized_by_amazon_family] + [$_amz_awd_storage_fees]

RETURN
    partial_operational_profit
```

#### `%_commercial_profit_over_product_sales`

**Depende de medidas:** `[$_commercial_profit]`, `[$_product_sales]`  
```dax
DIVIDE([$_commercial_profit], [$_product_sales])
```

#### `%_net_margin_commercial`

**Depende de medidas:** `[$_net_income_commercial]`, `[$_product_sales]`  
```dax
DIVIDE([$_net_income_commercial],[$_product_sales],0)
```


### DELETE?\Dep 2

#### `$_other_credits`

**Depende de medidas:** `[$_cogs_refund]`, `[$_giftwrap_credits]`, `[$_landed_cost_on_adjustment]`, `[$_shipping_credits]`  
```dax
VAR credits = [$_cogs_refund] + [$_landed_cost_on_adjustment] + [$_giftwrap_credits] + [$_shipping_credits]

RETURN
    credits
```

#### `$_net_income_commercial`

**Depende de medidas:** `[$_commercial_profit]`, `[$_total_other_expenses_commercial]`  
```dax
VAR _net_sales = [$_commercial_profit] + [$_total_other_expenses_commercial]

RETURN
    _net_sales
```


### Date Diff

#### `q_count_difference_between_two_dates_for_visuals`

**Depende de medidas:** `[q_count_difference_between_two_dates]`  
```dax
[q_count_difference_between_two_dates] & " days"
```

#### `q_count_difference_between_two_dates`

**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _minDate = MIN ( 'Calendar'[Date] )
    VAR _maxDate = MAX ( 'Calendar'[Date] )
    VAR _dateDifference = DATEDIFF( _minDate, _maxDate + 1, DAY )

RETURN 
    _dateDifference
```


### STAGING - Margin Comparisson

#### `%_operational_profit_over_product_sales`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[$_product_sales]`  
```dax
DIVIDE([$_contribution_margin_4_1],[$_product_sales],0)
```

#### `%_operational_profit_over_product_sales_last_year`

**Depende de medidas:** `[%_operational_profit_over_product_sales]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR result = 
        CALCULATE(
            [%_operational_profit_over_product_sales]
            , SAMEPERIODLASTYEAR('Calendar'[Date])
        )

RETURN result
```

#### `%_operational_profit_over_product_sales_annual`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[$_product_sales]`  
**Depende de colunas:** `'Calendar'[Year]`  
```dax
VAR _selYear =
    SELECTEDVALUE( 'Calendar'[Year] )
VAR _profitYr =
    CALCULATE(
        [$_contribution_margin_4_1],
        ALL( 'Calendar' ),
        'Calendar'[Year] = _selYear
    )
VAR _salesYr =
    CALCULATE(
        [$_product_sales],
        ALL( 'Calendar' ),
        'Calendar'[Year] = _selYear
    )
RETURN
    DIVIDE( _profitYr, _salesYr, 0 )
```

#### `hamb_menu`

```dax
"
<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>

  <style>
  
    /* Reset default margins */
    body, ul {
        margin: 0;
        padding: 0;
    }


    /* Top navigation bar */
    .top-menu {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: #2f3b47; /* dark gray/nav color */
        padding: 10px 0px 10px 20px;
        font-family: Arial, sans-serif;
    }




    /* Hamburger icon */
    .hamburger {
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-bottom: 0px;
    }

    .hamburger span:first-child {
        margin-top: 0px;
    }

    .hamburger span {
        display: block;
        width: 48px;
        height: 6px;
        margin: 4px 0px 0px 0px;
        background-color: white;
        border-radius: 2px;
    }

    
    /* Dropdown menu */
    .dropdown {
        position: relative;
        padding-bottom: 8px;
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin: 0;
        padding: 0;
        list-style: none;
        display: none;
        font-size: 18px;
        background-color: #2f3b47;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border-radius: 6px;
        overflow: hidden;
        min-width: 200px;
        z-index: 1000;
    }
    .dropdown:hover .dropdown-menu,
    .dropdown-menu:hover {
        display: block;
    }
    .dropdown-menu li {
        padding: 0.75rem 1rem;
        color: #ffffff;
        cursor: pointer;
    }
    .dropdown-menu li:hover {
        background-color: #3f4b57;
    }

    
    /* Optional hover effect */
    .hamburger:hover span {
        opacity: 0.7;
    }
  
  </style>

</head>

<body>

    <nav class='top-menu'>
        <div class='dropdown'>
            <div class='hamburger' aria-label='Menu'>
                <span></span>
                <span></span>
                <span></span>
            </div>
            <ul class='dropdown-menu'>
                <li>Profit & Loss</li>
                <li>Graphic Analysis</li>
                <li>Margin Comparisson</li>
            </ul>
        </div>
    </nav>

</body>

</html>
"
```

#### `%_operational_profit_over_product_sales_annual_last_year`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[$_product_sales]`  
**Depende de colunas:** `'Calendar'[Year]`  
```dax
VAR _selYear  = SELECTEDVALUE( 'Calendar'[Year] )
VAR _prevYear = _selYear - 1

VAR _profitLY =
    CALCULATE(
        [$_contribution_margin_4_1],
        ALL( 'Calendar' ),
        'Calendar'[Year] = _prevYear
    )
VAR _salesLY =
    CALCULATE(
        [$_product_sales],
        ALL( 'Calendar' ),
        'Calendar'[Year] = _prevYear
    )
RETURN
    DIVIDE( _profitLY, _salesLY, 0 )
```

#### `$_cummulative_partial_operational_profit_by_amazon_family`

**Depende de medidas:** `[$_partial_operational_profit]`, `[r_ranking_criteria_partial_operational_profit_by_amazon_family]`, `[r_ranking_partial_operational_profit_by_amazon_family]`  
**Depende de colunas:** `SKUs[Amazon Family]`  
```dax
Calculate(
    [$_partial_operational_profit]
    , TOPN(
        [r_ranking_partial_operational_profit_by_amazon_family]
        , ALLSELECTED(SKUs[Amazon Family])
        , [r_ranking_criteria_partial_operational_profit_by_amazon_family]
    )
)
```

#### `r_ranking_criteria_partial_operational_profit_by_amazon_family`

**Depende de medidas:** `[$_contribution_margin_4_1]`  
```dax
[$_contribution_margin_4_1]*1000000000000+[$_contribution_margin_4_1]
```

#### `r_ranking_partial_operational_profit_by_amazon_family`

**Depende de medidas:** `[$_partial_operational_profit]`  
**Depende de colunas:** `SKUs[Amazon Family]`  
```dax
if(
    HASONEVALUE(SKUs[Amazon Family]) && ISBLANK([$_partial_operational_profit]) =false
    , rankx(
        ALLSELECTED(SKUs[Amazon Family])
        , [$_partial_operational_profit]
        , 
        , DESC
        , Dense
    )
)
```

#### `%_pareto_cummulative_partial_operational_profit_by_amazon_family`

**Depende de medidas:** `[$_cummulative_partial_operational_profit_by_amazon_family]`, `[$_partial_operational_profit]`, `[r_ranking_partial_operational_profit_by_amazon_family]`  
**Depende de colunas:** `SKUs[Amazon Family]`  
```dax
VAR _ranking = [r_ranking_partial_operational_profit_by_amazon_family]
    VAR _cummulative_sales = [$_cummulative_partial_operational_profit_by_amazon_family]



    VAR totalPos =
        SUMX(
            ALLSELECTED( SKUs[Amazon Family] ),
            MAX( 0, [$_partial_operational_profit] )
        )

RETURN
    IF( totalPos > 0, DIVIDE( [$_cummulative_partial_operational_profit_by_amazon_family], totalPos ) )
```


### Statements - $ Financial Amount\0. Top Info

#### `u_units_sold`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Quantity]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Order"  )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Order", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _payments = SUMX( _td_payments, 'fact_payments_date_range'[Quantity] ) 

// Get All Orders Values
    VAR _all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Quantity] ) 
    
     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_fulfillment_fee_per_unit_sold`

**Depende de medidas:** `[$_fulfillment_fee_plus_giftwrap_credits]`, `[u_units_sold]`  
```dax
-DIVIDE( ([$_fulfillment_fee_plus_giftwrap_credits] ), [u_units_sold] )
```

#### `$_cogs_per_unit_sold`

**Depende de medidas:** `[$_cogs]`, `[u_units_sold]`  
```dax
VAR cogs = [$_cogs]

RETURN
    DIVIDE(-cogs,[u_units_sold])
```

#### `$_net_average_price`

**Depende de medidas:** `[$_net_sales]`, `[u_units_sold]`  
```dax
VAR _net_average_price = DIVIDE( [$_net_sales], [u_units_sold] )

RETURN
    _net_average_price
```


### Statements - $ Financial Amount\1. Gross Sales

#### `$_shipping_credits`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[Shipping Credits]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[Shipping Credits] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[Shipping Credits] * fact_payments_date_range[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[Shipping Credits] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Shipping Credits] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Shipping Credits] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Shipping Credits] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_promotional_rebates`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[Promotional Rebates]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[Promotional Rebates] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[Promotional Rebates] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[Promotional Rebates] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Promotional Rebates] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Promotional Rebates] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Promotional Rebates] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_product_sales`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Product Sales]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[type_mapping]`  
```dax
VAR _currency =SELECTEDVALUE ( 'dim_selector_currency'[Currency], "Local" )
    VAR _date_mode = SELECTEDVALUE ( 'dim_selector_date'[selector_date_name], "Date - Payments" )

    VAR _payments_value =
        CALCULATE (
            IF (
                _currency = "Local",
                SUM ( 'fact_payments_date_range'[Product Sales] ),
                SUMX (
                    'fact_payments_date_range',
                    'fact_payments_date_range'[Product Sales]
                        * SWITCH (
                            _currency,
                            "USD", 'fact_payments_date_range'[exchange_rate_to_usd],
                            "EUR", 'fact_payments_date_range'[exchange_rate_to_eur],
                            1
                        )
                )
            ),
            'fact_payments_date_range'[type_mapping] = "Order"
        )

    VAR _all_orders_value =
        CALCULATE (
            IF (
                _currency = "Local",
                SUM ( 'fact_payments_date_range'[Product Sales] ),
                SUMX (
                    'fact_payments_date_range',
                    'fact_payments_date_range'[Product Sales]
                        * SWITCH (
                            _currency,
                            "USD", 'fact_payments_date_range'[exchange_rate_to_usd],
                            "EUR", 'fact_payments_date_range'[exchange_rate_to_eur],
                            1
                        )
                )
            ),
            'fact_payments_date_range'[type_mapping] = "Order",
            USERELATIONSHIP ( 'Calendar'[Date], 'fact_payments_date_range'[date_all_orders] )
        )

    VAR _result =     
        SWITCH (
            _date_mode,
            "Date - All Orders", _all_orders_value,
            "Date - Payments", _payments_value
        )

RETURN
    _result















// // Define tables
//     VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Order" )
//     VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Order", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// // Get Payments Values
//     VAR _loc_payments = SUMX( _td_payments, 'fact_payments_date_range'[Product Sales] )
//     VAR _usd_payments = SUMX( _td_payments, 'fact_payments_date_range'[Product Sales] * 'fact_payments_date_range'[exchange_rate_to_usd] )
//     VAR _eur_payments = SUMX( _td_payments, 'fact_payments_date_range'[Product Sales] * 'fact_payments_date_range'[exchange_rate_to_eur] )

// // Get All Orders Values
//     VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Product Sales] )
//     VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Product Sales] * 'fact_payments_date_range'[exchange_rate_to_usd] )
//     VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Product Sales] * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// // Switches
//     VAR _payments =
//         SWITCH(
//             SELECTEDVALUE('dim_selector_currency'[Currency]),
//             "Local", _loc_payments,
//             "USD",   _usd_payments,
//             "EUR",   _eur_payments
//         )

//     VAR _all_orders =
//         SWITCH(
//             SELECTEDVALUE('dim_selector_currency'[Currency]),
//             "Local", _loc_all_orders,
//             "USD",   _usd_all_orders,
//             "EUR",   _eur_all_orders
//         )

//      VAR _result =    
//         SWITCH(
//             SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
//             "Date - All Orders", _all_orders,
//             "Date - Payments",  _payments
//         )

// RETURN
//     _result
```

#### `$_taxes_collected`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`, `fact_payments_date_range[taxes_collected]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments_sales_tax = SUMX( _td_payments, fact_payments_date_range[taxes_collected] )
    VAR _usd_payments_sales_tax = SUMX( _td_payments, fact_payments_date_range[taxes_collected] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_payments_sales_tax = SUMX( _td_payments, fact_payments_date_range[taxes_collected] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Get All Orders Values
    VAR _loc_all_orders_sales_tax = SUMX( _td_all_orders, fact_payments_date_range[taxes_collected] )
    VAR _usd_all_orders_sales_tax = SUMX( _td_all_orders, fact_payments_date_range[taxes_collected] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders_sales_tax = SUMX( _td_all_orders, fact_payments_date_range[taxes_collected] * fact_payments_date_range[exchange_rate_to_eur] )

// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments_sales_tax,
            "USD",   _usd_payments_sales_tax,
            "EUR",   _eur_payments_sales_tax
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders_sales_tax,
            "USD",   _usd_all_orders_sales_tax,
            "EUR",   _eur_all_orders_sales_tax
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_gross_sales`

**Depende de medidas:** `[$_product_sales]`, `[$_promotional_rebates_plus_shipping_credits]`, `[$_taxes_collected]`  
```dax
VAR _grossSales = [$_product_sales] + [$_promotional_rebates_plus_shipping_credits] + [$_taxes_collected]

RETURN
    _grossSales
```

#### `$_promotional_rebates_plus_shipping_credits`

**Depende de medidas:** `[$_promotional_rebates]`, `[$_shipping_credits]`  
```dax
[$_promotional_rebates] + [$_shipping_credits]
```


### Statements - $ Financial Amount\2. Net Sales

#### `$_net_sales`

**Depende de medidas:** `[$_gross_sales]`, `[$_gst_ca_provision]`, `[$_product_refunds]`, `[$_taxes_refunded]`, `[$_taxes_withheld]`  
```dax
VAR _net_sales = [$_gross_sales] + [$_product_refunds] + [$_taxes_refunded] + [$_taxes_withheld] + [$_gst_ca_provision]

RETURN
    _net_sales
```

#### `$_product_refunds`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Other]`, `'fact_payments_date_range'[Product Sales]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Refund" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Refund", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, ( 'fact_payments_date_range'[Product Sales] + 'fact_payments_date_range'[Other] ) )
    VAR _usd_payments = SUMX( _td_payments, ( 'fact_payments_date_range'[Product Sales] + 'fact_payments_date_range'[Other] ) * 'fact_payments_date_range'[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, ( 'fact_payments_date_range'[Product Sales] + 'fact_payments_date_range'[Other] ) * 'fact_payments_date_range'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, ( 'fact_payments_date_range'[Product Sales] + 'fact_payments_date_range'[Other] ) )
    VAR _usd_all_orders = SUMX( _td_all_orders, ( 'fact_payments_date_range'[Product Sales] + 'fact_payments_date_range'[Other] ) * 'fact_payments_date_range'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, ( 'fact_payments_date_range'[Product Sales] + 'fact_payments_date_range'[Other] ) * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_taxes_refunded`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`, `fact_payments_date_range[taxes_refunded]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[taxes_refunded] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[taxes_refunded] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[taxes_refunded] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[taxes_refunded] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[taxes_refunded] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[taxes_refunded] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_taxes_withheld`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`, `fact_payments_date_range[taxes_withheld]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[taxes_withheld] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[taxes_withheld] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[taxes_withheld] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[taxes_withheld] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[taxes_withheld] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[taxes_withheld] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```


### Statements - $ Financial Amount\2. Net Sales\VAT/GST

#### `$_vat_gst_balance_taxes_collected_refunded_withheld`

**Depende de medidas:** `[$_taxes_collected]`, `[$_taxes_refunded]`, `[$_taxes_withheld]`  
```dax
- [$_taxes_collected]  // Positive
- [$_taxes_refunded]   // Negative
- [$_taxes_withheld]   // Negative
```


### Statements - $ Financial Amount\2. Net Sales\VAT/GST\GST - Canada Taxes

#### `$_gst_ca_storage_fee_credits`

**Depende de medidas:** `[$_amz_storage_fee_actual]`, `[$_amz_storage_fee_payments_with_gst]`  
**Depende de colunas:** `Country[Country]`  
```dax
VAR _gst = CALCULATE( [$_amz_storage_fee_actual] - [$_amz_storage_fee_payments_with_gst], Country[Country] = "CA")

RETURN
    _gst
```

#### `$_gst_ca_provision`

**Depende de medidas:** `[$_gst_ca_fulfillment_fee_credits]`, `[$_gst_ca_storage_fee_credits]`, `[$_vat_gst_balance_taxes_collected_refunded_withheld]`  
**Depende de colunas:** `fact_payments_date_range[Marketplace]`  
```dax
CALCULATE( [$_vat_gst_balance_taxes_collected_refunded_withheld], fact_payments_date_range[Marketplace] = "CA") // Negative
//+ [$_gst_ca_fulfillment_fee_credits]                  // Positive
//+ [$_gst_ca_storage_fee_credits]                      // Positive
```

#### `$_gst_ca_fulfillment_fee_credits`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_fulfillment_fee_credits'[exchange_rate_to_eur]`, `'fact_fulfillment_fee_credits'[exchange_rate_to_usd]`, `'fact_fulfillment_fee_credits'[fba_fee]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_fulfillment_fee_credits')

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_fulfillment_fee_credits'[fba_fee] )
    VAR _usd = SUMX( _td, 'fact_fulfillment_fee_credits'[fba_fee] * 'fact_fulfillment_fee_credits'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_fulfillment_fee_credits'[fba_fee] * 'fact_fulfillment_fee_credits'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 1 - COGS

#### `$_cogs`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Quantity]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[landed_cost]`, `'fact_payments_date_range'[landed_cost_exchange_rate]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Order" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Order", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, ( 'fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[Quantity])
    VAR _usd_payments = SUMX( _td_payments, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_usd]) * 'fact_payments_date_range'[Quantity])
    VAR _eur_payments = SUMX( _td_payments, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_eur]) * 'fact_payments_date_range'[Quantity])

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, ( 'fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[Quantity])
    VAR _usd_all_orders = SUMX( _td_all_orders, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_usd]) * 'fact_payments_date_range'[Quantity])
    VAR _eur_all_orders = SUMX( _td_all_orders, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_eur]) * 'fact_payments_date_range'[Quantity])
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_cogs_refund`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Quantity]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[landed_cost]`, `'fact_payments_date_range'[landed_cost_exchange_rate]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Refund"  )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Refund", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, ( 'fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[Quantity])
    VAR _usd_payments = SUMX( _td_payments, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_usd]) * 'fact_payments_date_range'[Quantity])
    VAR _eur_payments = SUMX( _td_payments, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_eur]) * 'fact_payments_date_range'[Quantity])

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, ( 'fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[Quantity])
    VAR _usd_all_orders = SUMX( _td_all_orders, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_usd]) * 'fact_payments_date_range'[Quantity])
    VAR _eur_all_orders = SUMX( _td_all_orders, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_eur]) * 'fact_payments_date_range'[Quantity])
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_cogs_net_of_refunds`

**Depende de medidas:** `[$_cogs]`, `[$_cogs_refund]`  
```dax
[$_cogs] + [$_cogs_refund]
```

#### `$_contribution_margin_1`

**Depende de medidas:** `[$_cogs_net_of_refunds]`, `[$_net_sales]`  
```dax
VAR _cm1 = [$_net_sales] + [$_cogs_net_of_refunds] // Already Negative, thus the + sign

RETURN
    _cm1
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 2 - Cost of Sales

#### `$_selling_fees`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`, `fact_payments_date_range[selling_fees]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[selling_fees] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[selling_fees] * fact_payments_date_range[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[selling_fees] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[selling_fees] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[selling_fees] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[selling_fees] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_giftwrap_credits`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[Gift Wrap Credits]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[Gift Wrap Credits] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[Gift Wrap Credits] * fact_payments_date_range[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[Gift Wrap Credits] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Gift Wrap Credits] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Gift Wrap Credits] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[Gift Wrap Credits] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_fulfillment_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`, `fact_payments_date_range[fulfillment_fee]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[fulfillment_fee] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[fulfillment_fee] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[fulfillment_fee] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[fulfillment_fee] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[fulfillment_fee] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[fulfillment_fee] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_contribution_margin_2`

**Depende de medidas:** `[$_contribution_margin_1]`, `[$_fulfillment_fee_plus_giftwrap_credits]`, `[$_selling_fees]`  
```dax
VAR _cost_of_sales = 
        [$_selling_fees] + [$_fulfillment_fee_plus_giftwrap_credits] // Already negative, thus the + sign
    VAR _cm2 = [$_contribution_margin_1] + _cost_of_sales            // Most likely already negative, thus the + sign

RETURN
    _cm2
```

#### `$_fulfillment_fee_plus_giftwrap_credits`

**Depende de medidas:** `[$_fulfillment_fee]`, `[$_giftwrap_credits]`  
```dax
VAR _net_fulfillment_fee = [$_fulfillment_fee] + [$_giftwrap_credits]

RETURN
    _net_fulfillment_fee
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 3 - Sponsored Ads

#### `$_total_sponsored_ads_spend`

**Depende de medidas:** `[$_sponsored_brands_spend]`, `[$_sponsored_display_spend]`, `[$_sponsored_product_spend]`  
```dax
VAR _result = [$_sponsored_product_spend] + [$_sponsored_brands_spend] + [$_sponsored_display_spend] 

RETURN
    _result
```

#### `$_sponsored_brands_spend`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_sb_spend_by_sku[exchange_rate_to_eur]`, `fact_sb_spend_by_sku[exchange_rate_to_usd]`, `fact_sb_spend_by_sku[sb_spend]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_sb_spend_by_sku, fact_sb_spend_by_sku[sb_spend] )
    VAR _usd = SUMX( fact_sb_spend_by_sku, fact_sb_spend_by_sku[sb_spend] * fact_sb_spend_by_sku[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_sb_spend_by_sku, fact_sb_spend_by_sku[sb_spend] * fact_sb_spend_by_sku[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc,
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```

#### `$_sponsored_display_spend`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_sd_advertised_product[Spend]`, `fact_sd_advertised_product[exchange_rate_to_eur]`, `fact_sd_advertised_product[exchange_rate_to_usd]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_sd_advertised_product, fact_sd_advertised_product[Spend] )
    VAR _usd = SUMX( fact_sd_advertised_product, fact_sd_advertised_product[Spend] * fact_sd_advertised_product[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_sd_advertised_product, fact_sd_advertised_product[Spend] * fact_sd_advertised_product[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc,
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```

#### `$_sponsored_product_spend`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_sp_advertised_products[exchange_rate_to_eur]`, `fact_sp_advertised_products[exchange_rate_to_usd]`, `fact_sp_advertised_products[spend]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_sp_advertised_products, fact_sp_advertised_products[spend] )
    VAR _usd = SUMX( fact_sp_advertised_products, fact_sp_advertised_products[spend] * fact_sp_advertised_products[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_sp_advertised_products, fact_sp_advertised_products[spend] * fact_sp_advertised_products[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc,
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```

#### `$_total_sponsored_ads_spend_normalized_by_amazon_family`

**Depende de medidas:** `[$_product_sales]`, `[%_tacos_amazon_family]`  
**Depende de colunas:** `'Calendar'[Date]`, `SKUs[SKU]`  
```dax
VAR _ads_spend = 
        SUMX(
            VALUES('Calendar'[Date])
            , SUMX(
                VALUES( SKUs[SKU] )
                , [%_tacos_amazon_family] * [$_product_sales] * -1
            )
        )

RETURN
    _ads_spend
```

#### `$_contribution_margin_3`

**Depende de medidas:** `[$_contribution_margin_2]`, `[$_total_sponsored_ads_spend]`  
```dax
VAR _sponsored_ads = [$_total_sponsored_ads_spend]
    VAR _cm3 = [$_contribution_margin_2] + _sponsored_ads // Already negative, thus the + sign  

RETURN
    _cm3
```

#### `$_contribution_margin_3_normalized_by_amazon_family`

**Depende de medidas:** `[$_contribution_margin_2]`, `[$_total_sponsored_ads_spend_normalized_by_amazon_family]`  
```dax
VAR _normalized_sponsored_ads = [$_total_sponsored_ads_spend_normalized_by_amazon_family]
    VAR _cm3 = [$_contribution_margin_2] + _normalized_sponsored_ads // Already negative, thus the + sign  

RETURN
    _cm3
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4 - Fixed Costs

#### `$_adjustments`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Other]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Adjustment" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Adjustment", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] )
    VAR _usd_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_landed_cost_on_adjustment`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Quantity Adjusted]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[landed_cost]`, `'fact_payments_date_range'[landed_cost_exchange_rate]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Adjustment" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Adjustment", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, ( 'fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[Quantity Adjusted])
    VAR _usd_payments = SUMX( _td_payments, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_usd]) * 'fact_payments_date_range'[Quantity Adjusted])
    VAR _eur_payments = SUMX( _td_payments, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_eur]) * 'fact_payments_date_range'[Quantity Adjusted])

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, ( 'fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[Quantity Adjusted])
    VAR _usd_all_orders = SUMX( _td_all_orders, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_usd]) * 'fact_payments_date_range'[Quantity Adjusted])
    VAR _eur_all_orders = SUMX( _td_all_orders, (('fact_payments_date_range'[landed_cost] / 'fact_payments_date_range'[landed_cost_exchange_rate]) * 'fact_payments_date_range'[exchange_rate_to_eur]) * 'fact_payments_date_range'[Quantity Adjusted])
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_removal_order_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_removal_order_detail[date_request]`, `fact_removal_order_detail[exchange_rate_to_eur]`, `fact_removal_order_detail[exchange_rate_to_usd]`, `fact_removal_order_detail[removal_fee]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_removal_order_detail )
    VAR _td_all_orders = CALCULATETABLE( fact_removal_order_detail, USERELATIONSHIP('Calendar'[Date], fact_removal_order_detail[date_request]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_removal_order_detail[removal_fee] )
    VAR _usd_payments = SUMX( _td_payments, fact_removal_order_detail[removal_fee] * fact_removal_order_detail[exchange_rate_to_usd] )
    VAR _eur_payments = SUMX( _td_payments, fact_removal_order_detail[removal_fee] * fact_removal_order_detail[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_removal_order_detail[removal_fee] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_removal_order_detail[removal_fee] * fact_removal_order_detail[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_removal_order_detail[removal_fee] * fact_removal_order_detail[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_returns_processing_fee`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_returns_processing_fee[exchange_rate_to_eur]`, `fact_returns_processing_fee[exchange_rate_to_usd]`, `fact_returns_processing_fee[fulfillment_fee]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_returns_processing_fee, fact_returns_processing_fee[fulfillment_fee] )
    VAR _usd = SUMX( fact_returns_processing_fee, fact_returns_processing_fee[fulfillment_fee] * fact_returns_processing_fee[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_returns_processing_fee, fact_returns_processing_fee[fulfillment_fee] * fact_returns_processing_fee[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc,
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```

#### `$_contribution_margin_4`

**Depende de medidas:** `[$_adjustments]`, `[$_amz_long_term_storage_fee_actual]`, `[$_amz_storage_fee]`, `[$_awd_processing_transportation_fees]`, `[$_awd_storage_fee_actual]`, `[$_contribution_margin_3]`, `[$_landed_cost_on_adjustment]`, `[$_removal_order_fee]`, `[$_returns_processing_fee]`  
```dax
VAR _fixed_costs = // Already negatives, thus the + signs  
        [$_amz_storage_fee] + [$_awd_storage_fee_actual] + [$_awd_processing_transportation_fees] + [$_amz_long_term_storage_fee_actual]  // Storage Fees
        + [$_returns_processing_fee] +  [$_adjustments] + [$_landed_cost_on_adjustment] + [$_removal_order_fee]
    VAR _cm4 = [$_contribution_margin_3] + _fixed_costs // Already negative, thus the + sign  

RETURN
    _cm4
```

#### `$_contribution_margin_4_normalized_by_amazon_family`

**Depende de medidas:** `[$_adjustments]`, `[$_amz_long_term_storage_fee_actual]`, `[$_amz_storage_fee]`, `[$_awd_processing_transportation_fees]`, `[$_awd_storage_fee_actual]`, `[$_contribution_margin_3_normalized_by_amazon_family]`, `[$_landed_cost_on_adjustment]`, `[$_removal_order_fee]`, `[$_returns_processing_fee]`  
```dax
VAR _fixed_costs = // Already negatives, thus the + signs  
        [$_amz_storage_fee] + [$_awd_storage_fee_actual] + [$_awd_processing_transportation_fees] + [$_amz_long_term_storage_fee_actual]  // Storage Fees
        + [$_returns_processing_fee] +  [$_adjustments] + [$_landed_cost_on_adjustment] + [$_removal_order_fee]
    VAR _cm4 = [$_contribution_margin_3_normalized_by_amazon_family] + _fixed_costs // Already negative, thus the + sign  

RETURN
    _cm4
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4 - Fixed Costs\AWD Processing & Transportation Fees

#### `$_awd_processing_transportation_fees`

**Depende de medidas:** `[$_awd_processing_fee]`, `[$_awd_transportation_fee]`  
```dax
[$_awd_processing_fee] + [$_awd_transportation_fee]
```

#### `$_awd_processing_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'Calendar'[Start of Month]`, `'Currency - Selector'[Currency]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_awd_monthly_processing_fee'[exchange_rate_to_eur]`, `'fact_awd_monthly_processing_fee'[exchange_rate_to_usd]`, `'fact_awd_monthly_processing_fee'[total_charged_amount]`, `'fact_awd_monthly_processing_fee'[transaction_date]`, `fact_awd_monthly_processing_fee[exchange_rate_to_eur]`, `fact_awd_monthly_processing_fee[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_awd_monthly_processing_fee )
    VAR _td_all_orders = CALCULATETABLE( fact_awd_monthly_processing_fee, USERELATIONSHIP('Calendar'[Date], 'fact_awd_monthly_processing_fee'[transaction_date]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, ( 'fact_awd_monthly_processing_fee'[total_charged_amount] ) )
    VAR _usd_payments = SUMX( _td_payments, ( 'fact_awd_monthly_processing_fee'[total_charged_amount] * fact_awd_monthly_processing_fee[exchange_rate_to_usd] ) )
    VAR _eur_payments = SUMX( _td_payments, ( 'fact_awd_monthly_processing_fee'[total_charged_amount] * fact_awd_monthly_processing_fee[exchange_rate_to_eur] ) )
    
// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_awd_monthly_processing_fee'[total_charged_amount] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_awd_monthly_processing_fee'[total_charged_amount] * 'fact_awd_monthly_processing_fee'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_awd_monthly_processing_fee'[total_charged_amount] * 'fact_awd_monthly_processing_fee'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )
    
     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result



// // OLD VERSION
// // Days Constraint
//     VAR _daysInMonth = DAY(ENDOFMONTH('Calendar'[Start of Month])) -- Calculate the days in the related month

// // Get Payments Values
//     VAR _loc = SUMX( fact_awd_monthly_processing_fee, ( 'fact_awd_monthly_processing_fee'[total_charged_amount] ) )
//     VAR _usd = SUMX( fact_awd_monthly_processing_fee, ( 'fact_awd_monthly_processing_fee'[total_charged_amount] * fact_awd_monthly_processing_fee[exchange_rate_to_usd] ) /_daysInMonth )
//     VAR _eur = SUMX( fact_awd_monthly_processing_fee, ( 'fact_awd_monthly_processing_fee'[total_charged_amount] * fact_awd_monthly_processing_fee[exchange_rate_to_eur] ) /_daysInMonth )

// // Switches
//     VAR _result =
//         SWITCH(
//             SELECTEDVALUE('Currency - Selector'[Currency]),
//             "Local", -_loc,
//             "USD",   -_usd,
//             "EUR",   -_eur
//         )

// RETURN
//     _result
```

#### `$_awd_transportation_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'Calendar'[Start of Month]`, `'Currency - Selector'[Currency]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_awd_monthly_transportation_fee'[exchange_rate_to_eur]`, `'fact_awd_monthly_transportation_fee'[exchange_rate_to_usd]`, `'fact_awd_monthly_transportation_fee'[total_charged_amount]`, `'fact_awd_monthly_transportation_fee'[transaction_date]`, `fact_awd_monthly_transportation_fee[exchange_rate_to_eur]`, `fact_awd_monthly_transportation_fee[exchange_rate_to_usd]`, `fact_awd_monthly_transportation_fee[total_charged_amount]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_awd_monthly_transportation_fee )
    VAR _td_all_orders = CALCULATETABLE( fact_awd_monthly_transportation_fee, USERELATIONSHIP('Calendar'[Date], 'fact_awd_monthly_transportation_fee'[transaction_date]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, ( 'fact_awd_monthly_transportation_fee'[total_charged_amount] ) )
    VAR _usd_payments = SUMX( _td_payments, ( 'fact_awd_monthly_transportation_fee'[total_charged_amount] * fact_awd_monthly_transportation_fee[exchange_rate_to_usd] ) )
    VAR _eur_payments = SUMX( _td_payments, ( 'fact_awd_monthly_transportation_fee'[total_charged_amount] * fact_awd_monthly_transportation_fee[exchange_rate_to_eur] ) )
    
// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_awd_monthly_transportation_fee'[total_charged_amount] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_awd_monthly_transportation_fee'[total_charged_amount] * 'fact_awd_monthly_transportation_fee'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_awd_monthly_transportation_fee'[total_charged_amount] * 'fact_awd_monthly_transportation_fee'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )
    
     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result



// // OLD VERSION
// // Days Constraint
//     VAR _daysInMonth = DAY(ENDOFMONTH('Calendar'[Start of Month])) -- Calculate the days in the related month

// // Get Payments Values
//     VAR _loc = SUMX( fact_awd_monthly_transportation_fee, ( fact_awd_monthly_transportation_fee[total_charged_amount] ) )
//     VAR _usd = SUMX( fact_awd_monthly_transportation_fee, ( fact_awd_monthly_transportation_fee[total_charged_amount] * fact_awd_monthly_transportation_fee[exchange_rate_to_usd] ) /_daysInMonth )
//     VAR _eur = SUMX( fact_awd_monthly_transportation_fee, ( fact_awd_monthly_transportation_fee[total_charged_amount] * fact_awd_monthly_transportation_fee[exchange_rate_to_eur] ) /_daysInMonth )

// // Switches
//     VAR _result =
//         SWITCH(
//             SELECTEDVALUE('Currency - Selector'[Currency]),
//             "Local", -_loc,
//             "USD",   -_usd,
//             "EUR",   -_eur
//         )

// RETURN
//     _result
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4 - Fixed Costs\AWD Storage Fee

#### `$_awd_storage_fee_actual`

**Depende de colunas:** `'Calendar'[Start of Month]`, `'dim_selector_currency'[Currency]`, `fact_awd_monthly_storage_fee[daily_charged_amount]`, `fact_awd_monthly_storage_fee[exchange_rate_to_eur]`, `fact_awd_monthly_storage_fee[exchange_rate_to_usd]`  
```dax
// Days Constraint
    VAR _daysInMonth = DAY(ENDOFMONTH('Calendar'[Start of Month])) -- Calculate the days in the related month

// Get Payments Values
    VAR _loc = SUMX( fact_awd_monthly_storage_fee, fact_awd_monthly_storage_fee[daily_charged_amount] )
    VAR _usd = SUMX( fact_awd_monthly_storage_fee, fact_awd_monthly_storage_fee[daily_charged_amount] * fact_awd_monthly_storage_fee[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_awd_monthly_storage_fee, fact_awd_monthly_storage_fee[daily_charged_amount] * fact_awd_monthly_storage_fee[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc,
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4 - Fixed Costs\Amazon + AWD Storage Fee

#### `$_amz_awd_storage_fees`

**Depende de medidas:** `[$_amz_storage_fee]`, `[$_awd_storage_fee_actual]`  
```dax
VAR fees = [$_amz_storage_fee] + [$_awd_storage_fee_actual]

RETURN
    fees
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4 - Fixed Costs\Amazon Long Term Storage Fee

#### `$_amz_long_term_storage_fee_actual`

**Depende de colunas:** `'Calendar'[Date]`, `'Currency - Selector'[Currency]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_aged_inventory_surcharge'[daily_amount_charged]`, `'fact_aged_inventory_surcharge'[date_inventory]`, `'fact_aged_inventory_surcharge'[exchange_rate_to_eur]`, `'fact_aged_inventory_surcharge'[exchange_rate_to_usd]`, `fact_aged_inventory_surcharge[amount_charged]`, `fact_aged_inventory_surcharge[exchange_rate_to_eur]`, `fact_aged_inventory_surcharge[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payment =   CALCULATETABLE( 'fact_aged_inventory_surcharge')
    VAR _td_inventory = CALCULATETABLE( 'fact_aged_inventory_surcharge', USERELATIONSHIP('Calendar'[Date], 'fact_aged_inventory_surcharge'[date_inventory]) )

// Get Payments Values
    VAR _loc_payment = SUMX( _td_payment, 'fact_aged_inventory_surcharge'[daily_amount_charged] )
    VAR _usd_payment = SUMX( _td_payment, 'fact_aged_inventory_surcharge'[daily_amount_charged] * 'fact_aged_inventory_surcharge'[exchange_rate_to_usd] )
    VAR _eur_payment = SUMX( _td_payment, 'fact_aged_inventory_surcharge'[daily_amount_charged] * 'fact_aged_inventory_surcharge'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_inventory = SUMX( _td_inventory, 'fact_aged_inventory_surcharge'[daily_amount_charged] )
    VAR _usd_inventory = SUMX( _td_inventory, 'fact_aged_inventory_surcharge'[daily_amount_charged] * 'fact_aged_inventory_surcharge'[exchange_rate_to_usd] )
    VAR _eur_inventory = SUMX( _td_inventory, 'fact_aged_inventory_surcharge'[daily_amount_charged] * 'fact_aged_inventory_surcharge'[exchange_rate_to_eur] )
    
// Switches
    VAR _payment =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payment,
            "USD",   _usd_payment,
            "EUR",   _eur_payment
        )

    VAR _inventory =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_inventory,
            "USD",   _usd_inventory,
            "EUR",   _eur_inventory
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _inventory,
            "Date - Payments",  _payment
        )

RETURN
    _result






// // Get Payments Values
//     VAR _loc = SUMX( fact_aged_inventory_surcharge, fact_aged_inventory_surcharge[amount_charged] )
//     VAR _usd = SUMX( fact_aged_inventory_surcharge, fact_aged_inventory_surcharge[amount_charged] * fact_aged_inventory_surcharge[exchange_rate_to_usd] )
//     VAR _eur = SUMX( fact_aged_inventory_surcharge, fact_aged_inventory_surcharge[amount_charged] * fact_aged_inventory_surcharge[exchange_rate_to_eur] )

// // Switches
//     VAR _result =
//         SWITCH(
//             SELECTEDVALUE('Currency - Selector'[Currency]),
//             "Local", -_loc,
//             "USD",   -_usd,
//             "EUR",   -_eur
//         )

// RETURN
//     _result
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4 - Fixed Costs\Amazon Storage Fee

#### `$_amz_storage_fee_actual`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_storage_fee_daily[estimated_daily_storage_fee]`, `fact_storage_fee_daily[exchange_rate_to_eur]`, `fact_storage_fee_daily[exchange_rate_to_usd]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_storage_fee_daily, fact_storage_fee_daily[estimated_daily_storage_fee] )
    VAR _usd = SUMX( fact_storage_fee_daily, fact_storage_fee_daily[estimated_daily_storage_fee] * fact_storage_fee_daily[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_storage_fee_daily, fact_storage_fee_daily[estimated_daily_storage_fee] * fact_storage_fee_daily[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc,
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```

#### `$_amz_storage_fee_forecast`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_estimated_future_daily_storage_fee[estimated_daily_storage_fee]`, `fact_estimated_future_daily_storage_fee[exchange_rate_to_eur]`, `fact_estimated_future_daily_storage_fee[exchange_rate_to_usd]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_estimated_future_daily_storage_fee, fact_estimated_future_daily_storage_fee[estimated_daily_storage_fee] )
    VAR _usd = SUMX( fact_estimated_future_daily_storage_fee, fact_estimated_future_daily_storage_fee[estimated_daily_storage_fee] * fact_estimated_future_daily_storage_fee[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_estimated_future_daily_storage_fee, fact_estimated_future_daily_storage_fee[estimated_daily_storage_fee] * fact_estimated_future_daily_storage_fee[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", -_loc, 
            "USD",   -_usd,
            "EUR",   -_eur
        )

RETURN
    _result
```

#### `$_amz_storage_fee`

**Depende de medidas:** `[$_amz_storage_fee_actual]`, `[$_amz_storage_fee_forecast]`  
```dax
VAR _storage_fee = [$_amz_storage_fee_actual] + [$_amz_storage_fee_forecast]

RETURN
    _storage_fee
```

#### `%_amz_storage_fee_yoy`

**Depende de medidas:** `[$_amz_storage_fee]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _current_value = [$_amz_storage_fee]
    VAR _last_year_value = CALCULATE( [$_amz_storage_fee], SAMEPERIODLASTYEAR( 'Calendar'[Date] ) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value ) - 1
    
RETURN
    _yoy
```

#### `$_amz_storage_fee_payments_with_gst`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `fact_payments_storage_fee_with_gst[daily_storage_fee]`, `fact_payments_storage_fee_with_gst[exchange_rate_to_eur]`, `fact_payments_storage_fee_with_gst[exchange_rate_to_usd]`  
```dax
// Get Payments Values
    VAR _loc = SUMX( fact_payments_storage_fee_with_gst, fact_payments_storage_fee_with_gst[daily_storage_fee] )
    VAR _usd = SUMX( fact_payments_storage_fee_with_gst, fact_payments_storage_fee_with_gst[daily_storage_fee] * fact_payments_storage_fee_with_gst[exchange_rate_to_usd] )
    VAR _eur = SUMX( fact_payments_storage_fee_with_gst, fact_payments_storage_fee_with_gst[daily_storage_fee] * fact_payments_storage_fee_with_gst[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```


### Statements - $ Financial Amount\3. Operational Expenses\CM 4.1 - Non-Apportioned Costs

#### `$_deal_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Other Transaction Fees]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`, `'fact_payments_date_range'[type_mapping]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Deal Fee" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[type_mapping] = "Deal Fee", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other Transaction Fees] )
    VAR _usd_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other Transaction Fees] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_grade_and_resell_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Other]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[description_mapping]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[description_mapping] = "Grade and Resell Charge" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[description_mapping] = "Grade and Resell Charge", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] )
    VAR _usd_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_subscription_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Other]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[description_mapping]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[description_mapping] = "Subscription Fee" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[description_mapping] = "Subscription Fee", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] )
    VAR _usd_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other] * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_fee_adjustment`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `fact_payments_date_range[date_all_orders]`, `fact_payments_date_range[exchange_rate_to_eur]`, `fact_payments_date_range[exchange_rate_to_usd]`, `fact_payments_date_range[fee_adjustment]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( fact_payments_date_range )
    VAR _td_all_orders = CALCULATETABLE( fact_payments_date_range, USERELATIONSHIP('Calendar'[Date], fact_payments_date_range[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, fact_payments_date_range[fee_adjustment] )
    VAR _usd_payments = SUMX( _td_payments, fact_payments_date_range[fee_adjustment] * fact_payments_date_range[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, fact_payments_date_range[fee_adjustment] * fact_payments_date_range[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, fact_payments_date_range[fee_adjustment] )
    VAR _usd_all_orders = SUMX( _td_all_orders, fact_payments_date_range[fee_adjustment] * fact_payments_date_range[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, fact_payments_date_range[fee_adjustment] * fact_payments_date_range[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_contribution_margin_4_1`

**Depende de medidas:** `[$_contribution_margin_4]`, `[$_coupon_fee]`, `[$_deal_fee]`, `[$_fee_adjustment]`, `[$_grade_and_resell_fee]`, `[$_subscription_fee]`, `[$_vat_gb_eu]`  
```dax
VAR _non_apportioned_costs = // Already negatives, thus the + signs  
        [$_vat_gb_eu] + [$_subscription_fee] + [$_coupon_fee] + [$_deal_fee] + [$_grade_and_resell_fee] + [$_fee_adjustment]
    VAR _cm5 = [$_contribution_margin_4] + _non_apportioned_costs // Most likely already negative, thus the + sign  

RETURN
    _cm5
```

#### `$_vat_gb_eu`

**Depende de medidas:** `[$_vat_gst_balance_taxes_collected_refunded_withheld]`  
**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`, `NOT fact_payments_date_range[Marketplace]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Government Fees" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )
    VAR _vat_apportioned = CALCULATE( [$_vat_gst_balance_taxes_collected_refunded_withheld], NOT fact_payments_date_range[Marketplace] IN {"CA", "US", "MX", "BR"} )

    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result + _vat_apportioned
```

#### `$_coupon_fee`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_selector_currency'[Currency]`, `'dim_selector_date'[selector_date_name]`, `'fact_payments_date_range'[Other Transaction Fees]`, `'fact_payments_date_range'[date_all_orders]`, `'fact_payments_date_range'[description_mapping]`, `'fact_payments_date_range'[exchange_rate_to_eur]`, `'fact_payments_date_range'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td_payments =   CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[description_mapping] = "Save" )
    VAR _td_all_orders = CALCULATETABLE( 'fact_payments_date_range', 'fact_payments_date_range'[description_mapping] = "Save", USERELATIONSHIP('Calendar'[Date], 'fact_payments_date_range'[date_all_orders]) )

// Get Payments Values
    VAR _loc_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other Transaction Fees] )
    VAR _usd_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_usd] )   
    VAR _eur_payments = SUMX( _td_payments, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_eur] )

// Get All Orders Values
    VAR _loc_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other Transaction Fees] )
    VAR _usd_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_usd] )
    VAR _eur_all_orders = SUMX( _td_all_orders, 'fact_payments_date_range'[Other Transaction Fees] * 'fact_payments_date_range'[exchange_rate_to_eur] )
    
// Switches
    VAR _payments =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_payments,
            "USD",   _usd_payments,
            "EUR",   _eur_payments
        )

    VAR _all_orders =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc_all_orders,
            "USD",   _usd_all_orders,
            "EUR",   _eur_all_orders
        )

     VAR _result =    
        SWITCH(
            SELECTEDVALUE( 'dim_selector_date'[selector_date_name] ),
            "Date - All Orders", _all_orders,
            "Date - Payments",  _payments
        )

RETURN
    _result
```

#### `$_total_expenses_commercial`

**Depende de medidas:** `[$_cogs]`, `[$_cogs_refund]`, `[$_fulfillment_fee]`, `[$_selling_fees]`  
```dax
VAR _cogs = [$_cogs] + [$_cogs_refund]
    VAR _fees_selling_fulfillment = [$_selling_fees] + [$_fulfillment_fee]
RETURN
    _cogs + _fees_selling_fulfillment
```

#### `$_commercial_profit`

**Depende de medidas:** `[$_net_sales_commercial]`, `[$_total_expenses_commercial]`  
```dax
VAR margin = [$_net_sales_commercial] + [$_total_expenses_commercial]

RETURN
    margin
```

#### `$_total_other_expenses_commercial`

**Depende de medidas:** `[$_amz_long_term_storage_fee_actual]`, `[$_amz_storage_fee]`, `[$_awd_processing_transportation_fees]`, `[$_awd_storage_fee_actual]`, `[$_returns_processing_fee]`, `[$_total_sponsored_ads_spend]`  
```dax
VAR _sponsoredAds = [$_total_sponsored_ads_spend]    
    VAR _storage_fees = [$_amz_storage_fee] + [$_amz_long_term_storage_fee_actual] + [$_awd_storage_fee_actual] + [$_awd_processing_transportation_fees] + [$_amz_long_term_storage_fee_actual]
    VAR _returns = [$_returns_processing_fee]

RETURN
    _sponsoredAds + _storage_fees + _returns
```


### Statements - $ Financial Amount\4. Local Costs

#### `$_photograph_cost`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Photography")

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_logistic_storage_3pl_cost`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "3PL")

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_professional_service_fee`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Professional Service Fee" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_local_cost`

**Depende de medidas:** `[$_bank_fee]`, `[$_logistic_storage_3pl_cost]`, `[$_marketing_services]`, `[$_photograph_cost]`, `[$_professional_service_fee]`, `[$_training_education]`  
```dax
[$_photograph_cost] + [$_logistic_storage_3pl_cost] + [$_professional_service_fee] + [$_bank_fee] + [$_training_education] + [$_marketing_services]
```

#### `$_bank_fee`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição]="Bank Fee")

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_training_education`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Training / Education" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_marketing_services`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Marketing Services")

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_contribution_margin_5`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[$_local_cost]`  
```dax
VAR _local_costs = [$_local_cost] // Already negatives, thus the + signs  
    VAR _cm5 = [$_contribution_margin_4_1] + _local_costs // Already negative, thus the + sign  

RETURN
    _cm5
```


### Statements - $ Financial Amount\5. Total general & ADM

#### `$_wages_cost`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Wages" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_fixed_cost`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "Fixed Costs (Credit Card)" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_office_cost`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição] = "OFFICE COSTS" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_adjustments_credit_card`

**Depende de colunas:** `'dim_selector_currency'[Currency]`, `'fact_P&L GERAL'[Descrição]`, `'fact_P&L GERAL'[Valor]`, `'fact_P&L GERAL'[exchange_rate_to_eur]`, `'fact_P&L GERAL'[exchange_rate_to_usd]`  
```dax
// Define tables
    VAR _td =   CALCULATETABLE( 'fact_P&L GERAL', 'fact_P&L GERAL'[Descrição]="Adjustments (Credit Card)" )

// Get Payments Values
    VAR _loc = SUMX( _td, 'fact_P&L GERAL'[Valor] )
    VAR _usd = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_usd] )
    VAR _eur = SUMX( _td, 'fact_P&L GERAL'[Valor] * 'fact_P&L GERAL'[exchange_rate_to_eur] )

// Switches
    VAR _result =
        SWITCH(
            SELECTEDVALUE('dim_selector_currency'[Currency]),
            "Local", _loc,
            "USD",   _usd,
            "EUR",   _eur
        )

RETURN
    _result
```

#### `$_total_general_and_administrative_costs`

**Depende de medidas:** `[$_adjustments_credit_card]`, `[$_fixed_cost]`, `[$_office_cost]`, `[$_wages_cost]`  
```dax
[$_wages_cost] + [$_fixed_cost] + [$_office_cost] + [$_adjustments_credit_card]
```


### Statements - $ Financial Amount\6. Net Income

#### `$_net_income`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[$_local_cost]`, `[$_total_general_and_administrative_costs]`  
```dax
VAR _netIncome = [$_contribution_margin_4_1] + [$_local_cost] + [$_total_general_and_administrative_costs]

RETURN
    _netIncome
```


### Statements - $ Financial Amount\Statements

#### `$_statement_financial`

**Depende de medidas:** `[$_adjustments]`, `[$_adjustments_credit_card]`, `[$_amz_long_term_storage_fee_actual]`, `[$_amz_storage_fee]`, `[$_awd_processing_transportation_fees]`, `[$_awd_storage_fee_actual]`, `[$_bank_fee]`, `[$_cogs_net_of_refunds]`, `[$_cogs_per_unit_sold]`, `[$_contribution_margin_1]`, `[$_contribution_margin_2]`, `[$_contribution_margin_3]`, `[$_contribution_margin_4]`, `[$_contribution_margin_4_1]`, `[$_contribution_margin_5]`, `[$_coupon_fee]`, `[$_deal_fee]`, `[$_fee_adjustment]`, `[$_fixed_cost]`, `[$_fulfillment_fee_per_unit_sold]`, `[$_fulfillment_fee_plus_giftwrap_credits]`, `[$_grade_and_resell_fee]`, `[$_gross_sales]`, `[$_gst_ca_provision]`, `[$_landed_cost_on_adjustment]`, `[$_local_cost]`, `[$_logistic_storage_3pl_cost]`, `[$_marketing_services]`, `[$_net_average_price]`, `[$_net_income]`, `[$_net_sales]`, `[$_office_cost]`, `[$_photograph_cost]`, `[$_product_refunds]`, `[$_product_sales]`, `[$_professional_service_fee]`, `[$_promotional_rebates_plus_shipping_credits]`, `[$_removal_order_fee]`, `[$_returns_processing_fee]`, `[$_selling_fees]`, `[$_sponsored_brands_spend]`, `[$_sponsored_display_spend]`, `[$_sponsored_product_spend]`, `[$_subscription_fee]`, `[$_taxes_collected]`, `[$_taxes_refunded]`, `[$_taxes_withheld]`, `[$_total_general_and_administrative_costs]`, `[$_training_education]`, `[$_vat_gb_eu]`, `[$_wages_cost]`, `[%_contribution_margin_1_over_net_sales]`, `[%_contribution_margin_2_over_net_sales]`, `[%_contribution_margin_3_over_net_sales]`, `[%_contribution_margin_4_1_over_net_sales]`, `[%_contribution_margin_4_over_net_sales]`, `[%_contribution_margin_5_over_net_sales]`, `[%_net_income_over_net_sales]`, `[u_units_sold]`  
**Depende de colunas:** `'dim_statement_financial'[account_id]`  
```dax
VAR Account = SELECTEDVALUE ( 'dim_statement_financial'[account_id] )

VAR Raw =
    SWITCH(
        Account,
        "units_sold",                [u_units_sold],
        "net_average_price",         [$_net_average_price],
        "fulfillment_fees_per_unit", [$_fulfillment_fee_per_unit_sold],
        "cogs_per_unit",             [$_cogs_per_unit_sold],

        "product_sales",                          [$_product_sales],
        "promo_rebates_plus_shipping_credits",    [$_promotional_rebates_plus_shipping_credits],
        "taxes_collected",                        [$_taxes_collected],
        "gross_sales",                            [$_gross_sales],

        "product_refunds",                        [$_product_refunds],
        "taxes_refunded",                         [$_taxes_refunded],
        "taxes_withheld",                         [$_taxes_withheld],
        "gst_provision",                          [$_gst_ca_provision],
        "net_sales",                              [$_net_sales],

        "cogs_net_of_refunds",                    [$_cogs_net_of_refunds],
        // "cm_1",                                   [$_contribution_margin_1],
        // "margin_1",                               [%_contribution_margin_1_over_net_sales],

        "selling_fees",                           [$_selling_fees],
        "fulfillment_fees_plus_giftwrap_credits", [$_fulfillment_fee_plus_giftwrap_credits],
        // "cm_2",                                   [$_contribution_margin_2],
        // "margin_2",                               [%_contribution_margin_2_over_net_sales],

        "Sponsored_products",        [$_sponsored_product_spend],
        "Sponsored_display",         [$_sponsored_display_spend],
        // "cm_3",                      [$_contribution_margin_3],
        // "margin_3",                  [%_contribution_margin_3_over_net_sales],

        "amz_storage_fee",           [$_amz_storage_fee],
        "amz_long_term_storage_fee", [$_amz_long_term_storage_fee_actual],
        "awd_storage_fee",           [$_awd_storage_fee_actual],
        "awd_proces_and_transp_fees",[$_awd_processing_transportation_fees],
        "returns_processing_fees",   [$_returns_processing_fee],
        "adjustments",               [$_adjustments],
        "landed_cost_on_adjustments",[$_landed_cost_on_adjustment],
        "removal_orders",            [$_removal_order_fee],
        // "cm_4",                      [$_contribution_margin_4],
        // "margin_4",                  [%_contribution_margin_4_over_net_sales],

        "Sponsored_brands",          [$_sponsored_brands_spend],
        "vat_gb_eu",                 [$_vat_gb_eu],
        "subscription_fee",          [$_subscription_fee],
        "coupon_fee",                [$_coupon_fee],
        "deal_fee",                  [$_deal_fee],
        "grade_and_resell",          [$_grade_and_resell_fee],
        "fee_adjustment",            [$_fee_adjustment],
        "cm_4_1",                    [$_contribution_margin_4_1],
        // "margin_4_1",                [%_contribution_margin_4_1_over_net_sales],

        "photographer",              [$_photograph_cost],
        "logistic_storage_3pl",      [$_logistic_storage_3pl_cost],
        "professional_service_fee",  [$_professional_service_fee],
        "bank_fee",                  [$_bank_fee],
        "training_and_education",    [$_training_education],
        "marketing_services",        [$_marketing_services],
        "total_local_costs",         [$_local_cost],
        // "cm_5",                      [$_contribution_margin_5],
        // "margin_5",                  [%_contribution_margin_5_over_net_sales],

        "wages",                     [$_wages_cost],
        "fixed_costs_credit_card",   [$_fixed_cost],
        "office_fixed_costs_roi",    [$_office_cost],
        "adjustments_credit_card)",  [$_adjustments_credit_card],
        // "total_general_and_adm",     [$_total_general_and_administrative_costs],

        "net_income",                [$_net_income],
        "net_margin",                [%_net_income_over_net_sales],

        BLANK()
    )

-- Choose what you want to force to 0

// VAR ForceZero =
//     NOT Account IN {
//         "",
//         "margin_1","margin_2","margin_3","margin_4","margin_4_1","margin_5","net_margin",
//         "net_average_price","fulfillment_fees_per_unit","cogs_per_unit"
//     }

RETURN
    // IF(
    //     ForceZero,
    //     COALESCE(Raw, 0),
    //     Raw
    // )

Raw
```

#### `$_statement_commercial`

**Depende de medidas:** `[$_amz_long_term_storage_fee_actual]`, `[$_amz_storage_fee]`, `[$_awd_processing_transportation_fees]`, `[$_awd_storage_fee_actual]`, `[$_cogs]`, `[$_cogs_per_unit_sold]`, `[$_cogs_refund]`, `[$_commercial_profit]`, `[$_fulfillment_fee]`, `[$_fulfillment_fee_per_unit_sold]`, `[$_giftwrap_credits]`, `[$_net_average_price_commercial]`, `[$_net_income_commercial]`, `[$_net_sales_commercial]`, `[$_product_refunds]`, `[$_product_sales]`, `[$_promotional_rebates]`, `[$_returns_processing_fee]`, `[$_selling_fees]`, `[$_shipping_credits]`, `[$_total_expenses_commercial]`, `[$_total_other_expenses_commercial]`, `[$_total_sponsored_ads_spend]`, `[%_amz_storage_fee_over_net_sales]`, `[%_awd_processing_transportation_fees_over_net_sales]`, `[%_awd_storage_fee_over_net_sales]`, `[%_cogs_plus_cogs_refund_over_product_sales]`, `[%_commercial_profit_over_product_sales]`, `[%_fulfillment_fee_over_net_sales]`, `[%_net_margin_commercial]`, `[%_product_refunds_over_net_sales]`, `[%_promotional_rebates_plus_shipping_credits_over_product_sales]`, `[%_selling_fees_over_net_sales]`, `[%_tacos]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_statement_commercial'[account_id]`  
```dax
VAR SelectedMonth = SELECTEDVALUE('Calendar'[Date])

VAR Amount = 
    SWITCH(
        SELECTEDVALUE('dim_statement_commercial'[account_id]),
        
        // SALES
        "product_sales",                    FORMAT([$_product_sales],                                       "#,##0.00 ; (#,##0.00)"),
        "product_refunds",                  FORMAT([$_product_refunds],                                     "#,##0.00 ; (#,##0.00)"),
        "share_product_refunds",            FORMAT([%_product_refunds_over_net_sales],                  "percent"),              
        "promo_rebates",                    FORMAT([$_promotional_rebates],                                 "#,##0.00 ; (#,##0.00)"),
        "shipping_credits",                 FORMAT([$_shipping_credits],                                    "#,##0.00 ; (#,##0.00)"),
        "giftWrap_credits",                 FORMAT([$_giftwrap_credits],                                    "#,##0.00 ; (#,##0.00)"),
        "share_promo_rebates_plus_credits", FORMAT([%_promotional_rebates_plus_shipping_credits_over_product_sales], "percent"),              
        "commercial_net_sales",             FORMAT([$_net_sales_commercial],                                "#,##0.00 ; (#,##0.00)"), // Commercial Only
        
        // COMMERCIAL EXPENSES
        "selling_fees",              FORMAT( [$_selling_fees],                             "#,##0.00 ; (#,##0.00)"),
        "share_selling_fees",        FORMAT( [%_selling_fees_over_net_sales],          "percent"),              
        "cogs",                      FORMAT( [$_cogs],                                     "#,##0.00 ; (#,##0.00)"),
        "cogs_refunds",              FORMAT( [$_cogs_refund],                              "#,##0.00 ; (#,##0.00)"),
        "share_net_cogs",            FORMAT( [%_cogs_plus_cogs_refund_over_product_sales], "percent"),               // Commercial Only
        "Fulfillment_fees",          FORMAT( [$_fulfillment_fee],                          "#,##0.00 ; (#,##0.00)"),
        "share_fulfillment_fees",    FORMAT( [%_fulfillment_fee_over_net_sales],                   "percent"),              
        "total_commercial_expenses", FORMAT( [$_total_expenses_commercial],                "#,##0.00 ; (#,##0.00)"), // Commercial Only

        // COMMERCIAL PROFIT & MARGIN
        "commercial_profit", FORMAT( [$_commercial_profit],                    "#,##0.00 ; (#,##0.00)"), // Commercial Only
        "commercial_margin", FORMAT( [%_commercial_profit_over_product_sales], "percent"),               // Commercial Only
        
        // PPC, STORAGE & RETURNS EXPENSES
        "sponsored_ads",                      FORMAT( [$_total_sponsored_ads_spend],                             "#,##0.00 ; (#,##0.00)"),
        "tacos",                              FORMAT( [%_tacos],                                                 "percent"),              
        "amz_storage_fee",                    FORMAT( [$_amz_storage_fee],                                       "#,##0.00 ; (#,##0.00)"),
        "share_amz_storage_fee",              FORMAT( [%_amz_storage_fee_over_net_sales],                    "percent"),              
        "awd_storage_fee",                    FORMAT( [$_awd_storage_fee_actual],                                "#,##0.00 ; (#,##0.00)"),
        "share_awd_storage_fee",              FORMAT( [%_awd_storage_fee_over_net_sales],                    "percent"),              
        "awd_proces_and_transp_fees",         FORMAT( [$_awd_processing_transportation_fees],                    "#,##0.00 ; (#,##0.00)"),
        "share_awd_proces_and_transp_fees",   FORMAT( [%_awd_processing_transportation_fees_over_net_sales], "percent"),             
        "amz_long_term_storage_fee",          FORMAT( [$_amz_long_term_storage_fee_actual],                      "#,##0.00 ; (#,##0.00)"),
        "returns_processing_fees",            FORMAT( [$_returns_processing_fee],                                "#,##0.00 ; (#,##0.00)"),
        "total_ppc_storage_returns_expenses", FORMAT( [$_total_other_expenses_commercial],                       "#,##0.00 ; (#,##0.00)"), // Commercial Only
        
        // COMMERCIAL OPERATIONAL PROFIT
        "commercial_net_income", FORMAT( [$_net_income_commercial], "#,##0.00 ; (#,##0.00)"), // Commercial Only
        "commercial_net_margin", FORMAT( [%_net_margin_commercial], "percent"),               // Commercial Only
         
        // OTHER METRICS
        "units_sold",                   FORMAT( [u_units_sold],                    "#,##0"),
        "net_average_price_commercial", FORMAT( [$_net_average_price_commercial],  "#,##0.00"), // Commercial Only
        "cogs_per_unit",                FORMAT( [$_cogs_per_unit_sold],            "#,##0.00"), // Commercial Only
        "fulfillment_fee_per_unit",     FORMAT( [$_fulfillment_fee_per_unit_sold], "#,##0.00"),
        BLANK())

RETURN
    CALCULATE(
        Amount,
        'Calendar'[Date] = SelectedMonth
    )
```

#### `$_statement_financial_format`

**Depende de colunas:** `'dim_statement_financial'[account_id]`  
```dax
VAR Account = SELECTEDVALUE('dim_statement_financial'[account_id])
RETURN
SWITCH(
    Account,
    "units_sold", "#,##0",
    "margin_1", "0.00%",
    "margin_2", "0.00%",
    "margin_3", "0.00%",
    "margin_4", "0.00%",
    "margin_4_1", "0.00%",
    "margin_5", "0.00%",
    "net_margin", "0.00%",
    "#,##0.00 ; (#,##0.00)"
)
```


### Statements - % Financial Shares\2. Net Sales

#### `%_product_refunds_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_product_refunds]`  
```dax
VAR _division = DIVIDE( -[$_product_refunds], [$_net_sales] ) 

RETURN
    _division
```


### Statements - % Financial Shares\3. Operational Expenses\CM 1 - COGS

#### `%_cogs_net_of_refunds_over_net_sales`

**Depende de medidas:** `[$_cogs_net_of_refunds]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_cogs_net_of_refunds], [$_net_sales] )

RETURN
    _division
```

#### `%_contribution_margin_1_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_1]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_1], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\3. Operational Expenses\CM 2 - Cost of Sales

#### `%_selling_fees_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_selling_fees]`  
```dax
VAR _division = DIVIDE( -[$_selling_fees], [$_net_sales] )

RETURN
    _division
```

#### `%_fulfillment_fee_over_net_sales`

**Depende de medidas:** `[$_fulfillment_fee]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_fulfillment_fee], [$_net_sales])

RETURN
    _division
```

#### `%_shipping_credits_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_shipping_credits]`  
```dax
VAR _division = DIVIDE( -[$_shipping_credits], [$_net_sales])

RETURN
    _division
```

#### `%_giftwrap_credits_over_net_sales`

**Depende de medidas:** `[$_giftwrap_credits]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_giftwrap_credits], [$_net_sales])

RETURN
    _division
```

#### `%_contribution_margin_2_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_2]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_2], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\3. Operational Expenses\CM 3 - Sponsored Ads

#### `%_sponsored_product_spend_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_sponsored_product_spend]`  
```dax
VAR _division = DIVIDE( -[$_sponsored_product_spend], [$_net_sales] )

RETURN
    _division
```

#### `%_sponsored_brands_spend_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_sponsored_brands_spend]`  
```dax
VAR _division = DIVIDE( -[$_sponsored_brands_spend], [$_net_sales] )

RETURN
    _division
```

#### `%_sponsored_display_spend_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_sponsored_display_spend]`  
```dax
VAR _division = DIVIDE( -[$_sponsored_display_spend], [$_net_sales] )

RETURN
    _division
```

#### `%_contribution_margin_3_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_3]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_3], [$_net_sales] )

RETURN
    _division
```

#### `%_contribution_margin_3_normalized_by_amazon_family_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_3_normalized_by_amazon_family]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_3_normalized_by_amazon_family], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\3. Operational Expenses\CM 4 - Fixed Costs

#### `%_amz_storage_fee_over_net_sales`

**Depende de medidas:** `[$_amz_storage_fee]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_amz_storage_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_awd_storage_fee_over_net_sales`

**Depende de medidas:** `[$_awd_storage_fee_actual]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_awd_storage_fee_actual], [$_net_sales] )

RETURN
    _division
```

#### `%_awd_processing_transportation_fees_over_net_sales`

**Depende de medidas:** `[$_awd_processing_transportation_fees]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_awd_processing_transportation_fees], [$_net_sales] )

RETURN
    _division
```

#### `%_amz_awd_storage_fees_over_net_sales`

**Depende de medidas:** `[$_amz_awd_storage_fees]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_amz_awd_storage_fees], [$_net_sales])

RETURN
    _division
```

#### `%_amz_long_term_storage_fee_over_net_sales`

**Depende de medidas:** `[$_amz_long_term_storage_fee_actual]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_amz_long_term_storage_fee_actual], [$_net_sales] )

RETURN
    _division
```

#### `%_returns_processing_fee_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_returns_processing_fee]`  
```dax
VAR _division = DIVIDE( -[$_returns_processing_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_adjustments_over_net_sales`

**Depende de medidas:** `[$_adjustments]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_adjustments], [$_net_sales] )

RETURN
    _division
```

#### `%_landed_cost_on_adjustment_over_net_sales`

**Depende de medidas:** `[$_landed_cost_on_adjustment]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_landed_cost_on_adjustment], [$_net_sales] )

RETURN
    _division
```

#### `%_removal_order_fee_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_removal_order_fee]`  
```dax
VAR _division = DIVIDE( -[$_removal_order_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_contribution_margin_4_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_4]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_4], [$_net_sales] )

RETURN
    _division
```

#### `%_contribution_margin_4_normalized_by_amazon_family_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_4_normalized_by_amazon_family]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_4_normalized_by_amazon_family], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\3. Operational Expenses\CM 5 - Non-Apportioned Costs

#### `%_contribution_margin_4_1_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_4_1], [$_net_sales] )

RETURN
    _division
```

#### `%_vat_gb_eu_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_vat_gb_eu]`  
```dax
VAR _division = DIVIDE( -[$_vat_gb_eu], [$_net_sales] )

RETURN
    _division
```

#### `%_subscription_fee_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_subscription_fee]`  
```dax
VAR _division = DIVIDE( -[$_subscription_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_coupon_fee_over_net_sales`

**Depende de medidas:** `[$_coupon_fee]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_coupon_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_deal_fee_over_net_sales`

**Depende de medidas:** `[$_deal_fee]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_deal_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_grade_and_resell_fee_over_net_sales`

**Depende de medidas:** `[$_grade_and_resell_fee]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_grade_and_resell_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_fee_adjustment_over_net_sales`

**Depende de medidas:** `[$_fee_adjustment]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_fee_adjustment], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\4. Local Costs

#### `%_photograph_cost_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_photograph_cost]`  
```dax
VAR _division = DIVIDE( -[$_photograph_cost], [$_net_sales] )

RETURN
    _division
```

#### `%_logistic_storage_3PL_cost_over_net_sales`

**Depende de medidas:** `[$_logistic_storage_3pl_cost]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_logistic_storage_3pl_cost], [$_net_sales] )

RETURN
    _division
```

#### `%_professional_service_fee_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_professional_service_fee]`  
```dax
VAR _division = DIVIDE( -[$_professional_service_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_bank_fee_over_net_sales`

**Depende de medidas:** `[$_bank_fee]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_bank_fee], [$_net_sales] )

RETURN
    _division
```

#### `%_training_education_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_training_education]`  
```dax
VAR _division = DIVIDE( -[$_training_education], [$_net_sales] )

RETURN
    _division
```

#### `%_marketing_services_over_net_sales`

**Depende de medidas:** `[$_marketing_services]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_marketing_services], [$_net_sales] )

RETURN
    _division
```

#### `%_local_cost_over_net_sales`

**Depende de medidas:** `[$_local_cost]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_local_cost], [$_net_sales] )

RETURN
    _division
```

#### `%_contribution_margin_5_over_net_sales`

**Depende de medidas:** `[$_contribution_margin_5]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( [$_contribution_margin_5], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\5. Total general & ADM

#### `%_wages_cost_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_wages_cost]`  
```dax
VAR _division = DIVIDE( -[$_wages_cost], [$_net_sales] )

RETURN
    _division
```

#### `%_fixed_cost_over_net_sales`

**Depende de medidas:** `[$_fixed_cost]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_fixed_cost], [$_net_sales] )

RETURN
    _division
```

#### `%_office_cost_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_office_cost]`  
```dax
VAR _division = DIVIDE( -[$_office_cost], [$_net_sales] )

RETURN
    _division
```

#### `%_adjustments_credit_card_over_net_sales`

**Depende de medidas:** `[$_adjustments_credit_card]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE( -[$_adjustments_credit_card], [$_net_sales] )

RETURN
    _division
```

#### `%_total_general_and_administrative_costs_over_net_sales`

**Depende de medidas:** `[$_net_sales]`, `[$_total_general_and_administrative_costs]`  
```dax
VAR _division = DIVIDE( -[$_total_general_and_administrative_costs], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\6. Net Income

#### `%_net_income_over_net_sales`

**Depende de medidas:** `[$_net_income]`, `[$_net_sales]`  
```dax
VAR _division = DIVIDE ( [$_net_income], [$_net_sales] )

RETURN
    _division
```


### Statements - % Financial Shares\Statements

#### `%_statement_financial`

**Depende de medidas:** `[$_cogs_per_unit_sold]`, `[$_contribution_margin_1]`, `[$_contribution_margin_2]`, `[$_contribution_margin_3]`, `[$_contribution_margin_4]`, `[$_fulfillment_fee_per_unit_sold]`, `[$_gross_sales]`, `[$_gst_canada_installment_credits]`, `[$_net_average_price]`, `[$_net_income]`, `[$_net_sales]`, `[$_operational_profit]`, `[$_product_refunds]`, `[$_product_sales]`, `[$_promotional_rebates]`, `[$_taxes_collected]`, `[$_taxes_refunded]`, `[$_taxes_withheld]`, `[%_adjustments_credit_card_over_net_sales]`, `[%_adjustments_over_net_sales]`, `[%_amz_long_term_storage_fee_over_net_sales]`, `[%_amz_storage_fee_over_net_sales]`, `[%_awd_processing_transportation_fees_over_net_sales]`, `[%_awd_storage_fee_over_net_sales]`, `[%_bank_fee_over_net_sales]`, `[%_cogs_net_of_refunds_over_net_sales]`, `[%_coupon_fee_over_net_sales]`, `[%_deal_fee_over_net_sales]`, `[%_fee_adjustment_over_net_sales]`, `[%_fixed_cost_over_net_sales]`, `[%_fulfillment_fee_over_net_sales]`, `[%_giftwrap_credits_over_net_sales]`, `[%_grade_and_resell_fee_over_net_sales]`, `[%_landed_cost_on_adjustment_over_net_sales]`, `[%_local_cost_over_net_sales]`, `[%_logistic_storage_3PL_cost_over_net_sales]`, `[%_marketing_services_over_net_sales]`, `[%_net_margin]`, `[%_office_cost_over_net_sales]`, `[%_operational_margin]`, `[%_photograph_cost_over_net_sales]`, `[%_professional_service_fee_over_net_sales]`, `[%_removal_order_fee_over_net_sales]`, `[%_returns_processing_fee_over_net_sales]`, `[%_selling_fees_over_net_sales]`, `[%_shipping_credits_over_net_sales]`, `[%_sponsored_brands_spend_over_net_sales]`, `[%_sponsored_display_spend_over_net_sales]`, `[%_sponsored_product_spend_over_net_sales]`, `[%_subscription_fee_over_net_sales]`, `[%_total_general_and_administrative_costs_over_net_sales]`, `[%_training_education_over_net_sales]`, `[%_vat_gb_eu_over_net_sales]`, `[%_wages_cost_over_net_sales]`, `[u_units_sold]`  
**Depende de colunas:** `'dim_statement_financial'[account_id]`  
```dax
VAR CurrentAccount = SELECTEDVALUE('dim_statement_financial'[account_id])
VAR Amount = 
    SWITCH(
        SELECTEDVALUE('dim_statement_financial'[account_id]),
        "units_sold",                  FORMAT( [u_units_sold],                              "#,##0" ),
        "net_average_price",           FORMAT( [$_net_average_price],                       "#,##0.00 ; (#,##0.00)" ),     
        "fulfillment_fees_per_unit",   FORMAT( [$_fulfillment_fee_per_unit_sold],           "#,##0.00 ; (#,##0.00)" ),
        "cogs_per_unit",               FORMAT( [$_cogs_per_unit_sold],                      "#,##0.00 ; (#,##0.00)" ),


    // // SALES
    //     "product_sales",               FORMAT( [$_product_sales],                           "#,##0.00 ; (#,##0.00)" ),
    //     "promo_rebates",               FORMAT( [$_promotional_rebates],                     "#,##0.00 ; (#,##0.00)" ),
    //     "taxes_collected",             FORMAT( [$_taxes_collected],                         "#,##0.00 ; (#,##0.00)" ),
    //     "gross_sales",                 FORMAT( [$_gross_sales],                             "#,##0.00 ; (#,##0.00)" ),
        
    //     "product_refunds",             FORMAT( [$_product_refunds],                         "#,##0.00 ; (#,##0.00)" ),
    //     "taxes_refunded",              FORMAT( [$_taxes_refunded],                          "#,##0.00 ; (#,##0.00)" ),
    //     "taxes_withheld",              FORMAT( [$_taxes_withheld],                          "#,##0.00 ; (#,##0.00)" ),
    //     "gst_installment_credits",     FORMAT( [$_gst_canada_installment_credits],          "#,##0.00 ; (#,##0.00)" ),
    //     "net_sales",                   FORMAT( [$_net_sales],                               "#,##0.00 ; (#,##0.00)" ),    


    // // OPERATIONAL EXPENSES
        "cogs_net_of_refunds",         FORMAT( [%_cogs_net_of_refunds_over_net_sales],                     "percent" ),
    //     "cm_1",                        FORMAT( [$_contribution_margin_1],                   "#,##0.00 ; (#,##0.00)" ),


        "selling_fees",                FORMAT( [%_selling_fees_over_net_sales],                         "percent" ),
        "fulfillment_fees",            FORMAT( [%_fulfillment_fee_over_net_sales],                      "percent" ),
        "shipping_credits",            FORMAT( [%_shipping_credits_over_net_sales],                     "percent" ),
        "giftWrap_credits",            FORMAT( [%_giftwrap_credits_over_net_sales],                     "percent" ),
    //     "cm_2",                        FORMAT( [$_contribution_margin_2],                   "#,##0.00 ; (#,##0.00)" ),


        "sponsored_products",          FORMAT( [%_sponsored_product_spend_over_net_sales],              "percent" ),
        "sponsored_brands",            FORMAT( [%_sponsored_brands_spend_over_net_sales],               "percent" ),
        "sponsored_display",           FORMAT( [%_sponsored_display_spend_over_net_sales],              "percent" ),
    //     "cm_3",                        FORMAT( [$_contribution_margin_3],                   "#,##0.00 ; (#,##0.00)" ),

    
        "amz_storage_fee",             FORMAT( [%_amz_storage_fee_over_net_sales],                     "percent" ),
        "amz_long_term_storage_fee",   FORMAT( [%_amz_long_term_storage_fee_over_net_sales],           "percent" ),
        "awd_storage_fee",             FORMAT( [%_awd_storage_fee_over_net_sales],                     "percent" ),
        "awd_proces_and_transp_fees",  FORMAT( [%_awd_processing_transportation_fees_over_net_sales],  "percent" ),
        "returns_processing_fees",     FORMAT( [%_returns_processing_fee_over_net_sales],              "percent" ),
        "adjustments",                 FORMAT( [%_adjustments_over_net_sales],                         "percent" ),
        "landed_cost_on_adjustments",  FORMAT( [%_landed_cost_on_adjustment_over_net_sales],           "percent" ),
        "removal_orders",              FORMAT( [%_removal_order_fee_over_net_sales],                   "percent" ),
    //     "cm_4",                        FORMAT( [$_contribution_margin_4],                   "#,##0.00 ; (#,##0.00)" ),


        "vat_gb_eu",                   FORMAT( [%_vat_gb_eu_over_net_sales],                           "percent" ),
        "subscription_fee",            FORMAT( [%_subscription_fee_over_net_sales],                    "percent" ),
        "coupon_fee",                  FORMAT( [%_coupon_fee_over_net_sales],                          "percent" ),
        "deal_fee",                    FORMAT( [%_deal_fee_over_net_sales],                            "percent" ),
        "grade_and_resell",            FORMAT( [%_grade_and_resell_fee_over_net_sales],                "percent" ),
        "fee_adjustment",              FORMAT( [%_fee_adjustment_over_net_sales],                      "percent" ),
    //     "operational_profit",          FORMAT( [$_operational_profit],                      "#,##0.00 ; (#,##0.00)"),
    //     "operational_margin",          FORMAT( [%_operational_margin],                      "percent"),

    // OTHER EXPENSES
        "photographer",                FORMAT( [%_photograph_cost_over_net_sales],                         "percent"),
        "logistic_storage_3pl",        FORMAT( [%_logistic_storage_3PL_cost_over_net_sales],               "percent"),
        "professional_service_fee",    FORMAT( [%_professional_service_fee_over_net_sales],                "percent"),
        "bank_fee",                    FORMAT( [%_bank_fee_over_net_sales],                                "percent"),
        "training_and_education",      FORMAT( [%_training_education_over_net_sales],                      "percent"),
        "marketing_services",          FORMAT( [%_marketing_services_over_net_sales],                      "percent"),
        "local_costs",                 FORMAT( [%_local_cost_over_net_sales],                              "percent"),

        "wages",                       FORMAT( [%_wages_cost_over_net_sales],                              "percent"),
        "fixed_costs_credit_card",     FORMAT( [%_fixed_cost_over_net_sales],                              "percent"),
        "office_fixed_costs_roi",      FORMAT( [%_office_cost_over_net_sales],                             "percent"),
        "adjustments_credit_card)",    FORMAT( [%_adjustments_credit_card_over_net_sales],                 "percent"),
        "total_general_and_adm",       FORMAT( [%_total_general_and_administrative_costs_over_net_sales],  "percent"),

    // // NET INCOME
    //     "net_income",                  FORMAT( [$_net_income],                              "#,##0.00 ; (#,##0.00)"),
    //     "net_margin",                  FORMAT( [%_net_margin],                              "percent"),
    BLANK()
)

RETURN
    Amount
```


### UX / UI\Chart Axis

#### `%_ui_margin_comparisson_max_value_y_axis`

**Depende de medidas:** `[%_operational_profit_over_product_sales]`, `[%_operational_profit_over_product_sales_annual]`, `[%_operational_profit_over_product_sales_annual_last_year]`, `[%_operational_profit_over_product_sales_last_year]`  
**Depende de colunas:** `'Calendar'[Quarter - Year]`  
```dax
VAR _quarters_selected = ALLSELECTED('Calendar'[Quarter - Year])

    VAR _margin = MAXX( _quarters_selected, [%_operational_profit_over_product_sales])
    VAR _margin_annual = MAXX( _quarters_selected, [%_operational_profit_over_product_sales_annual])
    VAR _margin_last_year = MAXX( _quarters_selected, [%_operational_profit_over_product_sales_last_year])
    VAR _margin_annual_last_year = MAXX( _quarters_selected, [%_operational_profit_over_product_sales_annual_last_year])

    VAR _max_value = 
        MAX( 
            MAX(_margin, _margin_annual), 
            MAX(_margin_last_year, _margin_annual_last_year) 
        )

RETURN 
    CEILING( _max_value + 1e-7, 0.05 )
```

#### `%_ui_margin_comparisson_min_value_y_axis`

**Depende de medidas:** `[%_operational_profit_over_product_sales]`, `[%_operational_profit_over_product_sales_annual]`, `[%_operational_profit_over_product_sales_annual_last_year]`, `[%_operational_profit_over_product_sales_last_year]`  
**Depende de colunas:** `'Calendar'[Quarter - Year]`  
```dax
VAR _quarters_selected = ALLSELECTED('Calendar'[Quarter - Year])

    VAR _margin = MINX( _quarters_selected, [%_operational_profit_over_product_sales])
    VAR _margin_annual = MINX( _quarters_selected, [%_operational_profit_over_product_sales_annual])
    VAR _margin_last_year = MINX( _quarters_selected, [%_operational_profit_over_product_sales_last_year])
    VAR _margin_annual_last_year = MINX( _quarters_selected, [%_operational_profit_over_product_sales_annual_last_year])

    VAR _min_value = 
        MIN( 
            MIN(_margin, _margin_annual), 
            MIN(_margin_last_year, _margin_annual_last_year) 
        )

RETURN 
    IF(
        _min_value >= 0
        , 0
        , FLOOR( _min_value - 1e-7, 0.05 )
    )
```


### UX / UI\Highlights Flags

#### `statements_highlight_flag`

**Depende de colunas:** `dim_statement_commercial[highlight]`, `dim_statement_financial[highlight]`  
```dax
COALESCE (
    SELECTEDVALUE ( dim_statement_financial[highlight] ),
    SELECTEDVALUE ( dim_statement_commercial[highlight] ),
    0
)
```


### UX / UI\Message Warnings

#### `ui_storage_fee_status`

**Depende de colunas:** `fact_estimated_future_daily_storage_fee[date]`  
```dax
VAR _min_date = FORMAT(MIN(fact_estimated_future_daily_storage_fee[date]), "YYYY-MM-DD" )
    VAR _max_date = FORMAT(MAX(fact_estimated_future_daily_storage_fee[date]), "YYYY-MM-DD" )

RETURN
    SWITCH(
        TRUE()
        , _min_date = "" || _max_date = "", BLANK()
        , _min_date = _max_date, "📅 The Amazon Storage Fee was estimated for the date " & _min_date 
        , "📅 The Amazon Storage Fee was estimated for the period from " & _min_date & " to " & _max_date
    )
```


### UX / UI\Symboll & Icons

#### `x_arrow_up`

```dax
UNICHAR(9650)
```

#### `x_arrow_down`

```dax
UNICHAR(9660)
```


### UX / UI\Tooltips

#### `ui_tooltip_amz_awd_storage_fee`

```dax
"<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>  
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: transparent;
            font-family: Arial, sans-serif;
        }

        .tooltip {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            padding: 3px 6px;
            border-radius: 0 0 10px 10px;
            background-color: #3f4b57;
            color: #fff;
            font-size: 10px;
            white-space: normal;
            word-wrap: break-word;
            max-width: 100%;
            opacity: 0;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.7s ease, opacity 0.7s ease;
        }

        body:hover .tooltip {
            max-height: 60px;
            opacity: 1;
        }
    </style>
</head>

<body>
    <div class='tooltip'>
        Includes both Amazon & AWD Storage Fees divided by Product Sales
    </div>
</body>
</html>"
```

#### `ui_tooltip_awd_processing_transportation_fees`

```dax
"<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>  
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: transparent;
            font-family: Arial, sans-serif;
        }

        .tooltip {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            padding: 3px 6px;
            border-radius: 0 0 10px 10px;
            background-color: #3f4b57;
            color: #fff;
            font-size: 10px;
            white-space: normal;
            word-wrap: break-word;
            max-width: 100%;
            opacity: 0;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.7s ease, opacity 0.7s ease;
        }

        body:hover .tooltip {
            max-height: 60px;
            opacity: 1;
        }
    </style>
</head>

<body>
    <div class='tooltip'>
        Includes both AWD Processing and AWD Transportration Fee divided by Product Sales
    </div>
</body>
</html>"
```


### UX / UI\YOY

#### `ui_%_net_average_price_yoy`

**Depende de medidas:** `[%_net_average_price_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _nap_yoy = [%_net_average_price_yoy]
    VAR _arrow = SWITCH( TRUE(), _nap_yoy > 0, [x_arrow_up], _nap_yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _nap_yoy, "#0.0%" ) & _arrow
```

#### `ui_%_net_sales_yoy`

**Depende de medidas:** `[%_net_sales_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_net_sales_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0%" ) & _arrow
```

#### `ui_%_units_sold_yoy`

**Depende de medidas:** `[%_units_sold_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_units_sold_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0%" ) & _arrow
```

#### `ui_%_operational_profit_yoy`

**Depende de medidas:** `[%_operational_profit_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_operational_profit_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0%" ) & _arrow
```

#### `ui_%_operational_margin_yoy`

**Depende de medidas:** `[%_operational_margin_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_operational_margin_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_net_margin_yoy`

**Depende de medidas:** `[%_net_margin_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_net_margin_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_cogs_margin_yoy`

**Depende de medidas:** `[%_cogs_margin_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_cogs_margin_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_fulfillment_fee_margin_yoy`

**Depende de medidas:** `[%_fulfillment_fee_margin_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_fulfillment_fee_margin_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_tacos_yoy`

**Depende de medidas:** `[%_tacos_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_tacos_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_product_refunds_yoy`

**Depende de medidas:** `[%_product_refunds_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_product_refunds_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_amz_storage_fee_yoy`

**Depende de medidas:** `[%_amz_storage_fee_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_amz_storage_fee_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_amz_awd_storage_fees_over_product_sales_yoy`

**Depende de medidas:** `[%_amz_awd_storage_fees_over_product_sales_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_amz_awd_storage_fees_over_product_sales_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```

#### `ui_%_awd_processing_transportation_fees_over_product_sales_yoy`

**Depende de medidas:** `[%_awd_processing_transportation_fees_over_product_sales_yoy]`, `[x_arrow_down]`, `[x_arrow_up]`  
```dax
VAR _yoy = [%_awd_processing_transportation_fees_over_product_sales_yoy]
    VAR _arrow = SWITCH( TRUE(), _yoy > 0, [x_arrow_up], _yoy < 0, [x_arrow_down] )

RETURN
    FORMAT( _yoy, "#0.0pp" ) & _arrow
```


### metadata

#### `Last Refresh Datetime`

**Depende de colunas:** `zz_Refresh_Control[LastRefresh]`  
```dax
MAX(zz_Refresh_Control[LastRefresh])
```


### over_product_sales

#### `%_promotional_rebates_plus_shipping_credits_over_product_sales`

**Depende de medidas:** `[$_product_sales]`, `[$_promotional_rebates_plus_shipping_credits]`  
```dax
var valor1 = -([$_promotional_rebates_plus_shipping_credits])

RETURN
DIVIDE(valor1,[$_product_sales])
```

#### `%_tacos`

**Depende de medidas:** `[$_product_sales]`, `[$_total_sponsored_ads_spend]`  
```dax
VAR _division = DIVIDE( -[$_total_sponsored_ads_spend], [$_product_sales] )

RETURN
    _division
```

#### `%_tacos_amazon_family`

**Depende de medidas:** `[$_product_sales]`, `[%_tacos]`  
**Depende de colunas:** `SKUs[Native Family]`, `SKUs[SKU]`  
```dax
VAR _sales =  [$_product_sales]
    VAR _tacos_amazon_family =
        IF(
            _sales > 0
            , CALCULATE( [%_tacos], ALL( SKUs[SKU], SKUs[Native Family]) )
            , BLANK()
        )

RETURN
    _tacos_amazon_family
```

#### `%_partial_operational_profit_normalized_by_amazon_family_over_product_sales`

**Depende de medidas:** `[$_partial_operational_profit_normalized_by_amazon_family]`, `[$_product_sales]`  
```dax
VAR _result = DIVIDE([$_partial_operational_profit_normalized_by_amazon_family],[$_product_sales],0)

RETURN
    _result
```


### over_product_sales\Yoy

#### `%_net_sales_yoy`

**Depende de medidas:** `[$_net_sales]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _current_value = [$_net_sales]
    VAR _last_year_value = CALCULATE( [$_net_sales], SAMEPERIODLASTYEAR( 'Calendar'[Date] ) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value ) - 1
    
RETURN
    _yoy
```

#### `%_tacos_yoy`

**Depende de medidas:** `[%_TACOS_familia]`, `[Date]`  
```dax
VAR _current_value = [%_TACOS_familia]
    VAR _last_year_value = CALCULATE( [%_TACOS_familia], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = (_current_value - _last_year_value) * 100

RETURN
    _yoy
```

#### `%_units_sold_yoy`

**Depende de medidas:** `[Date]`, `[u_units_sold]`  
```dax
VAR _current_value = [u_units_sold]
    VAR _last_year_value = CALCULATE( [u_units_sold], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value ) - 1

RETURN
    _yoy
```

#### `%_net_average_price_yoy`

**Depende de medidas:** `[$_net_average_price]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _current_value = [$_net_average_price]
    VAR _last_year_value = CALCULATE( [$_net_average_price], SAMEPERIODLASTYEAR( 'Calendar'[Date]) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value)  - 1

RETURN
    _yoy
```

#### `%_operational_profit_yoy`

**Depende de medidas:** `[$_contribution_margin_4_1]`, `[Date]`  
```dax
VAR _current_value = [$_contribution_margin_4_1]
    VAR _last_year_value = CALCULATE( [$_contribution_margin_4_1], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value ) - 1

RETURN
    _yoy
```

#### `%_operational_margin_yoy`

**Depende de medidas:** `[%_contribution_margin_4_1_over_net_sales]`, `[Date]`  
```dax
VAR _current_value = [%_contribution_margin_4_1_over_net_sales]
    VAR _last_year_value = CALCULATE( [%_contribution_margin_4_1_over_net_sales], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = (_current_value - _last_year_value) * 100

RETURN
    _yoy
```

#### `%_net_margin_yoy`

**Depende de medidas:** `[%_net_income_over_net_sales]`, `[Date]`  
```dax
VAR _current_value = [%_net_income_over_net_sales]
    VAR _last_year_value = CALCULATE( [%_net_income_over_net_sales], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = (_current_value - _last_year_value) * 100

RETURN
    _yoy
```

#### `%_cogs_margin_yoy`

**Depende de medidas:** `[%_cogs_net_of_refunds_over_net_sales]`, `[Date]`  
```dax
VAR _current_value = [%_cogs_net_of_refunds_over_net_sales]
    VAR _last_year_value = CALCULATE( [%_cogs_net_of_refunds_over_net_sales], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = (_current_value - _last_year_value) * 100

RETURN
    _yoy
```

#### `%_fulfillment_fee_margin_yoy`

**Depende de medidas:** `[%_fulfillment_fee_over_net_sales]`, `[Date]`  
```dax
VAR _current_value = [%_fulfillment_fee_over_net_sales]
    VAR _last_year_value = CALCULATE( [%_fulfillment_fee_over_net_sales], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = (_current_value - _last_year_value) * 100

RETURN
    _yoy
```

#### `%_product_refunds_yoy`

**Depende de medidas:** `[$_product_refunds]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _current_value = [$_product_refunds]
    VAR _last_year_value = CALCULATE( [$_product_refunds], SAMEPERIODLASTYEAR( 'Calendar'[Date] ) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value ) - 1
    
RETURN
    _yoy
```

#### `%_amz_awd_storage_fees_over_product_sales_yoy`

**Depende de medidas:** `[%_amz_awd_storage_fees_over_net_sales]`, `[Date]`  
```dax
VAR _current_value = [%_amz_awd_storage_fees_over_net_sales]
    VAR _last_year_value = CALCULATE( [%_amz_awd_storage_fees_over_net_sales], SAMEPERIODLASTYEAR( 'Calendar' [Date] ) )
    VAR _yoy = (_current_value - _last_year_value) * 100

RETURN
    _yoy
```

#### `%_awd_processing_transportation_fees_over_product_sales_yoy`

**Depende de medidas:** `[%_awd_processing_transportation_fees_over_net_sales]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _current_value = [%_awd_processing_transportation_fees_over_net_sales]
    VAR _last_year_value = CALCULATE( [%_awd_processing_transportation_fees_over_net_sales], SAMEPERIODLASTYEAR( 'Calendar'[Date] ) )
    VAR _yoy = DIVIDE( _current_value, _last_year_value ) - 1
    
RETURN
    _yoy
```


## Fontes das Tabelas (34 tabelas)


### `Average Freight Cost`

**Modo:** `import`  **Grupo:** `'STAGING\New Landed Cost'`  
**Colunas:** `key_inventory_region_sku` string, `currency` string, `date` dateTime, `freight_unit_cost` double  
```powerquery
let
    Source = Excel.Workbook(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\Average Freight Cost - Base SKU.xlsx"), null, true),
    DataBase_Sheet = Source{[Item="DataBase",Kind="Sheet"]}[Data],
    promoted_headers = Table.PromoteHeaders(DataBase_Sheet, [PromoteAllScalars=true]),

    filtered_out_base_sku_wording = Table.SelectRows(promoted_headers, each ([Base SKU] <> "Base SKU")),
    
    // Initial Data Treatment and Standardization
    change_type_full_table = Table.TransformColumnTypes(filtered_out_base_sku_wording,{{"Base SKU", type text}, {"Date", type date}, {"Inventory Region", type text}, {"u_inventory", Int64.Type}, {"$_inventory", type number}, {"unit_cost", type number}}),
    fltered_out_empty = Table.SelectRows(change_type_full_table, each [Date] <> null and [Date] <> ""),
    round_unit_cost = Table.TransformColumns(fltered_out_empty,{{"unit_cost", each Number.RoundUp(_, 2), type number}}),
    added_key_inventory_region_base_sku = Table.AddColumn(round_unit_cost, "key_inventory_region_sku", each [Inventory Region] & " | " & [Base SKU], type text),
    added_currency = Table.AddColumn(added_key_inventory_region_base_sku, "currency", each 
        if [Inventory Region] = "US" then "USD"
        else if [Inventory Region] = "CA" then "CAD"
        else if [Inventory Region] = "EU" then "EUR"
        else if [Inventory Region] = "GB" then "GBP"
        else null, type text
    ),
    select_main_columns = Table.SelectColumns(added_currency,{"Date", "key_inventory_region_sku", "currency", "unit_cost"}),
    /* 
        Fill data for 2021
        Assume that for the year of 2021 the landed cost will be 
        the first landed cost recorded for each sku

        Some sales recorded in  payments/22 were actually made in 2021
    */

    // Group rows for getting range
    grouped_for_min_max_dates = Table.Group(select_main_columns, {"key_inventory_region_sku", "currency"}, {{ "min_date", each List.Min([Date]), type date}, {"max_date", each List.Max([Date]), type date}} ),


    data_2021 = Table.NestedJoin(grouped_for_min_max_dates, {"key_inventory_region_sku", "min_date"}, select_main_columns, {"key_inventory_region_sku", "Date"}, "Data", JoinKind.LeftOuter),
    ___expanded_data_2021 = Table.ExpandTableColumn(data_2021, "Data", {"unit_cost"}, {"unit_cost"}),
    ___added_date_list_2021 = Table.AddColumn(___expanded_data_2021, "date",  each 
        let
            _min_date = Date.FromText("2021-01-01"),
            _max_date = Date.AddDays([min_date],-1 ),
            _duration = Duration.Days(_max_date - _min_date) + 1,
            _date_list = List.Dates(_min_date, _duration, #duration(1,0,0,0))

        in
            _date_list
        , type {date} 
    ),
    ___expanded_date_list_2021 = Table.ExpandListColumn(___added_date_list_2021, "date"),
    ___select_2021_column = Table.SelectColumns(___expanded_date_list_2021,{"key_inventory_region_sku", "currency", "date", "unit_cost"}),


    /* 
        Get data starting from 2022
    */
    // Create list of dates up today
    added_date_list = Table.AddColumn(grouped_for_min_max_dates, "date",  each List.Dates([min_date], Duration.Days(Date.From(DateTime.LocalNow()) - [min_date]) + 1, #duration(1,0,0,0)), type {date} ),
    ___expanded_date_list = Table.ExpandListColumn(added_date_list, "date"),
    ___select_grouped_columns = Table.SelectColumns(___expanded_date_list,{"key_inventory_region_sku", "currency", "date"}),
    
    // Get the landed cost
    merged_grouped_main = Table.NestedJoin(___select_grouped_columns, {"key_inventory_region_sku", "date"}, select_main_columns, {"key_inventory_region_sku", "Date"}, "Data", JoinKind.LeftOuter),
    expanded_grouped_main = Table.ExpandTableColumn(merged_grouped_main, "Data", {"unit_cost"}, {"unit_cost"}),

    // Fill Dates originaly missing data
    sorted_key_date = Table.Sort(expanded_grouped_main,{{"key_inventory_region_sku", Order.Ascending}, {"date", Order.Ascending}}),
    filled_down_unit_cost = Table.FillDown(sorted_key_date,{"unit_cost"}),

    full_data = Table.Combine({filled_down_unit_cost, ___select_2021_column}),
    #"Renamed Columns" = Table.RenameColumns(full_data,{{"unit_cost", "freight_unit_cost"}})
in
    #"Renamed Columns"
```


### `Average Purchase Cost`

**Modo:** `import`  **Grupo:** `'STAGING\New Landed Cost'`  
**Colunas:** `key_inventory_region_sku` string, `currency` string, `date` dateTime, `purchase_unit_cost` double  
```powerquery
let
    // Folder Extraction
    Source = Excel.Workbook(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\Average Purchase Cost - Base SKU.xlsx"), null, true),
    DataBase_Sheet = Source{[Item="DataBase",Kind="Sheet"]}[Data], 
    
    // Transformations Necessary due to folder extratcion
    promoted_headers = Table.PromoteHeaders(DataBase_Sheet, [PromoteAllScalars=true]),
    filtered_out_base_sku_wording = Table.SelectRows(promoted_headers, each ([Base SKU] <> "Base SKU")),
    
    // Initial Data Treatment and Standardization
    change_type_full_table = Table.TransformColumnTypes(filtered_out_base_sku_wording,{{"Base SKU", type text}, {"Date", type date}, {"Inventory Region", type text}, {"u_inventory", Int64.Type}, {"$_inventory", type number}, {"unit_cost", type number}}),
    fltered_out_empty = Table.SelectRows(change_type_full_table, each [Date] <> null and [Date] <> ""),
    round_unit_cost = Table.TransformColumns(fltered_out_empty,{{"unit_cost", each Number.RoundUp(_, 2), type number}}),
    added_key_inventory_region_base_sku = Table.AddColumn(round_unit_cost, "key_inventory_region_sku", each [Inventory Region] & " | " & [Base SKU], type text),
    added_currency = Table.AddColumn(added_key_inventory_region_base_sku, "currency", each 
        if [Inventory Region] = "US" then "USD"
        else if [Inventory Region] = "CA" then "CAD"
        else if [Inventory Region] = "EU" then "EUR"
        else if [Inventory Region] = "GB" then "GBP"
        else null, type text
    ),
    select_main_columns = Table.SelectColumns(added_currency,{"Date", "key_inventory_region_sku", "currency", "unit_cost"}),
    /* 
        Fill data for 2021
        Assume that for the year of 2021 the landed cost will be 
        the first landed cost recorded for each sku

        Some sales recorded in  payments/22 were actually made in 2021
    */

    // Group rows for getting range
    grouped_for_min_max_dates = Table.Group(select_main_columns, {"key_inventory_region_sku", "currency"}, {{ "min_date", each List.Min([Date]), type date}, {"max_date", each List.Max([Date]), type date}} ),


    data_2021 = Table.NestedJoin(grouped_for_min_max_dates, {"key_inventory_region_sku", "min_date"}, select_main_columns, {"key_inventory_region_sku", "Date"}, "Data", JoinKind.LeftOuter),
    ___expanded_data_2021 = Table.ExpandTableColumn(data_2021, "Data", {"unit_cost"}, {"unit_cost"}),
    ___added_date_list_2021 = Table.AddColumn(___expanded_data_2021, "date",  each 
        let
            _min_date = Date.FromText("2021-01-01"),
            _max_date = Date.AddDays([min_date],-1 ),
            _duration = Duration.Days(_max_date - _min_date) + 1,
            _date_list = List.Dates(_min_date, _duration, #duration(1,0,0,0))

        in
            _date_list
        , type {date} 
    ),
    ___expanded_date_list_2021 = Table.ExpandListColumn(___added_date_list_2021, "date"),
    ___select_2021_column = Table.SelectColumns(___expanded_date_list_2021,{"key_inventory_region_sku", "currency", "date", "unit_cost"}),


    /* 
        Get data starting from 2022
    */
    // Create list of dates up today
    added_date_list = Table.AddColumn(grouped_for_min_max_dates, "date",  each List.Dates([min_date], Duration.Days(Date.From(DateTime.LocalNow()) - [min_date]) + 1, #duration(1,0,0,0)), type {date} ),
    ___expanded_date_list = Table.ExpandListColumn(added_date_list, "date"),
    ___select_grouped_columns = Table.SelectColumns(___expanded_date_list,{"key_inventory_region_sku", "currency", "date"}),
    
    // Get the landed cost
    merged_grouped_main = Table.NestedJoin(___select_grouped_columns, {"key_inventory_region_sku", "date"}, select_main_columns, {"key_inventory_region_sku", "Date"}, "Data", JoinKind.LeftOuter),
    expanded_grouped_main = Table.ExpandTableColumn(merged_grouped_main, "Data", {"unit_cost"}, {"unit_cost"}),

    // Fill Dates originaly missing data
    sorted_key_date = Table.Sort(expanded_grouped_main,{{"key_inventory_region_sku", Order.Ascending}, {"date", Order.Ascending}}),
    filled_down_unit_cost = Table.FillDown(sorted_key_date,{"unit_cost"}),

    full_data = Table.Combine({filled_down_unit_cost, ___select_2021_column}),
    #"Renamed Columns" = Table.RenameColumns(full_data,{{"unit_cost", "purchase_unit_cost"}})
in
    #"Renamed Columns"
```


### `Calendar`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Date` dateTime, `Week Number 544` string, `Month Number 544` string, `Year 544` string, `Year-Week 544` string, `Year-Month 544` string, `Year` int64, `Month` int64, `Year-Month` string, `Start of Week` dateTime, `End of Week` dateTime, `Day of Week` int64, `Start of Month` dateTime, `Day of Month` int64, `Start of Quarter` dateTime, `Quarter` int64, `Start of Year` dateTime, `Quarter - Year` string  
```powerquery
let
    // Source = #"Tabela Final",
    // #"Removed Other Columns" = Table.SelectColumns(Source,{"Date"}),
    // #"Removed Duplicates" = Table.Distinct(#"Removed Other Columns"),
    #"MinDate" = Date.FromText("01/01/2018"),
    #"Max Date" = Date.AddDays(Date.From(DateTime.LocalNow()),0),
    #"Count of Days" = Duration.Days(#"Max Date"-MinDate)+1,
    #"List of Days" = List.Dates(MinDate,#"Count of Days",#duration(1,0,0,0)),
    #"Converted to Table" = Table.FromList(#"List of Days", Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Renamed Columns" = Table.RenameColumns(#"Converted to Table",{{"Column1", "Date"}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Columns",{{"Date", type date}}),
    #"Week Number 544" = Table.AddColumn(#"Changed Type", "Week Number 544", each if Date.WeekOfYear ( [Date] ) = 53 
then
   if Date.Year (Date.EndOfWeek ([Date])) <> Date.Year ([Date]) then 1 else 53

else Date.WeekOfYear([Date])),
    #"Month Number 544" = Table.AddColumn(#"Week Number 544", "Month Number 544", each let
   weeknum = [Week Number 544],
   monthnum = 
      if weeknum >= 1 and weeknum <= 5 then 1
      else if weeknum >= 6 and weeknum <= 9 then 2
      else if weeknum >= 10 and weeknum <= 13 then 3
      else if weeknum >= 14 and weeknum <= 18 then 4
      else if weeknum >= 19 and weeknum <= 22 then 5
      else if weeknum >= 23 and weeknum <= 26 then 6
      else if weeknum >= 27 and weeknum <= 31 then 7
      else if weeknum >= 32 and weeknum <= 35 then 8
      else if weeknum >= 36 and weeknum <= 39 then 9
      else if weeknum >= 40 and weeknum <= 44 then 10
      else if weeknum >= 45 and weeknum <= 48 then 11
      else 12
in
   monthnum),
    #"Year 544" = Table.AddColumn(#"Month Number 544", "Year 544", each if [Week Number 544] = 1 
then
   Date.Year (Date.EndOfWeek ([Date]))

else Date.Year ([Date])),
    #"Year-Week 544" = Table.AddColumn(#"Year 544", "Year-Week 544", each Text.Combine({Text.From([Year 544], "en-US"), "-", Text.PadStart(Text.From([Week Number 544], "en-US"), 2, "0")}), type text),
    #"Year-Month 544" = Table.AddColumn(#"Year-Week 544", "Year-Month 544", each Text.Combine({Text.From([Year 544], "en-US"), "-", Text.PadStart(Text.From([Month Number 544], "en-US"), 2, "0")}), type text),
    Year = Table.AddColumn(#"Year-Month 544", "Year", each Date.Year([Date]), Int64.Type),
    Month = Table.AddColumn(Year, "Month", each Date.Month([Date]), Int64.Type),
    #"Year-Month" = Table.AddColumn(Month, "Year-Month", each Text.Combine({Text.From([Year], "en-US"), Text.PadStart(Text.From([Month], "en-US"), 2, "0")}, "-"), type text),
    #"Start of Week" = Table.AddColumn(#"Year-Month", "Start of Week", each Date.StartOfWeek([Date]), type date),
    #"End of Week" = Table.AddColumn(#"Start of Week", "End of Week", each Date.EndOfWeek([Date]), type date),
    #"Day of Week" = Table.AddColumn(#"End of Week", "Day of Week", each Date.DayOfWeek([Date])+1, Int64.Type),
    #"Start of Month" = Table.AddColumn(#"Day of Week", "Start of Month", each Date.StartOfMonth([Date]), type date),
    #"Day of Month" = Table.AddColumn(#"Start of Month", "Day of Month", each Date.Day([Date]), Int64.Type),
    #"Start of Quarter" = Table.AddColumn(#"Day of Month", "Start of Quarter", each Date.StartOfQuarter([Start of Month]), type date),
    #"Inserted Quarter" = Table.AddColumn(#"Start of Quarter", "Quarter", each Date.QuarterOfYear([Date]), Int64.Type),
    Custom1 = Table.AddColumn(#"Inserted Quarter", "Start of Year", each Date.StartOfYear([Start of Quarter]), type date),
    #"Added Custom" = Table.AddColumn(Custom1, "Quarter - Year", each "Q"&Text.From([Quarter]) & " - " & Text.From([Year]))
in
    #"Added Custom"
```


### `Country`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Country` string, `BU` string  
```powerquery
let
    Source = Table.SelectColumns(#"SKUs",{"Country"}),
    #"Removed Duplicates" = Table.Distinct(Source),
    #"Added Custom" = Table.AddColumn(#"Removed Duplicates", "BU", each 
        if [Country] = "US" or [Country] = "MX" or [Country] = "BR" 
        then "US" 
        
        else if [Country]="CA" 
        then "CA" 
        
        else if [Country]="GB" 
        then "GB" 
        
        else "EU"
    )
in
    #"Added Custom"
```


### `dim_Final DRE-like`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Account Order` int64, `Account` string  
```powerquery
let
    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("dZJNb4MwDED/SoSEtGkVK9CvHatO7WnrVFb1UPWQQcoihQSFsMN+/eyErqCmF0T87NgvyfEYxMEo+NCqaHNDMipYE5xGxyCB6I6dW1m4dQrrsB+YuLJKkR37oqYrm0I0++Z1zWVJVpoV3DgwA7DhZ3PQtB6AOW482Ig8DRIWkPDO+rO9QMT+xGNsx4TAbmvW4RiNwtswKq22m8yt0m5F+lIxWoU2/GC/MMo159HloOO6FWcuRMWk6XVAydCPUHOlKqZzTgV5o7rk0pGFbelF/6KJFa2VbBScDFl24ybWlHgAui6rX5IZpWnJcBAH7D16CaovD6+3YGpLfGTWlcD15RGc1aemsqmja8L8Uno3A+23NdPUcCWH+gnqh3dgOr6cTYqHsJfwXEimROFi1v+njKAxz12rFNU3WjWNe0oENiZY5+ike2b2vofIc+HPjp7+AA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [#"Account Order" = _t, Account = _t]),
    #"Removed Other Columns" = Table.SelectColumns(Source,{"Account Order", "Account"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Removed Other Columns",{{"Account Order", Int64.Type}, {"Account", type text}})
in
    #"Changed Type"
```


### `dim_selector_currency`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Currency` string, `currency_order` int64  
```powerquery
let
    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i45W8slPTsxR0lEyVIrViVYKDXYBso3AbNfQICDbWCk2FgA=", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [Currency = _t, currency_order = _t]),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"currency_order", Int64.Type}})
in
    #"Changed Type"
```


### `dim_selector_date`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `selector_date_id` string, `selector_date_name` string, `selector_date_order` int64  
```powerquery
let
    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i45WSkksSY1PzMmJzy9KSS0qVtJRcgGKKOgqOObkKPjDxAyVYnWgagsSK3NT80qQVAYgRIyUYmMB", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [selector_date_id = _t, selector_date_name = _t, selector_date_order = _t]),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"selector_date_order", Int64.Type}})
in
    #"Changed Type"
```


### `dim_statement_commercial`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `account_order` int64, `account_description` string, `account_id` string, `level_1_item` string, `level_2_item` string, `level_1_sort` int64, `highlight` int64  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\db_statement_items_commercial.xlsx"), true, true),
    financial_statement_Sheet = Source{[Item="financial_statement",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(financial_statement_Sheet,{{"account_order", Int64.Type}, {"account_description", type text}, {"account_id", type text}, {"level_1_item", type text}, {"level_2_item", type text}, {"level_1_sort", Int64.Type}, {"highlight", Int64.Type}})
in
    #"Changed Type"
```


### `dim_statement_financial`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `account_order` int64, `account_description` string, `account_id` string, `level_1_item` string, `level_2_item` string, `level_1_sort` int64, `highlight` int64  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\db_statement_items_financial.xlsx"), true, true),
    financial_statement_Sheet = Source{[Item="financial_statement",Kind="Sheet"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(financial_statement_Sheet,{{"account_order", Int64.Type}, {"account_description", type text}, {"account_id", type text}, {"level_1_item", type text}, {"level_2_item", type text}, {"level_1_sort", Int64.Type}, {"highlight", Int64.Type}})
in
    #"Changed Type"
```


### `Display Format`

**Colunas:** `Calculation group column` string, `Ordinal` int64  

### `fact_abc_classification`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `Refresh Date` dateTime, `Region` string, `Amazon Family` string, `ASIN` string, `Inventory Region | BaseSKU` string, `Average Weekly Units` int64, `Average Weekly Revenue` int64, `Revenue% Co.` double, `Units% Family` double, `ABC Co. Revenue` string, `ABC Family Units` string, `ABC Family Search Rank` string, `Final ABC Classification` string, `ABC Sales` string  
```powerquery
let
    Source = Excel.Workbook(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_abc_classification.xlsx"), null, true),
    Classification1 = Source{[Name="Classification"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Classification1, [PromoteAllScalars=true]),
    filtered_refresh_data_latest = Table.SelectRows(#"Promoted Headers", let latest = List.Max(#"Promoted Headers"[Refresh Date]) in each [Refresh Date] = latest),
    select_cols = Table.SelectColumns(filtered_refresh_data_latest,{"Refresh Date", "Region", "Amazon Family", "ASIN", "Inventory Region | BaseSKU", "Average Weekly Units", "Average Weekly Revenue", "Revenue% Co.", "Units% Family", "ABC Co. Revenue", "ABC Family Units", "ABC Family Search Rank", "ABC Sales", "Final ABC Classification"}),
    change_type = Table.TransformColumnTypes(select_cols,{{"Refresh Date", type date}, {"Region", type text}, {"Amazon Family", type text}, {"ASIN", type text}, {"Inventory Region | BaseSKU", type text}, {"Average Weekly Units", Int64.Type}, {"Average Weekly Revenue", Int64.Type}, {"Revenue% Co.", type number}, {"Units% Family", type number}, {"ABC Co. Revenue", type text}, {"ABC Family Units", type text}, {"ABC Family Search Rank", type text}, {"ABC Sales", type text}, {"Final ABC Classification", type text}})
in
    change_type
```


### `fact_aged_inventory_surcharge`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\fulfillment_gold`  
**Colunas:** `key_inventory_country_sku` string, `currency_from` string, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal, `daily_amount_charged` double, `date_payment` dateTime, `date_inventory` dateTime  
```powerquery
let
    Source = Table.Combine({raw_us_ca_mx_aged_inventory_surcharge, raw_gb_eu_aged_inventory_surcharge}),
    #"Multiplied Column" = Table.TransformColumns(Source, {{"monthly_amount_charged", each _ * -1, type number}}),
    add_start_of_month = Table.AddColumn(#"Multiplied Column", "start_of_month", each Date.AddMonths(Date.StartOfMonth([date_payment]), -1), type date),
    add_days_in_month = Table.AddColumn(add_start_of_month, "days_in_month", each Date.DaysInMonth([start_of_month]), Int64.Type),
    add_inventory_date_list = Table.AddColumn(add_days_in_month, "date_inventory", each List.Dates([start_of_month], [days_in_month], #duration(1,0,0,0))),
    expand_inventory_date = 
        Table.TransformColumnTypes( Table.ExpandListColumn(add_inventory_date_list, "date_inventory"), {{"date_inventory", type date}}),
    add_daily_amount_charged = Table.AddColumn(expand_inventory_date, "daily_amount_charged", each Value.Divide([monthly_amount_charged], [days_in_month]), type number),
    select_columns = Table.SelectColumns(add_daily_amount_charged,{"date_payment", "date_inventory", "key_inventory_country_sku", "currency_from", "daily_amount_charged"}),
    merge_exchange_rates = Table.NestedJoin(select_columns, {"date_payment", "currency_from"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    expand_exchange_rates = Table.ExpandTableColumn(merge_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_cad"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})
in
    expand_exchange_rates
```


### `fact_average_landed_cost`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `key_inventory_region_sku` string, `date` dateTime, `unit_cost` double, `currency` string  
```powerquery
let
    // Common ETL
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\Average Landed Cost - Base SKU.xlsx"), true, true),
    DataBase_Sheet = Source{[Item="DataBase",Kind="Sheet"]}[Data],
    change_type_full_table = Table.TransformColumnTypes(DataBase_Sheet,{{"Base SKU", type text}, {"Date", type date}, {"Inventory Region", type text}, {"u_inventory", Int64.Type}, {"$_inventory", type number}, {"unit_cost", type number}}),
    fltered_out_empty = Table.SelectRows(change_type_full_table, each [Date] <> null and [Date] <> ""),
    round_unit_cost = Table.TransformColumns(fltered_out_empty,{{"unit_cost", each Number.RoundUp(_, 2), type number}}),
    added_key_inventory_region_base_sku = Table.AddColumn(round_unit_cost, "key_inventory_region_sku", each [Inventory Region] & " | " & [Base SKU], type text),
    added_currency = Table.AddColumn(added_key_inventory_region_base_sku, "currency", each 
        if [Inventory Region] = "US" then "USD"
        else if [Inventory Region] = "CA" then "CAD"
        else if [Inventory Region] = "EU" then "EUR"
        else if [Inventory Region] = "GB" then "GBP"
        else null, type text
    ),
    select_main_columns = Table.SelectColumns(added_currency,{"Date", "key_inventory_region_sku", "currency", "unit_cost"}),

    // Group rows for getting range
    grouped_for_min_max_dates = Table.Group(select_main_columns, {"key_inventory_region_sku", "currency"}, {{ "min_date", each List.Min([Date]), type date}, {"max_date", each List.Max([Date]), type date}} ),
    
    /* 
        Fill data for 2021
        Assume that for the year of 2021 the landed cost will be 
        the first landed cost recorded for ch sku
    */
    data_2021 = Table.NestedJoin(grouped_for_min_max_dates, {"key_inventory_region_sku", "min_date"}, select_main_columns, {"key_inventory_region_sku", "Date"}, "Data", JoinKind.LeftOuter),
    ___expanded_data_2021 = Table.ExpandTableColumn(data_2021, "Data", {"unit_cost"}, {"unit_cost"}),
    ___added_date_list_2021 = Table.AddColumn(___expanded_data_2021, "date",  each 
        let
            _min_date = Date.FromText("2021-01-01"),
            _max_date = Date.AddDays([min_date],-1 ),
            _duration = Duration.Days(_max_date - _min_date) + 1,
            _date_list = List.Dates(_min_date, _duration, #duration(1,0,0,0))

        in
            _date_list
        , type {date} 
    ),
    ___expanded_date_list_2021 = Table.ExpandListColumn(___added_date_list_2021, "date"),
    ___select_2021_column = Table.SelectColumns(___expanded_date_list_2021,{"key_inventory_region_sku", "currency", "date", "unit_cost"}),


    /* 
        Get data startin from 2022
    */
    // Create list of dates up today
    added_date_list = Table.AddColumn(grouped_for_min_max_dates, "date",  each List.Dates([min_date], Duration.Days(Date.From(DateTime.LocalNow()) - [min_date]) + 1, #duration(1,0,0,0)), type {date} ),
    ___expanded_date_list = Table.ExpandListColumn(added_date_list, "date"),
    ___select_grouped_columns = Table.SelectColumns(___expanded_date_list,{"key_inventory_region_sku", "currency", "date"}),
    
    // Get the landed cost
    merged_grouped_main = Table.NestedJoin(___select_grouped_columns, {"key_inventory_region_sku", "date"}, select_main_columns, {"key_inventory_region_sku", "Date"}, "Data", JoinKind.LeftOuter),
    expanded_grouped_main = Table.ExpandTableColumn(merged_grouped_main, "Data", {"unit_cost"}, {"unit_cost"}),

    // Fill Dates originaly missing data
    sorted_key_date = Table.Sort(expanded_grouped_main,{{"key_inventory_region_sku", Order.Ascending}, {"date", Order.Ascending}}),
    filled_down_unit_cost = Table.FillDown(sorted_key_date,{"unit_cost"}),

    full_data = Table.Combine({filled_down_unit_cost, ___select_2021_column})




    
in
    full_data
```


### `fact_awd_monthly_processing_fee`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `month_of_charge` dateTime, `key_inventory_country_sku` string, `total_charged_amount` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `transaction_date` dateTime  
```powerquery
let
    Source = raw_awdMonthlyProcessingFee,
    selectImportantColumns = Table.SelectColumns(Source,{"transaction_date", "month_of_charge", "key_inventory_country_sku", "currency", "total_charged_amount"}),
    negative_numbers = Table.TransformColumns(selectImportantColumns, {{"total_charged_amount", each _ * -1, type number}}),
    merged_exchange_rates = Table.NestedJoin(negative_numbers, {"month_of_charge", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_columns = Table.SelectColumns(___expanded_exchange_rates,{"transaction_date", "month_of_charge", "key_inventory_country_sku", "total_charged_amount", "exchange_rate_to_usd", "exchange_rate_to_eur"})
in
    select_columns
```


### `fact_awd_monthly_storage_fee`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `date` dateTime, `inventory_country` string, `sku` string, `currency` string, `daily_charged_amount` double, `exchange_rate_to_gbp` decimal  
```powerquery
let
    Source = raw_awdMonthlyStorageFee,
    selectImportantColumns = Table.SelectColumns(Source,{"sku", "inventory_country", "total_charged_amount", "currency", "month_of_charge"}),
    added_days_in_month = Table.AddColumn(selectImportantColumns, "days_in_month", each Date.DaysInMonth([month_of_charge]), Int64.Type),
    added_dates_list = Table.AddColumn(added_days_in_month, "date", each List.Dates([month_of_charge], [days_in_month], #duration(1,0,0,0))),
    expnded_dates_list = Table.ExpandListColumn(added_dates_list, "date"),
    changed_type_date = Table.TransformColumnTypes(expnded_dates_list,{{"date", type date}}),
    added_daily_charged_amount = Table.AddColumn(changed_type_date, "daily_charged_amount", each [total_charged_amount]/[days_in_month], type number),
    select_columns = Table.SelectColumns(added_daily_charged_amount,{"date", "inventory_country", "sku", "currency", "daily_charged_amount"}),
    merged_exchange_rates = Table.NestedJoin(select_columns, {"date", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})
in
    ___expanded_exchange_rates
```


### `fact_awd_monthly_transportation_fee`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `month_of_charge` dateTime, `key_inventory_country_sku` string, `total_charged_amount` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `transaction_date` dateTime, `exchange_rate_to_gbp` decimal  
```powerquery
let
    Source = raw_awdMonthlyTransportationFee,
    selectImportantColumns = Table.SelectColumns(Source,{"transaction_date", "month_of_charge", "key_inventory_country_sku", "currency", "total_charged_amount"}),
    negative_numbers = Table.TransformColumns(selectImportantColumns, {{"total_charged_amount", each _ * -1, type number}}),
    merged_exchange_rates = Table.NestedJoin(negative_numbers, {"month_of_charge", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_cols = Table.SelectColumns(___expanded_exchange_rates,{"transaction_date", "month_of_charge", "key_inventory_country_sku", "total_charged_amount", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})
in
    select_cols
```


### `fact_estimated_future_daily_storage_fee`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\fulfillment_gold`  
**Colunas:** `date` dateTime, `marketplace` string, `sku` string, `currency` string, `estimated_daily_storage_fee` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal  
```powerquery
let
    merged_daly_share_monthly_storage_fee = Table.NestedJoin(aux_dailyShareOfStorageFee, {"start_of_month_daily_share_of_storage_fee", "sku"}, fact_estimated_future_monthly_storage_fee, {"start_of_month", "sku"}, "fact_estimated_future_monthly_storage_fee", JoinKind.LeftOuter),
    expanded_fact_estimated_future_monthly_storage_fee = Table.ExpandTableColumn(merged_daly_share_monthly_storage_fee, "fact_estimated_future_monthly_storage_fee", {"currency", "estimated_monthly_storage_fee"}, {"currency", "estimated_monthly_storage_fee"}),
    filtered_stora_fee_blank = Table.SelectRows(expanded_fact_estimated_future_monthly_storage_fee, each [estimated_monthly_storage_fee] <> null and [estimated_monthly_storage_fee] <> ""),
    
    added_estimated_daily_storage_fee = Table.AddColumn(filtered_stora_fee_blank, "estimated_daily_storage_fee", each [daily_share_of_storage_fee] *[estimated_monthly_storage_fee], type number),
    select_columns = Table.SelectColumns(added_estimated_daily_storage_fee,{"date_daily_share_of_storage_fee", "marketplace", "sku", "currency", "estimated_daily_storage_fee"}),
    renamed_columns = Table.RenameColumns(select_columns,{{"date_daily_share_of_storage_fee", "date"}}),
    merged_exchange_rates = Table.NestedJoin(renamed_columns, {"date", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})
in
    expanded_exchange_rates
```


### `fact_fulfillment_fee_credits`

**Modo:** `import`  **Grupo:** `'STAGING\Fulfillment Fee Credits'`  
**Colunas:** `date_payments` dateTime, `key_country_sku` string, `Country` string, `SKU` string, `fba_fee` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal  
```powerquery
let
/*
    The Process is as follows

    1.0 Get P&L table
        1.1 keep Only Canada's Fulfillment Fees Credits

    2.0 Get FBA Fees by SKU
        2.1 Build Main Table
        2.2 Build Totals
        2.4 Build Shares by merging totals back to main

    3.0 Merge P&L Monthky to FBA Fees By SKU 
        3.1 Get Value by day
*/

    // Get P&L
    fba_fee_credits_pl_geral = fba_fee_credits_pl_geral,
    fact_fulfillment_fee_credits = fba_fee_ca_payments,
    
    // Get Fulfillment Fee Credits by SKU-Day
    merge_fba_fee_credits_monthly = Table.NestedJoin(fact_fulfillment_fee_credits, {"start_of_month"}, fba_fee_credits_pl_geral, {"start_of_month_pl"}, "fba_fee_credits_monthly", JoinKind.LeftOuter),
    expanded_fba_fee_credits = Table.ExpandTableColumn(merge_fba_fee_credits_monthly, "fba_fee_credits_monthly", {"Valor"}, {"Valor"}),
    add_fba_fee = Table.AddColumn(expanded_fba_fee_credits, "fba_fee", each [monthly_share_of_fba_fees] * [Valor], type number),
    add_key_country_sku = Table.AddColumn(add_fba_fee, "key_country_sku", each [Country] & " | " & [SKU], type text),
    filter_out_blank = Table.SelectRows(add_key_country_sku, each [fba_fee] <> null and [fba_fee] <> "" and [fba_fee] <> 0),
    merge_fact_exchange_rates = Table.NestedJoin(filter_out_blank, {"date_payments", "currency_from"}, fact_exchange_rates, {"date", "currency_from"}, "fact_exchange_rates", JoinKind.LeftOuter),
    expanded_fact_exchange_rates = Table.ExpandTableColumn(merge_fact_exchange_rates, "fact_exchange_rates", {"exchange_rate_to_eur", "exchange_rate_to_usd"}, {"exchange_rate_to_eur", "exchange_rate_to_usd"}),
    select_cols = Table.SelectColumns(expanded_fact_exchange_rates,{"date_payments", "key_country_sku", "Country", "SKU", "fba_fee", "exchange_rate_to_eur", "exchange_rate_to_usd"}),
    #"Rounded Off" = Table.TransformColumns(select_cols,{{"fba_fee", each Number.Round(_, 6), type number}})
in
    #"Rounded Off"
```


### `fact_P&L GERAL`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `BU` string, `Empresa` string, `Descrição` string, `Valor` double, `Categoria 1` string, `Categoria 2` string, `Date` dateTime, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal  
```powerquery
let
    Source = Excel.Workbook(File.Contents("G:\Shared drives\Eleven Brands - Finance\10. PROFITABILITY\P&L BI.xlsx"), true, true),
    #"P&L GERAL_Sheet" = Source{[Item="P&L GERAL",Kind="Sheet"]}[Data],
    filtered_out_bu_null = Table.SelectRows(#"P&L GERAL_Sheet", each [BU] <> null and [BU] <> ""),
    added_date = Table.AddColumn(filtered_out_bu_null, "Date", each Date.From(Date.EndOfMonth(#date([Ano], [Mês], 1))), type date),
    select_important_columns = Table.SelectColumns(added_date,{"Date", "BU", "Empresa ", "Descrição", "Valor", "Moeda Local", "Categoria 1", "Categoria 2"}),
    change_type_full_table = Table.TransformColumnTypes(select_important_columns,{{"BU", type text}, {"Empresa ", type text}, {"Descrição", type text}, {"Valor", type number}, {"Moeda Local", type text}, {"Categoria 1", type text}, {"Categoria 2", type text}}),
    merged_exchange_rates = Table.NestedJoin(change_type_full_table, {"Date", "Moeda Local"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_columns = Table.SelectColumns(___expanded_exchange_rates,{"Date", "BU", "Empresa ", "Descrição", "Valor", "Categoria 1", "Categoria 2", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})
in
    select_columns
```


### `fact_payments_date_range`

**Modo:** `import`  **Grupo:** `Amazon\Payments`  
**Colunas:** `Regulatory Fee` double, `Settlement ID` string, `Order Amazon ID` string, `Quantity` double, `Product Sales` double, `Shipping Credits` double, `Gift Wrap Credits` double, `Promotional Rebates` double, `Other Transaction Fees` double, `Other` double, `Quantity Adjusted` int64, `date_all_orders = COALESCE( RELATED(fact_raw_allOrders[date_all_orders]), 'fact_payments_date_range'[date_payments] )`, `landed_cost = ````, `Country` string, `currency_from` string, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `landed_cost_currency = ````, `landed_cost_exchange_rate = ````, `exchange_rate_to_gbp` decimal, `SKU` string, `taxes_collected` double, `taxes_withheld` double, `taxes_refunded` double, `selling_fees` double, `fulfillment_fee` double, `fee_adjustment` double, `type_mapping` string, `description_mapping` string, `date_payments` dateTime, `is_etsy` boolean, `Marketplace` string, `Custom` double, `exchange_rate_to_cad` decimal, `contenated_cols = LEFT(fact_payments_date_range[Marketplace],2) & " | " & fact_payments_date_range[SKU]`, `Description` string, `purchase_cost = ````, `freight_cost = ````, `Column_delete_test_sum = fact_payments_date_range[purchase_cost] + fact_payments_date_range[freight_cost]`, `landed cost 2' = fact_payments_date_range[landed_cost]`, `landed cost check' = ROUND(fact_payments_date_range[landed_cost] - fact_payments_date_range[Column_delete_test_sum],2)`  
```powerquery
let
    Source = fact_payments_date_range_compiled,
    filtered_liquidation = Table.SelectRows(Source, each [type_mapping] <> "Liquidations" and [type_mapping] <> "Liquidations Adjustments"),
    #"Filtered Rows" = Table.SelectRows(filtered_liquidation, each [description_mapping] <> "Return Processing Fee"),
    #"Appended Query" = Table.Combine({#"Filtered Rows", fact_payments_date_range_liquidation})
in
    #"Appended Query"
```


### `fact_payments_storage_fee_with_gst`

**Modo:** `import`  **Grupo:** `STAGING\GST`  
**Colunas:** `date_daily_share_of_storage_fee` dateTime, `country` string, `daily_storage_fee` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal, `sku` string  
```powerquery
let

// Build Share of Storage Fee
    daily_storage_fee = fact_storage_fee_daily,
    filter_canada = Table.SelectRows(daily_storage_fee, each ([country] = "CA")),
    add_start_of_month_share = Table.AddColumn(filter_canada, "start_of_month_share", each Date.StartOfMonth([date_daily_share_of_storage_fee]), type date),
    group_by_monthly_storage_fee = Table.Group(add_start_of_month_share, {"country", "start_of_month_share"}, {{"monthly_storage_fee", each List.Sum([estimated_daily_storage_fee]), type nullable date}}),
    merge_monthly_storage_fee = Table.NestedJoin(add_start_of_month_share, {"start_of_month_share", "country"}, group_by_monthly_storage_fee, {"start_of_month_share", "country"}, "monthly_storage_fee", JoinKind.LeftOuter),
    expanded_monthly_storage_fee = Table.ExpandTableColumn(merge_monthly_storage_fee, "monthly_storage_fee", {"monthly_storage_fee"}, {"monthly_storage_fee.1"}),
    add_share = Table.AddColumn(expanded_monthly_storage_fee, "storage_fee_country_share_of_value", each Value.Divide([estimated_daily_storage_fee], [monthly_storage_fee.1]), type number),
    select_cols_share = Table.SelectColumns(add_share,{"date_daily_share_of_storage_fee", "key_marketplace_sku", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp", "country", "sku", "start_of_month_share", "storage_fee_country_share_of_value"}),

// Get Monthly Storage Fee Payments
    ca_payments = bronze_CA_Payments,
    merged_descriptionDePara = Table.NestedJoin(ca_payments, {"Country", "Description"}, dim_description_mapping, {"Attribute", "Value"}, "description_mapping", JoinKind.LeftOuter),
    expanded_descriptionDePara = Table.ExpandTableColumn(merged_descriptionDePara, "description_mapping", {"Oficial"}, {"description_mapping"}),
    filter_canada_and_storage_fee = Table.SelectRows(expanded_descriptionDePara, each ([Marketplace] = "CA") and ([description_mapping] = "FBA Storage Fee") ),
    select_cols_ca_payments = Table.SelectColumns(filter_canada_and_storage_fee,{"date_payments", "description_mapping", "Other", "currency_from", "Marketplace"}),
    add_start_of_month_payments = Table.AddColumn(select_cols_ca_payments, "start_of_month_payments", each Date.AddMonths( Date.StartOfMonth( [date_payments] ), -1), type date),
    group_by_month = Table.Group(add_start_of_month_payments, {"start_of_month_payments", "Marketplace", "currency_from"}, {{"monthly_storage_fee", each List.Sum([Other]), type nullable number}}),

// Build Daily Share
    merge_payments_date_range_report = Table.NestedJoin(select_cols_share, {"start_of_month_share", "country"}, group_by_month, {"start_of_month_payments", "Marketplace"}, "payments_date_range_report", JoinKind.LeftOuter),
    expanded_payments_date_range_report = Table.ExpandTableColumn(merge_payments_date_range_report, "payments_date_range_report", {"monthly_storage_fee", "currency_from"}, {"monthly_storage_fee", "currency_from"}),
    add_daily_storage_fee = Table.AddColumn(expanded_payments_date_range_report, "daily_storage_fee", each [storage_fee_country_share_of_value] * [monthly_storage_fee], type number),
    merge_fact_exchange_rates = Table.NestedJoin(add_daily_storage_fee, {"date_daily_share_of_storage_fee", "currency_from"}, fact_exchange_rates, {"date", "currency_from"}, "fact_exchange_rates", JoinKind.LeftOuter),
    expanded_fact_exchange_rates = Table.ExpandTableColumn(merge_fact_exchange_rates, "fact_exchange_rates", {"exchange_rate_to_eur", "exchange_rate_to_usd"}, {"exchange_rate_to_eur.1", "exchange_rate_to_usd.1"}),
    select_cols = Table.SelectColumns(expanded_fact_exchange_rates,{"date_daily_share_of_storage_fee", "country", "sku", "daily_storage_fee", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})




    
in
    select_cols
```


### `fact_raw_allOrders`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\fulfillment_gold`  
**Colunas:** `date_all_orders` dateTime, `amazon_order_id` string, `sales_channel_temporary` string, `is_in_payments =`  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Sales_Returns.vw_full_all_orders"),
    #"Removed Other Columns" = Table.SelectColumns(Source,{"date_all_orders", "amazon_order_id", "sales_channel_temporary"}),
    #"Removed Duplicates" = Table.Distinct(#"Removed Other Columns"),
    #"Filtered Rows" = Table.SelectRows(#"Removed Duplicates", each [date_all_orders] >= Date.From(Date.AddYears(payments_first_date, -1)))
in
    #"Filtered Rows"
```


### `fact_removal_order_detail`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\fulfillment_gold`  
**Colunas:** `date_request` dateTime, `date_payment` dateTime, `key_inventory_country_sku` string, `currency_from` string, `removal_fee` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal  
```powerquery
let
    Source = Table.Combine({silver_us_ca_mx_removal_order_detail_normal, silver_us_ca_mx_removal_order_detail_unknow, raw_gb_eu_removal_order_detail}),
    group_by = Table.Group(Source, {"date_request", "date_payment", "sku", "currency", "inventory_region"}, {{"total_removal_fee", each List.Sum([total_removal_fee]), type nullable number}}),
    make_fee_negative = Table.TransformColumns(group_by, {{"total_removal_fee", each _ * -1, type number}}),
    // Left Join: apportionmnets_removal_orders
    merge_shares = Table.NestedJoin(make_fee_negative, {"inventory_region", "sku", "date_request"}, apportionmnets_removal_orders, {"region", "sku", "date_sku_list"}, "aux_dailyShareOfUnits_Sold", JoinKind.LeftOuter),
    expand_shares = Table.ExpandTableColumn(merge_shares, "aux_dailyShareOfUnits_Sold", {"country", "default_share_country_sku", "chosen_horizon_country_sku"}, {"country", "default_share_country_sku", "chosen_horizon_country_sku"}),
    // fallback to default values by region
    SetCountry  = Table.ReplaceValue( expand_shares, each [country], each if [inventory_region] = "EU" and [country] = null then "DE" else [country], Replacer.ReplaceValue, {"country"}),
    SetShare  = Table.ReplaceValue( SetCountry, each [default_share_country_sku], each if [default_share_country_sku] = null then 1 else [default_share_country_sku], Replacer.ReplaceValue, {"default_share_country_sku"}),

    // Final Treatment for Power BI
    add_removal_fee = Table.AddColumn(SetShare, "removal_fee", each [total_removal_fee] *[default_share_country_sku], type number),
    add_key_inventory_country_sku = Table.AddColumn(add_removal_fee, "key_inventory_country_sku", each [country] & " | " & [sku], type text),
    rename_cols = Table.RenameColumns(add_key_inventory_country_sku,{{"currency", "currency_from"}}),
    select_cols = Table.SelectColumns(rename_cols,{"date_request", "date_payment", "key_inventory_country_sku", "currency_from", "removal_fee"}),
    merge_exchange_rate = Table.NestedJoin(select_cols, {"date_request", "currency_from"}, fact_exchange_rates, {"date", "currency_from"}, "fact_exchange_rates", JoinKind.LeftOuter),
    expanded_exchange_rate = Table.ExpandTableColumn(merge_exchange_rate, "fact_exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    #"Appended Query" = Table.Combine({expanded_exchange_rate, payments_removal_fee})
in
    #"Appended Query"
```


### `fact_returns_processing_fee`

**Modo:** `import`  **Grupo:** `'Amazon\Payments\Derived from Payments'`  
**Colunas:** `date_payments` dateTime, `currency_from` string, `fulfillment_fee` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal, `key_sales_country_sku` string  
```powerquery
let
    // Treeat Payments
    GET_payments_table = fact_payments_date_range_compiled,
    rename_fulfillment_fee = Table.RenameColumns(GET_payments_table,{{"fulfillment_fee", "OLD_fulfillment_fee"}}),
    select_cols_payments = Table.SelectColumns(rename_fulfillment_fee,{
"date_payments", "Country", "currency_from", 
"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp", "exchange_rate_to_cad", 
"description_mapping", "Description", "OLD_fulfillment_fee"
}),
    filter_return_processing_fee = Table.SelectRows(select_cols_payments, each ([description_mapping] = "Return Processing Fee")),
    extract_asin_from_description = Table.AddColumn(filter_return_processing_fee, "extracted_asin", each Text.BetweenDelimiters([Description], "ASIN: ", " (2"), type text),
    // Merge to get shares
    merge_queries = Table.NestedJoin(extract_asin_from_description, {"date_payments", "Country", "extracted_asin"}, apportionments_returns_precessing_fee, {"date_sku_list", "country", "asin"}, "aux_dailyShareOfUnits_Sold", JoinKind.LeftOuter),
    expanded_apportinments = Table.ExpandTableColumn(merge_queries, "aux_dailyShareOfUnits_Sold", {"sku", "returns_processing_fee_share_country_asin"}, {"sku", "returns_processing_fee_share_country_asin"}),
    add_key_sales_country_sku = Table.AddColumn(expanded_apportinments, "key_sales_country_sku", each [Country] & " | " & [sku], type text),
    
    
    add_fulfillment_fee = Table.AddColumn(add_key_sales_country_sku, "fulfillment_fee", each [returns_processing_fee_share_country_asin] * -[OLD_fulfillment_fee], type number),
    select_cols = Table.SelectColumns(add_fulfillment_fee,{
"date_payments", "key_sales_country_sku", "currency_from",
"fulfillment_fee", 
"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"
})
in
    select_cols
```


### `fact_sb_spend_by_sku`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `date_sb` dateTime, `marketplace` string, `sku` string, `sb_spend` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `exchange_rate_to_gbp` decimal, `key_marketplace_sku` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_sponsored_brands_spend"),
    #"Duplicated Column" = Table.DuplicateColumn(Source, "key_marketplace_sku", "key_marketplace_sku - Copy"),
    split_column_key_marketplace_sku = Table.SplitColumn(#"Duplicated Column", "key_marketplace_sku - Copy", Splitter.SplitTextByEachDelimiter({" | "}, QuoteStyle.Csv, false), {"marketplace", "sku"}),
    merged_exchange_rates = Table.NestedJoin(split_column_key_marketplace_sku, {"date_sb", "currency_sb"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_columns = Table.SelectColumns(___expanded_exchange_rates,{"date_sb", "key_marketplace_sku", "marketplace", "sku", "sb_spend", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"})
in
    select_columns
```


### `fact_sd_advertised_product`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `key_marketplace_advertised_sku` string, `spend` double, `date_sb_advertised_products` dateTime, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `marketplace` string, `advertised_sku` string, `exchange_rate_to_gbp` decimal  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sd_advertised_products"),
    #"Grouped Rows" = Table.Group(Source, {"sponsored_ads_type", "date_sb_advertised_products", "key_marketplace_advertised_sku", "currency"}, {{"spend", each List.Sum([spend]), type nullable number}}),
    merged_exchange_rates = Table.NestedJoin(#"Grouped Rows", {"date_sb_advertised_products", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_columns = Table.SelectColumns(___expanded_exchange_rates,{"date_sb_advertised_products", "key_marketplace_advertised_sku", "spend", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    #"Duplicated Column" = Table.DuplicateColumn(select_columns, "key_marketplace_advertised_sku", "key_marketplace_advertised_sku - Copy"),
    #"Split Column by Delimiter" = Table.SplitColumn(#"Duplicated Column", "key_marketplace_advertised_sku - Copy", Splitter.SplitTextByEachDelimiter({" | "}, QuoteStyle.Csv, false), {"marketplace", "advertised_sku"})
in
    #"Split Column by Delimiter"
```


### `fact_sp_advertised_products`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `date_sp_advertised_products` dateTime, `key_marketplace_advertised_sku` string, `spend` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `marketplace` string, `advertised_sku` string, `exchange_rate_to_gbp` decimal  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sp_advertised_products"),
    #"Grouped Rows" = Table.Group(Source, {"sponsored_ads_type", "date_sp_advertised_products", "key_marketplace_advertised_sku", "currency"}, {{"spend", each List.Sum([spend]), type nullable number}}),
    merged_exchange_rates = Table.NestedJoin(#"Grouped Rows", {"date_sp_advertised_products", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_columns = Table.SelectColumns(___expanded_exchange_rates,{"date_sp_advertised_products", "key_marketplace_advertised_sku", "spend", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    #"Duplicated Column" = Table.DuplicateColumn(select_columns, "key_marketplace_advertised_sku", "key_marketplace_advertised_sku - Copy"),
    #"Split Column by Delimiter" = Table.SplitColumn(#"Duplicated Column", "key_marketplace_advertised_sku - Copy", Splitter.SplitTextByEachDelimiter({" | "}, QuoteStyle.Csv, false), {"marketplace", "advertised_sku"})
in
    #"Split Column by Delimiter"
```


### `fact_storage_fee_daily`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\fulfillment_gold`  
**Colunas:** `date_daily_share_of_storage_fee` dateTime, `key_marketplace_sku` string, `estimated_daily_storage_fee` double, `exchange_rate_to_usd` decimal, `exchange_rate_to_eur` decimal, `country` string, `sku` string, `exchange_rate_to_gbp` decimal  
```powerquery
let
    storage_fee_daily_share = aux_dailyShareOfStorageFee,
    merged_storage_fee_monthly = Table.NestedJoin(storage_fee_daily_share, {"start_of_month_daily_share_of_storage_fee", "key_region_fnsku"}, fStorageFeeMonthly, {"month_of_charge", "key_inventory_region_fnsku"}, "Staging - fStorageFeeMonthly", JoinKind.LeftOuter), 
    ___expanded_storage_fee_monthly = Table.ExpandTableColumn(merged_storage_fee_monthly, "Staging - fStorageFeeMonthly", {"currency", "estimated_monthly_storage_fee"}, {"currency", "estimated_monthly_storage_fee"}),
    
    
    filtered_out_currency_null = Table.SelectRows(___expanded_storage_fee_monthly, each [currency] <> null and [currency] <> ""),
    added_estimated_daily_storage_fee = Table.AddColumn(filtered_out_currency_null, "estimated_daily_storage_fee", each [daily_share_of_storage_fee] *[estimated_monthly_storage_fee], type number),
    filtered_out_zeros = Table.SelectRows(added_estimated_daily_storage_fee, each [estimated_daily_storage_fee] > 0),
    rounded_storage_fee_to_ten_decimal_placesff = Table.TransformColumns(filtered_out_zeros,{{"estimated_daily_storage_fee", each Number.Round(_, 10), type number}}),
    merged_exchange_rates = Table.NestedJoin(rounded_storage_fee_to_ten_decimal_placesff, {"date_daily_share_of_storage_fee", "currency"}, fact_exchange_rates, {"date", "currency_from"}, "exchange_rates", JoinKind.LeftOuter),
    ___expanded_exchange_rates = Table.ExpandTableColumn(merged_exchange_rates, "exchange_rates", {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}, {"exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    select_columns = Table.SelectColumns(___expanded_exchange_rates,{"date_daily_share_of_storage_fee", "key_marketplace_sku", "estimated_daily_storage_fee", "exchange_rate_to_usd", "exchange_rate_to_eur", "exchange_rate_to_gbp"}),
    #"Duplicated Column" = Table.DuplicateColumn(select_columns, "key_marketplace_sku", "key_marketplace_sku - Copy"),
    #"Split Column by Delimiter" = Table.SplitColumn(#"Duplicated Column", "key_marketplace_sku - Copy", Splitter.SplitTextByEachDelimiter({" | "}, QuoteStyle.Csv, false), {"country", "sku"})
in
    #"Split Column by Delimiter"
```


### `raw_bq_inventoryLedgerByCountry`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\fulfillment_bronze_ingestion`  
**Colunas:** `date_inventory_ledger` dateTime, `sku` string, `asin` string, `fnsku` string, `disposition` string, `starting_warehouse_balance` int64, `in_transit_between_warehouses` int64, `ending_warehouse_balance` int64, `inventory_country` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.2_Silver_Inventory.vw_full_inventory_ledger_summary_by_country"),
    removed_other_columns = Table.SelectColumns(Source,{"date_inventory_ledger", "sku", "asin", "fnsku", "disposition", "starting_warehouse_balance", "in_transit_between_warehouses", "ending_warehouse_balance", "inventory_country"})
in
    removed_other_columns
```


### `SKUs`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Base SKU` string, `SKU` string, `FNSKU` string, `Inventory Region` string, `Sales Region` string, `Country` string, `Amazon Family` string, `Marketplace` string, `ASIN` string, `Image URL` string, `Brand - Code` string, `Brand - Name` string, `Product General Type - Code` string, `Product General Type - Name` string, `Product Specific Type - Code` string, `Product Specific Type - Name` string, `Product Type Complete - Name` string, `Product Size - Code` string, `Product Size - Name` string, `Product Color - Code` string, `Product Color - Name` string, `Product Color - Pattern` string, `Product Set - Quantity` string, `Generic Family` string, `Core Family` string, `Native Family` string, `Inner Type` string, `Units / Carton` int64, `Carton Weight (kg)` double, `Carton Dimensions (cm) Length` double, `Carton Dimensions (cm) Width` double, `Carton Dimensions (cm) Height` double, `Carton CBM` double, `Units / Package` int64, `Package Weight (kg)` double, `Package Dimensions (cm) Length` double, `Package Dimensions (cm) Width` double, `Package Dimensions (cm) Height` double, `Item Dimensions (cm) Length` string, `Item Dimensions (cm) Width` string, `Item Dimensions (cm) Height` string, `Item Dimensions (in) Length` string, `Item Dimensions (in) Width` string, `Item Dimensions (in) Height` string, `Key Column: Sales Region | SKU` string, `Key Column: Sales Region | ASIN` string, `Key Column: Sales Region | FNSKU` string, `Key Column: Sales Region | Amazon Family` string, `Key Column: Sales Region | Country | SKU` string, `Key Column: Inventory Region | SKU` string, `Key Column: Inventory Region | ASIN` string, `Key Column: Inventory Region | FNSKU` string, `Key Column: Country | SKU` string, `Key Column: Country | ASIN` string, `Key Column: Country | FNSKU` string, `Key Column: Marketplace | SKU` string, `Key Column: Marketplace | ASIN` string, `Key Column: Marketplace | FNSKU` string, `Sales Region | Base SKU` string, `Inventory Region | Base SKU` string, `Country | SKU` string, `Country | Native Family` string, `Refresh Date` dateTime, `Average Weekly Units` int64, `Average Weekly Revenue` int64, `Revenue% Co.` double, `Units% Family` double, `ABC Co. Revenue` string, `ABC Family Units` string, `ABC Family Search Rank` string, `Final ABC Classification` string, `Life Cycle` string, `Rope or Fabric` string, `SKU Consertado` string, `Key Column: Inventory Region | SKU Consertado` string, `AWD - Units / Carton` int64, `AWD - Carton Weight (kg)` double, `AWD - Carton Dimensions (cm) Length` double, `AWD - Carton Dimensions (cm) Width` double, `AWD - Carton Dimensions (cm) Height` double, `AWD - Carton CBM` double, `is_grade_and_resell` boolean, `Grade` string, `item_name` string, `item_description` string, `current_price` double, `open_date` string, `fulfillment_channel` string, `status` string, `Package CBM` double, `Package Cubic Feet` double, `ABC Profitability` string, `Standard Family` string, `Reorder Region` string, `Reorder Region | Base SKU` string, `ABC Sales` string  
```powerquery
let
    #"Table Combine" = Table.Combine({#"SKUs (raw)", dgradeAndResellAmazonFoundSkus}),
    is_grade_and_resell = Table.AddColumn(#"Table Combine", "is_grade_and_resell", each if Text.Start ( [SKU], 8 ) = "amzn.gr." 
then true 
else false
),
    addedKey_salesRegion_sku = Table.AddColumn(is_grade_and_resell, "Key Column: Sales Region | SKU", each [Sales Region] & " | " & [SKU]),
    addedKey_salesRegion_asin = Table.AddColumn(addedKey_salesRegion_sku, "Key Column: Sales Region | ASIN", each [Sales Region] & " | " & [ASIN]),
    addedKey_salesRegion_fnsku = Table.AddColumn( addedKey_salesRegion_asin, "Key Column: Sales Region | FNSKU", each [Sales Region] & " | " & [FNSKU]),
    addedKey_salesRegion_amazonFamily = Table.AddColumn( addedKey_salesRegion_fnsku, "Key Column: Sales Region | Amazon Family", each [Sales Region] & " | " & [Amazon Family]),
    addedKey_salesRegion_country_sku = Table.AddColumn( addedKey_salesRegion_amazonFamily, "Key Column: Sales Region | Country | SKU", each [Sales Region] & " | " & [Country] & " | " & [FNSKU]),
    addedKey_inventoryRegion_sku = Table.AddColumn(addedKey_salesRegion_country_sku, "Key Column: Inventory Region | SKU", each [Inventory Region] & " | " & [SKU]),
    addedKey_inventoryRegion_asin = Table.AddColumn(addedKey_inventoryRegion_sku, "Key Column: Inventory Region | ASIN", each [Inventory Region] & " | " & [ASIN]),
    addedKey_inventoryRegion_fnsku = Table.AddColumn(addedKey_inventoryRegion_asin, "Key Column: Inventory Region | FNSKU", each [Inventory Region] & " | " & [FNSKU]),
    addedKey_country_sku = Table.AddColumn(addedKey_inventoryRegion_fnsku, "Key Column: Country | SKU", each [#"Country"] & " | " & [SKU]),
    addedKey_country_asin = Table.AddColumn(addedKey_country_sku, "Key Column: Country | ASIN", each [#"Country"] & " | " & [ASIN]),
    addedKey_country_fnsku = Table.AddColumn(addedKey_country_asin, "Key Column: Country | FNSKU", each [#"Country"] & " | " & [FNSKU]),
    addedKey_country_nativeFamily = Table.AddColumn(addedKey_country_fnsku, "Country | Native Family", each [Country] & " | " & [Native Family]),
    addedKey_marketplace_sku = Table.AddColumn(addedKey_country_nativeFamily, "Key Column: Marketplace | SKU", each [#"Marketplace"] & " | " & [SKU]),
    addedKey_marketplace_asin = Table.AddColumn(addedKey_marketplace_sku, "Key Column: Marketplace | ASIN", each [#"Marketplace"] & " | " & [ASIN]),
    addedKey_marketplace_fnsku = Table.AddColumn(addedKey_marketplace_asin, "Key Column: Marketplace | FNSKU", each [#"Marketplace"] & " | " & [FNSKU]),
    added_salesRegion_baseSku = Table.AddColumn(addedKey_marketplace_fnsku, "Sales Region | Base SKU", each [Sales Region] & " | " & [Base SKU]),
    added_inventoryRegion_baseSku = Table.AddColumn(added_salesRegion_baseSku, "Inventory Region | Base SKU", each [Inventory Region] & " | " & [Base SKU]),
    added_country_sku = Table.AddColumn(added_inventoryRegion_baseSku, "Country | SKU", each [Country] & " | " & [SKU]),
    added_grade = Table.AddColumn(added_country_sku, "Grade", each if [is_grade_and_resell] = false
then "Regular SKU"
else if Text.End ( [SKU], 2 ) = "AC" then "Used-Acceptable"
else if Text.End ( [SKU], 2 ) = "GD" then "Used-Good"
else if Text.End ( [SKU], 2 ) = "LN" then "Used-Like New"
else if Text.End ( [SKU], 2 ) = "PO" then "PO - Unfulfillable"
else if Text.End ( [SKU], 2 ) = "VG" then "Used-Very Good"
else "Other"
),
    added_reorderRegion = Table.AddColumn(added_grade, "Reorder Region", each if [Sales Region] = "MX" or [Sales Region] = "BR" 
then "US" 
else [Sales Region]),
    addedKey_reorderRegion_baseSku = Table.AddColumn(added_reorderRegion, "Reorder Region | Base SKU", each [#"Reorder Region"] & " | " & [Base SKU]),
    #"Merged Queries - Curve ABC" = Table.NestedJoin(addedKey_reorderRegion_baseSku, {"Inventory Region | Base SKU"}, fact_abc_classification, {"Inventory Region | BaseSKU"}, "Curve ABC", JoinKind.LeftOuter),
    #"___Expanded - Curve ABC" = Table.ExpandTableColumn(#"Merged Queries - Curve ABC", "Curve ABC", 
{"Refresh Date", "Average Weekly Units", "Average Weekly Revenue", "Revenue% Co.", "Units% Family", "ABC Profitability", "ABC Co. Revenue", "ABC Family Units", "ABC Family Search Rank", "ABC Sales", "Final ABC Classification"},
{"Refresh Date", "Average Weekly Units", "Average Weekly Revenue", "Revenue% Co.", "Units% Family", "ABC Profitability", "ABC Co. Revenue", "ABC Family Units", "ABC Family Search Rank", "ABC Sales", "Final ABC Classification"}),
    #"Merged Queries - All Listings Report" = Table.NestedJoin(#"___Expanded - Curve ABC", {"Key Column: Country | SKU"}, fAllListingsReport, {"key_country_sku"}, "All Listings Report", JoinKind.LeftOuter),
    #"___Expanded - All Listings Report" = Table.ExpandTableColumn(#"Merged Queries - All Listings Report", "All Listings Report", 
{"item_name", "item_description", "current_price", "open_date", "fulfillment_channel", "status"}, 
{"item_name", "item_description", "current_price", "open_date", "fulfillment_channel", "status"}
),
    #"Merged Queries - Life Cycle" = Table.NestedJoin(#"___Expanded - All Listings Report", {"SKU"}, aux_LifeCycleLastDate, {"sku"}, "Life Cycle.1", JoinKind.LeftOuter),
    #"__Expanded Life Cycle" = Table.ExpandTableColumn(#"Merged Queries - Life Cycle", "Life Cycle.1", {"life_cycle"}, {"Life Cycle"}),
    filling_grade_resell_life_cycle = Table.ReplaceValue(#"__Expanded Life Cycle", each [Life Cycle], each 
if [is_grade_and_resell] = true then "R" 
else if Text.StartsWith([SKU], "Amazon.Found") then "F" 
else [Life Cycle], 
Replacer.ReplaceValue, {"Life Cycle"}),
    added_rope_or_fabric = Table.AddColumn(filling_grade_resell_life_cycle, "Rope or Fabric", each if Text.Contains([SKU], "OHFB") then "Fabric" else "Rope"),
    #"Removed Duplicates" = Table.Distinct(added_rope_or_fabric),
    added_sku_consertado = Table.AddColumn(#"Removed Duplicates", "SKU Consertado", each 

        let
            _base_sku = [Base SKU],
            _sales_region = [Sales Region],
            _country_prefix = Text.Middle([SKU], 8,2),

            _full_sku = _country_prefix & "-" & _base_sku,
            _sales_region_base_sku = _sales_region & "-" & _base_sku,

            _amzn_sku = if _country_prefix = "OH" then _base_sku else _full_sku,
            
            _skuConsertado = 
                if Text.StartsWith([SKU], "OHAB-UNI-1416-FOW") or Text.StartsWith([SKU], "amzn.gr.OHAB-UNI-1416-FOW") then "US-OHAB-UNI-1416-FOW"
                else if Text.Contains([SKU], "amzn.gr.") then _amzn_sku
                else if Text.Contains([SKU], "Amazon.Found") then _sales_region_base_sku
                
                else [SKU]
    
    in
            _skuConsertado),
    addedKey_inventoryRegion_skuConsertado = Table.AddColumn(added_sku_consertado, "Key Column: Inventory Region | SKU Consertado", each [Inventory Region] & " | " & [SKU Consertado]),
    #"Changed Type" = Table.TransformColumnTypes(addedKey_inventoryRegion_skuConsertado,{{"Base SKU", type text}, {"SKU", type text}, {"FNSKU", type text}, {"Inventory Region", type text}, {"Sales Region", type text}, {"Country", type text}, {"Amazon Family", type text}, {"Marketplace", type text}, {"ASIN", type text}, {"Image URL", type text}, {"Brand - Code", type text}, {"Brand - Name", type text}, {"Product General Type - Code", type text}, {"Product General Type - Name", type text}, {"Product Specific Type - Code", type text}, {"Product Specific Type - Name", type text}, {"Product Type Complete - Name", type text}, {"Product Size - Code", type text}, {"Product Size - Name", type text}, {"Product Color - Code", type text}, {"Product Color - Name", type text}, {"Product Color - Pattern", type text}, {"Product Set - Quantity", type text}, {"Generic Family", type text},  {"Standard Family", type text}, {"Core Family", type text}, {"Native Family", type text}, {"Inner Type", type text}, {"Units / Carton", Int64.Type}, {"Carton Weight (kg)", type number}, {"Carton Dimensions (cm) Length", type number}, {"Carton Dimensions (cm) Width", type number}, {"Carton Dimensions (cm) Height", type number}, {"Carton CBM", type number}, {"AWD - Units / Carton", Int64.Type}, {"AWD - Carton Weight (kg)", type number}, {"AWD - Carton Dimensions (cm) Length", type number}, {"AWD - Carton Dimensions (cm) Width", type number}, {"AWD - Carton Dimensions (cm) Height", type number}, {"AWD - Carton CBM", type number}, {"Units / Package", Int64.Type}, {"Package Weight (kg)", type number}, {"Package Dimensions (cm) Length", type number}, {"Package Dimensions (cm) Width", type number}, {"Package Dimensions (cm) Height", type number}, {"Package CBM", type number}, {"Package Cubic Feet", type number}, {"is_grade_and_resell", type logical}, {"Grade", type text}, {"Key Column: Sales Region | SKU", type text}, {"Key Column: Sales Region | ASIN", type text}, {"Key Column: Sales Region | FNSKU", type text}, {"Key Column: Sales Region | Amazon Family", type text}, {"Key Column: Sales Region | Country | SKU", type text}, {"Key Column: Inventory Region | SKU", type text}, {"Key Column: Inventory Region | ASIN", type text}, {"Key Column: Inventory Region | FNSKU", type text}, {"Key Column: Country | SKU", type text}, {"Key Column: Country | ASIN", type text}, {"Key Column: Country | FNSKU", type text}, {"Key Column: Marketplace | SKU", type text}, {"Key Column: Marketplace | ASIN", type text}, {"Key Column: Marketplace | FNSKU", type text}, {"Sales Region | Base SKU", type text}, {"Inventory Region | Base SKU", type text}, {"Country | SKU", type text}, {"Country | Native Family", type text}, {"Refresh Date", type date}, {"ABC Profitability", type text}, {"ABC Co. Revenue", type text}, {"ABC Family Units", type text}, {"ABC Family Search Rank", type text}, {"Final ABC Classification", type text}, {"item_name", type text}, {"item_description", type text}, {"current_price", type number}, {"open_date", type text}, {"fulfillment_channel", type text}, {"status", type text}, {"Rope or Fabric", type text}, {"SKU Consertado", type text}, {"Key Column: Inventory Region | SKU Consertado", type text}})
in
    #"Changed Type"
```


### `z.dynamic_time_frame_switch`

**Modo:** `import`  
**Colunas:** `Start Date`, `Abbreviated Date`, `Time Frame`, `Time Frame Order`, `Date order' =`  
```powerquery
DISTINCT(
    UNION(
    SELECTCOLUMNS(
        'Calendar',
        "Start Date", 'Calendar'[Date],
        "Abbreviated Date", FORMAT('Calendar'[Date],"DD-MMM-YY"),
        "Time Frame", "Daily",
        "Time Frame Order", "1"
    ),
    SELECTCOLUMNS(
        'Calendar',
        "Start Date", 'Calendar'[Date],
        "Abbreviated Date", 'Calendar'[Year-Week 544],
        "Time Frame","Weekly",
        "Time Frame Order", "2"
    ),
    SELECTCOLUMNS(
        'Calendar',
        "Start Date", 'Calendar'[Date],
        "Abbreviated Date", FORMAT('Calendar'[Start of Month], "mmm yyyy"),
        "Time Frame","Monthly",
        "Time Frame Order", "3"
    ),
     SELECTCOLUMNS(
        'Calendar',
        "Start Date", 'Calendar'[Date],
        "Abbreviated Date", "Q" & 'Calendar'[Quarter] & " - " & 'Calendar'[Year],
        "Time Frame", "Quarterly",
        "Time Frame Order", "4"
    ),
     SELECTCOLUMNS(
        'Calendar',
        "Start Date", 'Calendar'[Date],
        "Abbreviated Date", 'Calendar'[Year],
        "Time Frame", "Yearly",
        "Time Frame Order", "5"
    )
)
)
```


### `z_errorFile`

**Modo:** `import`  **Grupo:** `'Custom Functions and Parameters'`  
**Colunas:** `Column1` int64  
```powerquery
let
    Source = "a",
    #"Converted to Table" = #table(1, {{Source}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Converted to Table",{{"Column1", Int64.Type}})
in
    #"Changed Type"
```


### `zz_Refresh_Control`

**Modo:** `import`  
**Colunas:** `ID`, `LastRefresh`  
```powerquery
ADDCOLUMNS(
    ROW("ID", 1),
    "LastRefresh", NOW()
)
```


### `zz_sales_channel_temporary`

**Modo:** `import`  
**Colunas:** `sales_channel_grouped`, `sales_channel_temporary`  
```powerquery
DATATABLE(
    "sales_channel_temporary", STRING,
    "sales_channel_grouped", STRING,
    {
        { BLANK(), "Amazon" },
        { "Amazon", "Amazon" },
        { "Etsy", "Etsy" }
    }
)
```



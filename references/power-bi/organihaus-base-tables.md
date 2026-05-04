# OrganiHaus - Base Tables (Dashboard)

## Visao Geral

Modelo semantico Power BI central da OrganiHaus. Serve como fonte de verdade para todos os dashboards analiticos da empresa via template `.pbit`. Consolida dados de vendas, inventario, anuncios, taxas, devolucoes e logistica da operacao Amazon e 3PL.

**Caminho do modelo:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Base Tables\OrganiHaus - Base Tables.SemanticModel`

**Escopo:** ~93 tabelas, 604 measures, 130+ relacionamentos

---

## Parametros e Funcoes Globais

| Nome | Tipo | Valor / Descricao |
|---|---|---|
| `path_to_files` | Parametro M | `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\` — prefixo de caminhos locais |
| `rootPathLang` | Parametro M | Raiz alternativa para paths em outros drives do Shared Drive |
| `bigQuery_customFunction` | Funcao M | Conecta ao projeto BigQuery `amazon-sp-api-openbridge` e retorna tabela por view/tabela |
| `folderAmazon` | Parametro M | Subfolder base para reports Amazon Seller Central |

---

## Arquitetura de Fontes

O modelo combina tres classes de fonte:

1. **BigQuery** `amazon-sp-api-openbridge` (warehouse principal, camadas Bronze/Silver/Gold)
2. **Arquivos locais** (Excel, CSV, pastas Amazon Seller Central, AWD, 3PL em `path_to_files`)
3. **Google Sheets** via BigQuery Gold layer (`1_Gold_Google_Sheets`)

### Camadas BigQuery

| Camada | Prefixo | O que entrega |
|---|---|---|
| Gold | `1_Gold_Sales_Returns` | Vendas, devolucoes, all orders |
| Gold | `1_Gold_Inventory` | FBA inventory snapshot, inventory ledger by FC, real-time |
| Gold | `1_Gold_Fees` | Fee preview |
| Gold | `1_Gold_Amz_Ads` | SP, SB, SD advertised products, search terms, purchased products |
| Gold | `1_Gold_Aux` | Order IDs dimension, daily share of storage fee, listings |
| Gold | `1_Gold_Google_Sheets` | Order records, transfer details (do Google Sheets via BQ) |
| Silver | `2_Silver_Business_Reports` | Business reports por filho de produto |
| Silver | `2_Silver_Aux` | Grade & resell Amazon found SKUs |
| Bronze | `3_Bronze_Aux` | Sponsored ads dimension, inventory countries |

---

## Tabelas do Modelo

### SKUs
**Categoria:** Dimensao mestre
**Fonte:** Combinacao de `SKUs (raw)` (BigQuery Gold) + `dgradeAndResellAmazonFoundSkus` (BigQuery Silver)
**Transformacoes:** adiciona coluna `is_grade_and_resell` (prefixo "amzn.gr."), constroi multiplas chaves compostas: `Sales Region | SKU`, `Marketplace | SKU`, `Country | SKU`, `Inventory Region | SKU`, `Sales Region | Base SKU`, `Inventory Region | Base SKU`, `Country | Native Family`

### Calendar
**Categoria:** Dimensao temporal
**Fonte:** Calculada em M (sem fonte externa), de 01/01/2019 ate hoje + 750 dias
**Transformacoes:** gera calendario diario, adiciona Year-Week 544 (calendario fiscal 4-4-5), Start of Month, Quarter - Year, Year-Month, Year, semanas ISO

### Inbound Shipments
**Categoria:** Transferencias (Google Sheets via BigQuery)
**Fonte:** Derivada de `td_full_order_transfer_details` (BigQuery `1_Gold_Google_Sheets.td_full_order_transfer_details`)
**Transformacoes:** renomeia `key_inventory_region_sku` para "Key Column: Region | SKU", padroniza colunas origin, type, deliver_at_type

### Inventory Ledger
**Categoria:** Inventario
**Fonte:** Combinacao de `raw_usCaMx_inventoryLedgerByCountry` + `raw_gbEu_inventoryLedgerByCountry` (pastas de fulfillment)
**Transformacoes:** Table.Combine, adiciona `Key Column: Country | SKU` e `Key Column: Country | ASIN`

### f.AllOrders
**Categoria:** Vendas
**Fonte:** BigQuery `1_Gold_Sales_Returns.vw_full_all_orders`
**Transformacoes:** filtro de range de datas

### f.AmazonFulfilledShipments
**Categoria:** Fulfillment
**Fonte:** Combinacao de `raw_usCaMx_amazonFulfilledShipments` + `raw_gbEu_amazonFulfilledShipments` (pastas de fulfillment)
**Transformacoes:** Table.Combine, merge com `d.AmazonOrderId` para adicionar order_id_SK e sales_marketplace

### f.FBACustomerReturns
**Categoria:** Devolucoes
**Fonte:** BigQuery `1_Gold_Sales_Returns.vw_full_fba_customer_returns`
**Transformacoes:** filtro de periodo

### f.us_returns_processing_fee
**Categoria:** Fees de devolucao
**Fonte:** Pasta `path_to_files\amazon_seller_central\fulfillment\payments_returns_processing_fee\`
**Transformacoes:** Folder.Files, combina CSVs, padroniza colunas

### fact.aged_inventory_surcharge
**Categoria:** Taxas de inventario
**Fonte:** Pasta `path_to_files\amazon_seller_central\fulfillment\payments_aged_inventory_surcharge\`
**Transformacoes:** Folder.Files, combina US/CA/MX + GB/EU, calcula valores diarios

### fact_amz_business_report
**Categoria:** Business Reports
**Fonte:** BigQuery `2_Silver_Business_Reports.vw_business_report_by_child_asin`
**Transformacoes:** filtro de periodo, merge com SKUs

### fact_average_landed_cost
**Categoria:** Custo (Standalone)
**Fonte:** `path_to_files\standalone_files\Average Landed Cost - Base SKU.xlsx` -> aba DataBase
**Transformacoes:** mesma logica do Profitability — build serie diaria, fill forward, retropreenchimento 2021

### fact_awd_monthly_storage_fee
**Categoria:** AWD
**Fonte:** `raw_awdMonthlyStorageFee` (pasta `path_to_files\amazon_seller_central\awd\`)
**Transformacoes:** seleciona colunas chave (month_of_charge, key, currency, volumes, fee_type, amounts)

### fact_awd_monthly_processing_fee
**Categoria:** AWD
**Fonte:** `raw_awdMonthlyProcessingFee` (pasta AWD)
**Transformacoes:** seleciona colunas (month_of_charge, fee_type, key, currency, box_qty, fee_amount, amounts)

### fact_awd_monthly_transportation_fee
**Categoria:** AWD
**Fonte:** `raw_awdMonthlyTransportationFee` (pasta AWD)
**Transformacoes:** seleciona colunas (month_of_charge, fee_type, key, currency, fee_amount, amounts)

### fact_awd_transportation_measurements
**Categoria:** AWD
**Fonte:** pasta AWD (medicoes de transporte)
**Transformacoes:** seleciona colunas de volume/peso por shipment

### fact_awd_inventory_ledger_by_country
**Categoria:** AWD / Inventario
**Fonte:** Pasta `path_to_files\amazon_seller_central\fulfillment\inventory_awd_inventory_ledger\`
**Transformacoes:** Folder.Files, combina, adiciona chaves

### fact_db_results_tio
**Categoria:** TIO (Tool for Inventory Optimization) — Log
**Fonte:** Pasta `rootPathLang\OrganiHaus\5.2 - OH Inventory Management\TIO - Tool for Inventory Optimization\Logs de calculo\Oficial_For_Orders\`
**Transformacoes:** carrega apenas o arquivo com Date modified mais recente (`List.Max`), combina todas as abas
**Atencao:** depende do arquivo mais recente — apagar logs muda o output.
**Relacionamentos:**

| Coluna (from) | Tabela (to) | Coluna (to) | Cardinalidade | Ativo |
|---|---|---|---|---|
| `fact_db_results_tio.start_of_week` | `Calendar` | `'Start of Week'` | many-to-one | ✓ |
| `fact_db_results_tio.key_inventory_region_sku` | `SKUs` | `'Key Column: Inventory Region | SKU Consertado'` | many-to-one | ✓ |

**Medidas DAX:** ⚠️ não documentadas — verificar `Measurement Table` no Power BI Desktop e filtrar por medidas que referenciam `fact_db_results_tio`.

### fact_db_results_VO
**Categoria:** Voice of Customer — Log
**Fonte:** Pasta `rootPathLang\OrganiHaus\5.1 - OH Sales & Performance\05. Forecasting\VO - Voice of Customer\`
**Transformacoes:** mesmo padrao de fact_db_results_tio — carrega arquivo mais recente

### fact_estimated_future_daily_storage_fee
**Categoria:** Projecao de storage fee
**Fonte:** Derivada de `aux_dailyShareOfStorageFee` + `fact_estimated_future_monthly_storage_fee`
**Transformacoes:** merge por start_of_month + sku, expande valores mensais para diarios

### fact_exchange_rates
**Categoria:** Taxas de cambio (Standalone)
**Fonte:** CSV `rootPathLang\OrganiHaus\3.1 - OH Data & Reports\standalone_files\td_exchange_rates.csv`
**Transformacoes:** leitura direta, type conversions

### fact_fba_fee_expected
**Categoria:** Fees estimadas (Standalone)
**Fonte:** `path_to_files\standalone_files\db_fba_fee_expected.xlsx`
**Transformacoes:** leitura, filtros, padronizacao

### fact_fba_inventory
**Categoria:** Inventario FBA
**Fonte:** BigQuery `1_Gold_Inventory.vw_full_fba_manage_inventory`
**Transformacoes:** filtro de data, selecao de colunas

### fact_fba_manage_inventory_real_time
**Categoria:** Inventario FBA (tempo real)
**Fonte:** BigQuery `1_Gold_Inventory.vw_full_fba_manage_inventory_real_time`
**Transformacoes:** sem filtro de data (snapshot atual)

### fact_fbaGrade&ResellReport
**Categoria:** Grade & Resell
**Fonte:** Pasta de fulfillment (grade & resell reports Amazon)
**Transformacoes:** Folder.Files, combina reports

### fact_fee_preview
**Categoria:** Preview de fees
**Fonte:** BigQuery `1_Gold_Fees.vw_full_fee_preview`
**Transformacoes:** filtros, selecao de colunas

### fact_inventory_3pl
**Categoria:** Inventario 3PL
**Fonte:** Combinacao de multiplas pastas 3PL:
- `raw_3PL_US_SSG` — 3PL US (SSG)
- `raw_3PL_GB_WWL` — 3PL GB (WWL)
- `raw_3PL_GB_PGS` — 3PL GB (PGS)
- `raw_3PL_CA_DCI` — 3PL CA (DCI)
- `raw_3PL_CA_PGS` — 3PL CA (PGS)
**Transformacoes:** Table.Combine, detecta Inventory Region pelo prefixo do campo Date (us_, gb_, ca_)

### fact_inventory_ledger_by_fulfillment_center
**Categoria:** Inventario por FC
**Fonte:** BigQuery `1_Gold_Inventory.vw_full_inventory_ledger_summary_by_fulfillment_center`
**Transformacoes:** filtros, merge com d.fulfillmentCentersAddress

### fact_life_cycle
**Categoria:** Ciclo de vida do produto
**Fonte:** `raw_lifeCycle` (Excel standalone)
**Transformacoes:** adiciona `key_inventory_region_sku`, seleciona date_life_cycle, key e life_cycle

### fact_order_records
**Categoria:** Google Sheets
**Fonte:** BigQuery `1_Gold_Google_Sheets.td_full_order_records`
**Transformacoes:** selecao de colunas, merge com Calendar

### fact_sb_attributed_purchase
**Categoria:** Sponsored Brands (advertising)
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_sb_attributed_purchases`
**Transformacoes:** filtros de periodo, merge com SKUs

### fact_sb_search_terms
**Categoria:** Sponsored Brands — Search Terms
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_sb_search_terms`

### fact_sb_spend_by_sku
**Categoria:** Sponsored Brands — Spend por SKU
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_consolidated_sb_attributed_purchase`
**Transformacoes:** split de key_marketplace_sku em marketplace + sku

### fact_sd_advertised_products
**Categoria:** Sponsored Display (advertising)
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_sd_advertised_products`

### fact_seller_suport_cases
**Categoria:** Casos de suporte Amazon (Standalone)
**Fonte:** CSV `rootPathLang\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_amazon_remeasurement_cases.csv`
**Transformacoes:** promote headers, remove coluna vazia, type conversions
**Nota:** typo intencional "suport" (falta um p)

### fact_SCPR_all_reviews
**Categoria:** SCPR (Supply Chain Performance Review)
**Fonte:** `path_to_files\standalone_files\Supply Chain Performance Review (SCPR).xlsx`
**Transformacoes:** leitura de aba de reviews, filtros, padronizacao

### fact_sp_advertised_products
**Categoria:** Sponsored Products — Advertised Products
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_sp_advertised_products`
**Nota:** inclui staging US dos ultimos 10 dias (STAGING_fact_cross_sales append)

### fact_sp_purchased_products
**Categoria:** Sponsored Products — Purchased Products
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_sp_purchased_products`

### fact_sp_search_terms
**Categoria:** Sponsored Products — Search Terms
**Fonte:** BigQuery `1_Gold_Amz_Ads.vw_full_amz_ads_sp_search_terms`

### fact_storage_fee_daily
**Categoria:** Storage fee diaria
**Fonte:** Derivada de `aux_dailyShareOfStorageFee` (BigQuery Gold) + `silver_fStorageFeeMonthly` (reports mensais de fulfillment)
**Transformacoes:** merge por start_of_month + key_region_fnsku, expande taxa mensal para valor diario

### fact_storage_fee_measurements
**Categoria:** Medicoes de storage fee
**Fonte:** Pastas de fulfillment (storage fee measurements)

### fact_velocity
**Categoria:** Velocidade de vendas (Standalone)
**Fonte:** `path_to_files\standalone_files\Velocity Database.xlsx`
**Transformacoes:** leitura, filtros, calculo de velocidade por SKU/periodo

### fact_awd_transportation_measurements, fact_storage_fee_measurements
**Categoria:** Medicoes AWD/Storage
**Fonte:** pastas AWD e fulfillment respectivamente

### f_aging_projection
**Categoria:** Projecao de aging (Standalone)
**Fonte:** Pasta `path_to_files\standalone_files\db_aging_projection\`
**Transformacoes:** Folder.Files, carrega multiplos arquivos de projecao

### f_aux_promo_tracker, f_promotion_tracker
**Categoria:** Rastreador de promocoes (Standalone)
**Fonte:** `rootPathLang\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_promotion_tracker.xlsx`

### f_db_base_price, f_db_market_price
**Categoria:** Preco base e de mercado (Standalone)
**Fonte:** `path_to_files\standalone_files\db_market_base_price.xlsx`
**Transformacoes:** leitura de abas distintas, filtros de vigencia

### f_db_loss_leader
**Categoria:** Loss leader pricing (Standalone)
**Fonte:** `rootPathLang\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_loss_leader.xlsx`

### f_storage_fee_rate
**Categoria:** Taxas de storage fee (Standalone)
**Fonte:** `path_to_files\standalone_files\db.storagefee_rate.xlsx`

### STAGING_fact_cross_sales
**Categoria:** Staging (US, ultimos 10 dias)
**Fonte:** BigQuery `1_Gold_Sales_Returns.vw_full_cross_sales`
**Transformacoes:** filtro para ultimos 10 dias de US apenas, append sobre fact_sp_advertised_products para cobrir latencia do BigQuery

### td_full_order_transfer_details
**Categoria:** Transferencias (Google Sheets via BigQuery)
**Fonte:** BigQuery `1_Gold_Google_Sheets.td_full_order_transfer_details`

### dim_sponsored_ads
**Categoria:** Dimensao de tipos de ads
**Fonte:** BigQuery `3_Bronze_Aux.td_sponsored_ads`

### d.AmazonOrderId
**Categoria:** Dimensao de order IDs
**Fonte:** BigQuery `1_Gold_Aux.vw_full_dimension_amazon_order_id`

### d.fulfillmentCentersAddress
**Categoria:** Dimensao de FCs
**Fonte:** CSV `path_to_files\standalone_files\td_fulfillment_centers_address.csv`

### dim_SCPR_category, dim_SCPR_factory, dim_SCPR_freight, dim_SCPR_type
**Categoria:** Dimensoes SCPR
**Fonte:** `path_to_files\standalone_files\Supply Chain Performance Review (SCPR).xlsx` (abas distintas)

### fact_amz_business_report
**Categoria:** Business Reports
**Fonte:** BigQuery `2_Silver_Business_Reports.vw_business_report_by_child_asin`

---

## Tabelas Auxiliares e de Parametros

| Tabela | Tipo | Descricao |
|---|---|---|
| `Contracted liquidator rate` | GENERATESERIES | Serie de 0.05 a 0.105 com step 0.005 — slicer de taxa de liquidacao |
| `Measurement Table` | Tabela de measures | Todas as 604 measures DAX centralizadas |
| `z.dynamic_time_frame_switch` | Field parameter | Seletor de granularidade temporal (Daily/Weekly/Monthly/Quarterly) |
| `z.dynamic_parameter_units_revenue_price` | Field parameter | Alterna entre Units / Revenue / Price em visuais |
| `z.dynamic_Inventory_selector` | Field parameter | Alterna tipo de inventario exibido |
| `z.dynamic_Inventory_column_axis / line_axis` | Field parameter | Eixos dinamicos para grafico de inventario |
| `z.dynamic_GC_selector / Rows / Values` | Field parameter | Seletores dinamicos para Growth Comparison |
| `z.dynamic_traffic_channel` | Field parameter | Seletor de canal de trafego |
| `z.dynamic_coupon_usage_percentage` | Field parameter | Seletor de % de uso de cupom |
| `z.dynamic_parameter_low_stock_tacos_acos` | Field parameter | Toggle entre Low Stock / TACOS / ACOS |
| `dim_calendar_aux` | Dimensao | Calendario auxiliar para comparacao de periodos inativos (Growth Comparison) |
| `dim_skus_aux` | Dimensao | Copia auxiliar de SKUs para self-joins em PPC Cross Sales |
| `dim_bar_chart_aging_projection` | DATATABLE calculada | Labels para eixo de grafico de aging |
| `dim_scatter_plot_mapped_returns` | DATATABLE calculada | Seletor de modo de scatter plot de devolucoes |
| `dim_order_IDs` | Google Sheets | Derivada de td_full_order_transfer_details |
| `Time range avg selling price` | DATATABLE calculada | Seletor de range para preco medio |
| `The Date Picker` | DATATABLE calculada | Seletor de data especifica |
| `tab_parameters_measurements` | Parametros | Parametros para tabela de measures |
| `rootPathLang` | Parametro M | Path alternativo para o drive |
| `zz_Refresh_Control` | Calculada | Timestamp do ultimo refresh |
| `z.errorFile` | Diagnostico | Forca erro no refresh para validar pipeline |
| `z.list_of_warehouse_names` | DATATABLE calculada | Lista de nomes de warehouses 3PL |
| `z.parameter_coverage_selection` | Parametro | Parametro de cobertura de inventario |
| `z.RowHeaderScorecardPpc` | DATATABLE calculada | Labels para linhas do scorecard de PPC |
| `z.RowHeaderScorecardCoverage` | DATATABLE calculada | Labels para linhas do scorecard de cobertura |
| `z.dynamic_Legend_Picker_ads performance` | Field parameter | Seletor de campo para legenda de Ads Performance |
| `z.dynamic_SP_all_metrics` | Field parameter | Seletor unificado de metricas SP ($, u e %) |
| `z.dynamic_SP_absolute` | Field parameter | Seletor de metricas SP absolutas ($ e u) |
| `z.dynamic_SP_relative` | Field parameter | Seletor de metricas SP percentuais (%) |
| `z.dynamic_Fees_absolute` | Field parameter | Seletor de metricas de fees absolutas ($ e u) |
| `z.dynamic_Fees_relative` | Field parameter | Seletor de metricas de fees percentuais (%) |
| `shifting_fba_costs_aux_table` | Auxiliar | Aux para calculo de FBA costs com defasagem |
| `SCPR_Metrics` | DATATABLE calculada | Metricas da SCPR |

---

## Relacionamentos e Chaves Compostas

O modelo usa **chaves compostas concatenadas** com separador ` | `. Ha 9 variacoes por granularidade:

| Chave | Formato | Usada em |
|---|---|---|
| Marketplace + SKU | `"Marketplace | SKU"` | Vendas, SP ads |
| Marketplace + ASIN | `"Marketplace | ASIN"` | SP search terms |
| Country + SKU | `"Country | SKU"` | AWD fees, pagamentos |
| Country + ASIN | `"Country | ASIN"` | Devolucoes |
| Inventory Region + SKU | `"Inventory Region | SKU"` | 3PL, storage fee |
| Inventory Region + ASIN | `"Inventory Region | ASIN"` | Inventory ledger |
| Inventory Region + FNSKU | `"Inventory Region | FNSKU"` | Storage fee diaria |
| Country + Native Family | `"Country | Native Family"` | Retornos por familia |
| Sales Region + Base SKU | `"Sales Region | Base SKU"` | Growth Comparison |

**Relacionamentos bidirecionais (apenas 5):** z.dynamic_time_frame_switch <-> Calendar, Calendar <-> dim_calendar_aux (inativo), fact_SCPR_all_reviews <-> dim_SCPR_category, Inbound Shipments <-> dim_order_IDs, td_full_order_transfer_details <-> SKUs, f.FBACustomerReturns <-> f.AllOrders.

**Relacionamentos inativos:** varios — ativados via USERELATIONSHIP em measures especificas (ex: f_aging_projection tem relacoes com file_date e date_aging_projection).

---

## Measures (604 total — Measurement Table)

Organizadas por DisplayFolder:

| Dominio | Prefixo | Exemplos |
|---|---|---|
| Sales | `$_revenue`, `u_units_sold`, `%_revenue_loss` | Sales, Net Revenue, Units Sold, Revenue Loss |
| PPC | `$_ppc_*`, `%_ppc_*`, `u_ppc_*` | SP/SB/SD Sales, Spend, TACOS, ACOS, CTR, CVR |
| Inventory | `u_inventory_*`, `%_low_stock`, `u_stock_projection` | Ending inventory, Low Stock, Stock Projection |
| Storage Fee | `$_estimated_storage_fee`, `$_aging_surcharge_*` | Storage Fee, Aging Surcharge atual e projetado |
| Returns | `%_mapped_return_rate`, `u_mapped_return_units` | Return Rate, Returned Units, Returns Fee |
| Traffic | `u_sessions_total`, `%_unit_session`, `%_buy_box` | Sessions, Page Views, CVR, Buy Box % |
| Growth Comparison | `*_inactive_calendar`, `*_difference_between_periods` | Delta $, Delta %, usando calendar inativo |
| YoY / MoM | `ux_ui_%_*_yoy`, `ux_ui_%_*_mom` | Cards de variacao com simbolo +/- para UI |
| Scorecard | `ppc_scorecard`, `coverage_scorecard` | Measures de scorecard tabeladas |

**Padroes:**
- Time intelligence manual (PBI_TimeIntelligenceEnabled = 0): usa DATEADD, SAMEPERIODLASTYEAR
- Prefixo `ux_ui_` = measure formatada para exibicao em cards com simbolo +/-
- Sufixo `_inactive_calendar` = usa USERELATIONSHIP com dim_calendar_aux para Growth Comparison
- Prefixo `q_count_difference_between_two_dates` = contador de periodo para label

---

## Pontos de Atencao

| Problema | Descricao |
|---|---|
| Typo `suport` | Tabela `fact_seller_suport_cases` |
| Pastas `Delete?` | Algumas measures em pastas marcadas para delecao ainda ativas |
| STAGING US-only | STAGING_fact_cross_sales cobre apenas US dos ultimos 10 dias |
| Logs como fonte | fact_db_results_tio e VO leem o arquivo mais recente da pasta |

---

## Paginas e Visuais

O report tem 10 paginas visiveis, 2 ocultas (Scorecard PPC + TT_Sales tooltip) e 1 de export.

---

### Pagina: Sales

Analise de vendas com visao por periodo, familia e SKU. Usa sistema de granularidade dinamica (544 week).

#### Slicers

| Campo | Descricao |
|---|---|
| `Calendar[Date]` | Filtro de range de data |
| `Calendar[Year-Week 544]` | Semana fiscal (calendario 4-4-5) |
| `z.dynamic_time_frame_switch[Time Frame]` | Granularidade: Daily/Weekly/Monthly |
| `z.dynamic_parameter_units_revenue_price[Sales]` | Toggle Units / Revenue / Price |
| `SKUs[Amazon Family]` | Filtro por familia |
| `SKUs[Native Family]` | Filtro por familia nativa |
| `SKUs[Sales Region]` + `SKUs[Country]` | Filtro por regiao e pais |
| `SKUs[SKU]` | Filtro por SKU |
| `SKUs[Final ABC Classification]` | Filtro por classificacao ABC |

#### Grafico de Linha/Coluna — Revenue Loss e Units Sold

| Role | Campo | Label |
|---|---|---|
| Eixo X (Category) | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Barras (Y) | `Measurement Table[%_revenue_loss]` | Revenue Loss |
| Barras (Y) | `Measurement Table[%_revenue_loss_previous_year]` | Revenue Loss - Prev. Year |
| Linhas (Y2) | `Measurement Table[u_units_sold]` | Units Sold |
| Linhas (Y2) | `Measurement Table[u_units_sold_previous_year]` | Units Sold - Prev. Year |

#### pivotTable — Revenue Loss por Familia

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Amazon Family]`, `SKUs[Base SKU]` | |
| Values | `Measurement Table[%_revenue_loss]` | Revenue Loss |
| Values | `Measurement Table[%_revenue_loss_previous_year]` | Revenue Loss - Prev. Year |

#### pivotTable — Units Sold por Familia

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Amazon Family]`, `SKUs[Base SKU]` | |
| Values | `Measurement Table[u_units_sold]` | Units Sold |
| Values | `Measurement Table[u_units_sold_previous_two_weeks]` | Units Sold - Prev. Year |
| Values | `Measurement Table[u_units_sold_difference_yoy]` | Units Diff |

#### KPI Card

Sales ($), PPC Sales ($), Total Units Sold, PPC Spend ($), TACOS, ACOS.

---

### Pagina: Inventory

Visao de inventario com posicao atual, projecao e low stock.

#### Slicers

`Calendar[Year-Week 544]`, `Calendar[Date]`, `SKUs[Final ABC Classification]`, `SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[SKU]`, `SKUs[Inventory Region]` + `SKUs[Country]`, `z.dynamic_time_frame_switch[Time Frame]`, `z.dynamic_Inventory_selector[Inventory Type]`

#### Grafico de Linha/Coluna — Inventario e Vendas

| Role | Campo | Label |
|---|---|---|
| Eixo X | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Barras (Y) | `Measurement Table[u_quantity_inbound_shipments_amazon]` | Inbound Shipments - Amazon |
| Barras (Y) | `Measurement Table[u_stock_projection]` | Amazon Available Inventory - Estimate |
| Barras (Y) | `Measurement Table[u_inventory_ending_plus_transit]` | Amazon Available Inventory - Actual |
| Linhas (Y2) | `Measurement Table[u_units_sold]` | Units Sold |

#### pivotTable — Inventario por SKU

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Amazon Family]`, `SKUs[Base SKU]`, `SKUs[SKU]` | |
| Values | `Measurement Table[%_low_stock]` | Low Stock (%) |
| Values | `Measurement Table[u_units_sold]` | Units Sold |
| Values | `Measurement Table[u_inventory_ending_plus_transit]` | Last Inventory Position |

#### Grafico de Barras — Low Stock por Familia

| Role | Campo | Label |
|---|---|---|
| Category | `SKUs[Amazon Family]` | Native Family |
| Y | `Measurement Table[count_low_stock]` | |

#### KPI Card

Sales ($), PPC Sales ($), Total Units Sold, Low Stock (%), TACOS, ACOS.

---

### Pagina: Growth Comparison

Comparativo de dois periodos distintos usando `dim_calendar_aux` (calendario inativo). Measures com sufixo `_inactive_calendar` usam USERELATIONSHIP com dim_calendar_aux.

#### Slicers

`Calendar[Date]`, `dim_calendar_aux[Date aux]` (segundo periodo), `SKUs[Sales Region]` + `SKUs[Country]`, `SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[SKU]`, `z.dynamic_GC_selector[Group]`

#### pivotTable — Comparativo Completo

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Country]`, `SKUs[Amazon Family]`, `SKUs[Sales Region | Base SKU]` | |
| Values | Net Sales (Promotion Only), Net Sales (Promotion & VAT) | |
| Values | Delta $ Net Sales, Delta % Net Sales | _inactive_calendar |
| Values | Commercial Profit, Delta % Commercial Profit | |
| Values | Operational Profit, Delta % Operational Profit | |
| Values | Total Units Sold, Delta U Units Sold, Delta % Units Sold | |
| Values | Net Average Price (Before), Net Average Price, Delta % Net Avg Price | |
| Values | Organic Sales, Delta % Organic Sales | |
| Values | PPC Sales, Delta $ PPC Sales, Delta % PPC Sales | |
| Values | PPC Spend, Delta $ PPC Spend, Delta % PPC Spend | |
| Values | PPC Sales Ratio, Delta pp PPC Sales Ratio | |
| Values | TACOS, Delta pp TACOS | |
| Values | ACOS, Delta pp ACOS | |

---

### Pagina: Ads Performance

Analise completa de PPC por tipo de campanha (SP, SB, SD).

#### Slicers

`SKUs[Amazon Family]`, `SKUs[Native Family]` (2x: slicer e listSlicer), `SKUs[Country]`, `SKUs[SKU]`, `Calendar[Date]`, `z.dynamic_time_frame_switch[Time Frame]` (2x), `z.dynamic_Legend_Picker_ads performance` (seletor de campo), `z.dynamic_SP_all_metrics`, `z.dynamic_SP_absolute`, `z.dynamic_SP_relative`

#### Grafico de Linha 1 — SB Units Sold por Familia

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Series | `SKUs[Native Family]` | |
| Y | `Measurement Table[u_ppc_sb_att_pur_units_sold]` | SB Units Sold |

#### Grafico de Linha 2 — Total Units e Ads Sales Ratio

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Y | `Measurement Table[u_units_sold]` | Total Units Sold |
| Y2 | `Measurement Table[%_ppc_ratio_revenue]` | Ads Sales Ratio |

#### pivotTable — Ads Performance Completo por SKU

Rows: Country, Amazon Family, Inventory Region | Base SKU. Measures SP: Revenue, Net Revenue, Units, Organic Sales, PPC Sales, Spend, Units, TACOS, ACOS, Impressions, Clicks, CTR, CPC, Orders, CVR, Advertised SKU Sales/Units, Other SKU Sales/Units. Measures SB: Sales, Spend, Units, TACOS, ACOS, Sales Ratio. Measures SD: Sales, Spend, Units, TACOS, ACOS, Sales Ratio. Tambem inclui %_low_stock.

---

### Pagina: Inv - Mapped Returns

Analise de devolucoes mapeadas por ASIN, com scatter plot e comparativos YoY.

#### Slicers

`SKUs[Sales Region]`, `SKUs[is_grade_and_resell]`, `SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[Life Cycle]`, `Calendar[Year]` + `Calendar[Year-Month]`, `dim_scatter_plot_mapped_returns` (modo do scatter)

#### Scatter Plot — Return Rate vs Returned Units

| Role | Campo | Label |
|---|---|---|
| Category | `SKUs[Life Cycle]` | |
| Series | `SKUs[Life Cycle]` | |
| X | `Measurement Table[%_mapped_return_rate]` | return rate |
| Y | `Measurement Table[u_mapped_return_units]` | returned units |
| Size | `Measurement Table[$_sku_returns_fee]` | returns fee |
| Tooltip | `Measurement Table[u_units_shipped]` | shipped units |

#### Graficos de Linha/Coluna (2 graficos)

1. Return Rate YoY: Category=Calendar[Start of Month], Barras=u_mapped_return_units (sply e current), Linhas=%_mapped_return_rate (sply e current)
2. Returns Fee YoY: Category=Calendar[Start of Month], Barras=$_sku_returns_fee (sply e current), Linhas=u_units_shipped (sply e current)

#### pivotTables (2 — por SKU e por familia)

Measures: u_units_shipped, u_mapped_return_units, %_mapped_return_rate, threshold/return_rate_threshold, return_impact_share, return_impact_yoy, u_sku_returned_units_charged, $_sku_returns_fee, returns_fee_share.

#### KPI Cards

%_avg_mapped_return_rate, %_mapped_return_rate por regiao (US/EU/CA/GB/MX), avg_weighted_days_between_purchase_return, median_days_between_purchase_return.

---

### Pagina: Inventory Maps

Mapa de inventario por fulfillment center (Azure Map visual) com KPI cards de variacao MoM/YoY.

#### Slicers

`Calendar[Date]`, `Calendar[Year-Week 544]`, `SKUs[Sales Region]` + `SKUs[Country]`, `SKUs[Native Family]`, `SKUs[SKU]`, `d.fulfillmentCentersAddress[fulfillment_center_id]`, `d.fulfillmentCentersAddress[is_problematic]`

#### Azure Map 1 — por Estado

| Role | Campo |
|---|---|
| Category | `d.fulfillmentCentersAddress[state]` |
| Tooltip | `Measurement Table[u_inventory_fulfillmet_center_end_plus_transit]` |

#### Azure Map 2 — por Coordenada

| Role | Campo |
|---|---|
| X (Longitude) | `d.fulfillmentCentersAddress[longitude]` |
| Y (Latitude) | `d.fulfillmentCentersAddress[latitude]` |
| Size | `Measurement Table[u_inventory_fulfillmet_center_end_plus_transit]` |

#### pivotTable — Inventario por FC

Rows: fulfillment_center_id, Amazon Family, Inventory Region | Base SKU, SKU. Value: u_inventory_fulfillmet_center_end_plus_transit.

#### KPI Cards de Variacao (ux_ui_ measures)

YoY: Revenue, PPC Revenue, PPC Spend, PPC TACOS, PPC ACOS, Units Sold.
MoM: Units Sold, PPC Revenue, PPC Spend, PPC TACOS, PPC ACOS.

---

### Pagina: PPC Cross Sales

Analise de cross-selling via Sponsored Products — quantas unidades de "outros SKUs" foram vendidas via anuncios de um SKU especifico.

#### Slicers

`Calendar[Year-Week 544]`, `Calendar[Date]`, `SKUs[Sales Region]` + `SKUs[Country]`, `SKUs[Amazon Family]`, `SKUs[Native Family]`, `SKUs[SKU Consertado]`, `dim_skus_aux[Life Cycle]`

#### pivotTables (3)

1. Rows: Country, Amazon Family, Native Family, Inventory Region | Base SKU — Values: Other SKU Units (Purchased Product), Same Amazon Family
2. Rows: Country, dim_skus_aux[Amazon Family], dim_skus_aux[Native Family], dim_skus_aux[Inventory Region | Base SKU] — Values: Other SKU Units, Same SKU Units (Advertised), Total (Same + Other)
3. Rows: Country, Amazon Family, Native Family, Inventory Region | Base SKU — Values: Other SKU Units, Same SKU Units, Total, % Other SKU Units, Units Sold, SP CTR, SP CVR

---

### Pagina: Inv - Aging

Gerenciamento de inventario com risco de surcharge de envelhecimento. Inclui simulacao de velocidade de vendas e projecao de custos.

#### Slicers

`SKUs[Amazon Family]`, `SKUs[Native Family]`, `SKUs[SKU]`, `SKUs[Inventory Region]`, `SKUs[Life Cycle]`, `SKUs[is_grade_and_resell]`, `Calendar[Year-Month]` + `Calendar[Year-Week 544]`, `Contracted liquidator rate[Contracted liquidator rate]`, `f_aging_projection[range]`, `Time range avg selling price[Time range avg selling price]`, `dim_bar_chart_aging_projection`

#### pivotTable Principal — Simulacao de Aging

Rows: Inventory Region, SKU. Measures: acao em curso, aging surcharge projetada, inventario atual, inventario disponivel, inventario simulado, inventario com surcharge, % inventario com surcharge, target sales, dias ate simulacao, daily avg units 30d, target velocity, delta velocidade, cobertura em dias, custo real aging, custo projetado cumulativo, storage fee cumulativo, total cumulativo, custo ate o fim, sunk cost liquidacoes, % margem liquidacao.

#### pivotTables de Historico (2)

1. Columns=Inventory Region, Rows=Calendar[Year-Month], Values=$_aging_surcharge_last_file
2. Columns=Inventory Region, Rows=Calendar[Year-Month], Values=$_projected_storage_fee

#### Graficos

- Bar chart 100% stacked: Category=Calendar[Year-Month], Series=f_aging_projection[range], Y=sum_inventory_by_inbound_shipments_last_file
- Bar chart horizontal 100% stacked: Category=SKUs[Inventory Region], Series=f_aging_projection[range]
- Barra simples: Category=SKUs[Life Cycle], Y=$_aging_surcharge_last_file + $_projected_storage_fee
- Linha/Coluna — inventario: Category=Calendar[Year-Month/Week], Y=u_inventory_ending_plus_transit, Y2=u_units_sold
- Linha/Coluna — snapshot vs projecao: Category=Calendar[Start of Month], Y=$_aging_surcharge_snapshot + $_aging_surcharge_actual_projection, Y2=%_diff_aging_surcharge_projection_snapshot

#### KPI Cards

sum_aging_surcharge por regiao (CA/EU/GB/US/MX/Total), $_avg_aging_surcharge_actual_previous_12_months, _previous_3_months, _previous_month.

---

### Pagina: Traffic

Analise de trafego organico (Business Reports Amazon) — sessions, page views, unit session %.

#### Slicers

`SKUs[Amazon Family]`, `SKUs[Native Family]`, `SKUs[Final ABC Classification]`, `SKUs[Sales Region]` + `SKUs[Country]`, `SKUs[SKU]`, `Calendar[Date]`, `Calendar[Year-Week 544]`, `z.dynamic_time_frame_switch[Time Frame]`, `z.dynamic_traffic_channel[Channel]`

#### Grafico de Linha — Sessoes e CVR

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Y | `Measurement Table[%_unit_session]` | Unit Session % |
| Y2 | `Measurement Table[u_sessions_total]` | Sessions |
| Y2 | `Measurement Table[u_page_views_total]` | Page Views |

#### Scatter Plot — Sessoes vs CVR

| Role | Campo |
|---|---|
| Category | `SKUs[Amazon Family]`, `SKUs[SKU Consertado]` |
| X | `Measurement Table[u_sessions_total]` |
| Y | `Measurement Table[%_unit_session]` |
| Size | `Measurement Table[u_total_units_ordered]` |

#### pivotTable — Trafego por Familia

Rows: Sales Region, Amazon Family, Base SKU. Values: Unit Session %, Page View per Session, Sessions, Page Views, Units Sold, Avg Buy Box %, Available Inventory.

#### KPI Card

Total Sessions, Total Page Views, Unit Session %, Page View per Session, Major Session Channel.

---

### Pagina: Fee Analysis

Analise de storage fees por SKU e regiao, com estimativa de cobertura de inventario.

#### Slicers

`SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[Inventory Region]`, `SKUs[SKU]`, `SKUs[is_grade_and_resell]`, `Calendar[Date]`, `Calendar[Year]` + `Calendar[Year-Month]`, `z.dynamic_time_frame_switch[Time Frame]`, `z.dynamic_Fees_relative` (chiclet), `z.dynamic_Fees_absolute` (chiclet)

#### Grafico de Linha — Storage Fee e Inventario

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Y | `Measurement Table[u_inventory_ending_plus_transit]` | Inventory: Ending + Transit |
| Y | `Measurement Table[u_units_sold]` | Units Sold |
| Y2 | `Measurement Table[%_estimated_storage_fee_over_revenue]` | % Storage Fee |

#### pivotTables (2 — por SKU e por regiao/familia/SKU)

Measures: $_estimated_storage_fee, $_estimated_storage_fee_share, u_quantity_on_hand_storage_fee, %_estimated_storage_fee_over_revenue, u_units_sold, u_inventory_ending_plus_transit, u_average_units_sold_previous_30_days, u_inventory_coverage.

---

### Pagina: Scorecard - PPC (oculta)

Scorecard tabelado de PPC com granularidade dinamica.

#### Slicers

`SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[Country]`, `SKUs[SKU Consertado]`, `Calendar[Date]`, `z.dynamic_time_frame_switch[Time Frame]`, `dim_sponsored_ads[sponsored_ads]`, `z.RowHeaderScorecardPpc[row_header]`

#### pivotTables (2)

1. Columns=z.dynamic_time_frame_switch[Abbreviated Date], Rows=Country + z.RowHeaderScorecardPpc[row_header], Values=ppc_scorecard
2. Columns=z.dynamic_time_frame_switch[Abbreviated Date], Rows=Country + Amazon Family + z.RowHeaderScorecardPpc[row_header], Values=ppc_scorecard

---

### Pagina: TT_Sales (tooltip, oculta)

Tooltip customizado acionado por hover na pagina Sales. Contem 2 cards:

| Card | Measures |
|---|---|
| Card 1 | u_units_sold, u_units_sold_previous_year, $_net_revenue, $_net_revenue_previous_year, $_net_average_price, $_net_average_price_previous_year, $_organic_revenue, $_ppc_sales, $_revenue, $_avg_landed_cost, $_avg_landed_cost_last_year |
| Card 2 | %_low_stock, %_low_stock_previous_year, %_ppc_tacos, %_ppc_sp_adv_prod_acos, %_revenue_loss, %_revenue_loss_previous_year |

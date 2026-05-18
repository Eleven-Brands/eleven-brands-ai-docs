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

## Medidas DAX — Measurement Table (735 medidas)


### 3PL Reports

#### `u_inventory_3pl_reports_available_for_transfer`

**Depende de colunas:** `'fact_inventory_3pl'[Available]`, `'fact_inventory_3pl'[Date]`  
```dax
// Calculates the Total Available Inventory in the 3PL partner designed to a specifc warehouse for the sellable items, considering both the Context and Report filters. Works with time aggregators.

    VAR _maxDate = CALCULATE(MAX('fact_inventory_3pl'[Date]), ALL('fact_inventory_3pl'[Date]))

    VAR _3plAvailable = 
        CALCULATE(
            SUM ( 'fact_inventory_3pl'[Available] )
            , FILTER(
                'fact_inventory_3pl'
                , 'fact_inventory_3pl'[Date] = _maxDate
            )
        )

RETURN
    _3plAvailable * DIVIDE ( _3plAvailable, _3plAvailable )
```

#### `u_inventory_3pl_reports_allocated`

**Depende de colunas:** `'fact_inventory_3pl'[Allocated]`, `'fact_inventory_3pl'[Date]`  
```dax
// Calculates the Total Allocated Inventory in the 3PL partner designed to a specifc warehouse for the sellable items, considering both the Context and Report filters. Works with time aggregators.
    
CALCULATE(
    SUM ( 'fact_inventory_3pl'[Allocated] )
    , FILTER(
        'fact_inventory_3pl'
        , 'fact_inventory_3pl'[Date] = MAX ( 'fact_inventory_3pl'[Date] )
    )
)
```

#### `u_inventory_3pl_reports_on_hand`

**Depende de colunas:** `'fact_inventory_3pl'[Date]`, `'fact_inventory_3pl'[On Hand]`  
```dax
CALCULATE(
     SUM ( 'fact_inventory_3pl'[On Hand] )
     , FILTER(
         'fact_inventory_3pl'
         , 'fact_inventory_3pl'[Date] = MAX('fact_inventory_3pl'[Date])
     )
 )
```

#### `u_inventory_3pl_reports_receiving_area`

**Depende de colunas:** `'fact_inventory_3pl'[Date]`, `'fact_inventory_3pl'[Receiving Area]`  
```dax
// Calculates the Total Receiving Area Inventory in the 3PL partner designed to a specifc warehouse for the sellable items, considering both the Context and Report filters. Works with time aggregators.
    
CALCULATE(
    SUM ( 'fact_inventory_3pl'[Receiving Area] )
    , FILTER(
        'fact_inventory_3pl'
        , 'fact_inventory_3pl'[Date] = MAX ( 'fact_inventory_3pl'[Date] )
    )
)
```

#### `u_inventory_3pl_reports_in_transit`

**Depende de colunas:** `'fact_inventory_3pl'[Date]`, `'fact_inventory_3pl'[In Transit]`  
```dax
CALCULATE(
    SUM ( 'fact_inventory_3pl'[In Transit] )
    , FILTER(
        'fact_inventory_3pl'
        , 'fact_inventory_3pl'[Date] = MAX ( 'fact_inventory_3pl'[Date] )
    )
)
```


### Alerts Panel

#### `d_days_with_no_sales`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Calendar'[is_future]`, `'f.AllOrders'[date_all_orders]`  
```dax
VAR _current_row_date = 
    CALCULATE( 
        MAX( 'Calendar'[Date] ) 
        , 'Calendar'[is_future] = FALSE
    )

VAR _last_sales = 
      CALCULATE(
          MAX('Calendar'[Date])
        , FILTER(
            ALL('Calendar')
            , 'Calendar'[Date] <= _current_row_date
            && CALCULATE( [u_units_sold] ) > 0
          )
      )
VAR max_sale_date = MAX('f.AllOrders'[date_all_orders])

RETURN
    DATEDIFF(_last_sales, _current_row_date, DAY)
    +
    IF(
        max_sale_date = TODAY()
        , 0
        , -1 * DATEDIFF(max_sale_date, TODAY(), DAY)
    )
```

#### `m_slope_last_12_weeks`

**Depende de medidas:** `[X]`, `[Y]`, `[m_last_closed_week]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[YearWeekNum]`  
```dax
VAR _last_closed_week =
    VAR YearPart = VALUE(LEFT([m_last_closed_week], 4))
    VAR WeekPart = VALUE(RIGHT([m_last_closed_week], LEN([m_last_closed_week]) - 5))
    RETURN YearPart * 100 + WeekPart

VAR _weeks_table =
    TOPN(
        12,
        SUMMARIZE(
            FILTER(ALL('Calendar'), 'Calendar'[YearWeekNum] <= _last_closed_week),
            'Calendar'[YearWeekNum]
        ),
        'Calendar'[YearWeekNum], DESC
    )

VAR _indexed_weeks =
    ADDCOLUMNS(
        _weeks_table,
        "X", RANKX(_weeks_table, 'Calendar'[YearWeekNum], , ASC),
        "Y", CALCULATE(
            [u_units_sold],
            KEEPFILTERS('Calendar'[YearWeekNum] = EARLIER('Calendar'[YearWeekNum]))
        )
    )

VAR _avgX = AVERAGEX(_indexed_weeks, [X])
VAR _avgY = AVERAGEX(_indexed_weeks, [Y])

VAR _num =
    SUMX(_indexed_weeks, ([X] - _avgX) * ([Y] - _avgY))

VAR _den =
    SUMX(_indexed_weeks, ([X] - _avgX) ^ 2)

RETURN
    DIVIDE(_num, _den)
```

#### `m_last_closed_week`

**Depende de colunas:** `'Calendar'[End of Week]`, `'Calendar'[Year-Week 544]`  
```dax
VAR _max_closed =
    MAXX(
        FILTER(
            ALL ( 'Calendar' ),
            'Calendar'[End of Week] < TODAY()
        ),
        'Calendar'[Year-Week 544]
    )
RETURN
    _max_closed
```

#### `m_last_week_vs_prev3`

**Depende de medidas:** `[m_last_closed_week]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[YearWeekNum]`  
```dax
VAR _last_closed_week =
    VAR YearPart = VALUE(LEFT([m_last_closed_week], 4))
    VAR WeekPart = VALUE(RIGHT([m_last_closed_week], LEN([m_last_closed_week]) - 5))
    RETURN YearPart * 100 + WeekPart

VAR __LastWeekValue =
    CALCULATE(
         [u_units_sold] ,
        'Calendar'[YearWeekNum]  = _last_closed_week
    )
VAR __Prev3WeeksValue =
    CALCULATE(
        [u_units_sold] ,
        FILTER (
            ALL ( 'Calendar'[YearWeekNum] ),
            'Calendar'[YearWeekNum]  < _last_closed_week
                && 'Calendar'[YearWeekNum]  >= _last_closed_week - 3
        )
    )

RETURN
    DIVIDE ( __LastWeekValue, DIVIDE (__Prev3WeeksValue, 3, BLANK()), BLANK() ) - 1
```

#### `m_diff_sales_velocity`

**Depende de medidas:** `[m_sold_last_week]`, `[m_velocity_last_week]`  
```dax
IF( ISBLANK([m_sold_last_week]) && ISBLANK([m_velocity_last_week]), BLANK(),
DIVIDE( [m_sold_last_week],[m_velocity_last_week], BLANK() ) - 1)
```

#### `m_week_vs_prev3_dynamic`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[YearWeekNum]`  
```dax
VAR _current_week = MAX('Calendar'[YearWeekNum])
VAR _prev_weeks =
    FILTER(
        ALL('Calendar'[YearWeekNum]),
        'Calendar'[YearWeekNum] < _current_week
    )
VAR _prev3_weeks =
    TOPN(3, _prev_weeks, 'Calendar'[YearWeekNum], DESC)
VAR _sales_current_week =
    COALESCE([u_units_sold], 0)
VAR _avg_prev3_weeks =
    CALCULATE(
        AVERAGEX(
            VALUES('Calendar'[YearWeekNum]),
            COALESCE([u_units_sold], 0)
        ),
        KEEPFILTERS(_prev3_weeks)
    )
RETURN
IF (
    NOT ISBLANK(_avg_prev3_weeks) && _avg_prev3_weeks <> 0,
    DIVIDE(_sales_current_week, _avg_prev3_weeks) - 1,
    BLANK()
)
```

#### `m_slope_classification`

**Depende de medidas:** `[m_slope_last_12_weeks]`  
```dax
VAR slope = [m_slope_last_12_weeks]
RETURN
    SWITCH(
        TRUE(), // 5% Treshold
        slope > 0.05, "Crescimento Forte",
        slope > 0.01, "Crescimento Leve",
        slope >= -0.01, "Estável",
        slope >= -0.05, "Queda Leve",
        "Queda Forte"
    )
```

#### `m_last_week_vs_prev3_classification`

**Depende de medidas:** `[m_last_week_vs_prev3]`  
```dax
VAR _diff = [m_last_week_vs_prev3]
RETURN
    SWITCH(
        TRUE(),
        ISBLANK(_diff), "Sem dados",
        _diff >= 0.1, "Alta Forte",
        _diff >= 0.03, "Alta Moderada",
        _diff > -0.03, "Estável",
        _diff > -0.1, "Queda Moderada",
        "Queda Forte"
    )
```

#### `m_sold_last_week`

**Depende de medidas:** `[m_last_closed_week]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[YearWeekNum]`  
```dax
VAR _last_closed_week =
    VAR YearPart = VALUE(LEFT([m_last_closed_week], 4))
    VAR WeekPart = VALUE(RIGHT([m_last_closed_week], LEN([m_last_closed_week]) - 5))
    RETURN YearPart * 100 + WeekPart

VAR __LastWeekValue =
    CALCULATE(
         [u_units_sold] ,
        'Calendar'[YearWeekNum]  = _last_closed_week
    )

RETURN
    __LastWeekValue
```

#### `m_velocity_last_week`

**Depende de medidas:** `[m_last_closed_week]`, `[u_weekly_velocity]`  
**Depende de colunas:** `'Calendar'[YearWeekNum]`  
```dax
VAR _last_closed_week =
    VAR YearPart = VALUE(LEFT([m_last_closed_week], 4))
    VAR WeekPart = VALUE(RIGHT([m_last_closed_week], LEN([m_last_closed_week]) - 5))
    RETURN YearPart * 100 + WeekPart

VAR __LastWeekValue =
    CALCULATE(
         [u_weekly_velocity] ,
        'Calendar'[YearWeekNum]  = _last_closed_week
    )

RETURN
    __LastWeekValue
```

#### `m_sold_prev3`

**Depende de medidas:** `[m_last_closed_week]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[YearWeekNum]`  
```dax
VAR _last_closed_week =
    VAR YearPart = VALUE(LEFT([m_last_closed_week], 4))
    VAR WeekPart = VALUE(RIGHT([m_last_closed_week], LEN([m_last_closed_week]) - 5))
    RETURN YearPart * 100 + WeekPart

VAR __Prev3WeeksValue =
    CALCULATE(
        [u_units_sold] ,
        FILTER (
            ALL ( 'Calendar'[YearWeekNum] ),
            'Calendar'[YearWeekNum]  < _last_closed_week
                && 'Calendar'[YearWeekNum]  >= _last_closed_week - 3
        )
    )
RETURN
    DIVIDE( __Prev3WeeksValue, 3, BLANK())
```

#### `m_last_stock`

```dax

```

#### `d_days_with_no_sales_weighted_avg`

**Depende de medidas:** `[DaysNoSales]`, `[Weight]`, `[d_days_with_no_sales]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'SKUs'[Base SKU]`  
```dax
VAR _table =
    ADDCOLUMNS(
        SUMMARIZE( 'SKUs', 'SKUs'[Base SKU]),
        "DaysNoSales", [d_days_with_no_sales],
        "Weight", [u_inventory_ending_plus_transit]
    )
RETURN
    DIVIDE(
        SUMX( _table, [DaysNoSales] * [Weight] ),
        SUMX( _table, [Weight] )
    )
```

#### `m_abs_diff_sales_velocity`

**Depende de medidas:** `[m_sold_last_week]`, `[m_velocity_last_week]`  
```dax
IF( 
    ISBLANK([m_sold_last_week]) && ISBLANK([m_velocity_last_week])
    , BLANK()
    , ABS([m_sold_last_week]-[m_velocity_last_week])
    )
```

#### `u_weekly_velocity_sum_agg`

**Depende de medidas:** `[m_last_closed_week]`  
**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Weekly Velocity]`  
```dax
VAR _last_closed_week =
    VAR YearPart = VALUE(LEFT([m_last_closed_week], 4))
    VAR WeekPart = VALUE(RIGHT([m_last_closed_week], LEN([m_last_closed_week]) - 5))
    RETURN YearPart * 100 + WeekPart

RETURN
    CALCULATE(
        SUM('fact_velocity'[Updated Weekly Velocity]),
        FILTER(
            'fact_velocity',
            'fact_velocity'[Date] = _last_closed_week
        )
    )
```


### Aux for Dashboards\Others

#### `u_units_sold_difference_yoy`

**Depende de medidas:** `[u_units_sold]`, `[u_units_sold_previous_year]`  
```dax
[u_units_sold] - [u_units_sold_previous_year]
```

#### `u_units_sold_average_14_days`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
//conta oficial july
    VAR _timeFrame = 14
    VAR _lastDate = LASTDATE('Calendar'[Date])
    VAR _datesBetween =
        DATESBETWEEN(
            'Calendar'[Date],
            DATEADD(_lastDate, - _timeFrame, DAY),
            DATEADD(_lastDate, - 1, DAY)
        )

    VAR _rollingAverage =
        AVERAGEX(
            _datesBetween
            , [u_units_sold]
        )

RETURN
    _rollingAverage
```

#### `u_range_velocity low stock`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Daily Velocity]`  
```dax
VAR _velocity =
        CALCULATE(
            SUM ( 'fact_velocity'[Updated Daily Velocity] )
            , FILTER(
                'fact_velocity'
                , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
            )
        )

return
    SUM ( 'fact_velocity'[Updated Daily Velocity] )
```

#### `d_date_next_inbound_shipment_to_amazon`

**Depende de medidas:** `[d_report_last_date_of_inventory_ledger_daily]`  
**Depende de colunas:** `'Inbound Shipments'[Deliver At Type]`, `'Inbound Shipments'[Delivery Date]`  
```dax
VAR _nextArrivalDate =
        CALCULATE (
            MIN ( 'Inbound Shipments'[Delivery Date] )
            , FILTER (
                'Inbound Shipments'
                , 'Inbound Shipments'[Delivery Date] >= [d_report_last_date_of_inventory_ledger_daily]
                    && 'Inbound Shipments'[Deliver At Type] = "Amazon"
            )
        )

RETURN
    _nextArrivalDate
```

#### `$_total_last_fba_fee_calculation_expected`

**Depende de medidas:** `[$_unit_last_fba_fee_calculation_expected]`, `[u_sum_units_sold_last_45_days]`  
**Depende de colunas:** `'Calendar'[Date]`, `SKUs[Country | SKU]`  
```dax
VAR _totalFbaFee = 
        SUMX(
            VALUES( SKUs[Country | SKU] )
            , SUMX(
                VALUES('Calendar'[Date])
                , [$_unit_last_fba_fee_calculation_expected] * [u_sum_units_sold_last_45_days]
            )
        )

RETURN
    _totalFbaFee
```

#### `$_total_fba_fee_fee_preview old`

**Depende de medidas:** `[$_unit_fba_fee_fee_preview]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[DATE]`, `SKUs[Key Column: Country | SKU]`  
```dax
VAR _result = 
        SUMX ( 
            VALUES('Calendar'[DATE])
            , SUMX ( 
                VALUES ( SKUs[Key Column: Country | SKU] )
                , [$_unit_fba_fee_fee_preview] * [u_units_sold]
            ) 
        )

RETURN
    _result
```

#### `$_net_average_price_difference_yoy`

**Depende de medidas:** `[$_net_average_price]`, `[$_net_average_price_previous_year]`  
```dax
[$_net_average_price] - [$_net_average_price_previous_year]
```


### Aux for Dashboards\Slicer Filters

#### `aux_blank_measure_slicer_filter`

```dax
blank()
```


### Aux for Dashboards\UX/UI - Cards

#### `ux_ui_%_ppc_revenue_month_over_month_mom`

**Depende de medidas:** `[%_ppc_revenue_month_over_month_mom]`  
```dax
VAR _value = [%_ppc_revenue_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_revenue_year_over_year_yoy`

**Depende de medidas:** `[%_ppc_revenue_year_over_year_yoy]`  
```dax
VAR _value = [%_ppc_revenue_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_spend_year_over_year_yoy`

**Depende de medidas:** `[%_ppc_spend_year_over_year_yoy]`  
```dax
VAR _value = [%_ppc_spend_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_revenue_month_over_month_mom`

**Depende de medidas:** `[%_revenue_month_over_month_mom]`  
```dax
VAR _value = [%_revenue_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_revenue_year_over_year_yoy`

**Depende de medidas:** `[%_revenue_year_over_year_yoy]`  
```dax
VAR _value = [%_revenue_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_units_sold_month_over_month_mom`

**Depende de medidas:** `[%_units_sold_month_over_month_mom]`  
```dax
VAR _value = [%_units_sold_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_units_sold_year_over_year_yoy`

**Depende de medidas:** `[%_units_sold_year_over_year_yoy]`  
```dax
VAR _value = [%_units_sold_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_spend_month_over_month_mom`

**Depende de medidas:** `[%_ppc_spend_month_over_month_mom]`  
```dax
VAR _value = [%_ppc_spend_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_tacos_year_over_year_yoy`

**Depende de medidas:** `[%_ppc_tacos_year_over_year_yoy]`  
```dax
VAR _value = [%_ppc_tacos_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.00 p.p") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_tacos_month_over_month_mom`

**Depende de medidas:** `[%_ppc_tacos_month_over_month_mom]`  
```dax
VAR _value = [%_ppc_tacos_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.00 p.p") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_acos_month_over_month_mom`

**Depende de medidas:** `[%_ppc_acos_month_over_month_mom]`  
```dax
VAR _value = [%_ppc_acos_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.00 p.p") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_ppc_acos_year_over_year_yoy`

**Depende de medidas:** `[%_ppc_acos_year_over_year_yoy]`  
```dax
VAR _value = [%_ppc_acos_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.00 p.p") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_low_stock_year_over_year_yoy`

**Depende de medidas:** `[%_low_stock_year_over_year_yoy]`  
```dax
VAR _value = [%_low_stock_year_over_year_yoy]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```

#### `ux_ui_%_low_stock_month_over_month_mom`

**Depende de medidas:** `[%_low_stock_month_over_month_mom]`  
```dax
VAR _value = [%_low_stock_month_over_month_mom]
    VAR _valueFormated = FORMAT(_value, "0.0%") 
    VAR _arrowUpDown =     
        IF (
            _value >= 0
            , UNICHAR ( 9650 )
            , UNICHAR ( 9660 )
        )

    VAR _ui_ux = _arrowUpDown & " " & _valueFormated

RETURN
    _ui_ux
```


### Average Landed Cost

#### `$_average_landed_cost_before_delivery_date`

**Depende de medidas:** `[d_delivery_date_inbound_shipments]`  
**Depende de colunas:** `'fact_average_landed_cost'[Date]`, `'fact_average_landed_cost'[unit_cost]`  
```dax
VAR _deliveryDay = [d_delivery_date_inbound_shipments]
    VAR _landedCostDate =
        CALCULATE (
            MAX('fact_average_landed_cost'[Date])
            , FILTER ( 
                'fact_average_landed_cost'
                , 'fact_average_landed_cost'[Date] <= _deliveryDay 
            ) 
        ) 

    VAR _averageLandedCost =
        MAXX(
            FILTER (
                'fact_average_landed_cost'
                , 'fact_average_landed_cost'[Date] = _landedCostDate
            )
            , ROUND('fact_average_landed_cost'[unit_cost], 2 ) 
        )

RETURN
    _averageLandedCost
```


### Coverage

#### `d_coverage_in_months`

**Depende de medidas:** `[u_fba_inventory_estimated_units_181_plus]`, `[u_sum_units_sold_last_30_days]`  
```dax
VAR _coverage =
        DIVIDE(
            [u_fba_inventory_estimated_units_181_plus]
            , [u_sum_units_sold_last_30_days]
        )

RETURN
    _coverage
```

#### `u_one_week_coverage_velocity`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Daily Velocity]`  
```dax
CALCULATE(
    MAX ( 'fact_velocity'[Updated Daily Velocity] )
    , FILTER(
        'fact_velocity'
        , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
    )
)
```

#### `u_daily_coverage`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_velocity'[Date]`, `'fact_velocity'[Minimum Inventory]`  
```dax
VAR _lastDailyCoverage =
        CALCULATE(
            MAXX (
                FILTER(
                    'fact_velocity'
                    , 'fact_velocity'[Date] = MAX('fact_velocity'[Date])
                )
                , 'fact_velocity'[Minimum Inventory]
            )
            ,FILTER (
                ALL('fact_velocity')
                , 'fact_velocity'[Date] <= MAX ('Calendar'[Date] )
            )
        )

RETURN
    _lastDailyCoverage
```

#### `u_inventory_coverage`

**Depende de medidas:** `[U_inventory_ending_plus_transit]`, `[u_average_units_sold_previous_30_days]`  
```dax
DIVIDE(
    [U_inventory_ending_plus_transit], 
    [u_average_units_sold_previous_30_days], 
    0
)
```

#### `days_inventory_coverage`

**Depende de medidas:** `[daily_avg_u_solds_30d]`, `[inventory_start]`  
```dax
DIVIDE(
    [inventory_start], 
    [daily_avg_u_solds_30d],
    BLANK()
)
```

#### `d_amazon_coverage_in_days`

**Depende de medidas:** `[u_daily_velocity_aggregated]`, `[u_inventory_ending_plus_transit]`  
```dax
VAR _inventory = [u_inventory_ending_plus_transit]
    VAR _velocity  = [u_daily_velocity_aggregated]
    VAR _coverage  = DIVIDE(_inventory, _velocity, 0)
return
    _coverage
```

#### `d_awd_coverage_in_days`

**Depende de medidas:** `[u_daily_velocity_aggregated]`, `[u_inventory_awd_available]`  
```dax
VAR _inventory = [u_inventory_awd_available]
    VAR _velocity  = [u_daily_velocity_aggregated]
    VAR _coverage  = DIVIDE(_inventory, _velocity, 0)
return
    _coverage
```

#### `d_amazon_awd_coverage_in_days`

**Depende de medidas:** `[u_daily_velocity_aggregated]`, `[u_inventory_awd_available]`, `[u_inventory_ending_plus_transit]`  
```dax
VAR _inventory = [u_inventory_ending_plus_transit] + [u_inventory_awd_available]
    VAR _velocity  = [u_daily_velocity_aggregated]
    VAR _coverage  = DIVIDE(_inventory, _velocity, 0)
return
    _coverage
```

#### `%_dif_coverage_in_days`

**Depende de medidas:** `[d_amazon_awd_coverage_in_days]`, `[d_amazon_coverage_in_days]`, `[d_awd_coverage_in_days]`  
**Depende de colunas:** `'z.dynamic_time_frame_switch'[Date Order]`, `'z.dynamic_time_frame_switch'[Date order]`, `'z.parameter_coverage_selection'[parameter_coverage_selection Name]`  
```dax
VAR _current_start_date = MAX('z.dynamic_time_frame_switch'[Date order])
    VAR _previous_last_date = _current_start_date - 1

    VAR _current_coverage = 
        SWITCH(
            SELECTEDVALUE( 'z.parameter_coverage_selection'[parameter_coverage_selection Name], 0 )
            , "Amazon", [d_amazon_coverage_in_days]
            , "AWD", [d_awd_coverage_in_days]
            , "Amazon + AWD", [d_amazon_awd_coverage_in_days]
        )

    VAR _previous_coverage =
        CALCULATE(
            SWITCH(
                SELECTEDVALUE( 'z.parameter_coverage_selection'[parameter_coverage_selection Name], 0 )
                , "Amazon", [d_amazon_coverage_in_days]
                , "AWD", [d_awd_coverage_in_days]
                , "Amazon + AWD", [d_amazon_awd_coverage_in_days]
            )
            , FILTER(
                ALL( 'z.dynamic_time_frame_switch' ),
                'z.dynamic_time_frame_switch'[Date Order] = _previous_last_date
            )
        )


    VAR _diff = 
        IF(
            NOT( ISBLANK( _previous_coverage ) ) && _previous_coverage <> 0,
            DIVIDE( _current_coverage - _previous_coverage, _previous_coverage ),
            BLANK()
        )

RETURN
    _diff
```

#### `coverage_scorecard_switch`

**Depende de medidas:** `[d_amazon_awd_coverage_in_days]`, `[d_amazon_coverage_in_days]`, `[d_awd_coverage_in_days]`, `[u_daily_velocity]`, `[u_inventory_awd_available]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'z.RowHeaderScorecardCoverage'[row_header]`, `'z.parameter_coverage_selection'[parameter_coverage_selection Name]`, `SKUs[SKU]`  
```dax
VAR _row_header = SELECTEDVALUE('z.RowHeaderScorecardCoverage'[row_header])

    VAR _current_coverage = 
        SWITCH(
            SELECTEDVALUE( 'z.parameter_coverage_selection'[parameter_coverage_selection Name], 0 )
            , "Amazon", [d_amazon_coverage_in_days]
            , "AWD", [d_awd_coverage_in_days]
            , "Amazon + AWD", [d_amazon_awd_coverage_in_days]
        )



RETURN
    SWITCH( 
        TRUE()
        , ISINSCOPE('z.RowHeaderScorecardCoverage'[row_header])
            , SWITCH(
                TRUE()
                , _row_header = "Inventory: Amazon", [u_inventory_ending_plus_transit]
                , _row_header = "Inventory: AWD", [u_inventory_awd_available]
                , _row_header = "Velocity Daily", [u_daily_velocity]
            )

        , ISINSCOPE(SKUs[SKU])
            , _current_coverage
    )
```

#### `coverage_scorecard_conditional_formatting_background`

**Depende de medidas:** `[coverage_scorecard_switch]`  
```dax
VAR v = [coverage_scorecard_switch]
    
    VAR _ok       = "#FFFFFF"  //  White
    VAR _regular  = "#ff8389"  // Light Red
    VAR _bad      = "#da1e28"  // Red
    VAR _very_bad = "#750e13"  // Dark Red
    
    VAR _color =
        SWITCH(
            TRUE(),
            v >= 0   && v <= 30,   _very_bad,
            v > 30   && v <= 60,   _regular,
            v > 60   && v <= 90,   _ok,
            v > 90   && v <= 120,  _regular,
            v > 120  && v <= 180,  _bad,
            v > 180,               _very_bad,
            BLANK()
        )

RETURN
    _color
```

#### `coverage_scorecard_conditional_formatting_font`

**Depende de medidas:** `[coverage_scorecard_switch]`  
```dax
VAR v = [coverage_scorecard_switch]
    
    VAR _ok       = "#000000"  // Black
    VAR _regular  = "#000000"  // Black
    VAR _bad      = "#000000"  // Black
    VAR _very_bad = "#ffd7d9"  // Light Pink
    
    VAR _color =
        SWITCH(
            TRUE(),
            v >= 0   && v <= 30,   _very_bad,
            v > 30   && v <= 60,   _regular,
            v > 60   && v <= 90,   _ok,
            v > 90   && v <= 120,  _regular,
            v > 120  && v <= 180,  _bad,
            v > 180,               _very_bad,
            BLANK()
        )

RETURN
    _color
```


### Dates\Date Differences

#### `q_count_difference_between_two_dates`

**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _minDate = MIN ( 'Calendar'[Date] )
    VAR _maxDate = MAX ( 'Calendar'[Date] )
    VAR _dateDifference = DATEDIFF( _minDate, _maxDate + 1, DAY )

RETURN 
    _dateDifference
```

#### `q_count_difference_between_two_dates_for_visuals`

**Depende de medidas:** `[q_count_difference_between_two_dates]`  
```dax
[q_count_difference_between_two_dates] & " days"
```

#### `q_count_difference_between_two_dates_for_visuals_range_2`

**Depende de medidas:** `[q_count_difference_between_two_dates_for_visuals]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
// It is for the INACTIVE CALENDAR ONLY. Uses the calculation of the difference bewteen the selected dates and concatenates with the word "days". Context and Report filters regarding to date are applied.

    VAR _dateDifference = 
        CALCULATE (
            [q_count_difference_between_two_dates_for_visuals]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP ( 'Calendar'[Date], 'dim_calendar_aux'[Date aux] )
        )

RETURN
    _dateDifference
```

#### `d_monthly_share_of_days`

**Depende de medidas:** `[q_count_difference_between_two_dates]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _datesInMonth = DATEDIFF ( STARTOFMONTH ( 'Calendar'[Date] ), ENDOFMONTH ( 'Calendar'[Date] ) + 1, DAY )
    VAR _monthlyShareOfDays = DIVIDE ( [q_count_difference_between_two_dates], _datesInMonth )

RETURN 
    _monthlyShareOfDays
```


### Dates\Reports First and Last Dates

#### `d_report_last_date_of_inventory_ledger_daily`

**Depende de colunas:** `'Inventory Ledger'[Date]`  
```dax
VAR _lastDate = CALCULATE ( MAX ( 'Inventory Ledger'[Date] ), ALL ( 'Inventory Ledger') )

RETURN
    _lastDate
```

#### `d_report_last_date_of_inventory_ledger_weekly`

**Depende de colunas:** `'Inventory Ledger'[Date]`  
```dax
// Retrieves the last date of the last week record of inventory ledger 

    VAR _lastDateWeekly = MAXX ( FILTER ( ALL( 'Inventory Ledger'), WEEKDAY ( 'Inventory Ledger'[Date] ) = 7 ), 'Inventory Ledger'[Date] )

RETURN
    _lastDateWeekly
```

#### `d_inventory_last_date_of_week`

**Depende de colunas:** `'Inventory Ledger'[Date]`  
```dax
// Retrieves the final date of the week of the last week selected, considering the application of filters.

    VAR _lastDayOfWeek = MAX ( 'Inventory Ledger'[Date] )

return
    _lastDayOfWeek + ( 7 - WEEKDAY ( _lastDayOfWeek, 1 ) )
```

#### `d_inventory_first_date_of_week`

**Depende de colunas:** `'Inventory Ledger'[Date]`  
```dax
// Retrieves the first date of the week of the last week selected, considering the application of filters.
    
    VAR _firstDayOfWeek = MAX ( 'Inventory Ledger'[Date] )

return
    _firstDayOfWeek - ( WEEKDAY ( _firstDayOfWeek, 1 ) ) +1
```

#### `d_report_last_date_of_inventory_3pl_daily`

**Depende de colunas:** `'fact_inventory_3pl'[Date]`  
```dax
VAR _lastDate = CALCULATE ( MAX ( 'fact_inventory_3pl'[Date] ), ALL ( 'fact_inventory_3pl') )

RETURN
    _lastDate
```

#### `d_report_last_date_of_velocity_daily`

**Depende de colunas:** `'fact_velocity'[Date]`  
```dax
// Retrieves the last date record of velocity data 

    VAR _lastDate = CALCULATE ( MAX ( 'fact_velocity'[Date] ), ALL ( 'fact_velocity') )

RETURN
    _lastDate
```

#### `d_report_last_date_of_inventory_3pl_weekly`

**Depende de medidas:** `[d_report_last_date_of_inventory_3pl_daily]`  
**Depende de colunas:** `'fact_inventory_3pl'[Date]`  
```dax
VAR _lastDateDaily = [d_report_last_date_of_inventory_3pl_daily]
    VAR _lastSaturday = _lastDateDaily - WEEKDAY ( _lastDateDaily, 1 )
    VAR _lastDateWeekly = 
        CALCULATE(
            MAX('fact_inventory_3pl'[Date])
            , FILTER ( ALL('fact_inventory_3pl'), 'fact_inventory_3pl'[Date] < _lastSaturday )
            , ALL(SKUs)
        )

RETURN
    _lastDateWeekly
```

#### `d_report_last_date_of_average_landed_cost`

**Depende de colunas:** `'fact_average_landed_cost'[Date]`  
```dax
VAR _lastDate = CALCULATE ( MAX ( 'fact_average_landed_cost'[Date] ), ALL ( 'fact_average_landed_cost') )

RETURN
    _lastDate
```

#### `d_report_last_date_of_fba_inventory_report_daily`

**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`  
```dax
VAR _lastDate = CALCULATE ( MAX ( 'fact_fba_inventory'[date_fba_inventory] ), ALL ( 'fact_fba_inventory') )

RETURN
    _lastDate
```

#### `d_report_last_date_of_fba_manage_inventory_report_real_time_daily`

**Depende de colunas:** `'fact_fba_manage_inventory_real_time'[date_fba_manage_inventory_real_time]`  
```dax
VAR _lastDate = CALCULATE ( MAX ( 'fact_fba_manage_inventory_real_time'[date_fba_manage_inventory_real_time] ), ALL ( 'fact_fba_manage_inventory_real_time') )

RETURN
    _lastDate
```


### Dates\SKUs & ASINs Dates

#### `d_first_date_of_sku_by_inventory`

**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`  
```dax
// Retrieves the first record date of inventory. Only SKUs context filters are applied.
    VAR _firstDate =
        CALCULATE(
            CALCULATE(
                FIRSTDATE ( 'Inventory Ledger'[Date] )
                , FILTER ( 'Inventory Ledger', 'Inventory Ledger'[Disposition] = "Sellable" )
            )
            , CROSSFILTER('Calendar'[Date], 'Inventory Ledger'[Date], None)
        )
    
RETURN
    _firstDate
```

#### `d_last_date_of_sku_by_inventory`

**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `SKUs[Life Cycle]`  
```dax
// Retrieves the last record date of inventory. Only SKUs context filters are applied.

    var _D_and_P_lastDateOfInventory = CALCULATE ( CALCULATE(
                                                    LASTDATE('Inventory Ledger'[Date])
                                                    , FILTER ( 'Inventory Ledger', 'Inventory Ledger'[Disposition] = "Sellable" ) )
                                                , FILTER ( 'SKUs', SKUs[Life Cycle] = "P" 
                                                                || SKUs[Life Cycle] = "D" )
                                                , CROSSFILTER ( 'Calendar'[Date], 'Inventory Ledger'[Date], None ) )


    var _maxDateInventoryLedger = CALCULATE( MAX('Inventory Ledger'[Date]), all('Inventory Ledger'))

RETURN
    IF(
        OR ( MIN(SKUs[Life Cycle]) = "D", MIN(SKUs[Life Cycle]) = "P" )
        , _D_and_P_lastDateOfInventory
        , _maxDateInventoryLedger
    )
```

#### `d_first_date_of_asin_by_inventory`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
// Retrieves the first record date of inventory by ASIN. Only ASINs context filters are applied.

    VAR _firstDate = CALCULATE ( [d_first_date_of_sku_by_inventory], REMOVEFILTERS(SKUs[SKU]) )

RETURN
    _firstDate
```

#### `d_last_date_of_asin_by_inventory`

**Depende de medidas:** `[d_last_date_of_sku_by_inventory]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
// Retrieves the last record date of inventory by ASIN. Only ASINs context filters are applied.

    VAR _lastDate = CALCULATE ( [d_last_date_of_sku_by_inventory], REMOVEFILTERS(SKUs[SKU]) )

RETURN
    _lastDate
```

#### `d_first_date_of_sku_by_sales`

**Depende de colunas:** `'Calendar'[Date]`, `'f.AllOrders'[date_all_orders]`  
```dax
// Retrieves the first record date of inventory. Only SKUs context filters are applied.
    VAR _firstDate =
        CALCULATE(
            FIRSTDATE ( 'f.AllOrders'[date_all_orders] )    
            , CROSSFILTER('Calendar'[Date], 'f.AllOrders'[date_all_orders], None)
        )
    
RETURN
    _firstDate
```


### Delete?

#### `u_weekly_velocity_new`

**Depende de medidas:** `[i_11Brands_life_cycle]`  
**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Weekly Velocity]`  
```dax
CALCULATE(
    MAX ( 'fact_velocity'[Updated Weekly Velocity] )
    , FILTER(
        'fact_velocity'
        , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
    ),FILTER(SKUs,[i_11Brands_life_cycle] <> "D")
)
```

#### `_DrillSKU`

**Depende de colunas:** `SKUs[SKU]`  
```dax
MAXX(
    KEEPFILTERS( ALLSELECTED( SKUs[SKU] ) ),
    SKUs[SKU]
)
```

#### `_DrillFamily`

**Depende de medidas:** `[_DrillSKU]`  
**Depende de colunas:** `SKUs[Amazon Family]`, `SKUs[SKU]`  
```dax
VAR sku = [_DrillSKU]
RETURN
IF(
    NOT ISBLANK( sku ),
    CALCULATE(
        MAX( SKUs[Amazon Family] ),
        SKUs[SKU] = sku
    ),
    BLANK()
)
```

#### `_UnitsSold_SameFamily`

**Depende de medidas:** `[_DrillFamily]`, `[u_units_sold]`  
**Depende de colunas:** `SKUs[Amazon Family]`  
```dax
VAR _fam     = [_DrillFamily]
VAR _thisFam = SELECTEDVALUE( SKUs[Amazon Family] )
RETURN
IF(
    _thisFam = _fam,
    [u_units_sold],
    BLANK()
)
```

#### `u_last_weekly_velocity`

**Depende de medidas:** `[u_weekly_velocity]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR LastDateWithValue =
    CALCULATE (
        MAXX (
            FILTER (
                ALL ( 'Calendar'[Date] ),
                NOT ISBLANK ( [u_weekly_velocity] )
                    && 'Calendar'[Date] <= TODAY()   
            ),
            'Calendar'[Date]
        )
    )
RETURN
    CALCULATE (
        [u_weekly_velocity],
        'Calendar'[Date] = LastDateWithValue
    )
```

#### `u_delta_weekly_velocity_over_sales`

**Depende de medidas:** `[u_last_weekly_velocity]`, `[u_weekly_velocity_moving_average_fast]`  
```dax
DIVIDE([u_weekly_velocity_moving_average_fast],[u_last_weekly_velocity])
```


### Delete?\Temp Victor\0 Dep

#### `u_units_grade_resell`

**Depende de colunas:** `'fact_fbaGrade&ResellReport'[quantity]`  
```dax
SUM('fact_fbaGrade&ResellReport'[quantity])
```

#### `u_reserved_customer_order`

**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_customer_order]`  
```dax
VAR unitsReturned =
    CALCULATE (
        SUM ( 'fact_fba_inventory'[reserved_customer_order] ),
        FILTER (
            'fact_fba_inventory',
            'fact_fba_inventory'[date_fba_inventory] = MAX ( 'fact_fba_inventory'[date_fba_inventory] )
        )
    )

RETURN
    unitsReturned
```


### Delete?\Temp Victor\0 Dep\Aging

#### `current_ma_sales`

**Depende de medidas:** `[u_daily_velocity_moving_average_fast]`, `[u_inventory_with_surcharge]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
VAR CurrentMaSales =
    IF(
        [u_inventory_with_surcharge] = 0,
        0,
        CALCULATE(
            [u_daily_velocity_moving_average_fast],
            ALL('Calendar'),
            ALL(f_aging_projection)
        )
    )

VAR InventoryRegionLevel =
    SUMX(
        VALUES(SKUs[SKU]),
        CALCULATE(
            [u_daily_velocity_moving_average_fast],
            ALL('Calendar'),
            ALL(f_aging_projection)
        )
    )

RETURN 
IF(
    ISINSCOPE(SKUs[SKU]),
    CurrentMaSales,
    InventoryRegionLevel
)
```

#### `title_inventory_distribution`

**Depende de colunas:** `'Calendar'[Year-Month]`  
```dax
"Inventory Distribution Across Regions and Ranges: Month " & SELECTEDVALUE('Calendar'[Year-Month])
```

#### `title_bar_chart_aging`

**Depende de colunas:** `'Calendar'[Year-Month]`  
```dax
"Inventory in Surcharge | Period: " & SELECTEDVALUE('Calendar'[Year-Month])
```

#### `d_last_date_charge_aging_yymm`

**Depende de medidas:** `[d_last_date_charge_aging]`  
```dax
"Actual Aging Surcharge - Last Month Charged: " & FORMAT([d_last_date_charge_aging], "MM-YYYY")
```

#### `subtitle_bar_chart_tab_aging_projection`

**Depende de medidas:** `[d_last_date_charge_aging]`  
```dax
IF(
    DAY(TODAY()) > 15 && 
    FORMAT([d_last_date_charge_aging], "MM/YYYY") <> FORMAT(EOMONTH(TODAY(), -1), "MM/YYYY"),
    "Last month charged: " & 
    FORMAT([d_last_date_charge_aging], "MM/YYYY") & 
    " - download the report of " &
    FORMAT(EDATE(TODAY(), -1), "MM/YYYY")
    ,
    "Last month charged: " & FORMAT([d_last_date_charge_aging], "MM/YYYY")
)
```

#### `type_price_promo_action`

**Depende de colunas:** `f_promotion_tracker[end_date]`, `f_promotion_tracker[price_promotion_action]`  
```dax
VAR EndDate =
CALCULATE(
    MAX(f_promotion_tracker[end_date]),
    ALL('Calendar')
)

VAR TypeAction =
CALCULATE(
    MAX(f_promotion_tracker[price_promotion_action]),
    FILTER(
        f_promotion_tracker,
        f_promotion_tracker[end_date] = EndDate
    )
)

RETURN
IF(
    EndDate >= TODAY(),
    TypeAction
)
```

#### `is_motive_aging`

**Depende de medidas:** `[d_promo_action_on_course]`  
**Depende de colunas:** `f_promotion_tracker[end_date]`, `f_promotion_tracker[is_aging]`  
```dax
VAR EndDate =
CALCULATE(
    MAX(f_promotion_tracker[end_date]),
    ALL('Calendar')
)

VAR IsAging =
CALCULATE(
    MAX(f_promotion_tracker[is_aging]),
    FILTER(
        f_promotion_tracker,
        f_promotion_tracker[end_date] = EndDate
    )
)

RETURN
IF(
    NOT(ISBLANK([d_promo_action_on_course])),
    IsAging
)
```

#### `d_last_order`

**Depende de colunas:** `'f.AllOrders'[date_all_orders]`  
```dax
MAX('f.AllOrders'[date_all_orders])
```


### Delete?\Temp Victor\0 Dep\Mapped Returns

#### `avg_weighted_days_between_purchase_return`

**Depende de medidas:** `[u_total_fba_returns]`  
**Depende de colunas:** `'f.FBACustomerReturns'[date_fba_customer_return]`, `'f.FBACustomerReturns'[purchase_date]`, `'f.FBACustomerReturns'[quantity]`  
```dax
VAR TotalWeightedDays =
SUMX(
    'f.FBACustomerReturns',
    ('f.FBACustomerReturns'[date_fba_customer_return] - 'f.FBACustomerReturns'[purchase_date]) * 'f.FBACustomerReturns'[quantity]
)

RETURN
DIVIDE(TotalWeightedDays, [u_total_fba_returns], 0)
```

#### `cf_return_rate_vs_threshold`

**Depende de medidas:** `[%_mapped_return_rate]`, `[return_rate_threshold]`, `[u_units_shipped]`  
**Depende de colunas:** `SKUs[Base SKU]`  
```dax
VAR u_units_shipped_base_sku =
CALCULATE (
    [u_units_shipped],
    REMOVEFILTERS(SKUs[Base SKU])
)

RETURN
SWITCH (
    TRUE (),
    u_units_shipped_base_sku > 25 && [%_mapped_return_rate] > [return_rate_threshold], "red",
    u_units_shipped_base_sku < 25 && [%_mapped_return_rate] > [return_rate_threshold], "orange",
    "black"
)
```

#### `alert_month_selected`

**Depende de colunas:** `'Calendar'[Year-Month]`  
```dax
VAR CurrentMonth = MONTH(TODAY())
VAR CurrentYear = YEAR(TODAY())
VAR PastMonth1 = MONTH(EDATE(TODAY(), -1))
VAR PastYear1 = YEAR(EDATE(TODAY(), -1))
VAR PastMonth2 = MONTH(EDATE(TODAY(), -2))
VAR PastYear2 = YEAR(EDATE(TODAY(), -2))

VAR SelectedPeriods = 
    VALUES('Calendar'[Year-Month])  

VAR CurrentPeriod = 
    FORMAT(TODAY(), "YYYY-MM")

VAR PastPeriod1 = 
    FORMAT(EDATE(TODAY(), -1), "YYYY-MM")

VAR PastPeriod2 = 
    FORMAT(EDATE(TODAY(), -2), "YYYY-MM")

VAR PastPeriod3 = 
    FORMAT(EDATE(TODAY(), -3), "YYYY-MM")

VAR AlertAfter5th = IF (
    CurrentPeriod IN SelectedPeriods || PastPeriod1 IN SelectedPeriods || PastPeriod2 IN SelectedPeriods,
    "Measurements not yet complete for " & FORMAT(EDATE(TODAY(), -2), "MM/YYYY") & ", " &FORMAT(EDATE(TODAY(), -1), "MM/YYYY") & " and " & FORMAT(TODAY(), "MM/YYYY") & "!",
    ""
)

VAR AlertBefore5th = IF (
    CurrentPeriod IN SelectedPeriods || PastPeriod1 IN SelectedPeriods || PastPeriod2 IN SelectedPeriods,
    "Measurements not yet complete for " & FORMAT(EDATE(TODAY(), -3), "MM/YYYY") & ", " & FORMAT(EDATE(TODAY(), -2), "MM/YYYY") & ", " & FORMAT(EDATE(TODAY(), -1), "MM/YYYY") & " and " & FORMAT(TODAY(), "MM/YYYY") & "!",
    ""
)
RETURN
IF(
    DAY(TODAY()) < 5,
    AlertBefore5th,
    AlertAfter5th
)
```

#### `median_days_between_purchase_return`

**Depende de medidas:** `[DaysBetween]`  
**Depende de colunas:** `'f.FBACustomerReturns'[date_fba_customer_return]`, `'f.FBACustomerReturns'[purchase_date]`  
```dax
PERCENTILEX.INC(
    ADDCOLUMNS('f.FBACustomerReturns',
    "DaysBetween", 
    INT('f.FBACustomerReturns'[date_fba_customer_return] - 'f.FBACustomerReturns'[purchase_date])
    ),
    [DaysBetween],
    0.5
)
```

#### `title_scatter_plot`

**Depende de colunas:** `'z.dynamic_scatter_plot_mapped_returns'[dim_scatter_plot_mapped_returns Order]`  
```dax
SWITCH(
    SELECTEDVALUE('z.dynamic_scatter_plot_mapped_returns'[dim_scatter_plot_mapped_returns Order]),
    0, "Scatter Plot Return Rate vs Return Units - Size: Returns Fee - Color Legend: Amazon Family",
    1, "Scatter Plot Return Rate vs Return Units - Size: Returns Fee - Color Legend: Native Family",
    2, "Scatter Plot Return Rate vs Return Units - Size: Returns Fee - Color Legend: Life Cycle"
)
```

#### `%_avg_mapped_return_rate_all_selected_sales_region`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    ALLEXCEPT(SKUs, SKUs[Sales Region])
)
```

#### `cf_return_rate_vs_threshold_sku`

**Depende de medidas:** `[%_mapped_return_rate]`, `[return_rate_threshold]`, `[u_units_shipped_base_sku]`  
```dax
SWITCH (
    TRUE (),
    [u_units_shipped_base_sku] > 25 && [%_mapped_return_rate] > [return_rate_threshold], "red",
    [u_units_shipped_base_sku] < 25 && [%_mapped_return_rate] > [return_rate_threshold], "orange",
    "black"
)
```


### Delete?\Temp Victor\0 Dep\Measure Comparisson

#### `is_selected_asin`

**Depende de colunas:** `SKUs[ASIN]`, `SKUs[Country | SKU]`, `SKUs[SKU]`  
```dax
IF(
    ISFILTERED(SKUs[SKU]) || ISFILTERED(SKUs[Country | SKU]),
    "Asin selected: " & SELECTEDVALUE(SKUs[ASIN]),
    "Select an Asin!"
)
```

#### `last_not_blank_life_cycle_fba_fee_tracker`

**Depende de medidas:** `[u_inventory_ending_plus_transit_all_dispositions]`, `[u_inventory_ending_plus_transit_total_sku]`  
**Depende de colunas:** `'SKUs'[Refresh Date]`, `SKUs[Life Cycle]`, `SKUs[SKU]`  
```dax
IF(
    ISINSCOPE(SKUs[SKU]) && 
    NOT(ISBLANK([u_inventory_ending_plus_transit_total_sku])) && 
    NOT(ISBLANK([u_inventory_ending_plus_transit_all_dispositions])),
    CALCULATE(
        MAX(SKUs[Life Cycle]),
        FILTER(
            SKUs,
            NOT(ISBLANK(SKUs[Life Cycle]))
        ),
        'SKUs'[Refresh Date] = MAX('SKUs'[Refresh Date])
    ),
    BLANK()
)
```

#### `u_inventory_region_ending_plus_transit_total_sku`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `SKUs[Country | Native Family]`, `SKUs[Country]`, `SKUs[Inventory Region]`  
```dax
VAR _inventory =
        CALCULATE(
            [u_inventory_ending_plus_transit],
            ALL(SKUs[Country | Native Family], SKUs[Country]),
            VALUES(SKUs[Inventory Region])
        )

RETURN
    _inventory
```


### Delete?\Temp Victor\1 Dep\Aging

#### `inventory_target_for_zero_surcharge`

**Depende de medidas:** `[u_inventory_with_surcharge]`, `[u_simulated_inventory]`  
**Depende de colunas:** `SKUs[Inventory Region]`, `SKUs[SKU]`, `f_aging_projection[range]`  
```dax
VAR InventoryWithSurchargeSKULevel =
CALCULATE(
    [u_inventory_with_surcharge],
    ALLSELECTED(f_aging_projection[range])
)

// VAR InventoryWithSurchargeInventoryRegionLevel =
// CALCULATE(
//     [u_inventory_with_surcharge],
//     ALLSELECTED(SKUs[Inventory Region]),
//     ALLSELECTED(f_aging_projection[range])
// )

RETURN 
SWITCH(
    TRUE(),
    [u_inventory_with_surcharge] = 0, 0,
    ISINSCOPE(SKUs[SKU]), [u_simulated_inventory] - InventoryWithSurchargeSKULevel,
    ISINSCOPE(SKUs[Inventory Region]), [u_simulated_inventory] - [u_inventory_with_surcharge]
)
```


### Delete?\Temp Victor\1 Dep\Mapped Returns

#### `u_units_shipped_base_sku`

**Depende de medidas:** `[u_units_shipped]`  
**Depende de colunas:** `SKUs[Base SKU]`  
```dax
VAR CurrentBaseSKU = SELECTEDVALUE(SKUs[Base SKU])

VAR UnitsShippedBasedSKU =
SUMX(
    FILTER(
        ALL(SKUs),
        SKUs[Base SKU] = CurrentBaseSKU
    ),
    [u_units_shipped]
)

RETURN
IF(
    ISBLANK([u_units_shipped]),
    BLANK(),
    UnitsShippedBasedSKU
)
```


### Delete?\Temp Victor\1 Dep\Measure Comparisson

#### `i_11Brands_package_shortest_side_unconverted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 3
    VAR _length    =  MAX ( SKUs[Package Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Package Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Package Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `i_11Brands_package_median_side_unconverted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 2
    VAR _length    =  MAX ( SKUs[Package Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Package Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Package Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `i_11Brands_package_longest_side_unconverted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 1
    VAR _length    =  MAX ( SKUs[Package Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Package Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Package Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `$_unit_last_fba_fee_preview_diff_estimated_expected_by_country_native_family`

**Depende de medidas:** `[$_unit_last_fba_fee_calculation_expected]`, `[$_unit_last_fba_fee_preview_by_country_native_family]`  
```dax
VAR _diff = [$_unit_last_fba_fee_preview_by_country_native_family] - [$_unit_last_fba_fee_calculation_expected] 

    VAR _replaceBlank = 
        IF( 
            OR(
                ISBLANK([$_unit_last_fba_fee_preview_by_country_native_family]), 
                ISBLANK([$_unit_last_fba_fee_calculation_expected] )), 
            BLANK(), 
            _diff
        )

RETURN
    _replaceBlank
```

#### `$_unit_last_fba_fee_preview_by_country_native_family`

**Depende de medidas:** `[Fee]`, `[Inventory]`, `[u_inventory_ending_plus_transit_total_sku]`  
**Depende de colunas:** `'SKUs'[Country | Native Family]`, `'SKUs'[Key Column: Marketplace | SKU]`, `'fact_fee_preview'[date_fee_preview]`, `'fact_fee_preview'[expected_fulfillment_fee_per_unit]`  
```dax
VAR WeightedSum = 
    SUMX(
        SUMMARIZE(
            'SKUs',
            'SKUs'[Country | Native Family],
            'SKUs'[Key Column: Marketplace | SKU]
        ),
        VAR MaxDate = 
            CALCULATE(
                MAX('fact_fee_preview'[date_fee_preview]),
                ALLEXCEPT('SKUs', 'SKUs'[Key Column: Marketplace | SKU])
            )
        RETURN
            CALCULATE(
                MAX('fact_fee_preview'[expected_fulfillment_fee_per_unit]),
                'fact_fee_preview'[date_fee_preview] = MaxDate
            ) * [u_inventory_ending_plus_transit_total_sku]
    )

// Criada para não somar o estoque no caso do cliente não ter Last FBA Fee Amazon
VAR FilteredTable =
    ADDCOLUMNS(
        SUMMARIZE(
            'SKUs',
            'SKUs'[Country | Native Family],
            'SKUs'[Key Column: Marketplace | SKU]
        ),
        "Fee", CALCULATE(
            MAX('fact_fee_preview'[expected_fulfillment_fee_per_unit]),
            'fact_fee_preview'[date_fee_preview] = MAX('fact_fee_preview'[date_fee_preview])
        ),
        "Inventory", [u_inventory_ending_plus_transit_total_sku]
        )

VAR TotalInventory =
    SUMX(
        FILTER(
            FilteredTable,
            NOT(ISBLANK([Fee]))
        ),
        [Inventory]
    )

RETURN
    DIVIDE(
        WeightedSum,
        TotalInventory,
        BLANK()
    )
```

#### `total_fba_fee_by_family`

**Depende de medidas:** `[$_total_diff_fba_fee_by_weighted_stock]`, `[$_weighted_total_diff_fba_fee]`, `[total_diff]`  
**Depende de colunas:** `SKUs[Country | SKU]`, `SKUs[Native Family]`, `SKUs[Sales Region]`  
```dax
// VAR SummarizedTable =
//  SUMMARIZE(
//      SKUs,
//      SKUs[Sales Region],
//      SKUs[Native Family],
//      SKUs[Country | SKU],
//      "total_diff", [$_weighted_total_diff_fba_fee]
//  )

// VAR Result =
//     SUMX(
//         SummarizedTable,
//         [total_diff]
//     )

VAR SummarizedTable =
    ADDCOLUMNS(
        SUMMARIZE(
            SKUs,
            SKUs[Sales Region],
            SKUs[Native Family],
            SKUs[Country | SKU]  // Mantém a granularidade por SKU
        ),
        "total_diff", CALCULATE([$_total_diff_fba_fee_by_weighted_stock])  // Força o contexto correto
    )
VAR Result =
    SUMX(
        SummarizedTable,
        [total_diff]  // Soma os valores calculados por SKU
    )
RETURN Result
```


### Delete?\Temp Victor\2 Dep\Aging

#### `u_estimated_qty_on_hand_aging`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `'SKUs'[SKU]`, `SKUs[SKU]`, `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`, `f_aging_projection[inventory_by_inbound_shipments]`, `f_aging_projection[simulation]`  
```dax
VAR TotalInventoryByInboundShipments =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[inventory_by_inbound_shipments]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        ),
        REMOVEFILTERS('Calendar')
)

VAR CountSimulations = 
CALCULATE(
    DISTINCTCOUNT(f_aging_projection[simulation]),
    FILTER(
        ALL(f_aging_projection),
        f_aging_projection[file_date] = [d_last_file_aging] &&
        f_aging_projection[has_surcharge] = TRUE()
    ),
    REMOVEFILTERS('Calendar')
)

VAR AvgSumInventoryByInboundShipments = DIVIDE(TotalInventoryByInboundShipments, CountSimulations)

VAR TotalInventoryByInboundShipmentsRegionLevel =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[inventory_by_inbound_shipments]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        ),
        REMOVEFILTERS('Calendar'),
        REMOVEFILTERS(SKUs[SKU])
)

VAR CountSimulationsRegionLevel = 
CALCULATE(
    DISTINCTCOUNT(f_aging_projection[simulation]),
    FILTER(
        ALL(f_aging_projection),
        f_aging_projection[file_date] = [d_last_file_aging] &&
        f_aging_projection[has_surcharge] = TRUE()
    ),
    REMOVEFILTERS('Calendar'),
    REMOVEFILTERS(SKUs[SKU])
)

VAR AvgSumInventoryByInboundShipmentsRegionLevel = DIVIDE(TotalInventoryByInboundShipmentsRegionLevel, CountSimulationsRegionLevel)

RETURN
IF(
    ISINSCOPE('SKUs'[SKU]),
    AvgSumInventoryByInboundShipments,
    AvgSumInventoryByInboundShipmentsRegionLevel
)
```

#### `u_estimated_qty_on_hand_aging_cumulative`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `'Calendar'[Year-Month]`, `'SKUs'[SKU]`, `SKUs[SKU]`, `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`, `f_aging_projection[inventory_by_inbound_shipments]`, `f_aging_projection[simulation]`  
```dax
VAR SelectedYearMonth = SELECTEDVALUE('Calendar'[Year-Month])

VAR TotalInventoryByInboundShipments =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[inventory_by_inbound_shipments]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        ),
        FILTER(
        ALL('Calendar'),
        'Calendar'[Year-Month] <= SelectedYearMonth
        )
)

VAR CountSimulations = 
CALCULATE(
    DISTINCTCOUNT(f_aging_projection[simulation]),
    FILTER(
        ALL(f_aging_projection),
        f_aging_projection[file_date] = [d_last_file_aging] &&
        f_aging_projection[has_surcharge] = TRUE()
    ),
    FILTER(
        ALL('Calendar'),
        'Calendar'[Year-Month] <= SelectedYearMonth
    )
)

VAR AvgSumInventoryByInboundShipments = DIVIDE(TotalInventoryByInboundShipments, CountSimulations)

VAR TotalInventoryByInboundShipmentsRegionLevel =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[inventory_by_inbound_shipments]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        ),
        FILTER(
        ALL('Calendar'),
        'Calendar'[Year-Month] <= SelectedYearMonth
        ),
        REMOVEFILTERS(SKUs[SKU])
)

VAR CountSimulationsRegionLevel = 
CALCULATE(
    DISTINCTCOUNT(f_aging_projection[simulation]),
    FILTER(
        ALL(f_aging_projection),
        f_aging_projection[file_date] = [d_last_file_aging] &&
        f_aging_projection[has_surcharge] = TRUE()
    ),
    FILTER(
    ALL('Calendar'),
    'Calendar'[Year-Month] <= SelectedYearMonth
    ),
    REMOVEFILTERS(SKUs[SKU])
)

VAR AvgSumInventoryByInboundShipmentsRegionLevel = DIVIDE(TotalInventoryByInboundShipmentsRegionLevel, CountSimulationsRegionLevel)

RETURN
IF(
    ISINSCOPE('SKUs'[SKU]),
    AvgSumInventoryByInboundShipments,
    AvgSumInventoryByInboundShipmentsRegionLevel
)
```


### Delete?\Temp Victor\2 Dep\Measure Comparisson

#### `$_total_diff_fba_fee_preview_by_country_native_family`

**Depende de medidas:** `[$_unit_last_fba_fee_diff_estimated_expected]`, `[$_unit_last_fba_fee_preview_diff_estimated_expected_by_country_native_family]`, `[b_region_country_picker]`, `[u_inventory_ending_plus_transit_all_dispositions]`, `[u_inventory_ending_plus_transit_total_sku]`  
**Depende de colunas:** `SKUs[Country]`  
```dax
[u_inventory_ending_plus_transit_all_dispositions] * [$_unit_last_fba_fee_preview_diff_estimated_expected_by_country_native_family]

//    VAR _multiplication = 
//         SUMX(
//             FILTER(
//                 VALUES(SKUs[Country]),
//                 [b_region_country_picker] <> 0         
//             ),
//             [u_inventory_ending_plus_transit_total_sku] * [$_unit_last_fba_fee_diff_estimated_expected]
//         )

// RETURN
//     _multiplication
```


### Delete?\Temp Victor\3 Dep\Aging

#### `d_last_date_charge_aging`

**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`  
```dax
CALCULATE(
    MAX('fact.aged_inventory_surcharge'[date_charge]),
    ALL('Calendar'),
    ALL(SKUs)
)
```


### Delete?\Temp Victor\3 Dep\Mapped Returns

#### `return_rate_threshold`

**Depende de medidas:** `[u_units_shipped]`  
**Depende de colunas:** `'f.us_returns_processing_fee'[asin_return_threshold_percent]`, `'f.us_returns_processing_fee'[date_charge]`  
```dax
VAR LastDateCharge = 
CALCULATE(
    MAX('f.us_returns_processing_fee'[date_charge]),
    ALL('Calendar')
)

VAR BaseSKUThreshold = 
CALCULATE (
    MAX('f.us_returns_processing_fee'[asin_return_threshold_percent]),
    FILTER(
        ALL('f.us_returns_processing_fee'),
        'f.us_returns_processing_fee'[date_charge] = LastDateCharge
    )
)

VAR Global_Min_Threshold = 
CALCULATE(
    MIN('f.us_returns_processing_fee'[asin_return_threshold_percent]),
    ALL('Calendar'),
    ALL('SKUs')
)

VAR Final_Threshold = 
    COALESCE(
        BaseSKUThreshold,
        Global_Min_Threshold
    )

RETURN
IF(
    ISBLANK([u_units_shipped]),
    BLANK(),
    Final_Threshold
)
```


### Fees\AWD Fees

#### `$_awd_storage_fee`

**Depende de colunas:** `'fact_awd_monthly_storage_fee'[daily_charged_amount]`  
```dax
VAR _result = SUM( 'fact_awd_monthly_storage_fee'[daily_charged_amount] )

RETURN
    _result
```

#### `$_awd_transportation_processing_fees`

**Depende de medidas:** `[$_awd_processing_fee]`, `[$_awd_transportation_fee]`  
```dax
[$_awd_transportation_fee]
+ [$_awd_processing_fee]
```

#### `$_awd_transportation_fee`

**Depende de colunas:** `'Calendar'[Start of Month]`, `'fact_awd_monthly_transportation_fee'[fee_amount]`, `'fact_awd_monthly_transportation_fee'[promotion_amount]`, `'fact_awd_monthly_transportation_fee'[tax_amount]`  
```dax
VAR _daysInMonth = DAY(ENDOFMONTH('Calendar'[Start of Month])) -- Calculate the days in the related month
    
RETURN
    SUMX(
        'fact_awd_monthly_transportation_fee'
        ,   ('fact_awd_monthly_transportation_fee'[fee_amount]
        -   'fact_awd_monthly_transportation_fee'[promotion_amount] 
        +   'fact_awd_monthly_transportation_fee'[tax_amount])/_daysInMonth
    )
```

#### `$_awd_processing_fee`

**Depende de colunas:** `'Calendar'[Start of Month]`, `'fact_awd_monthly_processing_fee'[fee_amount]`, `'fact_awd_monthly_processing_fee'[promotion_amount]`, `'fact_awd_monthly_processing_fee'[tax_amount]`  
```dax
VAR _daysInMonth = DAY(ENDOFMONTH('Calendar'[Start of Month])) -- Calculate the days in the related month
    
RETURN
    SUMX(
        'fact_awd_monthly_processing_fee',
        ('fact_awd_monthly_processing_fee'[fee_amount] 
        - 'fact_awd_monthly_processing_fee'[promotion_amount] 
        + 'fact_awd_monthly_processing_fee'[tax_amount]) / _daysInMonth
    )
```


### Fees\FBA Fee

#### `%_total_fba_fee_over_total_revenue`

**Depende de medidas:** `[$_revenue]`, `[$_total_fba_fee_fee_preview old]`  
```dax
DIVIDE(
    [$_total_fba_fee_fee_preview old]
    , [$_revenue]
)
```

#### `$_total_fba_fee_diff_estimated_expected`

**Depende de medidas:** `[$_total_fba_fee_fee_preview]`, `[$_total_last_fba_fee_calculation_expected]`  
**Depende de colunas:** `'Calendar'[Date]`, `SKUs[Country | SKU]`  
```dax
VAR _totalDiff =
        SUMX(
            VALUES( SKUs[Country | SKU] )
            , SUMX(
                VALUES('Calendar'[Date])
                , [$_total_fba_fee_fee_preview] - [$_total_last_fba_fee_calculation_expected]
            )
        )

RETURN
    _totalDiff
```


### Fees\FBA Fee\Calculation Expected

#### `$_unit_fba_fee_calculation_expected`

**Depende de colunas:** `'fact_fba_fee_expected'[fulfillment_fee]`  
```dax
VAR _fbaFee = 
        AVERAGEX(
            'fact_fba_fee_expected'
            , 'fact_fba_fee_expected'[fulfillment_fee]
        )

RETURN
    _fbaFee
```

#### `$_unit_last_fba_fee_calculation_expected`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_fee_expected'[date_list]`, `'fact_fba_fee_expected'[fulfillment_fee]`  
```dax
VAR _max_date = CALCULATE( MAX ( 'fact_fba_fee_expected'[date_list] ), ALL('Calendar'[Date]) )

    VAR _lastFbaFee = 
        CALCULATE (
            MAX ('fact_fba_fee_expected'[fulfillment_fee] )
            , FILTER (
                ALL('Calendar'[Date])
                , 'Calendar'[Date] = _max_date
            )
        )
        
RETURN
    _lastFbaFee
```

#### `$_unit_last_fba_fee_diff_estimated_expected`

**Depende de medidas:** `[$_unit_last_fba_fee_calculation_expected]`, `[$_unit_last_fba_fee_fee_preview]`  
**Depende de colunas:** `SKUs[Country | SKU]`  
```dax
VAR _diff =
        SUMX(
            VALUES(SKUs[Country | SKU])
            ,   [$_unit_last_fba_fee_fee_preview] 
            - [$_unit_last_fba_fee_calculation_expected] 
        )

    VAR _replaceBlank = 
        IF( 
            OR(
                ISBLANK([$_unit_last_fba_fee_fee_preview]), 
                ISBLANK([$_unit_last_fba_fee_calculation_expected] )), 
            BLANK(), 
            _diff
        )

RETURN
    _replaceBlank
```

#### `$_unit_last_fba_fee_calculation_expected_region`

**Depende de medidas:** `[$_unit_last_fba_fee_calculation_expected]`  
**Depende de colunas:** `SKUs[Country]`, `SKUs[Inventory Region]`  
```dax
//     VAR _lastFbaFee = 
//         SWITCH(
//             TRUE(), 
//             SELECTEDVALUE(SKUs[Inventory Region]) = SELECTEDVALUE(SKUs[Country]), [$_unit_last_fba_fee_calculation_expected],   
//             AND(SELECTEDVALUE(SKUs[Inventory Region]) = "EU", SELECTEDVALUE(SKUs[Country]) = "DE"), [$_unit_last_fba_fee_calculation_expected],
//             BLANK()
//         )

// RETURN
//     _lastFbaFee



VAR CurrentRegion = MAX(SKUs[Inventory Region])
VAR BaseCountryValue =
    CALCULATE(
        [$_unit_last_fba_fee_calculation_expected],
        SKUs[Inventory Region] = CurrentRegion, -- Stay in the current region
        SKUs[Country] = CurrentRegion           -- Use the region as the "base" country
    )
RETURN
    BaseCountryValue
```

#### `$_unit_last_fba_fee_diff_estimated_expected_region`

**Depende de medidas:** `[$_unit_last_fba_fee_calculation_expected_region]`, `[$_unit_last_fba_fee_fee_preview]`  
**Depende de colunas:** `SKUs[Key Column: Inventory Region | SKU]`  
```dax
VAR _diff =
        SUMX(
            VALUES(SKUs[Key Column: Inventory Region | SKU])
            ,   [$_unit_last_fba_fee_fee_preview] 
            - [$_unit_last_fba_fee_calculation_expected_region] 
        )

    VAR _replaceBlank = 
        IF( 
            OR(
                ISBLANK([$_unit_last_fba_fee_fee_preview]), 
                ISBLANK([$_unit_last_fba_fee_calculation_expected_region] )), 
            BLANK(), 
            _diff
        )

RETURN
    _replaceBlank
```

#### `$_total_last_fba_fee_diff_estimated_expected_region`

**Depende de medidas:** `[$_unit_last_fba_fee_diff_estimated_expected_region]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `SKUs[Country]`, `SKUs[Inventory Region]`  
```dax
// [$_unit_last_fba_fee_diff_estimated_expected_region] *
    // [u_inventory_ending_plus_transit]


VAR CurrentRegion = MAX(SKUs[Inventory Region])
VAR BaseCountryValue =
    CALCULATE(
        [$_unit_last_fba_fee_diff_estimated_expected_region] *
    [u_inventory_ending_plus_transit],
        SKUs[Inventory Region] = CurrentRegion, -- Stay in the current region
        SKUs[Country] = CurrentRegion           -- Use the region as the "base" country
    )
RETURN
    BaseCountryValue
```

#### `b_region_country_picker`

**Depende de colunas:** `SKUs[Inventory Region]`, `SKUs[country]`  
```dax
VAR _inventoryRegion = SELECTEDVALUE(SKUs[Inventory Region])
VAR _country = SELECTEDVALUE(SKUs[country])
// VAR _boolean = 
//     SWITCH(
//         TRUE(),    
//         AND ( _inventoryRegion = "US", _country = "US"), 1,
//         AND ( _inventoryRegion = "CA", _country = "CA"), 1,
//         AND ( _inventoryRegion = "GB", _country = "GB"), 1,
//         AND ( _inventoryRegion = "EU", _country IN {"BE", "CZ", "DE", "ES", "FR", "IT","NL","PL","SE","SK","TR"} ), 1,
//         0
//     )

VAR _boolean = 
    SWITCH(
        _inventoryRegion,    
        "US", IF( _country = "US", 1, 0),
        "CA", IF( _country = "CA", 1, 0),
        "GB", IF( _country = "GB", 1, 0),
        "EU", IF( _country IN {"BE", "CZ", "DE", "ES", "FR", "IT","NL","PL","SE","SK","TR"} , 1, 0),
        0
    )


RETURN
    _boolean
```

#### `u_inventory_ending_plus_transit_total_sku`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `SKUs[Country]`, `SKUs[Inventory Region]`  
```dax
VAR _inventory =
        CALCULATE(
            [u_inventory_ending_plus_transit],
            ALL(SKUs[Country]),
            VALUES(SKUs[Inventory Region])
        )

RETURN
    _inventory
```

#### `$_total_diff_fba_fee`

**Depende de medidas:** `[$_unit_last_fba_fee_diff_estimated_expected]`, `[b_region_country_picker]`, `[u_inventory_ending_plus_transit_total_sku]`  
**Depende de colunas:** `SKUs[Country]`  
```dax
// VAR _multiplication = 
    //     SUMX(
    //         VALUES(SKUs[Country]),
    //         IF( 
    //             [b_region_country_picker] = 0, 
    //             BLANK(), 
    //             [u_inventory_ending_plus_transit_total_sku] * [$_unit_last_fba_fee_diff_estimated_expected]
    //         )
    //     )

    
   VAR _multiplication = 
        SUMX(
            FILTER(
                VALUES(SKUs[Country]),
                [b_region_country_picker] <> 0         
            ),
            [u_inventory_ending_plus_transit_total_sku] * [$_unit_last_fba_fee_diff_estimated_expected]
        )

RETURN
    _multiplication
```


### Fees\FBA Fee\Fee Preview

#### `$_unit_fba_fee_fee_preview`

**Depende de colunas:** `'fact_fee_preview'[expected_fulfillment_fee_per_unit]`  
```dax
VAR _fbaFee = 
        AVERAGEX(
            'fact_fee_preview'
            , 'fact_fee_preview'[expected_fulfillment_fee_per_unit]
        )

RETURN
    _fbaFee
```

#### `$_unit_last_fba_fee_fee_preview`

**Depende de colunas:** `'fact_fee_preview'[date_fee_preview]`, `'fact_fee_preview'[expected_fulfillment_fee_per_unit]`  
```dax
VAR _lastFbaFee = 
        CALCULATE (
            MAX ('fact_fee_preview'[expected_fulfillment_fee_per_unit] )
            , FILTER (
                'fact_fee_preview'
                , 'fact_fee_preview'[date_fee_preview] = MAX ( 'fact_fee_preview'[date_fee_preview] )
            )
        )
        
RETURN
    _lastFbaFee
```

#### `$_total_fba_fee_fee_preview`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'f.AllOrders'[unit_fba_fee]`  
```dax
VAR _totalFbaFee =
        SUMX(
            'f.AllOrders'
            , [u_units_sold] * 'f.AllOrders'[unit_fba_fee]
        )

RETURN
    _totalFbaFee
```

#### `$_unit_last_fba_fee_fee_preview_region`

**Depende de medidas:** `[$_unit_last_fba_fee_fee_preview]`  
**Depende de colunas:** `SKUs[Country]`, `SKUs[Inventory Region]`  
```dax
//     VAR _lastFbaFee = 
//         SWITCH(
//             TRUE(), 
//             SELECTEDVALUE(SKUs[Inventory Region]) = SELECTEDVALUE(SKUs[Country]), [$_unit_last_fba_fee_fee_preview],   
//             AND(SELECTEDVALUE(SKUs[Inventory Region]) = "EU", SELECTEDVALUE(SKUs[Country]) = "DE"), [$_unit_last_fba_fee_fee_preview],
//             BLANK()
//         )
// RETURN
//     _lastFbaFee

VAR CurrentRegion = MAX(SKUs[Inventory Region])
VAR BaseCountryValue =
    CALCULATE(
        [$_unit_last_fba_fee_fee_preview],
        SKUs[Inventory Region] = CurrentRegion, -- Stay in the current region
        SKUs[Country] = CurrentRegion           -- Use the region as the "base" country
    )
RETURN
    BaseCountryValue
```

#### `%_total_fba_fee_fee_preview_over_net_revenue`

**Depende de medidas:** `[$_net_revenue]`, `[$_total_fba_fee_fee_preview]`  
```dax
VAR _div = DIVIDE( [$_total_fba_fee_fee_preview], [$_net_revenue] ) 

RETURN
    _div
```


### Fees\Measures Comparisson

#### `q_last_item_volume_fee_preview_diff`

**Depende de medidas:** `[i_11Brands_package_volume_converted]`, `[i_amazon_fee_preview_item_volume_last_occurrence]`  
```dax
DIVIDE(
    [i_amazon_fee_preview_item_volume_last_occurrence],
    [i_11Brands_package_volume_converted]
) - 1
```

#### `q_ranking_order`

**Depende de medidas:** `[$_total_diff_fba_fee]`  
**Depende de colunas:** `SKUs[Country]`, `SKUs[SKU]`  
```dax
VAR _rankingTable = 
        CALCULATETABLE(
            VALUES(SKUs[SKU]),
            ALLEXCEPT(SKUs, SKUs[Country])  -- Keeps the filter on Country only
        )

    VAR _rankingOrder =
        IF(
            ISBLANK([$_total_diff_fba_fee]),
            BLANK(),
            RANKX(
                _rankingTable,
                [$_total_diff_fba_fee],
                , DESC,
                DENSE
            )
        )

RETURN
    _rankingOrder
```


### Fees\Referral Fee

#### `$_referral_fee`

**Depende de medidas:** `[$_net_revenue]`, `[%_total_fba_returns]`  
```dax
VAR _const = 0.8
    VAR _referral_fee = [$_net_revenue] * 0.15
    VAR _referral_fee_refunded = _referral_fee * [%_total_fba_returns] * _const

RETURN
    _referral_fee - _referral_fee_refunded
```

#### `%_referral_fee_over_revenue`

**Depende de medidas:** `[$_referral_fee]`, `[$_revenue]`  
```dax
DIVIDE(
    [$_referral_fee]
    , [$_revenue]
)
```

#### `%_referral_fee_over_net_revenue`

**Depende de medidas:** `[$_net_revenue]`, `[$_referral_fee]`  
```dax
VAR _div = DIVIDE( [$_referral_fee], [$_net_revenue] ) 

RETURN
    _div
```


### Fees\Storage Fee\AWD

#### `%_awd_storage_fee_over_revenue`

**Depende de medidas:** `[$_awd_storage_fee]`, `[$_revenue]`  
```dax
DIVIDE(
    [$_awd_storage_fee]
    , [$_revenue]
)
```


### Fees\Storage Fee\Amazon

#### `$_estimated_storage_fee`

**Depende de medidas:** `[$_estimated_storage_fee_actual]`, `[$_estimated_storage_fee_forecast]`  
```dax
VAR _storage_fee = [$_estimated_storage_fee_actual] + [$_estimated_storage_fee_forecast]

RETURN
    _storage_fee
```

#### `%_estimated_storage_fee_over_revenue`

**Depende de medidas:** `[$_estimated_storage_fee]`, `[$_revenue]`  
```dax
DIVIDE(
    [$_estimated_storage_fee]
    , [$_revenue]
)
```

#### `%_storage_fee_per_day_over_total_revenue`

**Depende de medidas:** `[$_estimated_storage_fee]`, `[$_revenue]`  
```dax
DIVIDE(
    [$_estimated_storage_fee]
    , [$_revenue]
)
```

#### `$_estimated_storage_fee_per_unit_sold`

**Depende de medidas:** `[$_estimated_storage_fee]`, `[u_units_sold]`  
```dax
DIVIDE(
    [$_estimated_storage_fee]
    , [u_units_sold]
)
```

#### `u_quantity_on_hand_storage_fee`

**Depende de colunas:** `'fact_storage_fee_measurements'[quantity_on_hand]`  
```dax
SUM ( 'fact_storage_fee_measurements'[quantity_on_hand] )
```

#### `$_estimated_storage_fee_share`

**Depende de medidas:** `[$_estimated_storage_fee]`  
**Depende de colunas:** `SKUs[Native Family]`, `SKUs[SKU]`  
```dax
VAR ShareNativeLevel = 
DIVIDE(
    [$_estimated_storage_fee],
    CALCULATE(
        [$_estimated_storage_fee],
        ALLSELECTED(SKUs[Native Family])
    )
)

VAR ShareSKULevel = 
DIVIDE(
    [$_estimated_storage_fee],
    CALCULATE(
        [$_estimated_storage_fee],
        ALLSELECTED(SKUs[SKU])
    )
)

RETURN
    SWITCH(
        TRUE(),
        ISINSCOPE(SKUs[SKU]),
        ShareSKULevel,
        ISINSCOPE(SKUs[Native Family]),
        ShareNativeLevel,
        "-"
    )
```

#### `$_estimated_liquidations_processing_fee`

**Depende de medidas:** `[i_amazon_fact_fee_preview_max_size_tier]`, `[i_amazon_storage_fee_item_weight]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
VAR SalesRegion = SELECTEDVALUE(SKUs[Sales Region])
VAR SizeTier = CALCULATE([i_amazon_fact_fee_preview_max_size_tier], ALL('Calendar'))
VAR NoTier = ISBLANK(SizeTier)
VAR IsOversize = SEARCH("Oversize", SizeTier, 1, 0) > 0
VAR ItemWeight = CALCULATE([i_amazon_storage_fee_item_weight], ALL('Calendar'))
VAR NoWeight = ISBLANK(ItemWeight)

// https://sellercentral.amazon.com/help/hub/reference/GYVCG5Q3BEJ6MLMF?mons_sel_mkid=amzn1.mp.o.ATVPDKIKX0DER&mons_sel_mcid=amzn1.merchant.o.AYYIDVF584WMO&mons_sel_persist=true
VAR ProcessingFeeUS = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight <= 1.0, 0.60,
            ItemWeight <= 2, 0.70,
            ItemWeight <= 4, 0.90,
            ItemWeight <= 10, 1.20,
            ItemWeight > 10, 1.90 + ROUNDUP(ItemWeight - 10, 0) * 0.20
        ),
    SWITCH(
        TRUE(),
        NoWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight <= 0.5, 0.25,
        ItemWeight <= 1, 0.30,
        ItemWeight <= 2, 0.35,
        ItemWeight > 2, 0.40 + ROUNDUP(ItemWeight - 2, 0) * 0.20
    )
)

// https://sellercentral.amazon.co.uk/help/hub/reference/GR3768HHG3T5X6J2?mons_sel_mkid=amzn1.mp.o.A1F83G8C2ARO7P&mons_sel_mcid=amzn1.merchant.o.A2FE7WE9SGDKJH&mons_sel_persist=true
VAR ProcessingFeeGB = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight * 1000 <= 500, 0.66,
            ItemWeight * 1000 <= 1000, 1.32,
            ItemWeight * 1000 <= 2000, 1.98,
            ItemWeight * 1000 <= 5000, 3.31,
            ItemWeight * 1000 > 5000, 3.97 + ROUNDUP(DIVIDE(ItemWeight * 1000 - 5000, 1000), 0) * 0.40
        ),
    SWITCH(
        TRUE(),
        NoWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight * 1000 <= 200, 0.30,
        ItemWeight * 1000 <= 500, 0.36,
        ItemWeight * 1000 <= 1000, 0.60,
        ItemWeight * 1000 > 1000, 0.80 + ROUNDUP(DIVIDE(ItemWeight * 1000 - 1000, 1000), 0) * 0.40
    )
)

// https://sellercentral.amazon.co.uk/help/hub/reference/GR3768HHG3T5X6J2?mons_sel_mkid=amzn1.mp.o.A1F83G8C2ARO7P&mons_sel_mcid=amzn1.merchant.o.A2FE7WE9SGDKJH&mons_sel_persist=true
VAR ProcessingFeeEU = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight * 1000 <= 500, 0.64,
            ItemWeight * 1000 <= 1000, 1.28,
            ItemWeight * 1000 <= 2000, 1.92,
            ItemWeight * 1000 <= 5000, 3.21,
            ItemWeight * 1000 > 5000, 3.85 + ROUNDUP(DIVIDE(ItemWeight * 1000 - 5000, 1000), 0) * 0.40
        ),
    SWITCH(
        TRUE(),
        NoWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight * 1000 <= 200, 0.34,
        ItemWeight * 1000 <= 500, 0.38,
        ItemWeight * 1000 <= 1000, 0.70,
        ItemWeight * 1000 > 1000, 0.77 + ROUNDUP(DIVIDE(ItemWeight * 1000 - 1000, 1000), 0) * 0.40
    )
)

// https://sellercentral.amazon.com/help/hub/reference/GZ5Q2VW5WF4JWRGC?mons_sel_mkid=amzn1.mp.o.A2EUQ1WTGCTBG2&mons_sel_mcid=amzn1.merchant.o.AYYIDVF584WMO&mons_sel_persist=true
VAR ProcessingFeeCA = 0

RETURN
SWITCH(
    TRUE(),
    SalesRegion = "US", ProcessingFeeUS,
    SalesRegion = "GB", ProcessingFeeGB,
    SalesRegion = "EU", ProcessingFeeEU,
    SalesRegion = "CA", ProcessingFeeCA,
    SalesRegion = "MX", "Not found",
    BLANK()
)
```

#### `$_estimated_disposal_fee`

**Depende de medidas:** `[i_11Brands_us_shipping_weight]`, `[i_amazon_fact_fee_preview_max_size_tier]`, `[i_amazon_storage_fee_item_weight]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
VAR SalesRegion = SELECTEDVALUE(SKUs[Sales Region])
VAR SizeTier = CALCULATE([i_amazon_fact_fee_preview_max_size_tier], ALL('Calendar'))
VAR NoTier = ISBLANK(SizeTier)
VAR IsOversize = SEARCH("Oversize", SizeTier, 1, 0) > 0
VAR ItemWeight = CALCULATE([i_amazon_storage_fee_item_weight], ALL('Calendar'))
VAR NoItemWeight = ISBLANK(ItemWeight)
VAR ShippingWeightUS = [i_11Brands_us_shipping_weight]
VAR NoShippingWeight = ISBLANK(ItemWeight)

// Disposal Fees for US
VAR DisposalFeeUS = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoShippingWeight, BLANK(),
            NoTier, BLANK(),
            ShippingWeightUS <= 1.0, 3.12,
            ShippingWeightUS <= 2, 4.30,
            ShippingWeightUS <= 4, 6.36,
            ShippingWeightUS <= 10, 10.04,
            ShippingWeightUS > 10, 14.32 + ROUND(ShippingWeightUS - 10, 0) * 1.06
        ),
    SWITCH(
        TRUE(),
        NoShippingWeight, BLANK(),
        NoTier, BLANK(),
        ShippingWeightUS <= 0.5, 1.04,
        ShippingWeightUS <= 1, 1.53,
        ShippingWeightUS <= 2, 2.27,
        ShippingWeightUS > 2, 2.89 + ROUND(ShippingWeightUS - 2, 0) * 1.06
    )
)

// https://sellercentral.amazon.co.uk/help/hub/reference/G200685050?mons_sel_mkid=amzn1.mp.o.A1F83G8C2ARO7P&mons_sel_mcid=amzn1.merchant.o.A2FE7WE9SGDKJH&mons_sel_persist=true
VAR DisposalFeeGB = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoItemWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight * 1000 <= 500, 3.06,
            ItemWeight * 1000 <= 1000, 6.56,
            ItemWeight * 1000 <= 2000, 9.68,
            ItemWeight * 1000 <= 5000, 12.26,
            ItemWeight * 1000 > 5000, 16.06 + ROUND(DIVIDE(ItemWeight * 1000 - 5000, 1000), 0) * 0.88
        ),
    SWITCH(
        TRUE(),
        NoItemWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight * 1000 <= 200, 0.74,
        ItemWeight * 1000 <= 500, 1.15,
        ItemWeight * 1000 <= 1000, 2.28,
        ItemWeight * 1000 > 1000, 2.73 + ROUND(DIVIDE(ItemWeight * 1000 - 1000, 1000), 0) * 0.88
    )
)

// https://sellercentral.amazon.co.uk/help/hub/reference/G200685050?mons_sel_mkid=amzn1.mp.o.A1F83G8C2ARO7P&mons_sel_mcid=amzn1.merchant.o.A2FE7WE9SGDKJH&mons_sel_persist=true
VAR DisposalFeeEU = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoItemWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight * 1000 <= 500, 3.74,
            ItemWeight * 1000 <= 1000, 7.67,
            ItemWeight * 1000 <= 2000, 10.66,
            ItemWeight * 1000 <= 5000, 14.59,
            ItemWeight * 1000 > 5000, 15.23 + ROUND(DIVIDE(ItemWeight * 1000 - 5000, 1000), 0) * 1.55
        ),
    SWITCH(
        TRUE(),
        NoItemWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight * 1000 <= 200, 0.74,
        ItemWeight * 1000 <= 500, 1.19,
        ItemWeight * 1000 <= 1000, 2.73,
        ItemWeight * 1000 > 1000, 3.73 + ROUND(DIVIDE(ItemWeight * 1000 - 1000, 1000), 0) * 1.41
    )
)

// https://sellercentral.amazon.ca/help/hub/reference/GZ5Q2VW5WF4JWRGC?mons_sel_mkid=amzn1.mp.o.A2EUQ1WTGCTBG2&mons_sel_mcid=amzn1.merchant.o.AYYIDVF584WMO&mons_sel_persist=true
VAR DisposalFeeCA = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoItemWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight * 1000 <= 200, 0.93,
            ItemWeight * 1000 <= 500, 1.33,
            ItemWeight * 1000 <= 1000, 1.69,
            ItemWeight * 1000 <= 2000, 2.83,
            ItemWeight * 1000 <= 5000, 5.02,
            ItemWeight * 1000 > 5000, 5.70 + ROUNDUP(DIVIDE(ItemWeight * 1000 - 5000, 1000), 0) * 0.97
        ),
    SWITCH(
        TRUE(),
        NoItemWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight * 1000 <= 200, 0.36,
        ItemWeight * 1000 <= 500, 0.82,
        ItemWeight * 1000 <= 1000, 1.62,
        ItemWeight * 1000 > 1000, 2.31 + ROUNDUP(DIVIDE(ItemWeight * 1000 - 1000, 1000), 0) * 1.54
    )
)

// https://sellercentral.amazon.ca/help/hub/reference/G200685050?mons_sel_mkid=amzn1.mp.o.A1AM78C64UM0Y8&mons_sel_mcid=amzn1.merchant.o.AYYIDVF584WMO&mons_sel_persist=true#wjz_cjc_jcb-1
VAR DisposalFeeMX = 
SWITCH(
    TRUE(),
    IsOversize, 
        SWITCH(
            TRUE(),
            NoItemWeight, BLANK(),
            NoTier, BLANK(),
            ItemWeight * 2.20462262185 * 1000 <= 200, 13.68,
            ItemWeight * 2.20462262185 * 1000 <= 500, 19.16,
            ItemWeight * 2.20462262185 * 1000 <= 1000, 24.62,
            ItemWeight * 2.20462262185 * 1000 <= 2000, 30.10,
            ItemWeight * 2.20462262185 * 1000 <= 5000, 35.58,
            ItemWeight * 2.20462262185 * 1000  > 5000, 35.58 + ROUNDUP(DIVIDE(ItemWeight * 2.20462262185 * 1000 - 5000, 1000), 0) * 4.0
        ),
    SWITCH(
        TRUE(),
        NoItemWeight, BLANK(),
        NoTier, BLANK(),
        ItemWeight * 2.20462262185 * 1000 <= 200, 8.20,
        ItemWeight * 2.20462262185 * 1000 <= 500, 13.68,
        ItemWeight * 2.20462262185 * 1000 <= 1000, 21.91,
        ItemWeight * 2.20462262185 * 1000  > 1000, 21.91 + ROUNDUP(DIVIDE(ItemWeight * 2.20462262185 * 1000 - 1000, 1000), 0) * 8.0
    )
)

RETURN
SWITCH(
    TRUE(),
    SalesRegion = "US", DisposalFeeUS,
    SalesRegion = "GB", DisposalFeeGB,
    SalesRegion = "EU", DisposalFeeEU,
    SalesRegion = "CA", DisposalFeeCA,
    SalesRegion = "MX", DisposalFeeMX,
    BLANK()
)
```

#### `$_estimated_storage_fee_last_45_days`

**Depende de medidas:** `[$_estimated_storage_fee]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _maxDate =
    CALCULATE (
        MAX('Calendar'[Date]),
        'Calendar'[Date] <= MIN ( MAX('Calendar'[Date]), TODAY()-1 )
    )

RETURN
    CALCULATE (
        [$_estimated_storage_fee],
        DATESINPERIOD ( 'Calendar'[Date], _maxDate ,-45 , DAY )
    )
```

#### `$_estimated_storage_fee_actual`

**Depende de colunas:** `'fact_storage_fee_daily'[estimated_daily_storage_fee]`  
```dax
SUM ( 'fact_storage_fee_daily'[estimated_daily_storage_fee] )
```

#### `$_estimated_storage_fee_forecast`

**Depende de colunas:** `fact_estimated_future_daily_storage_fee[estimated_daily_storage_fee]`  
```dax
SUM ( fact_estimated_future_daily_storage_fee[estimated_daily_storage_fee] )
```

#### `%_estimated_storage_fee_over_revenue_moving_average_21_days`

**Depende de medidas:** `[$_estimated_storage_fee]`, `[$_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Date]`  
```dax
VAR _timeFrame = 21
    VAR _lastDate =  LASTDATE('Inventory Ledger'[Date])
    
    VAR _datesBetween =
        DATESBETWEEN(
            'Calendar'[Date],
            DATEADD(_lastDate, - _timeFrame, DAY),
            DATEADD(_lastDate, - 1, DAY)
        )

    VAR _totalStorageFee = SUMX ( _datesBetween, [$_estimated_storage_fee] )
    VAR _totalRevenue = SUMX ( _datesBetween, [$_revenue] )

    VAR _movingAverage = DIVIDE( _totalStorageFee, _totalRevenue )

RETURN
_movingAverage
```

#### `%_amz_storage_fee_over_net_revenue`

**Depende de medidas:** `[$_estimated_storage_fee]`, `[$_net_revenue]`  
```dax
VAR _div = DIVIDE( [$_estimated_storage_fee], [$_net_revenue] ) 

RETURN
    _div
```

#### `%_awd_storage_fee_over_net_revenue`

**Depende de medidas:** `[$_awd_storage_fee]`, `[$_net_revenue]`  
```dax
VAR _div = DIVIDE( [$_awd_storage_fee], [$_net_revenue] ) 

RETURN
    _div
```

#### `%_estimated_storage_fee_over_net_revenue`

**Depende de medidas:** `[$_estimated_storage_fee]`, `[$_net_revenue]`  
```dax
DIVIDE(
    [$_estimated_storage_fee]
    , [$_net_revenue]
)
```


### Fees\Storage Fee\Storage Fee Rate

#### `$_amz_storage_fee_rate_q1`

**Depende de colunas:** `'f_storage_fee_rate'[date_update]`, `'f_storage_fee_rate'[value]`, `f_storage_fee_rate[quarter]`  
```dax
VAR _Quarter = "Q1"

VAR LastUpdatedFile = 
CALCULATE(
    MAX('f_storage_fee_rate'[date_update]),
    ALL(f_storage_fee_rate)
    
)

RETURN
CALCULATE(
    MAX('f_storage_fee_rate'[value]),
    f_storage_fee_rate[quarter] = _Quarter
)
```

#### `$_amz_storage_fee_rate_q2`

**Depende de colunas:** `'f_storage_fee_rate'[date_update]`, `'f_storage_fee_rate'[value]`, `f_storage_fee_rate[quarter]`  
```dax
VAR _Quarter = "Q2"

VAR LastUpdatedFile = 
CALCULATE(
    MAX('f_storage_fee_rate'[date_update]),
    ALL(f_storage_fee_rate)
    
)

RETURN
CALCULATE(
    MAX('f_storage_fee_rate'[value]),
    f_storage_fee_rate[quarter] = _Quarter
)
```

#### `$_amz_storage_fee_rate_q3`

**Depende de colunas:** `'f_storage_fee_rate'[date_update]`, `'f_storage_fee_rate'[value]`, `f_storage_fee_rate[quarter]`  
```dax
VAR _Quarter = "Q3"

VAR LastUpdatedFile = 
CALCULATE(
    MAX('f_storage_fee_rate'[date_update]),
    ALL(f_storage_fee_rate)
    
)

RETURN
CALCULATE(
    MAX('f_storage_fee_rate'[value]),
    f_storage_fee_rate[quarter] = _Quarter
)
```

#### `$_amz_storage_fee_rate_q4`

**Depende de colunas:** `'f_storage_fee_rate'[date_update]`, `'f_storage_fee_rate'[value]`, `f_storage_fee_rate[quarter]`  
```dax
VAR _Quarter = "Q4"

VAR LastUpdatedFile = 
CALCULATE(
    MAX('f_storage_fee_rate'[date_update]),
    ALL(f_storage_fee_rate)
    
)

RETURN
CALCULATE(
    MAX('f_storage_fee_rate'[value]),
    f_storage_fee_rate[quarter] = _Quarter
)
```


### Inactive Calendar Metrics\PPC

#### `$_ppc_revenue_inactive_calendar`

**Depende de medidas:** `[$_ppc_sales]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_ppc_sales]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `$_ppc_revenue_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_ppc_revenue_inactive_calendar]`, `[$_ppc_sales]`  
```dax
VAR _result = [$_ppc_sales] - [$_ppc_revenue_inactive_calendar]

RETURN
    _result
```

#### `%_ppc_revenue_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_ppc_revenue_inactive_calendar]`, `[$_ppc_sales]`  
```dax
VAR _result = 
        DIVIDE ( [$_ppc_sales], [$_ppc_revenue_inactive_calendar] ) 
            - if([$_ppc_sales]<>0 || [$_ppc_revenue_inactive_calendar] <> 0, 1, BLANK())

RETURN
    _result
```

#### `$_ppc_spend_inactive_calendar`

**Depende de medidas:** `[$_ppc_spend]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_ppc_spend]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `$_ppc_spend_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_ppc_spend]`, `[$_ppc_spend_inactive_calendar]`  
```dax
VAR _result = [$_ppc_spend] - [$_ppc_spend_inactive_calendar]

RETURN
    _result
```

#### `%_ppc_spend_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_ppc_spend]`, `[$_ppc_spend_inactive_calendar]`  
```dax
VAR _result = DIVIDE ( [$_ppc_spend], [$_ppc_spend_inactive_calendar] ) 
    - IF ( [$_ppc_spend] <> 0 || [$_ppc_spend_inactive_calendar] <> 0, 1, BLANK())

RETURN
    _result
```

#### `%_ppc_ratio_revenue_inactive_calendar`

**Depende de medidas:** `[%_ppc_ratio_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [%_ppc_ratio_revenue]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `pp_ppc_ratio_revenue_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[%_ppc_ratio_revenue]`, `[%_ppc_ratio_revenue_inactive_calendar]`  
```dax
VAR _result = ( [%_ppc_ratio_revenue] - [%_ppc_ratio_revenue_inactive_calendar] ) * 100

RETURN
    _result
```

#### `%_ppc_tacos_inactive_calendar`

**Depende de medidas:** `[%_ppc_tacos]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [%_ppc_tacos]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `pp_ppc_tacos_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[%_ppc_tacos]`, `[%_ppc_tacos_inactive_calendar]`  
```dax
VAR _result = ( [%_ppc_tacos] - [%_ppc_tacos_inactive_calendar] ) * 100

RETURN
    _result
```

#### `%_ppc_acos_inactive_calendar`

**Depende de medidas:** `[%_ppc_acos]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [%_ppc_acos]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `pp_ppc_acos_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[%_ppc_acos]`, `[%_ppc_acos_inactive_calendar]`  
```dax
VAR _result = ( [%_ppc_acos] - [%_ppc_acos_inactive_calendar] ) * 100

RETURN
    _result
```


### Inactive Calendar Metrics\Sales

#### `$_net_revenue_inactive_calendar`

**Depende de medidas:** `[$_item_promotion_discount]`, `[$_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_revenue] - [$_item_promotion_discount]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `$_net_revenue_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_net_revenue]`, `[$_net_revenue_inactive_calendar]`  
```dax
VAR _result = [$_net_revenue] - [$_net_revenue_inactive_calendar]

RETURN
    _result
```

#### `%_revenue_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_net_revenue]`, `[$_net_revenue_inactive_calendar]`  
```dax
VAR _result = 
        DIVIDE ( [$_net_revenue], [$_net_revenue_inactive_calendar] ) 
            - IF ( [$_net_revenue] <> 0 || [$_net_revenue_inactive_calendar] <> 0, 1, BLANK() )

RETURN
    _result
```

#### `u_units_sold_inactive_calendar`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [u_units_sold]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `u_units_sold_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[u_units_sold]`, `[u_units_sold_inactive_calendar]`  
```dax
VAR _result = [u_units_sold] - [u_units_sold_inactive_calendar]

RETURN
    _result
```

#### `%_units_sold_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[u_units_sold]`, `[u_units_sold_inactive_calendar]`  
```dax
VAR _result = 
        DIVIDE ( [u_units_sold], [u_units_sold_inactive_calendar] ) 
        - IF ( [u_units_sold] <> 0 || [u_units_sold_inactive_calendar] <> 0, 1, BLANK())

RETURN
    _result
```

#### `$_net_average_price_inactive_calendar`

**Depende de medidas:** `[$_net_average_price]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_net_average_price]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `%_net_average_price_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_net_average_price]`, `[$_net_average_price_inactive_calendar]`  
```dax
VAR _result = [$_net_average_price] - [$_net_average_price_inactive_calendar]

RETURN
    _result
```

#### `$_organic_revenue_inactive_calendar`

**Depende de medidas:** `[$_organic_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_organic_revenue]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `%_organic_revenue_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_organic_revenue]`, `[$_organic_revenue_inactive_calendar]`  
```dax
VAR _result = 
        DIVIDE ( [$_organic_revenue], [$_organic_revenue_inactive_calendar] ) 
            - if([$_organic_revenue]<>0 || [$_organic_revenue_inactive_calendar] <> 0, 1, BLANK())

RETURN
    _result
```

#### `$_operational_profit_inactive_calendar`

**Depende de medidas:** `[$_operational_profit]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_operational_profit]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `%_operational_profit_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_operational_profit]`, `[$_operational_profit_inactive_calendar]`  
```dax
VAR _result = 
        DIVIDE([$_operational_profit], [$_operational_profit_inactive_calendar] )
        - IF ( [$_operational_profit] <> 0 || [$_operational_profit_inactive_calendar] <> 0, 1, BLANK())
RETURN
    _result
```

#### `$_commercial_profit_inactive_calendar`

**Depende de medidas:** `[$_commercial_profit]`  
**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`  
```dax
VAR _result = 
        CALCULATE(
            [$_commercial_profit]
            , ALL ( 'Calendar' )
            , USERELATIONSHIP(
                'Calendar'[Date]
                , 'dim_calendar_aux'[Date aux]
            )
        )

RETURN
    _result
```

#### `%_commercial_profit_difference_between_periods_inactive_calendar`

**Depende de medidas:** `[$_commercial_profit]`, `[$_commercial_profit_inactive_calendar]`  
```dax
VAR _result = 
        DIVIDE([$_commercial_profit], [$_commercial_profit_inactive_calendar] )
        - IF ( [$_commercial_profit] <> 0 || [$_commercial_profit_inactive_calendar] <> 0, 1, BLANK())
RETURN
    _result
```

#### `%_operational_profit_over_net_revenue`

**Depende de medidas:** `[$_net_revenue_promotion_tax]`, `[$_operational_profit]`  
```dax
VAR _div = DIVIDE( [$_operational_profit], [$_net_revenue_promotion_tax] ) 

RETURN
    _div
```


### Inv - Mapped Returns

#### `$_sku_returns_fee`

**Depende de medidas:** `[u_sku_returned_units_charged]`  
**Depende de colunas:** `'f.us_returns_processing_fee'[sku_fee_per_unit]`  
```dax
SUMX(
    'f.us_returns_processing_fee',
    [u_sku_returned_units_charged] * 'f.us_returns_processing_fee'[sku_fee_per_unit]
)
```

#### `%_avg_mapped_return_rate`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    ALL(SKUs[Sales Region]),
    ALLSELECTED(SKUs)
)
```

#### `%_mapped_return_rate_sply`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
IF(
    ISBLANK([%_mapped_return_rate]),
    BLANK(),
    CALCULATE(
        [%_mapped_return_rate],
        SAMEPERIODLASTYEAR(
            'Calendar'[Date]
            )
    )
)
```

#### `u_mapped_return_units_sply`

**Depende de medidas:** `[u_mapped_return_units]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
IF(
    ISBLANK([u_mapped_return_units]),
    BLANK(),
    CALCULATE(
        [u_mapped_return_units],
        SAMEPERIODLASTYEAR(
            'Calendar'[Date]
        )
    )
)
```

#### `return_impact_share`

**Depende de medidas:** `[%_mapped_return_rate]`, `[u_mapped_return_units]`  
**Depende de colunas:** `SKUs[Base SKU]`, `SKUs[Native Family]`  
```dax
VAR ShareLevelBaseSKU =
DIVIDE(
    SUMX(VALUES(SKUs[Base SKU]), [%_mapped_return_rate] * [u_mapped_return_units]),
    CALCULATE(
        SUMX(VALUES(SKUs[Base SKU]), [%_mapped_return_rate] * [u_mapped_return_units]),
        ALLSELECTED(SKUs[Base SKU])
    )
)

VAR ShareLevelNativeFamily =
DIVIDE(
    SUMX(VALUES(SKUs[Native Family]), [%_mapped_return_rate] * [u_mapped_return_units]),
    CALCULATE(
        SUMX(VALUES(SKUs[Native Family]), [%_mapped_return_rate] * [u_mapped_return_units]),
        ALLSELECTED(SKUs)
    )
)

RETURN
IF(
    ISINSCOPE(SKUs[Base SKU]),
    ShareLevelBaseSKU,
    ShareLevelNativeFamily
)
```

#### `returns_fee_share`

**Depende de medidas:** `[$_sku_returns_fee]`  
**Depende de colunas:** `SKUs[Base SKU]`, `SKUs[Native Family]`  
```dax
VAR ShareLevelNativeFamily =
DIVIDE(
    SUMX(VALUES(SKUs[Native Family]), [$_sku_returns_fee]),
    CALCULATE(
        SUMX(VALUES(SKUs[Native Family]), [$_sku_returns_fee]),
        ALLSELECTED(SKUs)
    )
)

VAR ShareLevelBaseSKU =
DIVIDE(
    SUMX(VALUES(SKUs[Base SKU]), [$_sku_returns_fee]),
    CALCULATE(
        SUMX(VALUES(SKUs[Base SKU]), [$_sku_returns_fee]),
        ALLSELECTED(SKUs[Base SKU])
    )
)

RETURN
IF(
    ISINSCOPE(SKUs[Base SKU]),
    ShareLevelBaseSKU,
    ShareLevelNativeFamily
)
```

#### `%_mapped_return_rate_US`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    SKUs[Sales Region] = "US"
)
```

#### `%_mapped_return_rate_EU`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    SKUs[Sales Region] = "EU"
)
```

#### `%_mapped_return_rate_CA`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    SKUs[Sales Region] = "CA"
)
```

#### `%_mapped_return_rate_GB`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    SKUs[Sales Region] = "GB"
)
```

#### `%_mapped_return_rate_MX`

**Depende de medidas:** `[%_mapped_return_rate]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
CALCULATE(
    [%_mapped_return_rate],
    SKUs[Sales Region] = "MX"
)
```

#### `u_units_shipped_sply`

**Depende de medidas:** `[u_units_shipped]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
CALCULATE(
    [u_units_shipped],
    SAMEPERIODLASTYEAR(
        'Calendar'[Date]
    )
)
```

#### `$_sku_returns_fee_sply`

**Depende de medidas:** `[$_sku_returns_fee]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
CALCULATE(
    [$_sku_returns_fee],
    SAMEPERIODLASTYEAR(
        'Calendar'[Date]
    )
)
```

#### `return_impact_yoy`

**Depende de medidas:** `[%_mapped_return_rate]`, `[u_mapped_return_units]`, `[u_units_shipped]`  
**Depende de colunas:** `'Calendar'[Date]`, `SKUs[Base SKU]`  
```dax
VAR CurrentYear = SUMX(VALUES(SKUs[Base SKU]), [%_mapped_return_rate] * [u_mapped_return_units])

VAR LastYear =
CALCULATE(
    SUMX(VALUES(SKUs[Base SKU]), [%_mapped_return_rate] * [u_mapped_return_units]),
    SAMEPERIODLASTYEAR(
        'Calendar'[Date]
    )
)

RETURN
IF(
    ISBLANK([u_units_shipped]),
    BLANK(),
    DIVIDE(CurrentYear - LastYear, LastYear, 0)
)
```

#### `u_sku_returned_units_charged`

**Depende de colunas:** `'f.us_returns_processing_fee'[sku_returned_units_charged]`  
```dax
SUM('f.us_returns_processing_fee'[sku_returned_units_charged])
```

#### `threshold_base_sku`

**Depende de medidas:** `[return_rate_threshold]`, `[u_units_shipped]`  
**Depende de colunas:** `'f.us_returns_processing_fee'[asin_return_threshold_percent]`, `'f.us_returns_processing_fee'[date_charge]`, `SKUs[Base SKU]`  
```dax
VAR LastDateCharge = 
CALCULATE(
    MAX('f.us_returns_processing_fee'[date_charge]),
    ALL('Calendar')
)

VAR CurrentBaseSKU = SELECTEDVALUE(SKUs[Base SKU])

VAR BaseSKUThreshold = 
CALCULATE (
    MAX('f.us_returns_processing_fee'[asin_return_threshold_percent]),
    FILTER(
        ALL('f.us_returns_processing_fee'),
        'f.us_returns_processing_fee'[date_charge] = LastDateCharge
    )
)

VAR SKUThreshold =
MAXX(
    FILTER(
        ALL(SKUs),
        SKUs[Base SKU] = CurrentBaseSKU
    ),
    [return_rate_threshold]
)

VAR Global_Min_Threshold = 
CALCULATE(
    MIN('f.us_returns_processing_fee'[asin_return_threshold_percent]),
    ALL('Calendar'),
    ALL('SKUs')
)

VAR Final_Threshold = 
    COALESCE(
        SKUThreshold,
        Global_Min_Threshold
    )
    
RETURN
IF(
    ISBLANK([u_units_shipped]),
    BLANK(),
    SKUThreshold
)
```


### Inv - Measure Comparison

#### `last_not_blank_life_cycle`

**Depende de medidas:** `[u_units_shipped]`  
**Depende de colunas:** `'SKUs'[Refresh Date]`, `SKUs[Life Cycle]`  
```dax
IF(
    ISBLANK([u_units_shipped]),
    BLANK(),
    CALCULATE(
        MAX(SKUs[Life Cycle]),
        FILTER(
            SKUs,
            NOT(ISBLANK(SKUs[Life Cycle]))
        ),
        'SKUs'[Refresh Date] = MAX('SKUs'[Refresh Date])
    )
)
```

#### `$_previous_diff_fba_fee`

**Depende de colunas:** `'fact_fee_preview'[date_fee_preview]`, `'fact_fee_preview'[expected_fulfillment_fee_per_unit]`, `'fact_fee_preview'[key_sales_marketplace_sku]`  
```dax
VAR CurrentSKU = SELECTEDVALUE('fact_fee_preview'[key_sales_marketplace_sku])

VAR FeeTable = 
    FILTER(
        'fact_fee_preview',
        'fact_fee_preview'[key_sales_marketplace_sku] = CurrentSKU
    )

VAR LatestDate = 
    MAXX(
        FeeTable,
        'fact_fee_preview'[date_fee_preview]
    )

VAR LatestFee = 
    CALCULATE(
        MAX('fact_fee_preview'[expected_fulfillment_fee_per_unit]),
        'fact_fee_preview'[date_fee_preview] = LatestDate
    )

VAR PreviousRecord = 
    TOPN(
        1,
        FILTER(
            FeeTable,
            'fact_fee_preview'[date_fee_preview] < LatestDate &&
            'fact_fee_preview'[expected_fulfillment_fee_per_unit] <> LatestFee
        ),
        'fact_fee_preview'[date_fee_preview], DESC
    )

VAR PreviousFee = MAXX(PreviousRecord, 'fact_fee_preview'[expected_fulfillment_fee_per_unit])
VAR PreviousDate = MAXX(PreviousRecord, 'fact_fee_preview'[date_fee_preview])

RETURN PreviousFee
```

#### `d_previous_diff_date`

**Depende de colunas:** `'fact_fee_preview'[date_fee_preview]`, `'fact_fee_preview'[expected_fulfillment_fee_per_unit]`, `'fact_fee_preview'[key_sales_marketplace_sku]`  
```dax
VAR CurrentSKU = SELECTEDVALUE('fact_fee_preview'[key_sales_marketplace_sku])

VAR FeeTable = 
    FILTER(
        'fact_fee_preview',
        'fact_fee_preview'[key_sales_marketplace_sku] = CurrentSKU
    )

VAR LatestDate = 
    MAXX(
        FeeTable,
        'fact_fee_preview'[date_fee_preview]
    )

VAR LatestFee = 
    CALCULATE(
        MAX('fact_fee_preview'[expected_fulfillment_fee_per_unit]),
        'fact_fee_preview'[date_fee_preview] = LatestDate
    )

VAR PreviousRecord = 
    TOPN(
        1,
        FILTER(
            FeeTable,
            'fact_fee_preview'[date_fee_preview] < LatestDate &&
            'fact_fee_preview'[expected_fulfillment_fee_per_unit] <> LatestFee
        ),
        'fact_fee_preview'[date_fee_preview], DESC
    )

VAR PreviousFee = MAXX(PreviousRecord, 'fact_fee_preview'[expected_fulfillment_fee_per_unit])
VAR PreviousDate = MAXX(PreviousRecord, 'fact_fee_preview'[date_fee_preview])

RETURN PreviousDate
```

#### `d_diff_last_previous_days`

**Depende de medidas:** `[d_previous_diff_date]`  
**Depende de colunas:** `'fact_fee_preview'[date_fee_preview]`  
```dax
VAR LatestDate = 
    MAXX(
        'fact_fee_preview',
        'fact_fee_preview'[date_fee_preview]
    )

RETURN DATEDIFF([d_previous_diff_date], LatestDate, DAY)
```

#### `Δ_last_previous_fee`

**Depende de medidas:** `[$_previous_diff_fba_fee]`, `[$_unit_last_fba_fee_fee_preview]`  
```dax
DIVIDE(
    [$_unit_last_fba_fee_fee_preview] - [$_previous_diff_fba_fee], 
    [$_previous_diff_fba_fee], 
    0
)
```

#### `flag_shifting_fba_costs`

**Depende de medidas:** `[$_unit_last_fba_fee_calculation_expected]`, `[$_unit_last_fba_fee_fee_preview]`, `[Δ_last_previous_fee]`  
```dax
SWITCH(
    TRUE(),
    [Δ_last_previous_fee] > 0 && [$_unit_last_fba_fee_fee_preview] > [$_unit_last_fba_fee_calculation_expected],
    UNICHAR(128308),
    [Δ_last_previous_fee] > 0 && [$_unit_last_fba_fee_fee_preview] < [$_unit_last_fba_fee_calculation_expected],
    UNICHAR(128993),
    [Δ_last_previous_fee] < 0 && [$_unit_last_fba_fee_fee_preview] < [$_unit_last_fba_fee_calculation_expected],
    UNICHAR(128994),
    [Δ_last_previous_fee] < 0 && [$_unit_last_fba_fee_fee_preview] > [$_unit_last_fba_fee_calculation_expected],
    UNICHAR(128308)
)
```

#### `%_share_of_region_units_sold_last_12_months`

**Depende de medidas:** `[u_total_sales_region_units_sold_last_12_months]`, `[u_units_sold_last_12_months]`  
```dax
VAR EndDate = TODAY() - 1
VAR StartDate = EDATE(EndDate, -12) + 1

VAR UnitsSoldLTM = [u_units_sold_last_12_months]

VAR TotalBySalesRegionAndSKU = [u_total_sales_region_units_sold_last_12_months]

VAR ShareLTM = 
    DIVIDE(
        UnitsSoldLTM,
        TotalBySalesRegionAndSKU
    )

RETURN ShareLTM
```

#### `u_weighted_inventory_region`

**Depende de medidas:** `[%_share_of_region_units_sold_last_12_months]`, `[u_inventory_region_ending_plus_transit]`  
```dax
[%_share_of_region_units_sold_last_12_months] * [u_inventory_region_ending_plus_transit]
```

#### `$_total_diff_fba_fee_by_weighted_stock`

**Depende de medidas:** `[$_unit_last_fba_fee_diff_estimated_expected]`, `[u_weighted_inventory_region]`  
```dax
[u_weighted_inventory_region] * [$_unit_last_fba_fee_diff_estimated_expected]
```

#### `u_inventory_region_ending_plus_transit`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `SKUs[Country | SKU]`, `SKUs[SKU]`, `SKUs[Sales Region]`  
```dax
CALCULATE(
    [u_inventory_ending_plus_transit],
    KEEPFILTERS(SKUs[Sales Region] = SELECTEDVALUE(SKUs[Sales Region])),
    KEEPFILTERS(SKUs[SKU] = SELECTEDVALUE(SKUs[SKU])),
    REMOVEFILTERS(SKUs[Country | SKU])
)
```

#### `max_fba_fee_diff_by_native_family`

**Depende de medidas:** `[$_total_diff_fba_fee_by_weighted_stock]`, `[total_diff]`  
**Depende de colunas:** `SKUs[Country | SKU]`, `SKUs[Native Family]`, `SKUs[Sales Region]`  
```dax
VAR SummarizedTable =
    ADDCOLUMNS(
        SUMMARIZE(
            SKUs,
            SKUs[Sales Region],
            SKUs[Native Family],
            SKUs[Country | SKU]
        ),
        "total_diff", CALCULATE([$_total_diff_fba_fee_by_weighted_stock])
    )
VAR Result =
    MAXX(
        SummarizedTable,
        [total_diff]  // Lista de valores por SKU para calcular o desvio
    )

RETURN Result
```

#### `+_diff_fba_fee_by_family`

**Depende de medidas:** `[$_total_diff_fba_fee_by_weighted_stock]`, `[total_diff]`  
**Depende de colunas:** `SKUs[Country | SKU]`, `SKUs[Native Family]`, `SKUs[Sales Region]`  
```dax
VAR Result =
    COUNTX(
        FILTER(
            SUMMARIZECOLUMNS(
                SKUs[Sales Region],
                SKUs[Native Family],
                SKUs[Country | SKU],
                "total_diff", [$_total_diff_fba_fee_by_weighted_stock]
            ),
            [total_diff] > 0
        ),
        1
    )
    
RETURN Result
```

#### `+_sum_diff_fba_fee_by_family`

**Depende de medidas:** `[$_total_diff_fba_fee_by_weighted_stock]`, `[$_weighted_total_diff_fba_fee]`, `[total_diff]`  
**Depende de colunas:** `SKUs[Country | SKU]`, `SKUs[Native Family]`, `SKUs[Sales Region]`  
```dax
VAR SummarizedTable =
    ADDCOLUMNS(
        SUMMARIZE(
            SKUs,
            SKUs[Sales Region],
            SKUs[Native Family],
            SKUs[Country | SKU]
        ),
        "total_diff", CALCULATE([$_total_diff_fba_fee_by_weighted_stock])
    )
VAR FilteredTable =
    FILTER(
        SummarizedTable,
        [total_diff] > 0
    )
VAR Result =
    SUMX(
        FilteredTable,
        [total_diff]
    )
RETURN Result

// // Tentativa de otimizar a performance da fórmula
// SUMX(
//     VALUES(SKUs[Country | SKU]),
//     VAR CurrentRegion = SELECTEDVALUE(SKUs[Sales Region])
//     VAR CurrentFamily = SELECTEDVALUE(SKUs[Native Family])
//     VAR CurrentDiff = 
//     CALCULATE(
//         [$_weighted_total_diff_fba_fee],
//         SKUs[Sales Region] = CurrentRegion,
//         SKUs[Native Family] = CurrentFamily,
//         KEEPFILTERS(SKUs[Country | SKU] = EARLIER(SKUs[Country | SKU]))
//     )
//     RETURN
//     IF(CurrentDiff > 0, CurrentDiff, 0)
// )
```

#### `$_avg_fba_unit_fee`

**Depende de medidas:** `[$_total_fba_fee_fee_preview]`, `[u_units_sold]`  
```dax
DIVIDE([$_total_fba_fee_fee_preview], [u_units_sold], 0)
```

#### `$_avg_fba_unit_fee_same_period_last_year`

**Depende de medidas:** `[$_total_fba_fee_fee_preview]`, `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    DIVIDE([$_total_fba_fee_fee_preview], [u_units_sold], 0)
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `d_days_since_last_support_case`

**Depende de colunas:** `'fact_seller_suport_cases'[Date Closed]`, `'fact_seller_suport_cases'[SKU]`  
```dax
AVERAGEX(
    VALUES('fact_seller_suport_cases'[SKU]),
    VAR _LastDate =
        CALCULATE(
            MAX('fact_seller_suport_cases'[Date Closed]),
            REMOVEFILTERS('Calendar')
        )
    RETURN
        IF(
            ISBLANK(_LastDate),
            BLANK(),
            DATEDIFF(_LastDate, TODAY(), DAY)
        )
)
```

#### `%_avg_fba_fee_unit_year_over_year_yoy`

**Depende de medidas:** `[$_avg_fba_unit_fee]`, `[$_avg_fba_unit_fee_same_period_last_year]`  
```dax
DIVIDE(
    [$_avg_fba_unit_fee] - [$_avg_fba_unit_fee_same_period_last_year],
    [$_avg_fba_unit_fee_same_period_last_year],
    BLANK()
)
```

#### `$_total_diff_fba_fee_by_unit_sold`

**Depende de medidas:** `[$_unit_last_fba_fee_diff_estimated_expected]`, `[u_units_sold_last_12_months]`  
```dax
[u_units_sold_last_12_months] * [$_unit_last_fba_fee_diff_estimated_expected]
```

#### `d_max_date_closed`

**Depende de colunas:** `'fact_seller_suport_cases'[Date Closed]`  
```dax
MAX('fact_seller_suport_cases'[Date Closed])
```

#### `u_total_sales_region_units_sold_last_12_months`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `SKUs[Sales Region]`  
```dax
VAR EndDate = TODAY() - 1
VAR StartDate = EDATE(EndDate, -12) + 1

RETURN
    CALCULATE(
        [u_units_sold],
        FILTER(
            ALL('Calendar'),
            'Calendar'[Date] >= StartDate &&
            'Calendar'[Date] <= EndDate
        ),
        ALLEXCEPT(SKUs, SKUs[Sales Region])
    )
```


### Inv Aging

#### `daily_avg_u_solds_30d`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR EndDate = TODAY() - 1
VAR StartDate = EndDate - 29
VAR _datesBetween =
    CALCULATETABLE(
        DATESBETWEEN(
            'Calendar'[Date],
            StartDate,
            EndDate
        ),
        ALL('Calendar')
    )

VAR _totalUnitsSold =
    CALCULATE(
        [u_units_sold],
        _datesBetween
    )

VAR _numDays = 
    COUNTROWS(_datesBetween)

RETURN COALESCE(_totalUnitsSold / _numDays, 0)
```

#### `$_aging_surcharge_projection`

**Depende de colunas:** `f_aging_projection[aging_surcharge]`, `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`, `f_aging_projection[simulation]`  
```dax
CALCULATE(
    SUM(f_aging_projection[aging_surcharge]),
    FILTER(
        f_aging_projection,
        f_aging_projection[has_surcharge] = TRUE() &&
        f_aging_projection[file_date] = MAX(f_aging_projection[file_date]) &&
        f_aging_projection[simulation] <= 3
        )
)
```

#### `$_aging_surcharged_actual`

**Depende de colunas:** `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
SUMX(
    'fact.aged_inventory_surcharge',
    'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
)
```

#### `u_inventory_with_surcharge`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`, `f_aging_projection[inventory_by_inbound_shipments]`  
```dax
VAR QtyInventoryInSurcharge =
CALCULATE(
    SUM(f_aging_projection[inventory_by_inbound_shipments]),
    FILTER(
        f_aging_projection,
        f_aging_projection[has_surcharge] = TRUE() &&
        f_aging_projection[file_date] = [d_last_file_aging]
    )
)

RETURN 
    QtyInventoryInSurcharge
    // COALESCE(QtyInventoryInSurcharge, 0)
```

#### `$_aging_surcharge_last_file`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[aging_surcharge]`, `f_aging_projection[file_date]`  
```dax
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[aging_surcharge]
        ),
        FILTER(
            f_aging_projection,
            f_aging_projection[file_date] = [d_last_file_aging]
        )
)
```

#### `$_aging_surcharge_snapshot`

**Depende de colunas:** `'Tabela'[aging_surcharge]`, `'Tabela'[file_date]`, `'Tabela'[simulation]`, `f_aging_projection[aging_surcharge]`, `f_aging_projection[file_date]`, `f_aging_projection[simulation]`  
```dax
VAR FirstFileDate = 
CALCULATE(
    MIN(f_aging_projection[file_date]),
    FILTER(
        f_aging_projection,
        f_aging_projection[simulation] <= 3
    )
)

// VAR FirstFileAgingSurcharge = 
//     CALCULATE(
//         SUM('Tabela'[aging_surcharge]),
//         FILTER(
//             'Tabela',
//             'Tabela'[file_date] = FirstFileDate && 'Tabela'[simulation] <= 3
//         )
//     )
// VAR SubsequentMonthsAgingSurcharge = 
//     SUMX(
//         VALUES('Tabela'[file_date]),
//         VAR CurrentMonth = MONTH('Tabela'[file_date])
//         VAR FirstFileDateInMonth = 
//             CALCULATE(
//                 MIN('Tabela'[file_date]),
//                 FILTER(
//                     'Tabela',
//                     MONTH('Tabela'[file_date]) = CurrentMonth && 'Tabela'[simulation] = 3
//                 )
//             )
//         RETURN
//             CALCULATE(
//                 SUM('Tabela'[aging_surcharge]),
//                 FILTER(
//                     'Tabela',
//                     'Tabela'[file_date] = FirstFileDateInMonth && 'Tabela'[simulation] = 3
//                 )
//             )
//     )

RETURN
CALCULATE(
    SUM(f_aging_projection[aging_surcharge]),
    f_aging_projection[file_date] = FirstFileDate
)
```

#### `$_aging_surcharge_actual_projection`

**Depende de medidas:** `[$_aging_surcharge_projection]`, `[$_aging_surcharged_actual]`  
```dax
COALESCE(
    [$_aging_surcharged_actual],
    [$_aging_surcharge_projection]
)
```

#### `sum_inventory_by_inbound_shipments_last_file`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`  
```dax
CALCULATE(
    SUM(f_aging_projection[inventory_by_inbound_shipments]),
    FILTER(
        f_aging_projection,
        f_aging_projection[file_date] = [d_last_file_aging]
    )
)
```

#### `sum_aging_surcharge_CA`

**Depende de medidas:** `[$_aging_surcharge_last_file]`  
**Depende de colunas:** `SKUs[Inventory Region]`  
```dax
// CALCULATE(
//     [$_aging_surcharge_last_file],
//     FILTER(
//         ALL(SKUs),
//         SKUs[Inventory Region] = "CA"
//     )
// )
CALCULATE(
    [$_aging_surcharge_last_file],
    SKUs[Inventory Region] = "CA"
)
```

#### `sum_aging_surcharge_EU`

**Depende de medidas:** `[$_aging_surcharge_last_file]`  
**Depende de colunas:** `SKUs[Inventory Region]`  
```dax
// CALCULATE(
//     [$_aging_surcharge_last_file],
//     FILTER(
//         ALL(SKUs),
//         SKUs[Inventory Region] = "EU"
//     )
// )

CALCULATE(
    [$_aging_surcharge_last_file],
        SKUs[Inventory Region] = "EU"
)
```

#### `sum_aging_surcharge_GB`

**Depende de medidas:** `[$_aging_surcharge_last_file]`  
**Depende de colunas:** `SKUs[Inventory Region]`  
```dax
// CALCULATE(
//     [$_aging_surcharge_last_file],
//     FILTER(
//         ALL(SKUs),
//         SKUs[Inventory Region] = "GB"
//     )
// )

CALCULATE(
    [$_aging_surcharge_last_file],
    SKUs[Inventory Region] = "GB"
)
```

#### `sum_aging_surcharge_US`

**Depende de medidas:** `[$_aging_surcharge_last_file]`  
**Depende de colunas:** `SKUs[Inventory Region]`  
```dax
// CALCULATE(
//     [$_aging_surcharge_last_file],
//     FILTER(
//         ALL(SKUs),
//         SKUs[Inventory Region] = "US"
//     )
// )

CALCULATE(
    [$_aging_surcharge_last_file],
    SKUs[Inventory Region] = "US"
)
```

#### `Inv %_diff_aging_surcharge_projection_snapshot`

**Depende de medidas:** `[$_aging_surcharge_actual_projection]`, `[$_aging_surcharge_snapshot]`  
```dax
IF(
    ISBLANK([$_aging_surcharge_snapshot]),
    BLANK(),
    DIVIDE(
        [$_aging_surcharge_actual_projection] - [$_aging_surcharge_snapshot],
        [$_aging_surcharge_snapshot],
        0
    )
)
```

#### `u_simulated_inventory`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `SKUs[SKU]`, `f_aging_projection[current_inventory]`, `f_aging_projection[file_date]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])

VAR InventoryRegionLevel =  
SUMX(
    VALUES(SKUs[SKU]),
    CALCULATE(
        MAXX(
            FILTER(
                f_aging_projection,
                f_aging_projection[file_date] = [d_last_file_aging]
            ),
            f_aging_projection[current_inventory]
        )
    )
)

VAR SKULevel =
CALCULATE(
    MAXX(
        FILTER(
            f_aging_projection,
            f_aging_projection[file_date] = [d_last_file_aging]
        ),
        f_aging_projection[current_inventory]
    )
)

RETURN IF(IsSKUInContext, SKULevel, InventoryRegionLevel)
```

#### `inventory_start`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`, `[u_inventory_with_surcharge]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
VAR MeasureSKULevel =
IF(
    [u_inventory_with_surcharge] = 0,
    0,
    CALCULATE(
        [u_inventory_ending_plus_transit],
        ALL('Calendar'),
        ALL(f_aging_projection)
    )
)

VAR InventoryRegionLevel =
SUMX(
    VALUES(SKUs[SKU]),
    CALCULATE(
        IF(
            [u_inventory_with_surcharge] = 0,
            0,
            CALCULATE(
                [u_inventory_ending_plus_transit],
                ALL('Calendar'),
                ALL(f_aging_projection)
            )
        )
    )
)

RETURN
IF(
    ISINSCOPE(SKUs[SKU]),
    MeasureSKULevel,
    InventoryRegionLevel
)
```

#### `target_velocity`

**Depende de medidas:** `[ref_date_last_date_inventory]`, `[target_sales]`, `[u_inventory_with_surcharge]`  
```dax
IF(
    [u_inventory_with_surcharge] = 0,
    0,
    [target_sales] / [ref_date_last_date_inventory]
)
```

#### `target_sales`

**Depende de medidas:** `[inventory_start]`, `[inventory_target_for_zero_surcharge]`  
```dax
[inventory_start] - [inventory_target_for_zero_surcharge]
```

#### `ref_date_last_date_inventory`

**Depende de medidas:** `[u_inventory_with_surcharge]`  
**Depende de colunas:** `'Inventory Ledger'[Date]`, `f_aging_projection[date_aging_projection]`  
```dax
VAR last_date_inventory =
CALCULATE (
    MAX ('Inventory Ledger'[Date]), 
    ALL('Inventory Ledger'),
    ALL('Calendar'),
    ALL(SKUs),
    ALL(f_aging_projection)
)

VAR ref_date = MAX(f_aging_projection[date_aging_projection])

RETURN 
IF(
    [u_inventory_with_surcharge] = 0,
    0,
    DATEDIFF(last_date_inventory, ref_date, DAY) //+ 1
)
```

#### `$_avg_aging_surcharge_actual_previous_3_months`

**Depende de medidas:** `[$_aging_surcharged_actual]`  
**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
VAR LastChargedDate = 
    CALCULATE(
        MAX('fact.aged_inventory_surcharge'[date_charge]),
        ALL('Calendar'),
        ALL(SKUs)
    )

VAR ThreeMonthsAgo = DATE(
    YEAR(EDATE(LastChargedDate, -3))
    , MONTH(EDATE(LastChargedDate, -3))
    , 1
    )

// RETURN
// CALCULATE(
//     SUMX(
//         FILTER(
//             'fact.aged_inventory_surcharge',
//             'fact.aged_inventory_surcharge'[date_charge] >= ThreeMonthsAgo && 
//             'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH(LastChargedDate, -1)
//         ),
//         'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
//     ),
//     ALL('Calendar'),
//     ALL(SKUs)
// ) / 3


RETURN
    CALCULATE (
        [$_aging_surcharged_actual],
        FILTER (
            'fact.aged_inventory_surcharge',
            'fact.aged_inventory_surcharge'[date_charge] >= ThreeMonthsAgo
                && 'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH ( LastChargedDate, -1 )
        ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
    / 3
```

#### `$_aging_surcharge_actual_previous_month`

**Depende de medidas:** `[$_aging_surcharged_actual]`, `[d_last_date_charge_aging]`  
**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
VAR BeginLastMonth =
    DATE (
        YEAR ( EDATE ( [d_last_date_charge_aging], 0 ) ),
        MONTH ( EDATE ( [d_last_date_charge_aging], 0 ) ),
        1
    )

// RETURN 
// CALCULATE(
//     SUMX(
//         FILTER(
//             'fact.aged_inventory_surcharge',
//             'fact.aged_inventory_surcharge'[date_charge] >= BeginLastMonth && 
//             'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH([d_last_date_charge_aging],0)
//         ),
//         'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
//     ),
//     ALL('Calendar'),
//     ALL(SKUs)
// )

RETURN
    CALCULATE (
        [$_aging_surcharged_actual],
        FILTER (
            'fact.aged_inventory_surcharge',
            'fact.aged_inventory_surcharge'[date_charge] >= BeginLastMonth
                && 'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH ( [d_last_date_charge_aging], 0 )
        ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
```

#### `$_avg_aging_surcharge_actual_previous_12_months`

**Depende de medidas:** `[$_aging_surcharged_actual]`  
**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
VAR LastChargedDate =
    CALCULATE (
        MAX ( 'fact.aged_inventory_surcharge'[date_charge] ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
VAR TwelveMonthsAgo =
    DATE ( YEAR ( EDATE ( LastChargedDate, -12 ) ),
           MONTH ( EDATE ( LastChargedDate, -12 ) ),
           1 )

// RETURN
// CALCULATE(
//     SUMX(
//         FILTER(
//             'fact.aged_inventory_surcharge',
//             'fact.aged_inventory_surcharge'[date_charge] >= TwelveMonthsAgo && 
//             'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH(LastChargedDate, -1)
//         ),
//         'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
//     ),
//     ALL('Calendar'),
//     ALL(SKUs)
// ) / 12

RETURN
    CALCULATE (
        [$_aging_surcharged_actual],
        FILTER (
            'fact.aged_inventory_surcharge',
            'fact.aged_inventory_surcharge'[date_charge] >= TwelveMonthsAgo
                && 'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH ( LastChargedDate, -1 )
        ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
    / 12
```

#### `sum_aging_surcharge_MX`

**Depende de medidas:** `[$_aging_surcharge_last_file]`  
**Depende de colunas:** `SKUs[Inventory Region]`  
```dax
// CALCULATE(
//     [$_aging_surcharge_last_file],
//     FILTER(
//         ALL(SKUs),
//         SKUs[Inventory Region] = "MX"
//     )
// )

CALCULATE(
    [$_aging_surcharge_last_file],
    SKUs[Inventory Region] = "MX"
)
```

#### `sum_aging_surcharge_total`

**Depende de medidas:** `[$_aging_surcharge_last_file]`  
**Depende de colunas:** `f_aging_projection[simulation]`  
```dax
CALCULATE(
    [$_aging_surcharge_last_file],
    FILTER(
        ALL(f_aging_projection),
        f_aging_projection[simulation] <= 3
    ),
    REMOVEFILTERS(SKUs),
    REMOVEFILTERS('Calendar')
)
```

#### `%_inventory_with_surcharge`

**Depende de medidas:** `[u_inventory_with_surcharge]`, `[u_simulated_inventory]`  
```dax
DIVIDE(
    [u_inventory_with_surcharge], 
    [u_simulated_inventory], 
    0
)
```

#### `Δ_target_velocity_current_daily_avg_u_solds_30d`

**Depende de medidas:** `[daily_avg_u_solds_30d]`, `[target_velocity]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])

RETURN
    IF(
        IsSKUInContext,
        DIVIDE(
            [target_velocity] - [daily_avg_u_solds_30d], 
            [daily_avg_u_solds_30d], 
            BLANK()
        ),
        BLANK()
    )
```

#### `d_last_file_aging`

**Depende de colunas:** `f_aging_projection[file_date]`  
```dax
CALCULATE(
    MAX(f_aging_projection[file_date]),
    ALL('Calendar'),
    ALL(f_aging_projection),
    ALL(SKUs)
)
```

#### `$_actual_aging_cost`

**Depende de medidas:** `[rate-surcharge]`  
**Depende de colunas:** `'SKUS'[SKU]`, `'fact.aged_inventory_surcharge'[key_inventory_country_sku]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[year_month]`, `SKUs[SKU]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])
VAR Qty = 
    CALCULATE(SUM('fact.aged_inventory_surcharge'[qty-charged]), ALLEXCEPT('fact.aged_inventory_surcharge', 'fact.aged_inventory_surcharge'[key_inventory_country_sku]))

VAR Surcharge = 
    CALCULATE(SUMX('fact.aged_inventory_surcharge', [qty-charged] * [rate-surcharge]), ALLEXCEPT('fact.aged_inventory_surcharge', 'fact.aged_inventory_surcharge'[key_inventory_country_sku]))

VAR YearMonths = 
    CALCULATE(DISTINCTCOUNT('fact.aged_inventory_surcharge'[year_month]), ALLEXCEPT('fact.aged_inventory_surcharge', 'fact.aged_inventory_surcharge'[key_inventory_country_sku]))


VAR Qty_Etq_Medio = 
    DIVIDE(Qty, YearMonths, 0)

RETURN IF(IsSKUInContext, DIVIDE(Surcharge, Qty_Etq_Medio, 0), BLANK())
// IF(
//     HASONEVALUE('SKUS'[SKU]),
//     DIVIDE(Surcharge, Qty_Etq_Medio, 0)
// )
```

#### `$_projected_storage_fee`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[estimated_storage_fee_aging_inventory]`, `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`  
```dax
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[estimated_storage_fee_aging_inventory]
        ),
        FILTER(
            f_aging_projection,
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        )
)
```

#### `$_projected_aging_cost_all_simulations`

**Depende de medidas:** `[d_last_file_aging]`, `[u_estimated_qty_on_hand_aging]`  
**Depende de colunas:** `'SKUS'[SKU]`, `SKUs[SKU]`, `f_aging_projection[aging_surcharge]`, `f_aging_projection[file_date]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])

VAR TotalAgingSurcharge =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[aging_surcharge]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging]
        ),
        REMOVEFILTERS('Calendar')
)

// VAR TotalAgingSurchargeRegionLevel =
// CALCULATE(
//     SUMX(
//         f_aging_projection,
//         f_aging_projection[aging_surcharge]
//         ),
//         FILTER(
//             ALL(f_aging_projection),
//             f_aging_projection[file_date] = [d_last_file_aging]
//         ),
//         REMOVEFILTERS('Calendar'),
//         REMOVEFILTERS(SKUs[SKU])
// )

RETURN IF(IsSKUInContext, DIVIDE(TotalAgingSurcharge, [u_estimated_qty_on_hand_aging]), BLANK())
// IF(
//     ISINSCOPE('SKUS'[SKU]),
//     DIVIDE(TotalAgingSurcharge, [u_estimated_qty_on_hand_aging]),
//     DIVIDE(TotalAgingSurchargeRegionLevel, [u_estimated_qty_on_hand_aging])
// )
```

#### `$_projected_storage_fee_all_simulations`

**Depende de medidas:** `[d_last_file_aging]`, `[u_estimated_qty_on_hand_aging]`  
**Depende de colunas:** `SKUs[SKU]`, `f_aging_projection[estimated_storage_fee_aging_inventory]`, `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])

VAR TotalStorageFee =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[estimated_storage_fee_aging_inventory]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        ),
        REMOVEFILTERS('Calendar')
)

// VAR TotalStorageFeeRegion =
// CALCULATE(
//     SUMX(
//         f_aging_projection,
//         f_aging_projection[estimated_storage_fee_aging_inventory]
//         ),
//         FILTER(
//             ALL(f_aging_projection),
//             f_aging_projection[file_date] = [d_last_file_aging] &&
//             f_aging_projection[has_surcharge] = TRUE()
//         ),
//         REMOVEFILTERS('Calendar'),
//         REMOVEFILTERS(SKUs[SKU])
// )

RETURN IF(IsSKUInContext, DIVIDE(TotalStorageFee, [u_estimated_qty_on_hand_aging]), BLANK())
// IF(
//     ISINSCOPE(SKUs[SKU]),
//     DIVIDE(TotalStorageFee, [u_estimated_qty_on_hand_aging]),
//     DIVIDE(TotalStorageFeeRegion, [u_estimated_qty_on_hand_aging])
// )
```

#### `$_projected_aging_cost_cumulative`

**Depende de medidas:** `[d_last_file_aging]`, `[u_estimated_qty_on_hand_aging_cumulative]`  
**Depende de colunas:** `'Calendar'[Year-Month]`, `'SKUS'[SKU]`, `'SKUs'[SKU]`, `SKUs[SKU]`, `f_aging_projection[aging_surcharge]`, `f_aging_projection[file_date]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])
VAR SelectedYearMonth = SELECTEDVALUE('Calendar'[Year-Month])

VAR TotalAgingSurcharge =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[aging_surcharge]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging]
        ),
        FILTER(
            ALL('Calendar'),
            'Calendar'[Year-Month] <= SelectedYearMonth
    )
)

// VAR TotalAgingSurchargeRegionLevel =
// CALCULATE(
//     SUMX(
//         f_aging_projection,
//         f_aging_projection[aging_surcharge]
//         ),
//         FILTER(
//             ALL(f_aging_projection),
//             f_aging_projection[file_date] = [d_last_file_aging]
//         ),
//         FILTER(
//             ALL('Calendar'),
//             'Calendar'[Year-Month] <= SelectedYearMonth
//         ),
//         ALL('SKUs'[SKU])
// )

RETURN IF(IsSKUInContext, DIVIDE(TotalAgingSurcharge, [u_estimated_qty_on_hand_aging_cumulative]), BLANK())
// IF(
//     ISINSCOPE('SKUS'[SKU]),
//     DIVIDE(TotalAgingSurcharge, [u_estimated_qty_on_hand_aging_cumulative]),
//     DIVIDE(TotalAgingSurchargeRegionLevel, [u_estimated_qty_on_hand_aging_cumulative])
// )
```

#### `$_projected_storage_fee_cumulative`

**Depende de medidas:** `[d_last_file_aging]`, `[u_estimated_qty_on_hand_aging_cumulative]`  
**Depende de colunas:** `'Calendar'[Year-Month]`, `'SKUs'[SKU]`, `SKUs[SKU]`, `f_aging_projection[estimated_storage_fee_aging_inventory]`, `f_aging_projection[file_date]`, `f_aging_projection[has_surcharge]`  
```dax
VAR IsSKUInContext = ISINSCOPE(SKUs[SKU])
VAR SelectedYearMonth = SELECTEDVALUE('Calendar'[Year-Month])

VAR TotalStorageFee =
CALCULATE(
    SUMX(
        f_aging_projection,
        f_aging_projection[estimated_storage_fee_aging_inventory]
        ),
        FILTER(
            ALL(f_aging_projection),
            f_aging_projection[file_date] = [d_last_file_aging] &&
            f_aging_projection[has_surcharge] = TRUE()
        ),
        FILTER(
            ALL('Calendar'),
            'Calendar'[Year-Month] <= SelectedYearMonth
    )
)

// VAR TotalStorageFeeRegion =
// CALCULATE(
//     SUMX(
//         f_aging_projection,
//         f_aging_projection[estimated_storage_fee_aging_inventory]
//         ),
//         FILTER(
//             ALL(f_aging_projection),
//             f_aging_projection[file_date] = [d_last_file_aging] &&
//             f_aging_projection[has_surcharge] = TRUE()
//         ),
//         FILTER(
//             ALL('Calendar'),
//             'Calendar'[Year-Month] <= SelectedYearMonth
//         ),
//         ALL('SKUs'[SKU])
// )

RETURN IF(IsSKUInContext, DIVIDE(TotalStorageFee, [u_estimated_qty_on_hand_aging_cumulative]), BLANK())
// IF(
//     ISINSCOPE(SKUs[SKU]),
//     DIVIDE(TotalStorageFee, [u_estimated_qty_on_hand_aging_cumulative]),
//     DIVIDE(TotalStorageFeeRegion, [u_estimated_qty_on_hand_aging_cumulative])
// )
```

#### `d_promo_action_on_course`

**Depende de colunas:** `SKUs[SKU]`, `f_promotion_tracker[end_date]`  
```dax
// VAR FlagActivePricePromoAction =
// COUNTROWS(
//     CALCULATETABLE(
//         f_promotion_tracker,
//         f_promotion_tracker[end_date] >= Today
//         )
// )

VAR EndDate =
CALCULATE(
    MAX(f_promotion_tracker[end_date]),
    ALL('Calendar')
)

RETURN
IF(
    HASONEVALUE(SKUs[SKU]) && EndDate >= TODAY(),
    EndDate
)
```

#### `$_total_cumulative_costs_aging_storage`

**Depende de medidas:** `[$_projected_aging_cost_cumulative]`, `[$_projected_storage_fee_cumulative]`  
```dax
[$_projected_aging_cost_cumulative] + 
[$_projected_storage_fee_cumulative]
```

#### `$_total_costs_aging_storage_all_simulations`

**Depende de medidas:** `[$_projected_aging_cost_all_simulations]`, `[$_projected_storage_fee_all_simulations]`  
```dax
[$_projected_aging_cost_all_simulations] +
[$_projected_storage_fee_all_simulations]
```

#### `u_available_aging`

**Depende de medidas:** `[Available]`  
**Depende de colunas:** `'fact_fba_inventory'[available]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
// VAR LastReportDate = 
//     CALCULATE(
//         MAX('fact_fba_inventory'[date_fba_inventory]),
//         REMOVEFILTERS('Calendar')
//     )

// VAR UnitsAvailable =
//     CALCULATE(
//         SUM('fact_fba_inventory'[available]),
//         REMOVEFILTERS('Calendar'),
//         'fact_fba_inventory'[date_fba_inventory] = LastReportDate
//     )

// RETURN
//     UnitsAvailable

VAR LastReportDate =
    CALCULATE(
        MAX('fact_fba_inventory'[date_fba_inventory]),
        REMOVEFILTERS('Calendar')
    )

VAR UnitsAvailable =
    CALCULATE(
        SUMX(
            SUMMARIZE(
                FILTER(
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = LastReportDate
                ),
                'fact_fba_inventory'[key_inventory_region_sku],
                "Available", MAX('fact_fba_inventory'[available])
            ),
            [Available]
        ),
        REMOVEFILTERS('Calendar')
    )

RETURN
    UnitsAvailable
```

#### `u_available`

**Depende de colunas:** `'fact_fba_inventory'[available]`, `'fact_fba_inventory'[date_fba_inventory]`  
```dax
VAR _maxDateInData = MAX( 'fact_fba_inventory'[date_fba_inventory] )
VAR _lastDate = IF( _maxDateInData < TODAY(), _maxDateInData, TODAY() )

VAR UnitsAvailable =
    CALCULATE(
        SUM('fact_fba_inventory'[available]),
        'fact_fba_inventory'[date_fba_inventory] = _maxDateInData
    )

RETURN
    UnitsAvailable
```

#### `$_aging_surcharged_actual_usd`

**Depende de colunas:** `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`, `'fact.aged_inventory_surcharge'[rate_surcharge_usd]`  
```dax
SUMX(
    'fact.aged_inventory_surcharge',
    'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge] * 'fact.aged_inventory_surcharge'[rate_surcharge_usd]
)
```

#### `$_aging_surcharge_actual_usd_previous_month`

**Depende de medidas:** `[$_aging_surcharged_actual_usd]`, `[d_last_date_charge_aging]`  
**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
VAR BeginLastMonth =
    DATE (
        YEAR ( EDATE ( [d_last_date_charge_aging], 0 ) ),
        MONTH ( EDATE ( [d_last_date_charge_aging], 0 ) ),
        1
    )

// RETURN 
// CALCULATE(
//     SUMX(
//         FILTER(
//             'fact.aged_inventory_surcharge',
//             'fact.aged_inventory_surcharge'[date_charge] >= BeginLastMonth && 
//             'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH([d_last_date_charge_aging],0)
//         ),
//         'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
//     ),
//     ALL('Calendar'),
//     ALL(SKUs)
// )

RETURN
    CALCULATE (
        [$_aging_surcharged_actual_usd],
        FILTER (
            'fact.aged_inventory_surcharge',
            'fact.aged_inventory_surcharge'[date_charge] >= BeginLastMonth
                && 'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH ( [d_last_date_charge_aging], 0 )
        ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
```

#### `$_avg_aging_surcharge_actual_usd_previous_12_months`

**Depende de medidas:** `[$_aging_surcharged_actual_usd]`  
**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
VAR LastChargedDate =
    CALCULATE (
        MAX ( 'fact.aged_inventory_surcharge'[date_charge] ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
VAR TwelveMonthsAgo =
    DATE ( YEAR ( EDATE ( LastChargedDate, -12 ) ),
           MONTH ( EDATE ( LastChargedDate, -12 ) ),
           1 )

// RETURN
// CALCULATE(
//     SUMX(
//         FILTER(
//             'fact.aged_inventory_surcharge',
//             'fact.aged_inventory_surcharge'[date_charge] >= TwelveMonthsAgo && 
//             'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH(LastChargedDate, -1)
//         ),
//         'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
//     ),
//     ALL('Calendar'),
//     ALL(SKUs)
// ) / 12

RETURN
    CALCULATE (
        [$_aging_surcharged_actual_usd],
        FILTER (
            'fact.aged_inventory_surcharge',
            'fact.aged_inventory_surcharge'[date_charge] >= TwelveMonthsAgo
                && 'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH ( LastChargedDate, -1 )
        ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
    / 12
```

#### `$_avg_aging_surcharge_actual_usd_previous_3_months`

**Depende de medidas:** `[$_aging_surcharged_actual_usd]`  
**Depende de colunas:** `'fact.aged_inventory_surcharge'[date_charge]`, `'fact.aged_inventory_surcharge'[qty-charged]`, `'fact.aged_inventory_surcharge'[rate-surcharge]`  
```dax
VAR LastChargedDate = 
    CALCULATE(
        MAX('fact.aged_inventory_surcharge'[date_charge]),
        ALL('Calendar'),
        ALL(SKUs)
    )

VAR ThreeMonthsAgo = DATE(
    YEAR(EDATE(LastChargedDate, -3))
    , MONTH(EDATE(LastChargedDate, -3))
    , 1
    )

// RETURN
// CALCULATE(
//     SUMX(
//         FILTER(
//             'fact.aged_inventory_surcharge',
//             'fact.aged_inventory_surcharge'[date_charge] >= ThreeMonthsAgo && 
//             'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH(LastChargedDate, -1)
//         ),
//         'fact.aged_inventory_surcharge'[qty-charged] * 'fact.aged_inventory_surcharge'[rate-surcharge]
//     ),
//     ALL('Calendar'),
//     ALL(SKUs)
// ) / 3


RETURN
    CALCULATE (
        [$_aging_surcharged_actual_usd],
        FILTER (
            'fact.aged_inventory_surcharge',
            'fact.aged_inventory_surcharge'[date_charge] >= ThreeMonthsAgo
                && 'fact.aged_inventory_surcharge'[date_charge] <= EOMONTH ( LastChargedDate, -1 )
        ),
        ALL ( 'Calendar' ),
        ALL ( SKUs )
    )
    / 3
```


### Inv Aging\New

#### `u_skus_with_inventory`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[aging_bucket]`, `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`, `f_aging_projection[key_inventory_region_sku]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
RETURN
    CALCULATE (
        DISTINCTCOUNT ( f_aging_projection[key_inventory_region_sku] ),
        REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
        f_aging_projection[file_date] = LastAgingDate,
        f_aging_projection[inventory_by_inbound_shipments] > 0
    )
```

#### `u_skus_at_risk`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[aging_bucket]`, `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`, `f_aging_projection[key_inventory_region_sku]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
RETURN
    CALCULATE (
        DISTINCTCOUNT ( f_aging_projection[key_inventory_region_sku] ),
        REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
        f_aging_projection[file_date] = LastAgingDate,
        f_aging_projection[aging_bucket] = "At Risk",
        f_aging_projection[inventory_by_inbound_shipments] > 0
    )
```

#### `u_skus_aged`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[aging_bucket]`, `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`, `f_aging_projection[key_inventory_region_sku]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
RETURN
    CALCULATE (
        DISTINCTCOUNT ( f_aging_projection[key_inventory_region_sku] ),
        REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
        f_aging_projection[file_date] = LastAgingDate,
        f_aging_projection[aging_bucket] = "Aged",
        f_aging_projection[inventory_by_inbound_shipments] > 0
    )
```

#### `%_skus_at_risk`

**Depende de medidas:** `[u_skus_at_risk]`, `[u_skus_with_inventory]`  
```dax
DIVIDE ( [u_skus_at_risk], [u_skus_with_inventory] )
```

#### `%_skus_aged`

**Depende de medidas:** `[u_skus_aged]`, `[u_skus_with_inventory]`  
```dax
DIVIDE ( [u_skus_aged], [u_skus_with_inventory] )
```

#### `u_inventory_at_risk`

**Depende de medidas:** `[d_last_file_aging]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'Calendar'[Date]`, `f_aging_projection[aging_bucket]`, `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
VAR ShareAtRisk =
    DIVIDE (
        CALCULATE (
            SUM ( f_aging_projection[inventory_by_inbound_shipments] ),
            REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
            f_aging_projection[file_date] = LastAgingDate,
            f_aging_projection[aging_bucket] = "At Risk"
        ),
        CALCULATE (
            SUM ( f_aging_projection[inventory_by_inbound_shipments] ),
            REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
            f_aging_projection[file_date] = LastAgingDate
        )
    )
VAR InventoryAtAgingDate =
    CALCULATE (
        [u_inventory_ending_plus_transit],
        'Calendar'[Date] = LastAgingDate
    )
RETURN
    ShareAtRisk * InventoryAtAgingDate
```

#### `u_inventory_aged`

**Depende de medidas:** `[d_last_file_aging]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'Calendar'[Date]`, `f_aging_projection[aging_bucket]`, `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
VAR ShareAged =
    DIVIDE (
        CALCULATE (
            SUM ( f_aging_projection[inventory_by_inbound_shipments] ),
            REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
            f_aging_projection[file_date] = LastAgingDate,
            f_aging_projection[aging_bucket] = "Aged"
        ),
        CALCULATE (
            SUM ( f_aging_projection[inventory_by_inbound_shipments] ),
            REMOVEFILTERS ( f_aging_projection[aging_bucket] ),
            f_aging_projection[file_date] = LastAgingDate
        )
    )
VAR InventoryAtAgingDate =
    CALCULATE (
        [u_inventory_ending_plus_transit],
        'Calendar'[Date] = LastAgingDate
    )
RETURN
    ShareAged * InventoryAtAgingDate
```

#### `%_aging_surcharge_over_normal_storage_fee`

**Depende de medidas:** `[$_aging_surcharge_actual_projection]`, `[$_estimated_storage_fee_actual]`  
```dax
DIVIDE (
    [$_aging_surcharge_actual_projection],
    [$_estimated_storage_fee_actual]
)
```

#### `_test_inv_at_aging`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
CALCULATE (
    [u_inventory_ending_plus_transit],
    'Calendar'[Date] = DATE ( 2026, 4, 16 )
)
```

#### `_debug_numerator`

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[aging_bucket]`, `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
RETURN
CALCULATE (
    SUM ( f_aging_projection[inventory_by_inbound_shipments] ),
    FILTER (
        ALL ( f_aging_projection ),
        f_aging_projection[file_date] = LastAgingDate
            && f_aging_projection[aging_bucket] = "At Risk"
    )
)
```

#### `_debug_denominator `

**Depende de medidas:** `[d_last_file_aging]`  
**Depende de colunas:** `f_aging_projection[file_date]`, `f_aging_projection[inventory_by_inbound_shipments]`  
```dax
VAR LastAgingDate = [d_last_file_aging]
RETURN
CALCULATE (
    SUM ( f_aging_projection[inventory_by_inbound_shipments] ),
    FILTER (
        ALL ( f_aging_projection ),
        f_aging_projection[file_date] = LastAgingDate
    )
)
```


### Inventory\FBA Inventory\Actual Quantity

#### `d_last_fba_inventory`

**Depende de colunas:** `SKUs[SKU]`, `fact_fba_inventory[date_fba_inventory]`  
```dax
CALCULATE(
    MAX(fact_fba_inventory[date_fba_inventory]),
    REMOVEFILTERS(SKUs[SKU])
)
```

#### `lead_time_reserved_fc_processing`

**Depende de medidas:** `[d_last_fba_inventory]`, `[u_reserved_fc_processing]`  
**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[key_inventory_region_sku]`, `'fact_fba_inventory'[reserved_fc_processing]`  
```dax
// VAR CurrentSKU = SELECTEDVALUE('fact_fba_inventory'[key_inventory_region_sku])

// VAR AllDates = CALCULATETABLE(
//     DISTINCT('fact_fba_inventory'[date_fba_inventory]),
//     'fact_fba_inventory'[key_inventory_region_sku] = CurrentSKU
// )

// VAR ChangeDates = FILTER(
//     AllDates,
//     VAR CurrentDate = 'fact_fba_inventory'[date_fba_inventory]
//     VAR CurrentValue = CALCULATE(
//         MAX('fact_fba_inventory'[reserved_fc_processing]),
//         'fact_fba_inventory'[date_fba_inventory] = CurrentDate
//     )
//     VAR PreviousDate = CALCULATE(
//         MAX('fact_fba_inventory'[date_fba_inventory]),
//         'fact_fba_inventory'[date_fba_inventory] < CurrentDate
//     )
//     VAR PreviousValue = CALCULATE(
//         MAX('fact_fba_inventory'[reserved_fc_processing]),
//         'fact_fba_inventory'[date_fba_inventory] = PreviousDate
//     )
//     RETURN CurrentValue <> PreviousValue
// )

// VAR LatestChangeDate = MAXX(ChangeDates, 'fact_fba_inventory'[date_fba_inventory])

// VAR NewValue = CALCULATE(
//     MAX('fact_fba_inventory'[reserved_fc_processing]),
//     'fact_fba_inventory'[date_fba_inventory] = LatestChangeDate
// )

// RETURN IF(NewValue=0, BLANK(), DATEDIFF(LatestChangeDate, [d_last_fba_inventory], DAY))


VAR _current_date = MAX('Calendar'[Date])
VAR _current_sku = SELECTEDVALUE('fact_fba_inventory'[key_inventory_region_sku])

-- Avalia o valor da medida 'u_last_modified...' na data do contexto
VAR _current_qty = [u_reserved_fc_processing]

RETURN
IF(
    -- Só calculamos se houver quantidade positiva atualmente
    NOT(ISBLANK(_current_qty)) && _current_qty > 0,
    
    VAR _last_zero_date = 
        CALCULATE(
            MAX('Calendar'[Date]),
            FILTER(
                ALL('Calendar'[Date]),
                'Calendar'[Date] < _current_date &&
                (
                    -- Recalcula a medida para cada data passada para verificar se era 0 ou vazia
                    -- Nota: Isso assume que 'u_last_modified...' responde corretamente ao contexto de linha de 'Calendar'[Date]
                    ISBLANK([u_reserved_fc_processing]) || [u_reserved_fc_processing] = 0
                )
            )
        )

    -- Se nunca houve um zero na história (dentro dos dados carregados), assumimos a primeira data com dados como início
    VAR _start_date = 
        IF(
            ISBLANK(_last_zero_date),
            CALCULATE(MIN('fact_fba_inventory'[date_fba_inventory]), ALL('Calendar'), 'fact_fba_inventory'[key_inventory_region_sku] = _current_sku),
            _last_zero_date
        )
        
    RETURN
        DATEDIFF(_start_date, _current_date, DAY),
        
    BLANK() -- Se a quantidade atual for 0, não há Lead Time ativo
)
```

#### `lead_time_reserved_fc_transfer`

**Depende de medidas:** `[d_last_fba_inventory]`, `[u_reserved_fc_transfer]`  
**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[key_inventory_region_sku]`, `'fact_fba_inventory'[reserved_fc_transfer]`  
```dax
// VAR CurrentSKU = SELECTEDVALUE('fact_fba_inventory'[key_inventory_region_sku])

// VAR AllDates = CALCULATETABLE(
//     DISTINCT('fact_fba_inventory'[date_fba_inventory]),
//     'fact_fba_inventory'[key_inventory_region_sku] = CurrentSKU
// )

// VAR ChangeDates = FILTER(
//     AllDates,
//     VAR CurrentDate = 'fact_fba_inventory'[date_fba_inventory]
//     VAR CurrentValue = CALCULATE(
//         MAX('fact_fba_inventory'[reserved_fc_transfer]),
//         'fact_fba_inventory'[date_fba_inventory] = CurrentDate
//     )
//     VAR PreviousDate = CALCULATE(
//         MAX('fact_fba_inventory'[date_fba_inventory]),
//         'fact_fba_inventory'[date_fba_inventory] < CurrentDate
//     )
//     VAR PreviousValue = CALCULATE(
//         MAX('fact_fba_inventory'[reserved_fc_transfer]),
//         'fact_fba_inventory'[date_fba_inventory] = PreviousDate
//     )
//     RETURN CurrentValue <> PreviousValue
// )

// VAR LatestChangeDate = MAXX(ChangeDates, 'fact_fba_inventory'[date_fba_inventory])

// VAR NewValue = CALCULATE(
//     MAX('fact_fba_inventory'[reserved_fc_transfer]),
//     'fact_fba_inventory'[date_fba_inventory] = LatestChangeDate
// )

// RETURN IF(NewValue=0, BLANK(), DATEDIFF(LatestChangeDate, [d_last_fba_inventory], DAY))

VAR _current_date = MAX('Calendar'[Date])
VAR _current_sku = SELECTEDVALUE('fact_fba_inventory'[key_inventory_region_sku])

-- Avalia o valor da medida 'u_last_modified...' na data do contexto
VAR _current_qty = [u_reserved_fc_transfer]

RETURN
IF(
    -- Só calculamos se houver quantidade positiva atualmente
    NOT(ISBLANK(_current_qty)) && _current_qty > 0,
    
    VAR _last_zero_date = 
        CALCULATE(
            MAX('Calendar'[Date]),
            FILTER(
                ALL('Calendar'[Date]),
                'Calendar'[Date] < _current_date &&
                (
                    -- Recalcula a medida para cada data passada para verificar se era 0 ou vazia
                    -- Nota: Isso assume que 'u_last_modified...' responde corretamente ao contexto de linha de 'Calendar'[Date]
                    ISBLANK([u_reserved_fc_transfer]) || [u_reserved_fc_transfer] = 0
                )
            )
        )

    -- Se nunca houve um zero na história (dentro dos dados carregados), assumimos a primeira data com dados como início
    VAR _start_date = 
        IF(
            ISBLANK(_last_zero_date),
            CALCULATE(MIN('fact_fba_inventory'[date_fba_inventory]), ALL('Calendar'), 'fact_fba_inventory'[key_inventory_region_sku] = _current_sku),
            _last_zero_date
        )
        
    RETURN
        DATEDIFF(_start_date, _current_date, DAY),
        
    BLANK() -- Se a quantidade atual for 0, não há Lead Time ativo
)
```

#### `u_last_modified_reserved_fc_processing`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_fc_processing]`  
```dax
VAR _max_date = MAX('Calendar'[Date])
    VAR _last_value =
        CALCULATE(
            SUM('fact_fba_inventory'[reserved_fc_processing])
            , 'fact_fba_inventory'[date_fba_inventory] = MAX('fact_fba_inventory'[date_fba_inventory])
        )

    VAR _result = IF(_last_value = 0, BLANK(), _last_value)

RETURN
    _result
```

#### `u_last_modified_reserved_fc_transfer`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_fc_transfer]`  
```dax
VAR _max_date = MAX('Calendar'[Date])
    VAR _last_value =
        CALCULATE(
            SUM('fact_fba_inventory'[reserved_fc_transfer])
            , 'fact_fba_inventory'[date_fba_inventory] = MAX('fact_fba_inventory'[date_fba_inventory]) 
        )

    VAR _result = IF(_last_value = 0, BLANK(), _last_value)

RETURN
    _result
```

#### `lead_time_reserved_fc_customer_order`

**Depende de medidas:** `[d_last_fba_inventory]`, `[u_reserved_fc_customer_order]`  
**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[key_inventory_region_sku]`, `'fact_fba_inventory'[reserved_customer_order]`  
```dax
// VAR CurrentSKU = SELECTEDVALUE('fact_fba_inventory'[key_inventory_region_sku])

// VAR AllDates = CALCULATETABLE(
//     DISTINCT('fact_fba_inventory'[date_fba_inventory]),
//     'fact_fba_inventory'[key_inventory_region_sku] = CurrentSKU
// )

// VAR ChangeDates = FILTER(
//     AllDates,
//     VAR CurrentDate = 'fact_fba_inventory'[date_fba_inventory]
//     VAR CurrentValue = CALCULATE(
//         MAX('fact_fba_inventory'[reserved_customer_order]),
//         'fact_fba_inventory'[date_fba_inventory] = CurrentDate
//     )
//     VAR PreviousDate = CALCULATE(
//         MAX('fact_fba_inventory'[date_fba_inventory]),
//         'fact_fba_inventory'[date_fba_inventory] < CurrentDate
//     )
//     VAR PreviousValue = CALCULATE(
//         MAX('fact_fba_inventory'[reserved_customer_order]),
//         'fact_fba_inventory'[date_fba_inventory] = PreviousDate
//     )
//     RETURN CurrentValue <> PreviousValue
// )

// VAR LatestChangeDate = MAXX(ChangeDates, 'fact_fba_inventory'[date_fba_inventory])

// VAR NewValue = CALCULATE(
//     MAX('fact_fba_inventory'[reserved_customer_order]),
//     'fact_fba_inventory'[date_fba_inventory] = LatestChangeDate
// )

// RETURN IF(NewValue=0, BLANK(), DATEDIFF(LatestChangeDate, [d_last_fba_inventory], DAY))

VAR _current_date = MAX('Calendar'[Date])
VAR _current_sku = SELECTEDVALUE('fact_fba_inventory'[key_inventory_region_sku])

-- Avalia o valor da medida 'u_last_modified...' na data do contexto
VAR _current_qty = [u_reserved_fc_customer_order]

RETURN
IF(
    -- Só calculamos se houver quantidade positiva atualmente
    NOT(ISBLANK(_current_qty)) && _current_qty > 0,
    
    VAR _last_zero_date = 
        CALCULATE(
            MAX('Calendar'[Date]),
            FILTER(
                ALL('Calendar'[Date]),
                'Calendar'[Date] < _current_date &&
                (
                    -- Recalcula a medida para cada data passada para verificar se era 0 ou vazia
                    -- Nota: Isso assume que 'u_last_modified...' responde corretamente ao contexto de linha de 'Calendar'[Date]
                    ISBLANK([u_reserved_fc_customer_order]) || [u_reserved_fc_customer_order] = 0
                )
            )
        )

    -- Se nunca houve um zero na história (dentro dos dados carregados), assumimos a primeira data com dados como início
    VAR _start_date = 
        IF(
            ISBLANK(_last_zero_date),
            CALCULATE(MIN('fact_fba_inventory'[date_fba_inventory]), ALL('Calendar'), 'fact_fba_inventory'[key_inventory_region_sku] = _current_sku),
            _last_zero_date
        )
        
    RETURN
        DATEDIFF(_start_date, _current_date, DAY),
        
    BLANK() -- Se a quantidade atual for 0, não há Lead Time ativo
)
```

#### `u_last_modified_reserved_fc_customer_order`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_customer_order]`  
```dax
VAR _max_date = MAX('Calendar'[Date])
    VAR _last_value =
        CALCULATE(
            SUM('fact_fba_inventory'[reserved_customer_order])
            , 'fact_fba_inventory'[date_fba_inventory] = MAX('fact_fba_inventory'[date_fba_inventory])
        )

    VAR _result = IF(_last_value = 0, BLANK(), _last_value)

RETURN
    _result
```

#### `u_reserved_fc_customer_order`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_customer_order]`  
```dax
VAR _max_date = MAX('Calendar'[Date])
    VAR _last_value =
        CALCULATE(
            SUM('fact_fba_inventory'[reserved_customer_order])
            // , 'Calendar'[Date] = _max_date
            , 'fact_fba_inventory'[date_fba_inventory] = _max_date
        )

    VAR _result = IF(_last_value = 0, BLANK(), _last_value)

RETURN
    _result
```

#### `u_reserved_fc_processing`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_fc_processing]`  
```dax
VAR _max_date = MAX('Calendar'[Date])
    VAR _last_value =
        CALCULATE(
            SUM('fact_fba_inventory'[reserved_fc_processing])
            , 'fact_fba_inventory'[date_fba_inventory] = _max_date
        )

    VAR _result = IF(_last_value = 0, BLANK(), _last_value)

RETURN
    _result
```

#### `u_reserved_fc_transfer`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[reserved_fc_transfer]`  
```dax
VAR _max_date = MAX('Calendar'[Date])
    VAR _last_value =
        CALCULATE(
            SUM('fact_fba_inventory'[reserved_fc_transfer])
            , 'fact_fba_inventory'[date_fba_inventory] = _max_date
        )

    VAR _result = IF(_last_value = 0, BLANK(), _last_value)

RETURN
    _result
```


### Inventory\FBA Inventory\Aging

#### `u_fba_inventory_aging_0_to_030`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_000_to_030]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_000_to_030] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_031_to_060`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_031_to_060]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_031_to_060] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_181_to_270`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_181_to_270]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_181_to_270] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_271_to_365`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_271_to_365]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_271_to_365] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_365_plus`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_365_plus]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_365_plus] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_181_plus`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_181_to_270]`, `'fact_fba_inventory'[inv_age_271_to_365]`, `'fact_fba_inventory'[inv_age_365_plus]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_181_to_270] ) +
                SUM ( 'fact_fba_inventory'[inv_age_271_to_365] ) +
                SUM ( 'fact_fba_inventory'[inv_age_365_plus] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    //SUMX ( _tableLastAvailableDate, [Quantity] )


    CALCULATE(
            SUM('fact_fba_inventory'[inv_age_181_to_270]) +
            SUM('fact_fba_inventory'[inv_age_271_to_365]) +
            SUM('fact_fba_inventory'[inv_age_365_plus])
            , FILTER(
                'fact_fba_inventory'
                , 'fact_fba_inventory'[date_fba_inventory] = MAX ( 'fact_fba_inventory'[date_fba_inventory] )
            )
    )
```

#### `u_fba_inventory_aging_061_to_090`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_061_to_090]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_061_to_090] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_091_to_180`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_091_to_180]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[inv_age_091_to_180] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_aging_0_to_090`

**Depende de medidas:** `[u_fba_inventory_aging_031_to_060]`, `[u_fba_inventory_aging_061_to_090]`, `[u_fba_inventory_aging_0_to_030]`  
```dax
VAR _fbaInventory = 
        [u_fba_inventory_aging_0_to_030] + 
        [u_fba_inventory_aging_031_to_060] + 
        [u_fba_inventory_aging_061_to_090]

return
    _fbaInventory
```

#### `u_fba_inventory_aging_181_plus_inactive_calendar`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`, `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[inv_age_181_to_270]`, `'fact_fba_inventory'[inv_age_271_to_365]`, `'fact_fba_inventory'[inv_age_365_plus]`  
```dax
VAR _inventory =
        CALCULATE(
            SUM('fact_fba_inventory'[inv_age_181_to_270]) +
            SUM('fact_fba_inventory'[inv_age_271_to_365]) +
            SUM('fact_fba_inventory'[inv_age_365_plus])
            , FILTER(
                'fact_fba_inventory'
                , 'fact_fba_inventory'[date_fba_inventory] = MAX ( 'fact_fba_inventory'[date_fba_inventory] )
            )
            , ALL ( 'Calendar' )
            , USERELATIONSHIP ( 'Calendar'[Date], 'dim_calendar_aux'[Date aux] )
        )

RETURN
CALCULATE(
        CALCULATE(
            SUM('fact_fba_inventory'[inv_age_181_to_270]) +
            SUM('fact_fba_inventory'[inv_age_271_to_365]) +
            SUM('fact_fba_inventory'[inv_age_365_plus])
            , FILTER(
                'fact_fba_inventory'
                , 'fact_fba_inventory'[date_fba_inventory] = MAX ( 'fact_fba_inventory'[date_fba_inventory] )
            )
        )
    
            , ALL ( 'Calendar' )
            , USERELATIONSHIP ( 'Calendar'[Date], 'dim_calendar_aux'[Date aux] )
)
```

#### `u_diff_fba_inventory_aging_181_plus`

**Depende de medidas:** `[u_fba_inventory_aging_181_plus]`, `[u_fba_inventory_aging_181_plus_inactive_calendar]`  
```dax
[u_fba_inventory_aging_181_plus_inactive_calendar]
- [u_fba_inventory_aging_181_plus]
```

#### `filter_fba_inventory_aging_181_plus`

**Depende de medidas:** `[u_fba_inventory_aging_181_plus]`, `[u_fba_inventory_aging_181_plus_inactive_calendar]`  
```dax
[u_fba_inventory_aging_181_plus_inactive_calendar]
+ [u_fba_inventory_aging_181_plus]
```


### Inventory\FBA Inventory\Estimated Quantity

#### `u_fba_inventory_estimated_units_181_to_210`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_181_210]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_181_210] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_estimated_units_211_to_240`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_211_240]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_211_240] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_estimated_units_241_to_270`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_241_270]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_241_270] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_estimated_units_271_to_300`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_271_300]`, `'fact_fba_inventory'[key_inventory_region_sku]`, `fFBAInventory[date_fba_inventory]`, `fFBAInventory[estimated_quantity_ais_271_300]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_271_300] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )

//         VAR _inventory =
//         CALCULATE(
//             SUM ( fFBAInventory[estimated_quantity_ais_271_300] )
//             , FILTER(
//                 fFBAInventory
//                 , fFBAInventory[date_fba_inventory] = MAX ( fFBAInventory[date_fba_inventory] )
//             )
//         )

// return
//     _inventory
```

#### `u_fba_inventory_estimated_units_301_to_330`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_301_330]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_301_330] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_estimated_units_331_to_365`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_331_365]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_331_365] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_estimated_units_365_plus`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_quantity_ais_365_plus]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_quantity_ais_365_plus] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `u_fba_inventory_estimated_units_181_plus`

**Depende de medidas:** `[u_fba_inventory_estimated_units_181_to_210]`, `[u_fba_inventory_estimated_units_211_to_240]`, `[u_fba_inventory_estimated_units_241_to_270]`, `[u_fba_inventory_estimated_units_271_to_300]`, `[u_fba_inventory_estimated_units_301_to_330]`, `[u_fba_inventory_estimated_units_331_to_365]`, `[u_fba_inventory_estimated_units_365_plus]`  
```dax
[u_fba_inventory_estimated_units_181_to_210]+
[u_fba_inventory_estimated_units_211_to_240]+
[u_fba_inventory_estimated_units_241_to_270]+
[u_fba_inventory_estimated_units_271_to_300]+
[u_fba_inventory_estimated_units_301_to_330]+
[u_fba_inventory_estimated_units_331_to_365]+
[u_fba_inventory_estimated_units_365_plus]
```


### Inventory\FBA Inventory\Estimated Value

#### `$_fba_inventory_estimated_surcharge_181_to_210`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_181_210]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_181_210] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_211_to_240`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_211_240]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_211_240] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_241_to_270`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_241_270]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_241_270] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_271_to_300`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_271_300]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_271_300] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_301_to_330`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_301_330]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_301_330] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_331_to_365`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_331_365]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_331_365] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_365_plus`

**Depende de medidas:** `[Quantity]`  
**Depende de colunas:** `'fact_fba_inventory'[date_fba_inventory]`, `'fact_fba_inventory'[estimated_value_ais_365_plus]`, `'fact_fba_inventory'[key_inventory_region_sku]`  
```dax
VAR _tableLastAvailableDate =
        SUMMARIZE (
            'fact_fba_inventory',
            'fact_fba_inventory'[key_inventory_region_sku],
            "MaxDate", MAX ( 'fact_fba_inventory'[date_fba_inventory] ),
            "Quantity",
            CALCULATE (
                SUM ( 'fact_fba_inventory'[estimated_value_ais_365_plus] ),
                FILTER (
                    'fact_fba_inventory',
                    'fact_fba_inventory'[date_fba_inventory] = MAXX ( 'fact_fba_inventory', 'fact_fba_inventory'[date_fba_inventory] )
                )
            )
        )

RETURN
    SUMX ( _tableLastAvailableDate, [Quantity] )
```

#### `$_fba_inventory_estimated_surcharge_181_plus`

**Depende de medidas:** `[$_fba_inventory_estimated_surcharge_181_to_210]`, `[$_fba_inventory_estimated_surcharge_211_to_240]`, `[$_fba_inventory_estimated_surcharge_241_to_270]`, `[$_fba_inventory_estimated_surcharge_271_to_300]`, `[$_fba_inventory_estimated_surcharge_301_to_330]`, `[$_fba_inventory_estimated_surcharge_331_to_365]`, `[$_fba_inventory_estimated_surcharge_365_plus]`  
```dax
[$_fba_inventory_estimated_surcharge_181_to_210]+
[$_fba_inventory_estimated_surcharge_211_to_240]+
[$_fba_inventory_estimated_surcharge_241_to_270]+
[$_fba_inventory_estimated_surcharge_271_to_300]+
[$_fba_inventory_estimated_surcharge_301_to_330]+
[$_fba_inventory_estimated_surcharge_331_to_365]+
[$_fba_inventory_estimated_surcharge_365_plus]
```


### Inventory\FBA Inventory\Real Time

#### `u_fba_manage_inventory_real_time_available`

**Depende de colunas:** `'fact_fba_manage_inventory_real_time'[available_quantity]`  
```dax
VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[available_quantity])
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_unsellable`

**Depende de colunas:** `'fFBAInventory'[date_fba_inventory]`, `'fFBAInventory'[unfulfillable_quantity]`, `'fact_fba_manage_inventory_real_time'[unsellable_quantity]`  
```dax
// Calculates the Stock - Unfulfillable inventory for the sellable items, considering both the Context and Report filters. Works with time aggregators.

    // VAR _inventory =
    //     CALCULATE(
    //         SUM ( 'fFBAInventory'[unfulfillable_quantity] )
    //         , FILTER(
    //             'fFBAInventory'
    //             , 'fFBAInventory'[date_fba_inventory] = MAX ( 'fFBAInventory'[date_fba_inventory] )
    //         )
    //     )
    
    VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[unsellable_quantity] )
    
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_working_shipped_receiving`

**Depende de medidas:** `[u_fba_manage_inventory_real_time_receiving]`, `[u_fba_manage_inventory_real_time_shipped]`, `[u_fba_manage_inventory_real_time_working]`  
```dax
VAR _inventory = 
        [u_fba_manage_inventory_real_time_working] +
        [u_fba_manage_inventory_real_time_shipped] +
        [u_fba_manage_inventory_real_time_receiving]
    
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_receiving`

**Depende de colunas:** `'fact_fba_manage_inventory_real_time'[receiving_quantity]`  
```dax
VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[receiving_quantity])
    
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_shipped`

**Depende de colunas:** `'fact_fba_manage_inventory_real_time'[shipped_quantity]`  
```dax
VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[shipped_quantity] )
    
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_working`

**Depende de colunas:** `'fFBAInventory'[date_fba_inventory]`, `'fFBAInventory'[inbound_working]`, `'fact_fba_manage_inventory_real_time'[working_quantity]`  
```dax
// Calculates the Inbound - Working inventory for the sellable items, considering both the Context and Report filters. Works with time aggregators.

    // VAR _inventory =
    //     CALCULATE(
    //         SUM ( 'fFBAInventory'[inbound_working] )
    //         , FILTER(
    //             'fFBAInventory'
    //             , 'fFBAInventory'[date_fba_inventory] = MAX ( 'fFBAInventory'[date_fba_inventory] )
    //         )
    //     )

    VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[working_quantity] )
    
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_available_receiving_reserved_researching`

**Depende de medidas:** `[u_fba_manage_inventory_real_time_available]`, `[u_fba_manage_inventory_real_time_receiving]`, `[u_fba_manage_inventory_real_time_researching]`, `[u_fba_manage_inventory_real_time_reserved]`  
```dax
VAR _inventory = 
        [u_fba_manage_inventory_real_time_available] +
        [u_fba_manage_inventory_real_time_receiving] +
        [u_fba_manage_inventory_real_time_reserved] +
        [u_fba_manage_inventory_real_time_researching]

return
    _inventory
```

#### `u_fba_manage_inventory_real_time_reserved`

**Depende de colunas:** `'fact_fba_manage_inventory_real_time'[reserved_quantity]`  
```dax
VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[reserved_quantity])
return
    _inventory
```

#### `u_fba_manage_inventory_real_time_researching`

**Depende de colunas:** `'fact_fba_manage_inventory_real_time'[researching_quantity]`  
```dax
VAR _inventory = SUM ( 'fact_fba_manage_inventory_real_time'[researching_quantity])
return
    _inventory
```


### Inventory\Inventory Ledger - Country

#### `u_inventory_starting`

**Depende de colunas:** `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[starting_warehouse_balance]`  
```dax
// Calculates the Inventory Starting Balance for the sellable items, considering both the Context and Report filters. Works with time aggregators.

    VAR _inventory =
        CALCULATE(
            SUM ( 'Inventory Ledger'[starting_warehouse_balance] )
            , FILTER(
                'Inventory Ledger'
                , 'Inventory Ledger'[Disposition] = "Sellable" 
                    && 'Inventory Ledger'[Date] = MIN ( 'Inventory Ledger'[Date] )
            )
        )

return
    _inventory
```

#### `u_inventory_ending_plus_transit`

**Depende de colunas:** `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[ending_plus_transit]`  
```dax
VAR _inventory =
        CALCULATE(
            SUM('Inventory Ledger'[ending_plus_transit])
            , FILTER(
                'Inventory Ledger'
                , 'Inventory Ledger'[Disposition] = "Sellable"
                    && 'Inventory Ledger'[Date] = MAX ( 'Inventory Ledger'[Date] )
            )
        )

return
    _inventory
```

#### `u_inventory_ending_plus_transit_before_delivery_day`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Delivery Date]`, `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[Ending Warehouse Balance]`, `'Inventory Ledger'[In Transit Between Warehouses]`, `'Inventory Ledger'[ending_plus_transit]`  
```dax
VAR _beforeArrivalDate =
            CALCULATE (
                DATEADD('Calendar'[Date], -1, DAY)
                , FILTER ( ALL ( 'Calendar'[Date] ), 'Calendar'[Date] = MAX('Inbound Shipments'[Delivery Date] ) ) )
    
    VAR _inventory =
        CALCULATE(
            //SUM('Inventory Ledger'[Ending Warehouse Balance]) + SUM('Inventory Ledger'[In Transit Between Warehouses])
            SUM('Inventory Ledger'[ending_plus_transit])
            , FILTER(
                ALL ( 'Inventory Ledger' )
                , 'Inventory Ledger'[Disposition] = "Sellable" 
                    && 'Inventory Ledger'[Date] = _beforeArrivalDate
                    // && 'Inventory Ledger'[Date] < _beforeArrivalDate 
                    // && 'Inventory Ledger'[Date] = MAX ( 'Inventory Ledger'[Date] )    
            )     
        )

return
    _inventory
```

#### `u_inventory_ending_plus_transit_all_dispositions`

**Depende de colunas:** `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Ending Warehouse Balance]`, `'Inventory Ledger'[In Transit Between Warehouses]`, `'Inventory Ledger'[ending_plus_transit]`  
```dax
// Calculates the Total Inventory designed to a specifc country/warehouse for the sellable items, considering both the Context and Report filters. Works with time aggregators.

    VAR _inventory =
        CALCULATE(
            //SUM('Inventory Ledger'[Ending Warehouse Balance]) + SUM('Inventory Ledger'[In Transit Between Warehouses])
            SUM('Inventory Ledger'[ending_plus_transit])
            , FILTER(
                'Inventory Ledger'
                , 'Inventory Ledger'[Date] = MAX ( 'Inventory Ledger'[Date] )
            )
        )

return
    _inventory
```

#### `u_inventory_ending_plus_transit_on_delivery_day`

**Depende de medidas:** `[d_delivery_date_inbound_shipments]`, `[u_inventory_ending_plus_transit_before_delivery_day]`, `[u_quantity_inbound_shipments]`  
**Depende de colunas:** `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[Ending Warehouse Balance]`, `'Inventory Ledger'[In Transit Between Warehouses]`, `'Inventory Ledger'[ending_plus_transit]`  
```dax
VAR _onDeliveryDay = [d_delivery_date_inbound_shipments]

    VAR _inventory =
        CALCULATE(
            //SUM('Inventory Ledger'[Ending Warehouse Balance]) + SUM('Inventory Ledger'[In Transit Between Warehouses])
            SUM('Inventory Ledger'[ending_plus_transit])
            , FILTER(
                ALL ( 'Inventory Ledger' )
                , 'Inventory Ledger'[Disposition] = "Sellable" && 'Inventory Ledger'[Date] = _onDeliveryDay ) )

return
    [u_inventory_ending_plus_transit_before_delivery_day] + [u_quantity_inbound_shipments]
```

#### `u_inventory_awd_available`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger]`, `'fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_units]`  
```dax
//     VAR _last_inventory_date = CALCULATE(MAX ( 'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger]), ALL(fact_awd_inventory_ledger_by_country))
//     VAR _last_calendar_date = CALCULATE( MAX('Calendar'[Date]), KEEPFILTERS( 'Calendar'[Date] <= TODAY() ) )
//     VAR _date = MIN( _last_calendar_date, _last_inventory_date )
//     VAR _inventory =
//         CALCULATE(
//             SUM('fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_units])
//             , FILTER(
//                 'fact_awd_inventory_ledger_by_country'
//                 , 'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] = _date
//             )
//         )

// return
//     COALESCE(_inventory, 0)

//     // _date

VAR _MaxVisibleDate = MAX( 'Calendar'[Date] )

-- 1. Descobre a última data que realmente existe na tabela fato (Global)
VAR _LastDataDate = 
    CALCULATE(
        MAX ( 'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] ), 
        REMOVEFILTERS( 'Calendar' ),
        REMOVEFILTERS( 'z.dynamic_time_frame_switch' ) -- Garante que o filtro visual não mascare a data real
    )

-- 2. Define a data de referência. 
-- Se o fim do mês for 31/Jan e temos dados até 31/Jan, usa 31/Jan.
-- Se o fim do mês for 31/Dez (futuro) e temos dados até hoje (11/Dez), usa 11/Dez.
VAR _TargetDate = MIN( _MaxVisibleDate, _LastDataDate )

RETURN
    -- Só calcula se o período visualizado tiver intercessão com os dados existentes
    IF(
        MIN('Calendar'[Date]) > _LastDataDate,
        BLANK(),
        
        CALCULATE(
            SUM('fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_units]),
            -- Aqui está o segredo:
            -- Precisamos focar exclusivamente na data alvo (_TargetDate), ignorando o intervalo do mês/semana
            'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] = _TargetDate,
            
            -- Removemos filtros de calendário para sair do contexto de "Mês" e ir para o "Dia Específico"
            REMOVEFILTERS( 'Calendar' ),
            REMOVEFILTERS( 'z.dynamic_time_frame_switch' )
        )
    )
```

#### `u_inventory_awd_available_cartons`

**Depende de colunas:** `'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger]`, `'fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_cartons]`  
```dax
VAR _inventory =
        CALCULATE(
            SUM('fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_cartons])
            , FILTER(
                'fact_awd_inventory_ledger_by_country'
                , 'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] = MAX ( 'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] )
            )
        )

return
    _inventory
```

#### `awd_average_quantiy_on_hand`

**Depende de colunas:** `'Calendar'[Date]`, `'Calendar'[Start of Month]`, `fact_awd_inventory_ledger_by_country[date_awd_inventory_ledger]`, `fact_awd_inventory_ledger_by_country[ending_warehouse_balance_units]`  
```dax
VAR _last_date_awd_report = CALCULATE( MAX(fact_awd_inventory_ledger_by_country[date_awd_inventory_ledger]), ALL(fact_awd_inventory_ledger_by_country))
    VAR _start_date = MIN( 'Calendar'[Start of Month] )
    VAR _end_of_month = EOMONTH( _start_date, 0)
    VAR _end_date = MIN(_last_date_awd_report, _end_of_month)
    VAR _days_in_month = DAY(_end_date)
    VAR _average_awd_inventory = 
        CALCULATE(
            SUM( fact_awd_inventory_ledger_by_country[ending_warehouse_balance_units] )
            , DATESBETWEEN( 'Calendar'[Date], _start_date, _end_date )
        )


RETURN
    DIVIDE( _average_awd_inventory, _days_in_month )
```

#### `u_stock_projection`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`, `[u_quantity_inbound_shipments_amazon]`, `[u_units_shipped]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Date]`, `'f.FBACustomerReturns'[date_fba_customer_return]`, `'f.FBACustomerReturns'[is_sellable]`, `'f.FBACustomerReturns'[quantity]`, `'z.dynamic_time_frame_switch'[Time Frame]`  
```dax
VAR _ViewDate = MAX( 'Calendar'[Date] )
VAR _Today = TODAY()
VAR _StartDate = MIN( 'Calendar'[Date] )

-- 1. Identifica a última data real do Ledger (ignorando filtros de tempo visuais)
VAR _LastLedgerDate = 
    CALCULATE(
        MAX( 'Inventory Ledger'[Date] ),
        REMOVEFILTERS( 'Calendar' ),
        REMOVEFILTERS( 'z.dynamic_time_frame_switch' )
    )

VAR _TimeFrame = SELECTEDVALUE('z.dynamic_time_frame_switch'[Time Frame])

RETURN
    IF(
        _TimeFrame <> "Daily"
        , BLANK()
    -- LÓGICA DE CORTE: 
    -- Só calcula se a data visual for MAIOR que o último ledger E MENOR ou IGUAL a hoje (limite que definimos antes).
        , IF(
            _ViewDate > _LastLedgerDate && _StartDate <= _Today,
            
            -- Ajuste de data para o cálculo não estourar "Hoje" se o eixo for mensal
            VAR _CalcDate = MIN( _ViewDate, _Today )

            -- A partir daqui, é puramente o Cenário B (Projeção)
            VAR _BaseStock = 
                CALCULATE(
                    [u_inventory_ending_plus_transit],
                    'Calendar'[Date] = _LastLedgerDate,
                    REMOVEFILTERS( 'Calendar' ),
                    REMOVEFILTERS( 'z.dynamic_time_frame_switch' )
                )
            
            VAR _GapPeriod = DATESBETWEEN( 'Calendar'[Date], _LastLedgerDate + 1, _CalcDate )

            VAR _GapSales = CALCULATE( [u_units_shipped], _GapPeriod )
            
            VAR _GapReturns = 
                CALCULATE(
                    SUM( 'f.FBACustomerReturns'[quantity] ),
                    'f.FBACustomerReturns'[is_sellable] = "Sellable",
                    USERELATIONSHIP( 'f.FBACustomerReturns'[date_fba_customer_return], 'Calendar'[Date] ),
                    _GapPeriod
                )

            VAR _GapInbounds = CALCULATE( [u_quantity_inbound_shipments_amazon], _GapPeriod )

            RETURN
            COALESCE(_BaseStock, 0) - COALESCE(_GapSales, 0) + COALESCE(_GapReturns, 0) + COALESCE(_GapInbounds, 0),
            
            -- Se houver dado histórico (Inventory Ledger existe), retorna BLANK
            BLANK()
        )
     )
```


### Inventory\Inventory Ledger - FC

#### `u_inventory_fulfillmet_center_end_plus_transit`

**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger - by Fulfillment Center'[Ending Warehouse Balance]`, `'Inventory Ledger - by Fulfillment Center'[In Transit Between Warehouses]`, `'fact_inventory_ledger_by_fulfillment_center'[Date]`, `'fact_inventory_ledger_by_fulfillment_center'[Disposition]`, `'fact_inventory_ledger_by_fulfillment_center'[ending_plus_transit]`  
```dax
// Calculates the Total Inventory designed to a specifc Fulfilment Center for the sellable items, considering both the Context and Report filters. Works with time aggregators.

    VAR _maxDate = MAX ( 'Calendar'[Date] )

    VAR _inventory =
        CALCULATE (
            SUM('fact_inventory_ledger_by_fulfillment_center'[ending_plus_transit])            
            // SUM ( 'Inventory Ledger - by Fulfillment Center'[Ending Warehouse Balance] ) 
            //     + SUM ( 'Inventory Ledger - by Fulfillment Center'[In Transit Between Warehouses] )
            , FILTER(
                'fact_inventory_ledger_by_fulfillment_center'
                , 'fact_inventory_ledger_by_fulfillment_center'[Disposition] = "Sellable"
                    && 'fact_inventory_ledger_by_fulfillment_center'[Date] = MAX('fact_inventory_ledger_by_fulfillment_center'[Date])
            )
        )

return
    _inventory
```

#### `hierarchical_share_last_inventory`

**Depende de medidas:** `[u_inventory_fulfillmet_center_ending_warehouse_balance]`  
**Depende de colunas:** `'d.fulfillmentCentersAddress'[fulfillment_center_id]`, `SKUs[Amazon Family]`, `SKUs[Inventory Region | Base SKU]`, `SKUs[SKU]`  
```dax
VAR ShareLevelFcCityState =
DIVIDE(
    [u_inventory_fulfillmet_center_ending_warehouse_balance],
    CALCULATE(
        [u_inventory_fulfillmet_center_ending_warehouse_balance],
        ALLSELECTED('d.fulfillmentCentersAddress'[fulfillment_center_id])
    )
)

VAR ShareLevelAmazonFamily =
DIVIDE(
    [u_inventory_fulfillmet_center_ending_warehouse_balance],
    CALCULATE(
        [u_inventory_fulfillmet_center_ending_warehouse_balance],
        ALLSELECTED(SKUs[Amazon Family])
    )
)

VAR ShareLevelInventoryRegionBaseSKU =
DIVIDE(
    [u_inventory_fulfillmet_center_ending_warehouse_balance],
    CALCULATE(
        [u_inventory_fulfillmet_center_ending_warehouse_balance],
        ALLSELECTED(SKUs[Inventory Region | Base SKU])
    )
)

VAR ShareLevelSKU =
DIVIDE(
    [u_inventory_fulfillmet_center_ending_warehouse_balance],
    CALCULATE(
        [u_inventory_fulfillmet_center_ending_warehouse_balance],
        ALLSELECTED(SKUs[SKU])
    )
)

RETURN
SWITCH(
    TRUE(),
    ISINSCOPE(SKUs[SKU]), ShareLevelSKU,
    ISINSCOPE(SKUs[Inventory Region | Base SKU]), ShareLevelInventoryRegionBaseSKU,
    ISINSCOPE(SKUs[Amazon Family]), ShareLevelAmazonFamily,
    ShareLevelFcCityState
)
```

#### `u_inventory_fulfillmet_center_ending_warehouse_balance`

**Depende de colunas:** `'d.fulfillmentCentersAddress'[fulfillment_center_id]`, `'fact_inventory_ledger_by_fulfillment_center'[Date]`, `'fact_inventory_ledger_by_fulfillment_center'[Disposition]`, `'fact_inventory_ledger_by_fulfillment_center'[ending_warehouse_balance]`, `'fact_inventory_ledger_by_fulfillment_center'[fulfillment_center]`  
```dax
SUMX(
    VALUES('d.fulfillmentCentersAddress'[fulfillment_center_id]),  // Iterar pela dimensão, não pelo fato
    VAR CurrentCenterId = 'd.fulfillmentCentersAddress'[fulfillment_center_id]
    VAR MaxDate = 
        CALCULATE(
            MAX('fact_inventory_ledger_by_fulfillment_center'[Date]),
            FILTER(
                'fact_inventory_ledger_by_fulfillment_center',
                'fact_inventory_ledger_by_fulfillment_center'[fulfillment_center] = CurrentCenterId
                && 'fact_inventory_ledger_by_fulfillment_center'[Disposition] = "Sellable"
            )
        )
    RETURN
    CALCULATE(
        SUM('fact_inventory_ledger_by_fulfillment_center'[ending_warehouse_balance]),
        'fact_inventory_ledger_by_fulfillment_center'[fulfillment_center] = CurrentCenterId,
        'fact_inventory_ledger_by_fulfillment_center'[Disposition] = "Sellable",
        'fact_inventory_ledger_by_fulfillment_center'[Date] = MaxDate
    )
)
```

#### `u_inventory_problematic_fulfillment_center_ending_warehouse_balance`

**Depende de medidas:** `[u_inventory_fulfillmet_center_ending_warehouse_balance]`  
**Depende de colunas:** `'d.fulfillmentCentersAddress'[is_problematic]`  
```dax
CALCULATE(
    [u_inventory_fulfillmet_center_ending_warehouse_balance],
    'd.fulfillmentCentersAddress'[is_problematic] = TRUE()
)
```

#### `conditional_formatting_problematic_fulfillment_centers`

**Depende de colunas:** `'d.fulfillmentCentersAddress'[is_problematic]`  
```dax
IF(
    COUNTROWS(
        FILTER(
            'd.fulfillmentCentersAddress',
            'd.fulfillmentCentersAddress'[is_problematic] = TRUE()
        )
    ) > 0,
    "Red",
    "Black"
)
```


### Inventory\Inventory Time Comparisson

#### `%_inventory_ending_plus_transit_year_over_year_yoy`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`, `[u_inventory_ending_plus_transit]`, `[u_inventory_ending_plus_transit_previous_year]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [u_inventory_ending_plus_transit]
            , [u_inventory_ending_plus_transit_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `u_inventory_ending_plus_transit_previous_year`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [u_inventory_ending_plus_transit]
    , DATEADD ( 'Calendar'[Date], -1, YEAR)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `u_inventory_ending_plus_transit_previous_month`

**Depende de medidas:** `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [u_inventory_ending_plus_transit]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `%_inventory_ending_plus_transit_month_over_month_mom`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`, `[u_inventory_ending_plus_transit]`, `[u_inventory_ending_plus_transit_previous_month]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [u_inventory_ending_plus_transit]
            , [u_inventory_ending_plus_transit_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```


### Inventory\Low Stock\Current

#### `u_minimum_coverage_threshold`

**Depende de medidas:** `[d_first_date_of_asin_by_inventory]`, `[d_last_date_of_asin_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Key Column: Country | ASIN]`, `'fact_velocity'[Minimum Inventory]`, `SKUs[Key Column: Country | ASIN]`  
```dax
VAR _minimumCoverage = 
        CALCULATE(
            MAX('fact_velocity'[Minimum Inventory])
            , FILTER(
                'Calendar'
                , 'Calendar'[Date] >= [d_first_date_of_asin_by_inventory]
                    && 'Calendar'[Date] <= [d_last_date_of_asin_by_inventory]
            )
            , USERELATIONSHIP ( SKUs[Key Column: Country | ASIN], 'Inventory Ledger'[Key Column: Country | ASIN] )
        )

RETURN
    _minimumCoverage
```

#### `b_is_out_of_stock`

**Depende de medidas:** `[d_first_date_of_asin_by_inventory]`, `[d_last_date_of_asin_by_inventory]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Key Column: Country | ASIN]`, `SKUs[Key Column: Country | ASIN]`  
```dax
VAR _inventoryByAsin = 
        CALCULATE ( 
            [u_inventory_ending_plus_transit]
            , USERELATIONSHIP ( SKUs[Key Column: Country | ASIN], 'Inventory Ledger'[Key Column: Country | ASIN] )
        )
        
    VAR _isOutofStock = 
        CALCULATE (
            IF ( _inventoryByAsin = 0, 1, BLANK() )
            , FILTER (
                'Calendar'
                , 'Calendar'[Date] >= [d_first_date_of_asin_by_inventory]
                    && 'Calendar'[Date] <= [d_last_date_of_asin_by_inventory]
            )
        )

RETURN
    _isOutofStock
```

#### `b_is_low_stock`

**Depende de medidas:** `[d_first_date_of_asin_by_inventory]`, `[d_last_date_of_asin_by_inventory]`, `[u_inventory_ending_plus_transit]`, `[u_minimum_coverage_threshold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Key Column: Country | ASIN]`, `SKUs[Key Column: Country | ASIN]`  
```dax
VAR _inventoryByAsin = 
        CALCULATE ( 
            [u_inventory_ending_plus_transit]
            , USERELATIONSHIP ( SKUs[Key Column: Country | ASIN], 'Inventory Ledger'[Key Column: Country | ASIN] )
        )

    VAR _isLowStock     = 
        CALCULATE(
            IF ( _inventoryByAsin < [u_minimum_coverage_threshold], 1, BLANK() )
            // , FILTER(
            //     'Calendar'
            //     , 'Calendar'[Date] >= [d_first_date_of_asin_by_inventory]
            //         && 'Calendar'[Date] <= [d_last_date_of_asin_by_inventory]
            // )
        )

RETURN
    _isLowStock
```

#### `count_out_of_stock`

**Depende de medidas:** `[b_is_out_of_stock]`, `[d_first_date_of_asin_by_inventory]`, `[d_last_date_of_asin_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Key Column: Country | ASIN]`, `'SKUs'[Key Column: Inventory Region | ASIN]`, `SKUs[Key Column: Country | ASIN]`  
```dax
VAR _outOfStock =
        CALCULATE (
            SUMX(
                VALUES ( 'Calendar'[Date] )
                , SUMX(
                    VALUES ( 'SKUs'[Key Column: Inventory Region | ASIN] )
                    , [b_is_out_of_stock]
                )
            ) 
            , FILTER(
                'Calendar'
                , 'Calendar'[Date] >= [d_first_date_of_asin_by_inventory]
                    && 'Calendar'[Date] <= [d_last_date_of_asin_by_inventory]
            )
            , USERELATIONSHIP ( SKUs[Key Column: Country | ASIN], 'Inventory Ledger'[Key Column: Country | ASIN] )
        )

RETURN
    _outOfStock
```

#### `count_low_stock`

**Depende de medidas:** `[b_is_low_stock]`, `[d_first_date_of_asin_by_inventory]`, `[d_last_date_of_asin_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Key Column: Country | ASIN]`, `'SKUs'[Key Column: Inventory Region | ASIN]`, `SKUs[Key Column: Country | ASIN]`  
```dax
VAR _countLowStock = 
        CALCULATE(
            SUMX(
                VALUES ( 'Calendar'[Date] )
                , SUMX(
                    VALUES ( 'SKUs'[Key Column: Inventory Region | ASIN] )
                    , [b_is_low_stock]
                )
            )   
            , FILTER(
                'Calendar'
                , 'Calendar'[Date] >= [d_first_date_of_asin_by_inventory]
                    && 'Calendar'[Date] <= [d_last_date_of_asin_by_inventory]
            )
            //, USERELATIONSHIP ( SKUs[Key Column: Country | ASIN], 'Inventory Ledger'[Key Column: Country | ASIN] )
        )

RETURN
    _countLowStock
```

#### `%_low_stock`

**Depende de medidas:** `[count_low_stock]`  
**Depende de colunas:** `'Calendar'[Date]`, `SKUs[ASIN]`, `SKUs[Inventory Region]`, `SKUs[Key Column: Inventory Region | ASIN]`  
```dax
//     VAR _countInventoryRegionAsin = DISTINCTCOUNT(SKUs[Key Column: Inventory Region | ASIN])
//     // VAR _countDays = COUNTROWS('Calendar')
//     VAR _countDays = DISTINCTCOUNT('Calendar'[Date])
//     VAR _possibilities = _countInventoryRegionAsin * _countDays
//     VAR _lowStockPercentage = DIVIDE ( [count_low_stock], _possibilities )

// RETURN
//     _lowStockPercentage

VAR _countInventoryRegionAsin =
    COUNTROWS(
        SUMMARIZE(
            SKUs,
            SKUs[Inventory Region],
            SKUs[ASIN]
        )
    )
VAR _countDays =
    DISTINCTCOUNT('Calendar'[Date])
VAR _possibilities =
    _countInventoryRegionAsin * _countDays
VAR _lowStock =
    [count_low_stock]
RETURN
    DIVIDE(_lowStock, _possibilities)
```

#### `%_out_of_stock`

**Depende de medidas:** `[count_out_of_stock]`  
**Depende de colunas:** `SKUs[Key Column: Inventory Region | ASIN]`  
```dax
VAR _countInventoryRegionAsin = DISTINCTCOUNT(SKUs[Key Column: Inventory Region | ASIN])
    VAR _countDays = COUNTROWS('Calendar')
    VAR _possibilities = _countInventoryRegionAsin * _countDays
    VAR _outOfStockPercentage = DIVIDE ( [count_out_of_stock], _possibilities )

RETURN
    _outOfStockPercentage
```


### Inventory\Low Stock\Previous Month

#### `%_low_stock_month_over_month_mom`

**Depende de medidas:** `[%_low_stock]`, `[%_low_stock_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )
    VAR _division = [%_low_stock] - [%_low_stock_previous_month]

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_low_stock_previous_month`

**Depende de medidas:** `[%_low_stock]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [%_low_stock]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```


### Inventory\Low Stock\Previous Year

#### `%_low_stock_previous_year`

**Depende de medidas:** `[%_low_stock]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [%_low_stock]
    , DATEADD ( 'Calendar'[Date], -1, YEAR)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `%_low_stock_year_over_year_yoy`

**Depende de medidas:** `[%_low_stock]`, `[%_low_stock_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )
    VAR _division = [%_low_stock] - [%_low_stock_previous_year]

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```


### KPIs

#### `u_inventory_3pl_current_plus_amazon_ending_plus_transit`

**Depende de medidas:** `[u_inventory_3pl_on_hand]`, `[u_inventory_ending_plus_transit]`  
```dax
VAR _Amazon  = [u_inventory_ending_plus_transit]
    VAR _3PL     = [u_inventory_3pl_on_hand]
    VAR _total = _Amazon + _3PL

RETURN
    _total
```

#### `d_coverage_before_delivery_day`

**Depende de medidas:** `[u_daily_velocity_before_delivery_day]`, `[u_inventory_ending_plus_transit_before_delivery_day]`  
```dax
VAR _coverage =
        DIVIDE(
            [u_inventory_ending_plus_transit_before_delivery_day]
            , [u_daily_velocity_before_delivery_day]
        )

RETURN
    _coverage
```

#### `d_coverage_after_delivery`

**Depende de medidas:** `[u_daily_velocity_before_delivery_day]`, `[u_inventory_ending_plus_transit_on_delivery_day]`  
```dax
VAR _coverage =
        DIVIDE(
            [u_inventory_ending_plus_transit_on_delivery_day]
            , [u_daily_velocity_before_delivery_day]
        )

RETURN
    _coverage
```

#### `d_next_order_inbound_shipments_estimated_coverage`

**Depende de medidas:** `[d_coverage_after_delivery]`, `[d_delivery_date_inbound_shipments]`, `[d_next_delivery_date_inbound_shipments]`  
```dax
VAR _deliveryDate = [d_delivery_date_inbound_shipments]
    VAR _NextDeliveryDate = [d_next_delivery_date_inbound_shipments]

RETURN
    [d_coverage_after_delivery] - DATEDIFF ( _deliveryDate, _NextDeliveryDate, DAY )
```

#### `u_total_inventory_by_location_group`

**Depende de medidas:** `[u_inventory_3pl_on_hand]`, `[u_inventory_awd_available]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'z.list_of_warehouse_names'[Location Group]`  
```dax
VAR _Amazon  = [u_inventory_ending_plus_transit]
    VAR _AWD     = [u_inventory_awd_available]
    VAR _3PL     = [u_inventory_3pl_on_hand]
    VAR _total = _Amazon + _3PL //+ _AWD 

RETURN
    SWITCH(
        TRUE
        , SELECTEDVALUE('z.list_of_warehouse_names'[Location Group]) = "Amazon",  _Amazon
        , SELECTEDVALUE('z.list_of_warehouse_names'[Location Group]) = "AWD",     _3PL
        , NOT(HASONEVALUE('z.list_of_warehouse_names'[Location Group])),          _total
        , _3PL
    )
```

#### `u_diff_inventory_3pl_available`

**Depende de medidas:** `[u_inventory_3pl_available_for_transfer]`, `[u_inventory_3pl_reports_available_for_transfer]`  
```dax
[u_inventory_3pl_available_for_transfer]
- [u_inventory_3pl_reports_available_for_transfer]
```

#### `diff_landed_cost_inbound_shipments`

**Depende de medidas:** `[$_average_landed_cost_before_delivery_date]`, `[$_unit_landed_cost_inbound_shipments]`  
```dax
VAR _currentLandedCost = [$_unit_landed_cost_inbound_shipments]
    VAR _lastLandedCost = [$_average_landed_cost_before_delivery_date]

RETURN

    SWITCH(
        TRUE()
        , ISBLANK(_currentLandedCost) && ISBLANK(_lastLandedCost), BLANK() 
        , ISBLANK(_currentLandedCost) || ISBLANK(_lastLandedCost), "N/A"
        , _currentLandedCost > _lastLandedCost, UNICHAR(128997) --Square Red
        , _currentLandedCost < _lastLandedCost, UNICHAR(129001) --Square Green
        , _currentLandedCost = _lastLandedCost, UNICHAR(9866) --Line Black OR 129000 (Square - Yellow)
    )
```


### Landed Cost

#### `$_unit_landed_cost`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_average_landed_cost'[Date]`, `'fact_average_landed_cost'[unit_cost]`  
```dax
// VAR _landedCost =
//     CALCULATE(
//         ROUND( MIN ('fact_average_landed_cost'[unit_cost] ), 2)
//         , 'fact_average_landed_cost'[Date] = MAX('fact_average_landed_cost'[Date])
//     )

// RETURN
//     _landedCost


VAR _LastDateInContext = MAX('Calendar'[Date])

VAR _LastDateWithData = 
    CALCULATE(
        MAX('fact_average_landed_cost'[Date]),
        'fact_average_landed_cost'[Date] <= _LastDateInContext,
        REMOVEFILTERS('Calendar') -- Remove filtro de mês/ano para olhar todo o histórico
    )

RETURN
    CALCULATE(
        ROUND( MIN ('fact_average_landed_cost'[unit_cost] ), 2),
        'fact_average_landed_cost'[Date] = _LastDateWithData
    )
```

#### `$_total_landed_cost_fba_manage_inventory_real_time_available_receiving_reserved_researching`

**Depende de medidas:** `[$_unit_landed_cost]`, `[u_fba_manage_inventory_real_time_available_receiving_reserved_researching]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
SUMX(
    VALUES(SKUs[SKU])
    , [u_fba_manage_inventory_real_time_available_receiving_reserved_researching] * [$_unit_landed_cost]
)
```

#### `$_total_landed_cost_inventory_3pl_on_hand`

**Depende de medidas:** `[$_unit_landed_cost]`, `[u_inventory_3pl_reports_on_hand]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
SUMX(
    VALUES(SKUs[SKU])
    , [u_inventory_3pl_reports_on_hand] * [$_unit_landed_cost]
)
```

#### `$_total_landed_cost_inventory_awd_available`

**Depende de medidas:** `[$_unit_landed_cost]`, `[u_inventory_awd_available]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
SUMX(
    VALUES(SKUs[SKU])
    , [u_inventory_awd_available] * [$_unit_landed_cost]
)
```

#### `$_total_landed_cost_by_location_group`

**Depende de medidas:** `[$_total_landed_cost_inventory_3pl_on_hand]`, `[$_total_landed_cost_inventory_amazon_ending_plus_transit]`, `[$_total_landed_cost_inventory_awd_available]`  
**Depende de colunas:** `'z.list_of_warehouse_names'[Location Group]`  
```dax
VAR _Amazon  = [$_total_landed_cost_inventory_amazon_ending_plus_transit]
    VAR _AWD     = [$_total_landed_cost_inventory_awd_available]
    VAR _3PL     = [$_total_landed_cost_inventory_3pl_on_hand]
    VAR _total = _Amazon + _AWD + _3PL



RETURN
    SWITCH(
        TRUE
        , SELECTEDVALUE('z.list_of_warehouse_names'[Location Group]) = "Amazon",  _Amazon
        , SELECTEDVALUE('z.list_of_warehouse_names'[Location Group]) = "AWD",     _AWD
        , NOT(HASONEVALUE('z.list_of_warehouse_names'[Location Group])),          _total
        , _3PL
    )
```

#### `$_total_landed_cost_inventory_amazon_ending_plus_transit`

**Depende de medidas:** `[$_unit_landed_cost]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `SKUs[SKU]`  
```dax
SUMX(
    VALUES(SKUs[SKU])
    , [u_inventory_ending_plus_transit] * [$_unit_landed_cost]
)
```

#### `$_cogs`

**Depende de colunas:** `'f.AllOrders'[landed_cost]`, `'f.AllOrders'[quantity]`  
```dax
VAR _cogs =
        SUMX(
            'f.AllOrders'
            , 'f.AllOrders'[quantity] * 'f.AllOrders'[landed_cost]
        )

RETURN
    _cogs
```

#### `%_cogs_over_net_revenue`

**Depende de medidas:** `[$_cogs]`, `[$_net_revenue]`  
```dax
VAR _div = DIVIDE( [$_cogs], [$_net_revenue] ) 

RETURN
    _div
```

#### `$_avg_landed_cost`

**Depende de medidas:** `[$_unit_landed_cost_continuous]`  
**Depende de colunas:** `'SKUs'[Amazon Family]`, `'SKUs'[Base SKU]`, `'SKUs'[Native Family]`  
```dax
AVERAGEX(
    VALUES('SKUs'[Amazon Family]),
    CALCULATE(
        AVERAGEX(
            VALUES('SKUs'[Native Family]),
            CALCULATE(
                AVERAGEX(
                    VALUES('SKUs'[Base SKU]),
                    [$_unit_landed_cost_continuous]
                )
            )
        )
    )
)
```

#### `$_unit_landed_cost_continuous`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_average_landed_cost'[Date]`, `'fact_average_landed_cost'[unit_cost]`  
```dax
VAR _MaxDateVisual = MAX('Calendar'[Date]) -- Pega a data do ponto atual no gráfico

VAR _LastDateWithData = 
    CALCULATE(
        MAX('fact_average_landed_cost'[Date]),
        -- Procura datas na fato que sejam anteriores ou iguais a data do gráfico
        'fact_average_landed_cost'[Date] <= _MaxDateVisual,
        -- Remove QUALQUER filtro de data para poder olhar para trás no histórico
        ALL('Calendar') 
    )

RETURN
    CALCULATE(
        ROUND( MIN ('fact_average_landed_cost'[unit_cost] ), 2),
        -- Recupera o custo da data encontrada
        'fact_average_landed_cost'[Date] = _LastDateWithData,
        -- Garante que não haja interferência de outros filtros de data
        ALL('Calendar')
    )
```

#### `$_avg_landed_cost_last_year`

**Depende de medidas:** `[$_avg_landed_cost]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_avg_landed_cost],
    SAMEPERIODLASTYEAR('Calendar'[Date]),
    CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_cogs_net_of_refunds`

**Depende de medidas:** `[$_cogs]`, `[%_total_fba_returns]`  
```dax
VAR _cogs = [$_cogs]
    VAR _cogs_refunded = _cogs * [%_total_fba_returns]

RETURN
    _cogs - _cogs_refunded
```


### Logistics\Inbound Shipments - gsheets

#### `u_quantity_inbound_shipments`

**Depende de colunas:** `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Quantity]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _result = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , USERELATIONSHIP( 'z.list_of_warehouse_names'[Deliver At Location],'Inbound Shipments'[Deliver At Location])
        )

return
    _result
```

#### `$_unit_landed_cost_inbound_shipments`

**Depende de medidas:** `[$_total_landed_cost_inbound_shipments]`, `[u_quantity_inbound_shipments_orders]`  
```dax
VAR _unitLandedCost = 
        DIVIDE ( 
            [$_total_landed_cost_inbound_shipments]
            , [u_quantity_inbound_shipments_orders]
            , 0 
        )

RETURN
    _unitLandedCost
```

#### `$_total_landed_cost_inbound_shipments`

**Depende de colunas:** `'Inbound Shipments'[Total Landed Cost Local Currency]`  
```dax
// Calculates the sum of the Total Landed Cost from the Inbound Shipments sheet in the Daily Reports located in Google Drive, considering both the Context and Report filters.
    
    VAR _landedCost = SUM ('Inbound Shipments'[Total Landed Cost Local Currency] )

RETURN
    _landedCost
```

#### `$_total_purchase_cost_inbound_shipments`

**Depende de colunas:** `'Inbound Shipments'[Total Purchase Cost Local Currency]`  
```dax
// Calculates the sum of the Total Purchase Cost from the Inbound Shipments, considering both the Context and Report filters.

    VAR _purchaseCost = SUM ('Inbound Shipments'[Total Purchase Cost Local Currency] )

RETURN
    _purchaseCost
```

#### `$_unit_purchase_cost_inbound_shipments`

**Depende de medidas:** `[$_total_purchase_cost_inbound_shipments]`, `[u_quantity_inbound_shipments]`  
```dax
VAR _unitPurchaseCost = 
        DIVIDE ( 
            [$_total_purchase_cost_inbound_shipments]
            , [u_quantity_inbound_shipments]
            , 0 
        )

RETURN
    _unitPurchaseCost
```

#### `u_inventory_3pl_on_hand`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Deliver At Type]`, `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Origin]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Status]`, `'Inbound Shipments'[Type]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _orders = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , FILTER ( ALL ( 'Inbound Shipments' ), 
                (   'Inbound Shipments'[Deliver At Type] = "Warehouse" 
                 || CONTAINSSTRING ( 'Inbound Shipments'[Deliver At Location],  "AWD" )
                )
            
                && 'Inbound Shipments'[Delivery Date] <= MAX('Calendar'[Date]) 
                && 'Inbound Shipments'[Status] = "Delivered" 
                        
                // The filetrs below should be fixed on the database
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
            )
            , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Deliver At Location] )
        )

    VAR _transfers = 
        CALCULATE (
            SUM ( 'Inbound Shipments'[Quantity] )
            , FILTER ( ALL ( 'Inbound Shipments' ), 
                'Inbound Shipments'[Type] = "Transfer" 
                && 'Inbound Shipments'[Delivery Date] <= MAX('Calendar'[Date]) 
                && 'Inbound Shipments'[Status] = "Delivered"
            
            // The filetrs below should be fixed on the database
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") )
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") )
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
            )
            , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Origin] )
        )

    VAR _balance =  _orders - _transfers

RETURN
    CALCULATE(
        _balance
        , FILTER (
            'Inbound Shipments'
            , 'Inbound Shipments'[Delivery Date] = MAX('Inbound Shipments'[Delivery Date])
        )
    )
    
    --IF(MAX('Calendar'[Date]) <= TODAY(),_balance * DIVIDE ( _balance, _balance ), BLANK())
```

#### `b_inventory_3pl_available_and_current_checking`

**Depende de medidas:** `[u_inventory_3pl_available_for_transfer]`, `[u_inventory_3pl_on_hand]`, `[u_inventory_3pl_reports_available_for_transfer]`, `[u_inventory_3pl_reports_on_hand]`  
**Depende de colunas:** `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _3plAvailable = [u_inventory_3pl_reports_available_for_transfer]
    VAR _estimatedAvailable = [u_inventory_3pl_available_for_transfer]
    VAR _estimatedCurrent = [u_inventory_3pl_on_hand]
    VAR _result =
        SWITCH(
            TRUE()
            //, NOT ( ISINSCOPE ( 'z.list_of_warehouse_names'[Deliver At Location] ) ), Blank()
            , ISBLANK([u_inventory_3pl_reports_on_hand]), BLANK()
            , MAX ( 'z.list_of_warehouse_names'[Deliver At Location] ) = "Babyliss", "There is no Babyliss report"
            , AND ( _estimatedAvailable = _3plAvailable, _estimatedAvailable <= _estimatedCurrent  ), "Right"
            , OR ( _estimatedAvailable <> _3plAvailable, _estimatedAvailable > _estimatedCurrent  ), "Wrong"
            , "Issue not Specified"
        )

RETURN
    _result
```

#### `u_inventory_3pl_available_for_transfer`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Deliver At Type]`, `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Order Date]`, `'Inbound Shipments'[Origin]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Status]`, `'Inbound Shipments'[Type]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _orders = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , FILTER ( ALL ( 'Inbound Shipments' ), 
                (   'Inbound Shipments'[Deliver At Type] = "Warehouse"
                 || CONTAINSSTRING ( 'Inbound Shipments'[Deliver At Location],  "AWD" )
                )

                && 'Inbound Shipments'[Delivery Date] <= MAX('Calendar'[Date]) 
                && 'Inbound Shipments'[Status] = "Delivered" 
                            
                // The filetrs below should be fixed on the database
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
            )
            , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Deliver At Location] )
        )

    VAR _transfers = 
        CALCULATE (
            SUM ( 'Inbound Shipments'[Quantity] )
            , FILTER ( ALL ( 'Inbound Shipments' ), 
                'Inbound Shipments'[Type] = "Transfer" 
                && 'Inbound Shipments'[Order Date] <= MAX('Calendar'[Date]) 
                && 'Inbound Shipments'[Status] <> "Cancelled"
                
                // The filetrs below should be fixed on the database
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") )
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
            )
            , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Origin] )
        )

    VAR _balance = _orders - _transfers

RETURN
    _balance * DIVIDE ( _balance, _balance )
```

#### `d_delivery_date_inbound_shipments`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Delivery Date]`  
```dax
VAR _deliveryDay =
        CALCULATE (
            MIN('Calendar'[Date])
            , FILTER ( 
                'Calendar'
                , 'Calendar'[Date] = MIN('Inbound Shipments'[Delivery Date] ) 
            ) 
        )

RETURN
    _deliveryDay
```

#### `d_next_delivery_date_inbound_shipments`

**Depende de medidas:** `[d_delivery_date_inbound_shipments]`  
**Depende de colunas:** `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Status]`  
```dax
VAR _deliveryDate = [d_delivery_date_inbound_shipments]

    VAR _nextDeliveryDate =
        CALCULATE (
           MIN('Inbound Shipments'[Delivery Date])
            , FILTER ( ALL ( 'Inbound Shipments'[Delivery Date] ), 'Inbound Shipments'[Delivery Date]> [d_delivery_date_inbound_shipments] ) )

RETURN

    CALCULATE(
        MIN('Inbound Shipments'[Delivery Date])
        , FILTER(
            ALL ( 'Inbound Shipments' )
            ,    'Inbound Shipments'[Delivery Date] > MIN('Inbound Shipments'[Delivery Date] ) 
              && NOT(ISBLANK(_deliveryDate)) 
              && 'Inbound Shipments'[Status] <> "Cancelled"
        )
    )
```

#### `t_next_order_id_inbound_shipments`

**Depende de medidas:** `[d_next_delivery_date_inbound_shipments]`  
**Depende de colunas:** `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Order ID]`  
```dax
VAR _nextDeliveryDate = [d_next_delivery_date_inbound_shipments]
    VAR _nextOrderIDArray = 
        CALCULATETABLE ( VALUES ( 'Inbound Shipments'[Order ID] )
        , FILTER ( ALL ( 'Inbound Shipments' ), 'Inbound Shipments'[Delivery Date] <> Blank() && 'Inbound Shipments'[Delivery Date] = _nextDeliveryDate ) )

    VAR _nextOrderIDConcatenated = CONCATENATEX ( _nextOrderIDArray, 'Inbound Shipments'[Order ID], ", " )

RETURN
    _nextOrderIDConcatenated
```

#### `u_next_order_quantity_inbound_shipments`

**Depende de medidas:** `[d_next_delivery_date_inbound_shipments]`  
**Depende de colunas:** `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Quantity]`  
```dax
VAR _nextDeliveryDate = [d_next_delivery_date_inbound_shipments]
    VAR _nextQuantity = 
        CALCULATE ( SUM ( 'Inbound Shipments'[Quantity] )
        , FILTER ( ALL ( 'Inbound Shipments' ), 'Inbound Shipments'[Delivery Date] <> Blank() && 'Inbound Shipments'[Delivery Date] = _nextDeliveryDate ) )

RETURN
    _nextQuantity
```

#### `u_inventory_3pl_transfers_in_transit`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Origin]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Status]`, `'Inbound Shipments'[Type]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _transfers = 
        CALCULATE (
            SUM ( 'Inbound Shipments'[Quantity] )
            , FILTER ( ALL ( 'Inbound Shipments' ), 
                'Inbound Shipments'[Type] = "Transfer" 
                && 'Inbound Shipments'[Delivery Date] <= MAX('Calendar'[Date]) 
                && 'Inbound Shipments'[Status] <> "Delivered"
                && 'Inbound Shipments'[Status] <> "Cancelled"
            
            // The filetrs below should be fixed on the database
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") ) 
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") )
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") )
                && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
            )
            , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Origin] )
        )

RETURN
    _transfers
```

#### `d_last_delivery_date_inbound_shipments_region_supplier`

**Depende de colunas:** `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Origin]`, `'Inbound Shipments'[Region]`, `'Inbound Shipments'[Status]`  
```dax
VAR _region = MAX('Inbound Shipments'[Region])
    VAR _supplier = MAX('Inbound Shipments'[Origin])
    VAR _deliveryDate = MAX('Inbound Shipments'[Delivery Date])
    VAR _lastDeliveryDate = 
        CALCULATE(
            MAX('Inbound Shipments'[Delivery Date]),
            FILTER(
                ALL('Inbound Shipments'),
                'Inbound Shipments'[Region] = _region &&
                'Inbound Shipments'[Origin] = _supplier &&
                'Inbound Shipments'[Delivery Date] < _deliveryDate &&
                'Inbound Shipments'[Status] <> "Cancelled"
            )
        )

RETURN
    _lastDeliveryDate
```

#### `t_last_order_id_inbound_shipments_region_suplier`

**Depende de medidas:** `[d_last_delivery_date_inbound_shipments_region_supplier]`  
**Depende de colunas:** `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Order ID]`, `'Inbound Shipments'[Status]`  
```dax
VAR _lastDeliveryDate = [d_last_delivery_date_inbound_shipments_region_supplier]
    VAR _lastOrderID = 
        CALCULATE(
            MAX('Inbound Shipments'[Order ID])
            , FILTER(
                ALL('Inbound Shipments')
                ,    'Inbound Shipments'[Delivery Date] = _lastDeliveryDate
                  && 'Inbound Shipments'[Status] <> "Cancelled"
            )
        )

RETURN
    _lastOrderID
```

#### `$_total_transfer_cost_inbound_shipments`

**Depende de colunas:** `'Inbound Shipments'[Total Transfer Cost Local Currency]`  
```dax
VAR _transferCost = SUM ('Inbound Shipments'[Total Transfer Cost Local Currency] )

RETURN
    _transferCost
```

#### `$_unit_transfer_cost_inbound_shipments`

**Depende de medidas:** `[$_total_transfer_cost_inbound_shipments]`, `[u_quantity_inbound_shipments_orders]`  
```dax
VAR _unitTransferCost = 
        DIVIDE ( 
            [$_total_transfer_cost_inbound_shipments]
            , [u_quantity_inbound_shipments_orders]
            , 0 
        )

RETURN
    _unitTransferCost
```

#### `u_quantity_inbound_shipments_orders`

**Depende de colunas:** `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Type]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _result = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , USERELATIONSHIP( 'z.list_of_warehouse_names'[Deliver At Location],'Inbound Shipments'[Deliver At Location])
            , 'Inbound Shipments'[Type] = "Order"
        )

return
    _result
```

#### `u_quantity_inbound_shipments_transfer`

**Depende de colunas:** `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Type]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _result = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , USERELATIONSHIP( 'z.list_of_warehouse_names'[Deliver At Location],'Inbound Shipments'[Deliver At Location])
            , 'Inbound Shipments'[Type] = "Transfer"
        )

return
    _result
```

#### `d_order_date_inbound_shipments`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Order Date]`  
```dax
VAR _deliveryDay =
CALCULATE (
    MIN ( 'Inbound Shipments'[Order Date] ),
    USERELATIONSHIP ( 'Calendar'[Date], 'Inbound Shipments'[Order Date] )
)

RETURN
    _deliveryDay
```

#### `u_inventory_3pl_on_hand_transfer`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Origin]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Status]`, `'Inbound Shipments'[Type]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
CALCULATE (
        SUM ( 'Inbound Shipments'[Quantity] )
        , FILTER (  'Inbound Shipments' , 
            'Inbound Shipments'[Type] = "Transfer" 
            && 'Inbound Shipments'[Delivery Date] <= MAX('Calendar'[Date]) 
            && 'Inbound Shipments'[Status] = "Delivered"
        
        // The filetrs below should be fixed on the database
            && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
            && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
            && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") ) 
            && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") )
            && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") )
            && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
        )
        , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Origin] )
    )
```

#### `u_inventory_3pl_on_hand_order`

**Depende de colunas:** `'Calendar'[Date]`, `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Deliver At Type]`, `'Inbound Shipments'[Delivery Date]`, `'Inbound Shipments'[Origin]`, `'Inbound Shipments'[Quantity]`, `'Inbound Shipments'[Status]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
CALCULATE(
    SUM ( 'Inbound Shipments'[Quantity] )
    , FILTER ( 'Inbound Shipments' , 
        (   'Inbound Shipments'[Deliver At Type] = "Warehouse" 
         || CONTAINSSTRING ( 'Inbound Shipments'[Deliver At Location],  "AWD" )
        )
    
        && 'Inbound Shipments'[Delivery Date] <= MAX('Calendar'[Date]) 
        && 'Inbound Shipments'[Status] = "Delivered" 
                
        // The filetrs below should be fixed on the database
        && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "ASAP") ) 
        && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Ship.it") ) 
        && NOT(CONTAINSSTRING('Inbound Shipments'[Origin], "Shipdepot") ) 
        && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "ASAP") ) 
        && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Ship.it") ) 
        && NOT(CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "Shipdepot") )
    )
    , USERELATIONSHIP ( 'z.list_of_warehouse_names'[Deliver At Location], 'Inbound Shipments'[Deliver At Location] )
)
```

#### `i_negative_3pl`

**Depende de medidas:** `[u_inventory_3pl_on_hand_order]`, `[u_inventory_3pl_on_hand_transfer]`  
```dax
[u_inventory_3pl_on_hand_transfer] > [u_inventory_3pl_on_hand_order]
```

#### `$_unit_non_purchase_cost_inbound_shipments`

**Depende de medidas:** `[$_unit_landed_cost_inbound_shipments]`, `[$_unit_purchase_cost_inbound_shipments]`  
```dax
CALCULATE(
    IF(
        OR(
            ISBLANK([$_unit_landed_cost_inbound_shipments])
            , ISBLANK([$_unit_purchase_cost_inbound_shipments])
        )
        , BLANK()
        , [$_unit_landed_cost_inbound_shipments]-[$_unit_purchase_cost_inbound_shipments]
    )
)
```

#### `u_quantity_inbound_shipments_amazon`

**Depende de colunas:** `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Deliver At Type]`, `'Inbound Shipments'[Quantity]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _result = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , USERELATIONSHIP( 'z.list_of_warehouse_names'[Deliver At Location],'Inbound Shipments'[Deliver At Location])
            , 'Inbound Shipments'[Deliver At Type] = "Amazon"
        )

return
    _result
```

#### `u_quantity_inbound_shipments_awd`

**Depende de colunas:** `'Inbound Shipments'[Deliver At Location]`, `'Inbound Shipments'[Deliver At Type]`, `'Inbound Shipments'[Quantity]`, `'z.list_of_warehouse_names'[Deliver At Location]`  
```dax
VAR _result = 
        CALCULATE(
            SUM ( 'Inbound Shipments'[Quantity] )
            , USERELATIONSHIP( 'z.list_of_warehouse_names'[Deliver At Location],'Inbound Shipments'[Deliver At Location])
            // , 'Inbound Shipments'[Deliver At Type] = "Amazon AWD"
            , CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "AWD")
        )

return
    _result
```


### Logistics\Inventory Tracker - gsheets

#### `Qty_Units`

**Depende de colunas:** `'Inbound Shipments'[Quantity]`  
```dax
SUM('Inbound Shipments'[Quantity])
```

#### `Qty_Orders`

**Depende de colunas:** `fact_order_records[Order Id]`  
```dax
DISTINCTCOUNT(fact_order_records[Order Id])
```

#### `%_Average_Landed_x_Purchase`

**Depende de colunas:** `'Inbound Shipments'[Unit Landed Cost Local Currency]`, `'Inbound Shipments'[Unit Purchase Cost Local Currency]`  
```dax
DIVIDE(AVERAGE('Inbound Shipments'[Unit Landed Cost Local Currency])-AVERAGE('Inbound Shipments'[Unit Purchase Cost Local Currency]),AVERAGE('Inbound Shipments'[Unit Purchase Cost Local Currency]))
```

#### `%_Deliveries_on_Time`

**Depende de colunas:** `fact_order_records[Delivered Status]`  
```dax
DIVIDE(
    CALCULATE(
        COUNT(fact_order_records[Delivered Status])
        , (fact_order_records[Delivered Status] = "Delivered on Time")
    )+0
    , CALCULATE(
        COUNT(fact_order_records[Delivered Status]),
        NOT(ISBLANK(fact_order_records[Delivered Status]))
    )

)
```

#### `%_Freight_x_Price`

**Depende de colunas:** `'fact_order_records'[EXW/Invoice USD]`, `'fact_order_records'[Freight Provision USD]`  
```dax
DIVIDE(SUM('fact_order_records'[Freight Provision USD]), SUM('fact_order_records'[EXW/Invoice USD]))
```

#### `%_Late_Deliveries`

**Depende de colunas:** `fact_order_records[Delivered Status]`  
```dax
DIVIDE(
    CALCULATE(
        COUNT(fact_order_records[Delivered Status])
        , (fact_order_records[Delivered Status] = "Delivered Late")
    )+0
    , CALCULATE(
        COUNT(fact_order_records[Delivered Status]),
        NOT(ISBLANK(fact_order_records[Delivered Status]))
    )

)
```

#### `Average_Arrival_at_Port_Delay`

**Depende de colunas:** `fact_order_records[Delay - Arrival (Days)]`  
```dax
AVERAGE(fact_order_records[Delay - Arrival (Days)])
```

#### `Average_CBM`

**Depende de colunas:** `'fact_order_records'[CBM]`  
```dax
AVERAGE('fact_order_records'[CBM])
```

#### `Average_Delivery_Delay`

**Depende de colunas:** `fact_order_records[Delay - Delivery (Days)]`  
```dax
AVERAGE(fact_order_records[Delay - Delivery (Days)])
```

#### `Average_Freight_Cost`

**Depende de colunas:** `fact_order_records[Freight Provision USD]`  
```dax
AVERAGE(fact_order_records[Freight Provision USD])
```

#### `Average_Freight_Interval`

**Depende de medidas:** `[Interval]`, `[Previous Order Date]`  
**Depende de colunas:** `'fact_order_records'[Freight Forwarder]`, `'fact_order_records'[Order Date]`  
```dax
VAR OrdersBySupplier = 
    SUMMARIZE(
        'fact_order_records',
        'fact_order_records'[Freight Forwarder],
        'fact_order_records'[Order Date]
    )
VAR DateDiffTable = 
    ADDCOLUMNS(
        OrdersBySupplier,
        "Previous Order Date", 
        CALCULATE(
            MAX('fact_order_records'[Order Date]),
            FILTER(
                'fact_order_records',
                'fact_order_records'[Freight Forwarder] = EARLIER('fact_order_records'[Freight Forwarder]) &&
                'fact_order_records'[Order Date] < EARLIER('fact_order_records'[Order Date])
            )
        )
    )
VAR IntervalTable = 
    ADDCOLUMNS(
        DateDiffTable,
        "Interval",
        DATEDIFF([Previous Order Date], [Order Date], DAY)
    )
RETURN 
    AVERAGEX(
        IntervalTable,
        [Interval]
    )
```

#### `average_grade`

**Depende de colunas:** `'fact_SCPR_all_reviews'[Grade]`  
```dax
AVERAGE('fact_SCPR_all_reviews'[Grade])
```

#### `Average_Order_Interval`

**Depende de medidas:** `[Interval]`, `[Previous Order Date]`  
**Depende de colunas:** `'fact_order_records'[Order Date]`, `'fact_order_records'[Supplier]`  
```dax
VAR OrdersBySupplier = 
    SUMMARIZE(
        'fact_order_records',
        'fact_order_records'[Supplier],
        'fact_order_records'[Order Date]
    )
VAR DateDiffTable = 
    ADDCOLUMNS(
        OrdersBySupplier,
        "Previous Order Date", 
        CALCULATE(
            MAX('fact_order_records'[Order Date]),
            FILTER(
                'fact_order_records',
                'fact_order_records'[Supplier] = EARLIER('fact_order_records'[Supplier]) &&
                'fact_order_records'[Order Date] < EARLIER('fact_order_records'[Order Date])
            )
        )
    )
VAR IntervalTable = 
    ADDCOLUMNS(
        DateDiffTable,
        "Interval",
        DATEDIFF([Previous Order Date], [Order Date], DAY)
    )
RETURN 
    AVERAGEX(
        IntervalTable,
        [Interval]
    )
```

#### `Average_Order_Price`

**Depende de colunas:** `fact_order_records[EXW/Invoice USD]`  
```dax
AVERAGE(fact_order_records[EXW/Invoice USD])
```

#### `Average_Pick_Up_Delay`

**Depende de colunas:** `fact_order_records[Delay - Pick up (Days)]`  
```dax
AVERAGE(fact_order_records[Delay - Pick up (Days)])
```

#### `Average_Order_Review`

**Depende de colunas:** `'fact_order_records'[Order Creation]`, `'fact_order_records'[Order Date]`  
```dax
AVERAGEX(
    'fact_order_records',
    DATEDIFF( 'fact_order_records'[Order Creation],'fact_order_records'[Order Date], DAY)
)
```

#### `Average_Unit_Purchase_Cost_Local`

**Depende de colunas:** `'Inbound Shipments'[Unit Purchase Cost Local Currency]`  
```dax
AVERAGE('Inbound Shipments'[Unit Purchase Cost Local Currency])
```

#### `Freight_Cost_per_CBM`

**Depende de colunas:** `fact_order_records[CBM]`, `fact_order_records[Freight Provision USD]`  
```dax
DIVIDE(SUM(fact_order_records[Freight Provision USD]), SUM(fact_order_records[CBM]), 0)
```

#### `Average_Freight_per_CBM`

**Depende de colunas:** `fact_order_records[CBM]`, `fact_order_records[Freight Provision USD]`  
```dax
AVERAGEX(fact_order_records,DIVIDE(fact_order_records[Freight Provision USD],fact_order_records[CBM]))
```

#### `On_Time_Deliveries`

**Depende de colunas:** `fact_order_records[Delivered Status]`  
```dax
CALCULATE(
    COUNT(fact_order_records[Delivered Status]),
    fact_order_records[Delivered Status] = "Delivered on Time"
)
```

#### `Purchase_Cost_per_CBM`

**Depende de colunas:** `OrderRecords[CBM]`, `OrderRecords[EXW/Invoice USD]`, `fact_order_records[CBM]`, `fact_order_records[EXW/Invoice USD]`  
```dax
//DIVIDE(SUM(OrderRecords[EXW/Invoice USD]), SUM(OrderRecords[CBM]), 0)
AVERAGEX(fact_order_records,DIVIDE(fact_order_records[EXW/Invoice USD],fact_order_records[CBM]))
```

#### `Share_Delay_Arrival`

**Depende de medidas:** `[Average_Arrival_at_Port_Delay]`, `[Average_Departure_Delay]`, `[Average_Freight_Delay]`  
```dax
DIVIDE([Average_Arrival_at_Port_Delay],([Average_Departure_Delay]+[Average_Arrival_at_Port_Delay]))*[Average_Freight_Delay]
```

#### `Average_Departure_Delay`

**Depende de colunas:** `fact_order_records[Delay - Departure (Days)]`  
```dax
AVERAGE(fact_order_records[Delay - Departure (Days)])
```

#### `Share_Delay_Departure`

**Depende de medidas:** `[Average_Arrival_at_Port_Delay]`, `[Average_Departure_Delay]`, `[Average_Freight_Delay]`  
```dax
DIVIDE([Average_Departure_Delay],([Average_Departure_Delay]+[Average_Arrival_at_Port_Delay]))*[Average_Freight_Delay]
```

#### `Total_Customs_Exams_Charges`

**Depende de colunas:** `fact_order_records[Customs Exam Charges Provision USD]`  
```dax
SUM(fact_order_records[Customs Exam Charges Provision USD])
```

#### `Total_Freight_Cost`

**Depende de colunas:** `fact_order_records[Freight Provision USD]`  
```dax
SUM(fact_order_records[Freight Provision USD])
```

#### `Total_Freight_LT`

**Depende de colunas:** `'fact_order_records'[Handling Lead Time (days)]`, `'fact_order_records'[Last Leg (days)]`, `'fact_order_records'[Ocean Time (days)]`  
```dax
AVERAGEX(
    'fact_order_records',
    'fact_order_records'[Handling Lead Time (days)] + 
    'fact_order_records'[Last Leg (days)] + 
    'fact_order_records'[Ocean Time (days)]
)
```

#### `Total_Landed_Cost`

**Depende de colunas:** `'Inbound Shipments'[Total Landed Cost Local Currency]`  
```dax
SUM('Inbound Shipments'[Total Landed Cost Local Currency])
```

#### `Total_Order_Cost`

**Depende de colunas:** `fact_order_records[Customs Exam Charges Provision USD]`, `fact_order_records[EXW/Invoice USD]`, `fact_order_records[Freight Provision USD]`  
```dax
SUM(fact_order_records[EXW/Invoice USD]) +
SUM(fact_order_records[Freight Provision USD]) +
SUM(fact_order_records[Customs Exam Charges Provision USD])
```

#### `Total_Order_LT`

**Depende de colunas:** `'fact_order_records'[Handling Lead Time (days)]`, `'fact_order_records'[Last Leg (days)]`, `'fact_order_records'[Ocean Time (days)]`, `'fact_order_records'[Production Lead Time (days)]`  
```dax
AVERAGEX(
    'fact_order_records',
    'fact_order_records'[Production Lead Time (days)]+
    'fact_order_records'[Handling Lead Time (days)] + 
    'fact_order_records'[Last Leg (days)] + 
    'fact_order_records'[Ocean Time (days)]
)
```

#### `Total_Order_Price`

**Depende de colunas:** `'fact_order_records'[EXW/Invoice USD]`  
```dax
SUM('fact_order_records'[EXW/Invoice USD])
```

#### `Total_Orders_Count`

```dax
COUNTROWS(dim_order_IDs)
```

#### `Total_Product_Quantity`

**Depende de colunas:** `'Inbound Shipments'[Quantity]`  
```dax
SUM('Inbound Shipments'[Quantity])
```

#### `Total_Production_Cost`

**Depende de colunas:** `fact_order_records[EXW/Invoice USD]`  
```dax
SUM(fact_order_records[EXW/Invoice USD])
```

#### `Total_Production_LT`

**Depende de colunas:** `'fact_order_records'[Production Lead Time (days)]`  
```dax
AVERAGEX(
    'fact_order_records',
    'fact_order_records'[Production Lead Time (days)]
)
```

#### `Total_Purchase_Cost`

**Depende de colunas:** `'Inbound Shipments'[Total Purchase Cost Local Currency]`  
```dax
SUM('Inbound Shipments'[Total Purchase Cost Local Currency])
```

#### `Unit_Purchase_Cost`

**Depende de medidas:** `[Qty_Units]`, `[Total_Purchase_Cost]`  
```dax
DIVIDE([Total_Purchase_Cost],[Qty_Units],0)
```

#### `Average_Handling_LT`

**Depende de colunas:** `fact_order_records[Handling Lead Time (days)]`  
```dax
AVERAGEX(fact_order_records,fact_order_records[Handling Lead Time (days)])
```

#### `Average_Ocean_LT`

**Depende de colunas:** `fact_order_records[Ocean Time (days)]`  
```dax
AVERAGEX(fact_order_records,fact_order_records[Ocean Time (days)])
```

#### `Average_Ground_LT`

**Depende de colunas:** `fact_order_records[Last Leg (days)]`  
```dax
AVERAGEX(fact_order_records,(fact_order_records[Last Leg (days)]))
```

#### `Average_Units`

**Depende de colunas:** `'Inbound Shipments'[Quantity]`  
```dax
AVERAGE('Inbound Shipments'[Quantity])
```

#### `FabricanteSelecionado`

**Depende de colunas:** `fact_order_records[Freight Forwarder]`  
```dax
VAR FabricanteFiltro = SELECTEDVALUE(fact_order_records[Freight Forwarder]) // Nome da coluna do filtro
RETURN
IF(MAX(fact_order_records[Freight Forwarder]) = FabricanteFiltro, 1, 0)
```

#### `%_Produced_on_Time`

**Depende de colunas:** `fact_order_records[Production Status]`  
```dax
DIVIDE(
    CALCULATE(
        COUNT(fact_order_records[Production Status])
        , (fact_order_records[Production Status] = "Produced on Time")
    )+0
    , CALCULATE(
        COUNT(fact_order_records[Production Status]),
        NOT(ISBLANK(fact_order_records[Production Status]))
    )

)
```

#### `Average_Freight_Delay`

**Depende de colunas:** `'fact_order_records'[Freight_Delay_Column]`  
```dax
VAR TotalPedidosAtrasados = 
    CALCULATE(
        COUNTROWS('fact_order_records'),
        'fact_order_records'[Freight_Delay_Column] > 0
    )

VAR SomaAtraso = 
    CALCULATE(
        SUM('fact_order_records'[Freight_Delay_Column]),
        'fact_order_records'[Freight_Delay_Column] > 0
    )

RETURN
    IF(TotalPedidosAtrasados > 0, DIVIDE(SomaAtraso, TotalPedidosAtrasados, 0))
```

#### `Freight_Planned_LT`

**Depende de colunas:** `'fact_order_records'[Agreed - Delivery Date]`, `'fact_order_records'[Agreed - Established Time of Departure (ETD)]`  
```dax
VAR PlannedLeadTime = 
    AVERAGEX(
        'fact_order_records',
        DATEDIFF(
            'fact_order_records'[Agreed - Established Time of Departure (ETD)],
            'fact_order_records'[Agreed - Delivery Date],
            DAY
        )
    )

RETURN
    PlannedLeadTime
```

#### `Freight_Actual_LT`

**Depende de colunas:** `'fact_order_records'[Actual - Delivery Date]`, `'fact_order_records'[Actual - Departure Date]`  
```dax
VAR ActualLeadTime = 
    AVERAGEX(
        'fact_order_records',
        DATEDIFF(
            'fact_order_records'[Actual - Departure Date],
            'fact_order_records'[Actual - Delivery Date],
            DAY
        )
    )

RETURN
    ActualLeadTime
```

#### `%_Freight_On_Time`

**Depende de colunas:** `'fact_order_records'[Freight_Delay_Column]`  
```dax
VAR TotalPedidos = COUNTROWS('fact_order_records')

VAR PedidosOnTime = 
    CALCULATE(
        COUNTROWS('fact_order_records'),
        'fact_order_records'[Freight_Delay_Column] <= 0
    )+0

RETURN
    IF(TotalPedidos > 0, DIVIDE(PedidosOnTime, TotalPedidos, 0))
```

#### `Average_Production_Delay`

**Depende de colunas:** `'fact_order_records'[Actual - Pick up Date]`, `'fact_order_records'[Agreed - Pick up Date]`  
```dax
VAR TotalPedidosAtrasados = 
    CALCULATE(
        COUNTROWS('fact_order_records'),
        'fact_order_records'[Actual - Pick up Date] > 'fact_order_records'[Agreed - Pick up Date]
    )

VAR SomaAtraso = 
    CALCULATE(
        SUMX(
            FILTER(
                'fact_order_records',
                'fact_order_records'[Actual - Pick up Date] > 'fact_order_records'[Agreed - Pick up Date]
            ),
            DATEDIFF(
                'fact_order_records'[Agreed - Pick up Date],
                'fact_order_records'[Actual - Pick up Date],
                DAY
            )
        )
    )

RETURN
    IF(TotalPedidosAtrasados > 0, DIVIDE(SomaAtraso, TotalPedidosAtrasados, 0))
```

#### `Average_Order_Delay`

**Depende de colunas:** `'fact_order_records'[Actual - Delivery Date]`, `'fact_order_records'[Agreed - Delivery Date]`  
```dax
VAR TotalPedidosAtrasados = 
    CALCULATE(
        COUNTROWS('fact_order_records'),
        'fact_order_records'[Actual - Delivery Date] > 'fact_order_records'[Agreed - Delivery Date]
    )

VAR SomaAtraso = 
    CALCULATE(
        SUMX(
            FILTER(
                'fact_order_records',
                'fact_order_records'[Actual - Delivery Date] > 'fact_order_records'[Agreed - Delivery Date]
            ),
            DATEDIFF(
                'fact_order_records'[Agreed - Delivery Date],
                'fact_order_records'[Actual - Delivery Date],
                DAY
            )
        )
    )

RETURN
    IF(TotalPedidosAtrasados > 0, DIVIDE(SomaAtraso, TotalPedidosAtrasados, 0))
```

#### `Agreed_Production_LT`

**Depende de colunas:** `'fact_order_records'[Agreed - Pick up Date]`, `'fact_order_records'[Order Date]`  
```dax
AVERAGEX(
    'fact_order_records',
    DATEDIFF(
        'fact_order_records'[Order Date], 
        'fact_order_records'[Agreed - Pick up Date], 
        DAY
    )
)
```

#### `Min_Unit_Purchase_Cost_Local`

**Depende de colunas:** `'Inbound Shipments'[Unit Purchase Cost Local Currency]`  
```dax
MIN('Inbound Shipments'[Unit Purchase Cost Local Currency])
```

#### `Average_Unit_Landed_Cost_Local`

**Depende de colunas:** `'Inbound Shipments'[Unit Landed Cost Local Currency]`  
```dax
AVERAGE('Inbound Shipments'[Unit Landed Cost Local Currency])
```

#### `Average_Unit_Purchase_Cost_USD`

**Depende de colunas:** `'Inbound Shipments'[Unit_Purchase_Cost_USD]`  
```dax
AVERAGE('Inbound Shipments'[Unit_Purchase_Cost_USD])
```


### PPC\PPC - Consolidated

#### `%_ppc_tacos`

**Depende de medidas:** `[$_net_revenue]`, `[$_ppc_spend]`  
```dax
ROUND(DIVIDE(
    [$_ppc_spend]
    , [$_net_revenue]
),4)
```

#### `%_ppc_sp_adv_prod_ratio_revenue_advertised_sku_sales`

**Depende de medidas:** `[$_ppc_sp_adv_prod_sales]`, `[$_ppc_sp_adv_prod_sales_advertised_sku]`  
```dax
DIVIDE (
    [$_ppc_sp_adv_prod_sales_advertised_sku]
    , [$_ppc_sp_adv_prod_sales]
)
```

#### `$_ppc_spend`

**Depende de medidas:** `[$_ppc_sb_att_pur_spend_by_sku]`, `[$_ppc_sd_adv_prod_spend]`, `[$_ppc_sp_adv_prod_spend]`  
```dax
[$_ppc_sp_adv_prod_spend] +
[$_ppc_sb_att_pur_spend_by_sku] +
[$_ppc_sd_adv_prod_spend]
```

#### `$_ppc_sales`

**Depende de medidas:** `[$_ppc_sb_att_pur_sales]`, `[$_ppc_sd_adv_prod_sales]`, `[$_ppc_sp_adv_prod_sales]`  
```dax
[$_ppc_sp_adv_prod_sales] +
[$_ppc_sb_att_pur_sales]  +
[$_ppc_sd_adv_prod_sales]
```

#### `%_ppc_acos`

**Depende de medidas:** `[$_ppc_sales]`, `[$_ppc_spend]`  
```dax
DIVIDE(
    [$_ppc_spend]
    , [$_ppc_sales]
)
```

#### `%_ppc_ratio_revenue`

**Depende de medidas:** `[$_ppc_sales]`, `[$_revenue]`  
```dax
DIVIDE (
    [$_ppc_sales]
    , [$_revenue]
)
```

#### `u_ppc_units_sold`

**Depende de medidas:** `[u_ppc_sb_att_pur_units_sold]`, `[u_ppc_sd_adv_prod_units_sold]`, `[u_ppc_sp_adv_prod_units_sold]`  
```dax
[u_ppc_sp_adv_prod_units_sold] +
[u_ppc_sb_att_pur_units_sold] +
[u_ppc_sd_adv_prod_units_sold]
```

#### `ppc_scorecard`

**Depende de medidas:** `[$_net_average_price]`, `[$_net_revenue]`, `[$_organic_revenue]`, `[$_ppc_cpc]`, `[$_ppc_sales]`, `[$_ppc_spend]`, `[%_ppc_acos]`, `[%_ppc_cvr]`, `[%_ppc_ratio_revenue]`, `[%_ppc_tacos]`, `[q_ppc_clicks]`, `[q_ppc_orders]`, `[u_units_sold]`  
**Depende de colunas:** `'z.RowHeaderScorecardPpc'[row_header]`  
```dax
VAR _decimal = "#,##0.00"
VAR _percent = "0.0%"
VAR _integer = "#,##0"
VAR CurrentRowHeader = SELECTEDVALUE('z.RowHeaderScorecardPpc'[row_header])
VAR _result = 
    SWITCH(
        TRUE(),
        CurrentRowHeader = "Net Revenue"       && NOT(ISBLANK([$_net_revenue])),       FORMAT([$_net_revenue],       _decimal),
        CurrentRowHeader = "Organic Sales"     && NOT(ISBLANK([$_organic_revenue])),   FORMAT([$_organic_revenue],   _decimal),
        CurrentRowHeader = "Total Units Sold"  && NOT(ISBLANK([u_units_sold])),        FORMAT([u_units_sold],        _integer),
        CurrentRowHeader = "PPC Sales"         && NOT(ISBLANK([$_ppc_sales])),         FORMAT([$_ppc_sales],         _decimal),
        CurrentRowHeader = "PPC Spend"         && NOT(ISBLANK([$_ppc_spend])),         FORMAT([$_ppc_spend],         _decimal),
        CurrentRowHeader = "Clicks"            && NOT(ISBLANK([q_ppc_clicks])),        FORMAT([q_ppc_clicks],        _integer),
        CurrentRowHeader = "Orders"            && NOT(ISBLANK([q_ppc_orders])),        FORMAT([q_ppc_orders],        _integer),
        CurrentRowHeader = "Conversion Rate"   && NOT(ISBLANK([%_ppc_cvr])),           FORMAT([%_ppc_cvr],           _percent),
        CurrentRowHeader = "CPC"               && NOT(ISBLANK([$_ppc_cpc])),           FORMAT([$_ppc_cpc],           _decimal),
        CurrentRowHeader = "ACoS %"            && NOT(ISBLANK([%_ppc_acos])),          FORMAT([%_ppc_acos],          _percent),
        CurrentRowHeader = "TACos %"           && NOT(ISBLANK([%_ppc_tacos])),         FORMAT([%_ppc_tacos],         _percent),
        CurrentRowHeader = "Ads Ratio"         && NOT(ISBLANK([%_ppc_ratio_revenue])), FORMAT([%_ppc_ratio_revenue], _percent),
        CurrentRowHeader = "NAP"               && NOT(ISBLANK([$_net_average_price])), FORMAT([$_net_average_price], _decimal),
        BLANK()
    )

RETURN
    _result
```

#### `q_ppc_clicks`

**Depende de medidas:** `[q_ppc_sd_adv_prod_clicks]`, `[q_ppc_sp_adv_prod_clicks]`  
```dax
[q_ppc_sp_adv_prod_clicks] +
// NAO EXISTE CLICK PARA SPONSORED BRANDS
[q_ppc_sd_adv_prod_clicks]
```

#### `q_ppc_orders`

**Depende de medidas:** `[q_ppc_sd_adv_prod_orders]`, `[q_ppc_sp_adv_prod_orders]`  
**Depende de colunas:** `desconsiderar ja que nao tem clicks[q_ppc_sb_att_pur_orders]`  
```dax
[q_ppc_sp_adv_prod_orders] +
//desconsiderar ja que nao tem clicks [q_ppc_sb_att_pur_orders]  +
[q_ppc_sd_adv_prod_orders]
```

#### `%_ppc_cvr`

**Depende de medidas:** `[q_ppc_clicks]`, `[q_ppc_orders]`  
```dax
DIVIDE(
    [q_ppc_orders]
    , [q_ppc_clicks]
)
```

#### `$_ppc_cpc`

**Depende de medidas:** `[$_ppc_spend]`, `[q_ppc_clicks]`  
```dax
DIVIDE(
    [$_ppc_spend]
    , [q_ppc_clicks]
)
```

#### `ppc_scorecard_filter`

**Depende de medidas:** `[$_net_revenue]`, `[$_ppc_sales]`, `[$_ppc_spend]`  
**Depende de colunas:** `dim_sponsored_ads[sponsored_ads_type]`  
```dax
CALCULATE(
    [$_net_revenue] + [$_ppc_sales] + [$_ppc_spend]
    , ALL(dim_sponsored_ads[sponsored_ads_type])
)
```

#### `%_ppc_tacos_amazon_family`

**Depende de medidas:** `[$_revenue]`, `[%_ppc_tacos]`  
**Depende de colunas:** `SKUs[Native Family]`, `SKUs[SKU]`  
```dax
VAR _sales =  [$_revenue]
    VAR _tacos_amazon_family =
        IF(
            _sales > 0
            , CALCULATE( [%_ppc_tacos], ALL( SKUs[SKU], SKUs[Native Family]) )
            , BLANK()
        )

RETURN
    _tacos_amazon_family
```


### PPC\PPC - Period Comparisson\PPC - MOM

#### `%_ppc_revenue_month_over_month_mom`

**Depende de medidas:** `[$_ppc_revenue_previous_month]`, `[$_ppc_sales]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_ppc_sales]
            , [$_ppc_revenue_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_ppc_spend_month_over_month_mom`

**Depende de medidas:** `[$_ppc_spend]`, `[$_ppc_spend_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_ppc_spend]
            , [$_ppc_spend_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_ppc_tacos_month_over_month_mom`

**Depende de medidas:** `[%_ppc_tacos]`, `[%_ppc_tacos_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )
    VAR _division = [%_ppc_tacos] - [%_ppc_tacos_previous_month]

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , ROUND(_division*100,3)
        , 0
    )
```

#### `%_ppc_acos_month_over_month_mom`

**Depende de medidas:** `[%_ppc_acos]`, `[%_ppc_acos_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )
    VAR _division = [%_ppc_acos] - [%_ppc_acos_previous_month]

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , ROUND(_division*100,3)
        , 0
    )
```


### PPC\PPC - Period Comparisson\PPC - YOY

#### `%_ppc_revenue_year_over_year_yoy`

**Depende de medidas:** `[$_ppc_revenue_previous_year]`, `[$_ppc_sales]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_ppc_sales]
            , [$_ppc_revenue_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_ppc_spend_year_over_year_yoy`

**Depende de medidas:** `[$_ppc_spend]`, `[$_ppc_spend_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_ppc_spend]
            , [$_ppc_spend_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_ppc_tacos_year_over_year_yoy`

**Depende de medidas:** `[%_ppc_tacos]`, `[%_ppc_tacos_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )
    VAR _division = [%_ppc_tacos] - [%_ppc_tacos_previous_year]

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , ROUND(_division*100,3)
        , 0
    )
```

#### `%_ppc_acos_year_over_year_yoy`

**Depende de medidas:** `[%_ppc_acos]`, `[%_ppc_acos_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )
    VAR _division = [%_ppc_acos] - [%_ppc_acos_previous_year]

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , ROUND(_division*100,3)
        , 0
    )
```


### PPC\PPC - Previous Periods\PPC - Previous Month

#### `$_ppc_spend_previous_month`

**Depende de medidas:** `[$_ppc_spend]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_ppc_spend]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_ppc_revenue_previous_month`

**Depende de medidas:** `[$_ppc_sales]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_ppc_sales]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `%_ppc_tacos_previous_month`

**Depende de medidas:** `[%_ppc_tacos]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [%_ppc_tacos]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `%_ppc_acos_previous_month`

**Depende de medidas:** `[%_ppc_acos]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [%_ppc_acos]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```


### PPC\PPC - Previous Periods\PPC - Previous Year

#### `$_ppc_revenue_previous_year`

**Depende de medidas:** `[$_ppc_sales]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_ppc_sales]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_ppc_spend_previous_year`

**Depende de medidas:** `[$_ppc_spend]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_ppc_spend]
    , DATEADD ( 'Calendar'[Date], -1, YEAR)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `%_ppc_tacos_previous_year`

**Depende de medidas:** `[%_ppc_tacos]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [%_ppc_tacos]
    , DATEADD ( 'Calendar'[Date], -1, YEAR)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `%_ppc_acos_previous_year`

**Depende de medidas:** `[%_ppc_acos]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [%_ppc_acos]
    , DATEADD ( 'Calendar'[Date], -1, YEAR)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```


### PPC\PPC - Reports Data\NEW SPONSORED Products

#### `% Other SKU Units`

**Depende de medidas:** `[Units Sold - Total]`, `[Units Sols - Other SKU - Purchased Product]`  
```dax
DIVIDE(
    [Units Sols - Other SKU - Purchased Product]
    , [Units Sold - Total]
)
```

#### `Units Sold - Same SKU - Advertised Product`

**Depende de colunas:** `'dim_skus_aux'[Key Column: Marketplace | SKU]`, `'fact_sp_advertised_products'[advertised_sku_units_sold_7d]`, `'fact_sp_advertised_products'[key_marketplace_advertised_sku]`  
```dax
VAR _sameSkus = 
        CALCULATE(
            SUM( 'fact_sp_advertised_products'[advertised_sku_units_sold_7d] )
            , USERELATIONSHIP('dim_skus_aux'[Key Column: Marketplace | SKU], 'fact_sp_advertised_products'[key_marketplace_advertised_sku] )
        )

RETURN
    _sameSkus
```

#### `Units Sold - Total`

**Depende de medidas:** `[Units Sold - Same SKU - Advertised Product]`, `[Units Sols - Other SKU - Purchased Product]`  
```dax
[Units Sold - Same SKU - Advertised Product] +
[Units Sols - Other SKU - Purchased Product]
```

#### `Units Sols - Other SKU - Purchased Product`

**Depende de colunas:** `'dim_skus_aux'[Key Column: Marketplace | ASIN]`, `'fact_sp_purchased_products'[key_marketplace_purchased_asin]`, `'fact_sp_purchased_products'[units_sold_other_sku]`  
```dax
VAR _otherSkus = 
        CALCULATE(
            SUM( 'fact_sp_purchased_products'[units_sold_other_sku] )
            , USERELATIONSHIP('dim_skus_aux'[Key Column: Marketplace | ASIN], 'fact_sp_purchased_products'[key_marketplace_purchased_asin] )
        )

RETURN
    _otherSkus
```

#### `u_ppc_sp_pur_prod_units_sold_other_sku_same_amazon_family`

**Depende de medidas:** `[Units Sols - Other SKU - Purchased Product]`  
**Depende de colunas:** `SKUs[Amazon Family]`, `dim_skus_aux[Amazon Family]`, `dim_skus_aux[Key Column: Marketplace | ASIN]`, `fact_sp_purchased_products[key_marketplace_purchased_asin]`  
```dax
VAR _adv_family =
    SELECTEDVALUE ( SKUs[Amazon Family] )
RETURN
IF (
    ISBLANK ( _adv_family ),
    BLANK (),
    CALCULATE (
        [Units Sols - Other SKU - Purchased Product],
        FILTER (
            fact_sp_purchased_products,
            VAR _pur_family =
                LOOKUPVALUE (
                    dim_skus_aux[Amazon Family],
                    dim_skus_aux[Key Column: Marketplace | ASIN], fact_sp_purchased_products[key_marketplace_purchased_asin]
                )
            RETURN
                _pur_family = _adv_family
        )
    )
)
```


### PPC\PPC - Reports Data\SB - Att. Pur.

#### `$_ppc_sb_att_pur_spend_by_sku`

**Depende de colunas:** `'f.SBSpendBySku'[sb_spend]`, `'fact_sb_spend_by_sku'[sb_spend]`, `SKUs[Inventory Region | Base SKU]`, `SKUs[Inventory Region]`, `SKUs[Sales Region]`  
```dax
// Calculates de PPC Spend, considering both the Context and Report filters.

    //SUM ( 'f.SBSpendBySku'[sb_spend] )


SWITCH(
    TRUE(),
    AND(ISINSCOPE(SKUs[Inventory Region | Base SKU]), MAX(SKUs[Inventory Region]) <> MAX(SKUs[Sales Region])), BLANK()
    , MAX(SKUs[Inventory Region]) = MAX(SKUs[Sales Region]), SUM('fact_sb_spend_by_sku'[sb_spend])
    , SUM('fact_sb_spend_by_sku'[sb_spend])
)
```

#### `$_ppc_sb_att_pur_sales`

**Depende de colunas:** `'fact_sb_attributed_purchase'[total_sales_14d]`, `SKUs[Inventory Region | Base SKU]`, `SKUs[Inventory Region]`, `SKUs[Sales Region]`  
```dax
SWITCH(
    TRUE(),
    AND(ISINSCOPE(SKUs[Inventory Region | Base SKU]), MAX(SKUs[Inventory Region]) <> MAX(SKUs[Sales Region])), BLANK()
    , MAX(SKUs[Inventory Region]) = MAX(SKUs[Sales Region]), SUM ( 'fact_sb_attributed_purchase'[total_sales_14d] )
    , SUM ( 'fact_sb_attributed_purchase'[total_sales_14d] )
)
```

#### `u_ppc_sb_att_pur_units_sold`

**Depende de colunas:** `'fact_sb_attributed_purchase'[total_units_sold_14d]`, `SKUs[Inventory Region | Base SKU]`, `SKUs[Inventory Region]`, `SKUs[Sales Region]`  
```dax
SWITCH(
    TRUE(),
    AND(ISINSCOPE(SKUs[Inventory Region | Base SKU]), MAX(SKUs[Inventory Region]) <> MAX(SKUs[Sales Region])), BLANK()
    , MAX(SKUs[Inventory Region]) = MAX(SKUs[Sales Region]), SUM ( 'fact_sb_attributed_purchase'[total_units_sold_14d] )
    , SUM ( 'fact_sb_attributed_purchase'[total_units_sold_14d] )
)
```

#### `%_ppc_sb_att_pur_acos`

**Depende de medidas:** `[$_ppc_sb_att_pur_sales]`, `[$_ppc_sb_att_pur_spend_by_sku]`  
```dax
// Calculates the PPC Advertisement Cost of Sales (AKA: ACOS) by dividing the PPC Spend by PPC Sales, considering both the Context and Report filters.

DIVIDE(
    [$_ppc_sb_att_pur_spend_by_sku]
    , [$_ppc_sb_att_pur_sales]
)
```

#### `%_ppc_sb_att_pur_tacos`

**Depende de medidas:** `[$_net_revenue]`, `[$_ppc_sb_att_pur_spend_by_sku]`  
```dax
ROUND(DIVIDE(
    [$_ppc_sb_att_pur_spend_by_sku]
    , [$_net_revenue]
),4)
```

#### `%_ppc_sb_att_pur_ratio_revenue`

**Depende de medidas:** `[$_ppc_sb_att_pur_sales]`, `[$_revenue]`  
```dax
DIVIDE (
    [$_ppc_sb_att_pur_sales]
    , [$_revenue]
)
```

#### `q_ppc_sb_att_pur_orders`

**Depende de colunas:** `'fact_sb_attributed_purchase'[total_orders_14d]`, `SKUs[Inventory Region | Base SKU]`, `SKUs[Inventory Region]`, `SKUs[Sales Region]`  
```dax
SWITCH(
    TRUE(),
    AND(ISINSCOPE(SKUs[Inventory Region | Base SKU]), MAX(SKUs[Inventory Region]) <> MAX(SKUs[Sales Region])), BLANK()
    , MAX(SKUs[Inventory Region]) = MAX(SKUs[Sales Region]), SUM ( 'fact_sb_attributed_purchase'[total_orders_14d] )
    , SUM ( 'fact_sb_attributed_purchase'[total_orders_14d] )
)
```


### PPC\PPC - Reports Data\SD - Adv. Prod.

#### `q_ppc_sd_adv_prod_clicks`

**Depende de colunas:** `'fact_sd_advertised_products'[clicks]`  
```dax
SUM ( 'fact_sd_advertised_products'[clicks] )
```

#### `$_ppc_sd_adv_prod_spend`

**Depende de colunas:** `'fact_sd_advertised_products'[spend]`  
```dax
SUM ( 'fact_sd_advertised_products'[spend] )
```

#### `$_ppc_sd_adv_prod_sales_advertised_sku`

**Depende de colunas:** `'fact_sd_advertised_products'[advertised_sku_sales_14d]`  
```dax
SUM ( 'fact_sd_advertised_products'[advertised_sku_sales_14d] )
```

#### `$_ppc_sd_adv_prod_sales_other_sku`

**Depende de colunas:** `'fact_sd_advertised_products'[other_sku_sales_14d]`  
```dax
SUM ( 'fact_sd_advertised_products'[other_sku_sales_14d] )
```

#### `$_ppc_sd_adv_prod_sales`

**Depende de medidas:** `[$_ppc_sd_adv_prod_sales_advertised_sku]`, `[$_ppc_sd_adv_prod_sales_other_sku]`  
```dax
[$_ppc_sd_adv_prod_sales_advertised_sku] +
[$_ppc_sd_adv_prod_sales_other_sku]
```

#### `q_ppc_sd_adv_prod_orders_advertised_sku`

**Depende de colunas:** `'fact_sd_advertised_products'[advertised_sku_orders_14d]`  
```dax
SUM ( 'fact_sd_advertised_products'[advertised_sku_orders_14d] )
```

#### `q_ppc_sd_adv_prod_orders_other_sku`

**Depende de colunas:** `'fact_sd_advertised_products'[other_sku_orders_14d]`  
```dax
SUM ( 'fact_sd_advertised_products'[other_sku_orders_14d] )
```

#### `q_ppc_sd_adv_prod_orders`

**Depende de medidas:** `[q_ppc_sd_adv_prod_orders_advertised_sku]`, `[q_ppc_sd_adv_prod_orders_other_sku]`  
```dax
[q_ppc_sd_adv_prod_orders_advertised_sku] +
[q_ppc_sd_adv_prod_orders_other_sku]
```

#### `%_ppc_sd_adv_prod_cvr`

**Depende de medidas:** `[q_ppc_sd_adv_prod_clicks]`, `[q_ppc_sd_adv_prod_orders]`  
```dax
DIVIDE(
    [q_ppc_sd_adv_prod_orders]
    , [q_ppc_sd_adv_prod_clicks]
)
```

#### `$_ppc_sd_adv_prod_cpc`

**Depende de medidas:** `[$_ppc_sd_adv_prod_spend]`, `[q_ppc_sd_adv_prod_clicks]`  
```dax
DIVIDE(
    [$_ppc_sd_adv_prod_spend]
    , [q_ppc_sd_adv_prod_clicks]
)
```

#### `%_ppc_sd_adv_prod_acos`

**Depende de medidas:** `[$_ppc_sd_adv_prod_sales]`, `[$_ppc_sd_adv_prod_spend]`  
```dax
DIVIDE(
    [$_ppc_sd_adv_prod_spend]
    , [$_ppc_sd_adv_prod_sales]
)
```

#### `%_ppc_sd_adv_prod_tacos`

**Depende de medidas:** `[$_net_revenue]`, `[$_ppc_sd_adv_prod_spend]`  
```dax
ROUND(DIVIDE(
    [$_ppc_sd_adv_prod_spend]
    , [$_net_revenue]
),4)
```

#### `%_ppc_sd_adv_prod_ratio_revenue`

**Depende de medidas:** `[$_ppc_sd_adv_prod_sales]`, `[$_revenue]`  
```dax
DIVIDE (
    [$_ppc_sd_adv_prod_sales]
    , [$_revenue]
)
```

#### `u_ppc_sd_adv_prod_units_sold_advertised_sku`

**Depende de colunas:** `'fact_sd_advertised_products'[advertised_sku_units_sold_14d]`  
```dax
SUM ( 'fact_sd_advertised_products'[advertised_sku_units_sold_14d])
```

#### `u_ppc_sd_adv_prod_units_sold_other_sku`

**Depende de colunas:** `'fact_sd_advertised_products'[other_sku_units_sold_14d]`  
```dax
SUM ( 'fact_sd_advertised_products'[other_sku_units_sold_14d])
```

#### `u_ppc_sd_adv_prod_units_sold`

**Depende de medidas:** `[u_ppc_sd_adv_prod_units_sold_advertised_sku]`, `[u_ppc_sd_adv_prod_units_sold_other_sku]`  
```dax
[u_ppc_sd_adv_prod_units_sold_advertised_sku] +
[u_ppc_sd_adv_prod_units_sold_other_sku]
```


### PPC\PPC - Reports Data\SP - Adv. Prod.

#### `$_ppc_sp_adv_prod_sales_advertised_sku`

**Depende de colunas:** `'fact_sp_advertised_products'[advertised_sku_sales_7d]`  
```dax
// Calculates the sum of the Advertised SKU sales, considering both the Context and Report filters.

SUM ( 'fact_sp_advertised_products'[advertised_sku_sales_7d] )
```

#### `u_ppc_sp_adv_prod_units_sold_advertised_sku`

**Depende de colunas:** `'fact_sp_advertised_products'[advertised_sku_units_sold_7d]`  
```dax
SUM ( 'fact_sp_advertised_products'[advertised_sku_units_sold_7d] )
```

#### `$_ppc_sp_adv_prod_sales_other_sku`

**Depende de colunas:** `'fact_sp_advertised_products'[other_sku_sales_7d]`  
```dax
// Calculates the sum of the Other SKU sales than the one advertised, considering both the Context and Report filters.

SUM ( 'fact_sp_advertised_products'[other_sku_sales_7d] )
```

#### `u_ppc_sp_adv_prod_units_sold_other_sku`

**Depende de colunas:** `'fact_sp_advertised_products'[other_sku_units_sold_7d]`  
```dax
// Calculates the PPC Other SKU Units sold than the one advertised, considering both the Context and Report filters.

SUM ( 'fact_sp_advertised_products'[other_sku_units_sold_7d] )
```

#### `q_ppc_sp_adv_prod_clicks`

**Depende de colunas:** `'fact_sp_advertised_products'[Clicks]`  
```dax
SUM ( 'fact_sp_advertised_products'[Clicks] )
```

#### `$_ppc_sp_adv_prod_sales`

**Depende de medidas:** `[$_ppc_sp_adv_prod_sales_advertised_sku]`, `[$_ppc_sp_adv_prod_sales_other_sku]`  
```dax
// Calculates the sum of the Sponsored Product Total Sales by adding the Advertised SKU Sales to Other SKU Sales, considering both the Context and Report filters.

[$_ppc_sp_adv_prod_sales_advertised_sku] 
    + [$_ppc_sp_adv_prod_sales_other_sku]
```

#### `u_ppc_sp_adv_prod_units_sold`

**Depende de medidas:** `[u_ppc_sp_adv_prod_units_sold_advertised_sku]`, `[u_ppc_sp_adv_prod_units_sold_other_sku]`  
```dax
[u_ppc_sp_adv_prod_units_sold_advertised_sku]
    + [u_ppc_sp_adv_prod_units_sold_other_sku]
```

#### `q_ppc_sp_adv_prod_orders`

**Depende de colunas:** `'f.SPAdvertisedProducts'[total_orders_7d]`, `'fact_sp_advertised_products'[advertised_sku_orders_7d]`, `'fact_sp_advertised_products'[other_sku_orders_7d]`  
```dax
// Calculates the PPC Orders, considering both the Context and Report filters.
    
    //SUM ( 'f.SPAdvertisedProducts'[total_orders_7d] )


SUM('fact_sp_advertised_products'[advertised_sku_orders_7d])
+ SUM('fact_sp_advertised_products'[other_sku_orders_7d])
```

#### `%_ppc_sp_adv_prod_cvr`

**Depende de medidas:** `[q_ppc_sp_adv_prod_clicks]`, `[q_ppc_sp_adv_prod_orders]`  
```dax
DIVIDE(
    [q_ppc_sp_adv_prod_orders]
    , [q_ppc_sp_adv_prod_clicks]
)
```

#### `q_ppc_sp_adv_prod_impressions`

**Depende de colunas:** `'fact_sp_advertised_products'[Impressions]`  
```dax
// Calculates the PPC Impressions, considering both the Context and Report filters.

SUM ( 'fact_sp_advertised_products'[Impressions] )
```

#### `%_ppc_sp_adv_prod_ctr`

**Depende de medidas:** `[q_ppc_sp_adv_prod_clicks]`, `[q_ppc_sp_adv_prod_impressions]`  
```dax
// Calculates the click-through rate by dividing Total PPC Clicks by Total PPC Impression, considering both the Context and Report filters.

DIVIDE(
    [q_ppc_sp_adv_prod_clicks]
    , [q_ppc_sp_adv_prod_impressions]
)
```

#### `$_ppc_sp_adv_prod_spend`

**Depende de colunas:** `'fact_sp_advertised_products'[Spend]`  
```dax
// Calculates de PPC Spend, considering both the Context and Report filters.

SUM ( 'fact_sp_advertised_products'[Spend] )
```

#### `$_ppc_sp_adv_prod_cpc`

**Depende de medidas:** `[$_ppc_sp_adv_prod_spend]`, `[q_ppc_sp_adv_prod_clicks]`  
```dax
DIVIDE(
    [$_ppc_sp_adv_prod_spend]
    , [q_ppc_sp_adv_prod_clicks]
)
```

#### `%_ppc_sp_adv_prod_acos`

**Depende de medidas:** `[$_ppc_sp_adv_prod_sales]`, `[$_ppc_sp_adv_prod_spend]`  
```dax
DIVIDE(
    [$_ppc_sp_adv_prod_spend]
    , [$_ppc_sp_adv_prod_sales]
)
```

#### `%_ppc_sp_adv_prod_roas`

**Depende de medidas:** `[$_ppc_sp_adv_prod_sales]`, `[$_ppc_sp_adv_prod_spend]`  
```dax
// Calculate the PPC Return on Advertisement Spend (AKA: ROAS) by dividing the PPC Sales by PPC Spend, considering both the Context and Report filters.

DIVIDE(
    [$_ppc_sp_adv_prod_sales]
    , [$_ppc_sp_adv_prod_spend]
)
```

#### `%_ppc_sp_adv_prod_tacos`

**Depende de medidas:** `[$_net_revenue]`, `[$_ppc_sp_adv_prod_spend]`  
```dax
ROUND(DIVIDE(
    [$_ppc_sp_adv_prod_spend]
    , [$_net_revenue]
),4)
```

#### `%_ppc_sp_adv_prod_ratio_revenue`

**Depende de medidas:** `[$_ppc_sp_adv_prod_sales]`, `[$_revenue]`  
```dax
DIVIDE (
    [$_ppc_sp_adv_prod_sales]
    , [$_revenue]
)
```

#### `q_sp_adv_prod_campaigns`

**Depende de colunas:** `fact_sp_advertised_products[campaign_name]`, `fact_sp_advertised_products[key_marketplace_advertised_sku]`  
```dax
VAR sku =
    SELECTEDVALUE ( fact_sp_advertised_products[key_marketplace_advertised_sku] )
RETURN
    CALCULATE (
        DISTINCTCOUNT ( fact_sp_advertised_products[campaign_name] ),
        FILTER (
            ALL ( fact_sp_advertised_products ),
            fact_sp_advertised_products[key_marketplace_advertised_sku] = sku
    )
)
```

#### `q_sp_adv_prod_ad_group`

**Depende de colunas:** `fact_sp_advertised_products[ad_group_name]`, `fact_sp_advertised_products[date_sp_advertised_products]`, `fact_sp_advertised_products[key_marketplace_advertised_sku]`  
```dax
VAR sku =
    SELECTEDVALUE ( fact_sp_advertised_products[key_marketplace_advertised_sku] )
    
VAR last_date_ = MAX(fact_sp_advertised_products[date_sp_advertised_products])
RETURN
    CALCULATE (
        DISTINCTCOUNT ( fact_sp_advertised_products[ad_group_name] ),
        FILTER (
            ALL ( fact_sp_advertised_products ),
            fact_sp_advertised_products[key_marketplace_advertised_sku] = sku
            && fact_sp_advertised_products[date_sp_advertised_products] = last_date_
    )
)
```


### Pricing

#### `$_base_price`

**Depende de colunas:** `'Calendar'[Date]`, `f_db_base_price[base_price]`  
```dax
CALCULATE(
    LASTNONBLANKVALUE( f_db_base_price[base_price], MAX(f_db_base_price[base_price])),
    'Calendar'[Date] <= MAX('Calendar'[Date])
)
```

#### `$_market_price`

**Depende de colunas:** `'Calendar'[Date]`, `f_db_market_price[market_price]`  
```dax
CALCULATE(
    LASTNONBLANKVALUE ( f_db_market_price[market_price], MAX ( f_db_market_price[market_price] ) ),
    'Calendar'[Date] <= MAX('Calendar'[Date])
)
```

#### `$_promo_price`

**Depende de colunas:** `'Calendar'[Date]`, `f_db_market_price[promo_price]`  
```dax
CALCULATE(
    LASTNONBLANKVALUE ( f_db_market_price[promo_price], MAX ( f_db_market_price[promo_price] ) ),
    'Calendar'[Date] <= MAX('Calendar'[Date])
)
```

#### `$_market_loss_leader`

**Depende de colunas:** `'Calendar'[Date]`, `f_db_market_price[loss_leader]`  
```dax
CALCULATE(
    LASTNONBLANKVALUE ( f_db_market_price[loss_leader], MAX ( f_db_market_price[loss_leader] ) ),
    'Calendar'[Date] <= MAX('Calendar'[Date])
)
```

#### `i_has_promo_week`

**Depende de colunas:** `'Calendar'[End of Week]`, `'Calendar'[Start of Week]`, `f_aux_promo_tracker[Category]`, `f_aux_promo_tracker[activeDate]`  
```dax
VAR StartOfWeek = MAX('Calendar'[Start of Week])
VAR EndOfWeek = MAX('Calendar'[End of Week])
RETURN
    COUNTROWS(
        FILTER(
            'f_aux_promo_tracker',
            f_aux_promo_tracker[Category] = "Promo" &&
            f_aux_promo_tracker[activeDate] >= StartOfWeek &&
            f_aux_promo_tracker[activeDate] <= EndOfWeek
        )
    ) > 0
```

#### `i_is_loss_leader`

**Depende de colunas:** `'Calendar'[End of Week]`, `'Calendar'[Start of Week]`, `f_db_loss_leader[activeDate]`  
```dax
VAR StartOfWeek = MAX('Calendar'[Start of Week])
VAR EndOfWeek = MAX('Calendar'[End of Week])
RETURN
    COUNTROWS(
        FILTER(
            'f_db_loss_leader',
            f_db_loss_leader[activeDate] >= StartOfWeek &&
            f_db_loss_leader[activeDate] <= EndOfWeek
        )
    ) > 0
```


### Returns

#### `u_total_fba_returns`

**Depende de colunas:** `'f.FBACustomerReturns'[quantity]`  
```dax
SUM ( 'f.FBACustomerReturns'[quantity] )
```

#### `%_total_fba_returns`

**Depende de medidas:** `[u_total_fba_returns]`, `[u_units_sold]`  
```dax
DIVIDE (
    [u_total_fba_returns]
    , [u_units_sold]
)
```

#### `%_total_fba_returns_sellable`

**Depende de medidas:** `[u_total_fba_returns]`  
**Depende de colunas:** `'f.FBACustomerReturns'[is_sellable]`, `'f.FBACustomerReturns'[quantity]`  
```dax
VAR _allReturns = [u_total_fba_returns]

    VAR _sellableReturns = 
        CALCULATE(
            SUM('f.FBACustomerReturns'[quantity])
            , 'f.FBACustomerReturns'[is_sellable] = "Sellable"    
        )

    VAR _share = DIVIDE ( _sellableReturns, _allReturns, 0 )

RETURN
    _share
```

#### `u_units_shipped`

**Depende de colunas:** `'f.AmazonFulfilledShipments'[key_marketplace_sku]`, `'f.AmazonFulfilledShipments'[shipped_quantity]`  
```dax
CALCULATE(
    SUM ( 'f.AmazonFulfilledShipments'[shipped_quantity] )
    , FILTER(
        'f.AmazonFulfilledShipments'
        , NOT(CONTAINSSTRING('f.AmazonFulfilledShipments'[key_marketplace_sku], "Non-Amazon"))
    )
)
```

#### `u_mapped_return_units`

**Depende de colunas:** `'f.FBACustomerReturns'[date_fba_customer_return]`, `'f.FBACustomerReturns'[purchase_date]`, `'f.FBACustomerReturns'[quantity]`  
```dax
// Soma unidades devolvidas cuja compra (purchase_date) está no
// contexto filtrado e cuja devolução ocorreu em ate 60 dias.
// Janela definida empiricamente em 2026-05-07: cobre 98% das
// devolucoes nos ultimos 18-24 meses (BQ analysis).

SUMX(
    FILTER(
        'f.FBACustomerReturns',
        NOT ISBLANK('f.FBACustomerReturns'[date_fba_customer_return])
        && DATEDIFF(
            'f.FBACustomerReturns'[purchase_date],
            'f.FBACustomerReturns'[date_fba_customer_return],
            DAY
        ) <= 60
    ),
    'f.FBACustomerReturns'[quantity]
)
```

#### `%_mapped_return_rate`

**Depende de medidas:** `[u_mapped_return_units]`, `[u_units_shipped]`  
```dax
DIVIDE (
    [u_mapped_return_units]
    , [u_units_shipped]
)
```

#### `processing fee 1`

**Depende de colunas:** `'Calendar'[Date]`, `'Returns for Amazon Statistics'[Returned Quantity]`, `'Returns for Amazon Statistics'[Shipment Date]`, `'Returns for Amazon Statistics'[date_fba_customer_return]`, `'f.FBACustomerReturns'[purchase_date]`, `'f.FBACustomerReturns'[quantity]`  
```dax
// VAR _lastDate = DATEADD(ENDOFMONTH('Returns for Amazon Statistics'[Shipment Date]),2,MONTH)

    // VAR x =
    //     CALCULATE(
    //         SUM ( 'Returns for Amazon Statistics'[Returned Quantity] )
    //         , FILTER(
    //             'Returns for Amazon Statistics'
    //             , 'Returns for Amazon Statistics'[date_fba_customer_return] >= STARTOFMONTH('Returns for Amazon Statistics'[Shipment Date])
    //                 && 'Returns for Amazon Statistics'[date_fba_customer_return] <= _lastDate
    //         )
    //     )

    VAR _startDate = MIN ( 'f.FBACustomerReturns'[purchase_date] )
    VAR _endDate = CALCULATE( MAX('Calendar'[Date]), DATEADD('Calendar'[Date], 2, MONTH ) )


RETURN
    CALCULATE(
        SUM ( 'f.FBACustomerReturns'[quantity] )
        ,FILTER(
            'Calendar'
            , 'Calendar'[Date] >= _startDate && 'Calendar'[Date] <=_endDate
        )
    )
```

#### `processing fee 4`

**Depende de colunas:** `'Calendar'[Date]`, `'f.FBACustomerReturns'[date_fba_customer_return]`, `'f.FBACustomerReturns'[purchase_date]`, `'f.FBACustomerReturns'[quantity]`, `'f.FBACustomerReturns'[status]`  
```dax
CALCULATE(
    SUMX(
        'f.FBACustomerReturns',
        VAR _orderDate = 'f.FBACustomerReturns'[purchase_date]
        VAR _endDate = EOMONTH(_orderDate, 2)
        RETURN
            CALCULATE(
                SUM('f.FBACustomerReturns'[quantity])
                , DATESINPERIOD('Calendar'[Date], _endDate, -3, MONTH)
                , 'f.FBACustomerReturns'[status] IN {"Unit returned to inventory"}
            )
    )
    , USERELATIONSHIP('Calendar'[Date], 'f.FBACustomerReturns'[date_fba_customer_return])
)
```

#### `u_unmapped_return_units`

**Depende de colunas:** `'f.FBACustomerReturns'[quantity]`  
```dax
VAR _result= 
    CALCULATE(
        SUM('f.FBACustomerReturns'[quantity])
    )
RETURN
    _result
```

#### `u_return_units`

**Depende de colunas:** `'Calendar'[Date]`, `'f.FBACustomerReturns'[date_fba_customer_return]`, `'f.FBACustomerReturns'[quantity]`  
```dax
CALCULATE(
    SUM('f.FBACustomerReturns'[quantity])
    , USERELATIONSHIP('Calendar'[Date],'f.FBACustomerReturns'[date_fba_customer_return])
)
```

#### `%_returns_quality_share`

**Depende de medidas:** `[u_mapped_return_units]`  
**Depende de colunas:** `'f.FBACustomerReturns'[Return Reason Group]`  
```dax
VAR _qty_quality =
    CALCULATE (
        [u_mapped_return_units],
        'f.FBACustomerReturns'[Return Reason Group] = "Product Quality"
    )
VAR _qty_total = [u_mapped_return_units]
RETURN
    DIVIDE ( _qty_quality, _qty_total )
```


### Returns\Beta

#### `d_order_date`

**Depende de colunas:** `'f.AllOrders'[date_all_orders]`  
```dax
MAX('f.AllOrders'[date_all_orders])
```

#### `d_returns_return_date`

**Depende de colunas:** `'f.FBACustomerReturns'[date_fba_customer_return]`  
```dax
MAX('f.FBACustomerReturns'[date_fba_customer_return])
```

#### `diff_order_date_return_date`

**Depende de medidas:** `[d_order_date]`, `[d_returns_return_date]`  
```dax
DATEDIFF ( [d_order_date], [d_returns_return_date], DAY)
```


### SKUs General Info\AWD (Transportation Fee Report)

#### `i_awd_transportation_box_volume`

**Depende de colunas:** `'fact_awd_transportation_measurements'[box_volume]`, `'fact_awd_transportation_measurements'[month_of_charge]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_awd_transportation_measurements'
                , 'fact_awd_transportation_measurements'[month_of_charge] = MAX ( 'fact_awd_transportation_measurements'[month_of_charge] )
            )
            , 'fact_awd_transportation_measurements'[box_volume]
        )
        
RETURN
    _measurement
```

#### `i_awd_transportation_length_plus_girth`

**Depende de colunas:** `'fact_awd_transportation_measurements'[longest_side]`, `'fact_awd_transportation_measurements'[median_side]`, `'fact_awd_transportation_measurements'[month_of_charge]`, `'fact_awd_transportation_measurements'[shortest_side]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_awd_transportation_measurements'
                , 'fact_awd_transportation_measurements'[month_of_charge] = MAX ( 'fact_awd_transportation_measurements'[month_of_charge] )
            )
            , 'fact_awd_transportation_measurements'[longest_side] + ( 2 * ('fact_awd_transportation_measurements'[median_side] + 'fact_awd_transportation_measurements'[shortest_side]) )
        )

RETURN
    _measurement
```

#### `i_awd_transportation_longest_side`

**Depende de colunas:** `'fact_awd_transportation_measurements'[longest_side]`, `'fact_awd_transportation_measurements'[month_of_charge]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_awd_transportation_measurements'
                , 'fact_awd_transportation_measurements'[month_of_charge] = MAX ( 'fact_awd_transportation_measurements'[month_of_charge] )
            )
            , 'fact_awd_transportation_measurements'[longest_side]
        )

RETURN
    _measurement
```

#### `i_awd_transportation_median_side`

**Depende de colunas:** `'fact_awd_transportation_measurements'[median_side]`, `'fact_awd_transportation_measurements'[month_of_charge]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_awd_transportation_measurements'
                , 'fact_awd_transportation_measurements'[month_of_charge] = MAX ( 'fact_awd_transportation_measurements'[month_of_charge] )
            )
            , 'fact_awd_transportation_measurements'[median_side]
        )

RETURN
    _measurement
```

#### `i_awd_transportation_shortest_side`

**Depende de colunas:** `'fact_awd_transportation_measurements'[month_of_charge]`, `'fact_awd_transportation_measurements'[shortest_side]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_awd_transportation_measurements'
                , 'fact_awd_transportation_measurements'[month_of_charge] = MAX ( 'fact_awd_transportation_measurements'[month_of_charge] )
            )
            , 'fact_awd_transportation_measurements'[shortest_side]
        )

RETURN
    _measurement
```

#### `i_awd_transportation_unit_of_dimension`

**Depende de colunas:** `'fact_awd_transportation_measurements'[unit_of_dimension]`  
```dax
VAR _unitOfMeausurement =
        MAXX(
            'fact_awd_transportation_measurements'
            , 'fact_awd_transportation_measurements'[unit_of_dimension]
        )

RETURN
    _unitOfMeausurement
```

#### `i_awd_transportation_unit_of_volume`

**Depende de colunas:** `'fact_awd_transportation_measurements'[unit_of_volume]`  
```dax
VAR _unitOfVolume =
        MAXX(
            'fact_awd_transportation_measurements'
            , 'fact_awd_transportation_measurements'[unit_of_volume]
        )

RETURN
    _unitOfVolume
```


### SKUs General Info\Amazon (Fee Preview Report)

#### `i_amazon_fee_preview_longest_side`

**Depende de colunas:** `'fact_fee_preview'[longest_side]`  
```dax
VAR _measurement =
        AVERAGEX(
             'fact_fee_preview'
            , 'fact_fee_preview'[longest_side]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_median_side`

**Depende de colunas:** `'fact_fee_preview'[median_side]`  
```dax
VAR _measurement =
        AVERAGEX(
             'fact_fee_preview'
            , 'fact_fee_preview'[median_side]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_shortest_side`

**Depende de colunas:** `'fact_fee_preview'[shortest_side]`  
```dax
VAR _measurement =
        AVERAGEX(
             'fact_fee_preview'
            , 'fact_fee_preview'[shortest_side]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_length_plus_girth`

**Depende de colunas:** `'fact_fee_preview'[length_and_girth]`  
```dax
VAR _measurement =
        AVERAGEX(
             'fact_fee_preview'
            , 'fact_fee_preview'[length_and_girth]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_item_weight`

**Depende de colunas:** `'fact_fee_preview'[item_package_weight]`  
```dax
VAR _measurement =
        AVERAGEX(
             'fact_fee_preview'
            , 'fact_fee_preview'[item_package_weight]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_item_volume`

**Depende de colunas:** `'fact_fee_preview'[item_volume]`  
```dax
VAR _measurement =
        AVERAGEX(
             'fact_fee_preview'
            , 'fact_fee_preview'[item_volume]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_unit_of_measurement`

**Depende de colunas:** `'fact_fee_preview'[unit_of_dimension]`  
```dax
VAR _measurement =
        MAXX(
             'fact_fee_preview'
            , 'fact_fee_preview'[unit_of_dimension]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_unit_of_weight`

**Depende de colunas:** `'fact_fee_preview'[unit_of_weight]`  
```dax
VAR _measurement =
        MAXX(
             'fact_fee_preview'
            , 'fact_fee_preview'[unit_of_weight]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_unit_of_volume`

**Depende de colunas:** `'fact_fee_preview'[unit_of_volume]`  
```dax
VAR _measurement =
        MAXX(
             'fact_fee_preview'
            , 'fact_fee_preview'[unit_of_volume]
        )

RETURN
    _measurement
```

#### `i_amazon_fee_preview_item_volume_last_occurrence`

**Depende de medidas:** `[i_amazon_fee_preview_last_date]`  
**Depende de colunas:** `'Calendar'[Date]`, `'fact_fee_preview'[item_volume]`  
```dax
VAR _lastItemVolume = 
        CALCULATE( 
            MAX('fact_fee_preview'[item_volume]), 
            FILTER( 'Calendar', 'Calendar'[Date] = [i_amazon_fee_preview_last_date] ) 
        )

RETURN
    _lastItemVolume
```

#### `i_amazon_fee_preview_last_date`

**Depende de colunas:** `'Calendar'[is_future]`, `'fact_fee_preview'[date_fee_preview]`  
```dax
VAR _lastDate = 
        CALCULATE( 
            MAX('fact_fee_preview'[date_fee_preview]), 
            FILTER(ALL('Calendar'), 'Calendar'[is_future] = false ) 
        )

RETURN
    _lastDate
```

#### `i_amazon_fact_fee_preview_max_size_tier`

**Depende de colunas:** `fact_fee_preview[date_fee_preview]`, `fact_fee_preview[product_size_tier]`  
```dax
// Anteriormente o size tier era decidido pela tabela 'fact_fba_fee_expected'(cálculo nosso do fba fee devido. Optei por utilizar o que vem do report da Amazon.
    VAR _measurement =
        MAXX(
            FILTER(
                'fact_fee_preview'
                , fact_fee_preview[date_fee_preview] = MAX (fact_fee_preview[date_fee_preview])
            )
            , fact_fee_preview[product_size_tier]
        )

RETURN
    _measurement
```


### SKUs General Info\Amazon (Storage Fee Report)

#### `i_amazon_storage_fee_item_weight`

**Depende de colunas:** `'fact_storage_fee_measurements'[item_weight]`, `'fact_storage_fee_measurements'[month_of_charge]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_storage_fee_measurements'
                , 'fact_storage_fee_measurements'[month_of_charge] = MAX ( 'fact_storage_fee_measurements'[month_of_charge] )
            )
            , 'fact_storage_fee_measurements'[item_weight]
        )

RETURN
    _measurement
```

#### `i_amazon_storage_fee_unit_of_volume`

**Depende de colunas:** `'fact_storage_fee_measurements'[unit_of_volume]`  
```dax
VAR _unitOfVolume =
        MAXX(
            'fact_storage_fee_measurements'
            , 'fact_storage_fee_measurements'[unit_of_volume]
        )

RETURN
    _unitOfVolume
```

#### `i_amazon_storage_fee_longest_side`

**Depende de colunas:** `'fact_storage_fee_measurements'[month_of_charge]`, `'fact_storage_fee_measurements'[side_longest]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_storage_fee_measurements'
                , 'fact_storage_fee_measurements'[month_of_charge] = MAX ( 'fact_storage_fee_measurements'[month_of_charge] )
            )
            , 'fact_storage_fee_measurements'[side_longest]
        )

RETURN
    _measurement
```

#### `i_amazon_storage_fee_median_side`

**Depende de colunas:** `'fact_storage_fee_measurements'[month_of_charge]`, `'fact_storage_fee_measurements'[side_median]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_storage_fee_measurements'
                , 'fact_storage_fee_measurements'[month_of_charge] = MAX ( 'fact_storage_fee_measurements'[month_of_charge] )
            )
            , 'fact_storage_fee_measurements'[side_median]
        )

RETURN
    _measurement
```

#### `i_amazon_storage_fee_shortest_side`

**Depende de colunas:** `'fact_storage_fee_measurements'[month_of_charge]`, `'fact_storage_fee_measurements'[side_shortest]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_storage_fee_measurements'
                , 'fact_storage_fee_measurements'[month_of_charge] = MAX ( 'fact_storage_fee_measurements'[month_of_charge] )
            )
            , 'fact_storage_fee_measurements'[side_shortest]
        )

RETURN
    _measurement
```

#### `i_amazon_storage_fee_length_plus_girth`

**Depende de colunas:** `'fact_storage_fee_measurements'[month_of_charge]`, `'fact_storage_fee_measurements'[side_longest]`, `'fact_storage_fee_measurements'[side_median]`, `'fact_storage_fee_measurements'[side_shortest]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_storage_fee_measurements'
                , 'fact_storage_fee_measurements'[month_of_charge] = MAX ( 'fact_storage_fee_measurements'[month_of_charge] )
            )
            , 'fact_storage_fee_measurements'[side_longest] + ( 2 * ('fact_storage_fee_measurements'[side_median] + 'fact_storage_fee_measurements'[side_shortest]) )
        )

RETURN
    _measurement
```

#### `i_amazon_storage_fee_unit_of_measurement`

**Depende de colunas:** `'fact_storage_fee_measurements'[unit_of_measurement]`  
```dax
VAR _unitOfMeausurement =
        MAXX(
            'fact_storage_fee_measurements'
            , 'fact_storage_fee_measurements'[unit_of_measurement]
        )

RETURN
    _unitOfMeausurement
```

#### `i_amazon_storage_fee_unit_of_weight`

**Depende de colunas:** `'fact_storage_fee_measurements'[unit_of_weight]`  
```dax
VAR _unitOfWeight =
        MAXX(
            'fact_storage_fee_measurements'
            , 'fact_storage_fee_measurements'[unit_of_weight]
        )

RETURN
    _unitOfWeight
```

#### `i_amazon_storage_fee_item_volume`

**Depende de colunas:** `'fact_storage_fee_measurements'[item_volume]`, `'fact_storage_fee_measurements'[month_of_charge]`  
```dax
VAR _measurement =
        AVERAGEX(
            FILTER(
                'fact_storage_fee_measurements'
                , 'fact_storage_fee_measurements'[month_of_charge] = MAX ( 'fact_storage_fee_measurements'[month_of_charge] )
            )
            , 'fact_storage_fee_measurements'[item_volume]
        )

RETURN
    _measurement
```


### SKUs General Info\Carton (Normal)

#### `i_11Brands_carton_units_per_carton`

**Depende de colunas:** `SKUs[Units / Carton]`  
```dax
VAR _unitsPerCarton =
        MAXX(
            SKUs
            , SKUs[Units / Carton]
        )

RETURN
    _unitsPerCarton
```

#### `i_11Brands_carton_longest_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 1
    VAR _length    =  MAX ( SKUs[Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_carton_median_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 2
    VAR _length    =  MAX ( SKUs[Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_carton_shortest_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 3
    VAR _length    =  MAX ( SKUs[Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_carton_length_plus_girth_converted`

**Depende de medidas:** `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) width]`  
```dax
VAR _measurement = 
        MAXX ( 
            SKUs
            , SKUs[Carton Dimensions (cm) Length] + ( 2 * ( SKUs[Carton Dimensions (cm) width] + SKUs[Carton Dimensions (cm) Height] ) )
        )

RETURN
    SWITCH(
        TRUE()
        , [i_11Brands_unit_of_measurement] = "inches",      _measurement / 2.54
        , [i_11Brands_unit_of_measurement] = "centimeters", _measurement
    )
```

#### `i_11Brands_carton_volume_converted`

**Depende de medidas:** `[i_11Brands_carton_longest_side_converted]`, `[i_11Brands_carton_median_side_converted]`, `[i_11Brands_carton_shortest_side_converted]`, `[i_11Brands_unit_of_measurement]`  
```dax
VAR _longest   =  [i_11Brands_carton_longest_side_converted]
    VAR _median    =  [i_11Brands_carton_median_side_converted]
    VAR _shortest  =  [i_11Brands_carton_shortest_side_converted]
    VAR _volume    = _longest * _median *_shortest
    
    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _volume / 1728
            , [i_11Brands_unit_of_measurement] = "centimeters",  _volume / 1e+6
        )

RETURN
    _convertedValue
```

#### `i_11Brands_carton_weight`

**Depende de medidas:** `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Carton Weight (kg)]`  
```dax
VAR _weight = MAX ( SKUs[Carton Weight (kg)] )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",      _weight * 2.20462
            , [i_11Brands_unit_of_measurement] = "centimeters", _weight
        )

RETURN
    _convertedValue
```

#### `i_11Brands_carton_volume_cbm`

**Depende de medidas:** `[i_11Brands_carton_longest_side_cm]`, `[i_11Brands_carton_median_side_cm]`, `[i_11Brands_carton_shortest_side_cm]`  
```dax
VAR _longest   =  [i_11Brands_carton_longest_side_cm]
    VAR _median    =  [i_11Brands_carton_median_side_cm]
    VAR _shortest  =  [i_11Brands_carton_shortest_side_cm]
    VAR _volume    = _longest * _median *_shortest
    
    VAR _cbmValue = _volume / 1e+6

RETURN
    _cbmValue
```

#### `i_11Brands_carton_longest_side_cm`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 1
    VAR _length    =  MAX ( SKUs[Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `i_11Brands_carton_median_side_cm`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 2
    VAR _length    =  MAX ( SKUs[Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `i_11Brands_carton_shortest_side_cm`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[Carton Dimensions (cm) Height]`, `SKUs[Carton Dimensions (cm) Length]`, `SKUs[Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 3
    VAR _length    =  MAX ( SKUs[Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```


### SKUs General Info\Carton (for AWD)

#### `i_11Brands_awd_carton_units_per_carton`

**Depende de colunas:** `SKUs[AWD - Units / Carton]`  
```dax
VAR _unitsPerCarton =
        MAXX(
            SKUs
            , SKUs[AWD - Units / Carton]
        )

RETURN
    _unitsPerCarton
```

#### `i_11Brands_awd_carton_longest_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 1
    VAR _length    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[AWD - Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_awd_carton_median_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 2
    VAR _length    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[AWD - Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_awd_carton_shortest_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 3
    VAR _length    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[AWD - Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_awd_carton_length_plus_girth_converted`

**Depende de medidas:** `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) width]`  
```dax
VAR _measurement = 
        MAXX ( 
            SKUs
            , SKUs[AWD - Carton Dimensions (cm) Length] + ( 2 * ( SKUs[AWD - Carton Dimensions (cm) width] + SKUs[AWD - Carton Dimensions (cm) Height] ) )
        )

RETURN
    SWITCH(
        TRUE()
        , [i_11Brands_unit_of_measurement] = "inches",      _measurement / 2.54
        , [i_11Brands_unit_of_measurement] = "centimeters", _measurement
    )
```

#### `i_11Brands_awd_carton_volume_converted`

**Depende de medidas:** `[i_11Brands_awd_carton_longest_side_converted]`, `[i_11Brands_awd_carton_median_side_converted]`, `[i_11Brands_awd_carton_shortest_side_converted]`, `[i_11Brands_unit_of_measurement]`  
```dax
VAR _longest   =  [i_11Brands_awd_carton_longest_side_converted]
    VAR _median    =  [i_11Brands_awd_carton_median_side_converted]
    VAR _shortest  =  [i_11Brands_awd_carton_shortest_side_converted]
    VAR _volume    = _longest * _median *_shortest
    
    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _volume / 1728
            , [i_11Brands_unit_of_measurement] = "centimeters",  _volume / 1e+6
        )

RETURN
    _convertedValue
```

#### `i_11Brands_awd_carton_weight`

**Depende de medidas:** `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[AWD - Carton Weight (kg)]`  
```dax
VAR _weight = MAX ( SKUs[AWD - Carton Weight (kg)] )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",      _weight * 2.20462
            , [i_11Brands_unit_of_measurement] = "centimeters", _weight
        )

RETURN
    _convertedValue
```

#### `i_11Brands_awd_carton_volume_cbm`

**Depende de medidas:** `[i_11Brands_awd_carton_longest_side_cm]`, `[i_11Brands_awd_carton_median_side_cm]`, `[i_11Brands_awd_carton_shortest_side_cm]`  
```dax
VAR _longest   =  [i_11Brands_awd_carton_longest_side_cm]
    VAR _median    =  [i_11Brands_awd_carton_median_side_cm]
    VAR _shortest  =  [i_11Brands_awd_carton_shortest_side_cm]
    VAR _volume    = _longest * _median *_shortest
    
    VAR _cbmValue =  _volume / 1e+6

RETURN
    _cbmValue
```

#### `i_11Brands_awd_carton_longest_side_cm`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 1
    VAR _length    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[AWD - Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `i_11Brands_awd_carton_median_side_cm`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 2
    VAR _length    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[AWD - Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```

#### `i_11Brands_awd_carton_shortest_side_cm`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`  
**Depende de colunas:** `SKUs[AWD - Carton Dimensions (cm) Height]`, `SKUs[AWD - Carton Dimensions (cm) Length]`, `SKUs[AWD - Carton Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 3
    VAR _length    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[AWD - Carton Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[AWD - Carton Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

RETURN
    _sideValue
```


### SKUs General Info\General info

#### `$_amazon_all_listings_current_price`

**Depende de colunas:** `SKUs[current_price]`  
```dax
VAR _currentPrice =
        MAXX(
            SKUs
            , SKUs[current_price]
        )

RETURN
    _currentPrice
```

#### `i_11Brands_life_cycle`

**Depende de medidas:** `[LatestDate]`, `[Life Cycle]`  
**Depende de colunas:** `'Calendar'[Date]`, `'fact_life_cycle'[date_life_cycle]`, `'fact_life_cycle'[key_inventory_region_sku]`, `'fact_life_cycle'[life_cycle]`  
```dax
-- Priority order: U > N > M > T > P > D > c

    VAR _context_Date = MIN ( MAX ( 'Calendar'[Date] ), TODAY() )
    VAR _life_cicle_up_to_date = FILTER ( ALL('fact_life_cycle'), 'fact_life_cycle'[date_life_cycle] <= _context_Date )
    VAR _latest_date_per_sku =
        SUMMARIZE (
            _life_cicle_up_to_date,
            'fact_life_cycle'[key_inventory_region_sku],
            "LatestDate", MAX ( 'fact_life_cycle'[date_life_cycle] )
        )

    VAR _latest_life_cycle_per_sku =
        ADDCOLUMNS(
            _latest_date_per_sku,
            "Life Cycle",
                VAR _sku = 'fact_life_cycle'[key_inventory_region_sku]
                VAR _date = [LatestDate]
                RETURN
                    CALCULATE(
                        SELECTEDVALUE('fact_life_cycle'[life_cycle]),
                        FILTER(
                            ALL('fact_life_cycle'),
                            'fact_life_cycle'[key_inventory_region_sku] = _sku
                                && 'fact_life_cycle'[date_life_cycle] = _date
                        )
                    )
        )

RETURN
    MAXX(_latest_life_cycle_per_sku, [Life Cycle])
```

#### `i_11Brands_abc_classification`

**Depende de colunas:** `SKUs[Final ABC Classification]`  
```dax
VAR _abcClassification =
        MAXX(
            SKUs
            , SKUs[Final ABC Classification]
        )

RETURN
    _abcClassification
```

#### `i_11Brands_unit_of_measurement`

**Depende de colunas:** `'SKUs'[Inventory Region]`  
```dax
VAR _inventoryRegion = MAXX ( 'SKUs', 'SKUs'[Inventory Region] )
    VAR _unitOfMeausurement =     
        SWITCH(
            TRUE()
            , _inventoryRegion = "US", "inches"
            , "centimeters"
        )

RETURN
    _unitOfMeausurement
```

#### `i_11Brands_unit_of_volume`

**Depende de colunas:** `'SKUs'[Inventory Region]`  
```dax
VAR _inventoryRegion = MAXX ( 'SKUs', 'SKUs'[Inventory Region] )
    VAR _unitOfVolume =     
        SWITCH(
            TRUE()
            , _inventoryRegion = "US" ||  _inventoryRegion = "GB", "cubic feet"
            , "cubic meters"
        )

RETURN
    _unitOfVolume
```

#### `i_11Brands_unit_of_weight`

**Depende de colunas:** `'SKUs'[Inventory Region]`  
```dax
VAR _inventoryRegion = MAXX ( 'SKUs', 'SKUs'[Inventory Region] )
    VAR _unitOfWeight =     
        SWITCH(
            TRUE()
            , _inventoryRegion = "US", "pounds"
            , "grams"
        )

RETURN
    _unitOfWeight
```

#### `%_current_price_discount`

**Depende de medidas:** `[$_amazon_all_listings_current_price]`, `[$_base_price]`  
```dax
DIVIDE([$_amazon_all_listings_current_price],[$_base_price])-1
```

#### `%_commercial_margin`

**Depende de medidas:** `[$_amazon_all_listings_current_price]`, `[$_unit_landed_cost]`, `[$_unit_last_fba_fee_fee_preview]`  
```dax
IF ([$_unit_last_fba_fee_fee_preview] > 0
    , DIVIDE(
        (
            [$_amazon_all_listings_current_price] * 0.85 // 15% Selling Fee
            - [$_unit_last_fba_fee_fee_preview]
            - [$_unit_landed_cost]
        )
        , [$_amazon_all_listings_current_price]
    )
    , BLANK()
)
```

#### `i_11Brands_abc_sales`

**Depende de colunas:** `SKUs[ABC Sales]`  
```dax
VAR _abc_sales =
        MAXX(
            SKUs
            , SKUs[ABC Sales]
        )

RETURN
    // _abc_sales

    CALCULATE(
        MAX(SKUs[ABC Sales])
        , ALL('Calendar')
    )
```


### SKUs General Info\Package (Item)

#### `i_11Brands_package_longest_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 1
    VAR _length    =  MAX ( SKUs[Package Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Package Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Package Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_package_median_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 2
    VAR _length    =  MAX ( SKUs[Package Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Package Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Package Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_package_shortest_side_converted`

**Depende de medidas:** `[Dimension]`, `[Rank]`, `[TieBreaker]`, `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) Width]`  
```dax
VAR _sideRank  = 3
    VAR _length    =  MAX ( SKUs[Package Dimensions (cm) Length] )
    VAR _width     =  MAX ( SKUs[Package Dimensions (cm) Width] )
    VAR _height    =  MAX ( SKUs[Package Dimensions (cm) Height] )
    
    VAR _allDimensions    =  
        UNION(
            ROW ( "Dimension", _length,  "TieBreaker", 1 ), 
            ROW ( "Dimension", _width,   "TieBreaker", 2  ), 
            ROW ( "Dimension", _height,  "TieBreaker", 3 )
        )

    VAR _rankedValues =
        ADDCOLUMNS (
            _allDimensions
            , "Rank", RANKX ( _allDimensions, [Dimension] + [TieBreaker] * 0.00001, , DESC, Dense )
        )

    VAR _sideValue =
        MAXX (
            FILTER ( _rankedValues, [Rank] = _sideRank )
            , [Dimension]
        )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",       _sideValue / 2.54
            , [i_11Brands_unit_of_measurement] = "centimeters",  _sideValue
        )

RETURN
    _convertedValue
```

#### `i_11Brands_package_length_plus_girth_converted`

**Depende de medidas:** `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Package Dimensions (cm) Height]`, `SKUs[Package Dimensions (cm) Length]`, `SKUs[Package Dimensions (cm) width]`  
```dax
VAR _measurement = 
        MAXX ( 
            SKUs
            , SKUs[Package Dimensions (cm) Length] + ( 2 * ( SKUs[Package Dimensions (cm) width] + SKUs[Package Dimensions (cm) Height] ) )
        )

RETURN
    SWITCH(
        TRUE()
        , [i_11Brands_unit_of_measurement] = "inches",      _measurement / 2.54
        , [i_11Brands_unit_of_measurement] = "centimeters", _measurement
    )
```

#### `i_11Brands_package_weight`

**Depende de medidas:** `[i_11Brands_unit_of_measurement]`  
**Depende de colunas:** `SKUs[Package Weight (kg)]`  
```dax
VAR _weight = MAX ( SKUs[Package Weight (kg)] )

    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_measurement] = "inches",      (_weight * 2.20462)
            , [i_11Brands_unit_of_measurement] = "centimeters", _weight * 1000
        )

RETURN
    _convertedValue
```

#### `i_11Brands_package_volume_converted`

**Depende de medidas:** `[i_11Brands_package_longest_side_converted]`, `[i_11Brands_package_median_side_converted]`, `[i_11Brands_package_shortest_side_converted]`, `[i_11Brands_unit_of_volume]`  
```dax
VAR _longest   =  [i_11Brands_package_longest_side_converted]
    VAR _median    =  [i_11Brands_package_median_side_converted]
    VAR _shortest  =  [i_11Brands_package_shortest_side_converted]
    VAR _volume    = _longest * _median *_shortest
    
    VAR _convertedValue =
        SWITCH(
            TRUE()
            , [i_11Brands_unit_of_volume] = "cubic feet",       _volume / 1728
            , [i_11Brands_unit_of_volume] = "cubic meters",  _volume / 1e+6
        )

RETURN
    _convertedValue
```

#### `i_11Brands_us_shipping_weight`

**Depende de medidas:** `[i_amazon_fact_fee_preview_max_size_tier]`, `[i_amazon_storage_fee_item_weight]`, `[i_amazon_storage_fee_longest_side]`, `[i_amazon_storage_fee_median_side]`, `[i_amazon_storage_fee_shortest_side]`  
**Depende de colunas:** `SKUs[Sales Region]`  
```dax
VAR SalesRegion = SELECTEDVALUE(SKUs[Sales Region])

VAR DimensionalWeightUS = (
    [i_amazon_storage_fee_shortest_side] * 
    [i_amazon_storage_fee_median_side] *
    [i_amazon_storage_fee_longest_side]
) / 139

VAR ItemWeight = [i_amazon_storage_fee_item_weight]
VAR SizeTier = [i_amazon_fact_fee_preview_max_size_tier]

VAR ShippingWeightUS =
IF(
    SEARCH("Large", SizeTier, 1, 0) > 0 && ItemWeight <= 150,
    IF(
        DimensionalWeightUS > ItemWeight,
        DimensionalWeightUS,
        ItemWeight
    ),
    ItemWeight
)

RETURN
SWITCH(
    TRUE(),
    SalesRegion = "US", ShippingWeightUS,
    BLANK()
)
```


### Sales (All Orders)\Sales

#### `u_units_sold`

**Depende de colunas:** `'f.AllOrders'[key_marketplace_sku]`, `'f.AllOrders'[quantity]`  
```dax
// Sums all the Quantity sold in units. Context and Report filters are applied.

CALCULATE(
    SUM ( 'f.AllOrders'[quantity] )
    , FILTER(
        'f.AllOrders'
        , NOT(CONTAINSSTRING('f.AllOrders'[key_marketplace_sku], "Non-Amazon"))
    )
)
```

#### `$_revenue`

**Depende de colunas:** `'f.AllOrders'[item_price]`  
```dax
SUM ( 'f.AllOrders'[item_price] )
```

#### `$_average_price`

**Depende de medidas:** `[$_revenue]`, `[u_units_sold]`  
```dax
// Returns the average price per unit sold in local currency by diving the total revenue by units sold. Context and Report filters are applied.

DIVIDE ( [$_revenue], [u_units_sold], 0 )
```

#### `$_item_promotion_discount`

**Depende de colunas:** `'f.AllOrders'[item_promotion_discount]`  
```dax
SUM ( 'f.AllOrders'[item_promotion_discount] )
```

#### `%_discount`

**Depende de medidas:** `[$_item_promotion_discount]`, `[$_revenue]`  
```dax
// Retrieves the discount percentage by dividing the item promotion discount by the total revenue. Context and Report filters are applied.

DIVIDE ( [$_item_promotion_discount], [$_revenue], 0 )
```

#### `$_net_average_price`

**Depende de medidas:** `[$_net_revenue]`, `[u_units_sold]`  
```dax
// Returns the net average price per unit sold in local currency by diving the total revenue subtracting the item promotions by units sold. Context and Report filters are applied.

DIVIDE (
    [$_net_revenue]
    , [u_units_sold]    
)
```

#### `$_net_revenue`

**Depende de medidas:** `[$_item_promotion_discount]`, `[$_revenue]`  
```dax
[$_revenue] - [$_item_promotion_discount]
```

#### `$_organic_revenue`

**Depende de medidas:** `[$_ppc_sales]`, `[$_revenue]`  
```dax
VAR _diff = [$_revenue] - [$_ppc_sales]

RETURN
    IF(_diff <0, 0, _diff)
```

#### `u_organic_units_sold`

**Depende de medidas:** `[u_ppc_units_sold]`, `[u_units_sold]`  
```dax
VAR _diff = [u_units_sold] - [u_ppc_units_sold]

RETURN
    IF(_diff <0, 0, _diff)
```

#### `u_monthly_units_sold`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`, `SKUs[Amazon Family]`, `SKUs[Country]`, `SKUs[Sales Region | Base SKU]`, `SKUs[Sales Region]`  
```dax
VAR _result = 
        CALCULATE (
            [u_units_sold]
            , ALLEXCEPT ( SKUs, SKUs[Sales Region], SKUs[Amazon Family], SKUs[Sales Region | Base SKU] )
            , DATESBETWEEN ( 'Calendar'[Date], STARTOFMONTH('Calendar'[Date]), ENDOFMONTH('Calendar'[Date]))       
            , CROSSFILTER ('Calendar'[Date], 'z.dynamic_time_frame_switch'[Start Date], OneWay_LeftFiltersRight)
        )

return
    CALCULATE (
    [u_units_sold],
    ALLSELECTED (
        //SKUs[Sales Region],
        SKUs[Country],
        SKUs[Amazon Family],
        SKUs[Sales Region | Base SKU]
    ),
    DATESBETWEEN (
        'Calendar'[Date],
        STARTOFMONTH('Calendar'[Date]),
        ENDOFMONTH('Calendar'[Date])
    ),
    CROSSFILTER ('Calendar'[Date], 'z.dynamic_time_frame_switch'[Start Date], OneWay_LeftFiltersRight)
)
```

#### `u_units_sold_previous_two_weeks`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAX('Calendar'[Date])
    VAR _firstDayOfWeek = _date - WEEKDAY( _date, 1) + 1
    VAR _periodLastDay = _firstDayOfWeek - 1
    VAR _periodFirstDay = _periodLastDay - 14 + 1
// Concatenation for checking purposes
    // VAR _concatenation = FORMAT(_periodFirstDay, "YYYY-MMM-DD") & " || " & FORMAT(_periodLastDay, "YYYY-MMM-DD")

    VAR _unitsSoldLasttwoWeeks=
        SUMX (
            DATESINPERIOD('Calendar'[Date], _periodLastDay, -14, DAY )
            , [u_units_sold]
        )

RETURN
_unitsSoldLasttwoWeeks
```

#### `u_real_velocity_previous_two_weeks`

**Depende de medidas:** `[u_units_sold_previous_two_weeks]`  
```dax
VAR _realVelocityPreviousTwoWeeks = 
        DIVIDE (
            [u_units_sold_previous_two_weeks]
            , 14
        )
    
RETURN
    _realVelocityPreviousTwoWeeks
```

#### `$_net_revenue_promotion_tax`

**Depende de medidas:** `[$_item_promotion_discount]`, `[$_revenue]`, `[$_tax_within_price]`  
```dax
[$_revenue] -  [$_item_promotion_discount] - [$_tax_within_price]
```

#### `$_tax_within_price`

**Depende de colunas:** `'f.AllOrders'[tax_within_price]`  
```dax
SUM ( 'f.AllOrders'[tax_within_price] )
```

#### `u_average_units_sold_previous_21_days`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _timeFrame = 21
    
    // get the last date or today, if date is in the future
    VAR _maxDateInData = MAX( 'Calendar'[Date] )
    VAR _lastDate = IF( _maxDateInData < TODAY(), _maxDateInData, TODAY() )

    // compute start/end dates and build a table of those dates
    VAR _startDate = _lastDate - _timeFrame
    VAR _endDate   = _lastDate - 1
    VAR _datesBetween = DATESBETWEEN( 'Calendar'[Date], _startDate, _endDate)

    // sum your units across that 21-day window
    VAR _totalUnits = CALCULATE( [u_units_sold], _datesBetween )
        
RETURN DIVIDE( _totalUnits, _timeFrame )
```

#### `u_average_units_sold_previous_30_days`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _timeFrame = 30
    VAR _lastDate = LASTDATE('Calendar'[Date])
    VAR _datesBetween =
        DATESBETWEEN(
            'Calendar'[Date],
            DATEADD(_lastDate, - _timeFrame, DAY),
            DATEADD(_lastDate, - 1, DAY)
        )

    VAR _rollingAverage =
        AVERAGEX(
            _datesBetween
            , [u_units_sold]
        )
        
RETURN
    _rollingAverage
```

#### `$_ship_promotion_discount`

**Depende de colunas:** `'f.AllOrders'[ship_promotion_discount]`  
```dax
SUM ( 'f.AllOrders'[ship_promotion_discount] )
```

#### `$_item_plus_ship_promotion_discount`

**Depende de medidas:** `[$_item_promotion_discount]`, `[$_ship_promotion_discount]`  
```dax
VAR _result = [$_item_promotion_discount] + [$_ship_promotion_discount]
RETURN
    _result
```

#### `$_operational_profit`

**Depende de medidas:** `[$_awd_storage_fee]`, `[$_cogs]`, `[$_estimated_storage_fee]`, `[$_net_revenue_promotion_tax]`, `[$_ppc_spend]`, `[$_referral_fee]`, `[$_total_fba_fee_fee_preview]`  
```dax
VAR _profit = (
        [$_net_revenue_promotion_tax] 
        - [$_cogs] 
        - [$_total_fba_fee_fee_preview] 
        - [$_referral_fee] 
        - [$_ppc_spend] 
        - [$_estimated_storage_fee]
        - [$_awd_storage_fee]
    )

RETURN
    _profit
```

#### `$_commercial_profit`

**Depende de medidas:** `[$_cogs]`, `[$_net_revenue_promotion_tax]`, `[$_referral_fee]`, `[$_total_fba_fee_fee_preview]`  
```dax
VAR _profit = (
        [$_net_revenue_promotion_tax] 
        - [$_cogs] 
        - [$_total_fba_fee_fee_preview] 
        - [$_referral_fee] 
    )

RETURN
    _profit
```

#### `%_commercial_profit_over_net_revenue`

**Depende de medidas:** `[$_commercial_profit]`, `[$_net_revenue]`  
```dax
VAR _div = DIVIDE( [$_commercial_profit], [$_net_revenue] ) 

RETURN
    _div
```

#### `q_orders`

**Depende de colunas:** `'f.AllOrders'[key_marketplace_sku]`, `'f.AllOrders'[order_id_SK]`  
```dax
// Quantity of orders.

CALCULATE(
    DISTINCTCOUNT( 'f.AllOrders'[order_id_SK] )
    , FILTER(
        'f.AllOrders'
        , NOT(CONTAINSSTRING('f.AllOrders'[key_marketplace_sku], "Non-Amazon"))
    )
)
```

#### `$_operational_profit_before_awd`

**Depende de medidas:** `[$_cogs]`, `[$_estimated_storage_fee]`, `[$_net_revenue_promotion_tax]`, `[$_ppc_spend]`, `[$_referral_fee]`, `[$_total_fba_fee_fee_preview]`  
```dax
VAR _profit = (
        [$_net_revenue_promotion_tax] 
        - [$_cogs] 
        - [$_total_fba_fee_fee_preview] 
        - [$_referral_fee] 
        - [$_ppc_spend] 
        - [$_estimated_storage_fee]
    )

RETURN
    _profit
```

#### `u_units_sold_last_12_months`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR EndDate = TODAY() - 1
VAR StartDate = EDATE(EndDate, -12) + 1

RETURN
    CALCULATE(
        [u_units_sold],
        FILTER(
            ALL('Calendar'),
            'Calendar'[Date] >= StartDate &&
            'Calendar'[Date] <= EndDate
        )
    )
```


### Sales (All Orders)\Sales Time Comparisson

#### `u_sum_units_sold_last_30_days`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _maxDate =
        CALCULATE (
            MAX('Calendar'[Date])
            , 'Calendar'[Date] <= MIN ( MAX('Calendar'[Date]), TODAY()-1 )
        )

RETURN
    CALCULATE (
        [u_units_sold]
        , DATESINPERIOD ( 'Calendar'[Date], _maxDate ,-30 , DAY )
    )
```

#### `u_sum_units_sold_last_45_days`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
//     VAR _timeFrame = 45
//     VAR _lastDate = LASTDATE('Calendar'[Date])
//     VAR _datesBetween =
//         DATESBETWEEN(
//             'Calendar'[Date],
//             DATEADD(_lastDate, - _timeFrame, DAY),
//             DATEADD(_lastDate, - 1, DAY)
//         )

//     VAR _totalSum =
//         SUMX(
//             _datesBetween
//             , [u_units_sold]
//         )
        
// RETURN
//     _totalSum

VAR _maxDate =
    CALCULATE (
        MAX('Calendar'[Date]),
        'Calendar'[Date] <= MIN ( MAX('Calendar'[Date]), TODAY()-1 )
    )

RETURN
    CALCULATE (
        [u_units_sold],
        DATESINPERIOD ( 'Calendar'[Date], _maxDate ,-45 , DAY )
    )
```


### Sales (All Orders)\Sales Time Comparisson\Sales - MOM

#### `%_revenue_month_over_month_mom`

**Depende de medidas:** `[$_revenue]`, `[$_revenue_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_revenue]
            , [$_revenue_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_net_revenue_month_over_month_mom`

**Depende de medidas:** `[$_net_revenue]`, `[$_net_revenue_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_net_revenue]
            , [$_net_revenue_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_average_price_month_over_month_mom`

**Depende de medidas:** `[$_average_price]`, `[$_average_price_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_average_price]
            , [$_average_price_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_net_average_price_month_over_month_mom`

**Depende de medidas:** `[$_net_average_price]`, `[$_net_average_price_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_net_average_price]
            , [$_net_average_price_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_units_sold_month_over_month_mom`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`, `[u_units_sold]`, `[u_units_sold_previous_month]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [u_units_sold]
            , [u_units_sold_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_organic_units_sold_month_over_month_mom`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`, `[u_organic_units_sold]`, `[u_organic_units_sold_previous_month]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [u_organic_units_sold]
            , [u_organic_units_sold_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_organic_revenue_month_over_month_mom`

**Depende de medidas:** `[$_organic_revenue]`, `[$_organic_revenue_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

    VAR _division = 
        DIVIDE ( 
            [$_organic_revenue]
            , [$_organic_revenue_previous_month]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```


### Sales (All Orders)\Sales Time Comparisson\Sales - Previous Month

#### `$_revenue_previous_month`

**Depende de medidas:** `[$_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_revenue]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_net_revenue_previous_month`

**Depende de medidas:** `[$_net_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_net_revenue]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_average_price_previous_month`

**Depende de medidas:** `[$_average_price]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_average_price]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_net_average_price_previous_month`

**Depende de medidas:** `[$_net_average_price]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_net_average_price]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `u_units_sold_previous_month`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [u_units_sold]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `u_organic_units_sold_previous_month`

**Depende de medidas:** `[u_organic_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [u_organic_units_sold]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_organic_revenue_previous_month`

**Depende de medidas:** `[$_organic_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_organic_revenue]
    , DATEADD ( 'Calendar'[Date], -1, MONTH)
    , CROSSFILTER ( 'z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```


### Sales (All Orders)\Sales Time Comparisson\Sales - Previous Year

#### `u_units_sold_previous_year`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [u_units_sold]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_revenue_previous_year`

**Depende de medidas:** `[$_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_revenue]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_average_price_previous_year`

**Depende de medidas:** `[$_average_price]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_average_price]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_net_average_price_previous_year`

**Depende de medidas:** `[$_net_average_price]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_net_average_price]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_net_revenue_previous_year`

**Depende de medidas:** `[$_net_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_net_revenue]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `$_organic_revenue_previous_year`

**Depende de medidas:** `[$_organic_revenue]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [$_organic_revenue]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```

#### `u_organic_units_sold_previous_year`

**Depende de medidas:** `[u_organic_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
CALCULATE(
    [u_organic_units_sold]
    , DATEADD('Calendar'[Date],-1,YEAR)
    , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
)
```


### Sales (All Orders)\Sales Time Comparisson\Sales - YOY

#### `%_units_sold_year_over_year_yoy`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`, `[u_units_sold]`, `[u_units_sold_previous_year]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [u_units_sold]
            , [u_units_sold_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_revenue_year_over_year_yoy`

**Depende de medidas:** `[$_revenue]`, `[$_revenue_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_revenue]
            , [$_revenue_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_net_average_price_year_over_year_yoy`

**Depende de medidas:** `[$_net_average_price]`, `[$_net_average_price_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_net_average_price]
            , [$_net_average_price_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_net_revenue_year_over_year_yoy`

**Depende de medidas:** `[$_net_revenue]`, `[$_net_revenue_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_net_revenue]
            , [$_net_revenue_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_average_price_year_over_year_yoy`

**Depende de medidas:** `[$_average_price]`, `[$_average_price_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_average_price]
            , [$_average_price_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_organic_units_sold_year_over_year_yoy`

**Depende de medidas:** `[d_first_date_of_sku_by_inventory]`, `[u_organic_units_sold]`, `[u_organic_units_sold_previous_year]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [u_organic_units_sold]
            , [u_organic_units_sold_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```

#### `%_organic_revenue_year_over_year_yoy`

**Depende de medidas:** `[$_organic_revenue]`, `[$_organic_revenue_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

    VAR _division = 
        DIVIDE ( 
            [$_organic_revenue]
            , [$_organic_revenue_previous_year]
        ) - 1

return
    IF (
        [d_first_date_of_sku_by_inventory] <= _date
        , _division
        , 0
    )
```


### Sales (All Orders)\Sell Through

#### `sell_through_last_90_days`

**Depende de medidas:** `[u_units_sold]`  
**Depende de colunas:** `'Calendar'[Date]`, `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[Ending Warehouse Balance]`, `'Inventory Ledger'[In Transit Between Warehouses]`, `'Inventory Ledger'[ending_plus_transit]`, `'f.AmazonFulfilledShipments'[key_marketplace_sku]`, `'f.AmazonFulfilledShipments'[shipment_date]`, `'f.AmazonFulfilledShipments'[shipped_quantity]`, `SKUs[SKU]`  
```dax
// VAR _maxDate = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, DAY ) )
    // VAR _minDate = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -91, DAY ) )
    
    
    
    // VAR _totalInventory = 
    //         SUMX(
    //             FILTER(
    //                 'Inventory Ledger'
    //                 , 'Inventory Ledger'[Disposition] = "Sellable"
    //                     && 'Inventory Ledger'[Date] >= _minDate
    //                     && 'Inventory Ledger'[Date] <= _maxDate
    //             )
    //             , SUM('Inventory Ledger'[ending_plus_transit])
    //             //, 'Inventory Ledger'[In Transit Between Warehouses] + 'Inventory Ledger'[Ending Warehouse Balance]
    //         )

// return
// DIVIDE(
//     [u_units_sold]
//     , DIVIDE( _totalInventory, 90 )
// )

// https://sellercentral.amazon.com/help/hub/reference/ZJF4DY2W6MERBAL
// Your FBA sell-through rate is your sold and shipped units over the past 90 days divided by the average number of units in stock in our fulfillment centers during that period. We calculate your available average units by taking a snapshot of your inventory levels today and 30, 60, and 90 days ago.

// Última data fixa de atualização do relatório
// VAR _LastDate =
//     CALCULATE(
//         MAX('Inventory Ledger'[Date]),
//         ALL('Calendar'),  // Ignora filtros de calendário
//         ALL(SKUs[SKU])
//     )
// VAR NinetyDaysAgo = _LastDate - 90

// VAR InventoryToday = 
//     CALCULATE(
//         SUM('Inventory Ledger'[ending_plus_transit]),
//         REMOVEFILTERS('Calendar'),  // Remove influência do calendário
//         'Inventory Ledger'[Disposition] = "Sellable",
//         'Inventory Ledger'[Date] = _LastDate
//     )

// VAR Inventory30 = 
//     CALCULATE(
//         SUM('Inventory Ledger'[ending_plus_transit]),
//         REMOVEFILTERS('Calendar'),
//         'Inventory Ledger'[Disposition] = "Sellable",
//         'Inventory Ledger'[Date] = _LastDate - 30
//     )

// VAR Inventory60 = 
//     CALCULATE(
//         SUM('Inventory Ledger'[ending_plus_transit]),
//         REMOVEFILTERS('Calendar'),
//         'Inventory Ledger'[Disposition] = "Sellable",
//         'Inventory Ledger'[Date] = _LastDate - 60
//     )

// VAR Inventory90 = 
//     CALCULATE(
//         SUM('Inventory Ledger'[ending_plus_transit]),
//         REMOVEFILTERS('Calendar'),
//         'Inventory Ledger'[Disposition] = "Sellable",
//         'Inventory Ledger'[Date] = NinetyDaysAgo
//     )

// VAR UnitsShipped = 
//     CALCULATE(
//         SUM('f.AmazonFulfilledShipments'[shipped_quantity]),
//         REMOVEFILTERS('Calendar'),  // Ignora calendário
//         NOT(CONTAINSSTRING('f.AmazonFulfilledShipments'[key_marketplace_sku], "Non-Amazon")),
//         DATESBETWEEN(
//             'f.AmazonFulfilledShipments'[shipment_date], 
//             NinetyDaysAgo + 1, 
//             _LastDate
//         )
//     )

// RETURN
//     DIVIDE(
//         UnitsShipped,
//         (InventoryToday + Inventory30 + Inventory60 + Inventory90) / 4,
//         BLANK()
//     )

VAR _LastDate = MAX('Inventory Ledger'[Date])

VAR InventoryToday = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = _LastDate,
        ALL('Calendar')
    )

VAR Inventory30 = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = _LastDate - 30,
        ALL('Calendar')
    )

VAR Inventory60 = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = _LastDate - 60,
        ALL('Calendar')
    )

VAR Inventory90 = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = _LastDate - 90,
        ALL('Calendar')
    )

VAR UnitsShipped = 
    CALCULATE(
        SUM('f.AmazonFulfilledShipments'[shipped_quantity]),
        NOT(CONTAINSSTRING('f.AmazonFulfilledShipments'[key_marketplace_sku], "Non-Amazon")),
        'f.AmazonFulfilledShipments'[shipment_date] >= _LastDate - 90 + 1,
        'f.AmazonFulfilledShipments'[shipment_date] <= _LastDate,
        ALL('Calendar')
    )

RETURN
    DIVIDE(
        UnitsShipped,
        (InventoryToday + Inventory30 + Inventory60 + Inventory90) / 4,
        BLANK()
    )
```

#### `sell_through_last_30_days_plus_awd`

**Depende de colunas:** `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[ending_plus_transit]`, `'f.AmazonFulfilledShipments'[key_marketplace_sku]`, `'f.AmazonFulfilledShipments'[shipment_date]`, `'f.AmazonFulfilledShipments'[shipped_quantity]`, `'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger]`, `'fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_units]`  
```dax
VAR _LastDate = MAX('Inventory Ledger'[Date])
VAR ThirtyDaysAgo = _LastDate - 30
VAR _LastDateAwd = MAX('fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger])
VAR ThirtyDaysAgoAwd = _LastDateAwd - 30

VAR InventoryToday = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = _LastDate,
        ALL('Calendar')
    )

VAR InventoryThirtyDaysAgo = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = ThirtyDaysAgo,
        ALL('Calendar')
    )

VAR InventoryTodayAwd = 
    CALCULATE(
        SUM('fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_units]),
        'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] = _LastDateAwd,
        ALL('Calendar')
    )

VAR InventoryThirtyDaysAgoAwd = 
    CALCULATE(
        SUM('fact_awd_inventory_ledger_by_country'[ending_warehouse_balance_units]),
        'fact_awd_inventory_ledger_by_country'[date_awd_inventory_ledger] = ThirtyDaysAgoAwd,
        ALL('Calendar')
    )

VAR UnitsShippedLast30Days = 
    CALCULATE(
        SUM('f.AmazonFulfilledShipments'[shipped_quantity]),
        NOT(CONTAINSSTRING('f.AmazonFulfilledShipments'[key_marketplace_sku], "Non-Amazon")),
        'f.AmazonFulfilledShipments'[shipment_date] >= ThirtyDaysAgo + 1,
        'f.AmazonFulfilledShipments'[shipment_date] <= _LastDate,
        ALL('Calendar')
    )

RETURN 
    DIVIDE(
        UnitsShippedLast30Days,
        (InventoryToday + InventoryTodayAwd + InventoryThirtyDaysAgo + InventoryThirtyDaysAgoAwd) / 2,
        BLANK()
    )
```

#### `sell_through_last_30_days`

**Depende de colunas:** `'Inventory Ledger'[Date]`, `'Inventory Ledger'[Disposition]`, `'Inventory Ledger'[ending_plus_transit]`, `'f.AmazonFulfilledShipments'[key_marketplace_sku]`, `'f.AmazonFulfilledShipments'[shipment_date]`, `'f.AmazonFulfilledShipments'[shipped_quantity]`  
```dax
VAR _LastDate = MAX('Inventory Ledger'[Date])
VAR ThirtyDaysAgo = _LastDate - 30

VAR InventoryToday = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = _LastDate,
        ALL('Calendar')
    )

VAR InventoryThirtyDaysAgo = 
    CALCULATE(
        SUM('Inventory Ledger'[ending_plus_transit]),
        'Inventory Ledger'[Disposition] = "Sellable",
        'Inventory Ledger'[Date] = ThirtyDaysAgo,
        ALL('Calendar')
    )

VAR UnitsShippedLast30Days = 
    CALCULATE(
        SUM('f.AmazonFulfilledShipments'[shipped_quantity]),
        NOT(CONTAINSSTRING('f.AmazonFulfilledShipments'[key_marketplace_sku], "Non-Amazon")),
        'f.AmazonFulfilledShipments'[shipment_date] >= ThirtyDaysAgo + 1,
        'f.AmazonFulfilledShipments'[shipment_date] <= _LastDate,
        ALL('Calendar')
    )

RETURN
    DIVIDE(
        UnitsShippedLast30Days,
        (InventoryToday + InventoryThirtyDaysAgo) / 2,
        BLANK()
    )
```


### Traffic

#### `u_sessions_total`

**Depende de colunas:** `fact_amz_business_report[total_sessions]`  
```dax
SUM ( fact_amz_business_report[total_sessions] )
```

#### `u_page_views_total`

**Depende de colunas:** `fact_amz_business_report[total_page_views]`  
```dax
SUM(fact_amz_business_report[total_page_views])
```

#### `u_sessions_browser`

**Depende de colunas:** `fact_amz_business_report[browser_sessions]`  
```dax
SUM ( fact_amz_business_report[browser_sessions] )
```

#### `u_sessions_mobile`

**Depende de colunas:** `fact_amz_business_report[mobile_app_sessions]`  
```dax
SUM ( fact_amz_business_report[mobile_app_sessions] )
```

#### `u_page_views_browser`

**Depende de colunas:** `fact_amz_business_report[browser_page_views]`  
```dax
SUM ( fact_amz_business_report[browser_page_views] )
```

#### `u_page_views_mobile`

**Depende de colunas:** `fact_amz_business_report[mobile_app_page_views]`  
```dax
SUM ( fact_amz_business_report[mobile_app_page_views] )
```

#### `u_total_units_ordered`

**Depende de colunas:** `fact_amz_business_report[units_ordered]`  
```dax
SUM ( fact_amz_business_report[units_ordered] )
```

#### `u_total_order_items`

**Depende de colunas:** `fact_amz_business_report[total_order_items]`  
```dax
SUM ( fact_amz_business_report[total_order_items] )
```

#### `%_unit_session`

**Depende de medidas:** `[u_sessions_total]`, `[u_total_units_ordered]`  
```dax
DIVIDE ( [u_total_units_ordered], [u_sessions_total] )
```

#### `%_page_views_per_session`

**Depende de medidas:** `[u_page_views_total]`, `[u_sessions_total]`  
```dax
DIVIDE ( [u_page_views_total], [u_sessions_total] )
```

#### `%_avg_buy_box_percentage`

**Depende de colunas:** `fact_amz_business_report[buy_box_percentage]`  
```dax
AVERAGE ( fact_amz_business_report[buy_box_percentage] )
```

#### `%_weighted_avg_buy_box_percentage`

**Depende de medidas:** `[u_sessions_total]`  
**Depende de colunas:** `fact_amz_business_report[buy_box_percentage]`, `fact_amz_business_report[total_sessions]`  
```dax
DIVIDE (
    SUMX (
        fact_amz_business_report,
        fact_amz_business_report[buy_box_percentage] * fact_amz_business_report[total_sessions]
    ),
    [u_sessions_total]
)
```

#### `%_buy_box_last_date`

**Depende de medidas:** `[%_avg_buy_box_percentage]`  
**Depende de colunas:** `fact_amz_business_report[date]`  
```dax
CALCULATE([%_avg_buy_box_percentage], fact_amz_business_report[date] = MAX(fact_amz_business_report[date]))
```

#### `%_sessions_majority_channel`

**Depende de medidas:** `[u_sessions_browser]`, `[u_sessions_mobile]`, `[u_sessions_total]`  
```dax
VAR _mobile = [u_sessions_mobile]
VAR _browser = [u_sessions_browser]
VAR major = 
    IF(
        _browser>_mobile
        , "Browser ("&FORMAT(DIVIDE(_browser,[u_sessions_total]),"0%")&")"
        , "Mobile ("&FORMAT(DIVIDE(_mobile,[u_sessions_total]),"0%")&")"
    )
RETURN major
```


### Traffic\Time Intelligence

#### `u_sessions_month_over_month_mom`

**Depende de medidas:** `[u_sessions_total]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE ( [u_sessions_total], DATEADD ( Calendar[Date], -1, MONTH ) )
```

#### `%_sessions_month_over_month_mom`

**Depende de medidas:** `[u_sessions_month_over_month_mom]`, `[u_sessions_total]`  
```dax
DIVIDE (
    [u_sessions_total] - [u_sessions_month_over_month_mom],
    [u_sessions_month_over_month_mom]
)
```

#### `u_sessions_year_over_year_yoy`

**Depende de medidas:** `[u_sessions_total]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE ( [u_sessions_total], SAMEPERIODLASTYEAR ( Calendar[Date] ) )
```

#### `%_sessions_year_over_year_yoy`

**Depende de medidas:** `[u_sessions_total]`, `[u_sessions_year_over_year_yoy]`  
```dax
DIVIDE (
    [u_sessions_total] - [u_sessions_year_over_year_yoy],
    [u_sessions_year_over_year_yoy]
)
```

#### `u_page_views_year_over_year_yoy`

**Depende de medidas:** `[u_page_views_total]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE ( [u_page_views_total], SAMEPERIODLASTYEAR ( Calendar[Date] ) )
```

#### `%_page_views_year_over_year_yoy`

**Depende de medidas:** `[u_page_views_total]`, `[u_page_views_year_over_year_yoy]`  
```dax
DIVIDE (
    [u_page_views_total] - [u_page_views_year_over_year_yoy],
    [u_page_views_year_over_year_yoy]
)
```

#### `u_page_views_month_over_month_mom`

**Depende de medidas:** `[u_page_views_total]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE ( [u_page_views_total], DATEADD ( Calendar[Date], -1, MONTH ) )
```

#### `%_page_views_month_over_month_mom`

**Depende de medidas:** `[u_page_views_month_over_month_mom]`, `[u_page_views_total]`  
```dax
DIVIDE (
    [u_page_views_total] - [u_page_views_month_over_month_mom],
    [u_page_views_month_over_month_mom]

)
```

#### `%_unit_session_previous_month`

**Depende de medidas:** `[%_unit_session]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE([%_unit_session], DATEADD(Calendar[Date], -1, MONTH))
```

#### `%pp_unit_session_month_over_month_mom`

**Depende de medidas:** `[%_unit_session]`, `[%_unit_session_previous_month]`  
```dax
[%_unit_session] - [%_unit_session_previous_month]
```

#### `%_unit_session_previous_year`

**Depende de medidas:** `[%_unit_session]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE([%_unit_session], DATEADD(Calendar[Date], -1, YEAR))
```

#### `%pp_unit_session_year_over_year_yoy`

**Depende de medidas:** `[%_unit_session]`, `[%_unit_session_previous_year]`  
```dax
[%_unit_session] - [%_unit_session_previous_year]
```

#### `%_page_views_per_session_previous_year`

**Depende de medidas:** `[%_page_views_per_session]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE([%_page_views_per_session], DATEADD(Calendar[Date], -1, YEAR))
```

#### `%_page_views_per_session_previous_month`

**Depende de medidas:** `[%_page_views_per_session]`  
**Depende de colunas:** `Calendar[Date]`  
```dax
CALCULATE([%_page_views_per_session], DATEADD(Calendar[Date], -1, MONTH))
```

#### `%pp_page_views_per_session_month_over_month_mom`

**Depende de medidas:** `[%_page_views_per_session]`, `[%_page_views_per_session_previous_month]`  
```dax
[%_page_views_per_session] - [%_page_views_per_session_previous_month]
```

#### `%pp_page_views_per_session_year_over_year_yoy`

**Depende de medidas:** `[%_page_views_per_session]`, `[%_page_views_per_session_previous_year]`  
```dax
[%_page_views_per_session] - [%_page_views_per_session_previous_year]
```


### Velocity

#### `%_revenue_loss`

**Depende de colunas:** `'fact_db_results_VO'[Calc_Loss_of_Revenue]`, `'fact_db_results_VO'[Calc_Potencial_Revenue]`  
```dax
DIVIDE(
    SUM('fact_db_results_VO'[Calc_Loss_of_Revenue]),
    SUM('fact_db_results_VO'[Calc_Potencial_Revenue]),
    0
)
```

#### `%_revenue_loss_previous_year`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_db_results_VO'[Calc_Loss_of_Revenue]`, `'fact_db_results_VO'[Calc_Potencial_Revenue]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
VAR PrevYearLossRevenue =
    CALCULATE(
        SUM('fact_db_results_VO'[Calc_Loss_of_Revenue]),
        SAMEPERIODLASTYEAR('Calendar'[Date])
        , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
    )
VAR PrevYearPotentialRevenue =
    CALCULATE(
        SUM('fact_db_results_VO'[Calc_Potencial_Revenue]),
        SAMEPERIODLASTYEAR('Calendar'[Date])
        , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
    )
RETURN
DIVIDE(PrevYearLossRevenue, PrevYearPotentialRevenue, 0)
```

#### `%_revenue_loss_year_over_year_yoy`

**Depende de medidas:** `[%_revenue_loss]`, `[%_revenue_loss_previous_year]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, YEAR ) )

VAR _division = 
    DIVIDE ( 
        [%_revenue_loss]
        , [%_revenue_loss_previous_year]
    ) - 1

RETURN
IF (
    [d_first_date_of_sku_by_inventory] <= _date
    , _division
    , 0
)
```

#### `%_revenue_loss_month_over_month_mom`

**Depende de medidas:** `[%_revenue_loss]`, `[%_revenue_loss_previous_month]`, `[d_first_date_of_sku_by_inventory]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR _date = MAXX ( 'Calendar', DATEADD ( 'Calendar'[Date], -1, MONTH ) )

VAR _division = 
    DIVIDE ( 
        [%_revenue_loss]
        , [%_revenue_loss_previous_month]
    ) - 1

RETURN
IF (
    [d_first_date_of_sku_by_inventory] <= _date
    , _division

    , 0
)
```

#### `%_revenue_loss_previous_month`

**Depende de colunas:** `'Calendar'[Date]`, `'fact_db_results_VO'[Calc_Loss_of_Revenue]`, `'fact_db_results_VO'[Calc_Potencial_Revenue]`, `'z.dynamic_time_frame_switch'[Start Date]`  
```dax
VAR PrevMonthLossRevenue =
    CALCULATE(
        SUM('fact_db_results_VO'[Calc_Loss_of_Revenue])
        , DATEADD('Calendar'[Date], -1, MONTH)
        , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
    )
VAR PrevMonthPotentialRevenue =
    CALCULATE(
        SUM('fact_db_results_VO'[Calc_Potencial_Revenue])
        , DATEADD('Calendar'[Date], -1, MONTH)
        , CROSSFILTER('z.dynamic_time_frame_switch'[Start Date], 'Calendar'[Date], OneWay_RightFiltersLeft)
    )
RETURN
DIVIDE(PrevMonthLossRevenue, PrevMonthPotentialRevenue, 0)
```

#### `$_revenue_loss`

**Depende de colunas:** `'fact_db_results_VO'[Calc_Loss_of_Revenue]`  
```dax
CALCULATE(
    SUM('fact_db_results_VO'[Calc_Loss_of_Revenue]),
    'fact_db_results_VO'[Calc_Loss_of_Revenue] > 0
)
```


### Velocity\Daily

#### `u_daily_velocity`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Daily Velocity]`  
```dax
VAR _velocity =
        CALCULATE(
            MAX('fact_velocity'[Updated Daily Velocity])
            , FILTER(
                'fact_velocity'
                , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
            )
        )

return
    _velocity
```

#### `u_daily_velocity_moving _average_slow`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Weekly MA Slow]`  
```dax
CALCULATE(
    MAX('fact_velocity'[Weekly MA Slow]),
    FILTER(
        'fact_velocity',
        'fact_velocity'[Date] = MAX('fact_velocity'[Date])
    )
) / 7
```

#### `u_daily_velocity_moving_average_medium`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Weekly MA Medium]`  
```dax
CALCULATE(
    MAX('fact_velocity'[Weekly MA Medium]),
    FILTER(
        'fact_velocity',
        'fact_velocity'[Date] = MAX('fact_velocity'[Date])
    )
) / 7
```

#### `u_daily_velocity_moving_average_fast`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Weekly MA Fast]`  
```dax
CALCULATE(
    MAX('fact_velocity'[Weekly MA Fast]),
    FILTER(
        'fact_velocity',
        'fact_velocity'[Date] = MAX('fact_velocity'[Date])
    )
) / 7
```

#### `u_daily_velocity_aggregated`

**Depende de medidas:** `[u_daily_velocity]`, `[u_inventory_ending_plus_transit]`  
**Depende de colunas:** `'fact_velocity'[Updated Daily Velocity]`, `SKUs[SKU]`  
```dax
//     VAR _velocity =
//         SUMX(
//             FILTER(
//                 VALUES(SKUs[SKU])
//                 , [u_inventory_ending_plus_transit] > 0
//             )
//             , [u_daily_velocity]
//         )


// RETURN
//     _velocity

SUMX(
        'fact_velocity'
        , 'fact_velocity'[Updated Daily Velocity]
    )
```


### Velocity\For Inventory Tracker

#### `u_daily_velocity_on_delivery_day`

**Depende de medidas:** `[d_delivery_date_inbound_shipments]`  
**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Daily Velocity]`  
```dax
VAR _onDeliveryDay = [d_delivery_date_inbound_shipments]
    VAR _velocity =
        CALCULATE(
            MAX('fact_velocity'[Updated Daily Velocity])
            , FILTER(
                ALL ( 'fact_velocity' )
                , 'fact_velocity'[Date] = _onDeliveryDay ) )

return
    _velocity
```

#### `u_daily_velocity_before_delivery_day`

**Depende de medidas:** `[d_delivery_date_inbound_shipments]`  
**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Daily Velocity]`  
```dax
VAR _deliveryDay = [d_delivery_date_inbound_shipments]
    VAR _previousVelocityDate = IF(NOT(ISBLANK(_deliveryDay)), _deliveryDay-1,BLANK())
    VAR _velocity =
        MAXX(
            FILTER ( 'fact_velocity', 'fact_velocity'[Date] = _previousVelocityDate )
            , ROUND('fact_velocity'[Updated Daily Velocity], 2 ) )

RETURN
    _velocity
```


### Velocity\Weekly

#### `u_weekly_velocity`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Updated Weekly Velocity]`  
```dax
CALCULATE(
    MAX ( 'fact_velocity'[Updated Weekly Velocity] )
    , FILTER(
        'fact_velocity'
        , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
    )
)
```

#### `u_weekly_velocity_aggregated`

**Depende de colunas:** `'fact_velocity'[Updated Weekly Velocity]`  
```dax
SUMX(
    'fact_velocity'
    , 'fact_velocity'[Updated Weekly Velocity]
)
```

#### `u_weekly_velocity_moving_average_fast`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Weekly MA Fast]`  
```dax
CALCULATE(
    MAX ( 'fact_velocity'[Weekly MA Fast] )
    , FILTER(
        'fact_velocity'
        , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
    )
)
```

#### `u_weekly_velocity_moving_average_medium`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Weekly MA Medium]`  
```dax
CALCULATE(
    MAX ( 'fact_velocity'[Weekly MA Medium] )
    , FILTER(
        'fact_velocity'
        , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
    )
)
```

#### `u_weekly_velocity_moving_average_slow`

**Depende de colunas:** `'fact_velocity'[Date]`, `'fact_velocity'[Weekly MA Slow]`  
```dax
CALCULATE(
    MAX ( 'fact_velocity'[Weekly MA Slow] )
    , FILTER(
        'fact_velocity'
        , 'fact_velocity'[Date] = MAX ( 'fact_velocity'[Date] )
    )
)
```


### db_results_TIO

#### `u_tio_inventory_projection_3pl`

**Depende de colunas:** `'fact_db_results_tio'[ending_balance_considering_reorder_3pl]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[ending_balance_considering_reorder_3pl] )
            , FILTER(
                'fact_db_results_tio'
                , 'fact_db_results_tio'[start_of_week] = MAX ( 'fact_db_results_tio'[start_of_week] )
            )
        )

return
    _result
```

#### `u_tio_inventory_projection_3pl_coverage_days`

**Depende de medidas:** `[u_tio_inventory_projection_3pl]`, `[u_tio_velocity]`  
```dax
VAR _coverage =
        DIVIDE(
            [u_tio_inventory_projection_3pl]
            , [u_tio_velocity]
        ) 
        
    VAR _multiplication = _coverage * 7

RETURN
    _multiplication
```

#### `u_tio_inventory_projection_amz`

**Depende de colunas:** `'fact_db_results_tio'[ending_balance_considering_reorder_amz]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[ending_balance_considering_reorder_amz] )
            , FILTER(
                'fact_db_results_tio'
                , 'fact_db_results_tio'[start_of_week] = MAX ( 'fact_db_results_tio'[start_of_week] )
            )
        )

return
    _result
```

#### `u_tio_inventory_projection_amz_sparkline`

**Depende de colunas:** `'Calendar'[Date]`, `'dim_calendar_aux'[Date aux]`, `'fact_db_results_tio'[ending_balance_considering_reorder_amz]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[ending_balance_considering_reorder_amz] )
            , USERELATIONSHIP('Calendar'[Date], 'dim_calendar_aux'[Date aux])
            , REMOVEFILTERS('Calendar')
            , REMOVEFILTERS('z.dynamic_time_frame_switch')
            , KEEPFILTERS('dim_calendar_aux')
        )

RETURN
    _result
```

#### `u_tio_mandatory_transfer`

**Depende de colunas:** `'fact_db_results_tio'[mandatory_transfer_from_3pl_to_amz]`, `db_results_TIO[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[mandatory_transfer_from_3pl_to_amz] )
            // , FILTER(
            //     db_results_TIO
            //     , db_results_TIO[start_of_week] = MAX ( db_results_TIO[start_of_week] )
            // )
        )

return
    _result
```

#### `u_tio_next_inbound_plus_transfer`

**Depende de medidas:** `[u_tio_quantity_ordered_previously_3pl]`, `[u_tio_quantity_ordered_previously_amz]`, `[u_tio_quantity_ordered_previously_awd]`  
```dax
[u_tio_quantity_ordered_previously_amz] +
[u_tio_quantity_ordered_previously_3pl] +
[u_tio_quantity_ordered_previously_awd]
```

#### `u_tio_overstock_with_3pl`

**Depende de colunas:** `'fact_db_results_tio'[overstock_with_3pl]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[overstock_with_3pl] )
            , FILTER(
                'fact_db_results_tio'
                , 'fact_db_results_tio'[start_of_week] = MAX ( 'fact_db_results_tio'[start_of_week] )
            )
        )

return
    _result
```

#### `u_tio_overstock_coverage_days`

**Depende de medidas:** `[u_tio_overstock_with_3pl]`, `[u_tio_velocity]`  
```dax
VAR _coverage =
        DIVIDE(
            [u_tio_overstock_with_3pl]
            , [u_tio_velocity]
        ) 
        
    VAR _multiplication = _coverage * 7

RETURN
    _multiplication
```

#### `u_tio_projected_sales_loss`

**Depende de colunas:** `'fact_db_results_tio'[projected_sales_loss_if_not_reordered]`, `db_results_TIO[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[projected_sales_loss_if_not_reordered] )
            // , FILTER(
            //     db_results_TIO
            //     , db_results_TIO[start_of_week] = MAX ( db_results_TIO[start_of_week] )
            // )
        )

return
    _result
```

#### `u_tio_quantity_ordered_previously_3pl`

**Depende de colunas:** `'fact_db_results_tio'[quantity_ordered_previously_3pl]`, `db_results_TIO[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[quantity_ordered_previously_3pl] )
            // , FILTER(
            //     db_results_TIO
            //     , db_results_TIO[start_of_week] = MAX ( db_results_TIO[start_of_week] )
            // )
        )

return
    _result
```

#### `u_tio_quantity_ordered_previously_amz`

**Depende de colunas:** `'fact_db_results_tio'[quantity_ordered_previously_amz]`, `db_results_TIO[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[quantity_ordered_previously_amz] )
            // , FILTER(
            //     db_results_TIO
            //     , db_results_TIO[start_of_week] = MAX ( db_results_TIO[start_of_week] )
            // )
        )

return
    _result
```

#### `u_tio_quantity_ordered_previously_awd`

**Depende de colunas:** `'fact_db_results_tio'[quantity_ordered_previously_awd]`, `db_results_TIO[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[quantity_ordered_previously_awd] )
            // , FILTER(
            //     db_results_TIO
            //     , db_results_TIO[start_of_week] = MAX ( db_results_TIO[start_of_week] )
            // )
        )

return
    _result
```

#### `u_tio_sales_forecast`

**Depende de colunas:** `'fact_db_results_tio'[demand_forecast]`, `db_results_TIO[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[demand_forecast] )
            // , FILTER(
            //     db_results_TIO
            //     , db_results_TIO[start_of_week] = MAX ( db_results_TIO[start_of_week] )
            // )
        )

return
    _result
```

#### `u_tio_target_balance`

**Depende de colunas:** `'fact_db_results_tio'[start_of_week]`, `'fact_db_results_tio'[target_ending_balance]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[target_ending_balance] )
            , FILTER(
                'fact_db_results_tio'
                , 'fact_db_results_tio'[start_of_week] = MAX ( 'fact_db_results_tio'[start_of_week] )
            )
        )

return
    _result
```

#### `u_tio_velocity`

**Depende de colunas:** `'fact_db_results_tio'[baseline_forecast]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[baseline_forecast] )
            , FILTER(
                'fact_db_results_tio'
                , 'fact_db_results_tio'[start_of_week] = MAX ( 'fact_db_results_tio'[start_of_week] )
            )
        )

return
    _result
```

#### `filter_for_year_month_544_tio`

**Depende de colunas:** `'Calendar'[Start of Week]`, `'Calendar'[Year-Month 544]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _minDateTIO = CALCULATE( MIN ( 'fact_db_results_tio'[start_of_week] ), ALL ( 'Calendar' ) )
    VAR _maxDateTIO = CALCULATE( MAX ( 'fact_db_results_tio'[start_of_week] ), ALL ( 'Calendar' ) )
    
RETURN
    FILTER(
        VALUES ( 'Calendar'[Year-Month 544] )
        ,  MIN ( 'Calendar'[Start of Week] ) >= _minDateTIO
        && MIN ( 'Calendar'[Start of Week] ) <= _maxDateTIO
    )
```

#### `filter_for_year_week_544_tio`

**Depende de colunas:** `'Calendar'[Start of Week]`, `'Calendar'[Year-Week 544]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _minDateTIO = CALCULATE( MIN ( 'fact_db_results_tio'[start_of_week] ), ALL ( 'Calendar' ) )
    VAR _maxDateTIO = CALCULATE( MAX ( 'fact_db_results_tio'[start_of_week] ), ALL ( 'Calendar' ) )
    
RETURN
    FILTER(
        VALUES ( 'Calendar'[Year-Week 544] )
        ,  MIN ( 'Calendar'[Start of Week] ) >= _minDateTIO
        && MIN ( 'Calendar'[Start of Week] ) <= _maxDateTIO
    )
```

#### `u_tio_ending_balance`

**Depende de colunas:** `'fact_db_results_tio'[ending_balance]`, `'fact_db_results_tio'[start_of_week]`  
```dax
VAR _result =
        CALCULATE(
            SUM( 'fact_db_results_tio'[ending_balance] )
            , FILTER(
                'fact_db_results_tio'
                , 'fact_db_results_tio'[start_of_week] = MAX ( 'fact_db_results_tio'[start_of_week] )
            )
        )

return
    _result
```

#### `$_tio_storage_fee_amz_forecast`

**Depende de colunas:** `'fact_db_results_tio'[storage_fee_amz]`, `'z.dynamic_time_frame_switch'[Time Frame]`  
```dax
VAR _weeklyStorageFee = SUM ( 'fact_db_results_tio'[storage_fee_amz] )
    VAR _dailyStorageFee = DIVIDE ( _weeklyStorageFee, 7 )
    VAR _switch =
        IF(
            SELECTEDVALUE('z.dynamic_time_frame_switch'[Time Frame]) = "Daily"
            , _dailyStorageFee
            , _weeklyStorageFee 
        )

RETURN
    _weeklyStorageFee
```

#### `u_tio_version_file`

**Depende de colunas:** `'fact_db_results_tio'[version_file]`  
```dax
VAR _result =
       CALCULATE(
            MAX('fact_db_results_tio'[version_file]),
            ALL()
        )

return
    _result
```


## Fontes das Tabelas (90 tabelas)


### `Calendar`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Date` dateTime, `Week Number 544` string, `Month Number 544` string, `Year 544` string, `Year-Week 544` string, `Year` int64, `Month` int64, `Start of Week` dateTime, `End of Week` dateTime, `Day of Week` int64, `Year-Month 544` string, `Start of Month` dateTime, `Start of Quarter` dateTime, `Start of Year` dateTime, `Day of Month` int64, `Quarter` int64, `Year-Month` string, `Month Name` string, `is_future` boolean, `Quarter Q' = CONCATENATE("Q",QUARTER([Date]))`, `YearWeekNum = ````, `End of Month` dateTime, `Month Abrev` string, `Year-Quarter = 'Calendar'[Year]&"-"&'Calendar'[Quarter]`  
```powerquery
let
    MinDate = Date.FromText("01/01/2019"),
    #"Max Date" = Date.AddDays(Date.From(DateTime.LocalNow()),750),
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
    #"Start of Year" = Table.AddColumn(#"Inserted Quarter", "Start of Year", each Date.StartOfYear([Start of Quarter]), type date),
    #"Inserted Month Name" = Table.AddColumn(#"Start of Year", "Month Name", each Date.MonthName([Date]), type text),
    #"Added Custom" = Table.AddColumn(#"Inserted Month Name", "is_future", each if [Date] > Date.From(DateTime.LocalNow()) then true else false, type logical),
    #"End of Month" = Table.AddColumn(#"Added Custom", "End of Month", each Date.EndOfMonth([Date]), type date),
    #"Month Abrev" = Table.AddColumn(#"End of Month", "Month Abrev", each Text.Start(Text.From([Month Name], "en-US"), 3), type text)
in
    #"Month Abrev"
```


### `Contracted liquidator rate`

**Modo:** `import`  
**Colunas:** `Contracted liquidator rate`  
```powerquery
GENERATESERIES(0.05, 0.105, 0.005)
```


### `d.AmazonOrderId`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `amazon_order_id` string, `merchant_order_id` string, `order_status` string, `is_business_order` boolean, `order_id_SK` int64, `date_all_orders` dateTime, `sales_marketplace` string, `sales_channel_temporary` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Aux.vw_full_dimension_amazon_order_id")
in
    Source
```


### `d.fulfillmentCentersAddress`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `inventory_region` string, `inventory_country` string, `fulfillment_center_id` string, `city` string, `state` string, `state_abreviation` string, `country_name` string, `country` string, `zip` string, `address` string, `latitude` string, `longitude` string, `is_problematic` boolean, `state_country` string, `fc_city_state` string  
```powerquery
let
    Source = Csv.Document(File.Contents(path_to_files & "standalone_files\td_fulfillment_centers_address.csv"),[Delimiter=","]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"fulfillment_center_id", type text}, {"state", type text}, {"country", type text}, {"zip", type any}, {"address", type text}, {"is_problematic", type logical}}),
    #"Inserted Merged Column" = Table.AddColumn(#"Changed Type", "state_country", each Text.Combine({[state], ", ", [country_name]}), type text),
    #"Inserted Merged Column1" = Table.AddColumn(#"Inserted Merged Column", "fc_city_state", each Text.Combine({[fulfillment_center_id], " - ", [city], ", ", [state]}), type text),
    #"Filtered Rows" = Table.SelectRows(#"Inserted Merged Column1", each ([inventory_region] <> null)),
    #"Replaced Value" = Table.ReplaceValue(#"Filtered Rows","1-Jan","JAN1",Replacer.ReplaceText,{"fulfillment_center_id"})
in
    #"Replaced Value"
```


### `dim_awd_fee_type`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `fee_type_report` string, `fee_type` string  
```powerquery
let
    Source = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("VcuxCoAgEADQX5Gb6yOkVFxUvIMGkZCQaNFQ/5+GIGh/LwRAsp4rsUshYAK+rWxmOGpLZ2YyZ4hTAPLcoLOeOGlrfpRaKv2ubaRx1fIN5+0iELVRP+1aPXLvVzlfGR8=", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [fee_type_report = _t, fee_type = _t])
in
    Source
```


### `dim_bar_chart_aging_projection`

**Modo:** `import`  
**Colunas:** `dim_bar_chart_aging_projection`, `dim_bar_chart_aging_projection Fields`, `dim_bar_chart_aging_projection Order`  
```powerquery
{
    ("Inventory Region", NAMEOF('SKUs'[Inventory Region]), 0),
    ("Life Cycle", NAMEOF('SKUs'[Life Cycle]), 1)
}
```


### `dim_calendar_aux`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Date aux` dateTime, `Week Number 544` string, `Month Number 544` string, `Year 544` string, `Year-Week 544` string, `Year-Month 544` string, `Year` int64, `Month` int64, `Start of Week` dateTime, `End of Week` dateTime, `Day of Week` int64, `Start of Month` dateTime, `Start of Quarter` dateTime, `Start of Year` dateTime, `Day of Month` int64, `Quarter` int64, `Year-Month` string, `Month Name` string, `is_future` boolean, `End of Month` dateTime, `Month Abrev` string  
```powerquery
let
    Source = Calendar,
    #"Renamed Columns" = Table.RenameColumns(Source,{{"Date", "Date aux"}})
in
    #"Renamed Columns"
```


### `dim_order_IDs`

**Modo:** `import`  **Grupo:** `'Google Sheets - Inventory Tracker'`  
**Colunas:** `Order Id` string, `Region` string, `Type` string  
```powerquery
let
    Source = #"Inbound Shipments",
    columnSelection = Table.SelectColumns(Source,{"Order Id","Region","Type"}),
    duplicateRemoval = Table.Distinct(columnSelection)
in
    duplicateRemoval
```


### `dim_SCPR_category`

**Modo:** `import`  **Grupo:** `LOG\SCPR`  
**Colunas:** `Category` string, `Attribute` string, `Description` string, `Short Name` string, `Weight` int64  
```powerquery
let  
    Fonte = Excel.Workbook(File.Contents(path_to_files & "standalone_files\Supply Chain Performance Review (SCPR).xlsx"), null, true),
    Category_Sheet = Fonte{[Item="Category",Kind="Sheet"]}[Data],
    #"Tipo Alterado" = Table.TransformColumnTypes(Category_Sheet,{{"Column1", type text}, {"Column2", type text}, {"Column3", type text}}),
    #"Cabeçalhos Promovidos" = Table.PromoteHeaders(#"Tipo Alterado", [PromoteAllScalars=true]),
    #"Tipo Alterado1" = Table.TransformColumnTypes(#"Cabeçalhos Promovidos",{{"Category", type text}, {"Attribute", type text}, {"Description", type text}}),
    #"Coluna Condicional Adicionada" = Table.AddColumn(#"Tipo Alterado1", "Weight", each if [Category] = "Payment Terms" then 3 else 1),
    #"Tipo Alterado2" = Table.TransformColumnTypes(#"Coluna Condicional Adicionada",{{"Weight", Int64.Type}})
in
    #"Tipo Alterado2"
```


### `dim_SCPR_factory`

**Modo:** `import`  **Grupo:** `LOG\SCPR`  
**Colunas:** `Name` string, `Type` string  
```powerquery
let
    Fonte = Excel.Workbook(File.Contents(path_to_files & "\standalone_files\Supply Chain Performance Review (SCPR).xlsx"), null, true),
    Type_Sheet = Fonte{[Item="Type",Kind="Sheet"]}[Data],
    #"Tipo Alterado" = Table.TransformColumnTypes(Type_Sheet,{{"Column1", type text}, {"Column2", type text}}),
    #"Cabeçalhos Promovidos" = Table.PromoteHeaders(#"Tipo Alterado", [PromoteAllScalars=true]),
    #"Tipo Alterado1" = Table.TransformColumnTypes(#"Cabeçalhos Promovidos",{{"Name", type text}, {"Type", type text}}),
    #"Linhas Filtradas" = Table.SelectRows(#"Tipo Alterado1", each ([Type] = "Factory"))
in
    #"Linhas Filtradas"
```


### `dim_SCPR_freight`

**Modo:** `import`  **Grupo:** `LOG\SCPR`  
**Colunas:** `Name` string, `Type` string  
```powerquery
let
    Fonte = Excel.Workbook(File.Contents(path_to_files & "\standalone_files\Supply Chain Performance Review (SCPR).xlsx"), null, true),
    Type_Sheet = Fonte{[Item="Type",Kind="Sheet"]}[Data],
    #"Tipo Alterado" = Table.TransformColumnTypes(Type_Sheet,{{"Column1", type text}, {"Column2", type text}}),
    #"Cabeçalhos Promovidos" = Table.PromoteHeaders(#"Tipo Alterado", [PromoteAllScalars=true]),
    #"Tipo Alterado1" = Table.TransformColumnTypes(#"Cabeçalhos Promovidos",{{"Name", type text}, {"Type", type text}}),
    #"Linhas Filtradas" = Table.SelectRows(#"Tipo Alterado1", each ([Type] = "Freight Forwarder"))
in
    #"Linhas Filtradas"
```


### `dim_SCPR_type`

**Modo:** `import`  **Grupo:** `LOG\SCPR`  
**Colunas:** `Name` string, `Type` string  
```powerquery
let
    Fonte = Excel.Workbook(File.Contents(path_to_files & "\standalone_files\Supply Chain Performance Review (SCPR).xlsx"), null, true),
    Type_Sheet = Fonte{[Item="Type",Kind="Sheet"]}[Data],
    #"Tipo Alterado" = Table.TransformColumnTypes(Type_Sheet,{{"Column1", type text}, {"Column2", type text}}),
    #"Cabeçalhos Promovidos" = Table.PromoteHeaders(#"Tipo Alterado", [PromoteAllScalars=true]),
    #"Tipo Alterado1" = Table.TransformColumnTypes(#"Cabeçalhos Promovidos",{{"Name", type text}, {"Type", type text}})
in
    #"Tipo Alterado1"
```


### `dim_skus_aux`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `Base SKU` string, `SKU` string, `FNSKU` string, `Inventory Region` string, `Sales Region` string, `Country` string, `Amazon Family` string, `Marketplace` string, `ASIN` string, `Image URL` string, `Brand - Code` string, `Brand - Name` string, `Product General Type - Code` string, `Product General Type - Name` string, `Product Specific Type - Code` string, `Product Specific Type - Name` string, `Product Type Complete - Name` string, `Product Size - Code` string, `Product Size - Name` string, `Product Color - Code` string, `Product Color - Name` string, `Product Color - Pattern` string, `Product Set - Quantity` string, `Generic Family` string, `Core Family` string, `Specific Family` string, `Native Family` string, `Inner Type` string, `Units / Carton` int64, `Carton Weight (kg)` double, `Carton Dimensions (cm) Length` double, `Carton Dimensions (cm) Width` double, `Carton Dimensions (cm) Height` double, `Carton CBM` double, `AWD - Units / Carton` int64, `AWD - Carton Weight (kg)` double, `AWD - Carton Dimensions (cm) Length` double, `AWD - Carton Dimensions (cm) Width` double, `AWD - Carton Dimensions (cm) Height` double, `AWD - Carton CBM` double, `Units / Package` int64, `Package Weight (kg)` double, `Package Dimensions (cm) Length` double, `Package Dimensions (cm) Width` double, `Package Dimensions (cm) Height` double, `Item Dimensions (cm) Length` string, `Item Dimensions (cm) Width` string, `Item Dimensions (cm) Height` string, `Item Dimensions (in) Length` string, `Item Dimensions (in) Width` string, `Item Dimensions (in) Height` string, `is_grade_and_resell` boolean, `Grade` string, `Key Column: Sales Region | SKU` string, `Key Column: Sales Region | ASIN` string, `Key Column: Sales Region | FNSKU` string, `Key Column: Sales Region | Amazon Family` string, `Key Column: Sales Region | Country | SKU` string, `Key Column: Inventory Region | SKU` string, `Key Column: Inventory Region | ASIN` string, `Key Column: Inventory Region | FNSKU` string, `Key Column: Country | SKU` string, `Key Column: Country | ASIN` string, `Key Column: Country | FNSKU` string, `Key Column: Marketplace | SKU` string, `Key Column: Marketplace | ASIN` string, `Key Column: Marketplace | FNSKU` string, `Sales Region | Base SKU` string, `Inventory Region | Base SKU` string, `Country | SKU` string, `Country | Native Family` string, `Refresh Date` dateTime, `Average Weekly Units` int64, `Average Weekly Revenue` int64, `Revenue% Co.` double, `Units% Family` double, `ABC Co. Revenue` string, `ABC Family Units` string, `ABC Family Search Rank` string, `Final ABC Classification` string, `item_name` string, `item_description` string, `current_price` double, `open_date` string, `fulfillment_channel` string, `status` string, `Rope or Fabric` string, `SKU Consertado` string, `Key Column: Inventory Region | SKU Consertado` string, `Package CBM` double, `Package Cubic Feet` double, `ABC Profitability` string, `Life Cycle` string, `Reorder Region` string, `Reorder Region | Base SKU` string, `ABC Sales` string  
```powerquery
let
    Source = SKUs
in
    Source
```


### `dim_sponsored_ads`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `sponsored_ads_type` string, `sponsored_ads` string, `sponsored_ads_report` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.3_Bronze_Aux.td_sponsored_ads")
in
    Source
```


### `f.AllOrders`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `quantity` int64, `currency` string, `tax_after_price` double, `tax_within_price` double, `order_id_SK` int64, `date_all_orders` dateTime, `time_all_orders` dateTime, `item_status` string, `key_marketplace_sku` string, `item_price` double, `item_promotion_discount` double, `promotion_ids` string, `landed_cost = ````, `landed_cost_currency = ````, `ship_promotion_discount` double, `order_id_sk | key_marketplace_sku' = 'f.AllOrders'[order_id_SK] & " | " & 'f.AllOrders'[key_marketplace_sku]`, `unit_fba_fee = ````  
```powerquery
// let
//     #"Table Combine" = Table.Combine({#"raw - All Orders - 2024", #"raw - All Orders - 2019-23"}),
//     #"Changed Type" = Table.TransformColumnTypes(#"Table Combine",{{"amazon-order-id", type text}, {"purchase-date", type datetimezone}, {"order-status", type text}, {"item-status", type text}, {"sales-channel", type text}, {"sku", type text}, {"currency", type text}, {"item-price", type number}, {"quantity", Int64.Type}, {"item-promotion-discount", type number}, {"merchant-order-id", type text}, {"shipping-price", type number}, {"item-tax", type number}, {"shipping-tax", type number}, {"gift-wrap-price", type number}, {"gift-wrap-tax", type number}}),
//     // Merged with Marketplace to Country
//     #"Merged Queries" = Table.NestedJoin(#"Changed Type", {"sales-channel"}, aux_dSalesChannel, {"sales_channel"}, "Marketplace to Country", JoinKind.LeftOuter),
//     #"Expanded Marketplace to Country" = Table.ExpandTableColumn(#"Merged Queries", "Marketplace to Country", {"sales_marketplace"}, {"Sales Marketplace"}),
//     #"Add Column: Local Date & Time" = Table.AddColumn(#"Expanded Marketplace to Country", "Date - Local", each 
//     let
//         salesMarketplace = [Sales Marketplace],
//         purchaseDate = [#"purchase-date"],
//         year = Date.Year(purchaseDate),
//         startMarch = Date.From(#date(year,3, 1)), startMarch_dayOfWeek = Date.DayOfWeek(startMarch),
//              endMarch = Date.From(#date(year,3, 31)), endMarch_dayOfWeek = Date.DayOfWeek(endMarch),
//         startOctober = Date.From(#date(year,10, 1)), startOctober_dayOfWeek = Date.DayOfWeek(startOctober),
//              endOctober = Date.From(#date(year,10, 31)), endOctober_dayOfWeek = Date.DayOfWeek(endOctober),        
//         startNovember = Date.From(#date(year,11, 1)), startNovember_dayOfWeek = Date.DayOfWeek(startNovember),

// // US, CA, MX, US - Non-Amazon, CA - Non-Amazon
//     // Rule: Second Sunday of March to First Sunday of November        
//         secondSundayMarch = if startMarch_dayOfWeek = 0 then 7 + startMarch_dayOfWeek else 15 - startMarch_dayOfWeek,
//         firstSundayNovember = if startNovember_dayOfWeek = 0 then 1 else 8 - startNovember_dayOfWeek,

//         us_ca_dst_start = #datetimezone(year, Date.Month(startMarch), secondSundayMarch, 10, 0, 0, 0, 0),
//         us_ca_dst_end = #datetimezone(year, Date.Month(startNovember), firstSundayNovember, 9, 0, 0, 0, 0),
//         us_ca_timeZone = if purchaseDate >= us_ca_dst_start and purchaseDate <= us_ca_dst_end then 1 else 0,

// // MX, MX - Non-Amazon
//     // Rule: Second Sunday of March to First Sunday of November        
//     // Since the same rules apply and only the time differs we'll be using the same date parameters as US_CA
//         mx_dst_start = #datetimezone(year, Date.Month(startMarch), secondSundayMarch, 10, 0, 0, 0, 0),
//         mx_dst_end = #datetimezone(year, Date.Month(startNovember), firstSundayNovember, 9, 0, 0, 0, 0),
//         mx_timeZone = if purchaseDate >= mx_dst_start and purchaseDate <= mx_dst_end then 1 else 0,

    
// // GB, GB - Non-Amazon
//     // Rule: Last Sunday of March to Last Sunday of October
//         lastSundayMarch = Date.AddDays (endMarch, - endMarch_dayOfWeek),
//         lastSundayOctober = Date.AddDays (endOctober, - endOctober_dayOfWeek),

//         gb_dst_start = #datetimezone(year, Date.Month(startMarch), Date.Day(lastSundayMarch), 1, 0, 0, 0, 0),
//         gb_dst_end = #datetimezone(year, Date.Month(endOctober), Date.Day(lastSundayOctober), 2, 0, 0, 0, 0),
//         gb_timeZone = if purchaseDate >= gb_dst_start and purchaseDate <= gb_dst_end then 1 else 0,


// // BE, DE, ES, FR, IT, NL, PL, SE & all of  EU - Non-Amazon
//     // Rule: Last Sunday of March to Last Sunday of October
//     // Since the same rules apply and only the time differs we'll be using the same date parameters as GB
//         eu_dst_start = #datetimezone(year, Date.Month(startMarch), Date.Day(lastSundayMarch), 2, 0, 0, 0, 0),
//         eu_dst_end = #datetimezone(year, Date.Month(endOctober), Date.Day(lastSundayOctober), 3, 0, 0, 0, 0),
//         eu_timeZone = if purchaseDate >= eu_dst_start and purchaseDate <= eu_dst_end then 1 else 0

//     in
//         if salesMarketplace = "US" or salesMarketplace = "CA" or salesMarketplace = "BR" or salesMarketplace = "US - Non-Amazon" or salesMarketplace = "CA - Non-Amazon"
//         then DateTimeZone.RemoveZone ( DateTimeZone.SwitchZone ( purchaseDate, List.Sum ( {-8, us_ca_timeZone} ) ) ) 

//         else if salesMarketplace = "MX"
//         then DateTimeZone.RemoveZone ( DateTimeZone.SwitchZone ( purchaseDate, List.Sum ( {-6, mx_timeZone} ) ) )

//         else if salesMarketplace = "GB" or salesMarketplace ="GB - Non-Amazon"
//         then DateTimeZone.RemoveZone ( DateTimeZone.SwitchZone ( purchaseDate, List.Sum ( {0, gb_timeZone} ) ) )

//         else if salesMarketplace = "DE" or salesMarketplace = "ES" or salesMarketplace = "IT" or salesMarketplace = "NL" or salesMarketplace = "BE" or salesMarketplace = "PL" or salesMarketplace = "SE" or salesMarketplace = "FR" or salesMarketplace = "DE - Non-Amazon"or salesMarketplace = "ES - Non-Amazon" or salesMarketplace = "IT - Non-Amazon"
//         then DateTimeZone.RemoveZone ( DateTimeZone.SwitchZone ( purchaseDate, List.Sum ( {+1, eu_timeZone} ) ) )

//         else if salesMarketplace = "TR"
//         then DateTimeZone.RemoveZone ( DateTimeZone.SwitchZone ( purchaseDate, 3 ) )
        
//         else "False",
//         type datetime
// ),
//     #"Inserted Time" = Table.AddColumn(#"Add Column: Local Date & Time", "Time", each DateTime.Time([#"Date - Local"]), type time),
//     #"Changed Type: Local Date & Time" = Table.TransformColumnTypes(#"Inserted Time",{{"Date - Local", type date}}),
//     #"Key Column: Sales Marketplace | SKU" = Table.AddColumn(#"Changed Type: Local Date & Time", "Key Column: Marketplace | SKU", each [Sales Marketplace] & " | " & [sku], type text),
//     #"Filter: Date - Local - 1" = Table.SelectRows(#"Key Column: Sales Marketplace | SKU", each [#"Date - Local"] <= Date.From(DateTime.LocalNow()) - #duration(1, 0, 0, 0)),
//     #"Removed Concatenation Helper Columns" = Table.SelectColumns(#"Filter: Date - Local - 1",{"amazon-order-id", "merchant-order-id", "order-status", "item-status", "is-business-order", "item-price", "quantity", "item-tax", "shipping-price", "shipping-tax", "gift-wrap-price", "gift-wrap-tax", "item-promotion-discount", "Date - Local", "Time", "Key Column: Marketplace | SKU"}),

//     #"Renamed Columns" = Table.RenameColumns(#"Removed Concatenation Helper Columns",{{"amazon-order-id", "Amazon Order Id"}, {"order-status", "Order Status"}, {"item-status", "Item Status"}, {"quantity", "Quantity"}, {"item-price", "Item Price"},{"item-promotion-discount", "Item Promotion Discount"}}),
//     Custom1 = #"Renamed Columns" meta [orderIdAndSku = #"Filter: Date - Local - 1"]
// in
//     Custom1



// let
//     tableCombine = silver_fAllOrders,
//     added_taxAfterPrice = Table.AddColumn(tableCombine, "tax_after_price", each 
// if Text.StartsWith([Sales Marketplace], "US") or Text.StartsWith([Sales Marketplace], "CA")
// then [#"item-tax"] + [#"shipping-tax"] + [#"gift-wrap-tax"]
// else 0, type number),
//     added_taxWithinPrice = Table.AddColumn(added_taxAfterPrice, "tax_within_price", each 
// if not Text.StartsWith([Sales Marketplace], "US") and not Text.StartsWith([Sales Marketplace], "CA")
// then [#"item-tax"] + [#"shipping-tax"] + [#"gift-wrap-tax"]
// else 0, type number),
//     removedOtherColumns = Table.SelectColumns(added_taxWithinPrice,{"amazon-order-id", "merchant-order-id", "order-status", "item-status", "quantity", "currency", "item-price", "item-promotion-discount", "ship-promotion-discount", "promotion-ids", "Date - Local", "Time", "Key Column: Marketplace | SKU", "tax_after_price", "tax_within_price"}),
//     #"Renamed Columns" = Table.RenameColumns(removedOtherColumns,{{"Date - Local", "date_all_orders"}, {"item-status", "item_status"}, {"item-price", "item_price"}, {"item-promotion-discount", "item_promotion_discount"}, {"Key Column: Marketplace | SKU", "key_marketplace_sku"}, {"promotion-ids", "promotion_ids"}}),
//     #"Removed Columns" = Table.RemoveColumns(#"Renamed Columns",{"amazon-order-id", "order-status", "ship-promotion-discount"}),
//     #"Renamed Columns1" = Table.RenameColumns(#"Removed Columns",{{"Time", "time_all_orders"}}),
//     #"Removed Columns1" = Table.RemoveColumns(#"Renamed Columns1",{"merchant-order-id"})
// in
//     #"Removed Columns1"



let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Sales_Returns.vw_full_all_orders"),
    #"Removed Other Columns" = Table.SelectColumns(Source,{"order_id_SK", "currency", "date_all_orders", "time_all_orders", "item_status", "key_marketplace_sku", "promotion_ids", "quantity", "item_price", "item_promotion_discount", "ship_promotion_discount", "tax_after_price", "tax_within_price"})
in
    #"Removed Other Columns"
```


### `f.AmazonFulfilledShipments`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `shipped_quantity` int64, `currency` string, `item_price` double, `FC` string, `order_id_SK` int64, `shipment_date` dateTime, `key_marketplace_sku` string  
```powerquery
let
    Source = Table.Combine({raw_usCaMx_amazonFulfilledShipments, raw_gbEu_amazonFulfilledShipments}),
    merged_d.AmazonOrderId = Table.NestedJoin(Source, {"Amazon Order Id"}, d.AmazonOrderId, {"amazon_order_id"}, "d.AmazonOrderId", JoinKind.LeftOuter),
    expanded_d.AmazonOrderId = Table.ExpandTableColumn(merged_d.AmazonOrderId, "d.AmazonOrderId", {"order_id_SK", "sales_marketplace"}, {"order_id_SK", "sales_marketplace"}),
    #"Key Column: Marketplace | SKU" = Table.AddColumn(expanded_d.AmazonOrderId, "key_marketplace_sku", each [sales_marketplace] & " | " & [Merchant SKU], type text),
    extractedDate = Table.TransformColumns(#"Key Column: Marketplace | SKU",{{"Purchase Date", DateTime.Date, type date}, {"Shipment Date", DateTime.Date, type date}}),
    #"Removed Other Columns" = Table.SelectColumns(extractedDate,{"Shipment Date", "Shipped Quantity", "Currency", "Item Price", "FC", "order_id_SK", "key_marketplace_sku"}),
    #"Renamed Columns" = Table.RenameColumns(#"Removed Other Columns",{{"Currency", "currency"}, {"Item Price", "item_price"}, {"Shipment Date", "shipment_date"}, {"Shipped Quantity", "shipped_quantity"}})
in
    #"Renamed Columns"
```


### `f.FBACustomerReturns`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `quantity` int64, `reason` string, `status` string, `is_sellable` string, `date_fba_customer_return` dateTime, `fulfillment_center_id` string, `detailed_disposition` string, `license_plate_number` string, `customer_comments` string, `purchase_date` dateTime, `key_marketplace_sku` string, `order_id_SK` int64, `order_id_sk | key_marketplace_sku' = 'f.FBACustomerReturns'[order_id_SK] & " | " & 'f.FBACustomerReturns'[key_marketplace_sku]`, `Return Reason Group' =`  
```powerquery
// let
//     Source = #"FBA Customer Returns (raw)",
//     #"Merged Queries" = 
//         Table.NestedJoin(
//    Source, {"order-id", "sku"}, 
//    Table.Distinct(Table.SelectColumns(
//       Value.Metadata(#"All Orders")[orderIdAndSku], 
//       {"amazon-order-id", "sku", "Date - Local","Key Column: Marketplace | SKU"})), 
//       {"amazon-order-id", "sku"}, "ALL Orders", JoinKind.LeftOuter),
//     #"Expanded ALL Orders" = Table.ExpandTableColumn(#"Merged Queries", "ALL Orders", {"Date - Local", "Key Column: Marketplace | SKU"}, {"Purchase Date", "Key Column: Marketplace | SKU"}),
//     #"Added Custom" = Table.AddColumn(#"Expanded ALL Orders", "is_sellable", each if [#"detailed-disposition"] = "SELLABLE" then "Sellable" else "Non-Sellable", type text),
//     #"Removed Other Columns" = Table.SelectColumns(#"Added Custom",{"return-date", "order-id", "quantity", "fulfillment-center-id", "detailed-disposition", "reason", "status", "license-plate-number", "customer-comments", "Purchase Date", "Key Column: Marketplace | SKU", "is_sellable"}),
//     #"Renamed Columns" = Table.RenameColumns(#"Removed Other Columns",{{"return-date", "date_fba_customer_return"}, {"customer-comments", "customer_comments"}, {"detailed-disposition", "detailed_disposition"}, {"fulfillment-center-id", "fulfillment_center_id"}, {"Key Column: Marketplace | SKU", "Key Column: Marketplace | SKU"}, {"license-plate-number", "license_plate_number"}, {"order-id", "order_id"}})
// in
//     #"Renamed Columns"


let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Sales_Returns.vw_full_fba_customer_returns"),
    #"Removed Other Columns1" = Table.SelectColumns(Source,{"order_id_SK", "date_fba_customer_return", "purchase_date", "key_marketplace_sku", "quantity", "fulfillment_center_id", "detailed_disposition", "reason", "status", "license_plate_number", "customer_comments"}),
    #"Added Custom" = Table.AddColumn(#"Removed Other Columns1", "is_sellable", each if [#"detailed_disposition"] = "SELLABLE" then "Sellable" else "Non-Sellable", type text)
in
    #"Added Custom"
```


### `f.us_returns_processing_fee`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `date_shipment` dateTime, `date_charge` dateTime, `key_marketplace_fnsku` string, `asin_fee_category` string, `currency` string, `asin_return_threshold_percent` double, `sku_returned_units_charged` int64, `sku_returned_units_NSP_exempted` int64, `sku_fee_per_unit` double, `sku_returns_fee` double  
```powerquery
let
    Source = Folder.Files(path_to_files & "amazon_seller_central\fulfillment\payments_returns_processing_fee\us_returns_processing_fee"),
    #"Filtered Hidden Files1" = Table.SelectRows(Source, each [Attributes]?[Hidden]? <> true),
    #"Invoke Custom Function1" = Table.AddColumn(#"Filtered Hidden Files1", "Transform File (10)", each #"Transform File (10)"([Content])),
    #"Renamed Columns1" = Table.RenameColumns(#"Invoke Custom Function1", {"Name", "Source.Name"}),
    #"Removed Other Columns1" = Table.SelectColumns(#"Renamed Columns1", {"Source.Name", "Transform File (10)"}),
    #"Expanded Table Column1" = Table.ExpandTableColumn(#"Removed Other Columns1", "Transform File (10)", Table.ColumnNames(#"Transform File (10)"(#"Sample File (10)"))),
    changed_type_full_table = Table.TransformColumnTypes(#"Expanded Table Column1",{{"Source.Name", type text}, {"asin", type text}, {"asin_fee_category", type text}, {"fnsku", type text}, {"product_name", type text}, {"longest_side", type number}, {"median_side", type number}, {"shortest_side", type number}, {"measurement-units", type text}, {"unit_weight", type number}, {"dimensional_weight", type number}, {"shipping_weight", type number}, {"weight_units", type text}, {"sku_sizetier", type text}, {"month_of_shipment", type date}, {"asin_shipped_units", Int64.Type}, {"asin_return_threshold_percent", type number}, {"asin_return_threshold_units", Int64.Type}, {"asin_returned_units", Int64.Type}, {"sku_returned_units_NSP_exempted", Int64.Type}, {"sku_returned_units_charged", Int64.Type}, {"sku_fee_per_unit", type number}, {"sku_returns_fee", type number}, {"month_of_charge", type date}, {"currency", type text}}),
    renamed_columns = Table.RenameColumns(changed_type_full_table,{{"measurement-units", "measurement_units"}, {"month_of_shipment", "date_shipment"}, {"month_of_charge", "date_charge"}}),
    added_marketplace = Table.AddColumn(renamed_columns, "marketplace", each "US", type text),
    added_key_marketplace_fnsku = Table.AddColumn(added_marketplace, "key_marketplace_fnsku", each [marketplace] & " | " & [fnsku], type text),
    // added_key_marketplace_asin = Table.AddColumn(added_key_marketplace_fnsku, "key_marketplace_asin", each [marketplace] & " | " & [asin], type text),
    selected_columns = Table.SelectColumns(added_key_marketplace_fnsku,{"asin", "asin_fee_category", "longest_side", "median_side", "shortest_side", "measurement_units", "unit_weight", "dimensional_weight", "shipping_weight", "weight_units", "sku_sizetier", "date_shipment", "asin_return_threshold_percent", "sku_returned_units_NSP_exempted", "sku_returned_units_charged", "sku_fee_per_unit", "sku_returns_fee", "date_charge", "currency", "key_marketplace_fnsku"}),
    selected_important_columns = Table.SelectColumns(selected_columns,{"asin_fee_category", "date_shipment", "asin_return_threshold_percent", "sku_returned_units_NSP_exempted", "sku_returned_units_charged", "sku_fee_per_unit", "sku_returns_fee", "date_charge", "currency", "key_marketplace_fnsku"})
in
    selected_important_columns
```


### `f_aging_projection`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `file_date` dateTime, `simulation` int64, `date_aging_projection` dateTime, `inbound_date` dateTime, `current_inventory` double, `inventory_by_inbound_shipments` double, `range` string, `aging_surcharge` double, `has_surcharge` boolean, `estimated_storage_fee_aging_inventory` double, `key_inventory_region_sku` string, `aging_bucket = ````, `aging_bucket_order =`  
```powerquery
let
    Source = Folder.Files(path_to_files & "standalone_files\db_aging_projection"),
    selected_parent_folder = Table.SelectRows(Source, each ([Folder Path] = path_to_files & "standalone_files\db_aging_projection\")),

    filtered_hidden_files = Table.SelectRows(selected_parent_folder, each [Attributes]?[Hidden]? <> true),
    
    add_year_month = Table.AddColumn(filtered_hidden_files, "YearMonthGroupBy", each Text.From(Date.Year([Date created])) & "-" & Text.PadStart(Text.From(Date.Month([Date created])), 2, "0"), type text),
    sort_by_date_asc = Table.Sort(add_year_month, {{"Date created", Order.Ascending}}),
    // Capturando o 1º arquivo do mês do diretório pela Date created
    group_by_year_month = Table.Group(sort_by_date_asc, {"YearMonthGroupBy"}, {{"FirstFile", each Table.FirstN(_, 1), type table}}),
    expand_first_file = Table.ExpandTableColumn(group_by_year_month, "FirstFile", {"Content", "Name", "Extension", "Date created", "YearMonth"}),
    sort_by_date_desc = Table.Sort(add_year_month, {{"Date created", Order.Descending}}),
    last_file = Table.FirstN(sort_by_date_desc, 1),
    // Capturando o último arquivo do diretório pela Date created
    combined_files = Table.Combine({expand_first_file, last_file}),

    // Removendo duplicata para o caso em que o primeiro arquivo do mês == arquivo mais recente do diretório pela Date created
    remove_duplicates = Table.Distinct(combined_files, {"Name"}),
    //Passos criados a partir da explosão do content das tabelas
    #"Filtered Hidden Files1" = Table.SelectRows(remove_duplicates, each [Attributes]?[Hidden]? <> true),
    #"Invoke Custom Function1" = Table.AddColumn(#"Filtered Hidden Files1", "Transform File (14)", each #"Transform File (14)"([Content])),
    #"Removed Other Columns1" = Table.SelectColumns(#"Invoke Custom Function1",{"Name", "Transform File (14)"}),
    #"Expanded Table Column1" = Table.ExpandTableColumn(#"Removed Other Columns1", "Transform File (14)", Table.ColumnNames(#"Transform File (14)"(#"Sample File (14)"))),
    droped_blank_rows = Table.SelectRows(#"Expanded Table Column1", each ([Simulation Date] <> null)),
    got_date_created = Table.TransformColumns(droped_blank_rows,{{"Name", each Text.From(Date.Month(Date.FromText(Text.Middle(_, 0, 10)))) & "/" & Text.From(Date.Day(Date.FromText(Text.Middle(_, 0, 10)))) & "/" & Text.From(Date.Year(Date.FromText(Text.Middle(_, 0, 10)))), type text}}),
    changed_type_full_table = Table.TransformColumnTypes(got_date_created,{{"Simulation", Int64.Type}, {"Simulation Date", type date}, {"Inbound Date", type date}, {"Inventory Region", type text}, {"SKU", type text}, {"Inbound Shipments", Int64.Type}, {"Item Volume", type number}, {"Current Inventory", type number}, {"Cumulated Inbound Shipments", Int64.Type}, {"Inventory by Inbound Shipments", type number}, {"Cumulated Inventory by Inbound Shipments", type number}, {"Aging", Int64.Type}, {"Aging_Weighted", type number}, {"Range", type text}, {"Aging Surcharge", type number}, {"Has Surcharge", type logical}, {"Inventory Target for zero surcharge", Int64.Type}, {"Inventory Start", Int64.Type}, {"Number of Days", Int64.Type}, {"Target Sales", Int64.Type}, {"Current Moving Average Sales", Int64.Type}, {"Target Velocity", type number}, {"Estimated Storage Fee Current Inventory", type number}, {"Estimated Storage Fee Aging Inventory", type number}}),
    changedDateType = Table.TransformColumnTypes(changed_type_full_table, {{"Name", type date}}, "en-US"),
    #"Renamed Columns" = Table.RenameColumns(changedDateType,{{"Year-Month", "year_month"}}),
    added_key_inventory_region_sku = Table.AddColumn(#"Renamed Columns", "key_inventory_region_sku", each [Inventory Region] & " | " & [SKU]),
    renamed_columns = Table.RenameColumns(added_key_inventory_region_sku,{{"Name", "file_date"}, {"Simulation", "simulation"}, {"Simulation Date", "date_aging_projection"}, {"Inventory Region", "inventory_region"}, {"Inbound Date", "inbound_date"}, {"Inventory by Inbound Shipments", "inventory_by_inbound_shipments"}, {"Current Inventory", "current_inventory"}, {"Aging", "aging"}, {"Aging_Weighted", "aging_weighted"}, {"Range", "range"}, {"Aging Surcharge", "aging_surcharge"}, {"Has Surcharge", "has_surcharge"}, {"Inventory Target for zero surcharge", "inventory_target_for_zero_surcharge"}, {"Inventory Start", "inventory_start"}, {"Target Sales", "target_sales"}, {"Number of Days", "number_of_days"}, {"Target Velocity", "target_velocity"}, {"Current Moving Average Sales", "current_movinga_average_sales"}, {"Estimated Storage Fee Current Inventory", "estimated_storage_fee_current_inventory"}, {"Estimated Storage Fee Aging Inventory", "estimated_storage_fee_aging_inventory"}}),
    selected_important_columns = Table.SelectColumns(renamed_columns,{"file_date", "simulation", "date_aging_projection", "inbound_date", "current_inventory", "inventory_by_inbound_shipments", "range", "aging_surcharge", "has_surcharge", "estimated_storage_fee_aging_inventory", "key_inventory_region_sku"})
in
    selected_important_columns
```


### `f_aux_promo_tracker`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `Current Price` double, `Title Description` string, `Objective` string, `activeDate` dateTime, `pricePromotionAction` string, `keyInventoryRegionSku` string, `keyCountryAsin` string, `actionDescription` string, `Category = ````, `Simulated Price` double  
```powerquery
let
    source = Excel.Workbook(
        File.Contents(rootPathLang & "OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_promotion_tracker.xlsx"), 
        true, 
        true
    ),
    dbSheet = source{[Item = "db", Kind = "Sheet"]}[Data],
    changedType = Table.TransformColumnTypes(dbSheet, {
        {"Country", type text}, 
        {"Native Family", type text}, 
        {"ASIN", type text}, 
        {"Base SKU", type text}, 
        {"Inventory Region | Base SKU", type text}, 
        {"SKU", type text}, 
        {"Final ABC Classification", type any}, 
        {"Amazon Inventory", type any}, 
        {"Weekly Velocity", type any}, 
        {"Last 3Weeks Average Units Sold", type any}, 
        {"Var%", type any}, 
        {"Warehouse Inventory", type any}, 
        {"Amazon  Inventory Coverage (Days)", type any}, 
        {"Qty Inbound Next 4 Weeks", type any}, 
        {"Projected Loss of Sales Next 9 Weeks", type any}, 
        {"Overstock Estimated Aditional Coverage", type any}, 
        {"Overstock Snapshot (With Orders)", type any}, 
        {"Aging Units above 181days", type any}, 
        {"Current Price", type any}, 
        {"Simulated Price", type number}, 
        {"% Coupon Discount", type any}, 
        {"Amount Discount", type any}, 
        {"Commercial Margin", type any}, 
        {"% Operational Margin", type any}, 
        {"%Tacos", type any}, 
        {"Sales Reference for the Action (based on Velocity)", type any}, 
        {"Sales Target for the Action", type any}, 
        {"Units Sold", Int64.Type}, 
        {"Inventory Status", type any}, 
        {"Price / Promotion Action", type text}, 
        {"Discount Type", type text}, 
        {"Title Description", type text}, 
        {"Objective", type any}, 
        {"Start Date", type date}, 
        {"End Date", type date}, 
        {"Notes", type text}, 
        {"Insert Date", type datetime}, 
        {"Insert User", type text}, 
        {"Key", type text}
    }),
    filteredRows = Table.SelectRows(changedType, each [Start Date] >= #date(2024, 1, 1)),
    removedDateErrors = Table.RemoveRowsWithErrors(filteredRows, {"End Date"}),
    isAging = Table.AddColumn(removedDateErrors, "isAging", each 
        if [Notes] = null then 0 
        else if Text.Contains(Text.Lower([Notes]), "aging") then 1 
        else 0, Int64.Type
    ),
    createdKey = Table.AddColumn(isAging, "keyInventoryRegionSku", each 
        Text.Combine({Text.Start([#"Inventory Region | Base SKU"], 2), [SKU]}, " | "), type text
    ),
    selectedColumns = Table.SelectColumns(createdKey, {
        "Country", "Native Family", "ASIN", "Base SKU", "SKU", "Current Price", "Simulated Price", 
        "% Coupon Discount", "Amount Discount", "Commercial Margin", "% Operational Margin", "%Tacos", 
        "Price / Promotion Action", "Discount Type", "Title Description", "Objective", "Start Date", 
        "End Date", "isAging", "keyInventoryRegionSku"
    }),
    removedDuplicates = Table.Distinct(selectedColumns, {
        "Start Date", "End Date", "keyInventoryRegionSku", "Price / Promotion Action"
    }),
    capitalizedColumns = Table.TransformColumns(removedDuplicates, {
        {"Discount Type", Text.Proper, type text}, 
        {"Price / Promotion Action", Text.Proper, type text}
    }),
    renamedColumns = Table.RenameColumns(capitalizedColumns, {
        {"Price / Promotion Action", "pricePromotionAction"}, 
        {"Discount Type", "discountType"}, 
        {"Start Date", "startDate"}, 
        {"End Date", "endDate"}
    }),
    replacedNullEndDate = Table.ReplaceValue(renamedColumns, null, DateTime.Date(DateTime.LocalNow()), Replacer.ReplaceValue, {"endDate"}),
    correctedEndDate = Table.AddColumn(replacedNullEndDate, "endDateTemp", each 
        if [pricePromotionAction] = null or Text.Trim([pricePromotionAction]) = "" then [endDate]
        else if Text.Contains(Text.Lower([pricePromotionAction]), "price") then [startDate]
        else [endDate], type date
    ),
    removedOldEndDate = Table.RemoveColumns(correctedEndDate, {"endDate"}),
    finalEndDate = Table.RenameColumns(removedOldEndDate, {{"endDateTemp", "endDate"}}),
    addedActiveDate = Table.AddColumn(finalEndDate, "activeDate", each 
        let 
            days = Duration.Days([endDate] - [startDate])
        in 
            if days >= 0 then 
                List.Dates([startDate], days + 1, #duration(1, 0, 0, 0)) 
            else 
                { [startDate] }
    ),
    expandedActiveDate = Table.ExpandListColumn(addedActiveDate, "activeDate"),
    reorderedColumns = Table.ReorderColumns(expandedActiveDate, {
        "startDate", "endDate", "activeDate", "pricePromotionAction", "discountType", 
        "isAging", "keyInventoryRegionSku"
    }),
    changedType2 = Table.TransformColumnTypes(reorderedColumns, {
        {"Current Price", type number}, {"activeDate", type date}
    }),
    addedKeyCountryASIN = Table.AddColumn(changedType2, "keyCountryAsin", each 
        Text.Combine({[Country], [ASIN]}, " | "), type text
    ),
    extractedActionDescription = Table.AddColumn(addedKeyCountryASIN, "actionDescription", each 
        Text.AfterDelimiter([Title Description], "_", {0, RelativePosition.FromEnd}), type text
    ),
    replacedValue1 = Table.ReplaceValue(extractedActionDescription, "Ped", "PED", Replacer.ReplaceText, {"pricePromotionAction"}),
    replacedValue2 = Table.ReplaceValue(replacedValue1, "---", "", Replacer.ReplaceText, {"actionDescription"}),
    #"Removed Other Columns" = Table.SelectColumns(replacedValue2,{"Current Price", "Simulated Price", "Title Description", "Objective", "activeDate", "pricePromotionAction", "keyInventoryRegionSku", "keyCountryAsin", "actionDescription"})
in
    #"Removed Other Columns"
```


### `f_db_base_price`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `date_base_price` dateTime, `key_salesCountry_nativeFamily` string, `base_price` double  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\db_market_base_price.xlsx"), true, true),
    db_base_price_Sheet = Source{[Item="db_base_price",Kind="Sheet"]}[Data],
    renamedColumns = Table.RenameColumns(db_base_price_Sheet,{{"Update", "date_base_price"}, {"Base Price", "base_price"}, {"Country", "country"}, {"Native Family", "native_family"}}),
    changedType = Table.TransformColumnTypes(renamedColumns,{{"date_base_price", type date}, {"country", type text}, {"native_family", type text}, {"base_price", type number}}),
    key_salesCountry_nativeFamily = Table.AddColumn(changedType, "key_salesCountry_nativeFamily", each [country] & " | " & [native_family], type text),
    keepImportantColumns = Table.SelectColumns(key_salesCountry_nativeFamily,{"date_base_price", "key_salesCountry_nativeFamily", "base_price"})
in
    keepImportantColumns
```


### `f_db_loss_leader`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `start_date` dateTime, `end_date` dateTime, `country` string, `sku` string, `price` double, `activeDate` dateTime, `key_country_sku` string  
```powerquery
let
    Source = Excel.Workbook(File.Contents(rootPathLang & "OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_loss_leader.xlsx"), null, true),
    Sheet1_Sheet = Source{[Item="Sheet1",Kind="Sheet"]}[Data],
    promotedHeaders = Table.PromoteHeaders(Sheet1_Sheet, [PromoteAllScalars=true]),
    selectedColumns = Table.SelectColumns(promotedHeaders,{"start_date", "end_date", "country", "sku", "price"}),
    changedType = Table.TransformColumnTypes(selectedColumns,
        {{"price", type number}, {"country", type text}, {"sku", type text}, {"end_date", type date}, {"start_date", type date}}
        ),
    replacedNullEndDate = Table.ReplaceValue(changedType, null, DateTime.Date(DateTime.LocalNow()), Replacer.ReplaceValue, {"end_date"}),
    addedActiveDate = Table.AddColumn(replacedNullEndDate, "activeDate", each 
        let 
            days = Duration.Days([end_date] - [start_date])
        in 
            if days >= 0 then 
                List.Dates([start_date], days + 1, #duration(1, 0, 0, 0)) 
            else 
                { [start_date] }
    ),
    expandedActiveDate = Table.ExpandListColumn(addedActiveDate, "activeDate"),
    #"Inserted Merged Column" = Table.AddColumn(expandedActiveDate, "key_country_sku", each Text.Combine({[country], [sku]}, " | "), type text),
    #"Changed Type" = Table.TransformColumnTypes(#"Inserted Merged Column",{{"activeDate", type date}})
in
    #"Changed Type"
```


### `f_db_market_price`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `date_market_price` dateTime, `key_salesCountry_nativeFamily` string, `market_price` double, `promo_price` double, `loss_leader` double, `Coments` string  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\db_market_base_price.xlsx"), true, true),
    db_market_price_Sheet = Source{[Item="db_market_price",Kind="Sheet"]}[Data],
    rename_columns = Table.RenameColumns(db_market_price_Sheet,{{"Update", "date_market_price"}, {"Country", "country"}, {"Native Family", "native_family"}, {"Market Price", "market_price"}, {"Promo Price", "promo_price"}, {"Loss Leader", "loss_leader"}}),
    replace_hyphen = Table.ReplaceValue(rename_columns,"-","",Replacer.ReplaceValue,{"market_price", "promo_price", "loss_leader"}),
    change_type = Table.TransformColumnTypes(replace_hyphen,{{"date_market_price", type date}, {"country", type text}, {"native_family", type text}, {"market_price", type number}, {"promo_price", type number}, {"loss_leader", type number}, {"Coments", type text}}),
    key_salesCountry_nativeFamily = Table.AddColumn(change_type, "key_salesCountry_nativeFamily", each [country] & " | " & [native_family], type text),
    select_cols = Table.SelectColumns(key_salesCountry_nativeFamily,{"date_market_price", "key_salesCountry_nativeFamily", "market_price", "loss_leader", "promo_price", "Coments"})
in
    select_cols
```


### `f_promotion_tracker`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `price_promotion_action` string, `start_date` dateTime, `end_date` dateTime, `is_aging` int64, `key_inventory_region_sku` string, `discount_type` string, `Category = ````  
```powerquery
let
    Source = Excel.Workbook(File.Contents(rootPathLang & "OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_promotion_tracker.xlsx"), true, true),
    db_Sheet = Source{[Item="db",Kind="Sheet"]}[Data],
    changed_type_full_table = Table.TransformColumnTypes(db_Sheet,{{"Country", type text}, {"Native Family", type text}, {"ASIN", type text}, {"Base SKU", type text}, {"Inventory Region | Base SKU", type text}, {"SKU", type text}, {"Final ABC Classification", type any}, {"Amazon Inventory", type any}, {"Weekly Velocity", type any}, {"Last 3Weeks Average Units Sold", type any}, {"Var%", type any}, {"Warehouse Inventory", type any}, {"Amazon  Inventory Coverage (Days)", type any}, {"Qty Inbound Next 4 Weeks", type any}, {"Projected Loss of Sales Next 9 Weeks", type any}, {"Overstock Estimated Aditional Coverage", type any}, {"Overstock Snapshot (With Orders)", type any}, {"Aging Units above 181days", type any}, {"Current Price", type any}, {"Simulated Price", type number}, {"% Coupon Discount", type any}, {"Amount Discount", type any}, {"Commercial Margin", type any}, {"% Operational Margin", type any}, {"%Tacos", type any}, {"Sales Reference for the Action (based on Velocity)", type any}, {"Sales Target for the Action", type any}, {"Units Sold", Int64.Type}, {"Inventory Status", type any}, {"Price / Promotion Action", type text}, {"Discount Type", type text}, {"Title Description", type text}, {"Objective", type any}, {"Start Date", type date}, {"End Date", type date}, {"Notes", type text}, {"Insert Date", type datetime}, {"Insert User", type text}, {"Key", type text}}),
    // Removendo "Fixed Price" da coluna end_date. Parece ter acontecido algum erro na macro do promotion tracker que gravou os valores da coluna "discount type"
    #"Removed Errors" = Table.RemoveRowsWithErrors(changed_type_full_table, {"End Date"}),
    is_aging = Table.AddColumn(#"Removed Errors", "is_aging", each if [Notes] = null then 0 else if Text.Contains(Text.Lower([Notes]), "aging") then 1 else 0, Int64.Type),
    created_foreign_key = Table.AddColumn(is_aging, "key_inventory_region_sku", each Text.Combine({Text.Start([#"Inventory Region | Base SKU"], 2), [SKU]}, " | "), type text),
    selected_important_columns = Table.SelectColumns(created_foreign_key,{"Price / Promotion Action", "Discount Type", "Start Date", "End Date", "is_aging", "key_inventory_region_sku"}),
    // Removendo potenciais erros de input e/ou esquecimento de deletar o promocionamento anterior ao subir um novo
    removed_duplicates = Table.Distinct(selected_important_columns, {"Start Date", "End Date", "key_inventory_region_sku", "Price / Promotion Action"}),
    capitalized_category_columns = Table.TransformColumns(removed_duplicates,{{"Discount Type", Text.Proper, type text}, {"Price / Promotion Action", Text.Proper, type text}}),
    renamed_columns = Table.RenameColumns(capitalized_category_columns,{{"Price / Promotion Action", "price_promotion_action"}, {"Discount Type", "discount_type"}, {"Start Date", "start_date"}, {"End Date", "end_date"}}),
    reordered_columns = Table.ReorderColumns(renamed_columns,{"start_date", "end_date", "price_promotion_action", "discount_type", "is_aging", "key_inventory_region_sku"})
in
    reordered_columns
```


### `f_storage_fee_rate`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `date_update` dateTime, `inventory_region` string, `value` double, `quarter` string  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\db.storagefee_rate.xlsx"), true, true),
    Storage_Fee_Rate_Sheet = Source{[Item="Storage_Fee_Rate",Kind="Sheet"]}[Data],
    changed_type_full_table = Table.TransformColumnTypes(Storage_Fee_Rate_Sheet,{{"DATA UPDATE", type date}, {"DATA QUARTER", type date}, {"QUARTER", type text}, {"COUNTRY", type text}, {"VALUE", type number}}),
    selected_columns = Table.SelectColumns(changed_type_full_table,{"DATA UPDATE", "QUARTER", "COUNTRY", "VALUE"}),
    renamed_columns = Table.RenameColumns(selected_columns,{{"DATA UPDATE", "date_update"}, {"QUARTER", "quarter"}, {"COUNTRY", "inventory_region"}, {"VALUE", "value"}})
in
    renamed_columns
```


### `fact.aged_inventory_surcharge`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `date_charge` dateTime, `key_inventory_country_sku` string, `condition` string, `item_volume` double, `unit_of_volume` string, `qty-charged` int64, `rate-surcharge` double, `surcharge-age-tier` string, `currency` string, `year_month` dateTime, `rate_surcharge_usd =`  
```powerquery
let
    Source = Folder.Files(path_to_files & "amazon_seller_central\fulfillment\payments_aged_inventory_surcharge"),

    // Etapa criada automaticamente ao se realizar a expansão do content das tabelas
    #"Filtered Hidden Files1" = Table.SelectRows(Source, each [Attributes]?[Hidden]? <> true),
    // Etapa criada automaticamente ao se realizar a explosão do content das tabelas
    #"Invoke Custom Function1" = Table.AddColumn(#"Filtered Hidden Files1", "Transform File (21)", each #"Transform File (21)"([Content])),
    // Etapa criada automaticamente ao se realizar a expansão do content das tabelas
    #"Renamed Columns1" = Table.RenameColumns(#"Invoke Custom Function1", {"Name", "Source.Name"}),
    // Etapa criada automaticamente ao se realizar a expansão do content das tabelas
    #"Removed Other Columns1" = Table.SelectColumns(#"Renamed Columns1", {"Source.Name", "Transform File (21)"}),
    // Etapa criada automaticamente ao se realizar a expansão do content das tabelas
    #"Expanded Table Column1" = Table.ExpandTableColumn(#"Removed Other Columns1", "Transform File (21)", Table.ColumnNames(#"Transform File (21)"(#"Sample File (21)"))),
    droped_files_no_data_avaible = Table.SelectRows(#"Expanded Table Column1", each [sku] <> null and [sku] <> ""),
    changed_type_full_table = Table.TransformColumnTypes(droped_files_no_data_avaible,{{"Source.Name", type text}, {"snapshot-date", type datetimezone}, {"sku", type text}, {"fnsku", type text}, {"asin", type text}, {"product-name", type text}, {"condition", type text}, {"per-unit-volume", type number}, {"currency", type text}, {"volume-unit", type text}, {"country", type text}, {"qty-charged", Int64.Type}, {"amount-charged", type number}, {"surcharge-age-tier", type text}, {"rate-surcharge", type number}}),
    converted_datetimezone_to_date = Table.TransformColumns(changed_type_full_table, {{"snapshot-date", Date.From, type date}}),
    added_key_inventory_country_sku = Table.AddColumn(changed_type_full_table, "key_inventory_country_sku", each [country] & " | " & [sku]),
    selected_important_columns = Table.SelectColumns(added_key_inventory_country_sku,{"snapshot-date", "condition", "per-unit-volume", "currency", "volume-unit", "qty-charged", "surcharge-age-tier", "rate-surcharge", "key_inventory_country_sku"}),
    renamed_columns = Table.RenameColumns(selected_important_columns,{{"snapshot-date", "date_charge"}, {"per-unit-volume", "item_volume"}, {"volume-unit", "unit_of_volume"}}),
    reordered_columns = Table.ReorderColumns(renamed_columns,{"date_charge", "key_inventory_country_sku", "condition", "item_volume", "unit_of_volume", "qty-charged", "rate-surcharge", "surcharge-age-tier", "currency"}),
    changed_data_type = Table.TransformColumnTypes(reordered_columns,{{"date_charge", type date}}),
    // Coluna criada pois não consegui achar um modo mais refinado de fazer um cálculo do distinct count de Year-Month da tabela 'Calendar' na medida $_actual_aging_cost
    created_year_month = Table.AddColumn(changed_data_type, "year_month", each Date.StartOfMonth([date_charge]), type date)
in
    created_year_month
```


### `fact_amz_business_report`

**Modo:** `import`  **Grupo:** `'Amazon\Business Reports'`  
**Colunas:** `marketplace` string, `date` dateTime, `parent_asin` string, `child_asin` string, `mobile_app_sessions` int64, `browser_sessions` int64, `total_sessions` int64, `mobile_app_page_views` int64, `browser_page_views` int64, `total_page_views` int64, `units_ordered` int64, `ordered_product_sales` double, `total_order_items` int64, `ordered_product_sales_currency_code` string, `key_country_asin` string, `buy_box_percentage` double  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.2_Silver_Business_Reports.vw_business_report_by_child"),
    selectedColumns = Table.SelectColumns(Source,{"marketplace", "date", "parent_asin", "child_asin", "mobile_app_sessions", "browser_sessions", "total_sessions", "mobile_app_page_views", "browser_page_views", "total_page_views", "buy_box_percentage", "units_ordered", "ordered_product_sales", "total_order_items", "ordered_product_sales_currency_code"}),
    insertedKeyColumn = Table.AddColumn(selectedColumns, "key_country_asin", each Text.Combine({[marketplace], [child_asin]}, " | "), type text),
    #"Divided Column" = Table.TransformColumns(insertedKeyColumn, {{"buy_box_percentage", each _ / 100, type number}})
in
    #"Divided Column"
```


### `fact_average_landed_cost`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `unit_cost` double, `key_inventory_region_sku` string, `currency` string, `date` dateTime  
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


### `fact_awd_inventory_ledger_by_country`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `date_awd_inventory_ledger` dateTime, `key_inventory_country_sku` string, `ending_warehouse_balance_units` int64, `location_group` string, `ending_warehouse_balance_cartons` double, `average_package_quantity` double  
```powerquery
let
    Source = Folder.Files(path_to_files & "amazon_seller_central\fulfillment\inventory_awd_inventory_ledger_by_country\us_awd_inventory_ledger_by_country"),
    filteredHiddenFiles1 = Table.SelectRows(Source, each [Attributes]?[Hidden]? <> true),
    invokeCustomFunction1 = Table.AddColumn(filteredHiddenFiles1, "Transform File", each #"Transform File (18)"([Content])),
    renamedColumns1 = Table.RenameColumns(invokeCustomFunction1, {"Name", "Source.Name"}),
    removedOtherColumns1 = Table.SelectColumns(renamedColumns1, {"Source.Name", "Transform File"}),
    expandedTableColumn1 = Table.ExpandTableColumn(removedOtherColumns1, "Transform File", Table.ColumnNames(#"Transform File (18)"(#"Sample File (18)"))),
    changed_type_full_table = Table.TransformColumnTypes(expandedTableColumn1,{{"Source.Name", type text}, {"Date", type date}, {"MSKU", type text}, {"FNSKU", type text}, {"ASIN", type text}, {"Package Quantity", Int64.Type}, {"Purchase Order ID", type text}, {"Title", type text}, {"Starting Warehouse Balance (cartons)", Int64.Type}, {"Received (cartons)", Int64.Type}, {"Departed (cartons)", Int64.Type}, {"Lost (cartons)", Int64.Type}, {"Found (cartons)", Int64.Type}, {"Other (cartons)", Int64.Type}, {"Unknown (cartons)", Int64.Type}, {"Ending Warehouse Balance (cartons)", Int64.Type}, {"Facility ID", type text}, {"Country", type text}, {"Expiry Date", type date}}),
    groupedRows = Table.Group(changed_type_full_table, 
{"Date", "Country", "MSKU"}, 
{
{"average_package_quantity", each List.Average([#"Package Quantity"]), type number}, 
{"ending_warehouse_balance_cartons", each List.Sum([#"Ending Warehouse Balance (cartons)"]), type nullable number}
}),
    added_key_inventory_country_sku = Table.AddColumn(groupedRows, "key_inventory_country_sku", each [Country] & " | " & [MSKU], type text),
    added_ending_warehouse_balance_units = Table.AddColumn(added_key_inventory_country_sku, "ending_warehouse_balance_units", each [average_package_quantity] * [ending_warehouse_balance_cartons], Int64.Type),
    added_location_group = Table.AddColumn(added_ending_warehouse_balance_units, "location_group", each "AWD", type text),
    renamed_date = Table.RenameColumns(added_location_group,{{"Date", "date_awd_inventory_ledger"}}),
    select_columns = Table.SelectColumns(renamed_date,{"date_awd_inventory_ledger", "key_inventory_country_sku", "location_group", "average_package_quantity", "ending_warehouse_balance_cartons", "ending_warehouse_balance_units"})
in
    select_columns
```


### `fact_awd_monthly_processing_fee`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `fee_type` string, `key_inventory_country_sku` string, `currency` string, `promotion_amount` double, `tax_amount` double, `month_of_charge` dateTime, `fee_amount` double, `box_qty` int64  
```powerquery
let
    Source = raw_awdMonthlyProcessingFee,
    Custom1 = Table.SelectColumns(Source,{"month_of_charge", "fee_type", "key_inventory_country_sku", "currency", "box_qty", "fee_amount", "promotion_amount", "tax_amount"})
in
    Custom1
```


### `fact_awd_monthly_storage_fee`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `currency` string, `key_inventory_country_sku` string, `date` dateTime, `daily_charged_amount` double  
```powerquery
// let
//     Source = raw_awdMonthlyStorageFee,
//     selectImportantColumns = Table.SelectColumns(Source,{"month_of_charge", "key_inventory_country_sku", "currency", "monthly_average_utilized_volume", "fee_type", "fee_amount", "promotion_amount", "tax_amount"})
// in
//     selectImportantColumns


let
    Source = raw_awdMonthlyStorageFee,
    selectImportantColumns = Table.SelectColumns(Source,{"key_inventory_country_sku", "total_charged_amount", "currency", "month_of_charge"}),
    added_days_in_month = Table.AddColumn(selectImportantColumns, "days_in_month", each Date.DaysInMonth([month_of_charge]), Int64.Type),
    added_dates_list = Table.AddColumn(added_days_in_month, "date", each List.Dates([month_of_charge], [days_in_month], #duration(1,0,0,0))),
    expnded_dates_list = Table.ExpandListColumn(added_dates_list, "date"),
    changed_type_date = Table.TransformColumnTypes(expnded_dates_list,{{"date", type date}}),
    added_daily_charged_amount = Table.AddColumn(changed_type_date, "daily_charged_amount", each [total_charged_amount]/[days_in_month], type number),
    select_columns = Table.SelectColumns(added_daily_charged_amount,{"date", "key_inventory_country_sku", "currency", "daily_charged_amount"})
in
    select_columns
```


### `fact_awd_monthly_transportation_fee`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `fee_type` string, `key_inventory_country_sku` string, `currency` string, `promotion_amount` double, `tax_amount` double, `month_of_charge` dateTime, `fee_amount` double  
```powerquery
let
    Source = raw_awdMonthlyTransportationFee,
    selectImportantColumns = Table.SelectColumns(Source,{"month_of_charge", "fee_type", "key_inventory_country_sku", "currency", "fee_amount", "promotion_amount", "tax_amount"})
in
    selectImportantColumns
```


### `fact_awd_transportation_measurements`

**Modo:** `import`  **Grupo:** `Amazon\AWD`  
**Colunas:** `month_of_charge` dateTime, `key_inventory_country_sku` string, `longest_side` double, `median_side` double, `shortest_side` double, `unit_of_dimension` string, `unit_of_volume` string, `box_volume` double  
```powerquery
let
    Source = raw_awdMonthlyTransportationFee,
    added_longest = Table.AddColumn(Source, "longest_side", each List.MaxN(
   List.Sort(
      {[length_per_box],[width_per_box],[height_per_box]},
      Order.Descending
   ),
   3
){0}, type number),
    added_median = Table.AddColumn(added_longest, "median_side", each List.MaxN(
   List.Sort(
      {[length_per_box],[width_per_box],[height_per_box]},
      Order.Descending
   ),
   3
){1}, type number),
    added_shortest = Table.AddColumn( added_median, "shortest_side", each List.MaxN(
   List.Sort(
      {[length_per_box],[width_per_box],[height_per_box]},
      Order.Descending
   ),
   3
){2}, type number),
    added_box_volume = Table.AddColumn(added_shortest, "box_volume", each [longest_side]*[median_side]*[shortest_side]/1728, type number),
    added_unit_of_dimension = Table.AddColumn(added_box_volume, "unit_of_dimension", each if [measurement_units] = "IN" then "inches" else "Possible Error", type text),
    added_unit_of_volume = Table.AddColumn(added_unit_of_dimension, "unit_of_volume", each if [volume_units] = "Cu_ft" then "cubic feet" else "Possible Error", type text),
    selectImportantColumns = Table.SelectColumns(added_unit_of_volume,{
"month_of_charge", "key_inventory_country_sku", 
"longest_side", "median_side", "shortest_side", "unit_of_dimension",
"box_volume", "unit_of_volume"
}),
    #"Removed Duplicates" = Table.Distinct(selectImportantColumns)
in
    #"Removed Duplicates"
```


### `fact_db_results_tio`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `start_of_week` dateTime, `quantity_ordered_previously_3pl` double, `baseline_forecast` double, `demand_forecast` double, `ending_balance_considering_reorder_amz` double, `overstock` double, `quantity_ordered_previously_amz` double, `reorder_point` double, `target_ending_balance` double, `projected_sales_loss_if_not_reordered` double, `quantity_ordered_previously_awd` double, `ending_balance_considering_reorder_3pl` double, `mandatory_transfer_from_3pl_to_amz` double, `ending_balance` double, `storage_fee_amz` double, `overstock_with_3pl` double, `version_file` string, `key_inventory_region_sku` string  
```powerquery
let
    Source = Folder.Files(rootPathLang & "OrganiHaus\5.2 - OH Inventory Management\TIO - Tool for Inventory Optimization\Logs de cálculo\Oficial_For_Orders"),
    #"Filtered Rows" = Table.SelectRows(Source, each [Date modified] = List.Max(Source[#"Date modified"]) ),
    #"Filtered Hidden Files1" = Table.SelectRows(#"Filtered Rows", each [Attributes]?[Hidden]? <> true),
    #"Invoke Custom Function1" = Table.AddColumn(#"Filtered Hidden Files1", "Transform File (2)", each #"Transform File (2)"([Content])),
    #"Renamed Columns1" = Table.RenameColumns(#"Invoke Custom Function1", {"Name", "Source.Name"}),
    #"Removed Other Columns1" = Table.SelectColumns(#"Renamed Columns1", {"Source.Name", "Transform File (2)"}),
    #"Expanded Table Column1" = Table.ExpandTableColumn(#"Removed Other Columns1", "Transform File (2)", {
"Start-Week-Date", "Region", "SKU",
"Ending Balance", "Ending Balance considering reor", "3PL Ending Balance consid repl ", "Demand Forecast", "Projected Sales Loss with rep", "Mandatory Transfer from 3PL to ", "Target Ending Balance",

"Baseline Forecast", "Overstock", "Overstock with 3PL", "Quantity Ordered Previously", "Quantity Ordered Previously AWD", "3PL Quantity Ordered Previously", "Reorder Point",
"Storage Fee AMZ"
}),
    #"Filtered Rows1" = Table.SelectRows(#"Expanded Table Column1", let earliest = List.Min(#"Expanded Table Column1"[#"Start-Week-Date"]) in each [#"Start-Week-Date"] <> earliest),
    #"Replaced Value" = Table.ReplaceValue(#"Filtered Rows1"," | ","-",Replacer.ReplaceText,{"SKU"}),
    #"Added Custom" = Table.AddColumn(#"Replaced Value", "key_inventory_region_sku", each [Region] & " | " &[SKU]),
    #"Renamed Columns" = Table.RenameColumns(#"Added Custom",{{"Start-Week-Date", "start_of_week"}, {"Ending Balance", "ending_balance"}, {"Ending Balance considering reor", "ending_balance_considering_reorder_amz"}, {"3PL Ending Balance consid repl ", "ending_balance_considering_reorder_3pl"}, {"Demand Forecast", "demand_forecast"}, {"Projected Sales Loss with rep", "projected_sales_loss_if_not_reordered"}, {"Mandatory Transfer from 3PL to ", "mandatory_transfer_from_3pl_to_amz"}, {"Target Ending Balance", "target_ending_balance"}, {"Baseline Forecast", "baseline_forecast"}, {"Overstock", "overstock"}, {"Quantity Ordered Previously", "quantity_ordered_previously_amz"}, {"Quantity Ordered Previously AWD", "quantity_ordered_previously_awd"}, {"3PL Quantity Ordered Previously", "quantity_ordered_previously_3pl"}, {"Reorder Point", "reorder_point"}, {"Storage Fee AMZ", "storage_fee_amz"}, {"Overstock with 3PL", "overstock_with_3pl"}, {"Source.Name", "version_file"}}),
    #"Removed Other Columns" = Table.SelectColumns(#"Renamed Columns",{
    "version_file", "start_of_week", "key_inventory_region_sku", "ending_balance", "ending_balance_considering_reorder_amz", "ending_balance_considering_reorder_3pl", "demand_forecast", 
    "projected_sales_loss_if_not_reordered", "mandatory_transfer_from_3pl_to_amz", "target_ending_balance", 
    
    "baseline_forecast", "overstock", "overstock_with_3pl", "quantity_ordered_previously_amz", "quantity_ordered_previously_awd", 
    "quantity_ordered_previously_3pl", "reorder_point", "storage_fee_amz"
    }),
    #"Changed Type" = Table.TransformColumnTypes(#"Removed Other Columns",{{"start_of_week", type date}, {"ending_balance", type number}, {"key_inventory_region_sku", type text}, {"ending_balance_considering_reorder_amz", type number}, {"ending_balance_considering_reorder_3pl", type number}, {"demand_forecast", type number}, {"projected_sales_loss_if_not_reordered", type number}, {"mandatory_transfer_from_3pl_to_amz", type number}, {"target_ending_balance", type number}, {"baseline_forecast", type number}, {"overstock", type number}, {"quantity_ordered_previously_amz", type number}, {"quantity_ordered_previously_awd", type number}, {"quantity_ordered_previously_3pl", type number}, {"reorder_point", type number}, {"storage_fee_amz", type number}, {"overstock_with_3pl", type number}})
in
    #"Changed Type"
```


### `fact_db_results_VO`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `Inventory Region` string, `Native Family` string, `Key Inventory Region | Base SKU` string, `ASIN` string, `Life Cycle` string, `ABC Classification` string, `Year-Week` string, `Calc_Units_Sold` double, `Calc_Inventory_Start` double, `Calc_Average_Units_With_Invent` double, `Calc_Superior_Limit` double, `Calc_Min_Inventory` double, `Calc_Adjusted_Sales` double, `Calc_Adj_Moving_Average_Slow` double, `Calc_Adj_Moving_Average_Medium` double, `Calc_Adj_Moving_Average_Fast` double, `Calc_Velocity` double, `Calc_Adjusted_Sales_Stockout` double, `Calc_Loss_of_Sales` double, `Calc_Loss_of_Revenue` double, `Calc_Units_Moving_Average_Fast` double, `Calc_Potencial_Revenue` double, `Key Inventory Region | ASIN` string, `Start of Week` dateTime, `End of Week` dateTime, `Firs Date of Inventory` dateTime, `Year` int64, `Version` string, `Date` dateTime  
```powerquery
let
    source = Folder.Files(rootPathLang & "\OrganiHaus\5.1 - OH Sales & Performance\05. Forecasting\VO - Velocity Outcome\Logs de cálculo\db_results"),
    sortedRows = Table.Sort(source, {{"Date modified", Order.Descending}}),
    keptFirstRow = Table.FirstN(sortedRows, 1),
    filteredHiddenFiles = Table.SelectRows(keptFirstRow, each [Attributes]?[Hidden]? <> true),
    invokeTransform = Table.AddColumn(filteredHiddenFiles, "Transform File (13)", each #"Transform File (13)"([Content])),
    renamedSourceColumn = Table.RenameColumns(invokeTransform, {{"Name", "Source.Name"}}),
    removedOtherColumns = Table.SelectColumns(renamedSourceColumn, {"Source.Name", "Transform File (13)"}),
    expandedTransform = Table.ExpandTableColumn(removedOtherColumns, "Transform File (13)", Table.ColumnNames(#"Transform File (13)"(#"Sample File (13)"))),
    promotedHeaders = Table.PromoteHeaders(expandedTransform, [PromoteAllScalars = true]),
    selectedColumns = Table.SelectColumns(promotedHeaders, {
        "Inventory Region", "Native Family", "Inventory Region | Base SKU", "ASIN", "Firs Date of Inventory",
        "Life Cycle", "ABC Classification", "Year-Week", "Year", "Version", "Calc_Units_Sold", "Calc_Inventory_Start",
        "Calc_Average_Units_With_Invent", "Calc_Superior_Limit", "Calc_Min_Inventory", "Calc_Adjusted_Sales",
        "Calc_Adj_Moving_Average_Slow", "Calc_Adj_Moving_Average_Medium", "Calc_Adj_Moving_Average_Fast", "Calc_Velocity",
        "Calc_Adjusted_Sales_Stockout", "Calc_Loss_of_Sales", "Calc_Loss_of_Revenue", "Calc_Units_Moving_Average_Fast",
        "Calc_Potencial_Revenue"
    }),
    changedTypes = Table.TransformColumnTypes(selectedColumns, {
        {"Inventory Region", type text}, {"Native Family", type text}, {"Inventory Region | Base SKU", type text},
        {"ASIN", type text}, {"Firs Date of Inventory", type date}, {"Life Cycle", type text},
        {"ABC Classification", type text}, {"Year-Week", type text}, {"Year", Int64.Type}, {"Version", type text},
        {"Calc_Units_Sold", type number}, {"Calc_Inventory_Start", type number}, {"Calc_Average_Units_With_Invent", type number},
        {"Calc_Superior_Limit", type number}, {"Calc_Min_Inventory", type number}, {"Calc_Adjusted_Sales", type number},
        {"Calc_Adj_Moving_Average_Slow", type number}, {"Calc_Adj_Moving_Average_Medium", type number}, {"Calc_Adj_Moving_Average_Fast", type number},
        {"Calc_Velocity", type number}, {"Calc_Adjusted_Sales_Stockout", type number}, {"Calc_Loss_of_Sales", type number},
        {"Calc_Loss_of_Revenue", type number}, {"Calc_Units_Moving_Average_Fast", type number}, {"Calc_Potencial_Revenue", type number}
    }),
    renamedBaseSku = Table.RenameColumns(changedTypes, {{"Inventory Region | Base SKU", "Key Inventory Region | Base SKU"}}),
    addedKeyAsin = Table.AddColumn(renamedBaseSku, "Key Inventory Region | ASIN", each Text.Combine({[Inventory Region], [ASIN]}, " | "), type text),
    #"Replaced Errors" = Table.ReplaceErrorValues(addedKeyAsin, {{"Calc_Units_Sold", null}, {"Calc_Inventory_Start", null}, {"Calc_Average_Units_With_Invent", null}, {"Calc_Superior_Limit", null}, {"Calc_Min_Inventory", null}, {"Calc_Adjusted_Sales", null}, {"Calc_Adj_Moving_Average_Slow", null}, {"Calc_Adj_Moving_Average_Medium", null}, {"Calc_Adj_Moving_Average_Fast", null}, {"Calc_Velocity", null}, {"Calc_Adjusted_Sales_Stockout", null}, {"Calc_Loss_of_Sales", null}, {"Calc_Loss_of_Revenue", null}, {"Calc_Units_Moving_Average_Fast", null}, {"Calc_Potencial_Revenue", null}}),
    mergedCalendar = Table.NestedJoin(#"Replaced Errors", {"Year-Week"}, Calendar, {"Year-Week 544"}, "Calendar", JoinKind.LeftOuter),
    expandedCalendar = Table.ExpandTableColumn(mergedCalendar, "Calendar", {"Start of Week", "End of Week"}, {"Start of Week", "End of Week"}),

    // 🔹 Exclui linhas da semana corrente
    filteredPastWeeks = Table.SelectRows(expandedCalendar, each Date.IsInCurrentWeek([Start of Week]) = false),

    // 🔹 Cria lista de datas entre Start of Week e End of Week
    addedDateList = Table.AddColumn(filteredPastWeeks, "Date", each List.Dates(
        [Start of Week],
        Duration.Days([End of Week] - [Start of Week]) + 1,
        #duration(1,0,0,0)
    )),

    // 🔹 Expande a lista de datas (1 linha por dia)
    expandedDates = Table.ExpandListColumn(addedDateList, "Date"),
    #"Changed Type" = Table.TransformColumnTypes(expandedDates,{{"Date", type date}})
in
    #"Changed Type"
```


### `fact_estimated_future_daily_storage_fee`

**Modo:** `import`  **Grupo:** `'STAGING\Future Storage Fee'`  
**Colunas:** `date` dateTime, `estimated_daily_storage_fee` double, `key_marketplace_sku` string  
```powerquery
let
    merged_daly_share_monthly_storage_fee = Table.NestedJoin(aux_dailyShareOfStorageFee, {"start_of_month_daily_share_of_storage_fee", "sku"}, fact_estimated_future_monthly_storage_fee, {"start_of_month", "sku"}, "fact_estimated_future_monthly_storage_fee", JoinKind.LeftOuter),
    expanded_fact_estimated_future_monthly_storage_fee = Table.ExpandTableColumn(merged_daly_share_monthly_storage_fee, "fact_estimated_future_monthly_storage_fee", {"currency", "estimated_monthly_storage_fee"}, {"currency", "estimated_monthly_storage_fee"}),
    filtered_stora_fee_blank = Table.SelectRows(expanded_fact_estimated_future_monthly_storage_fee, each [estimated_monthly_storage_fee] <> null and [estimated_monthly_storage_fee] <> ""),
    
    added_estimated_daily_storage_fee = Table.AddColumn(filtered_stora_fee_blank, "estimated_daily_storage_fee", each [daily_share_of_storage_fee] *[estimated_monthly_storage_fee], type number),
    select_columns = Table.SelectColumns(added_estimated_daily_storage_fee,{"date_daily_share_of_storage_fee", "marketplace", "sku", "currency", "estimated_daily_storage_fee"}),
    renamed_columns = Table.RenameColumns(select_columns,{{"date_daily_share_of_storage_fee", "date"}}),
    #"Added Custom" = Table.AddColumn(renamed_columns, "key_marketplace_sku", each [marketplace] & " | " & [sku], type text),
    #"Removed Other Columns" = Table.SelectColumns(#"Added Custom",{"date", "estimated_daily_storage_fee", "key_marketplace_sku"})
in
    #"Removed Other Columns"
```


### `fact_exchange_rates`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `date` dateTime, `currency_from` string, `currency_to` string, `ticker` string, `exchange_rate` double  
```powerquery
let
    Source = Csv.Document(File.Contents(rootPathLang & "OrganiHaus\3.1 - OH Data & Reports\standalone_files\td_exchange_rates.csv"),[Delimiter=",", Columns=5, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"date", type date}, {"exchange_rate", type number}})
in
    #"Changed Type"
```


### `fact_fba_fee_expected`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `key_sales_country_asin` string, `date_list` dateTime, `size_tier` string, `index` int64, `fulfillment_fee` double, `fulfillment_fee_w_sipp` double, `fulfillment_fee_low_price` double, `fulfillment_fee_low_price_w_sipp` double  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\db_fba_fee_expected.xlsx"), true, true),
    fbaFeeExpected_Sheet = Source{[Item="db_fbaFeeExpected",Kind="Sheet"]}[Data],
    added_keySalesCountryAsin = Table.AddColumn(fbaFeeExpected_Sheet, "key_sales_country_asin", each [country] & " | " & [asin],type text),
    selectImportantColumns = Table.SelectColumns(added_keySalesCountryAsin,{"date_start", "date_end", "size_tier", "index", "fulfillment_fee", "fulfillment_fee_w_sipp", "fulfillment_fee_low_price", "fulfillment_fee_low_price_w_sipp", "key_sales_country_asin"}),
    changedType = Table.TransformColumnTypes(selectImportantColumns,{{"date_start", type date}, {"date_end", type date}, {"size_tier", type text}, {"index", Int64.Type}, {"fulfillment_fee", type number}, {"fulfillment_fee_w_sipp", type number}, {"fulfillment_fee_low_price", type number}, {"fulfillment_fee_low_price_w_sipp", type number}}),
    added_dateList = Table.AddColumn(changedType, "date_list", each 
List.Dates(
   [date_start], 
   Duration.Days( (
      if [date_end] = null then Date.From(DateTime.LocalNow()) 
      else [date_end]
   ) - [date_start]) + 1,
   #duration(1,0,0,0)
)),
    expanded_dateList = Table.ExpandListColumn(added_dateList, "date_list"),
    changedType_dateList = Table.TransformColumnTypes(expanded_dateList,{{"date_list", type date}}),
    #"Removed Other Columns" = Table.SelectColumns(changedType_dateList,{"key_sales_country_asin", "date_list", "size_tier", "index", "fulfillment_fee", "fulfillment_fee_w_sipp", "fulfillment_fee_low_price", "fulfillment_fee_low_price_w_sipp"})
in
    #"Removed Other Columns"
```


### `fact_fba_inventory`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `date_fba_inventory` dateTime, `inv_age_000_to_030` int64, `inv_age_031_to_060` int64, `inv_age_061_to_090` int64, `inv_age_091_to_180` int64, `inv_age_181_to_270` int64, `inv_age_271_to_365` int64, `inv_age_365_plus` int64, `currency` string, `estimated_storage_cost_next_month` double, `estimated_quantity_ais_181_210` int64, `estimated_quantity_ais_211_240` int64, `estimated_quantity_ais_241_270` int64, `estimated_quantity_ais_271_300` int64, `estimated_quantity_ais_301_330` int64, `estimated_quantity_ais_331_365` int64, `estimated_quantity_ais_365_plus` int64, `estimated_value_ais_181_210` double, `estimated_value_ais_211_240` double, `estimated_value_ais_241_270` double, `estimated_value_ais_271_300` double, `estimated_value_ais_301_330` double, `estimated_value_ais_331_365` double, `estimated_value_ais_365_plus` double, `available` int64, `inbound_quantity` int64, `inbound_working` int64, `inbound_shipped` int64, `inbound_received` int64, `unfulfillable_quantity` int64, `key_inventory_region_sku` string, `reserved_customer_order` int64, `reserved_fc_processing` int64, `reserved_fc_transfer` int64, `total_reserved_quantity` int64  
```powerquery
// let
//     Source = Table.Combine({#"FBA Inventory (raw)"}),
//     #"Replace: UK for GB" = Table.ReplaceValue(Source,"UK","GB",Replacer.ReplaceText,{"Country"}),
//     #"Key Column: Country | SKU" = Table.AddColumn(#"Replace: UK for GB", "Key Column: Country | SKU", each [Country] & " | " & [SKU], type text),
//     #"Removed Columns" = Table.RemoveColumns(#"Key Column: Country | SKU",{"Country", "SKU"}),
//     #"Removed Duplicates" = Table.Distinct(#"Removed Columns", {"Date", "Key Column: Country | SKU"}),
//     #"Renamed Columns" = Table.RenameColumns(#"Removed Duplicates",{{"Key Column: Country | SKU", "key_marketplace_sku"}, {"Date", "date_fba_inventory"}}),
// // in
// //     #"Renamed Columns"





let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Inventory.vw_full_fba_manage_inventory"),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"reserved_fc_transfer", Int64.Type}, {"reserved_fc_processing", Int64.Type}, {"reserved_customer_order", Int64.Type}})
in
    #"Changed Type"
```


### `fact_fba_manage_inventory_real_time`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `key_inventory_region_sku` string, `asin` string, `condition` string, `available_quantity` int64, `reserved_quantity` int64, `researching_quantity` int64, `unsellable_quantity` int64, `warehouse_quantity` int64, `receiving_quantity` int64, `shipped_quantity` int64, `working_quantity` int64, `date_fba_manage_inventory_real_time` dateTime, `total_quantity` int64  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Inventory.vw_full_fba_manage_inventory_real_time")
in
    Source
```


### `fact_fbaGrade&ResellReport`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `date` dateTime, `quantity` int64, `key_sales_marketplace_sku` string  
```powerquery
let
    Source = Table.Combine({#"raw_gbEu__fbaGrade&ResellReport", #"raw_usCaMx__fbaGrade&ResellReport"}),
    changed_type_full_table = Table.TransformColumnTypes(Source,{{"Source.Name", type text}, {"order-id", type text}, {"value-recovery-type", type text}, {"lpn", type text}, {"manual-order-item-id", type any}, {"merchant-sku", type any}, {"fnsku", type text}, {"asin", type text}, {"quantity", Int64.Type}, {"unit-status", type text}, {"reason-for-unit-status", type text}, {"grade-and-resell-used-condition", type text}, {"grade-and-resell-used-merchant-sku", type text}, {"grade-and-resell-used-fnsku", type text}}),
    changedDateType = Table.TransformColumnTypes(changed_type_full_table, {{"date", type date}}, "en-US"),
    excluding_failed_status = Table.SelectRows(changedDateType, each ([#"unit-status"] = "Succeeded")),
    selected_columns = Table.SelectColumns(excluding_failed_status,{"date", "order-id", "quantity", "grade-and-resell-used-merchant-sku"}),
    renamed_columns = Table.RenameColumns(selected_columns,{{"order-id", "amazon_order_id"}}),
    left_outer_join_sales_marketplace = Table.NestedJoin(renamed_columns, {"amazon_order_id"}, d.AmazonOrderId, {"amazon_order_id"}, "d.AmazonOrderId", JoinKind.LeftOuter),
    expanded_d.AmazonOrderId = Table.ExpandTableColumn(left_outer_join_sales_marketplace, "d.AmazonOrderId", {"sales_marketplace"}, {"sales_marketplace"}),
    added_key_sales_marketplace_sku = Table.AddColumn(expanded_d.AmazonOrderId, "key_sales_marketplace_sku", each [sales_marketplace] & " | " & [#"grade-and-resell-used-merchant-sku"], type text),
    selected_important_columns = Table.SelectColumns(added_key_sales_marketplace_sku,{"date", "quantity", "key_sales_marketplace_sku"})
in
    selected_important_columns
```


### `fact_fee_preview`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `currency` string, `date_fee_preview` dateTime, `key_sales_marketplace_sku` string, `product_size_tier` string, `longest_side` double, `median_side` double, `shortest_side` double, `length_and_girth` double, `item_volume` double, `unit_of_dimension` string, `item_package_weight` double, `unit_of_weight` string, `expected_fulfillment_fee_per_unit` double, `unit_of_volume` string, `is_latest = ````  
```powerquery
// let
//     Source = #"Fee Preview (raw)",
//     #"Get Dates from Source.Name" = Table.TransformColumns(Source, {{"Source.Name", each Text.BetweenDelimiters(_, " - ", ".txt", 1, 0), type text}}),
//     #"Renamed Columns" = Table.RenameColumns(#"Get Dates from Source.Name",{
// {"Source.Name", "Date"}, {"sku", "SKU"}, {"amazon-store", "Country"}, {"product-size-tier", "Product Size Tier"},
// {"currency", "Currency"}, {"expected-fulfillment-fee-per-unit", "Expected FBA Fee per Unit"}}
// ),
//     #"Fix numbers" = Table.ReplaceValue(#"Renamed Columns","--","",Replacer.ReplaceText,{"Expected FBA Fee per Unit"}),
//     #"Changed Type" = Table.TransformColumnTypes(#"Fix numbers",{{"Date", type date}, {"Country", type text}, {"SKU", type text}, {"Product Size Tier", type text}, {"Currency", type text}, {"Expected FBA Fee per Unit", type number}, {"longest-side", type number}, {"median-side", type number}, {"shortest-side", type number}, {"length-and-girth", type number}, {"item-package-weight", type number}, {"unit-of-dimension", type text}, {"unit-of-weight", type text}}),
//     #"Added Column: Item Volume" = Table.AddColumn(#"Changed Type", "Item Volume", each if [#"unit-of-dimension"] = "inches" then
// ([#"longest-side"]*[#"median-side"]*[#"shortest-side"])/1728
// else if [#"unit-of-dimension"] = "centimeters" then
// ([#"longest-side"]*[#"median-side"]*[#"shortest-side"])
// else
// null, Decimal.Type),
//     #"Key Column: Country | SKU" = Table.AddColumn(#"Added Column: Item Volume", "Key Column: Country | SKU", each [Country] & " | " & [SKU], type text),
//     #"Removed Other Columns" = Table.SelectColumns(#"Key Column: Country | SKU",{"Date", "Product Size Tier", "longest-side", "median-side", "shortest-side", "length-and-girth", "unit-of-dimension", "item-package-weight", "unit-of-weight", "Currency", "Expected FBA Fee per Unit", "Item Volume", "Key Column: Country | SKU"}),
//     #"Renamed Columns1" = Table.RenameColumns(#"Removed Other Columns",{{"Date", "date_fee_preview"}, {"Expected FBA Fee per Unit", "expected_fulfillment_fee_per_unit"}, {"Item Volume", "item_volume"}, {"Key Column: Country | SKU", "key_sales_marketplace_sku"}, {"length-and-girth", "length_and_girth"}, {"Currency", "currency"}, {"longest-side", "longest_side"}, {"median-side", "median_side"}, {"Product Size Tier", "product_size_tier"}, {"shortest-side", "shortest_side"}, {"unit-of-dimension", "unit_of_dimension"}, {"unit-of-weight", "unit_of_weight"}}),

// in 
//     #"Renamed Columns1"


let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Fees.vw_full_fee_preview")
in
    Source
```


### `fact_inventory_3pl`

**Modo:** `import`  **Grupo:** `'Third Party Logistics'`  
**Colunas:** `Date` dateTime, `Key Column: Inventory Region | SKU` string, `Location` string, `On Hand` int64, `Allocated` int64, `Receiving Area` int64, `Available` int64, `In Transit` int64, `Warehouse 3pl` string  
```powerquery
let
    #"Table Combine" = Table.Combine({
        raw_3PL_US_SSG
        , raw_3PL_GB_WWL
        , raw_3PL_GB_PGS
        , raw_3PL_CA_DCI, raw_3PL_CA_PGS
        }),
    addedInventoryRegion = Table.AddColumn(#"Table Combine", "Inventory Region", each 
        if Text.StartsWith([Date],"us_") then "US"
        else if Text.StartsWith([Date],"gb_ ") then "GB"
        else if Text.StartsWith([Date],"ca_") then "CA"
        else "Possible Error"),
    addedWarehouse3pl = Table.AddColumn(addedInventoryRegion, "Warehouse 3pl", each 
        if Text.StartsWith([Date],"us_ssg_") then "ShipSage"
        else if Text.StartsWith([Date],"gb_wwl_") then "WorldWide Logistics"
        else if Text.StartsWith([Date],"gb_pgs_") then "PGS"
        else if Text.StartsWith([Date],"ca_pgs_") then "PGS"
        else if Text.StartsWith([Date],"ca_dci_") then "DCI"
        else "Possible Error"),
    addedKeyInventoryRegionSKU = Table.AddColumn(addedWarehouse3pl, "Key Column: Inventory Region | SKU", each [Inventory Region] & " | " & [SKU]),
    removedOtherColumns = Table.SelectColumns(addedKeyInventoryRegionSKU,{"Date", "Warehouse 3pl", "Location", "Key Column: Inventory Region | SKU", "On Hand", "Allocated", "Receiving Area", "Available", "In Transit"}),
    extractedDate = Table.TransformColumns(removedOtherColumns, {{"Date", each Text.BetweenDelimiters(_, "_", ".", {0, RelativePosition.FromEnd}, 0), type text}}),
    changedType = Table.TransformColumnTypes(extractedDate,{{"Date", type date}, {"Warehouse 3pl", type text}, {"Location", type text}, {"Key Column: Inventory Region | SKU", type text}, {"On Hand", Int64.Type}, {"Allocated", Int64.Type}, {"Receiving Area", Int64.Type}, {"Available", Int64.Type}, {"In Transit", Int64.Type}})
in
    changedType
```


### `fact_inventory_ledger_by_fulfillment_center`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `date` dateTime, `disposition` string, `fulfillment_center` string, `starting_warehouse_balance` int64, `key_column_inventory_country_sku` string, `ending_plus_transit` int64, `inventory_country` string, `sku` string, `fnsku` string, `ending_warehouse_balance` int64  
```powerquery
// let
//     #"Table Combine" = Table.Combine({#"Inventory Ledger by FC (raw)"}),
//     #"Merged Queries - FC Address" = Table.NestedJoin(#"Table Combine", {"Location"}, #"Fulfillment Centers Address", {"FC"}, "Fulfillment Centers Address", JoinKind.LeftOuter),
//     #"__Expanded to get Country" = Table.ExpandTableColumn(#"Merged Queries - FC Address", "Fulfillment Centers Address", {"Country"}, {"Country"}),
//     #"Key Column: Country | SKU" = Table.AddColumn(#"__Expanded to get Country", "Key Column: Country | SKU", each [Country] & " | " & [MSKU], type text),
//     #"Removed Other Columns" = Table.SelectColumns(#"Key Column: Country | SKU",{"Date", "Disposition", "Starting Warehouse Balance", "In Transit Between Warehouses", "Ending Warehouse Balance", "Location", "Key Column: Country | SKU"})
// in
//     #"Removed Other Columns"



let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Inventory.vw_full_inventory_ledger_summary_by_fulfillment_center")
in
    Source
```


### `fact_life_cycle`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `date_life_cycle` dateTime, `key_inventory_region_sku` string, `life_cycle` string  
```powerquery
let
    Source = raw_lifeCycle,
    addedLifeCyle_inventoryRegion_sku = Table.AddColumn(Source, "key_inventory_region_sku", each [inventory_region] & " | " & [sku], type text),
    selectImportantColumns = Table.SelectColumns(addedLifeCyle_inventoryRegion_sku,{"date_life_cycle", "key_inventory_region_sku", "life_cycle"})
in
    selectImportantColumns
```


### `fact_order_records`

**Modo:** `import`  **Grupo:** `'Google Sheets - Inventory Tracker'`  
**Colunas:** `Order Id` string, `Supplier` string, `Order Status` string, `Alibaba Order` string, `EXW Price` decimal, `Invoice USD` decimal, `Balance Provision USD` decimal, `Inspection Cost USD` decimal, `Entry Country` string, `Freight Forwarder` string, `Carrier` string, `Freight Provision USD` decimal, `Customs Exam Charges Provision USD` decimal, `CBM` double, `Order Creation` dateTime, `Order Date` dateTime, `Agreed - Pick up Date` dateTime, `Agreed - Established Time of Departure (ETD)` dateTime, `Agreed - Established Time of Arrival (ETA)` dateTime, `Agreed - Delivery Date` dateTime, `Actual - Pick up Date` dateTime, `Actual - Departure Date` dateTime, `Actual - Arrival at Port Date` dateTime, `Actual - Delivery Date` dateTime, `Total Lead Time (Days)` int64, `Ocean Time (days)` int64, `Last Leg (days)` int64, `Production Lead Time (days)` int64, `Handling Lead Time (days)` int64, `Delay - Pick up (Days)` int64, `Delay - Delivery (Days)` int64, `Delay - Departure (Days)` int64, `Delay - Arrival (Days)` int64, `Freight_Delay_Column = ````, `Order Total Actual USD` decimal, `First Freight Provision USD` decimal, `Actual - CBM` double, `Inspection End Date` dateTime, `Sample Cost USD` double, `Pick up Cost USD` double, `EXW/Invoice USD` decimal, `Production Status` string, `Delivered Status` string, `Region` string  
```powerquery
// factOrderRecords
let    
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Google_Sheets.td_full_order_records"),

    RenameColumns = Table.RenameColumns(Source, {
            // Mapeamento direto
            {"supplier", "Supplier"},
            {"order_id", "Order Id"},
            {"order_status", "Order Status"},
            {"alibaba_order", "Alibaba Order"},
            {"exw_price", "EXW Price"},
            {"invoice_usd", "Invoice USD"},
            {"balance_provision_usd", "Balance Provision USD"},
            {"order_total_actual_usd", "Order Total Actual USD"},
            {"inspection_cost_usd", "Inspection Cost USD"},
            {"freight_forwarder", "Freight Forwarder"},
            {"carrier", "Carrier"},
            {"freight_provision_usd", "Freight Provision USD"},
            {"customs_exam_charges_provision_usd", "Customs Exam Charges Provision USD"},
            {"cbm", "CBM"},
            {"order_creation", "Order Creation"},
            {"order_date", "Order Date"},
            {"agreed_pick_up_date", "Agreed - Pick up Date"},
            {"agreed_established_time_of_departure_etd", "Agreed - Established Time of Departure (ETD)"},
            {"agreed_established_time_of_arrival_eta", "Agreed - Established Time of Arrival (ETA)"},
            {"agreed_delivery_date", "Agreed - Delivery Date"},
            {"pick_up_date", "Actual - Pick up Date"},
            {"departure_date", "Actual - Departure Date"},
            {"arrival_at_port_date", "Actual - Arrival at Port Date"},
            {"delivery_date", "Actual - Delivery Date"},
            {"actual_cbm", "Actual - CBM"},
            {"sample_cost_usd", "Sample Cost USD"},
            {"pick_up_cost_usd", "Pick up Cost USD"},
            {"entry_country", "Entry Country"},
            {"first_freight_provision_usd", "First Freight Provision USD"},
            {"inventory_region", "Region"},
            {"inspection_end_date", "Inspection End Date"}
        }, MissingField.Ignore),
    addLT = fnAdicionarLeadTimes(RenameColumns),


    // Calcular os delays
    delayPickUp = Table.AddColumn(addLT, "Delay - Pick up (Days)", 
        each if [#"Actual - Pick up Date"] = null or [#"Agreed - Pick up Date"] = null then null
            else if [#"Actual - Pick up Date"] < [#"Agreed - Pick up Date"] then 0
            else Duration.Days([#"Actual - Pick up Date"] - [#"Agreed - Pick up Date"]),
        type number),

    delayDelivery = Table.AddColumn(delayPickUp, "Delay - Delivery (Days)", 
        each if [#"Actual - Delivery Date"] = null or [#"Agreed - Delivery Date"] = null then null
            else if [#"Actual - Delivery Date"] < [#"Agreed - Delivery Date"] then 0
            else Duration.Days([#"Actual - Delivery Date"] - [#"Agreed - Delivery Date"]),
        type number),

    delayDeparture = Table.AddColumn(delayDelivery, "Delay - Departure (Days)", 
        each if [#"Actual - Departure Date"] = null or [#"Agreed - Established Time of Departure (ETD)"] = null then null
            else if [#"Actual - Departure Date"] < [#"Agreed - Established Time of Departure (ETD)"] then 0
            else Duration.Days([#"Actual - Departure Date"] - [#"Agreed - Established Time of Departure (ETD)"]),
        type number),

    delayArrival = Table.AddColumn(delayDeparture, "Delay - Arrival (Days)", 
        each if [#"Actual - Arrival at Port Date"] = null or [#"Agreed - Established Time of Arrival (ETA)"] = null then null
            else if [#"Actual - Arrival at Port Date"] < [#"Agreed - Established Time of Arrival (ETA)"] then 0
            else Duration.Days([#"Actual - Arrival at Port Date"] - [#"Agreed - Established Time of Arrival (ETA)"]),
        type number),

    // Substituir "-" por null nas colunas específicas
    columnsToReplace = {
        "Order Id", "Sub Order Number", "Supplier", "Order Status", "Payment Status Factory", "Payment Status Freight and Duties", 
        "Alibaba Order", "EXW Price", "Invoice USD", "Upfront Provision USD", "Balance Provision USD", "Order Total Actual USD", 
        "Inspection Cost USD", "Inspection Payment Date", "Entry Date", "Entry Country", "Freight Forwarder", "Carrier", 
        "Freight Provision USD", "Customs Exam Charges Provision USD", "Total Import Cost (Landed Cost) USD", "Crossdocking Cost", 
        "CBM", "First Destination", "Final Destination", "Order Creation", "Order Date", "Agreed - Pick up Date", 
        "Agreed - Established Time of Departure (ETD)", "Agreed - Established Time of Arrival (ETA)", "Agreed - Delivery Date", 
        "Actual - Pick up Date", "Actual - Departure Date", "Actual - Arrival at Port Date", "Actual - Delivery Date", 
        "Total Lead Time (Days)", "Ocean Time (days)", "Last Leg (days)", "Production Lead Time (days)", "Handling Lead Time (days)", 
        "Freight / EXW", "Freight / CBM", "Delay - Pick up (Days)", "Delay - Delivery (Days)", "Delay - Departure (Days)", 
        "Delay - Arrival (Days)"
    },

    // Selecionar colunas finais
    finalColumns = Table.SelectColumns(delayArrival, {
        "Order Id", "Supplier", "Order Status", "Alibaba Order", "EXW Price", "Invoice USD", "Balance Provision USD", 
        "Order Total Actual USD", "Inspection Cost USD", "Freight Forwarder", "Carrier", "Freight Provision USD", 
        "Customs Exam Charges Provision USD", "CBM", "Order Creation", "Order Date", "Agreed - Pick up Date", 
        "Agreed - Established Time of Departure (ETD)", "Agreed - Established Time of Arrival (ETA)", "Agreed - Delivery Date", 
        "Actual - Pick up Date", "Actual - Departure Date", "Actual - Arrival at Port Date", "Actual - Delivery Date", 
        "First Freight Provision USD", "Actual - CBM", "Inspection End Date", "Sample Cost USD", "Pick up Cost USD", 
        "Total Lead Time (Days)", "Ocean Time (days)", "Last Leg (days)", "Production Lead Time (days)", "Handling Lead Time (days)", 
        "Entry Country", "Delay - Pick up (Days)", "Delay - Delivery (Days)", "Delay - Departure (Days)", "Delay - Arrival (Days)", "Region"
    }),

    // Alterar os tipos de dados das colunas
    changedType = Table.TransformColumnTypes(finalColumns, {
        {"EXW Price", Currency.Type}, {"Invoice USD", Currency.Type}, {"Balance Provision USD", Currency.Type}, 
        {"Order Total Actual USD", Currency.Type}, {"Inspection Cost USD", Currency.Type}, {"Freight Provision USD", Currency.Type}, 
        {"Customs Exam Charges Provision USD", Currency.Type}, {"CBM", type number}, {"Order Creation", type date}, 
        {"Order Date", type date}, {"Agreed - Pick up Date", type date}, {"Agreed - Established Time of Departure (ETD)", type date}, 
        {"Agreed - Established Time of Arrival (ETA)", type date}, {"Agreed - Delivery Date", type date}, 
        {"Actual - Pick up Date", type date}, {"Actual - Departure Date", type date}, {"Actual - Arrival at Port Date", type date}, 
        {"Actual - Delivery Date", type date}, {"First Freight Provision USD", Currency.Type}, {"Sample Cost USD", Currency.Type}, 
        {"Pick up Cost USD", Currency.Type}, {"Total Lead Time (Days)", Int64.Type}, {"Ocean Time (days)", Int64.Type}, 
        {"Last Leg (days)", Int64.Type}, {"Production Lead Time (days)", Int64.Type}, {"Handling Lead Time (days)", Int64.Type}, 
        {"Delay - Pick up (Days)", Int64.Type}, {"Delay - Delivery (Days)", Int64.Type}, {"Delay - Departure (Days)", Int64.Type}, 
        {"Delay - Arrival (Days)", Int64.Type}
    }),

    // Tratamento de erros, substituindo erros por null
    replacedErrors = Table.ReplaceErrorValues(changedType, {
        {"Delay - Pick up (Days)", null}, {"Delay - Delivery (Days)", null}, {"Delay - Departure (Days)", null}, 
        {"Delay - Arrival (Days)", null}, {"First Freight Provision USD", null}, {"Inspection End Date", null}
    }),
/*
    #"Merged Queries" = Table.NestedJoin(replacedErrors, {"Order Id"}, dim_order_IDs, {"Order Id"}, "dim_order_IDs", JoinKind.LeftOuter),
    #"Expanded dim_order_IDs" = Table.ExpandTableColumn(#"Merged Queries", "dim_order_IDs", {"Region"}, {"Region"}),
*/
    #"Replaced Value" = Table.ReplaceValue(replacedErrors,null,0,Replacer.ReplaceValue,{"Sample Cost USD", "Pick up Cost USD"}),
    
    // Adicionando a coluna "EXW/Invoice USD" como última transformação
    addExwInvoiceUsd = Table.AddColumn(#"Replaced Value", "EXW/Invoice USD", 
        each if [Region] = "US" then 
                [EXW Price] + [Sample Cost USD] 
                else if [Region] = "CA" then 
                        [EXW Price]  + [Sample Cost USD] 
                    else [Invoice USD] + [Sample Cost USD]
    ),
    addedProductionStatus = Table.AddColumn(addExwInvoiceUsd, "Production Status", 
        each if [Order Status] <> "In Production" then 
                if [#"Delay - Pick up (Days)"] = 0 then "Produced on Time" 
                else "Produced Late" 
            else [Order Status], 
        type text
    ),

    addedDeliveredStatus = Table.AddColumn(
        addedProductionStatus, 
        "Delivered Status", 
        each if [Order Status] = "Delivered" then 
                if [#"Delay - Delivery (Days)"] = 0 then "Delivered on Time" 
                else "Delivered Late" 
            else null, 
        type text
        ),
    #"Changed Type" = Table.TransformColumnTypes(addedDeliveredStatus,{{"EXW/Invoice USD", Currency.Type}}),
    #"Uppercased Text" = Table.TransformColumns(#"Changed Type",{{"Supplier", Text.Upper, type text}, {"Freight Forwarder", Text.Upper, type text}})
in
    #"Uppercased Text"
```


### `fact_sb_attributed_purchase`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `sponsored_ads_type` string, `date_sb_attributed_purchase` dateTime, `currency` string, `campaign_name` string, `ad_group_name` string, `attribution_type` string, `key_marketplace_purchased_asin` string, `total_sales_14d` double, `total_orders_14d` int64, `total_units_sold_14d` int64, `new_to_brand_sales_14d` double, `new_to_brand_orders_14d` int64, `new_to_brand_units_sold_14d` int64, `new_to_brand_sales_percentage_14d` double, `new_to_brand_orders_percentage_14d` double, `new_to_brand_units_sold_percentage_14d` double  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sb_attributed_purchases")
in
    Source
```


### `fact_sb_search_terms`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `sponsored_ads_type` string, `date_sb_search_terms` dateTime, `marketplace` string, `currency` string, `campaign_name` string, `ad_group_name` string, `targeting` string, `match_type` string, `customer_search_term` string, `cost_type` string, `impressions` int64, `clicks` int64, `spend` double, `total_sales` double, `total_orders` int64, `total_units_sold` int64, `total_sales_clicks` double, `total_orders_clicks` int64  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sb_search_terms")
in
    Source
```


### `fact_sb_spend_by_sku`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `date_sb` dateTime, `key_marketplace_asin` string, `currency_sb` string, `sb_orders` int64, `sb_sales` double, `sb_spend` double, `sponsored_ads_type` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_consolidated_sb_attributed_orders_sales_spend")
in
    Source
```


### `fact_SCPR_all_reviews`

**Modo:** `import`  **Grupo:** `LOG\SCPR`  
**Colunas:** `Quarter` string, `Year` string, `Company Name` string, `Attribute` string, `Grade` int64, `Comment` string, `Weight` int64, `Category` string, `Period` string  
```powerquery
let
Fonte = Excel.Workbook(File.Contents(path_to_files & "\standalone_files\Supply Chain Performance Review (SCPR).xlsx"), null, true),
    #"Form Answers_Sheet" = Fonte{[Item="Form Answers",Kind="Sheet"]}[Data],
    #"Cabeçalhos Promovidos" = Table.PromoteHeaders(#"Form Answers_Sheet", [PromoteAllScalars=true]),
    #"Tipo Alterado" = Table.TransformColumnTypes(#"Cabeçalhos Promovidos",{{"Id", Int64.Type}, {"Start time", type datetime}, {"Completion time", type datetime}, {"Email", type text}, {"Name", type any}, {"Quarter", type any}, {"Year", type any}, {"Type", type any}, {"Company", type text}, {"Company1", type any}, {"Payment Terms & Conditions", type any}, {"Payment Terms & Conditions - Comment", type any}, {"Cost", type any}, {"Cost - Comment", type any}, {"Transparent cost composition", type any}, {"Transparent cost composition - Comment", type any}, {"Negotiation", type any}, {"Negotiation - Comment", type any}, {"Communication", Int64.Type}, {"Communication - Comment", type text}, {"Response Time", Int64.Type}, {"Response Time - Comment", type any}, {"Adherence to instructions (SLA)", Int64.Type}, {"Adherence to instructions (SLA) - Comment", type any}, {"On-time delivery / Efficient lead Time", Int64.Type}, {"On-time delivery / Efficient lead Time - Comment", type any}, {"Flexibility", Int64.Type}, {"Flexibility - Comment", type text}, {"Problem management", Int64.Type}, {"Problem management - Comment", type text}, {"Overall product and/or service quality", Int64.Type}, {"Overall product and/or service quality - Comment", type any}, {"Capacity to detect and solve issues", Int64.Type}, {"Capacity to detect and solve issues - Comment", type text}, {"Open for improvement & optimization", Int64.Type}, {"Open for improvement & optimization - Comment", type text}}),
    #"Added Conditional Column" = Table.AddColumn(#"Tipo Alterado", "Company Name", each if [Company] = null then [Company1] else [Company]),
    #"Removed Columns" = Table.RemoveColumns(#"Added Conditional Column",{"Completion time", "Email", "Name", "Company", "Company1"}),
    #"Added Custom" = Table.ReplaceValue(
            #"Removed Columns",
            each [Quarter],
            each 
                if [Quarter] = null then 
                    if Date.Month([Hora de início]) <= 3 then "Q1"
                    else if Date.Month([Hora de início]) <= 6 then "Q2"
                    else if Date.Month([Hora de início]) <= 9 then "Q3"
                    else "Q4"
                else [Quarter],
            Replacer.ReplaceValue,
            {"Quarter"} // Especifica que a substituição ocorre na coluna 'Quarter'
        ),
    #"Updated Year" = Table.ReplaceValue(
            #"Added Custom",
            each [Year],
            each if [Year] = null then Date.Year([Hora de início]) else [Year],
            Replacer.ReplaceValue,
            {"Year"}
        ),
    #"Unpivoted Other Columns" = Table.UnpivotOtherColumns(#"Updated Year", {"Id", "Start time", "Type", "Company Name","Quarter","Year"}, "Attribute", "Value"),
    principal = Table.SelectRows(#"Unpivoted Other Columns", each not Text.Contains([Attribute], "Comment")),
    #"START - COMMENT" = Table.SelectRows(#"Unpivoted Other Columns", each Text.Contains([Attribute], "Comment")),
    #"Extracted Text Before Delimiter" = Table.TransformColumns(#"START - COMMENT", {{"Attribute", each Text.BeforeDelimiter(_, "-"), type text}}),
    #"Trimmed Text" = Table.TransformColumns(#"Extracted Text Before Delimiter",{{"Attribute", Text.Trim, type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Trimmed Text",{{"Value", "Comment"}}),
    #"end comment" = #"Renamed Columns",
    #"Merged Queries" = Table.NestedJoin(principal, {"Id", "Type", "Attribute"}, #"end comment", {"Id", "Type", "Attribute"}, "Trimmed Text", JoinKind.LeftOuter),
    #"Expanded Trimmed Text" = Table.ExpandTableColumn(#"Merged Queries", "Trimmed Text", {"Comment"}, {"Trimmed Text.Comment"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Expanded Trimmed Text",{{"Trimmed Text.Comment", "Comment"}, {"Value", "Grade"}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Renamed Columns1",{{"Start time", type date}}),
    #"Removed Columns1" = Table.RemoveColumns(#"Changed Type1",{"Start time","Type", "Id"}),
    #"Tipo Alterado1" = Table.TransformColumnTypes(#"Removed Columns1",{{"Grade", Int64.Type}}),
    #"Merged Queries1" = Table.NestedJoin(#"Tipo Alterado1", {"Attribute"}, dim_SCPR_category, {"Attribute"}, "SCPR_Category", JoinKind.LeftOuter),
    #"Expanded SCPR_Category" = Table.ExpandTableColumn(#"Merged Queries1", "SCPR_Category", {"Category", "Weight"}, {"Category", "Weight"}),
    #"Added Custom1" = Table.AddColumn(#"Expanded SCPR_Category", "Period", each [Year] & " " & [Quarter])
in
    #"Added Custom1"
```


### `fact_sd_advertised_products`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `date_sb_advertised_products` dateTime, `key_marketplace_advertised_sku` string, `campaign_name` string, `ad_group_name` string, `currency` string, `impressions` int64, `clicks` int64, `spend` double, `advertised_sku_orders_14d` int64, `advertised_sku_sales_14d` double, `advertised_sku_units_sold_14d` int64, `other_sku_orders_14d` int64, `other_sku_sales_14d` double, `other_sku_units_sold_14d` int64, `advertised_sku_new_to_brand_orders_14d` int64, `advertised_sku_new_to_brand_sales_14d` double, `advertised_sku_new_to_brand_units_sold_14d` int64, `other_sku_new_to_brand_orders_14d_clicks` int64, `other_sku_new_to_brand_sales_14d_clicks` double, `other_sku_new_to_brand_units_sold_14d_clicks` int64, `sponsored_ads_type` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sd_advertised_products")
in
    Source
```


### `fact_seller_suport_cases`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `Status` string, `Date Created` dateTime, `Case ID` string, `ASIN` string, `SKU` string, `Lead Time` string, `Region` string, `FNSKU` string, `Date Closed` dateTime, `Refunded Amount` decimal, `Currency` string, `Key Inventory Region | ASIN` string, `Outcome` string  
```powerquery
let
    Source = Csv.Document(
        File.Contents(rootPathLang & "OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_amazon_remeasurement_cases.csv"),
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.None]
    ),
    promotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Removed Columns" = Table.RemoveColumns(promotedHeaders,{""}),
    addKeyColumn = Table.AddColumn(#"Removed Columns", "Key Inventory Region | ASIN", each Text.Combine({[Region], [ASIN]}, " | "), type text),
    filteredValidRegion = Table.SelectRows(addKeyColumn, each ([Region] <> "")),
    filteredValidAsin = Table.SelectRows(filteredValidRegion, each ([ASIN] <> "" and [ASIN] <> "#N/A")),
    changedDateType1 = Table.TransformColumnTypes(filteredValidAsin, {{"Date Created", type date}}, "pt-BR"),
    changedType2 = Table.TransformColumnTypes(changedDateType1, {{"Date Closed", type date}}, "pt-BR"),
    changedNumberType = Table.TransformColumnTypes(changedType2, {{"Refunded Amount", Currency.Type}}),
    #"Filtered Rows" = Table.SelectRows(changedNumberType, each ([Case ID] <> ""))
in
    #"Filtered Rows"
```


### `fact_sp_advertised_products`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `date_sp_advertised_products` dateTime, `key_marketplace_advertised_sku` string, `campaign_name` string, `ad_group_name` string, `currency` string, `impressions` int64, `clicks` int64, `spend` double, `advertised_sku_orders_7d` int64, `advertised_sku_sales_7d` double, `advertised_sku_units_sold_7d` int64, `other_sku_units_sold_7d` int64, `other_sku_sales_7d` double, `other_sku_orders_7d` int64, `sponsored_ads_type` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sp_advertised_products")
in
    Source
```


### `fact_sp_purchased_products`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `date_sp_purchased_products` dateTime, `campaign_name` string, `ad_group_name` string, `match_type` string, `currency` string, `key_marketplace_advertised_sku` string, `key_marketplace_purchased_asin` string, `units_sold_other_sku` int64, `orders_other_sku` int64, `sales_other_sku` double, `sponsored_ads_type` string, `targeting` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sp_purchased_products"),
    added_boolean_filter = Table.AddColumn(Source, "boolean_filter", each if 
([date_sp_purchased_products] >= Date.AddDays(Date.From(DateTime.LocalNow()), -10)) 
and Text.Start([key_marketplace_advertised_sku], 2) = "US"
then true
else false, type logical),
    filtered_false_boolean_filter = Table.SelectRows(added_boolean_filter, each ([boolean_filter] = false)),
    removed_boolean_filter = Table.RemoveColumns(filtered_false_boolean_filter,{"boolean_filter"}),
    appended_us_temp_last10d = Table.Combine({removed_boolean_filter, #"STAGING - us_temp_last10d_SPPurchasedProducts"})
in
    appended_us_temp_last10d
```


### `fact_sp_search_terms`

**Modo:** `import`  **Grupo:** `'Amazon\Campaign Manager'`  
**Colunas:** `sponsored_ads_type` string, `date_sp_search_terms` dateTime, `marketplace` string, `currency` string, `campaign_name` string, `ad_group_name` string, `targeting` string, `match_type` string, `customer_search_term` string, `impressions` int64, `clicks` int64, `spend` double, `total_units_sold_7d` int64, `total_sales_7d` double, `total_orders_7d` int64, `advertised_sku_units_sold_7d` int64, `advertised_sku_sales_7d` double, `advertised_sku_orders_7d` int64, `other_sku_units_sold_7d` int64, `other_sku_sales_7d` double, `other_sku_orders_7d` int64  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Amz_Ads.vw_full_amz_ads_sp_search_terms")
in
    Source
```


### `fact_storage_fee_daily`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `currency` string, `estimated_daily_storage_fee` double, `date_daily_share_of_storage_fee` dateTime, `key_marketplace_sku` string  
```powerquery
let
    Source = Table.NestedJoin(aux_dailyShareOfStorageFee, {"start_of_month_daily_share_of_storage_fee", "key_region_fnsku"}, silver_fStorageFeeMonthly, {"month_of_charge", "key_inventory_region_fnsku"}, "Staging - fStorageFeeMonthly", JoinKind.LeftOuter),
    #"Expanded Staging - fStorageFeeMonthly" = Table.ExpandTableColumn(Source, "Staging - fStorageFeeMonthly", {"currency", "estimated_monthly_storage_fee"}, {"currency", "estimated_monthly_storage_fee"}),
    #"Added Custom" = Table.AddColumn(#"Expanded Staging - fStorageFeeMonthly", "estimated_daily_storage_fee", each [daily_share_of_storage_fee] *[estimated_monthly_storage_fee], type number),
    #"Removed Other Columns" = Table.SelectColumns(#"Added Custom",{"date_daily_share_of_storage_fee", "key_marketplace_sku", "currency", "estimated_daily_storage_fee"}),
    #"Removed Blank Rows" = Table.SelectRows(#"Removed Other Columns", each not List.IsEmpty(List.RemoveMatchingItems(Record.FieldValues(_), {"", null}))),
    #"Rounded Off" = Table.TransformColumns(#"Removed Blank Rows",{{"estimated_daily_storage_fee", each Number.Round(_, 6), type number}}),
    #"Filtered Rows" = Table.SelectRows(#"Rounded Off", each [currency] <> null and [currency] <> "")
in
    #"Filtered Rows"
```


### `fact_storage_fee_measurements`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `month_of_charge` dateTime, `key_inventory_region_fnsku` string, `unit_of_measurement` string, `unit_of_weight` string, `unit_of_volume` string, `side_longest` double, `side_median` double, `side_shortest` double, `item_volume` double, `quantity_on_hand` double, `item_weight` double  
```powerquery
let
    Source = silver_fStorageFeeMeasurementsByRegion,
    groupedRows = Table.Group(Source, 
{"month_of_charge", "inventory_region", "fnsku", "measurement_units", "weight_units", "volume_units"}, {
{"longest_side",      each Number.Round(List.Sum([longest_side_weighted]),   2),  type number}, 
{"median_side",       each Number.Round(List.Sum([median_side_weighted]),    2),  type number}, 
{"shortest_side",     each Number.Round(List.Sum([shortest_side_weighted]),  2),  type number}, 
{"unit_weight",       each Number.Round(List.Sum([weight_weighted]),         5),  type number}, 
{"item_volume",       each Number.Round(List.Sum([item_volume_weighted]),    5),  type number},
{"quantity_on_hand",  each Number.Round(List.Max([total_quantity_on_hand]),  5),  type number}
}),
    added_keyInventoryRegionFnsku = Table.AddColumn(groupedRows, "key_inventory_region_fnsku", each [inventory_region] & " | " & [fnsku], type text),
    selectImportantColumns = Table.SelectColumns(added_keyInventoryRegionFnsku,{
"month_of_charge", "key_inventory_region_fnsku", 
"measurement_units", "weight_units", "volume_units", 
"longest_side", "median_side", "shortest_side", "unit_weight", "item_volume", 
"quantity_on_hand"
}),
    renamedColumns = Table.RenameColumns(selectImportantColumns,{{"measurement_units", "unit_of_measurement"}, {"weight_units", "unit_of_weight"}, {"volume_units", "unit_of_volume"}, {"item_volume", "item_volume"}, {"longest_side", "side_longest"}, {"median_side", "side_median"}, {"shortest_side", "side_shortest"}, {"unit_weight", "item_weight"}})
in
    renamedColumns
```


### `fact_velocity`

**Modo:** `import`  **Grupo:** `'Standalone Files'`  
**Colunas:** `Date` dateTime, `Key Column: Country | ASIN` string, `Updated Daily Velocity` double, `Updated Weekly Velocity` double, `Weekly MA Slow` double, `Weekly MA Medium` double, `Weekly MA Fast` double, `Minimum Inventory` double  
```powerquery
let
    Source = Excel.Workbook(File.Contents(path_to_files & "standalone_files\Velocity Database.xlsx"), null, true),
    Sheet1_Sheet = Source{[Item="Sheet1",Kind="Sheet"]}[Data],
    promotedHeaders = Table.PromoteHeaders(Sheet1_Sheet, [PromoteAllScalars=true]),
    changedType = Table.TransformColumnTypes(promotedHeaders,{{"Start Date", type date}, {"End Date", type date}, {"Region", type text}, {"Region-Base SKU", type text}, {"ASIN", type text}, {"Minimum Inventory", type number}, {"Updated Daily Velocity", type number}, {"Updated Weekly Velocity", type number}, {"Weekly MA Slow", type number}, {"Weekly MA Medium", type number}, {"Weekly MA Fast", type number}}),
    key_country_asin = Table.AddColumn(changedType, "Key Column: Country | ASIN", each [Region] & " | " & [ASIN],type text),
    filteredOutBlank = Table.SelectRows(key_country_asin, each [Start Date] <> null and [Start Date] <> ""),
    added_dateList = Table.AddColumn(filteredOutBlank, "Date", each List.Dates(
[Start Date]
, Duration.Days((if [End Date] = null then Date.From(DateTime.LocalNow()) else [End Date]) -[Start Date])+1
    ,#duration(1,0,0,0)
)),
    expanded_dateList = Table.ExpandListColumn(added_dateList, "Date"),
    removedOtherColumns = Table.SelectColumns(expanded_dateList,{"Date", "Key Column: Country | ASIN", "Minimum Inventory", "Updated Daily Velocity", "Updated Weekly Velocity","Weekly MA Slow","Weekly MA Medium","Weekly MA Fast"}),
    changedTypeDate = Table.TransformColumnTypes(removedOtherColumns,{{"Date", type date}})
in
    changedTypeDate
```


### `Inbound Shipments`

**Modo:** `import`  **Grupo:** `'Google Sheets - Inventory Tracker'`  
**Colunas:** `Quantity` int64, `Status` string, `SKU` string, `Region` string, `Type` string, `Origin` string, `Order Date` dateTime, `Delivery Date` dateTime, `Amazon Shipment Name` string, `Landed Cost Type` string, `Deliver At Type` string, `Deliver At Location` string, `Units / Carton` int64, `Carton Count` double, `Carton CBM` double, `Total CBM` double, `Order Id` string, `Amazon Shipment Id` string, `key_order_id_shipment_id` string, `Unit Purchase Cost Local Currency` double, `Total Purchase Cost Local Currency` double, `Unit Landed Cost Local Currency` double, `Total Landed Cost Local Currency` double, `Unit Transfer Cost Local Currency` double, `Total Transfer Cost Local Currency` double, `Unit Estimated 3pl Processing Fee` double, `Total Estimated 3pl Processing Fee` double, `Units Estimated 3pl Container Devanning` double, `Total Estimated 3pl Container Devanning` double, `Unit Inbound Placement Fee` double, `Total Unit Inbound Placement Fee` double, `Key Column: Region | SKU` string, `Unit_Landed_Cost_USD = ````, `Unit_Purchase_Cost_USD = ````, `Unit_Non_Purchase_Cost_USD = ````, `Supplier` string, `Freight Forwarder` string, `Unit_Non_Purchase_Cost_Local_Currency = ````  
```powerquery
let
    Source = td_full_order_transfer_details,

    #"Key Column: Region | SKU" = Table.RenameColumns(Source,{{"key_inventory_region_sku", "Key Column: Region | SKU"}}),

    RenomearColunas = Table.RenameColumns(
        #"Key Column: Region | SKU",
        {
            {"origin", "Origin"},
            {"type", "Type"},
            {"deliver_at_type", "Deliver At Type"},
            {"deliver_at_location", "Deliver At Location"},
            {"order_id", "Order Id"},
            {"amazon_shipment_id", "Amazon Shipment Id"},
            {"key_order_id_amazon_shipment_id", "key_order_id_shipment_id"},
            {"Key Column: Region | SKU", "Key Column: Region | SKU"}, // Mantido igual
            {"order_date", "Order Date"},
            {"delivery_date", "Delivery Date"},
            {"status", "Status"},
            {"amazon_shipment_name", "Amazon Shipment Name"},
            {"asin", "ASIN"}, // Nova coluna adicionada
            {"sku", "SKU"},    // Nova coluna adicionada
            {"quantity", "Quantity"},
            {"units_per_carton", "Units / Carton"},
            {"carton_count", "Carton Count"},
            {"carton_cbm", "Carton CBM"},
            {"total_cbm", "Total CBM"},
            {"inventory_region", "Region"},
            {"unit_purchase_cost_local_currency", "Unit Purchase Cost Local Currency"}, // USD → Local Currency
            {"total_purchase_cost_local_currency", "Total Purchase Cost Local Currency"},
            {"unit_landed_cost_local_currency", "Unit Landed Cost Local Currency"},
            {"total_landed_cost_local_currency", "Total Landed Cost Local Currency"},
            {"landed_cost_type", "Landed Cost Type"},
            {"unit_transfer_cost_local_currency", "Unit Transfer Cost Local Currency"},
            {"total_transfer_cost_local_currency", "Total Transfer Cost Local Currency"},
            {"unit_estimated_3pl_processing_fee", "Unit Estimated 3pl Processing Fee"},
            {"total_estimated_3pl_processing_fee", "Total Estimated 3pl Processing Fee"},
            {"units_estimated_3pl_container_devanning", "Units Estimated 3pl Container Devanning"},
            {"total_estimated_3pl_container_devanning", "Total Estimated 3pl Container Devanning"},
            {"unit_inbound_placement_fee", "Unit Inbound Placement Fee"},
            {"total_unit_inbound_placement_fee", "Total Unit Inbound Placement Fee"}
        },
        MissingField.Ignore // Ignora colunas não encontradas
    ),
    #"Merged Queries" = Table.NestedJoin(RenomearColunas, {"Order Id"}, fact_order_records, {"Order Id"}, "fact_order_records", JoinKind.LeftOuter),
    #"Expanded fact_order_records" = Table.ExpandTableColumn(#"Merged Queries", "fact_order_records", {"Supplier", "Freight Forwarder"}, {"Supplier", "Freight Forwarder"}),
    #"Filtered Rows" = Table.SelectRows(#"Expanded fact_order_records", each [Order Id] <> "")
in
    #"Filtered Rows"
```


### `Inventory Ledger`

**Modo:** `import`  **Grupo:** `Amazon\Fulfillment\reports_fulfillment`  
**Colunas:** `Date` dateTime, `Key Column: Country | SKU` string, `Disposition` string, `starting_warehouse_balance` int64, `ending_plus_transit` int64, `Key Column: Country | ASIN` string, `Location Group` string  
```powerquery
let
    #"Table Combine" = Table.Combine({raw_usCaMx_inventoryLedgerByCountry,raw_gbEu_inventoryLedgerByCountry}),
    #"Key Column: Country | SKU" = Table.AddColumn(#"Table Combine", "Key Column: Country | SKU", each [Location] & " | " & [MSKU], type text),
    #"Key Column: Country | ASIN" = Table.AddColumn(#"Key Column: Country | SKU", "Key Column: Country | ASIN", each [Location] & " | " & [ASIN
], type text),
    #"Removed Other Columns" = Table.SelectColumns(#"Key Column: Country | ASIN",{"Date", "Disposition", "Starting Warehouse Balance", "In Transit Between Warehouses", "Ending Warehouse Balance", "Key Column: Country | SKU", "Key Column: Country | ASIN"}),
    #"Inserted Addition" = Table.AddColumn(#"Removed Other Columns", "Addition", each [In Transit Between Warehouses] + [Ending Warehouse Balance], Int64.Type),
    #"Removed Columns" = Table.RemoveColumns(#"Inserted Addition",{"In Transit Between Warehouses", "Ending Warehouse Balance"}),
    #"Reordered Columns" = Table.ReorderColumns(#"Removed Columns",{"Date", "Key Column: Country | SKU", "Key Column: Country | ASIN", "Disposition", "Starting Warehouse Balance", "Addition"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Reordered Columns",{{"Starting Warehouse Balance", "starting_warehouse_balance"}, {"Addition", "ending_plus_transit"}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Columns1",{{"Key Column: Country | SKU", type text}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type", "Location Group", each "Amazon", type text),
    #"Appended Query" = Table.Combine({#"Added Custom", fact_BQ_inventory_ledger_summary_by_country}),
    #"Removed Duplicates" = Table.Distinct(#"Appended Query")
in
    #"Removed Duplicates"

// //let
//     Source = GoogleBigQuery.Database(),
//     #"amazon-sp-api-openbridge" = Source{[Name="amazon-sp-api-openbridge"]}[Data],
//     Gold_Layer_Schema = #"amazon-sp-api-openbridge"{[Name="Gold_Layer",Kind="Schema"]}[Data],
//     vw_full_inventory_ledger_summary_by_country_View = Gold_Layer_Schema{[Name="vw_full_inventory_ledger_summary_by_country",Kind="View"]}[Data],
//     #"Renamed Columns" = Table.RenameColumns(vw_full_inventory_ledger_summary_by_country_View,{{"key_column_inventory_country_sku", "Key Column: Country | SKU"}, {"date", "Date"}, {"disposition", "Disposition"}})
// in
//     #"Renamed Columns"
```


### `SCPR_Metrics`

**Modo:** `import`  **Grupo:** `LOG\SCPR`  
```powerquery
let
    Fonte = Table.FromRows(Json.Document(Binary.Decompress(Binary.FromText("i44FAA==", BinaryEncoding.Base64), Compression.Deflate)), let _t = ((type nullable text) meta [Serialized.Text = true]) in type table [#"Coluna 1" = _t]),
    #"Colunas Removidas" = Table.RemoveColumns(Fonte,{"Coluna 1"})
in
    #"Colunas Removidas"
```


### `shifting_fba_costs_aux_table`

**Modo:** `import`  
**Colunas:** `Alert`, `Order`  
```powerquery
DATATABLE(
    "Alert", STRING, "Order", INTEGER,
    {
        {"Red", 2},
        {"Yellow", 3},
        {"Red & Yellow",1 },
        {"Green", 4},
        {"All", 0}
    }
)
```


### `SKUs`

**Modo:** `import`  **Grupo:** `Dimensions`  
**Colunas:** `SKU` string, `ASIN` string, `FNSKU` string, `Country` string, `Key Column: Country | SKU` string, `ABC Co. Revenue` string, `ABC Family Units` string, `ABC Family Search Rank` string, `Final ABC Classification` string, `Base SKU` string, `Image URL` string, `Key Column: Country | ASIN` string, `Native Family` string, `Amazon Family` string, `Average Weekly Units` int64, `Average Weekly Revenue` int64, `Revenue% Co.` double, `Units% Family` double, `Sales Region` string, `Inventory Region` string, `Marketplace` string, `Key Column: Sales Region | SKU` string, `Key Column: Sales Region | ASIN` string, `Key Column: Inventory Region | SKU` string, `Key Column: Inventory Region | ASIN` string, `Key Column: Marketplace | SKU` string, `Key Column: Marketplace | ASIN` string, `Sales Region | Base SKU` string, `Inventory Region | Base SKU` string, `Refresh Date` dateTime, `Country (groups)' =`, `Key Column: Sales Region | FNSKU` string, `Key Column: Inventory Region | FNSKU` string, `Key Column: Country | FNSKU` string, `Key Column: Marketplace | FNSKU` string, `Key Column: Sales Region | Amazon Family` string, `Rope or Fabric` string, `Key Column: Sales Region | Country | SKU` string, `Country | SKU` string, `Country | Native Family` string, `Brand - Code` string, `Brand - Name` string, `Product General Type - Code` string, `Product General Type - Name` string, `Product Specific Type - Code` string, `Product Specific Type - Name` string, `Product Type Complete - Name` string, `Product Size - Code` string, `Product Size - Name` string, `Product Color - Code` string, `Product Color - Name` string, `Product Color - Pattern` string, `Product Set - Quantity` string, `Generic Family` string, `Core Family` string, `Specific Family` string, `Inner Type` string, `Units / Carton` int64, `Carton Weight (kg)` double, `Carton Dimensions (cm) Length` double, `Carton Dimensions (cm) Width` double, `Carton Dimensions (cm) Height` double, `Carton CBM` double, `Units / Package` int64, `Package Weight (kg)` double, `Package Dimensions (cm) Length` double, `Package Dimensions (cm) Width` double, `Package Dimensions (cm) Height` double, `Item Dimensions (cm) Length` string, `Item Dimensions (cm) Width` string, `Item Dimensions (cm) Height` string, `Item Dimensions (in) Length` string, `Item Dimensions (in) Width` string, `Item Dimensions (in) Height` string, `SKU Consertado` string, `Key Column: Inventory Region | SKU Consertado` string, `item_name` string, `item_description` string, `current_price` double, `open_date` string, `fulfillment_channel` string, `status` string, `AWD - Units / Carton` int64, `AWD - Carton Weight (kg)` double, `AWD - Carton Dimensions (cm) Length` double, `AWD - Carton Dimensions (cm) Width` double, `AWD - Carton Dimensions (cm) Height` double, `AWD - Carton CBM` double, `is_grade_and_resell` boolean, `Grade` string, `Package CBM` double, `Package Cubic Feet` double, `ABC Profitability` string, `Life Cycle` string, `Reorder Region` string, `Reorder Region | Base SKU` string, `ABC Sales` string  
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
    // #"Merged Queries - Curve ABC" = Table.NestedJoin(Custom2, {"Inventory Region | Base SKU"}, fAbcCurve, {"Inventory Region | BaseSKU"}, "Curve ABC", JoinKind.LeftOuter),
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
    //Filling life cycle "R" for SKUS grade & resell
    #"filling_grade_resell_life_cycle" = Table.ReplaceValue(#"__Expanded Life Cycle", each [Life Cycle], each 
if [is_grade_and_resell] = true then "R" 
else if Text.StartsWith([SKU], "Amazon.Found") then "F" 
else [Life Cycle], 
Replacer.ReplaceValue, {"Life Cycle"}),
    added_rope_or_fabric = Table.AddColumn(filling_grade_resell_life_cycle, "Rope or Fabric", each if Text.Contains([SKU], "OHFB") then "Fabric" else "Rope"),
    #"Removed Duplicates" = Table.Distinct(added_rope_or_fabric),
    added_sku_consertado = Table.AddColumn(#"Removed Duplicates", "SKU Consertado", each 

        let
            _countryPrefix = Text.Middle([SKU], 8,2),
            _skuConsertado = 
                if Text.Contains([SKU], "amzn.gr.") 
                then 
                    if _countryPrefix = "OH"
                    then [Base SKU]
                    else _countryPrefix & "-" & [Base SKU]
                    
                else if Text.Contains([SKU], "Amazon.Found")
                then [Sales Region] & "-" & [Base SKU] 
                
                else [SKU]
    
    in
            _skuConsertado),
    addedKey_inventoryRegion_skuConsertado = Table.AddColumn(added_sku_consertado, "Key Column: Inventory Region | SKU Consertado", each [Inventory Region] & " | " & [SKU Consertado]),
    #"Changed Type" = Table.TransformColumnTypes(addedKey_inventoryRegion_skuConsertado,{{"Base SKU", type text}, {"SKU", type text}, {"FNSKU", type text}, {"Inventory Region", type text}, {"Sales Region", type text}, {"Country", type text}, {"Amazon Family", type text}, {"Marketplace", type text}, {"ASIN", type text}, {"Image URL", type text}, {"Brand - Code", type text}, {"Brand - Name", type text}, {"Product General Type - Code", type text}, {"Product General Type - Name", type text}, {"Product Specific Type - Code", type text}, {"Product Specific Type - Name", type text}, {"Product Type Complete - Name", type text}, {"Product Size - Code", type text}, {"Product Size - Name", type text}, {"Product Color - Code", type text}, {"Product Color - Name", type text}, {"Product Color - Pattern", type text}, {"Product Set - Quantity", type text}, {"Generic Family", type text}, {"Core Family", type text}, {"Specific Family", type text}, {"Native Family", type text}, {"Inner Type", type text}, {"Units / Carton", Int64.Type}, {"Carton Weight (kg)", type number}, {"Carton Dimensions (cm) Length", type number}, {"Carton Dimensions (cm) Width", type number}, {"Carton Dimensions (cm) Height", type number}, {"Carton CBM", type number}, {"AWD - Units / Carton", Int64.Type}, {"AWD - Carton Weight (kg)", type number}, {"AWD - Carton Dimensions (cm) Length", type number}, {"AWD - Carton Dimensions (cm) Width", type number}, {"AWD - Carton Dimensions (cm) Height", type number}, {"AWD - Carton CBM", type number}, {"Units / Package", Int64.Type}, {"Package Weight (kg)", type number}, {"Package Dimensions (cm) Length", type number}, {"Package Dimensions (cm) Width", type number}, {"Package Dimensions (cm) Height", type number}, {"Package CBM", type number}, {"Package Cubic Feet", type number}, {"is_grade_and_resell", type logical}, {"Grade", type text}, {"Key Column: Sales Region | SKU", type text}, {"Key Column: Sales Region | ASIN", type text}, {"Key Column: Sales Region | FNSKU", type text}, {"Key Column: Sales Region | Amazon Family", type text}, {"Key Column: Sales Region | Country | SKU", type text}, {"Key Column: Inventory Region | SKU", type text}, {"Key Column: Inventory Region | ASIN", type text}, {"Key Column: Inventory Region | FNSKU", type text}, {"Key Column: Country | SKU", type text}, {"Key Column: Country | ASIN", type text}, {"Key Column: Country | FNSKU", type text}, {"Key Column: Marketplace | SKU", type text}, {"Key Column: Marketplace | ASIN", type text}, {"Key Column: Marketplace | FNSKU", type text}, {"Sales Region | Base SKU", type text}, {"Inventory Region | Base SKU", type text}, {"Country | SKU", type text}, {"Country | Native Family", type text}, {"Refresh Date", type date}, {"ABC Profitability", type text}, {"ABC Co. Revenue", type text}, {"ABC Family Units", type text}, {"ABC Family Search Rank", type text}, {"Final ABC Classification", type text}, {"item_name", type text}, {"item_description", type text}, {"current_price", type number}, {"open_date", type text}, {"fulfillment_channel", type text}, {"status", type text}, {"Rope or Fabric", type text}, {"SKU Consertado", type text}, {"Key Column: Inventory Region | SKU Consertado", type text}})
in
    #"Changed Type"
```


### `STAGING_fact_cross_sales`

**Modo:** `import`  **Grupo:** `STAGING`  
**Colunas:** `amazon_order_id` string, `date_all_orders` dateTime, `order_status` string, `item_status` string, `quantity_sku_analysis` int64, `item_status_cross_sales` string, `quantity_sku_cross_sales` int64, `is_same_sku` boolean, `key_sales_marketplace_sku_analysis` string, `key_sales_marketplace_sku_cross_sales` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Sales_Returns.vw_full_cross_sales"),
    added_keySalesMarketplaceSkuAnalysis = Table.AddColumn(Source, "key_sales_marketplace_sku_analysis", each [sales_marketplace] & " | " & [sku_analysis], type text),
    added_keySalesMarketplaceSkuCrossSales = Table.AddColumn(added_keySalesMarketplaceSkuAnalysis, "key_sales_marketplace_sku_cross_sales", each [sales_marketplace] & " | " & [sku_cross_sales], type text),
    #"Filter: Date - Local - 1" = Table.SelectRows(added_keySalesMarketplaceSkuCrossSales, each [#"date_all_orders"] <= Date.From(DateTime.LocalNow()) - #duration(1, 0, 0, 0)),
    #"Removed Other Columns" = Table.SelectColumns(#"Filter: Date - Local - 1",{"amazon_order_id", "date_all_orders", "order_status", "item_status", "quantity_sku_analysis", "item_status_cross_sales", "quantity_sku_cross_sales", "is_same_sku", "key_sales_marketplace_sku_analysis", "key_sales_marketplace_sku_cross_sales"})
in
    #"Removed Other Columns"
```


### `tab_parameters_measurements`

**Modo:** `import`  
**Colunas:** `Type`, `Order`  
```powerquery
DATATABLE(
    "Type", STRING,
    "Order", INTEGER,
    {
        {"Max", 1},
        {"Med", 2},
        {"Avg", 3},
        {"Min", 4}
    }
)
```


### `td_full_order_transfer_details`

**Modo:** `import`  **Grupo:** `'Google Sheets - Inventory Tracker\Transfer Details'`  
**Colunas:** `type` string, `origin` string, `deliver_at_type` string, `deliver_at_location` string, `order_id` string, `amazon_shipment_id` string, `key_order_id_amazon_shipment_id` string, `key_inventory_region_sku` string, `sku` string, `order_date` dateTime, `delivery_date` dateTime, `status` string, `amazon_shipment_name` string, `quantity` int64, `units_per_carton` int64, `carton_count` double, `carton_cbm` double, `total_cbm` double, `inventory_region` string, `landed_cost_type` string, `unit_transfer_cost_local_currency` double, `total_transfer_cost_local_currency` double, `unit_estimated_3pl_processing_fee` double, `total_estimated_3pl_processing_fee` double, `units_estimated_3pl_container_devanning` double, `total_estimated_3pl_container_devanning` double, `unit_inbound_placement_fee` double, `total_unit_inbound_placement_fee` double, `unit_purchase_cost_local_currency` double, `total_purchase_cost_local_currency` double, `unit_landed_cost_local_currency` double, `total_landed_cost_local_currency` double  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Google_Sheets.td_full_order_transfer_details")
in
    Source
```


### `The Date Picker`

**Colunas:** `Name` string, `Ordinal` int64  

### `z.dynamic_coupon_usage_percentage`

**Modo:** `import`  
**Colunas:** `Coupon Usage (%)`  
```powerquery
GENERATESERIES(0, 1, 0.01)
```


### `z.dynamic_Fees_absolute`

**Modo:** `import`  
**Colunas:** `teste Fees - $ and u`, `teste Fees - $ and u Fields`, `teste Fees - $ and u Order`  
```powerquery
{
    // Dynamic Parameter Selector of Amazon Fees Absolute Metrics ($ or u)
    ("Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 0),
    ("Storage Fee ($)", NAMEOF('Measurement Table'[$_estimated_storage_fee]), 1),
    ("Quantity on Hand", NAMEOF('Measurement Table'[u_quantity_on_hand_storage_fee]), 2),
    ("Inventory: Ending + Transit", NAMEOF('Measurement Table'[u_inventory_ending_plus_transit]), 3),
    ("None", NAMEOF([aux_blank_measure_slicer_filter]), 4)
}
```


### `z.dynamic_Fees_relative`

**Modo:** `import`  
**Colunas:** `teste Fees - %`, `teste Fees - % Fields`, `teste Fees - % Order`  
```powerquery
{
    // Dynamic Parameter Selector of Amazon Fees Relative Metrics (%)
    ("% Storage Fee", NAMEOF('Measurement Table'[%_estimated_storage_fee_over_revenue]), 0),
    ("None", NAMEOF('Measurement Table'[aux_blank_measure_slicer_filter]), 1)
}
```


### `z.dynamic_Growth_Comp_Rows`

**Modo:** `import`  
**Colunas:** `z.dynamic_GC_Rows`, `z.dynamic_GC_Rows Fields`, `z.dynamic_GC_Rows Order`, `Group`  
```powerquery
{
    ("Country", NAMEOF('SKUs'[Country]), 0, "Country View"),
    ("Amazon Family", NAMEOF('SKUs'[Amazon Family]), 1, "Country View"),
    ("Sales Region | Base SKU", NAMEOF('SKUs'[Sales Region | Base SKU]), 2, "Country View"),
    ("Sales Region | Base SKU", NAMEOF('SKUs'[Sales Region | Base SKU]), 3, "SKU View"),
    ("SKU", NAMEOF('SKUs'[SKU]), 4, "SKU View")
}
```


### `z.dynamic_Growth_Comp_selector`

**Modo:** `import`  
**Colunas:** `Group`  
```powerquery
{"Country View","SKU View"}
```


### `z.dynamic_Growth_Comp_Values`

**Modo:** `import`  
**Colunas:** `z.dynamic_GC_Values`, `z.dynamic_GC_Values Fields`, `z.dynamic_GC_Values Order`, `Group`  
```powerquery
{
    -- SKU View
    ("Total Sales", NAMEOF('Measurement Table'[$_revenue]), 1, "SKU View"),
    ("Δ$ Sales", NAMEOF('Measurement Table'[$_net_revenue_difference_between_periods_inactive_calendar]), 2, "SKU View"),
    ("Δ% Sales", NAMEOF('Measurement Table'[%_revenue_difference_between_periods_inactive_calendar]), 3, "SKU View"),
    ("Total Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 4, "SKU View"),
    ("ΔU Units Sold", NAMEOF('Measurement Table'[u_units_sold_difference_between_periods_inactive_calendar]), 5, "SKU View"),
    ("Δ% Units Sold", NAMEOF('Measurement Table'[%_units_sold_difference_between_periods_inactive_calendar]), 6, "SKU View"),
    ("Net Average Price", NAMEOF('Measurement Table'[$_net_average_price]), 7, "SKU View"),
    ("Δ% Net Average Price", NAMEOF('Measurement Table'[%_net_average_price_difference_between_periods_inactive_calendar]), 8, "SKU View"),
    ("PPC Sales", NAMEOF('Measurement Table'[$_ppc_sales]), 9, "SKU View"),
    ("Δ$ PPC Sales", NAMEOF('Measurement Table'[$_ppc_revenue_difference_between_periods_inactive_calendar]), 10, "SKU View"),
    ("Δ% PPC Sales", NAMEOF('Measurement Table'[%_ppc_revenue_difference_between_periods_inactive_calendar]), 11, "SKU View"),
    ("PPC Spend", NAMEOF('Measurement Table'[$_ppc_spend]), 12, "SKU View"),
    ("Δ$ PPC Spend", NAMEOF('Measurement Table'[$_ppc_spend_difference_between_periods_inactive_calendar]), 13, "SKU View"),
    ("Δ% PPC Spend", NAMEOF('Measurement Table'[%_ppc_spend_difference_between_periods_inactive_calendar]), 14, "SKU View"),
    ("PPC Sales Ratio", NAMEOF('Measurement Table'[%_ppc_ratio_revenue]), 15, "SKU View"),
    ("Δpp PPC Sales Ratio", NAMEOF('Measurement Table'[pp_ppc_ratio_revenue_difference_between_periods_inactive_calendar]), 16, "SKU View"),
    ("TACOS", NAMEOF('Measurement Table'[%_ppc_tacos]), 17, "SKU View"),
    ("Δpp TACOS", NAMEOF('Measurement Table'[pp_ppc_tacos_difference_between_periods_inactive_calendar]), 18, "SKU View"),
    ("ACOS", NAMEOF('Measurement Table'[%_ppc_acos]), 19, "SKU View"),
    ("Δpp ACOS", NAMEOF('Measurement Table'[pp_ppc_acos_difference_between_periods_inactive_calendar]), 20, "SKU View"),


    -- Country View
    ("Net Sales (Promotion Only)", NAMEOF('Measurement Table'[$_net_revenue]), 1, "Country View"),
    ("Net Sales (Promotion & VAT)", NAMEOF('Measurement Table'[$_net_revenue_promotion_tax]), 2, "Country View"),
    ("Δ$ Net Sales", NAMEOF('Measurement Table'[$_net_revenue_difference_between_periods_inactive_calendar]), 3, "Country View"),
    ("Δ% Net Sales", NAMEOF('Measurement Table'[%_revenue_difference_between_periods_inactive_calendar]), 4, "Country View"),
    ("Commercial Profit", NAMEOF('Measurement Table'[$_commercial_profit]), 5, "Country View"),
    ("Δ% Commercial Profit", NAMEOF('Measurement Table'[%_commercial_profit_difference_between_periods_inactive_calendar]), 6, "Country View"),
    ("Operational Profit", NAMEOF('Measurement Table'[$_operational_profit]), 7, "Country View"),
    ("Δ% Operational Profit", NAMEOF('Measurement Table'[%_operational_profit_difference_between_periods_inactive_calendar]), 8, "Country View"),
    ("Total Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 9, "Country View"),
    ("ΔU Units Sold", NAMEOF('Measurement Table'[u_units_sold_difference_between_periods_inactive_calendar]), 10, "Country View"),
    ("Δ% Units Sold", NAMEOF('Measurement Table'[%_units_sold_difference_between_periods_inactive_calendar]), 11, "Country View"),
    ("Net Average Price (Before)", NAMEOF('Measurement Table'[$_net_average_price_inactive_calendar]), 12, "Country View"),
    ("Net Average Price", NAMEOF('Measurement Table'[$_net_average_price]), 13, "Country View"),
    ("Δ% Net Average Price", NAMEOF('Measurement Table'[%_net_average_price_difference_between_periods_inactive_calendar]), 14, "Country View"),
    ("Organic Sales", NAMEOF('Measurement Table'[$_organic_revenue]), 15, "Country View"),
    ("Δ% Organic Sales", NAMEOF('Measurement Table'[%_organic_revenue_difference_between_periods_inactive_calendar]), 16, "Country View"),
    ("PPC Sales", NAMEOF('Measurement Table'[$_ppc_sales]), 17, "Country View"),
    ("Δ$ PPC Sales", NAMEOF('Measurement Table'[$_ppc_revenue_difference_between_periods_inactive_calendar]), 18, "Country View"),
    ("Δ% PPC Sales", NAMEOF('Measurement Table'[%_ppc_revenue_difference_between_periods_inactive_calendar]), 19, "Country View"),
    ("PPC Spend", NAMEOF('Measurement Table'[$_ppc_spend]), 20, "Country View"),
    ("Δ$ PPC Spend", NAMEOF('Measurement Table'[$_ppc_spend_difference_between_periods_inactive_calendar]), 21, "Country View"),
    ("Δ% PPC Spend", NAMEOF('Measurement Table'[%_ppc_spend_difference_between_periods_inactive_calendar]), 22, "Country View"),
    ("PPC Sales Ratio", NAMEOF('Measurement Table'[%_ppc_ratio_revenue]), 23, "Country View"),
    ("Δpp PPC Sales Ratio", NAMEOF('Measurement Table'[pp_ppc_ratio_revenue_difference_between_periods_inactive_calendar]), 24, "Country View"),
    ("TACOS", NAMEOF('Measurement Table'[%_ppc_tacos]), 25, "Country View"),
    ("Δpp TACOS", NAMEOF('Measurement Table'[pp_ppc_tacos_difference_between_periods_inactive_calendar]), 26, "Country View"),
    ("ACOS", NAMEOF('Measurement Table'[%_ppc_acos]), 27, "Country View"),
    ("Δpp ACOS", NAMEOF('Measurement Table'[pp_ppc_acos_difference_between_periods_inactive_calendar]), 28, "Country View")
}
```


### `z.dynamic_Inventory_column_axis`

**Modo:** `import`  
**Colunas:** `z.dynamic_inventory_column_axis`, `z.dynamic_inventory_column_axis Fields`, `z.dynamic_inventory_column_axis Order`, `Inventory Type`, `Axis`  
```powerquery
{
    ("Inbound Shipments - AWD", NAMEOF('Measurement Table'[u_quantity_inbound_shipments_awd]), 0,"Inventory - AWD","Column"),
    ("Inbound Shipments - Amazon", NAMEOF('Measurement Table'[u_quantity_inbound_shipments_amazon]), 1,"Inventory - Amazon","Column"),
    ("AWD Available Inventory", NAMEOF('Measurement Table'[u_inventory_awd_available]), 2,"Inventory - AWD","Column"),
    ("Amazon Available Inventory - Estimate", NAMEOF('Measurement Table'[u_stock_projection]), 3,"Inventory - Amazon","Column"),
    // ("Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 4,"Units Sold","Line"),
    // ("Low Stock (%)", NAMEOF('Measurement Table'[%_low_stock]), 5,"Units Sold","Line"),
    // ("Low Stock (%)", NAMEOF('Measurement Table'[%_low_stock]), 5,"Inventory - Amazon","Line"),
    // ("Low Stock (%)", NAMEOF('Measurement Table'[%_low_stock]), 5,"Inventory - AWD","Line"),
    ("Amazon Available Inventory - Actual", NAMEOF('Measurement Table'[u_inventory_ending_plus_transit]), 4,"Inventory - Amazon","Column")
}
```


### `z.dynamic_Inventory_line_axis`

**Modo:** `import`  
**Colunas:** `z.dynamic_inventory_switch`, `z.dynamic_inventory_switch Fields`, `z.dynamic_inventory_switch Order`, `Inventory Type`, `Axis`  
```powerquery
{
    // ("u_quantity_inbound_shipments_awd", NAMEOF('Measurement Table'[u_quantity_inbound_shipments_awd]), 0,"Inventory - AWD","Column"),
    // ("u_quantity_inbound_shipments_amazon", NAMEOF('Measurement Table'[u_quantity_inbound_shipments_amazon]), 1,"Inventory - Amazon","Column"),
    // ("u_inventory_awd_available", NAMEOF('Measurement Table'[u_inventory_awd_available]), 2,"Inventory - AWD","Column"),
    // ("u_stock_only_projection", NAMEOF('Measurement Table'[u_stock_only_projection]), 3,"Inventory - Amazon","Column"),
    ("Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 4,"Inventory - Amazon","Line"),
    ("Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 4,"Inventory - AWD","Line")
    // ("Low Stock (%)", NAMEOF('Measurement Table'[%_low_stock]), 5,"Units Sold","Line"),
    // ("Low Stock (%)", NAMEOF('Measurement Table'[%_low_stock]), 5,"Inventory - Amazon","Line"),
    // ("Low Stock (%)", NAMEOF('Measurement Table'[%_low_stock]), 5,"Inventory - AWD","Line")
    // ("u_inventory_ending_plus_transit", NAMEOF('Measurement Table'[u_inventory_ending_plus_transit]), 4,"Inventory - Amazon","Column")
}
```


### `z.dynamic_Inventory_selector`

**Modo:** `import`  
**Colunas:** `Inventory Type`  
```powerquery
{"Inventory - AWD","Inventory - Amazon"}
```


### `z.dynamic_Legend_Picker_ads performance`

**Modo:** `import`  
**Colunas:** `field_picker_ads_performance`, `field_picker_ads_performance Fields`, `field_picker_ads_performance Order`  
```powerquery
{
    ("Amazon Family", NAMEOF('SKUs'[Amazon Family]), 0),
    ("Native Family", NAMEOF('SKUs'[Native Family]), 1),
    ("SKU", NAMEOF('SKUs'[SKU]), 2)
}
```


### `z.dynamic_parameter_low_stock_tacos_acos`

**Modo:** `import`  
**Colunas:** `parameter lowStock - tacos e acos`, `parameter lowStock - tacos e acos Fields`, `parameter lowStock - tacos e acos Order`, `Theme`  
```powerquery
{
    ("Low Stock", NAMEOF('Measurement Table'[%_low_stock]), 0, "Low Stock"),
    ("Low Stock - Prev. Year", NAMEOF('Measurement Table'[%_low_stock_previous_year]), 1, "Low Stock"),
    ("TACOS", NAMEOF('Measurement Table'[%_ppc_tacos]), 2, "PPC"),
    ("ACOS", NAMEOF('Measurement Table'[%_ppc_sp_adv_prod_acos]), 3, "PCC"),
    ("Revenue Loss", NAMEOF('Measurement Table'[%_revenue_loss]), 4, "Revenue Loss"),
    ("Revenue Loss - Prev. Year", NAMEOF('Measurement Table'[%_revenue_loss_previous_year]), 5, "Revenue Loss")
}
```


### `z.dynamic_parameter_units_revenue_price`

**Modo:** `import`  
**Colunas:** `parameter_units_revenue_price`, `parameter_units_revenue_price Fields`, `parameter_units_revenue_price Order`, `Sales`, `Theme`  
```powerquery
{
    // ("Units Sold - Prev. Year", NAMEOF('Measurement Table'[u_units_sold_previous_year]), 0, "Units Sold", "Low Stock" ),
    // ("Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 0, "Units Sold", "Low Stock" ),
    // ("Net Revenue - Prev. Year", NAMEOF('Measurement Table'[$_net_revenue_previous_year]), 1, "Net Revenue", "Low Stock" ),
    // ("Net Revenue", NAMEOF('Measurement Table'[$_net_revenue]), 1, "Net Revenue", "Low Stock" ),
    // ("Net Price - Prev. Year", NAMEOF('Measurement Table'[$_net_average_price_previous_year]), 2, "Net Price", "Low Stock" ),
    // ("Net Price", NAMEOF('Measurement Table'[$_net_average_price]), 2, "Net Price", "Low Stock" ),
    ("Units Sold - Prev. Year", NAMEOF('Measurement Table'[u_units_sold_previous_year]), 0, "Units Sold", "Revenue Loss" ),
    ("Units Sold", NAMEOF('Measurement Table'[u_units_sold]), 0, "Units Sold", "Revenue Loss" ),
    ("Net Revenue - Prev. Year", NAMEOF('Measurement Table'[$_net_revenue_previous_year]), 1, "Net Revenue", "Revenue Loss" ),
    ("Net Revenue", NAMEOF('Measurement Table'[$_net_revenue]), 1, "Net Revenue", "Revenue Loss" ),
    ("Net Price - Prev. Year", NAMEOF('Measurement Table'[$_net_average_price_previous_year]), 2, "Net Price", "Revenue Loss" ),
    ("Net Price", NAMEOF('Measurement Table'[$_net_average_price]), 2, "Net Price", "Revenue Loss" ),
    ("Organic Sales", NAMEOF('Measurement Table'[$_organic_revenue]), 3, "PPC Sales", "PPC" ),
    ("PPC Sales", NAMEOF('Measurement Table'[$_ppc_sales]), 3, "PPC Sales", "PCC" ),
    // ("PPC Sales", NAMEOF('Measurement Table'[$_ppc_sp_adv_prod_sales]), 3, "PPC Sales", "PCC" ),
    ("Total Sales", NAMEOF('Measurement Table'[$_revenue]), 3, "PPC Sales", "PPC" ),
    ("Avg Unit Landed Cost", NAMEOF('Measurement Table'[$_avg_landed_cost]), 4, "Landed Cost", "Landed Cost" ),
    ("Avg Unit Landed Cost - Prev. Year", NAMEOF('Measurement Table'[$_avg_landed_cost_last_year]), 4, "Landed Cost", "Landed Cost" )

}
```


### `z.dynamic_scatter_plot_mapped_returns`

**Modo:** `import`  
**Colunas:** `dim_scatter_plot_mapped_returns`, `dim_scatter_plot_mapped_returns Fields`, `dim_scatter_plot_mapped_returns Order`  
```powerquery
{
    ("Amazon Family", NAMEOF('SKUs'[Amazon Family]), 0),
    ("Native Family", NAMEOF('SKUs'[Native Family]), 1),
    ("Life Cycle", NAMEOF('SKUs'[Life Cycle]), 2)
}
```


### `z.dynamic_SP_absolute`

**Modo:** `import`  
**Colunas:** `Sponsored Products - $ and u`, `Sponsored Products - $ and u Fields`, `Sponsored Products - $ and u Order`  
```powerquery
{
    // Dynamic Parameter Selector of Sponsored Products Absolute Metrics ($ or u)
// Units Sold
    ("Total Units Sold",      NAMEOF ( [u_units_sold]),                                 1),
    ("Organic Units Sold",    NAMEOF ( [u_organic_units_sold]),                         2),
    ("Ads Units Sold",        NAMEOF ( [u_ppc_units_sold]),                             3),
    ("SP Units Sold",         NAMEOF ( [u_ppc_sp_adv_prod_units_sold]),                 4),
    ("SP Units - Adv.",       NAMEOF ( [u_ppc_sp_adv_prod_units_sold_advertised_sku]),  5),
    ("SP Units - Other",      NAMEOF ( [u_ppc_sp_adv_prod_units_sold_other_sku]),       6),
    ("SB Units Sold",         NAMEOF ( [u_ppc_sb_att_pur_units_sold]),                  7),

// Spend
    ("Ads Spend",             NAMEOF ( [$_ppc_spend]),                                  8),
    ("SP Spend",              NAMEOF ( [$_ppc_sp_adv_prod_spend]),                      9),
    ("SB Spend",              NAMEOF ( [$_ppc_sb_att_pur_spend_by_sku]),                        10),

// Sales
    ("Total Sales ($)",       NAMEOF ( [$_revenue]),                                    11),
    ("Organic Sales ($)",     NAMEOF ( [$_organic_revenue]),                            12),
    ("Ads Sales ($)",         NAMEOF ( [$_ppc_sales]),                                  13),
    ("SP Sales ($)",          NAMEOF ( [$_ppc_sp_adv_prod_sales]),                      14),
    ("SP Sales ($) - Adv.",   NAMEOF ( [$_ppc_sp_adv_prod_sales_advertised_sku]),       15),
    ("SP Sales ($) - Other",  NAMEOF ( [$_ppc_sp_adv_prod_sales_other_sku]),            16),
    ("SB Sales ($)",          NAMEOF ( [$_ppc_sb_att_pur_sales]),                       17),

//Other Metrics
    ("SP Clicks",             NAMEOF ( [q_ppc_sp_adv_prod_clicks]),                     18),
    ("SP Impressions",        NAMEOF ( [q_ppc_sp_adv_prod_impressions]),                19),
    ("SP CPC",                NAMEOF ( [$_ppc_sp_adv_prod_cpc]),                        20),
    ("SP Orders",             NAMEOF ( [q_ppc_sp_adv_prod_orders]),                     21),    
    ("Net Average Price",     NAMEOF ( [$_net_average_price]),                          22),
    ("None",                  NAMEOF ( [aux_blank_measure_slicer_filter]),              23)
}
```


### `z.dynamic_SP_all_metrics`

**Modo:** `import`  
**Colunas:** `Unified Sponsored Products - $, u and %`, `Unified Sponsored Products - $, u and % Fields`, `Unified Sponsored Products - $, u and % Order`  
```powerquery
{
    // Dynamic Parameter Selector of Sponsored Products Metrics (%, $ or u)
    // Grupo: Sponsored Products - $ and u (Valores / Unidades)
    ("Total Units Sold",      NAMEOF([u_units_sold]),                                 1),
    ("Organic Units Sold",    NAMEOF([u_organic_units_sold]),                         2),
    ("Ads Units Sold",        NAMEOF([u_ppc_units_sold]),                             3),
    ("SP Units Sold",         NAMEOF([u_ppc_sp_adv_prod_units_sold]),                 4),
    ("SP Units - Adv.",       NAMEOF([u_ppc_sp_adv_prod_units_sold_advertised_sku]),  5),
    ("SP Units - Other",      NAMEOF([u_ppc_sp_adv_prod_units_sold_other_sku]),       6),
    ("SB Units Sold",         NAMEOF([u_ppc_sb_att_pur_units_sold]),                  7),

    // Spend
    ("Ads Spend",             NAMEOF([$_ppc_spend]),                                  8),
    ("SP Spend",              NAMEOF([$_ppc_sp_adv_prod_spend]),                      9),
    ("SB Spend",              NAMEOF([$_ppc_sb_att_pur_spend_by_sku]),                10),

    // Sales
    ("Total Sales ($)",       NAMEOF([$_revenue]),                                    11),
    ("Organic Sales ($)",     NAMEOF([$_organic_revenue]),                            12),
    ("Ads Sales ($)",         NAMEOF([$_ppc_sales]),                                  13),
    ("SP Sales ($)",          NAMEOF([$_ppc_sp_adv_prod_sales]),                      14),
    ("SP Sales ($) - Adv.",   NAMEOF([$_ppc_sp_adv_prod_sales_advertised_sku]),       15),
    ("SP Sales ($) - Other",  NAMEOF([$_ppc_sp_adv_prod_sales_other_sku]),            16),
    ("SB Sales ($)",          NAMEOF([$_ppc_sb_att_pur_sales]),                       17),

    // Other Metrics
    ("SP Clicks",             NAMEOF([q_ppc_sp_adv_prod_clicks]),                     18),
    ("SP Impressions",        NAMEOF([q_ppc_sp_adv_prod_impressions]),                19),
    ("SP CPC",                NAMEOF([$_ppc_sp_adv_prod_cpc]),                        20),
    ("SP Orders",             NAMEOF([q_ppc_sp_adv_prod_orders]),                     21),
    ("Net Average Price",     NAMEOF([$_net_average_price]),                          22),

    // Grupo: Sponsored Products - % (Percentuais)
    ("Ads Sales Ratio",       NAMEOF([%_ppc_ratio_revenue]),               23),
    ("SP Sales Ratio",        NAMEOF([%_ppc_sp_adv_prod_ratio_revenue]),   24),
    ("SB Sales Ratio",        NAMEOF([%_ppc_sb_att_pur_ratio_revenue]),    25),

    ("Ads TACOS",             NAMEOF([%_ppc_tacos]),                       26),
    ("SP TACOS",              NAMEOF([%_ppc_sp_adv_prod_tacos]),            27),
    ("SB TACOS",              NAMEOF([%_ppc_sb_att_pur_tacos]),             28),
    
    ("Ads ACOS",              NAMEOF([%_ppc_acos]),                        29),
    ("SP ACOS",              NAMEOF([%_ppc_sp_adv_prod_acos]),             30),
    ("SB ACOS",              NAMEOF([%_ppc_sb_att_pur_acos]),              31),
    
    ("SP CTR",               NAMEOF([%_ppc_sp_adv_prod_ctr]),              32),
    ("SP CVR",               NAMEOF([%_ppc_sp_adv_prod_cvr]),              33),
    ("SP ROAS",              NAMEOF([%_ppc_sp_adv_prod_roas]),             34),
    ("Low Stock",            NAMEOF([%_low_stock]),                        35),
    ("None",                 NAMEOF([aux_blank_measure_slicer_filter]),   36)
}
```


### `z.dynamic_SP_relative`

**Modo:** `import`  
**Colunas:** `Sponsored Products - %`, `Sponsored Products - % Fields`, `Sponsored Products - % Order`  
```powerquery
{
    // Dynamic Parameter Selector of Sponsored Products Relative Metrics (%)
    ("Ads Sales Ratio",  NAMEOF ( [%_ppc_ratio_revenue]),               1),
    ("SP Sales Ratio",   NAMEOF ( [%_ppc_sp_adv_prod_ratio_revenue]),   2),
    ("SB Sales Ratio",   NAMEOF ( [%_ppc_sb_att_pur_ratio_revenue]),    3),

    ("Ads TACOS",        NAMEOF ( [%_ppc_tacos]),                       4),
    ("SP TACOS",        NAMEOF ( [%_ppc_sp_adv_prod_tacos]),            5),
    ("SB TACOS",        NAMEOF ( [%_ppc_sb_att_pur_tacos]),             6),
    
    ("Ads ACOS",         NAMEOF ( [%_ppc_acos]),                        7),
    ("SP ACOS",         NAMEOF ( [%_ppc_sp_adv_prod_acos]),             8),
    ("SB ACOS",         NAMEOF ( [%_ppc_sb_att_pur_acos]),              9),
    
//Others
    ("SP CTR",           NAMEOF ( [%_ppc_sp_adv_prod_ctr]),            10),
    ("SP CVR",           NAMEOF ( [%_ppc_sp_adv_prod_cvr]),            11),
    ("SP ROAS",          NAMEOF ( [%_ppc_sp_adv_prod_roas]),           12),
    ("Low Stock",        NAMEOF ( [%_low_stock]),                      13),
    ("None",             NAMEOF ( [aux_blank_measure_slicer_filter]),  14)
}
```


### `z.dynamic_time_frame_switch`

**Modo:** `import`  
**Colunas:** `Date order' =`, `Abbreviated Date`, `Time Frame`, `Start Date`, `Time Frame Order`  
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


### `z.dynamic_traffic_channel`

**Modo:** `import`  
**Colunas:** `Parameter`, `Parameter Fields`, `Parameter Order`, `Channel`  
```powerquery
{
    ("Sessions", NAMEOF('Measurement Table'[u_sessions_mobile]), 0, "Mobile"),
    ("Sessions", NAMEOF('Measurement Table'[u_sessions_total]), 1, "Total"),
    ("Sessions", NAMEOF('Measurement Table'[u_sessions_browser]), 2, "Browser"),
    ("Page Views", NAMEOF('Measurement Table'[u_page_views_browser]), 3, "Browser"),
    ("Page Views", NAMEOF('Measurement Table'[u_page_views_mobile]), 4, "Mobile"),
    ("Page Views", NAMEOF('Measurement Table'[u_page_views_total]), 5, "Total")
}
```


### `z.list_of_warehouse_names`

**Modo:** `import`  
**Colunas:** `Type`, `Location Group`, `Deliver At Location`  
```powerquery
DISTINCT(
    FILTER(
        //UNION (
            //SELECTCOLUMNS(
              //  'Inventory 3PL',
                //"Warehouse 3pl Name", 'Inventory 3PL'[Warehouse 3pl],
                //"Type", "Warehouse"
            //),
            SELECTCOLUMNS(
                'Inbound Shipments',
                "Deliver At Location", 'Inbound Shipments'[Deliver At Location],
                "Type", 'Inbound Shipments'[Deliver At Type],
                "Location Group", 
                    SWITCH(
                        TRUE(), 
                        CONTAINSSTRING('Inbound Shipments'[Deliver At Location], "AWD"), "AWD",
                        'Inbound Shipments'[Deliver At Type] = "Warehouse", 'Inbound Shipments'[Deliver At Location], 
                        'Inbound Shipments'[Deliver At Type] = "Amazon", "Amazon"
                    )
            )
        //)
        , NOT ISBLANK ( [Deliver At Location])
    )
)
```


### `z.parameter_coverage_selection`

**Modo:** `import`  
**Colunas:** `parameter_coverage_selection`, `parameter_coverage_selection Fields`, `parameter_coverage_selection Order`, `parameter_coverage_selection Name`  
```powerquery
{
    ("d_amazon_coverage_in_days", NAMEOF('Measurement Table'[d_amazon_coverage_in_days]), 0, "Amazon"),
    ("d_awd_coverage_in_days", NAMEOF('Measurement Table'[d_awd_coverage_in_days]), 1, "AWD"),
    ("d_amazon_awd_coverage_in_days", NAMEOF('Measurement Table'[d_amazon_awd_coverage_in_days]), 2, "Amazon + AWD")
}
```


### `z.RowHeaderScorecardCoverage`

**Modo:** `import`  
**Colunas:** `index`, `row_header`  
```powerquery
{
    (  1, "Inventory: Amazon" ),
    (  2, "Inventory: AWD" ),
    (  3, "Velocity Daily" )
}
```


### `z.RowHeaderScorecardPpc`

**Modo:** `import`  
**Colunas:** `index`, `row_header`  
```powerquery
{
    (  1, "Net Revenue" ),
    (  2, "Organic Sales" ),
    (  3, "Total Units Sold" ),

    (  4, "PPC Sales" ),
    (  5, "PPC Spend" ),
    (  6, "Clicks" ),
    (  7, "Orders" ),
    (  8, "Conversion Rate" ),
    (  9, "CPC" ),
    ( 10, "ACoS %" ),
    ( 11, "TACos %" ),
    ( 12, "Ads Ratio" ),
    ( 13, "NAP" )
}
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



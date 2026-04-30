# OrganiHaus - Operations (Dashboard)

## Visao Geral

Dashboard operacional da OrganiHaus. Cobre logistica de entrada (inbound shipments, OTIF), devolucoes, cotacoes de frete, pedidos de compra, atendimento ao cliente, remedicoes FBA e avaliacoes de fornecedores/agentes (SCPR).

**Caminho do modelo:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Operations\OrganiHaus - Operations.SemanticModel`

**Arquitetura:** Modelo composto (Composite Model) — mistura DirectQuery ao modelo semantico OrganiHaus Base Tables (via Analysis Services) com tabelas Import de fontes locais e BigQuery.

---

## Arquitetura de Fontes

O modelo Operations e um **modelo composto** com tres camadas:

### 1. DirectQuery — OrganiHaus Base Tables (Analysis Services)
Conexao via `powerbi://api.powerbi.com/v1.0/myorg/OrganiHaus%20Marketing%20Intelligence%20Center%20-%20MIC` ao modelo semantico Base Tables. Tabelas consumidas diretamente:

| Tabela | Finalidade |
|---|---|
| `SKUs` | Dimensao mestre de produtos |
| `Calendar` | Dimensao temporal |
| `Inbound Shipments` | Transferencias de estoque (Google Sheets via BigQuery) |
| `Measurement Table` | Todas as medidas analiticas (vendas, inventario, returns, fees) |
| `fact_order_records` | Pedidos de compra |
| `fact_seller_suport_cases` | Casos de remedicao FBA |
| `fact_SCPR_all_reviews` | Avaliacoes de fornecedores/agentes |
| `dim_order_IDs` | Dimensao de IDs de pedidos |
| `dim_SCPR_category` | Categorias de avaliacao SCPR |
| `dim_SCPR_factory` | Fornecedores avaliados |
| `dim_SCPR_freight` | Agentes de frete avaliados |
| `dim_SCPR_type` | Tipo de entidade avaliada (factory/freight) |
| `shifting_fba_costs_aux_table` | Aux de alertas de variacao de FBA fee |
| `tab_parameters_measurements` | Field parameters de medicoes |

### 2. Import — BigQuery (consulta SQL nativa)

| Tabela | Query | Finalidade |
|---|---|---|
| `fact_transfer` | CTE multi-join em `1_Gold_Inventory.tb_log_full_inventory_amazon_inbound_shipments`, `1_Gold_Inventory.vw_full_inventory_amazon_inbound_shipments`, `1_Gold_Google_Sheets.td_full_order_transfer_details`, `1_Gold_Google_Sheets.td_full_order_records` | OTIF e Arrivals: shipments com datas de chegada, quantidades e status |

### 3. Import — Arquivos CSV/Excel locais (standalone_files)

| Arquivo | Tabela PBI | Conteudo |
|---|---|---|
| `standalone_files\db_amazon_cases.csv` | `fact_case_log` | Casos de inbound abertos com Amazon |
| `standalone_files\db_case_status_log.csv` | `case_status_update` (expressao auxiliar) | Log de atualizacoes de status dos casos |
| `standalone_files\db_lost_inbound_net_reimbursement.csv` | `fact_lost_inbound_reimbursements` | Reembolsos liquidos de unidades perdidas em transit |
| `standalone_files\freight_quotations.csv` | `fact_freight_negotiation` | Cotacoes de frete com FF, modal, custo/CBM, Incoterm |
| `standalone_files\customer_support_clickup_tasks.csv` | `fact_db_customer_support` | Tarefas de CS exportadas do ClickUp |
| `standalone_files\db_fulfillment_centers_address.xlsx` | `dim_td_fulfillment_centers_address` | Endereco e coordenadas de fulfillment centers |
| `standalone_files\td_exchange_rates.csv` | `dim_td_exchange_rates` (expressao aux) | Taxas de cambio para conversao a USD |
| `z_personal_folders\lucca_lanzellotti\...\relevant_internationevents_2023_2026.csv` | `relevant_internationevents_2023_2026` (expressao aux) | Eventos internacionais relevantes com range de datas e regiao |

---

## Funcoes e Expressoes Globais

| Nome | Tipo | Descricao |
|---|---|---|
| `bigQuery_customFunction` | Funcao M | Conecta ao projeto BigQuery `amazon-sp-api-openbridge` |
| `fn_AdicionarLeadTimes` | Funcao M | Calcula Total Lead Time, Ocean Time, Ground Freight, Production LT, Handling LT a partir de datas de transferencia |
| `case_status_update` | Expressao tabela | Le `db_case_status_log.csv`, deduplica por Case_ID mantendo o registro mais recente |
| `dim_td_exchange_rates` | Expressao tabela | Le `td_exchange_rates.csv` com date, currency_from/to, ticker, exchange_rate |
| `relevant_internationevents_2023_2026` | Expressao tabela | CSV de eventos internacionais expandido por dia e por regiao |
| `DirectQuery to AS - OrganiHaus - Base Tables` | Expressao conexao | Conecta ao workspace MIC via AnalysisServices.Database |

---

## Tabelas do Modelo

### fact_transfer
**Categoria:** Fato — OTIF e Arrivals
**Fonte:** BigQuery — consulta SQL nativa (Import)
**Query:** CTE que cruza `tb_log_full_inventory_amazon_inbound_shipments` (log de status por snapshot) com `vw_full_inventory_amazon_inbound_shipments` (nivel SKU), `td_full_order_transfer_details` (tipo e order_id) e `td_full_order_records` (supplier, freight_forwarder, agreed_delivery_date). Exclui status CANCELLED.
**Colunas principais:** `amazon_shipment_id`, `order_id`, `supplier`, `freight_forwarder`, `key_inventory_region_sku`, `quantity_shipped`, `quantity_received`, `quantity_discrepancy`, `last_shipment_status`, `current_status`, `order_date`, `delivery_date`, `agreed_delivery_date`, `LT` (lead time em dias), `inventory_region`, `type`

### fact_case_log
**Categoria:** Fato — Casos de Inbound
**Fonte:** CSV local — `standalone_files\db_amazon_cases.csv` (Import)
**Transformacoes:** Promove headers, tipifica campos, renomeia Case Status para Amazon Status, faz NestedJoin com `case_status_update` para trazer Case_Status atual (Closed_Date, Solution, Obs), calcula Solution LT (dias entre Case Creation e Closed_Date quando status = OK ou Unresponsive), substitui null em Case_Status por "Pending Status", deduplica por Case ID, filtra linhas com Amazon Shipment ID e Case ID nao vazios.

### fact_lost_inbound_reimbursements
**Categoria:** Fato — Reembolsos de Inbound
**Fonte:** CSV local — `standalone_files\db_lost_inbound_net_reimbursement.csv` (Import)
**Transformacoes:** Seleciona colunas relevantes, extrai data antes do espaco (approval_date), cria chave `ticker` (currency_unit + "USD"), faz NestedJoin com `dim_td_exchange_rates` para obter exchange_rate, calcula `net_amount_total_USD` e `amount_per_unit_USD`.

### fact_freight_negotiation
**Categoria:** Fato — Cotacoes de Frete
**Fonte:** CSV local — `standalone_files\freight_quotations.csv` (Import)
**Transformacoes:** Tipifica campos numericos e de data, recalcula `Freight_cost_CBM_USD` para FCL quando nulo (Total_cost_USD / 64), padroniza nomes de AWD Final_Destination (IUSF, IUSJ, IUSP, IUSQ, IUSR, IUST).
**Colunas:** `Quotation_ID`, `Quotation_Order`, `Quotation_Date`, `Freight_Forwarder`, `Mode_of_Transport`, `Final_Destination`, `Incoterm`, `Status`, `Transit_Time`, `CBM_m3`, `Freight_cost_CBM_USD`, `Freight_cost_USD`, `Additional_taxes_USD`, `Total_cost_USD`

### fact_db_customer_support
**Categoria:** Fato — Atendimento ao Cliente
**Fonte:** CSV local — `standalone_files\customer_support_clickup_tasks.csv` (Import, UTF-8, 20 colunas)
**Colunas principais:** `task_id`, `task_name`, `assignees`, `status`, `date_created`, `date_closed`, `due_date`, `lead_time_days`, `mkt`, `platform`, `order_id`, `sku`, `follow_up_needed`, `type_of_concern`, `detail_labels`, `case_type`, `Region`, `Complaint Type`, `follow_up_needed`

### fact_order_records
**Categoria:** Fato — Pedidos de Compra
**Fonte:** DirectQuery — OrganiHaus Base Tables
**Colunas:** Order Id, Supplier, Order Status, Alibaba Order, EXW Price, Invoice USD, Freight Forwarder, e campos de datas (Order Date, Pick up, Departure, Arrival, Delivery)

### fact_seller_suport_cases
**Categoria:** Fato — Casos de Remedicao FBA
**Fonte:** DirectQuery — OrganiHaus Base Tables (tabela oculta `isHidden`)
**Colunas:** Status, Date Created, Case ID, ASIN, SKU, Outcome, Country/Marketplace

### fact_SCPR_all_reviews
**Categoria:** Fato — Avaliacoes SCPR (Supplier & Carrier Performance Review)
**Fonte:** DirectQuery — OrganiHaus Base Tables
**Colunas:** Year, Quarter, Period, Company Name, Attribute, Grade, Comment

### dim_td_fulfillment_centers_address
**Categoria:** Dimensao — Enderecos de FCs
**Fonte:** Excel — `standalone_files\db_fulfillment_centers_address.xlsx`, aba `Fulfillment Centers Address` (Import)
**Transformacoes:** Promove headers, tipifica, remove linhas em branco, substitui string vazia em Country Region por "N/A".
**Colunas:** `Inventory Region`, `Inventory Country`, `FC`, `City`, `State`, `State Abrev.`, `Country Name`, `Country`, `Zip`, `Address`, `Latitude`, `Longitude`, `Country Region (US/CA Only)`

### SKUs, Calendar, Inbound Shipments, Measurement Table, dim_order_IDs, dim_SCPR_*, shifting_fba_costs_aux_table
**Fonte:** Todas via DirectQuery — OrganiHaus Base Tables. Ver documentacao de Base Tables para detalhes de cada tabela.

---

## Measures — _Operations Metrics

Tabela de medidas proprias do modelo Operations. Nao herda do Base Tables diretamente — calcula sobre as tabelas locais.

### Dominio: Shipment Cases

| Medida | Logica |
|---|---|
| `Total Shipment Cases` | DISTINCTCOUNT(fact_case_log[Case ID]) |
| `Open Shipment Cases` | CALCULATE(DISTINCTCOUNT, Case Status = "Follow Up") |
| `Pending Status Shipment Cases` | Cases com Status = "Pending Status" ou BLANK |
| `Average Solution LT` | AVERAGE(fact_case_log[Solution LT]) |
| `Cash Reimbursed (USD)` | SUM(fact_lost_inbound_reimbursements[net_amount_total_USD]) |
| `Inventory Recovered` | SUM(quantity_reimbursed_inventory) |
| `Units Accounted For` | SUM(net_quantity_total) |
| `Cost Accounted For (USD)` | SUMX por unidade * amount_per_unit_USD |
| `Distinct SKUs by Shipment` | CALCULATE(DISTINCTCOUNT Key Region|SKU por Shipment) |
| `GETIDA Cost (USD)` | 15% do Cost Accounted For quando Requester = "GETIDA" |

### Dominio: OTIF

| Medida | Logica |
|---|---|
| `OTIF_Score` | OT_Final x InFull_Score (combinado) |
| `OT_Final` | OnTime score ponderado por quantidade enviada |
| `OnTime_Score` | 1 se delay <= 0; MAX(0, 1 - delay/tolerance) se atraso |
| `InFull_Score` | AVERAGEX por SKU: 1 - ABS(qty_discrepancy)/qty_shipped (apenas CLOSED) |
| `DelayDays` | MAX(0, DATEDIFF(agreed_delivery_date, delivery_date, DAY)) |
| `Avg_Delay` | AVERAGEX(fact_transfer, [DelayDays]) |
| `LeadTime` | Dias entre order_date e delivery_date (ou hoje se em transit) |
| `Avg_LT` | AVERAGEX(fact_transfer, [LeadTime]) |
| `Qty_Shipments` | DISTINCTCOUNT(fact_transfer[amazon_shipment_id]) |
| `delivery_tolerance` | Constante = 3 dias |
| `DeliveryStatus` | Label textual (On Time / Delayed / In Transit) |
| `OTIF_Score Prev. Year` | OTIF_Score do mesmo periodo no ano anterior |
| `Shipment_Board_HTML` | HTML customizado para o board de shipments na pagina Arrivals |

### Dominio: Quotations (Frete)

| Medida | Logica |
|---|---|
| `Total Freight Cost` | SUM(fact_freight_negotiation[Total_cost_USD]) |
| `Avg Total Freight Cost` | AVERAGE(Total_cost_USD) |
| `Qty_approved_quotations` | DISTINCTCOUNT Quotation_ID onde Status = "Approved" |
| `Total_approved_cost` | SUM(Total_cost_USD) onde Status = "Approved" |
| `Avg_approved_cost_CBM` | AVERAGE(Freight_cost_CBM_USD) onde Status = "Approved" |
| `Qty_FF` | DISTINCTCOUNT(Freight_Forwarder) |
| `Avg_Cost_CBM` | AVERAGE(Freight_cost_CBM_USD) |

### Dominio: CS Tasks (Customer Support)

| Medida | Descricao |
|---|---|
| `Total CS Messages` | Total de mensagens/tarefas de CS |
| `Total Complaints` | Total de reclamacoes |
| `Total Questions` | Total de perguntas |
| `Product Issue Rate` | % de mensagens com problema de produto |
| `CS Refund Rate` | % de mensagens com reembolso |
| `CS Replacement Rate` | % de mensagens com substituicao |
| `FCR Rate` | First Contact Resolution Rate |
| `>48h Open Messages` | Mensagens abertas ha mais de 48h |
| `Avg Resolution Time (days)` | Tempo medio de resolucao |

### Dominio: Remeasurement Tasks

| Medida | Descricao |
|---|---|
| `Total Remeasurement Cases` | COUNTROWS(fact_seller_suport_cases) |
| `Total Open Cases` | Cases com status em aberto |
| `Avg Leadtime (days)` | Tempo medio de resolucao de casos de remedicao |
| `Total Refunds (USD)` | Total reembolsado em casos de remedicao |
| `% Cases with Refund` | % dos casos que resultaram em reembolso |
| `% Cases with Changes` | % dos casos que resultaram em alteracao de dimensoes |
| `% Cases with No Changes` | % dos casos sem alteracao |

## Measures — SCPR_Metrics

Medidas externas via `EXTERNALMEASURE` do Base Tables:

| Medida | Descricao |
|---|---|
| `weighted_average` | Media ponderada geral de avaliacao (supplier ou freight) |
| `fwd_weighted_average` | Media ponderada para freight forwarders |
| `supplier_weighted_average` | Media ponderada para fornecedores |
| `proactivity_grade` | Nota de proatividade |
| `price_grade` | Nota de pagamento/preco |
| `communication_grade` | Nota de comunicacao |
| `commitment_grade` | Nota de comprometimento |
| `Action` | Texto de acao recomendada |
| `grade_classification` | Classificacao textual (Excellent/Good/Poor) |

---

## Tabelas Auxiliares e Dinamicas

| Tabela | Tipo | Descricao |
|---|---|---|
| `z.dynamic_Solution_LT_Fields` | Field parameter | Alterna dimensao para analise de Solution LT em Shipment Cases |
| `z.dynamic_Quotation` | Field parameter | Alterna campo no grafico de cotacoes |
| `z.dynamic_time_frame_switch` | Field parameter (Base Tables) | Alterna granularidade temporal (diario/semanal/mensal) |
| `z_dyn.CS_Dims` | Field parameter | Dimensoes dinamicas para Customer Support |
| `z_dyn.CS_Metrics` | Field parameter | Metricas dinamicas para Customer Support |
| `z_dyn.Rmz_Dims` | Field parameter | Dimensoes dinamicas para Remeasurement |
| `z_dyn.Rmz_Metrics` | Field parameter | Metricas dinamicas para Remeasurement |
| `dim_scatter_plot_mapped_returns` | Dimensao aux | Campo para scatter plot de returns |
| `dim_bar_chart_aging_projection` | Dimensao aux | Campo para grafico de aging |
| `dim_SCPR_category` | Dimensao (BT) | Categorias de avaliacao: Proactivity, Payment, Commitment, Communication |
| `dim_SCPR_factory` | Dimensao (BT) | Lista de fornecedores avaliados |
| `dim_SCPR_freight` | Dimensao (BT) | Lista de freight forwarders avaliados |
| `dim_SCPR_type` | Dimensao (BT) | Tipo de entidade: Factory ou Freight |
| `dim_td_fulfillment_centers_address` | Dimensao local | FCs com coordenadas para mapa |
| `shifting_fba_costs_aux_table` | Aux (BT) | Alertas de variacao de FBA fee por SKU |
| `Contracted liquidator rate` | Parametro | Taxa de liquidacao para simulacao de aging |
| `Time range avg selling price` | Parametro | Janela de preco medio para simulacao |
| `f_aging_projection` | Fato (BT) | Projecao de aging por faixa |
| `relevant_internationevents_2023_2026` | Aux local | Eventos internacionais com datas e regioes expandidas |
| `zz_Refresh_Control` / `zz_Refresh_Control 2` | Aux | Controle de timestamp de refresh |

---

## Paginas e Visuais

### Pagina: Arrivals

Painel de acompanhamento de shipments em transit. Visual principal e um HTML customizado renderizado por `_Operations Metrics[Shipment_Board_HTML]` que exibe um board de status de shipments.

#### Slicers

| Slicer | Campo |
|---|---|
| Shipment ID | `fact_transfer[amazon_shipment_id]` |
| Tipo | `fact_transfer[type]` |
| Freight Forwarder | `fact_transfer[freight_forwarder]` |
| Order ID | `fact_transfer[order_id]` |
| Inventory Region | `SKUs[Inventory Region]` |
| Supplier | `fact_transfer[supplier]` |

#### Visual: Shipment Board (htmlContent)

| Role | Campo |
|---|---|
| content | `_Operations Metrics[Shipment_Board_HTML]` |

---

### Pagina: Shipment Cases Overview

Analise de casos abertos com a Amazon por shipments com unidades perdidas ou discrepantes.

#### Slicers

`Calendar[Date]`, `Inbound Shipments[Amazon Shipment Id]`, `SKUs[Inventory Region]`, `SKUs[SKU Consertado]`, `fact_case_log[Solution]`, `fact_case_log[Case ID]`, `z.dynamic_Solution_LT_Fields[z.dynamic_Solution_LT_Fields]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Operations Metrics[Total Shipment Cases]` | |
| `_Operations Metrics[Open Shipment Cases]` | |
| `_Operations Metrics[Pending Status Shipment Cases]` | Pending Status Cases |
| `_Operations Metrics[Average Solution LT]` | |
| `_Operations Metrics[Cash Reimbursed (USD)]` | |
| `_Operations Metrics[Units Accounted For]` | |
| `_Operations Metrics[Cost Accounted For (USD)]` | |

#### Visual: Bar Chart — Avg Solution LT por Regiao (barChart)

| Role | Campo |
|---|---|
| Category | `Inbound Shipments[Region]` |
| Y | `_Operations Metrics[Average Solution LT]` |

#### Visual: 100% Stacked Bar — Cases por Regiao e Solucao (hundredPercentStackedBarChart)

| Role | Campo |
|---|---|
| Category | `Inbound Shipments[Region]` |
| Series | `fact_case_log[Solution Category]` |
| Y | `_Operations Metrics[Total Shipment Cases]` |

#### Visual: Bar Chart — SKUs por Shipment (barChart)

| Role | Campo |
|---|---|
| Category | `Inbound Shipments[Region]` |
| Y | `_Operations Metrics[Distinct SKUs by Shipment]` |

#### Visual: Table — Detalhe de Casos (tableEx)

| Coluna | Campo |
|---|---|
| | `Calendar[Date]` |
| | `fact_case_log[Case Creation]` |
| | `Inbound Shipments[Amazon Shipment Id]` |
| | `fact_case_log[Case ID]` |
| SKUs | `_Operations Metrics[Distinct SKUs by Shipment]` |
| Solution LT | `_Operations Metrics[Average Solution LT]` |
| | `fact_case_log[Case Status]` |

#### Visual: Line Chart — SKUs por Shipment ao Longo do Tempo (lineChart)

| Role | Campo |
|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]`, `fact_case_log[Case Creation]` |
| Series | `Inbound Shipments[Region]` |
| Y | `_Operations Metrics[Distinct SKUs by Shipment]` |

---

### Pagina: OTIF

On Time, In Full — analise de performance de entrega de shipments.

#### Slicers

`fact_transfer[amazon_shipment_id]`, `fact_transfer[freight_forwarder]`, `fact_transfer[current_status]`, `fact_transfer[order_id]`, `fact_transfer[type]`, `SKUs[Inventory Region]`, `SKUs[SKU Consertado]`, `Calendar[Year]`, `Calendar[Month Abrev]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Operations Metrics[OTIF_Score]` | OTIF Score |
| `_Operations Metrics[OT_Final]` | On Time (OT) |
| `_Operations Metrics[InFull_Score]` | In Full (IF) |
| `_Operations Metrics[Avg_Delay]` | Avg Delay |
| `_Operations Metrics[Avg_LT]` | Avg LT |
| `_Operations Metrics[delivery_tolerance]` | Delivery Tolerance |
| `_Operations Metrics[Qty_Shipments]` | Qty Shipments |

#### Visual: Line Chart — OTIF Score ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` | |
| Y | `_Operations Metrics[OTIF_Score]` | OTIF Score |
| Y | `_Operations Metrics[OTIF_Score Prev. Year]` | OTIF Score Prev. Year |

#### Visual: Combo Chart — Shipments e Lead Time (lineStackedColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` | |
| Y | `_Operations Metrics[Qty_Shipments]` | Qty Shipments |
| Y2 | `_Operations Metrics[Avg_LT]` | Avg LT |

#### Visual: Pivot Table — Detalhe por Shipment e SKU (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `fact_transfer[amazon_shipment_id]` | |
| Rows | `fact_transfer[key_inventory_region_sku]` | |
| Values | `_Operations Metrics[DeliveryStatus]` | Delivery Status |
| Values | `_Operations Metrics[DelayDays]` | Delay Days |
| Values | `_Operations Metrics[LeadTime]` | |
| Values | `_Operations Metrics[OT_Final]` | OnTime Score |
| Values | `_Operations Metrics[InFull_Score]` | InFull Score |
| Values | `_Operations Metrics[OTIF_Score]` | OTIF Score |

---

### Pagina: Returns

Analise de devolucoes FBA mapeadas por motivo, familia de produto e regiao.

#### Slicers

`z.dynamic_time_frame_switch[Time Frame]`, `SKUs[is_grade_and_resell]`, `f.FBACustomerReturns[Return Reason Group]`, `SKUs[Native Family]`, `SKUs[SKU]`, `SKUs[Amazon Family]`, `SKUs[Inventory Region]`, `SKUs[Country]`, `Calendar[Year]`, `Calendar[Month Abrev]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[%_mapped_return_rate]` | % Mapped Return Rate |
| `Measurement Table[u_mapped_return_units]` | Mapped Returned Units |
| `Measurement Table[u_units_shipped]` | Units Shipped |

#### Visual: Combo Chart — Returns por Motivo e Regiao (lineStackedColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `f.FBACustomerReturns[Return Reason Group]`, `f.FBACustomerReturns[reason]` | |
| Series | `SKUs[Inventory Region]` | |
| Y | `Measurement Table[u_mapped_return_units]` | Mapped Returned Units |
| Y2 | `Measurement Table[%_mapped_return_rate]` | |

#### Visual: Combo Chart — Returns ao Longo do Tempo (lineClusteredColumnComboChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Y | `Measurement Table[u_mapped_return_units]` |
| Y2 | `Measurement Table[%_mapped_return_rate]` |

#### Visual: Pivot Table — Returns por Familia, Motivo e Cor (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Native Family]` | |
| Rows | `f.FBACustomerReturns[Return Reason Group]` | |
| Rows | `f.FBACustomerReturns[reason]` | |
| Rows | `SKUs[Product Color - Code]` | |
| Rows | `f.FBACustomerReturns[customer_comments]` | |
| Values | `Measurement Table[u_units_shipped]` | Units Shipped |
| Values | `Measurement Table[u_mapped_return_units]` | Mapped Return Units |
| Values | `Measurement Table[%_mapped_return_rate]` | % Mapped Return Rate |

---

### Pagina: Remeasurement Cases Overview

Casos de remedicao de dimensoes FBA abertos com a Amazon Seller Support.

#### Slicers

`fact_seller_suport_cases[Status]`, `fact_seller_suport_cases[Outcome]`, `SKUs[Country]`, `SKUs[Native Family]`, `SKUs[SKU]`, `z_dyn.Rmz_Dims[z_dyn.Rmz_Dims]`, `z_dyn.Rmz_Metrics[z_dyn.Rmz_Metrics]`, `z_dyn.CS_Metrics[z_dyn.CS_Metrics]`, `z.dynamic_time_frame_switch[Time Frame]`, `Calendar[Year]`, `Calendar[Month Abrev]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Operations Metrics[Total Remeasurement Cases]` | |
| `_Operations Metrics[Total Open Cases]` | |
| `_Operations Metrics[% Cases with Refund]` | |
| `_Operations Metrics[Cases with Changes]` | |
| `_Operations Metrics[No Change Cases]` | |
| `_Operations Metrics[Avg Leadtime (days)]` | Avg LeadTime (Days) |
| `_Operations Metrics[Total Refunds (USD)]` | |

#### Visual: Bar Chart — Avg Leadtime por Regiao (barChart)

| Role | Campo | Label |
|---|---|---|
| Category | `SKUs[Inventory Region]` | |
| Y | `_Operations Metrics[Avg Leadtime (days)]` | Avg LeadTime |

#### Visual: Column Chart — Cases ao Longo do Tempo por Outcome (columnChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Series | `fact_seller_suport_cases[Outcome]` |
| Y | `_Operations Metrics[Total Remeasurement Cases]` |

#### Visual: Pivot Table — Detalhe por Regiao, Familia e Case (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Inventory Region]`, `SKUs[Native Family]`, `SKUs[Base SKU]`, `fact_seller_suport_cases[Case ID]` | |
| Values | `_Operations Metrics[Total Remeasurement Cases]` | Cases |
| Values | `_Operations Metrics[% Cases with Refund]` | % Refund of Total |
| Values | `_Operations Metrics[% Cases with No Changes]` | % No Changes |
| Values | `_Operations Metrics[% Cases with Changes]` | % Changes |
| Values | `_Operations Metrics[Total Refunds (USD)]` | Refunds ($) |
| Values | `Measurement Table[d_days_since_last_support_case]` | Last Case (Days) |

---

### Pagina: Measure Comparison

Comparativo de FBA fees calculadas pela Amazon (fee preview) versus calculadas internamente (11 Brands). Identifica discrepancias que geram impacto financeiro.

#### Slicers

`SKUs[Sales Region]`, `SKUs[Country]`, `SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[SKU]`, `SKUs[Life Cycle]`, `SKUs[is_grade_and_resell]`, `Calendar[Year]`, `Calendar[Month Abrev]`, `z.dynamic_time_frame_switch[Time Frame]`, `shifting_fba_costs_aux_table[Alert]`

#### Visual: Pivot Table Principal — FBA Fee por SKU (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Country \| SKU]` | |
| Values | `Measurement Table[last_not_blank_life_cycle]` | Life Cycle |
| Values | `Measurement Table[$_unit_last_fba_fee_fee_preview]` | FBA Fee (Amazon) |
| Values | `Measurement Table[$_unit_last_fba_fee_calculation_expected]` | FBA Fee (11 Brands) |
| Values | `Measurement Table[$_unit_last_fba_fee_diff_estimated_expected]` | FBA Fee Δ Unit |
| Values | `Measurement Table[u_units_sold]` | Units Sold |
| Values | `Measurement Table[%_share_of_region_units_sold_last_12_months]` | Share Ltm by Sales Region & SKU |
| Values | `Measurement Table[u_inventory_region_ending_plus_transit]` | Total Inventory (Region) |
| Values | `Measurement Table[u_weighted_inventory_region]` | Weighted Total Inventory |
| Values | `Measurement Table[$_total_diff_fba_fee_by_weighted_stock]` | Inventory - FBA Fee Δ Total |
| Values | `Measurement Table[$_total_diff_fba_fee_by_unit_sold]` | Units Sold - FBA Fee Δ Total |
| Values | `Measurement Table[u_inventory_ending_plus_transit_all_dispositions]` | Total Inventory (Country) |
| Values | `Measurement Table[d_days_since_last_support_case]` | Days Since Last Support Case |

#### Visual: Pivot Table — Historico de Variacao de Fee (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Country \| SKU]` | |
| Values | `Measurement Table[u_inventory_ending_plus_transit]` | Inventory |
| Values | `Measurement Table[$_previous_diff_fba_fee]` | Prev. FBA Fee (Amazon) |
| Values | `Measurement Table[$_unit_last_fba_fee_fee_preview]` | FBA Fee (Amazon) |
| Values | `Measurement Table[Δ_last_previous_fee]` | Δ in % |
| Values | `Measurement Table[$_unit_last_fba_fee_calculation_expected]` | FBA Fee (11 Brands) |
| Values | `Measurement Table[flag_shifting_fba_costs]` | Flag |
| Values | `Measurement Table[d_previous_diff_date]` | Prev. Date |
| Values | `Measurement Table[d_diff_last_previous_days]` | Δ in days |

#### Visual: Table — Impacto por Familia (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `SKUs[Sales Region]` | |
| | `SKUs[Native Family]` | |
| | `Measurement Table[+_sum_diff_fba_fee_by_family]` | Fee Δ+ |
| | `Measurement Table[+_diff_fba_fee_by_family]` | SKUs Δ+ |
| | `Measurement Table[max_fba_fee_diff_by_native_family]` | Max |

#### Visual: Line Chart — FBA Fee ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Tooltips | `Measurement Table[%_avg_fba_fee_unit_year_over_year_yoy]` | Δ % |
| Y | `Measurement Table[$_avg_fba_unit_fee]` | FBA Fee Unit Current Year |
| Y | `Measurement Table[$_avg_fba_unit_fee_same_period_last_year]` | FBA Fee Unit Last Year |

---

### Pagina: Customer Support

Analise de atendimento ao cliente com metricas de volume, tipo de reclamacao, SLA e resolucao.

#### Slicers

`fact_db_customer_support[status]`, `fact_db_customer_support[mkt]`, `fact_db_customer_support[platform]`, `fact_db_customer_support[follow_up_needed]`, `SKUs[Native Family]`, `SKUs[SKU]`, `z.dynamic_time_frame_switch[Time Frame]`, `z_dyn.CS_Metrics[z_dyn.CS_Metrics]`, `z_dyn.CS_Dims[z_dyn.CS_Dims]`, `Calendar[Year]`, `Calendar[Month Abrev]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Operations Metrics[Total CS Messages]` | Total Messages |
| `_Operations Metrics[Total Questions]` | |
| `_Operations Metrics[Total Complaints]` | |
| `_Operations Metrics[Product Issue Rate]` | % Product Issues |
| `_Operations Metrics[FCR Rate]` | % FCR |
| `_Operations Metrics[CS Replacement Rate]` | % Replacements |
| `_Operations Metrics[CS Refund Rate]` | % Refunds |
| `_Operations Metrics[>48h Open Messages]` | |
| `_Operations Metrics[Avg Resolution Time (days)]` | Avg Res. Time (days) |

#### Visual: Column Chart — Mensagens ao Longo do Tempo por Tipo (columnChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Series | `fact_db_customer_support[case_type]` |
| Y | `_Operations Metrics[Total CS Messages]` |

#### Visual: Bar Chart — Perguntas por Regiao e Tipo de Reclamacao (barChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_db_customer_support[Region]` |
| Series | `fact_db_customer_support[Complaint Type]` |
| Y | `_Operations Metrics[Total Questions]` | Questions |

#### Visual: Pivot Table — CS por Familia de Produto (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Sales Region]`, `SKUs[Native Family]`, `SKUs[Base SKU]` | |
| Values | `_Operations Metrics[Total CS Messages]` | |
| Values | `_Operations Metrics[Total Complaints]` | Complaints |
| Values | `_Operations Metrics[Product Issue Rate]` | % Product Issues |
| Values | `_Operations Metrics[CS Replacement Rate]` | % Replacements |
| Values | `_Operations Metrics[CS Refund Rate]` | % Refunds |

---

### Pagina: Freight Quotation

Analise de cotacoes de frete — custo por CBM, transit time, agente, modal e destino.

#### Slicers

`dim_td_fulfillment_centers_address[Inventory Region]`, `fact_freight_negotiation[Incoterm]`, `fact_freight_negotiation[Freight_Forwarder]`, `fact_freight_negotiation[Mode_of_Transport]`, `Calendar[Date]`, `z.dynamic_Quotation[z.dynamic_Quotation]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Operations Metrics[Qty_approved_quotations]` | Approved Quotations |
| `_Operations Metrics[Total_approved_cost]` | Total Approved Cost (USD) |
| `_Operations Metrics[Avg_approved_cost_CBM]` | Avg Approved Cost per CBM (USD) |
| `_Operations Metrics[Qty_FF]` | Quoted Freight Forwarders |

#### Visual: Table — Cotacoes Detalhadas (tableEx)

Colunas: `fact_freight_negotiation[Freight_Forwarder]`, `[Mode_of_Transport]`, `dim_order_IDs[Region]`, `[Transit_Time]`, `[Freight_cost_CBM_USD]`, `[Additional_taxes_USD]`, `[Incoterm]`

#### Visual: Bar Chart — Avg Freight Cost por FF (barChart)

| Role | Campo |
|---|---|
| Category | `fact_freight_negotiation[Freight_Forwarder]` |
| Y | `_Operations Metrics[Avg Total Freight Cost]` |

#### Visual: Bar Chart — Avg Freight Cost por Regiao (barChart)

| Role | Campo |
|---|---|
| Category | `dim_td_fulfillment_centers_address[Inventory Region]` |
| Y | `_Operations Metrics[Avg Total Freight Cost]` |

#### Visual: Line Chart — Custo por CBM ao Longo do Tempo (lineChart)

| Role | Campo |
|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` |
| Series | `dim_td_fulfillment_centers_address[Country Region (US/CA Only)]` |
| Y | `_Operations Metrics[Avg_Cost_CBM]` |

#### Visual: Column Chart — Quantidade de Cotacoes Aprovadas (columnChart)

| Role | Campo |
|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` |
| Y | `_Operations Metrics[Qty_approved_quotations]` |

---

### Pagina: Orders Overview

Visao geral de pedidos de compra — custo, LT de producao, LT de frete e atrasos.

#### Slicers

`dim_SCPR_factory[Name]`, `dim_td_fulfillment_centers_address[Inventory Region]`, `fact_order_records[Order Status]`, `fact_freight_negotiation[Freight_Forwarder]`, `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month Abrev]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[Total_Order_Cost]` | Total Spend (USD) |
| `Measurement Table[Qty_Orders]` | Qty Orders |
| `Measurement Table[Average_CBM]` | Avg Order Volume (CBM) |
| `Measurement Table[%_Deliveries_on_Time]` | % Deliveries on Time |
| `Measurement Table[Average_Order_Delay]` | Avg Delivery Gap (Days) |
| `Measurement Table[Total_Order_LT]` | Avg Order LT (Days) |
| `Measurement Table[Average_Order_Review]` | Avg Order Review (Days) |

#### Visual: Combo Chart — Delay ao Longo do Tempo (lineStackedColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` | |
| Tooltips | `Measurement Table[%_Late_Deliveries]` | % Late Deliveries |
| Tooltips | `Measurement Table[Average_Delivery_Delay]` | Average Delivery Delay |
| Y | `Measurement Table[Average_Delivery_Delay]` | Average Delivery Delay |
| Y2 | `Measurement Table[%_Late_Deliveries]` | % Late Deliveries |

#### Visual: Combo Chart — LT por Regiao (lineStackedColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `dim_order_IDs[Region]` | |
| Y | `Measurement Table[Total_Production_LT]` | Production LT |
| Y | `Measurement Table[Total_Freight_LT]` | Freight LT |

#### Visual: Column Chart — Custo por Status de Pedido (clusteredColumnChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_order_records[Order Status]` | |
| Y | `Measurement Table[Total_Order_Cost]` | Total Order Cost |

#### Visual: Column Chart — Custo de Frete por FF (clusteredColumnChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_order_records[Freight Forwarder]` | |
| Y | `Measurement Table[Total_Freight_Cost]` | Total Freight Cost |

#### Visual: Column Chart — Custo de Producao por Supplier (clusteredColumnChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_order_records[Supplier]` | |
| Y | `Measurement Table[Total_Production_Cost]` | Total Production Cost |

#### Visual: Treemap — Pedidos por Regiao (treemap)

| Role | Campo | Label |
|---|---|---|
| Group | `dim_order_IDs[Region]` | |
| Values | `Measurement Table[Qty_Orders]` | Qty Orders |

---

### Pagina: Freight Forwarder Detail

Analise detalhada de performance de um agente de frete especifico.

#### Slicers

`Calendar[Date]`, `fact_freight_negotiation[Freight_Forwarder]`, `dim_SCPR_factory[Name]`, `dim_SCPR_freight[Name]`, `dim_td_fulfillment_centers_address[Inventory Region]`, `dim_order_IDs[Region]`, `fact_order_records[Order Status]`, `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month Abrev]`

#### Visual: Gauge — % On Time

| Role | Campo |
|---|---|
| Y | `Measurement Table[%_Freight_On_Time]` |

#### Visual: KPI Card — Metricas de Frete (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[Total_Freight_Cost]` | Total Freight Spend (USD) |
| `Measurement Table[Qty_Orders]` | Qty Orders |
| `Measurement Table[Average_Freight_Interval]` | Avg. Replenishment Interval (Days) |
| `Measurement Table[Average_Freight_Cost]` | Average Freight Cost (USD) |
| `Measurement Table[Average_CBM]` | Average Order Volume (CBM) |
| `Measurement Table[%_Deliveries_on_Time]` | % Deliveries on Time |
| `Measurement Table[Freight_Planned_LT]` | Average Agreed Freight LT (Days) |
| `Measurement Table[Freight_Actual_LT]` | Average Freight LT (Days) |
| `Measurement Table[Total_Customs_Exams_Charges]` | Total Customs Spend (USD) |

#### Visual: Line Chart — Custo por CBM (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` | |
| Y | `Measurement Table[Freight_Cost_per_CBM]` | Freight Cost per CBM |
| Y2 | `Measurement Table[Average Unit Non Purchase Cost USD]` | |

#### Visual: 100% Stacked Bar — Composicao do LT (hundredPercentStackedBarChart)

Ocean LT (`Measurement Table[Average_Ocean_LT]`) + Ground Freight LT (`Measurement Table[Average_Ground_LT]`)

#### Visual: 100% Stacked Bar — Composicao do Delay (hundredPercentStackedBarChart)

Departure Delay + Arrival at Port Delay

#### Visual: Radar Chart — Score SCPR de Frete (radarChart)

| Role | Campo | Label |
|---|---|---|
| category | `dim_SCPR_category[Category]` | |
| measure | `SCPR_Metrics[fwd_weighted_average]` | Weighted Average |

#### Visual: Treemap — Pedidos por FF

| Role | Campo |
|---|---|
| Group | `fact_order_records[Freight Forwarder]` |

---

### Pagina: Supplier Detail

Analise detalhada de performance de fornecedor especifico.

#### Slicers

`dim_SCPR_factory[Name]`, `SKUs[SKU Consertado]`, `Inbound Shipments[Status]`, `dim_order_IDs[Region]`, `Calendar[Date]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[Total_Production_Cost]` | Total Production Cost (USD) |
| `Measurement Table[Qty_Orders]` | Qty Orders |
| `Measurement Table[Average_Order_Interval]` | Avg Order Interval (Days) |
| `Measurement Table[Average_Order_Price]` | Avg Order Price (USD) |
| `Measurement Table[Average_Unit_Purchase_Cost_USD]` | Avg Unit Purchase Cost (USD) |
| `Measurement Table[%_Deliveries_on_Time]` | % Deliveries on Time |
| `Measurement Table[Average_Pick_Up_Delay]` | Avg Production Delay (Days) |
| `Measurement Table[Total_Production_LT]` | Avg Production LT (Days) |

#### Visual: Gauge — % Produced on Time

| Role | Campo |
|---|---|
| Y | `Measurement Table[%_Produced_on_Time]` |

#### Visual: Line Chart — Custo Unitario ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` | |
| Y | `Measurement Table[Average_Unit_Purchase_Cost_USD]` | Average |

#### Visual: Line Chart — Lead Time de Producao (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Year]`, `Calendar[Quarter Q]`, `Calendar[Month]` | |
| Y | `Measurement Table[Total_Production_LT]` | Actual |
| Y | `Measurement Table[Agreed_Production_LT]` | Agreed Production LT |

#### Visual: Pivot Table — Custo Unitario por Regiao e Familia (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `dim_order_IDs[Region]`, `SKUs[Native Family]`, `SKUs[SKU Consertado]` | |
| Values | `Measurement Table[Average_Units]` | Avg. Units |
| Values | `Measurement Table[Average_Unit_Purchase_Cost_USD]` | Avg. Unit Purchase Cost USD |

#### Visual: Radar Chart — Score SCPR de Fornecedor (radarChart)

| Role | Campo |
|---|---|
| category | `dim_SCPR_category[Category]` |
| measure | `SCPR_Metrics[supplier_weighted_average]` |

---

### Pagina: Scorecard Indicators

Cards de indicadores operacionais consolidados (returns, replacements, freight provision).

#### Slicers

`Calendar[Year]`, `Calendar[Month]`, `Calendar[Week Number 544]`, `Calendar[Date]`

#### Visual: Card — Return & Replacement KPIs (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[%_return_rate_MA_3M]` | Return Rate - 3M MA |
| `Measurement Table[%_replacement_rate_MA_3M]` | Replacement Rate - 3M MA |
| `Measurement Table[q_manual_replacement_orders]` | Manual Replacement Orders |
| `Measurement Table[u_return_units]` | Qty Returns |
| Rows | `SKUs[Sales Region]` |

#### Visual: Card — Freight Provision Variation (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[%_Freight_Provision_USD_Variation]` | First x Actual Freight Provision Variation |
| Rows | `dim_order_IDs[Region]` |

---

### Pagina: SCPR - Reviews

Avaliacoes de fornecedores e agentes de frete por categoria de criterio (Supplier & Carrier Performance Review).

#### Slicers

`dim_SCPR_type[Name]`, `fact_SCPR_all_reviews[Year]`, `fact_SCPR_all_reviews[Quarter]`

#### Visual: advancedSlicerVisual — Tipo de Entidade

| Values | `dim_SCPR_type[Type]` |

#### Visual: Tables — Score por Categoria (4x tableEx)

Cada tabela mostra `dim_SCPR_category[Short Name]` + `SCPR_Metrics[weighted_average]` (label: Average Rating) para diferentes subsets de entidades.

#### Visual: Card — Acao Recomendada

| Values | `SCPR_Metrics[Action]` |

#### Visual: Radar Chart — Score por Criterio (radarChart)

| Role | Campo |
|---|---|
| category | `dim_SCPR_category[Category]` |
| measure | `SCPR_Metrics[weighted_average]` |

---

### Pagina: SCPR - Reviews over Time

Evolucao historica das avaliacoes por criterio e por tipo de entidade.

#### Slicers

`dim_SCPR_type[Name]`, `fact_SCPR_all_reviews[Year]`, `fact_SCPR_all_reviews[Quarter]`

#### Visual: Line Chart — Criterios ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_SCPR_all_reviews[Period]` | |
| Y | `SCPR_Metrics[proactivity_grade]` | Proactivity |
| Y | `SCPR_Metrics[price_grade]` | Payment |
| Y | `SCPR_Metrics[commitment_grade]` | Commitment |
| Y | `SCPR_Metrics[communication_grade]` | Communication |

#### Visual: Line Chart — Score Geral por Entidade (lineChart)

| Role | Campo |
|---|---|
| Category | `fact_SCPR_all_reviews[Period]` |
| Series | `dim_SCPR_type[Name]` |
| Y | `SCPR_Metrics[weighted_average]` |

---

### Pagina: SCPR - Rankings

Ranking de fornecedores e agentes de frete por criterio de avaliacao.

#### Slicers

`fact_SCPR_all_reviews[Year]`, `fact_SCPR_all_reviews[Quarter]`

#### Visuais: Bar Charts — Ranking por Criterio (4x barChart)

Cada grafico: Category = `dim_SCPR_type[Name]`, Y = `SCPR_Metrics[weighted_average]` — um por criterio (Proactivity, Payment, Commitment, Communication).

---

### Pagina: Mapped Returns

Analise detalhada de devolucoes mapeadas com threshold por SKU e impacto financeiro de returns fee.

#### Slicers

`SKUs[is_grade_and_resell]`, `SKUs[Life Cycle]`, `SKUs[Sales Region]`, `SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[Base SKU]`, `dim_scatter_plot_mapped_returns[dim_scatter_plot_mapped_returns]`, `Calendar[Year]`, `Calendar[Month Abrev]`

#### Visual: Combo Chart — Returns Fee YoY (lineClusteredColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Start of Month]` | |
| Y | `Measurement Table[$_sku_returns_fee_sply]` | returns fee last year |
| Y | `Measurement Table[$_sku_returns_fee]` | returns fee this year |
| Y2 | `Measurement Table[u_units_shipped_sply]` | shipped units last year |
| Y2 | `Measurement Table[u_units_shipped]` | shipped units this year |

#### Visual: Combo Chart — Return Rate YoY (lineClusteredColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Start of Month]` | |
| Y | `Measurement Table[u_mapped_return_units_sply]` | returned units last year |
| Y | `Measurement Table[u_mapped_return_units]` | returned units this year |
| Y2 | `Measurement Table[%_mapped_return_rate_sply]` | return rate last year |
| Y2 | `Measurement Table[%_mapped_return_rate]` | return rate this year |

#### Visual: Pivot Table — Detalhe por Familia e SKU (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `SKUs[Native Family]`, `SKUs[Base SKU]`, `SKUs[SKU]` | |
| Values | `Measurement Table[u_units_shipped]` | Units Shipped |
| Values | `Measurement Table[u_mapped_return_units]` | Units Returned |
| Values | `Measurement Table[%_mapped_return_rate]` | Return Rate |
| Values | `Measurement Table[threshold_base_sku]` | Return Rate Threshold |
| Values | `Measurement Table[return_impact_share]` | Impact Share % |
| Values | `Measurement Table[return_impact_yoy]` | Impact Share YoY % |
| Values | `Measurement Table[u_sku_returned_units_charged]` | Units Charged |
| Values | `Measurement Table[$_sku_returns_fee]` | Return Fee |
| Values | `Measurement Table[returns_fee_share]` | Return Fee Share % |

#### Visual: KPI Card — Metricas de Return (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[avg_weighted_days_between_purchase_return]` | Avg. Days Between Purchase Returns |
| `Measurement Table[median_days_between_purchase_return]` | Median Days Between Purchase Returns |
| `Measurement Table[%_avg_mapped_return_rate]` | Avg. Mapped Return Rate |
| `Measurement Table[%_mapped_return_rate_US]` | Map. Return Rate US |
| `Measurement Table[%_mapped_return_rate_EU]` | Map. Return Rate EU |
| `Measurement Table[%_mapped_return_rate_GB]` | Map. Return Rate GB |
| `Measurement Table[%_mapped_return_rate_CA]` | Map. Return Rate CA |
| `Measurement Table[%_mapped_return_rate_MX]` | Map. Return Rate MX |

#### Visual: Scatter Plot — Return Rate vs Units Returned (scatterChart)

| Role | Campo | Label |
|---|---|---|
| Category | `dim_scatter_plot_mapped_returns[dim_scatter_plot_mapped_returns]` | |
| Series | `dim_scatter_plot_mapped_returns[dim_scatter_plot_mapped_returns]` | |
| X | `Measurement Table[%_mapped_return_rate]` | |
| Y | `Measurement Table[u_mapped_return_units]` | |
| Size | `Measurement Table[$_sku_returns_fee]` | returns fee |
| Tooltips | `Measurement Table[u_units_shipped]` | shipped units |

---

### Pagina: Aging Inventory

Gerenciamento de inventario com risco de aging surcharge. Simulacao de velocidade de vendas e projecao de custos. Mesma logica que a pagina equivalente no Base Tables, mas rodando no modelo Operations.

#### Slicers

`SKUs[Inventory Region]`, `SKUs[Native Family]`, `SKUs[Amazon Family]`, `SKUs[SKU]`, `SKUs[Life Cycle]`, `SKUs[is_grade_and_resell]`, `Calendar[Year-Month]`, `Calendar[Year]`, `Calendar[Month Abrev]`, `f_aging_projection[range]`, `Contracted liquidator rate[Contracted liquidator rate]`

#### Visual: KPI Card — Surcharge por Regiao (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[sum_aging_surcharge_CA]` | CA |
| `Measurement Table[sum_aging_surcharge_EU]` | EU |
| `Measurement Table[sum_aging_surcharge_GB]` | GB |
| `Measurement Table[sum_aging_surcharge_US]` | US |
| `Measurement Table[sum_aging_surcharge_MX]` | MX |
| `Measurement Table[sum_aging_surcharge_total]` | Total |

#### Visual: KPI Card — Historico de Surcharge (cardVisual)

| Medida | Label |
|---|---|
| `Measurement Table[$_avg_aging_surcharge_actual_previous_12_months]` | Avg Surcharge Prev 12M |
| `Measurement Table[$_avg_aging_surcharge_actual_previous_3_months]` | Avg Surcharge Prev 3M |
| `Measurement Table[$_aging_surcharge_actual_previous_month]` | Surcharge Previous Month |

#### Visual: Combo Chart — Projecao vs Snapshot (lineClusteredColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `Calendar[Start of Month]` | |
| Tooltips | `Measurement Table[%_diff_aging_surcharge_projection_snapshot]` | Δ Snapshot over Actual Projection |
| Y | `Measurement Table[$_aging_surcharge_snapshot]` | Snapshot Projection |
| Y | `Measurement Table[$_aging_surcharge_actual_projection]` | Aging Inventory Surcharge Projection |

#### Visual: 100% Stacked Bar — Faixas de Aging por Regiao (hundredPercentStackedBarChart)

| Role | Campo | Label |
|---|---|---|
| Category | `SKUs[Inventory Region]` | |
| Series | `f_aging_projection[range]` | |
| Y | `Measurement Table[sum_inventory_by_inbound_shipments_last_file]` | qty inventory |

#### Visual: Treemap — Surcharge por Regiao (treemap)

| Role | Campo |
|---|---|
| Group | `SKUs[Inventory Region]` |
| Values | `Measurement Table[$_aging_surcharge_last_file]` |

#### Visual: Pivot Table Principal — Simulacao de Aging (pivotTable)

Rows: Inventory Region, SKU. Values: action ends on, Projected Aging Surcharge, Available Inventory, qty projected inventory, qty inventory with surcharge, % inventory with surcharge, target sales, days until simulation date, daily avg units sold 30d, target daily sales, Δ increase daily sales, inventory coverage (days), $ actual aging cost, $ unit aging cost until selected period, $ storage fee until selected period, $ total until selected period, $ aging cost until end, $ storage fee until end, $ total until end, sunk cost, % margin.

---

### Paginas Ocultas

| Pagina | Tipo | Descricao |
|---|---|---|
| `Case Ovw TT` | Tooltip (ActualSize) | Tooltip de cases com tabela: Case Creation, Requester, Amazon Shipment ID, Case ID, SKUs, Solution, Solution LT |
| `Map.Returns_TT` | Tooltip (ActualSize) | Tooltip vazio/placeholder para pagina Mapped Returns |
| `OTIF_` | Oculta | Duplicata antiga da pagina OTIF com mesmos visuais |
| `Freight Quotation_` | Oculta | Duplicata antiga de Freight Quotation |
| `Orders Overview_` | Oculta | Duplicata antiga de Orders Overview |
| `Freight Forwarder Detail__` | Oculta | Versao anterior de Freight Forwarder Detail |
| `Page 1` | Oculta | Tabela de debug — shipments + cases raw |
| `Page 2` | Oculta | Versao antiga de Aging Inventory (mesmo conteudo) |

---

## Pontos de Atencao

- **fact_seller_suport_cases typo:** Nome da tabela tem "suport" sem segundo "p" — typo herdado do Base Tables.
- **Duplicatas de paginas:** Freight Forwarder Detail, OTIF, Freight Quotation e Orders Overview tem versoes ocultas (`_` no nome) — versoes antigas nao removidas.
- **Modelo composto:** Mistura DirectQuery (Base Tables) com Import (BigQuery e CSVs locais). Filtros cruzados entre modos podem ter comportamentos diferentes; algumas metricas do `Measurement Table` nao filtram tabelas locais diretamente.
- **standalone_files:** Todas as tabelas locais dependem de arquivos CSV/Excel em `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\`. Atualizacao manual desses arquivos e necessaria para refresh correto.
- **case_status_update:** O status atual dos casos e controlado pelo arquivo `db_case_status_log.csv` — separado do `db_amazon_cases.csv` que so tem os dados base. Sem o log, todos os casos ficam como "Pending Status".
- **fact_transfer via BigQuery SQL nativo:** Query complexa com CTEs — mudancas no schema das views BigQuery podem quebrar o modelo sem aviso.
- **SCPR_Metrics via EXTERNALMEASURE:** As medidas de avaliacao de fornecedor/agente sao delegadas ao Base Tables via `EXTERNALMEASURE`. Se o modelo Base Tables nao estiver acessivel ou atualizado, essas medidas retornam BLANK.

---

**Documentacao:** Eleven Brands · OrganiHaus - Operations · Dados & Analytics

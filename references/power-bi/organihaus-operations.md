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

## Relacionamentos

O modelo Operations e Composite: tabelas locais (Import) se juntam tanto com tabelas DirectQuery do Base Tables (Calendar, SKUs, dim_order_IDs, etc.) quanto entre si. O arquivo `.tmdl` define todos os relacionamentos — os listados abaixo sao os ativos; os inativos (ativados via USERELATIONSHIP) estao marcados.

**Padrao geral:** quase toda fact table tem dois relacionamentos:
1. `[coluna_de_data]` → `Calendar.Date` (many-to-one)
2. `[chave_composta]` → `SKUs.[Key Column: Tipo | Tipo]` (many-to-many — heranca do modelo estrela do Base Tables)

**Relacionamentos bidirecionais (ativos):**

| De | Para | Descricao |
|---|---|---|
| `z.dynamic_time_frame_switch.'Start Date'` | `Calendar.Date` | Seletor de granularidade temporal |
| `f.FBACustomerReturns.'order_id_sk \| key_marketplace_sku'` | `f.AllOrders.'order_id_sk \| key_marketplace_sku'` | Cross-filter returns ↔ orders |
| `td_full_order_transfer_details.key_inventory_region_sku` | `SKUs.'Key Column: Inventory Region \| SKU'` | Transferencias ↔ SKUs |
| `Inbound Shipments.'Order Id'` | `dim_order_IDs.'Order Id'` | Shipments ↔ order IDs |
| `Inbound Shipments.'Amazon Shipment Id'` | `fact_case_log.'Amazon Shipment ID'` | Shipments ↔ casos |
| `fact_SCPR_all_reviews.Attribute` | `dim_SCPR_category.Attribute` | SCPR reviews ↔ categorias |

**Relacionamentos inativos notaveis:**

| De | Para | Motivo |
|---|---|---|
| `Inbound Shipments.'Order Date'` | `Calendar.Date` | Alternativo ao Delivery Date — ativado em measures especificas |
| `Calendar.Date` | `dim_calendar_aux.'Date aux'` | Growth Comparison (USERELATIONSHIP) |
| `Inventory Ledger.'Key Column: Country \| ASIN'` | `SKUs.'Key Column: Country \| ASIN'` | Relacao ASIN inativa, usa Country\|SKU como ativa |
| `f_aging_projection.file_date` | `Calendar.Date` | Data do arquivo vs data de projecao |
| `f_promotion_tracker.start_date` | `Calendar.Date` | Alternativo ao end_date |
| `f.FBACustomerReturns.date_fba_customer_return` | `Calendar.Date` | Alternativo ao purchase_date |
| `fact_sp_purchased_products.key_marketplace_purchased_asin` | `dim_skus_aux.'Key Column: Marketplace \| ASIN'` | Cross-sales via SKU auxiliar |

**Relacionamentos de campo dinamico (field parameters):**

| De | Para |
|---|---|
| `z.dynamic_inventory_line_axis.'Inventory Type'` | `z.dynamic_inventory_selector.'Inventory Type'` |
| `z.dynamic_inventory_column_axis.'Inventory Type'` | `z.dynamic_inventory_selector.'Inventory Type'` |
| `z.dynamic_GC_Rows.Group` | `z.dynamic_GC_selector.Group` |
| `z.dynamic_GC_Values.Group` | `z.dynamic_GC_selector.Group` |
| `z.dynamic_parameter_difference_year_over_year.Category` | `z.dynamic_parameter_units_revenue_price.Sales` |
| `z.dynamic_parameter_low_stock_tacos_acos.Theme` | `z.dynamic_parameter_units_revenue_price.Theme` |

**Nota sobre fact_db_results_tio:** o relacionamento `fact_db_results_tio.key_invenotry_region_sku → SKUs.'Key Column: Inventory Region | SKU Consertado'` no arquivo `.tmdl` de Operations ainda referencia o nome antigo da coluna (`key_invenotry_region_sku` com typo). A coluna foi renomeada para `key_inventory_region_sku` no Base Tables — o modelo Operations pode precisar de republish para refletir essa mudanca.

---

## Medidas DAX — _Operations Metrics (67 medidas)


### (sem pasta)

#### `agora`

```dax
NOW()
```

#### `Shipment_Board_HTML`

**Depende de colunas:** `fact_transfer[agreed_delivery_date]`, `fact_transfer[amazon_shipment_id]`, `fact_transfer[current_status]`, `fact_transfer[destination_fulfillment_center_id]`, `fact_transfer[inventory_region]`, `fact_transfer[type]`  
```dax
VAR shipments =
    SUMMARIZE(
        FILTER(
            fact_transfer,
            fact_transfer[current_status] <> "CLOSED" &&
            NOT ISBLANK(fact_transfer[amazon_shipment_id])
        ),
        fact_transfer[agreed_delivery_date],
        fact_transfer[amazon_shipment_id],
        fact_transfer[inventory_region],
        fact_transfer[destination_fulfillment_center_id],
        fact_transfer[current_status],
        fact_transfer[type]
    )

VAR table_body_ =
    CONCATENATEX(
        shipments,
        VAR daysToArrival = DATEDIFF(TODAY(), fact_transfer[agreed_delivery_date], DAY)
        VAR remarks =
            SWITCH(
                TRUE(),
                daysToArrival < 0, "<span class='tag delayed'>DELAYED</span>",
                daysToArrival <= 2, "<span class='tag soon'>ARRIVING SOON</span>",
                "<span class='tag ont'>ON TIME</span>"
            )
        RETURN
        "<tr>" &
            "<td>" & fact_transfer[amazon_shipment_id] & "</td>" &
            "<td>" & fact_transfer[type] & "</td>" &
            "<td class='destination'>" & fact_transfer[inventory_region] & " - " & fact_transfer[destination_fulfillment_center_id] & "</td>" &
            "<td class='status'>" & fact_transfer[current_status] & "</td>" &
            "<td>" & FORMAT(fact_transfer[agreed_delivery_date], "dd MMM") & "</td>" &
            "<td>" & remarks & "</td>" &
        "</tr>",
        "",
        fact_transfer[agreed_delivery_date],
        ASC
    )

RETURN
"
<style>
    html, body {
        background-color: #1A1A1A;
        font-family: 'Roboto Mono', monospace;
        color: #f0f0f0;
        text-transform: uppercase;
        margin: 0;
        padding: 0;
    }

    /* --- Fundo de painel tipo LED --- */
    .board {
        background:
            repeating-linear-gradient(
                0deg,
                #1A1A1A 0px,
                #1A1A1A 2px,
                #181818 2px,
                #181818 4px
            ),
            repeating-linear-gradient(
                90deg,
                rgba(255,255,255,0.04) 0px,
                rgba(255,255,255,0.04) 1px,
                transparent 1px,
                transparent 3px
            );
        background-blend-mode: overlay;
        padding: 24px;
        border-radius: 12px;
        width: 100%;
        max-width: 1500px;
        overflow: hidden;
        animation: scan 5s linear infinite;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }

    @keyframes scan {
        0% { background-position: 0 0; }
        100% { background-position: 0 20px; }
    }

    /* --- Cabeçalho --- */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #f7b500;
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: 2px;
        padding-bottom: 16px;
        border-bottom: 2px solid #333;
        margin-bottom: 20px;
        text-shadow: 0 0 8px rgba(247,181,0,0.8);
        animation: glow 4s ease-in-out infinite alternate;
    }

    @keyframes glow {
        0% { text-shadow: 0 0 4px rgba(247,181,0,0.6); }
        100% { text-shadow: 0 0 12px rgba(247,181,0,1); }
    }

    .header span:last-child {
        color: #a0a0a0;
        font-size: 1.3rem;
        text-shadow: 0 0 5px rgba(255,255,255,0.4);
    }

    /* --- Tabela --- */
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 1.1rem;
        color: #f0f0f0;
    }

    thead {
        color: #a0a0a0;
        font-size: 0.9rem;
        letter-spacing: 1px;
        position: sticky;
        top: 0;
        background-color: #1A1A1A;
    }

    th, td {
        padding: 12px 10px;
        border-top: 1px solid #333;
        text-align: left;
    }

    td.destination { color: #f7b500; font-weight: 700; }
    td.status { color: #00ffff; }

    tbody tr {
        transition: background 0.3s ease, color 0.3s ease;
    }

    tbody tr:hover {
        background-color: rgba(255,255,255,0.05);
    }

    /* --- Scroll --- */
    .scroll-area {
        max-height: 650px;
        overflow-y: auto;
        scroll-behavior: smooth;
    }

    .scroll-area::-webkit-scrollbar { width: 10px; }
    .scroll-area::-webkit-scrollbar-thumb {
        background-color: rgba(160,160,160,0.4);
        border-radius: 6px;
    }
    .scroll-area::-webkit-scrollbar-track { background: #1A1A1A; }

    /* --- Tags de status --- */
    .tag {
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 4px;
        text-shadow: 0 0 6px currentColor;
        animation: blink 2s infinite;
    }

    .tag.delayed { color: #ff4d4d; }
    .tag.soon { color: #ffd633; animation: blink 3s infinite; }
    .tag.ont { color: #4dff88; animation: steady 4s infinite; }

    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    @keyframes steady {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.9; }
    }
</style>

<div class='board'>
    <div class='header'>
        <span>SHIPMENTS - ARRIVALS</span>
        <span>" & FORMAT(TODAY(), "dd MMM") & "</span>
    </div>

    <div class='scroll-area'>
        <table>
            <thead>
                <tr>
                    <th>Shipment</th>
                    <th>Type</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>ETA</th>
                    <th>Remarks</th>
                </tr>
            </thead>
            <tbody>
                " & table_body_ & "
            </tbody>
        </table>
    </div>
</div>
"
```

#### `<HTML> Logo_Arrivals`

```dax
"iVBORw0KGgoAAAANSUhEUgAABYAAAAUCCAMAAACE96fPAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAGDUExURQAAAP+/APe3APS1APezAPe1APi2APe1APe1APi0APe2APe0APe1APe1APe1APa0APW1AP+/APmzAPi1APi1APe1APe2APe1APe0APe1APi1APm0AP+/APe1APi2APe1APi4APW2APe1APi1APa2APe0APa0APe1APe1APe3APe1APa1APa1APe1APe1APa2APi0APe1APe0APe1APa0APa2APi1AO+vAPS1APi2APe1APKzAPe1APa0APe1APSzAdyiBMSRB7qLCaZ9DJVxDotqEHRaE2lSFFVEF0U5GjoyGx8fHzcwHEE2GmZRFXBXE5JvD7aICcGQCPCwAdifBL2NCKJ6DIhoEG1VFFJDGDMtHE5AGIRlEJ94DdWeBbSGCo5sDz41G2JOFbCDCtGbBc+ZBpl0DndcEks+GSonHiYkHkc7GciUB+2uAlxJFumsAn1gESMiH62CC+apAsuWBuOnA6l/CywoHd+kA1lHF5t1DTArHXtfEmBMFoFjEfe1APe1APveJpwAAACBdFJOUwAEIDBAYGyAm6u/29/r/3A0CChIaIenx/P3TCwMZIvLJFDXr1Rck+PnPHiz77d8HETTw/tYOM8QGI+fFIN0u/////////////////////////////////////////////////////////////////////////////////////+jl+7KY3IAAAAJcEhZcwAAMsAAADLAAShkWtsAAJA3SURBVHhe7d13eytH/TZwBwKBFEFoSSBACPxIgIQWSkgAuTe5y733Ile5HHc/vPTnsn2OLd2a1U7fnd3789e57N2RtEe6vZrynZaW4L32jW++/q1vv/Gd7755762333777XcKRJQp79x/st96+JB/9ztvfO9br3//G69hFpA/7/7ghz/68U/ee/t9/I8ionz44O33fvLjH/30Zx9iOpA7H37/57/47i95k0tEL73zy+/+4kffZw479tGv3vjux3jtiYjuvfXrN37zA0wNsuEb//fbX7K3gYhivP/L73zrI8wPMvDNH/3kE7zKRERRPv3J976JOULqXvvd7//wGV5cIqI473/+x9ffxUQheX/6+XfZ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
"
```


### CS Tasks

#### `Total CS Messages`

```dax
COUNTROWS(fact_db_customer_support)
```

#### `Total Complaints`

**Depende de colunas:** `fact_db_customer_support[case_type]`  
```dax
COUNTROWS(
    FILTER(fact_db_customer_support, fact_db_customer_support[case_type] = "Complaint")
)
```

#### `Total Questions`

**Depende de colunas:** `fact_db_customer_support[case_type]`  
```dax
COUNTROWS(
    FILTER(fact_db_customer_support, fact_db_customer_support[case_type] = "Question")
)
```

#### `Avg Resolution Time (days)`

**Depende de colunas:** `fact_db_customer_support[lead_time_days]`  
```dax
AVERAGEX(
    FILTER(
        fact_db_customer_support,
        NOT ISBLANK(fact_db_customer_support[lead_time_days])
    ),
    fact_db_customer_support[lead_time_days]
)
```

#### `FCR Rate`

**Depende de medidas:** `[Total CS Messages]`  
**Depende de colunas:** `fact_db_customer_support[is_fcr]`  
```dax
DIVIDE(
    COUNTROWS(FILTER(fact_db_customer_support, fact_db_customer_support[is_fcr] = 1)),
    [Total CS Messages]
)
```

#### `>48h Open Messages`

**Depende de colunas:** `fact_db_customer_support[date_created]`, `fact_db_customer_support[status]`  
```dax
COUNTROWS(
    FILTER(
        fact_db_customer_support,
        fact_db_customer_support[status] IN {"open", "ongoing", "follow-up needed"}
            && DATEDIFF(fact_db_customer_support[date_created], NOW(), HOUR) > 48
    )
)
```

#### `CS Refund Rate`

**Depende de medidas:** `[Total Complaints]`, `[Total Refund Messages]`  
```dax
DIVIDE(
    [Total Refund Messages],
    [Total Complaints]
)
```

#### `CS Replacement Rate`

**Depende de medidas:** `[Total Complaints]`, `[Total Replacement Messages]`  
```dax
DIVIDE(
    [Total Replacement Messages],
    [Total Complaints]
)
```

#### `Product Issue Rate`

**Depende de medidas:** `[Total Complaints]`, `[Total Product Issues]`  
```dax
DIVIDE(
    [Total Product Issues],
    [Total Complaints]
)
```

#### `Total Refund Amount`

**Depende de colunas:** `fact_db_customer_support[refund_value]`  
```dax
SUMX(
    FILTER(fact_db_customer_support, fact_db_customer_support[refund_value] > 0),
    fact_db_customer_support[refund_value]
)
```

#### `Total Replacement Amount`

**Depende de colunas:** `fact_db_customer_support[replacement_value]`  
```dax
SUMX(
    FILTER(fact_db_customer_support, fact_db_customer_support[replacement_value] > 0),
    fact_db_customer_support[replacement_value]
)
```

#### `Total Product Issues`

**Depende de colunas:** `fact_db_customer_support[case_type]`, `fact_db_customer_support[is_product_issue]`  
```dax
COUNTROWS(
    FILTER(fact_db_customer_support,
        fact_db_customer_support[case_type] = "Complaint"
            && fact_db_customer_support[is_product_issue] = 1
    )
)
```

#### `Total Refund Messages`

**Depende de colunas:** `fact_db_customer_support[case_type]`, `fact_db_customer_support[refund_value]`  
```dax
COUNTROWS(
        FILTER(fact_db_customer_support,
            fact_db_customer_support[case_type] = "Complaint"
                && fact_db_customer_support[refund_value] > 0
        )
    )
```

#### `Total Replacement Messages`

**Depende de colunas:** `fact_db_customer_support[case_type]`, `fact_db_customer_support[replacement_value]`  
```dax
COUNTROWS(
        FILTER(fact_db_customer_support,
            fact_db_customer_support[case_type] = "Complaint"
                && fact_db_customer_support[replacement_value] > 0
        )
    )
```

#### `Complaint Rate`

**Depende de medidas:** `[Total Complaints]`  
```dax
DIVIDE(
    [Total Complaints],
    [Total Complaints]
)
```


### OTIF

#### `DelayDays`

**Depende de colunas:** `fact_transfer[agreed_delivery_date]`, `fact_transfer[delivery_date]`  
```dax
VAR delivery = MAX(fact_transfer[delivery_date])
VAR agreed = MAX(fact_transfer[agreed_delivery_date])
VAR delay = DATEDIFF(agreed, delivery, DAY)
RETURN IF(ISBLANK(delivery), BLANK(), MAX(0, delay))
```

#### `InFull_Score`

**Depende de colunas:** `fact_transfer[key_inventory_region_sku]`, `fact_transfer[last_shipment_status]`, `fact_transfer[quantity_discrepancy]`, `fact_transfer[quantity_shipped]`  
```dax
AVERAGEX(
    VALUES(fact_transfer[key_inventory_region_sku]),
    VAR qty_shipped = SUM(fact_transfer[quantity_shipped])
    VAR qty_discrepancy = SUM(fact_transfer[quantity_discrepancy])
    VAR status_ = MAX(fact_transfer[last_shipment_status])
    RETURN
        IF(
            status_ <> "CLOSED" || qty_shipped = 0,
            BLANK(),
            1 - ABS(qty_discrepancy) / qty_shipped
        )
)
```

#### `OnTime_Score`

**Depende de medidas:** `[delivery_tolerance]`  
**Depende de colunas:** `fact_transfer[agreed_delivery_date]`, `fact_transfer[delivery_date]`  
```dax
VAR delivery = MAX(fact_transfer[delivery_date])
VAR agreed = MAX(fact_transfer[agreed_delivery_date])
VAR tolerance = [delivery_tolerance]
VAR delay = DATEDIFF(agreed, delivery, DAY)
RETURN
IF(
    ISBLANK(delivery),
    BLANK(),
    IF(
        delay <= 0,
        1,
        MAX(0, 1 - delay / tolerance)
    )
)
```

#### `OnTime_Weighted`

**Depende de medidas:** `[OnTime_Score]`  
**Depende de colunas:** `fact_transfer[quantity_shipped]`  
```dax
VAR ot_score = [OnTime_Score]
VAR qty_shipped = SUM(fact_transfer[quantity_shipped])
RETURN
IF(ISBLANK(ot_score) || qty_shipped = 0, BLANK(), ot_score * qty_shipped)
```

#### `OTIF_Score`

**Depende de medidas:** `[InFull_Score]`, `[OT_Final]`  
```dax
VAR OT = [OT_Final]
VAR IF_ = [InFull_Score]
RETURN
DIVIDE(OT + IF_, 2)
```

#### `delivery_tolerance`

```dax
3
```

#### `DeliveryStatus`

**Depende de medidas:** `[delivery_tolerance]`  
**Depende de colunas:** `fact_transfer[agreed_delivery_date]`, `fact_transfer[delivery_date]`  
```dax
VAR delivery = MAX(fact_transfer[delivery_date])
VAR agreed = MAX(fact_transfer[agreed_delivery_date])
VAR tolerance = [delivery_tolerance]
VAR delay = DATEDIFF(agreed, delivery, DAY)
RETURN
IF(
    ISBLANK(delivery),
    BLANK(),
    IF(
        delay <= tolerance,
        "On Time",
        "Delayed"
    )
)
```

#### `OT_Final`

**Depende de medidas:** `[Delay]`, `[Score]`, `[Tolerance]`, `[delivery_tolerance]`  
**Depende de colunas:** `fact_transfer[agreed_delivery_date]`, `fact_transfer[delivery_date]`, `fact_transfer[quantity_shipped]`  
```dax
VAR Table_ =
    ADDCOLUMNS(
        fact_transfer,
        "Delay",
            DATEDIFF(
                fact_transfer[agreed_delivery_date],
                fact_transfer[delivery_date],
                DAY
            ),
        "Tolerance", [delivery_tolerance]
    )
VAR Calc_ =
    ADDCOLUMNS(
        Table_,
        "Score",
            IF(
                ISBLANK([delivery_date]),
                BLANK(),
                IF(
                    [Delay] <= 0,
                    1,
                    MAX(0, 1 - [Delay] / [Tolerance])
                )
            )
    )
VAR Weighted = SUMX(Calc_, [Score] * fact_transfer[quantity_shipped])
VAR TotalQty = SUM(fact_transfer[quantity_shipped])
RETURN DIVIDE(Weighted, TotalQty)
```

#### `Avg_Delay`

**Depende de medidas:** `[DelayDays]`  
```dax
AVERAGEX(fact_transfer,[DelayDays])
```

#### `InFull_Score YoY`

**Depende de medidas:** `[InFull_Score]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [InFull_Score]
VAR LastYear = CALCULATE([InFull_Score], SAMEPERIODLASTYEAR('Calendar'[Date]))
VAR Diff = DIVIDE(Current_ - LastYear, LastYear)
RETURN
    IF(
        Diff > 0, "▲ ",
        IF(Diff < 0, "▼ ", "")
    ) & FORMAT(Diff, "0%")
```

#### `OT_Final YoY`

**Depende de medidas:** `[OT_Final]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [OT_Final]
VAR LastYear = CALCULATE([OT_Final], SAMEPERIODLASTYEAR('Calendar'[Date]))
VAR Diff = DIVIDE(Current_ - LastYear, LastYear)
RETURN
    IF(
        Diff > 0, "▲ ",
        IF(Diff < 0, "▼ ", "")
    ) & FORMAT(Diff, "0%")
```

#### `OTIF_Score YoY`

**Depende de medidas:** `[OTIF_Score]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [OTIF_Score]
VAR LastYear = CALCULATE([OTIF_Score], SAMEPERIODLASTYEAR('Calendar'[Date]))
VAR Diff = DIVIDE(Current_ - LastYear, LastYear)
RETURN
    IF(
        Diff > 0, "▲ ",
        IF(Diff < 0, "▼ ", "")
    ) & FORMAT(Diff, "0%")
```

#### `Avg_Delay YoY`

**Depende de medidas:** `[Avg_Delay]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [Avg_Delay]
VAR LastYear = CALCULATE([Avg_Delay], SAMEPERIODLASTYEAR('Calendar'[Date]))
VAR Diff = DIVIDE(Current_ - LastYear, LastYear)
RETURN
    IF(
        Diff > 0, "▲ ",
        IF(Diff < 0, "▼ ", "")
    ) & FORMAT(Diff, "0%")
```

#### `LeadTime`

**Depende de colunas:** `fact_transfer[delivery_date]`, `fact_transfer[order_date]`  
```dax
VAR delivery = MAX(fact_transfer[delivery_date])
VAR agreed = MAX(fact_transfer[order_date])
VAR delay = DATEDIFF(agreed, delivery, DAY)
RETURN IF(ISBLANK(delivery), BLANK(), MAX(0, delay))
```

#### `Avg_LT`

**Depende de medidas:** `[LeadTime]`  
```dax
AVERAGEX(fact_transfer,[LeadTime])
```

#### `Avg_LT YoY`

**Depende de medidas:** `[Avg_LT]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [Avg_LT]
VAR LastYear = CALCULATE([Avg_LT], SAMEPERIODLASTYEAR('Calendar'[Date]))
VAR Diff = DIVIDE(Current_ - LastYear, LastYear)
RETURN
    IF(
        Diff > 0, "▲ ",
        IF(Diff < 0, "▼ ", "")
    ) & FORMAT(Diff, "0%")
```

#### `Qty_Shipments`

**Depende de colunas:** `fact_transfer[amazon_shipment_id]`  
```dax
DISTINCTCOUNT(fact_transfer[amazon_shipment_id])
```

#### `Qty_Shipments YoY`

**Depende de medidas:** `[Qty_Shipments]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [Qty_Shipments]
VAR LastYear = CALCULATE([Qty_Shipments], SAMEPERIODLASTYEAR('Calendar'[Date]))
VAR Diff = DIVIDE(Current_ - LastYear, LastYear)
RETURN
    IF(
        Diff > 0, "▲ ",
        IF(Diff < 0, "▼ ", "")
    ) & FORMAT(Diff, "0%")
```

#### `OTIF_Score Prev. Year`

**Depende de medidas:** `[OTIF_Score]`  
**Depende de colunas:** `'Calendar'[Date]`  
```dax
VAR Current_ = [OTIF_Score]
VAR LastYear = CALCULATE([OTIF_Score], SAMEPERIODLASTYEAR('Calendar'[Date]))
RETURN LastYear
```


### Quotations

#### `Total Freight Cost`

**Depende de colunas:** `fact_freight_negotiation[Total_cost_USD]`  
```dax
SUM(fact_freight_negotiation[Total_cost_USD])
```

#### `Avg Total Freight Cost`

**Depende de colunas:** `fact_freight_negotiation[Total_cost_USD]`  
```dax
AVERAGE(fact_freight_negotiation[Total_cost_USD])
```

#### `Avg Transit Time`

**Depende de colunas:** `fact_freight_negotiation[Transit_Time]`  
```dax
average(fact_freight_negotiation[Transit_Time])
```

#### `Qty_approved_quotations`

**Depende de colunas:** `fact_freight_negotiation[Quotation_ID]`, `fact_freight_negotiation[Status]`  
```dax
CALCULATE(DISTINCTCOUNT(fact_freight_negotiation[Quotation_ID]),fact_freight_negotiation[Status] = "Approved")
```

#### `Total_approved_cost`

**Depende de colunas:** `fact_freight_negotiation[Status]`, `fact_freight_negotiation[Total_cost_USD]`  
```dax
CALCULATE(SUM(fact_freight_negotiation[Total_cost_USD]), fact_freight_negotiation[Status] = "Approved")
```

#### `Avg_approved_cost_CBM`

**Depende de colunas:** `fact_freight_negotiation[Freight_cost_CBM_USD]`, `fact_freight_negotiation[Status]`  
```dax
CALCULATE(AVERAGE(fact_freight_negotiation[Freight_cost_CBM_USD]),fact_freight_negotiation[Status] = "Approved")
```

#### `Qty_FF`

**Depende de colunas:** `fact_freight_negotiation[Freight_Forwarder]`  
```dax
DISTINCTCOUNT(fact_freight_negotiation[Freight_Forwarder])
```

#### `Avg_Cost_CBM`

**Depende de colunas:** `fact_freight_negotiation[Freight_cost_CBM_USD]`  
```dax
AVERAGE(fact_freight_negotiation[Freight_cost_CBM_USD])
```


### Remeasurement Tasks

#### `Total Remeasurement Cases`

```dax
COUNTROWS(fact_seller_suport_cases)
```

#### `Avg Leadtime (days)`

**Depende de colunas:** `fact_seller_suport_cases[Date Closed]`, `fact_seller_suport_cases[Date Created]`  
```dax
AVERAGEX(
    fact_seller_suport_cases,
    DATEDIFF(fact_seller_suport_cases[Date Created], fact_seller_suport_cases[Date Closed], DAY)
)
```

#### `Total Refunds (USD)`

**Depende de colunas:** `fact_exchange_rates[Date]`, `fact_exchange_rates[currency_from]`, `fact_exchange_rates[currency_to]`, `fact_exchange_rates[exchange_rate]`, `fact_seller_suport_cases[Date Created]`, `fact_seller_suport_cases[Refunded Amount]`, `fact_seller_suport_cases[currency]`  
```dax
SUMX(
    fact_seller_suport_cases,
    VAR vDate = fact_seller_suport_cases[Date Created] 
    VAR vCurrency = fact_seller_suport_cases[currency]
    
    // Busca a taxa de câmbio na fact_exchange_rates para a data e moeda do chamado
    VAR vRate = 
        LOOKUPVALUE(
            fact_exchange_rates[exchange_rate],
            fact_exchange_rates[Date], vDate,
            fact_exchange_rates[currency_from], vCurrency,
            fact_exchange_rates[currency_to], "USD"
        )
        
    // Se a moeda já for USD, ou se a taxa não for encontrada, multiplica por 1 para evitar erros
    VAR vFinalRate = IF(vCurrency = "USD" || ISBLANK(vRate), 1, vRate)
    
    RETURN
    fact_seller_suport_cases[Refunded Amount] * vFinalRate
)
```

#### `Cases with Changes`

**Depende de medidas:** `[Total Remeasurement Cases]`  
**Depende de colunas:** `fact_seller_suport_cases[Outcome]`  
```dax
CALCULATE(
    [Total Remeasurement Cases], 
    fact_seller_suport_cases[Outcome] IN {"Positive", "Negative"}
)
```

#### `No Change Cases`

**Depende de medidas:** `[Total Remeasurement Cases]`  
**Depende de colunas:** `fact_seller_suport_cases[Outcome]`  
```dax
CALCULATE(
    [Total Remeasurement Cases], 
    fact_seller_suport_cases[Outcome] = "No Change"
)
```

#### `Total Open Cases`

**Depende de medidas:** `[Total Remeasurement Cases]`  
**Depende de colunas:** `fact_seller_suport_cases[Status]`  
```dax
CALCULATE(
    [Total Remeasurement Cases], 
    fact_seller_suport_cases[Status] = "Follow-Up"
)
```

#### `Cases with Refund`

**Depende de medidas:** `[Total Remeasurement Cases]`  
**Depende de colunas:** `fact_seller_suport_cases[Refunded Amount]`  
```dax
CALCULATE(
    [Total Remeasurement Cases], 
    fact_seller_suport_cases[Refunded Amount] > 0 || ISBLANK(fact_seller_suport_cases[Refunded Amount]) = FALSE()
)
```

#### `% Cases with Refund`

**Depende de medidas:** `[Cases with Refund]`, `[Total Remeasurement Cases]`  
```dax
DIVIDE(
    [Cases with Refund]
    , [Total Remeasurement Cases]
)
```

#### `% Cases with Changes`

**Depende de medidas:** `[Cases with Changes]`, `[Total Remeasurement Cases]`  
```dax
DIVIDE(
    [Cases with Changes]
    , [Total Remeasurement Cases]
)
```

#### `% Cases with No Changes`

**Depende de medidas:** `[No Change Cases]`, `[Total Remeasurement Cases]`  
```dax
DIVIDE(
    [No Change Cases]
    , [Total Remeasurement Cases]
)
```

#### `_d_days_since_last_support_case`

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


### Shipment Cases

#### `Total Shipment Cases`

**Depende de colunas:** `fact_case_log[Case ID]`  
```dax
DISTINCTCOUNT(fact_case_log[Case ID])
```

#### `Average Solution LT`

**Depende de colunas:** `fact_case_log[Solution LT]`  
```dax
AVERAGE(fact_case_log[Solution LT])
```

#### `Open Shipment Cases`

**Depende de colunas:** `fact_case_log[Case Creation]`, `fact_case_log[Case Status]`  
```dax
CALCULATE(
    DISTINCTCOUNT(fact_case_log[Case Creation])
    ,fact_case_log[Case Status]="Follow Up"
)
```

#### `Pending Status Shipment Cases`

**Depende de colunas:** `fact_case_log[Case ID]`, `fact_case_log[Case Status]`  
```dax
CALCULATE(DISTINCTCOUNT(fact_case_log[Case ID]), fact_case_log[Case Status] = "Pending Status" || fact_case_log[Case Status] = BLANK())
```

#### `Cash Reimbursed (USD)`

**Depende de colunas:** `fact_lost_inbound_reimbursements[net_amount_total_USD]`  
```dax
sum(fact_lost_inbound_reimbursements[net_amount_total_USD])
```

#### `Inventory Recovered`

**Depende de colunas:** `fact_lost_inbound_reimbursements[quantity_reimbursed_inventory]`  
```dax
sum(fact_lost_inbound_reimbursements[quantity_reimbursed_inventory])
```

#### `Units Accounted For`

**Depende de colunas:** `fact_lost_inbound_reimbursements[net_quantity_total]`  
```dax
SUM(fact_lost_inbound_reimbursements[net_quantity_total])
```

#### `Distinct SKUs by Shipment`

**Depende de colunas:** `'Inbound Shipments'[Amazon Shipment Id]`, `'Inbound Shipments'[Key Column: Region | SKU]`  
```dax
CALCULATE(
    DISTINCTCOUNT('Inbound Shipments'[Key Column: Region | SKU]),
    VALUES('Inbound Shipments'[Amazon Shipment Id])
)
```

#### `GETIDA Cost (USD)`

**Depende de colunas:** `fact_case_log[Requester]`, `fact_lost_inbound_reimbursements[amount_per_unit_USD]`, `fact_lost_inbound_reimbursements[net_quantity_total]`  
```dax
IF(
    "GETIDA" IN VALUES(fact_case_log[Requester]),
    CALCULATE(
        0.15 * SUMX(                          
            fact_lost_inbound_reimbursements,
            fact_lost_inbound_reimbursements[net_quantity_total] * 
            fact_lost_inbound_reimbursements[amount_per_unit_USD]
        ),
        fact_case_log[Requester] = "GETIDA"
    ),
    0                       
)
```

#### `Cost Accounted For (USD)`

**Depende de colunas:** `fact_lost_inbound_reimbursements[amount_per_unit_USD]`, `fact_lost_inbound_reimbursements[net_quantity_total]`  
```dax
SUMX(                          
            fact_lost_inbound_reimbursements,
            fact_lost_inbound_reimbursements[net_quantity_total] * 
            fact_lost_inbound_reimbursements[amount_per_unit_USD]
        )
```

#### `Total SKU Quantity by Shipment`

**Depende de colunas:** `'Inbound Shipments'[Amazon Shipment Id]`, `'Inbound Shipments'[Quantity]`  
```dax
CALCULATE(
    SUM('Inbound Shipments'[Quantity]),
    VALUES('Inbound Shipments'[Amazon Shipment Id])
)
```


## Fontes das Tabelas (107 tabelas)


### `Calendar`

**Modo:** `directQuery`  
**Colunas:** `Date` dateTime, `Week Number 544` string, `Month Number 544` string, `Year 544` string, `Year-Week 544` string, `Year` int64, `Month` int64, `Start of Week` dateTime, `End of Week` dateTime, `Day of Week` int64, `Year-Month 544` string, `Start of Month` dateTime, `Start of Quarter` dateTime, `Start of Year` dateTime, `Day of Month` int64, `Quarter` int64, `Year-Month` string, `Month Name` string, `is_future` boolean, `Quarter Q` string, `YearWeekNum` double, `End of Month` dateTime, `Month Abrev` string, `Year-Quarter` string  

### `Contracted liquidator rate`

**Modo:** `directQuery`  
**Colunas:** `Contracted liquidator rate` double  

### `d.AmazonOrderId`

**Modo:** `directQuery`  
**Colunas:** `amazon_order_id` string, `merchant_order_id` string, `order_status` string, `is_business_order` boolean, `order_id_SK` int64, `date_all_orders` dateTime, `sales_marketplace` string, `sales_channel_temporary` string  

### `d.fulfillmentCentersAddress`

**Modo:** `directQuery`  
**Colunas:** `inventory_region` string, `inventory_country` string, `fulfillment_center_id` string, `city` string, `state` string, `state_abreviation` string, `country_name` string, `country` string, `zip` string, `address` string, `latitude` string, `longitude` string, `state_country` string, `fc_city_state` string, `Country Region (US/CA Only)` string  

### `dim_awd_fee_type`

**Modo:** `directQuery`  
**Colunas:** `fee_type_report` string, `fee_type` string  

### `dim_bar_chart_aging_projection`

**Modo:** `directQuery`  
**Colunas:** `dim_bar_chart_aging_projection` string, `dim_bar_chart_aging_projection Fields` string, `dim_bar_chart_aging_projection Order` int64  

### `dim_calendar_aux`

**Modo:** `directQuery`  
**Colunas:** `Date aux` dateTime, `Week Number 544` string, `Month Number 544` string, `Year 544` string, `Year-Week 544` string, `Year-Month 544` string, `Year` int64, `Month` int64, `Start of Week` dateTime, `End of Week` dateTime, `Day of Week` int64, `Start of Month` dateTime, `Start of Quarter` dateTime, `Start of Year` dateTime, `Day of Month` int64, `Quarter` int64, `Year-Month` string, `Month Name` string, `is_future` boolean, `End of Month` dateTime, `Month Abrev` string  

### `dim_order_amz_id`

**Modo:** `import`  
**Colunas:** `Order Id` string, `Amazon Shipment Id` string, `Key Column: Region | SKU` string  
```powerquery
let
    Source = fact_Order_Transfer_Details,
    columnSelection = Table.SelectColumns(Source,{"Order Id", "Amazon Shipment Id", "Key Column: Region | SKU"}),
    #"Removed Duplicates" = Table.Distinct(columnSelection)
in
    #"Removed Duplicates"
```


### `dim_order_IDs`

**Modo:** `directQuery`  
**Colunas:** `Order Id` string, `Region` string, `Type` string  

### `dim_SCPR_category`

**Modo:** `directQuery`  
**Colunas:** `Category` string, `Attribute` string, `Description` string, `Short Name` string, `Weight` int64  

### `dim_SCPR_factory`

**Modo:** `directQuery`  
**Colunas:** `Name` string, `Type` string  

### `dim_SCPR_freight`

**Modo:** `directQuery`  
**Colunas:** `Name` string, `Type` string  

### `dim_SCPR_type`

**Modo:** `directQuery`  
**Colunas:** `Name` string, `Type` string  

### `dim_skus_aux`

**Modo:** `directQuery`  
**Colunas:** `Base SKU` string, `SKU` string, `FNSKU` string, `Inventory Region` string, `Sales Region` string, `Country` string, `Amazon Family` string, `Marketplace` string, `ASIN` string, `Image URL` string, `Brand - Code` string, `Brand - Name` string, `Product General Type - Code` string, `Product General Type - Name` string, `Product Specific Type - Code` string, `Product Specific Type - Name` string, `Product Type Complete - Name` string, `Product Size - Code` string, `Product Size - Name` string, `Product Color - Code` string, `Product Color - Name` string, `Product Color - Pattern` string, `Product Set - Quantity` string, `Generic Family` string, `Core Family` string, `Specific Family` string, `Native Family` string, `Inner Type` string, `Units / Carton` int64, `Carton Weight (kg)` double, `Carton Dimensions (cm) Length` double, `Carton Dimensions (cm) Width` double, `Carton Dimensions (cm) Height` double, `Carton CBM` double, `AWD - Units / Carton` int64, `AWD - Carton Weight (kg)` double, `AWD - Carton Dimensions (cm) Length` double, `AWD - Carton Dimensions (cm) Width` double, `AWD - Carton Dimensions (cm) Height` double, `AWD - Carton CBM` double, `Units / Package` int64, `Package Weight (kg)` double, `Package Dimensions (cm) Length` double, `Package Dimensions (cm) Width` double, `Package Dimensions (cm) Height` double, `Item Dimensions (cm) Length` string, `Item Dimensions (cm) Width` string, `Item Dimensions (cm) Height` string, `Item Dimensions (in) Length` string, `Item Dimensions (in) Width` string, `Item Dimensions (in) Height` string, `is_grade_and_resell` boolean, `Grade` string, `Key Column: Sales Region | SKU` string, `Key Column: Sales Region | ASIN` string, `Key Column: Sales Region | FNSKU` string, `Key Column: Sales Region | Amazon Family` string, `Key Column: Sales Region | Country | SKU` string, `Key Column: Inventory Region | SKU` string, `Key Column: Inventory Region | ASIN` string, `Key Column: Inventory Region | FNSKU` string, `Key Column: Country | SKU` string, `Key Column: Country | ASIN` string, `Key Column: Country | FNSKU` string, `Key Column: Marketplace | SKU` string, `Key Column: Marketplace | ASIN` string, `Key Column: Marketplace | FNSKU` string, `Sales Region | Base SKU` string, `Inventory Region | Base SKU` string, `Country | SKU` string, `Country | Native Family` string, `Refresh Date` dateTime, `Average Weekly Units` int64, `Average Weekly Revenue` int64, `Revenue% Co.` double, `Units% Family` double, `ABC Co. Revenue` string, `ABC Family Units` string, `ABC Family Search Rank` string, `Final ABC Classification` string, `item_name` string, `item_description` string, `current_price` double, `open_date` string, `fulfillment_channel` string, `status` string, `Rope or Fabric` string, `SKU Consertado` string, `Key Column: Inventory Region | SKU Consertado` string, `Package CBM` double, `Package Cubic Feet` double, `ABC Profitability` string, `Life Cycle` string, `Reorder Region` string, `Reorder Region | Base SKU` string, `ABC Sales` string  

### `dim_sponsored_ads`

**Modo:** `directQuery`  
**Colunas:** `sponsored_ads_type` string, `sponsored_ads` string, `sponsored_ads_report` string  

### `dim_td_fulfillment_centers_address`

**Modo:** `import`  
**Colunas:** `Country Region (US/CA Only)` string, `inventory_region` string, `inventory_country` string, `fulfillment_center_id` string, `city` string, `state` string, `state_abreviation` string, `country_name` string, `country` string, `zip` string, `address` string, `latitude` double, `longitude` double  
```powerquery
let
    Source = Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\ref_fulfillment_centers_address.csv"),[Delimiter=",", Columns=13, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"inventory_region", type text}, {"inventory_country", type text}, {"fulfillment_center_id", type text}, {"city", type text}, {"state", type text}, {"state_abreviation", type text}, {"country_name", type text}, {"country", type text}, {"zip", type text}, {"address", type text}, {"latitude", type number}, {"longitude", type number}}),
    #"Removed Blank Rows" = Table.SelectRows(#"Changed Type", each not List.IsEmpty(List.RemoveMatchingItems(Record.FieldValues(_), {"", null}))),
    #"Replaced Value" = Table.ReplaceValue(#"Removed Blank Rows","","N/A",Replacer.ReplaceValue,{"Country Region (US/CA Only)"})
in
    #"Replaced Value"
```


### `f.AllOrders`

**Modo:** `directQuery`  
**Colunas:** `quantity` int64, `currency` string, `tax_after_price` double, `tax_within_price` double, `order_id_SK` int64, `date_all_orders` dateTime, `time_all_orders` dateTime, `item_status` string, `key_marketplace_sku` string, `item_price` double, `item_promotion_discount` double, `promotion_ids` string, `landed_cost` double, `landed_cost_currency` string, `ship_promotion_discount` double, `order_id_sk | key_marketplace_sku` string, `unit_fba_fee` double  

### `f.AmazonFulfilledShipments`

**Modo:** `directQuery`  
**Colunas:** `date_shipment` dateTime, `quantity_shipped` int64, `currency` string, `item_price` double, `fulfillment_center_id` string, `sk_order_id` int64, `key_sales_marketplace_sku` string  

### `f.FBACustomerReturns`

**Modo:** `directQuery`  
**Colunas:** `quantity` int64, `reason` string, `status` string, `is_sellable` string, `date_fba_customer_return` dateTime, `fulfillment_center_id` string, `detailed_disposition` string, `license_plate_number` string, `customer_comments` string, `purchase_date` dateTime, `key_marketplace_sku` string, `order_id_SK` int64, `order_id_sk | key_marketplace_sku` string, `Return Reason Group` string  

### `f.us_returns_processing_fee`

**Modo:** `directQuery`  
**Colunas:** `date_shipment` dateTime, `date_charge` dateTime, `key_marketplace_fnsku` string, `asin_fee_category` string, `currency` string, `asin_return_threshold_percent` double, `sku_returned_units_charged` int64, `sku_returned_units_NSP_exempted` int64, `sku_fee_per_unit` double, `sku_returns_fee` double  

### `f_aging_projection`

**Modo:** `directQuery`  
**Colunas:** `file_date` dateTime, `simulation` int64, `date_aging_projection` dateTime, `inbound_date` dateTime, `current_inventory` double, `inventory_by_inbound_shipments` double, `range` string, `aging_surcharge` double, `has_surcharge` boolean, `estimated_storage_fee_aging_inventory` double, `key_inventory_region_sku` string, `aging_bucket` string, `aging_bucket_order` int64  

### `f_aux_promo_tracker`

**Modo:** `directQuery`  
**Colunas:** `Current Price` double, `Title Description` string, `Objective` string, `activeDate` dateTime, `pricePromotionAction` string, `keyInventoryRegionSku` string, `keyCountryAsin` string, `actionDescription` string, `Category` string, `Simulated Price` double  

### `f_db_base_price`

**Modo:** `directQuery`  
**Colunas:** `date_base_price` dateTime, `key_salesCountry_nativeFamily` string, `base_price` double  

### `f_db_loss_leader`

**Modo:** `directQuery`  
**Colunas:** `start_date` dateTime, `end_date` dateTime, `country` string, `sku` string, `price` double, `activeDate` dateTime, `key_country_sku` string  

### `f_db_market_price`

**Modo:** `directQuery`  
**Colunas:** `date_market_price` dateTime, `key_salesCountry_nativeFamily` string, `market_price` double, `promo_price` double, `loss_leader` double, `Coments` string  

### `f_promotion_tracker`

**Modo:** `directQuery`  
**Colunas:** `price_promotion_action` string, `start_date` dateTime, `end_date` dateTime, `is_aging` int64, `key_inventory_region_sku` string, `discount_type` string, `Category` string  

### `f_storage_fee_rate`

**Modo:** `directQuery`  
**Colunas:** `date_update` dateTime, `inventory_region` string, `value` double, `quarter` string  

### `fact.aged_inventory_surcharge`

**Modo:** `directQuery`  
**Colunas:** `date_charge` dateTime, `key_inventory_country_sku` string, `condition` string, `item_volume` double, `unit_of_volume` string, `qty-charged` int64, `rate-surcharge` double, `surcharge-age-tier` string, `currency` string, `year_month` dateTime, `rate_surcharge_usd` double  

### `fact_amz_business_report`

**Modo:** `directQuery`  
**Colunas:** `marketplace` string, `date` dateTime, `parent_asin` string, `child_asin` string, `mobile_app_sessions` int64, `browser_sessions` int64, `total_sessions` int64, `mobile_app_page_views` int64, `browser_page_views` int64, `total_page_views` int64, `units_ordered` int64, `ordered_product_sales` double, `total_order_items` int64, `ordered_product_sales_currency_code` string, `key_country_asin` string, `buy_box_percentage` double  

### `fact_average_landed_cost`

**Modo:** `directQuery`  
**Colunas:** `unit_cost` double, `key_inventory_region_sku` string, `currency` string, `date` dateTime  

### `fact_awd_inventory_ledger_by_country`

**Modo:** `directQuery`  
**Colunas:** `date_awd_inventory_ledger` dateTime, `key_inventory_country_sku` string, `ending_warehouse_balance_units` int64, `location_group` string, `ending_warehouse_balance_cartons` double, `average_package_quantity` double  

### `fact_awd_monthly_processing_fee`

**Modo:** `directQuery`  
**Colunas:** `fee_type` string, `key_inventory_country_sku` string, `currency` string, `promotion_amount` double, `tax_amount` double, `month_of_charge` dateTime, `fee_amount` double, `box_qty` int64  

### `fact_awd_monthly_storage_fee`

**Modo:** `directQuery`  
**Colunas:** `currency` string, `key_inventory_country_sku` string, `date` dateTime, `daily_charged_amount` double  

### `fact_awd_monthly_transportation_fee`

**Modo:** `directQuery`  
**Colunas:** `fee_type` string, `key_inventory_country_sku` string, `currency` string, `promotion_amount` double, `tax_amount` double, `month_of_charge` dateTime, `fee_amount` double  

### `fact_awd_transportation_measurements`

**Modo:** `directQuery`  
**Colunas:** `month_of_charge` dateTime, `key_inventory_country_sku` string, `longest_side` double, `median_side` double, `shortest_side` double, `unit_of_dimension` string, `unit_of_volume` string, `box_volume` double  

### `fact_case_log`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `Case Creation` dateTime, `Case ID` string, `Amazon Status` string, `Requester` string, `Amazon Shipment ID` string, `Closed Date` dateTime, `Solution` string, `Obs` string, `Case Status` string, `Solution LT` double, `Solution Category' = ````, `Region` string  
```powerquery
let
    //  Source = let
    //     EngSource = try Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_amazon_cases.csv"), [Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    //     PtSource = Csv.Document(File.Contents("G:\Drives compartilhados\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_amazon_cases.csv"),[Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    //     Source = if EngSource[HasError] then PtSource else EngSource[Value]
    // in
    //     Source,
    Source = Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_amazon_cases.csv"),[Delimiter=",", Columns=6, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Case Creation", type date}, {"Case ID", type text}, {"Case Status", type text}, {"Requester", type text}, {"Amazon Shipment ID", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"Case Status", "Amazon Status"}}),
    #"Merged Queries" = Table.NestedJoin(#"Renamed Columns", {"Case ID"}, case_status_update, {"Case_ID"}, "case_status_update", JoinKind.LeftOuter),
    #"Expanded case_status_update" = Table.ExpandTableColumn(#"Merged Queries", "case_status_update", {"Case_Status", "Closed_Date", "Solution", "Obs"}, {"Case_Status", "Closed_Date", "Solution", "Obs"}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Expanded case_status_update",{{"Closed_Date", type date}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type1", "Solution LT", each if([Case_Status] = "OK" or [Case_Status] = "Unresponsive")then Duration.Days([Closed_Date]-[Case Creation])
else null),
    #"Changed Type2" = Table.TransformColumnTypes(#"Added Custom",{{"Solution LT", type number}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type2",null,"Pending Status",Replacer.ReplaceValue,{"Case_Status"}),
    #"Renamed Columns1" = Table.RenameColumns(#"Replaced Value",{{"Case_Status", "Case Status"}, {"Closed_Date", "Closed Date"}}),
    #"Removed Duplicates" = Table.Distinct(#"Renamed Columns1", {"Case ID"}),
    #"Filtered Rows" = Table.SelectRows(#"Removed Duplicates", each ([Amazon Shipment ID] <> "" and [Case ID] <> ""))
in
    #"Filtered Rows"
```


### `fact_db_customer_support`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `task_id` string, `task_name` string, `assignees` string, `status` string, `date_created` dateTime, `due_date` dateTime, `lead_time_days` double, `mkt` string, `platform` string, `order_id` string, `sku` string, `follow_up_needed` string, `type_of_concern` string, `detail_labels` string, `refund_value` double, `replacement_value` double, `case_type` string, `is_product_issue` int64, `is_fcr` int64, `key_country_sku` string, `Complaint Type' = ````, `date_closed` dateTime, `Region =`  
```powerquery
let
    Source = Csv.Document(
        File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_customer_support_clickup_tasks.csv"),
        [
            Delimiter        = ",",
            Columns          = 20,
            Encoding         = 65001,
            QuoteStyle       = QuoteStyle.Csv
        ]
    ),
    promoted_headers = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    typed = Table.TransformColumnTypes(promoted_headers, {
        {"task_id",           type text},
        {"task_name",         type text},
        {"assignees",         type text},
        {"status",            type text},
        {"date_created",      type datetime},
        {"date_closed",         type datetime},
        {"due_date",          type datetime},
        {"lead_time_days",    type number},
        {"mkt",               type text},
        {"platform",          type text},
        {"order_id",          type text},
        {"sku",               type text},
        {"follow_up_needed",  type text},
        {"type_of_concern",   type text},
        {"detail_labels",     type text},
        {"refund_value",      type number},
        {"replacement_value", type number},
        {"case_type",         type text},
        {"is_product_issue",  Int64.Type},
        {"is_fcr",            Int64.Type}
    }),
    #"Trimmed Text" = Table.TransformColumns(typed,{{"sku", Text.Trim, type text}, {"order_id", Text.Trim, type text}}),
    #"Extracted Text Before Delimiter" = Table.TransformColumns(#"Trimmed Text", {{"platform", each Text.BeforeDelimiter(_, " "), type text}}),
    key_country_sku = Table.AddColumn(
        typed,
        "key_country_sku",
        each if [sku] = null or Text.Trim([sku]) = "" 
             then null 
             else [mkt] & " | " & [sku],
        type text
    ),
    #"Filtered Rows" = Table.SelectRows(key_country_sku, each ([status] <> "no response needed")),
    #"Lowercased Text" = Table.TransformColumns(#"Filtered Rows",{{"status", Text.Lower, type text}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Lowercased Text",{{"date_created", type date}, {"date_closed", type date}, {"due_date", type date}}),
    #"Replaced Value" = Table.ReplaceValue(#"Changed Type"," @","",Replacer.ReplaceText,{"platform"})
in
    #"Replaced Value"
```


### `fact_db_results_tio`

**Modo:** `directQuery`  
**Colunas:** `start_of_week` dateTime, `quantity_ordered_previously_3pl` double, `baseline_forecast` double, `demand_forecast` double, `ending_balance_considering_reorder_amz` double, `overstock` double, `quantity_ordered_previously_amz` double, `reorder_point` double, `target_ending_balance` double, `projected_sales_loss_if_not_reordered` double, `quantity_ordered_previously_awd` double, `ending_balance_considering_reorder_3pl` double, `mandatory_transfer_from_3pl_to_amz` double, `ending_balance` double, `storage_fee_amz` double, `overstock_with_3pl` double, `version_file` string, `key_inventory_region_sku` string  

### `fact_db_results_VO`

**Modo:** `directQuery`  
**Colunas:** `Inventory Region` string, `Native Family` string, `Key Inventory Region | Base SKU` string, `ASIN` string, `Life Cycle` string, `ABC Classification` string, `Year-Week` string, `Calc_Units_Sold` double, `Calc_Inventory_Start` double, `Calc_Average_Units_With_Invent` double, `Calc_Superior_Limit` double, `Calc_Min_Inventory` double, `Calc_Adjusted_Sales` double, `Calc_Adj_Moving_Average_Slow` double, `Calc_Adj_Moving_Average_Medium` double, `Calc_Adj_Moving_Average_Fast` double, `Calc_Velocity` double, `Calc_Adjusted_Sales_Stockout` double, `Calc_Loss_of_Sales` double, `Calc_Loss_of_Revenue` double, `Calc_Units_Moving_Average_Fast` double, `Calc_Potencial_Revenue` double, `Key Inventory Region | ASIN` string, `Start of Week` dateTime, `End of Week` dateTime, `Firs Date of Inventory` dateTime, `Year` int64, `Version` string, `Date` dateTime  

### `fact_estimated_future_daily_storage_fee`

**Modo:** `directQuery`  
**Colunas:** `date` dateTime, `estimated_daily_storage_fee` double, `key_marketplace_sku` string  

### `fact_exchange_rates`

**Modo:** `directQuery`  
**Colunas:** `date` dateTime, `currency_from` string, `currency_to` string, `ticker` string, `exchange_rate` double  

### `fact_fba_fee_expected`

**Modo:** `directQuery`  
**Colunas:** `key_sales_country_asin` string, `date_list` dateTime, `size_tier` string, `index` int64, `fulfillment_fee` double, `fulfillment_fee_w_sipp` double, `fulfillment_fee_low_price` double, `fulfillment_fee_low_price_w_sipp` double  

### `fact_fba_inventory`

**Modo:** `directQuery`  
**Colunas:** `date_fba_inventory` dateTime, `inv_age_000_to_030` int64, `inv_age_031_to_060` int64, `inv_age_061_to_090` int64, `inv_age_091_to_180` int64, `inv_age_181_to_270` int64, `inv_age_271_to_365` int64, `inv_age_365_plus` int64, `currency` string, `estimated_storage_cost_next_month` double, `estimated_quantity_ais_181_210` int64, `estimated_quantity_ais_211_240` int64, `estimated_quantity_ais_241_270` int64, `estimated_quantity_ais_271_300` int64, `estimated_quantity_ais_301_330` int64, `estimated_quantity_ais_331_365` int64, `estimated_quantity_ais_365_plus` int64, `estimated_value_ais_181_210` double, `estimated_value_ais_211_240` double, `estimated_value_ais_241_270` double, `estimated_value_ais_271_300` double, `estimated_value_ais_301_330` double, `estimated_value_ais_331_365` double, `estimated_value_ais_365_plus` double, `available` int64, `inbound_quantity` int64, `inbound_working` int64, `inbound_shipped` int64, `inbound_received` int64, `unfulfillable_quantity` int64, `key_inventory_region_sku` string, `reserved_customer_order` int64, `reserved_fc_processing` int64, `reserved_fc_transfer` int64, `total_reserved_quantity` int64  

### `fact_fba_manage_inventory_real_time`

**Modo:** `directQuery`  
**Colunas:** `key_inventory_region_sku` string, `asin` string, `condition` string, `available_quantity` int64, `reserved_quantity` int64, `researching_quantity` int64, `unsellable_quantity` int64, `warehouse_quantity` int64, `receiving_quantity` int64, `shipped_quantity` int64, `working_quantity` int64, `date_fba_manage_inventory_real_time` dateTime, `total_quantity` int64  

### `fact_fbaGrade&ResellReport`

**Modo:** `directQuery`  
**Colunas:** `date` dateTime, `quantity` int64, `key_sales_marketplace_sku` string  

### `fact_fee_preview`

**Modo:** `directQuery`  
**Colunas:** `currency` string, `date_fee_preview` dateTime, `key_sales_marketplace_sku` string, `product_size_tier` string, `longest_side` double, `median_side` double, `shortest_side` double, `length_and_girth` double, `item_volume` double, `unit_of_dimension` string, `item_package_weight` double, `unit_of_weight` string, `expected_fulfillment_fee_per_unit` double, `unit_of_volume` string, `is_latest` int64  

### `fact_freight_negotiation`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `Incoterm` string, `Status` string, `Quotation_ID` string, `Quotation_Order` string, `Quotation_Date` dateTime, `Final_Destination` string, `Mode_of_Transport` string, `Freight_Forwarder` string, `CBM_m3` double, `Freight_cost_USD` double, `Additional_taxes_USD` double, `Total_cost_USD` double, `Transit_Time` double, `Freight_cost_CBM_USD` double  
```powerquery
let
    //  Source = let
    //     EngSource = try Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\freight_quotations.csv"), [Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    //     PtSource = Csv.Document(File.Contents("G:\Drives compartilhados\OrganiHaus\3.1 - OH Data & Reports\standalone_files\freight_quotations.csv"),[Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    //     Source = if EngSource[HasError] then PtSource else EngSource[Value]
    // in
    //     Source,
    Source = Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_freight_quotations.csv"),[Delimiter=","]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Quotation_Date", type date}, {"CBM_m3", type number}, {"Freight_cost_CBM_USD", type number}, {"Freight_cost_USD", type number}, {"Additional_taxes_USD", type number}, {"Total_cost_USD", type number}, {"Transit_Time", type number}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type", "Custom", each if [Freight_cost_CBM_USD] is null and [Mode_of_Transport] = "FCL" then ([Total_cost_USD]/64)
else [Freight_cost_CBM_USD]),
    #"Removed Columns" = Table.RemoveColumns(#"Added Custom",{"Freight_cost_CBM_USD"}),
    #"Renamed Columns" = Table.RenameColumns(#"Removed Columns",{{"Custom", "Freight_cost_CBM_USD"}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Renamed Columns",{{"Freight_cost_CBM_USD", type number}}),
    #"Corrigido FC" = Table.ReplaceValue(#"Changed Type1",
            each [Final_Destination],
            each if [Final_Destination] = "AWD - IUSF" then "IUSF"
                    else if [Final_Destination] = "AWD IUSJ" then "IUSJ"
                    else if [Final_Destination] = "AWD IUSP" then "IUSP"
                    else if [Final_Destination] = "AWD IUSQ" then "IUSQ"
                    else if [Final_Destination] = "AWD IUSR" then "IUSR"
                    else if [Final_Destination] = "AWD IUST" then "IUST"
                    else [Final_Destination],
            Replacer.ReplaceValue,
            {"Final_Destination"}
        ),
    #"Replaced Value" = Table.ReplaceValue(#"Corrigido FC","Forest Shipping","FOREST",Replacer.ReplaceText,{"Freight_Forwarder"})
in
    #"Replaced Value"
```


### `fact_full_inventory_amazon_inbound_shipments`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `amazon_shipment_id` string, `shipment_status` string, `key_inventory_region_sku` string, `fnsku` string, `quantity_in_case` int64, `quantity_shipped` int64, `quantity_received` int64, `quantity_discrepancy` int64  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Inventory.vw_full_inventory_amazon_inbound_shipments"),
    #"Removed Other Columns" = Table.SelectColumns(Source,{"amazon_shipment_id", "shipment_status", "key_inventory_region_sku", "fnsku", "quantity_in_case", "quantity_shipped", "quantity_received", "quantity_discrepancy"}),
    #"Replaced Value" = Table.ReplaceValue(#"Removed Other Columns","_"," ",Replacer.ReplaceText,{"shipment_status"}),
    #"Capitalized Each Word" = Table.TransformColumns(#"Replaced Value",{{"shipment_status", Text.Proper, type text}})
in
    #"Capitalized Each Word"
```


### `fact_inventory_3pl`

**Modo:** `directQuery`  
**Colunas:** `Date` dateTime, `Key Column: Inventory Region | SKU` string, `Location` string, `On Hand` int64, `Allocated` int64, `Receiving Area` int64, `Available` int64, `In Transit` int64, `Warehouse 3pl` string  

### `fact_inventory_ledger_by_fulfillment_center`

**Modo:** `directQuery`  
**Colunas:** `date` dateTime, `disposition` string, `fulfillment_center` string, `starting_warehouse_balance` int64, `key_column_inventory_country_sku` string, `ending_plus_transit` int64, `inventory_country` string, `sku` string, `fnsku` string, `ending_warehouse_balance` int64  

### `fact_life_cycle`

**Modo:** `directQuery`  
**Colunas:** `date_life_cycle` dateTime, `key_inventory_region_sku` string, `life_cycle` string  

### `fact_lost_inbound_reimbursements`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `approval_date` dateTime, `case_id` string, `sku` string, `fnsku` string, `asin` string, `currency_unit` string, `net_amount_total` double, `net_quantity_total` double, `ticker` string, `exchange_rate` double, `net_amount_total_USD` double, `reimbursement_id` string, `amount_total_reimbursed` double, `region` string, `amount_per_unit_USD` double, `amount_per_unit` double, `quantity_reimbursed_cash` string, `quantity_reimbursed_inventory` string, `quantity_reimbursed_total_reimbursed` string  
```powerquery
let
    // Source = let
    //     EngSource = try Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_lost_inbound_net_reimbursement.csv"), [Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    //     PtSource = Csv.Document(File.Contents("G:\Drives compartilhados\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_lost_inbound_net_reimbursement.csv"),[Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    //     Source = if EngSource[HasError] then PtSource else EngSource[Value]
    // in
    //     Source,
    Source = Csv.Document(File.Contents("G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\standalone_files\db_lost_inbound_net_reimbursement.csv"),[Delimiter=",", Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Removed Other Columns" = Table.SelectColumns(#"Promoted Headers",{"approval_date", "reimbursement_id", "case_id", "sku", "fnsku", "asin", "currency_unit", "amount_per_unit", "amount_total_reimbursed", "quantity_reimbursed_cash", "quantity_reimbursed_inventory", "quantity_reimbursed_total_reimbursed", "region", "net_amount_total", "net_quantity_total"}),
    #"Extracted Text Before Delimiter" = Table.TransformColumns(#"Removed Other Columns", {{"approval_date", each Text.BeforeDelimiter(_, " "), type text}}),
    #"Changed Type" = Table.TransformColumnTypes(#"Extracted Text Before Delimiter",{{"approval_date", type date}, {"case_id", type text}, {"sku", type text}, {"fnsku", type text}, {"asin", type text}, {"currency_unit", type text}, {"net_amount_total", type number}, {"net_quantity_total", type number}, {"amount_per_unit", type number}, {"amount_total_reimbursed", type number}}),
    #"Added Custom" = Table.AddColumn(#"Changed Type", "ticker", each [currency_unit]&"USD"),
    #"Merged Queries" = Table.NestedJoin(#"Added Custom", {"approval_date", "ticker"}, dim_td_exchange_rates, {"date", "ticker"}, "td_exchange_rates", JoinKind.LeftOuter),
    #"Expanded td_exchange_rates" = Table.ExpandTableColumn(#"Merged Queries", "td_exchange_rates", {"exchange_rate"}, {"exchange_rate"}),
    #"Added Custom1" = Table.AddColumn(#"Expanded td_exchange_rates", "net_amount_total_USD", each [net_amount_total]*[exchange_rate]),
    #"Added Custom2" = Table.AddColumn(#"Added Custom1", "amount_per_unit_USD", each [amount_per_unit]*[exchange_rate]),
    #"Changed Type1" = Table.TransformColumnTypes(#"Added Custom2",{{"net_amount_total_USD", type number}, {"amount_per_unit_USD", type number}}),
    #"Removed Duplicates" = Table.Distinct(#"Changed Type1")
in
    #"Removed Duplicates"
```


### `fact_order_records`

**Modo:** `directQuery`  
**Colunas:** `Order Id` string, `Supplier` string, `Order Status` string, `Alibaba Order` string, `EXW Price` decimal, `Invoice USD` decimal, `Balance Provision USD` decimal, `Inspection Cost USD` decimal, `Entry Country` string, `Freight Forwarder` string, `Carrier` string, `Freight Provision USD` decimal, `Customs Exam Charges Provision USD` decimal, `CBM` double, `Order Creation` dateTime, `Order Date` dateTime, `Agreed - Pick up Date` dateTime, `Agreed - Established Time of Departure (ETD)` dateTime, `Agreed - Established Time of Arrival (ETA)` dateTime, `Agreed - Delivery Date` dateTime, `Actual - Pick up Date` dateTime, `Actual - Departure Date` dateTime, `Actual - Arrival at Port Date` dateTime, `Actual - Delivery Date` dateTime, `Total Lead Time (Days)` int64, `Ocean Time (days)` int64, `Last Leg (days)` int64, `Production Lead Time (days)` int64, `Handling Lead Time (days)` int64, `Delay - Pick up (Days)` int64, `Delay - Delivery (Days)` int64, `Delay - Departure (Days)` int64, `Delay - Arrival (Days)` int64, `Freight_Delay_Column` int64, `Order Total Actual USD` decimal, `First Freight Provision USD` decimal, `Actual - CBM` double, `Inspection End Date` dateTime, `Sample Cost USD` double, `Pick up Cost USD` double, `EXW/Invoice USD` decimal, `Production Status` string, `Delivered Status` string, `Region` string  

### `fact_Order_Transfer_Details`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `Type` string, `Origin` string, `Deliver At Type` string, `Deliver At Location` string, `Order Id` string, `Amazon Shipment Id` string, `key_order_id_shipment_id` string, `Key Column: Region | SKU` string, `SKU` string, `Order Date` dateTime, `Delivery Date` dateTime, `Status` string, `Amazon Shipment Name` string, `Quantity` int64, `Units / Carton` int64, `Carton Count` double, `Carton CBM` double, `Total CBM` double, `Region` string, `Landed Cost Type` string, `Unit Transfer Cost Local Currency` double, `Total Transfer Cost Local Currency` double, `Unit Estimated 3pl Processing Fee` double, `Total Estimated 3pl Processing Fee` double, `Units Estimated 3pl Container Devanning` double, `Total Estimated 3pl Container Devanning` double, `Unit Inbound Placement Fee` double, `Total Unit Inbound Placement Fee` double, `unit_purchase_cost_local_currency` double, `total_purchase_cost_local_currency` double, `unit_landed_cost_local_currency` double, `total_landed_cost_local_currency` double  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.1_Gold_Google_Sheets.td_full_order_transfer_details"),

    #"Renamed Columns" = Table.RenameColumns(Source,{{"key_inventory_region_sku", "Key Column: Region | SKU"}}),
    // Renomear colunas para corresponder à Tabela 1
    RenomearColunas = Table.RenameColumns(
        #"Renamed Columns",
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
            {"unit_purchase_cost_usd", "Unit Purchase Cost Local Currency"}, // USD → Local Currency
            {"total_purchase_cost_usd", "Total Purchase Cost Local Currency"},
            {"unit_landed_cost_usd", "Unit Landed Cost Local Currency"},
            {"total_landed_cost_usd", "Total Landed Cost Local Currency"},
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
    )
in
    RenomearColunas
```


### `fact_removal_replacement_orders`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `amazon_order_id` string, `merchant_order_id` string, `replacement_order_id` string, `order_type` string, `replacement_type` string, `asin` string, `quantity` int64, `sales_country` string, `sales_marketplace` string, `replacement_purchase_date` dateTime, `purchase_date` dateTime, `sku` string, `sales_region` string, `key_sales_region_asin` string  
```powerquery
let
    Source = bigQuery_customFunction("amazon-sp-api-openbridge.2_Silver_Sales_Returns.vw_full_classified_orders"),
    #"Filtered Rows" = Table.SelectRows(Source, each ([order_type] = "REMOVAL" or [order_type] = "REPLACEMENT")),
    #"Sorted Rows" = Table.Sort(#"Filtered Rows",{{"purchase_date", Order.Descending}}),
    #"Inserted Merged Column" = Table.AddColumn(#"Sorted Rows", "key_sales_region_asin", each Text.Combine({[sales_region], [asin]}, " | "), type text)
in
    #"Inserted Merged Column"
```


### `fact_sb_attributed_purchase`

**Modo:** `directQuery`  
**Colunas:** `sponsored_ads_type` string, `date_sb_attributed_purchase` dateTime, `currency` string, `campaign_name` string, `ad_group_name` string, `attribution_type` string, `key_marketplace_purchased_asin` string, `total_sales_14d` double, `total_orders_14d` int64, `total_units_sold_14d` int64, `new_to_brand_sales_14d` double, `new_to_brand_orders_14d` int64, `new_to_brand_units_sold_14d` int64, `new_to_brand_sales_percentage_14d` double, `new_to_brand_orders_percentage_14d` double, `new_to_brand_units_sold_percentage_14d` double  

### `fact_sb_search_terms`

**Modo:** `directQuery`  
**Colunas:** `sponsored_ads_type` string, `date_sb_search_terms` dateTime, `marketplace` string, `currency` string, `campaign_name` string, `ad_group_name` string, `targeting` string, `match_type` string, `customer_search_term` string, `cost_type` string, `impressions` int64, `clicks` int64, `spend` double, `total_sales` double, `total_orders` int64, `total_units_sold` int64, `total_sales_clicks` double, `total_orders_clicks` int64  

### `fact_sb_spend_by_sku`

**Modo:** `directQuery`  
**Colunas:** `date_sb` dateTime, `key_marketplace_asin` string, `currency_sb` string, `sb_orders` int64, `sb_sales` double, `sb_spend` double, `sponsored_ads_type` string  

### `fact_SCPR_all_reviews`

**Modo:** `directQuery`  
**Colunas:** `Quarter` string, `Year` string, `Company Name` string, `Attribute` string, `Grade` int64, `Comment` string, `Weight` int64, `Category` string, `Period` string  

### `fact_sd_advertised_products`

**Modo:** `directQuery`  
**Colunas:** `date_sb_advertised_products` dateTime, `key_marketplace_advertised_sku` string, `campaign_name` string, `ad_group_name` string, `currency` string, `impressions` int64, `clicks` int64, `spend` double, `advertised_sku_orders_14d` int64, `advertised_sku_sales_14d` double, `advertised_sku_units_sold_14d` int64, `other_sku_orders_14d` int64, `other_sku_sales_14d` double, `other_sku_units_sold_14d` int64, `advertised_sku_new_to_brand_orders_14d` int64, `advertised_sku_new_to_brand_sales_14d` double, `advertised_sku_new_to_brand_units_sold_14d` int64, `other_sku_new_to_brand_orders_14d_clicks` int64, `other_sku_new_to_brand_sales_14d_clicks` double, `other_sku_new_to_brand_units_sold_14d_clicks` int64, `sponsored_ads_type` string  

### `fact_seller_suport_cases`

**Modo:** `directQuery`  
**Colunas:** `Status` string, `Date Created` dateTime, `Case ID` string, `ASIN` string, `SKU` string, `Lead Time` string, `Region` string, `FNSKU` string, `Date Closed` dateTime, `Refunded Amount` decimal, `Currency` string, `Key Inventory Region | ASIN` string, `Outcome` string  

### `fact_sp_advertised_products`

**Modo:** `directQuery`  
**Colunas:** `date_sp_advertised_products` dateTime, `key_marketplace_advertised_sku` string, `campaign_name` string, `ad_group_name` string, `currency` string, `impressions` int64, `clicks` int64, `spend` double, `advertised_sku_orders_7d` int64, `advertised_sku_sales_7d` double, `advertised_sku_units_sold_7d` int64, `other_sku_units_sold_7d` int64, `other_sku_sales_7d` double, `other_sku_orders_7d` int64, `sponsored_ads_type` string  

### `fact_sp_purchased_products`

**Modo:** `directQuery`  
**Colunas:** `date_sp_purchased_products` dateTime, `campaign_name` string, `ad_group_name` string, `match_type` string, `currency` string, `key_marketplace_advertised_sku` string, `key_marketplace_purchased_asin` string, `units_sold_other_sku` int64, `orders_other_sku` int64, `sales_other_sku` double, `sponsored_ads_type` string, `targeting` string  

### `fact_sp_search_terms`

**Modo:** `directQuery`  
**Colunas:** `sponsored_ads_type` string, `date_sp_search_terms` dateTime, `marketplace` string, `currency` string, `campaign_name` string, `ad_group_name` string, `targeting` string, `match_type` string, `customer_search_term` string, `impressions` int64, `clicks` int64, `spend` double, `total_units_sold_7d` int64, `total_sales_7d` double, `total_orders_7d` int64, `advertised_sku_units_sold_7d` int64, `advertised_sku_sales_7d` double, `advertised_sku_orders_7d` int64, `other_sku_units_sold_7d` int64, `other_sku_sales_7d` double, `other_sku_orders_7d` int64  

### `fact_storage_fee_daily`

**Modo:** `directQuery`  
**Colunas:** `currency` string, `estimated_daily_storage_fee` double, `date_daily_share_of_storage_fee` dateTime, `key_marketplace_sku` string  

### `fact_storage_fee_measurements`

**Modo:** `directQuery`  
**Colunas:** `month_of_charge` dateTime, `key_inventory_region_fnsku` string, `unit_of_measurement` string, `unit_of_weight` string, `unit_of_volume` string, `side_longest` double, `side_median` double, `side_shortest` double, `item_volume` double, `quantity_on_hand` double, `item_weight` double  

### `fact_transfer`

**Modo:** `import`  **Grupo:** `Fact`  
**Colunas:** `amazon_shipment_id` string, `key_inventory_region_sku` string, `quantity_shipped` int64, `quantity_received` int64, `quantity_discrepancy` int64, `last_shipment_status` string, `delivery_date` dateTime, `agreed_delivery_date` dateTime, `inventory_region` string, `type` string, `amazon_shipment_name` string, `order_id` string, `supplier` string, `freight_forwarder` string, `order_date` dateTime, `LT` int64, `current_status` string, `destination_fulfillment_center_id` string  
```powerquery
let
    Source = Value.NativeQuery(GoogleBigQuery.Database([Implementation="2.0"]){[Name="amazon-sp-api-openbridge"]}[Data], "WITH shipment_status_changes AS (
  SELECT 
    amazon_shipment_id,
    amazon_shipment_name,
    shipment_status,
    DATE(snapshot_date) AS snapshot_date
  FROM `amazon-sp-api-openbridge.1_Gold_Inventory.tb_log_full_inventory_amazon_inbound_shipments`
),

shipment_dates AS (
  SELECT
    amazon_shipment_id,
    ANY_VALUE(amazon_shipment_name) AS amazon_shipment_name,
    MIN(snapshot_date) AS transfer_date,
    MIN(CASE WHEN shipment_status IN ('RECEIVING', 'CLOSED') THEN snapshot_date END) AS delivery_date,
    DATE_ADD(MIN(snapshot_date), INTERVAL 13 DAY) AS agreed_delivery_date
  FROM shipment_status_changes
  GROUP BY amazon_shipment_id
),

sku_level AS (
  SELECT
    amazon_shipment_id,
    amazon_shipment_name,
    key_inventory_region_sku,
    ANY_VALUE(quantity_shipped) AS quantity_shipped,
    ANY_VALUE(quantity_received) AS quantity_received,
    ANY_VALUE(quantity_discrepancy) AS quantity_discrepancy,
    ANY_VALUE(shipment_status) AS last_shipment_status
  FROM `amazon-sp-api-openbridge.1_Gold_Inventory.vw_full_inventory_amazon_inbound_shipments`
  GROUP BY amazon_shipment_id, key_inventory_region_sku, amazon_shipment_name
),

type AS (
  SELECT DISTINCT
    a.amazon_shipment_id
    , a.order_id
    , a.type
    , b.agreed_delivery_date
    , b.delivery_date
    , b.supplier
    , b.freight_forwarder
    , b.order_date
  FROM `amazon-sp-api-openbridge.1_Gold_Google_Sheets.td_full_order_transfer_details` a

  LEFT JOIN `amazon-sp-api-openbridge.1_Gold_Google_Sheets.td_full_order_records` b
    ON a.order_id = b.order_id

  WHERE a.amazon_shipment_id NOT IN ('','-')
)

SELECT DISTINCT
  s.amazon_shipment_id,
  S.amazon_shipment_name,
  t.order_id,
  t.supplier,
  t.freight_forwarder,
  s.key_inventory_region_sku,
  s.quantity_shipped,
  s.quantity_received,
  s.quantity_discrepancy,
  s.last_shipment_status,
  c.shipment_status as current_status,
  IFNULL(t.order_date, d.transfer_date) AS order_date,
  IFNULL(d.delivery_date,t.delivery_date) AS delivery_date,
  IFNULL(t.agreed_delivery_date,d.agreed_delivery_date) AS agreed_delivery_date,
  CASE
    WHEN IFNULL(d.delivery_date,t.delivery_date) IS NOT NULL
      THEN DATE_DIFF(IFNULL(d.delivery_date,t.delivery_date),IFNULL(t.order_date, d.transfer_date),DAY)
    ELSE DATE_DIFF(CURRENT_DATE(),IFNULL(t.order_date, d.transfer_date) , DAY)
  END AS LT,
  c.inventory_region,
  c.destination_fulfillment_center_id,
  t.type
FROM sku_level s

JOIN shipment_dates d
  ON s.amazon_shipment_id = d.amazon_shipment_id
  
LEFT JOIN `amazon-sp-api-openbridge.1_Gold_Inventory.vw_full_inventory_amazon_inbound_shipments` c
  ON s.amazon_shipment_id = c.amazon_shipment_id

LEFT JOIN type t
  ON s.amazon_shipment_id = t.amazon_shipment_id

WHERE s.last_shipment_status <> 'CANCELLED'", null, [EnableFolding=true])
in
    Source
```


### `fact_velocity`

**Modo:** `directQuery`  
**Colunas:** `Date` dateTime, `Key Column: Country | ASIN` string, `Updated Daily Velocity` double, `Updated Weekly Velocity` double, `Weekly MA Slow` double, `Weekly MA Medium` double, `Weekly MA Fast` double, `Minimum Inventory` double  

### `Inbound Shipments`

**Modo:** `directQuery`  
**Colunas:** `Quantity` int64, `Status` string, `SKU` string, `Region` string, `Type` string, `Origin` string, `Order Date` dateTime, `Delivery Date` dateTime, `Amazon Shipment Name` string, `Landed Cost Type` string, `Deliver At Type` string, `Deliver At Location` string, `Units / Carton` int64, `Carton Count` double, `Carton CBM` double, `Total CBM` double, `Order Id` string, `Amazon Shipment Id` string, `key_order_id_shipment_id` string, `Unit Purchase Cost Local Currency` double, `Total Purchase Cost Local Currency` double, `Unit Landed Cost Local Currency` double, `Total Landed Cost Local Currency` double, `Unit Transfer Cost Local Currency` double, `Total Transfer Cost Local Currency` double, `Unit Estimated 3pl Processing Fee` double, `Total Estimated 3pl Processing Fee` double, `Units Estimated 3pl Container Devanning` double, `Total Estimated 3pl Container Devanning` double, `Unit Inbound Placement Fee` double, `Total Unit Inbound Placement Fee` double, `Key Column: Region | SKU` string, `Unit_Landed_Cost_USD` double, `Unit_Purchase_Cost_USD` double, `Unit_Non_Purchase_Cost_USD` double, `Supplier` string, `Freight Forwarder` string, `Unit_Non_Purchase_Cost_Local_Currency` double  

### `Inventory Ledger`

**Modo:** `directQuery`  
**Colunas:** `Date` dateTime, `Key Column: Country | SKU` string, `Disposition` string, `starting_warehouse_balance` int64, `ending_plus_transit` int64, `Key Column: Country | ASIN` string, `Location Group` string  

### `SCPR_Metrics`

**Modo:** `directQuery`  

### `shifting_fba_costs_aux_table`

**Modo:** `directQuery`  
**Colunas:** `Alert` string, `Order` int64  

### `SKUs`

**Modo:** `directQuery`  
**Colunas:** `SKU` string, `ASIN` string, `FNSKU` string, `Country` string, `Key Column: Country | SKU` string, `ABC Co. Revenue` string, `ABC Family Units` string, `ABC Family Search Rank` string, `Final ABC Classification` string, `Base SKU` string, `Image URL` string, `Key Column: Country | ASIN` string, `Native Family` string, `Amazon Family` string, `Average Weekly Units` int64, `Average Weekly Revenue` int64, `Revenue% Co.` double, `Units% Family` double, `Sales Region` string, `Inventory Region` string, `Marketplace` string, `Key Column: Sales Region | SKU` string, `Key Column: Sales Region | ASIN` string, `Key Column: Inventory Region | SKU` string, `Key Column: Inventory Region | ASIN` string, `Key Column: Marketplace | SKU` string, `Key Column: Marketplace | ASIN` string, `Sales Region | Base SKU` string, `Inventory Region | Base SKU` string, `Refresh Date` dateTime, `Country (groups)` string, `Key Column: Sales Region | FNSKU` string, `Key Column: Inventory Region | FNSKU` string, `Key Column: Country | FNSKU` string, `Key Column: Marketplace | FNSKU` string, `Key Column: Sales Region | Amazon Family` string, `Rope or Fabric` string, `Key Column: Sales Region | Country | SKU` string, `Country | SKU` string, `Country | Native Family` string, `Brand - Code` string, `Brand - Name` string, `Product General Type - Code` string, `Product General Type - Name` string, `Product Specific Type - Code` string, `Product Specific Type - Name` string, `Product Type Complete - Name` string, `Product Size - Code` string, `Product Size - Name` string, `Product Color - Code` string, `Product Color - Name` string, `Product Color - Pattern` string, `Product Set - Quantity` string, `Generic Family` string, `Core Family` string, `Specific Family` string, `Inner Type` string, `Units / Carton` int64, `Carton Weight (kg)` double, `Carton Dimensions (cm) Length` double, `Carton Dimensions (cm) Width` double, `Carton Dimensions (cm) Height` double, `Carton CBM` double, `Units / Package` int64, `Package Weight (kg)` double, `Package Dimensions (cm) Length` double, `Package Dimensions (cm) Width` double, `Package Dimensions (cm) Height` double, `Item Dimensions (cm) Length` string, `Item Dimensions (cm) Width` string, `Item Dimensions (cm) Height` string, `Item Dimensions (in) Length` string, `Item Dimensions (in) Width` string, `Item Dimensions (in) Height` string, `SKU Consertado` string, `Key Column: Inventory Region | SKU Consertado` string, `item_name` string, `item_description` string, `current_price` double, `open_date` string, `fulfillment_channel` string, `status` string, `AWD - Units / Carton` int64, `AWD - Carton Weight (kg)` double, `AWD - Carton Dimensions (cm) Length` double, `AWD - Carton Dimensions (cm) Width` double, `AWD - Carton Dimensions (cm) Height` double, `AWD - Carton CBM` double, `is_grade_and_resell` boolean, `Grade` string, `Package CBM` double, `Package Cubic Feet` double, `ABC Profitability` string, `Life Cycle` string, `Reorder Region` string, `Reorder Region | Base SKU` string, `ABC Sales` string  

### `STAGING_fact_cross_sales`

**Modo:** `directQuery`  
**Colunas:** `amazon_order_id` string, `date_all_orders` dateTime, `order_status` string, `item_status` string, `quantity_sku_analysis` int64, `item_status_cross_sales` string, `quantity_sku_cross_sales` int64, `is_same_sku` boolean, `key_sales_marketplace_sku_analysis` string, `key_sales_marketplace_sku_cross_sales` string  

### `tab_parameters_measurements`

**Modo:** `directQuery`  
**Colunas:** `Type` string, `Order` int64  

### `td_full_order_transfer_details`

**Modo:** `directQuery`  
**Colunas:** `type` string, `origin` string, `deliver_at_type` string, `deliver_at_location` string, `order_id` string, `amazon_shipment_id` string, `key_order_id_amazon_shipment_id` string, `key_inventory_region_sku` string, `sku` string, `order_date` dateTime, `delivery_date` dateTime, `status` string, `amazon_shipment_name` string, `quantity` int64, `units_per_carton` int64, `carton_count` double, `carton_cbm` double, `total_cbm` double, `inventory_region` string, `landed_cost_type` string, `unit_transfer_cost_local_currency` double, `total_transfer_cost_local_currency` double, `unit_estimated_3pl_processing_fee` double, `total_estimated_3pl_processing_fee` double, `units_estimated_3pl_container_devanning` double, `total_estimated_3pl_container_devanning` double, `unit_inbound_placement_fee` double, `total_unit_inbound_placement_fee` double, `unit_purchase_cost_local_currency` double, `total_purchase_cost_local_currency` double, `unit_landed_cost_local_currency` double, `total_landed_cost_local_currency` double  

### `The Date Picker`

**Modo:** `directQuery`  
**Colunas:** `Name` string, `Ordinal` int64  

### `z.dynamic_coupon_usage_percentage`

**Modo:** `directQuery`  
**Colunas:** `Coupon Usage (%)` double  

### `z.dynamic_Fees_absolute`

**Modo:** `directQuery`  
**Colunas:** `teste Fees - $ and u` string, `teste Fees - $ and u Fields` string, `teste Fees - $ and u Order` int64  

### `z.dynamic_Fees_relative`

**Modo:** `directQuery`  
**Colunas:** `teste Fees - %` string, `teste Fees - % Fields` string, `teste Fees - % Order` int64  

### `z.dynamic_Growth_Comp_Rows`

**Modo:** `directQuery`  
**Colunas:** `z.dynamic_GC_Rows` string, `z.dynamic_GC_Rows Fields` string, `z.dynamic_GC_Rows Order` int64, `Group` string  

### `z.dynamic_Growth_Comp_selector`

**Modo:** `directQuery`  
**Colunas:** `Group` string  

### `z.dynamic_Growth_Comp_Values`

**Modo:** `directQuery`  
**Colunas:** `z.dynamic_GC_Values` string, `z.dynamic_GC_Values Fields` string, `z.dynamic_GC_Values Order` int64, `Group` string  

### `z.dynamic_Inventory_column_axis`

**Modo:** `directQuery`  
**Colunas:** `z.dynamic_inventory_column_axis` string, `z.dynamic_inventory_column_axis Fields` string, `z.dynamic_inventory_column_axis Order` int64, `Inventory Type` string, `Axis` string  

### `z.dynamic_Inventory_line_axis`

**Modo:** `directQuery`  
**Colunas:** `z.dynamic_inventory_switch` string, `z.dynamic_inventory_switch Fields` string, `z.dynamic_inventory_switch Order` int64, `Inventory Type` string, `Axis` string  

### `z.dynamic_Inventory_selector`

**Modo:** `directQuery`  
**Colunas:** `Inventory Type` string  

### `z.dynamic_Legend_Picker_ads performance`

**Modo:** `directQuery`  
**Colunas:** `field_picker_ads_performance` string, `field_picker_ads_performance Fields` string, `field_picker_ads_performance Order` int64  

### `z.dynamic_parameter_low_stock_tacos_acos`

**Modo:** `directQuery`  
**Colunas:** `parameter lowStock - tacos e acos` string, `parameter lowStock - tacos e acos Fields` string, `parameter lowStock - tacos e acos Order` int64, `Theme` string  

### `z.dynamic_parameter_units_revenue_price`

**Modo:** `directQuery`  
**Colunas:** `parameter_units_revenue_price` string, `parameter_units_revenue_price Fields` string, `parameter_units_revenue_price Order` int64, `Sales` string, `Theme` string  

### `z.dynamic_Quotation`

**Modo:** `import`  
**Colunas:** `z.dynamic_Quotation`, `z.dynamic_Quotation Fields`, `z.dynamic_Quotation Order`  
```powerquery
{
    ("Forwarder", NAMEOF('fact_freight_negotiation'[Freight_Forwarder]), 0),
    ("Incoterm", NAMEOF('fact_freight_negotiation'[Incoterm]), 1),
    ("Mode", NAMEOF('fact_freight_negotiation'[Mode_of_Transport]), 2),
    ("Region", NAMEOF('dim_td_fulfillment_centers_address'[Inventory Region]), 3),
    ("Coast", NAMEOF('dim_td_fulfillment_centers_address'[Country Region (US/CA Only)]), 4)
}
```


### `z.dynamic_scatter_plot_mapped_returns`

**Modo:** `directQuery`  
**Colunas:** `dim_scatter_plot_mapped_returns` string, `dim_scatter_plot_mapped_returns Fields` string, `dim_scatter_plot_mapped_returns Order` int64  

### `z.dynamic_Solution_LT_Fields`

**Modo:** `import`  
**Colunas:** `z.dynamic_Solution_LT_Fields`, `z.dynamic_Solution_LT_Fields Fields`, `z.dynamic_Solution_LT_Fields Order`  
```powerquery
{
    ("Region", NAMEOF('Inbound Shipments'[Region]), 0),
    // ("Region", NAMEOF('fact_case_log'[Region]), 0),
    ("Solution", NAMEOF('fact_case_log'[Solution Category]), 1),
    ("Requester", NAMEOF('fact_case_log'[Requester]), 2)
}
```


### `z.dynamic_SP_absolute`

**Modo:** `directQuery`  
**Colunas:** `Sponsored Products - $ and u` string, `Sponsored Products - $ and u Fields` string, `Sponsored Products - $ and u Order` int64  

### `z.dynamic_SP_all_metrics`

**Modo:** `directQuery`  
**Colunas:** `Unified Sponsored Products - $, u and %` string, `Unified Sponsored Products - $, u and % Fields` string, `Unified Sponsored Products - $, u and % Order` int64  

### `z.dynamic_SP_relative`

**Modo:** `directQuery`  
**Colunas:** `Sponsored Products - %` string, `Sponsored Products - % Fields` string, `Sponsored Products - % Order` int64  

### `z.dynamic_time_frame_switch`

**Modo:** `directQuery`  
**Colunas:** `Date order` dateTime, `Abbreviated Date` string, `Time Frame` string, `Start Date` dateTime, `Time Frame Order` string  

### `z.dynamic_traffic_channel`

**Modo:** `directQuery`  
**Colunas:** `Parameter` string, `Parameter Fields` string, `Parameter Order` int64, `Channel` string  

### `z.list_of_warehouse_names`

**Modo:** `directQuery`  
**Colunas:** `Type` string, `Location Group` string, `Deliver At Location` string  

### `z.parameter_coverage_selection`

**Modo:** `directQuery`  
**Colunas:** `parameter_coverage_selection` string, `parameter_coverage_selection Fields` string, `parameter_coverage_selection Order` int64, `parameter_coverage_selection Name` string  

### `z.RowHeaderScorecardCoverage`

**Modo:** `directQuery`  
**Colunas:** `index` int64, `row_header` string  

### `z.RowHeaderScorecardPpc`

**Modo:** `directQuery`  
**Colunas:** `index` int64, `row_header` string  

### `z_dyn.CS_Dims`

**Modo:** `import`  
**Colunas:** `z_dyn.CS_Dims`, `z_dyn.CS_Dims Fields`, `z_dyn.CS_Dims Order`  
```powerquery
{
    ("Platform", NAMEOF('fact_db_customer_support'[platform]), 0),
    ("Region", NAMEOF(fact_db_customer_support[Region]), 1),
    ("Country", NAMEOF('SKUs'[Country]), 2)
}
```


### `z_dyn.CS_Metrics`

**Modo:** `import`  
**Colunas:** `z_dyn.CS_Metrics`, `z_dyn.CS_Metrics Fields`, `z_dyn.CS_Metrics Order`  
```powerquery
{
    ("Avg Resolution Time", NAMEOF('_Operations Metrics'[Avg Resolution Time (days)]), 0),
    ("Messages", NAMEOF('_Operations Metrics'[Total CS Messages]), 1),
    // ("Complaints", NAMEOF('_Log_Metrics'[Total Complaints]), 2),
    ("Product Issues", NAMEOF('_Operations Metrics'[Total Product Issues]), 3),
    ("Questions", NAMEOF('_Operations Metrics'[Total Questions]), 4),
    ("Refund Amount", NAMEOF('_Operations Metrics'[Total Refund Amount]), 5),
    ("Refund Messages", NAMEOF('_Operations Metrics'[Total Refund Messages]), 6),
    ("Replacement Amount", NAMEOF('_Operations Metrics'[Total Replacement Amount]), 7),
    ("Replacement Messages", NAMEOF('_Operations Metrics'[Total Replacement Messages]), 8)
}
```


### `z_dyn.Rmz_Dims`

**Modo:** `import`  
**Colunas:** `z_dyn.Rmz_Dims`, `z_dyn.Rmz_Dims Fields`, `z_dyn.Rmz_Dims Order`  
```powerquery
{
    ("Inventory Region", NAMEOF('SKUs'[Inventory Region]), 0),
    // ("Country", NAMEOF('SKUs'[Country]), 1),
    ("Native Family", NAMEOF('SKUs'[Native Family]), 2)
}
```


### `z_dyn.Rmz_Metrics`

**Modo:** `import`  
**Colunas:** `z_dyn.Rmz_Metrics`, `z_dyn.Rmz_Metrics Fields`, `z_dyn.Rmz_Metrics Order`  
```powerquery
{
    ("Avg LeadTime", NAMEOF('_Operations Metrics'[Avg Leadtime (days)]), 0),
    ("Total Refunds (USD)", NAMEOF('_Operations Metrics'[Total Refunds (USD)]), 1),
    ("Total Cases", NAMEOF('_Operations Metrics'[Total Remeasurement Cases]), 2)
}
```


### `zz_Refresh_Control 2`

**Modo:** `directQuery`  
**Colunas:** `ID` int64, `LastRefresh` dateTime  

### `zz_Refresh_Control`

**Modo:** `import`  
**Colunas:** `ID`, `LastRefresh`  
```powerquery
ADDCOLUMNS(
    ROW("ID", 1),
    "LastRefresh", NOW() - TIME(3,0,0)

)
```



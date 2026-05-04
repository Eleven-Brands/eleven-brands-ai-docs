# OrganiHaus - Market Research (Dashboard)

## Visao Geral

Dashboard de inteligencia de mercado da OrganiHaus. Cobre monitoramento de preco e promocoes de concorrentes (MAE), share de mercado por marca (DataDive), performance de keywords e ranking organico (DataDive Rank Radar / Helium10), Search Query Performance (SQP) da Amazon e rastreamento de hijackers de Buy Box.

**Caminho do modelo:** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Market Research\OrganiHaus - Market Research.SemanticModel`

**Arquitetura:** Modelo Import puro — sem DirectQuery a outros modelos. Todas as fontes sao carregadas localmente via M.

---

## Arquitetura de Fontes

O modelo tem **quatro origens principais** de dados:

### 1. MAE — Market Analyser Extractor (scraping de listings Amazon)

Ferramenta customizada que extrai dados de listings da Amazon (preco, rating, estoque, promo, cupom, PED, merchant) e gera um arquivo CSV consolidado.

| Expressao | Arquivo | Descricao |
|---|---|---|
| `new_output_mae` | `market_analyser_extractor_mae\OUTPUT\OUTPUT_FILE.csv` | Output atual do MAE (UTF-8, parsing robusto de datas e precos) |
| `old_output_mae` | Formato legado | Historico de outputs anteriores com schema compativel |
| `fact_output` | Combinacao de `old_output_mae` + `new_output_mae` | Tabela base de todos os listings monitorados, deduplicada por {Date, ASIN, Brand, Country} |

**Colunas principais de `fact_output`:** Date, ASIN, Price, Ratings Stars, Number of ratings, Name, Link, Stock, Coupon, Brand, Deal, Badge, Merchant, Prime, PED (Prime Exclusive Discount), Limited Time Deal, List Price, Product Category GL, Prev Month Qty, Country, Key: Country | ASIN, Marketplace, Key Marketplace | ASIN, Coupon Type, Coupon Value, Promotion Type, Full Price, Final Price, Total Discount Value, Coupon Price, Color Name, Size Name

### 2. DataDive — Market Share

Exportacoes CSV mensais de share de mercado por marca e familia de produto.

| Expressao | Fonte | Descricao |
|---|---|---|
| `COMP_sales` | Pasta `2.2 - OH Ranking & PPC\Market Research\Market Share\Data Dive\` | Todos os CSVs da pasta (exceto `marketshare.csv`), processados com `ProcessCSVFile`, combinados e deduplicados |
| `aux_comp_sales` | Arquivo historico consolidado pelo time de Marketing | Historico de vendas de concorrentes em formato compativel |
| `fact_COMP_sales` | Combinacao `COMP_sales` + `aux_comp_sales` | Fato de vendas mensais por Marketplace, Amazon Family, Brand — maior valor por grupo, sem duplicatas |

### 3. DataDive Rank Radar — Keywords e Ranking

Exportacoes CSV de rastreamento de posicao organica por keyword, processadas por uma funcao customizada `ProcessDDFile`.

| Expressao | Fonte | Descricao |
|---|---|---|
| `fact_RankRadar_KWs` | Pasta `Data Base Keyword and Ranking\DataBase Keyword and Ranking\2. Keyword\DataDive\Rank_Radar\` | Todos os CSVs da pasta, processados, expandidos, filtrados por `RangeStart` (parametro de data) |

### 4. SQP — Search Query Performance (Amazon Seller Central)

Dados de Search Query Performance da Amazon — impressoes, cliques, adicoes ao carrinho e compras por ASIN e keyword, por semana.

| Expressao | Fonte | Descricao |
|---|---|---|
| `fact_seller_utils_SQP` | CSV local — `z_personal_folders\lucca_lanzellotti\Projetos\SQP\resultado_final.csv` | 42 colunas tipadas: year, week, inventory_region_code, country_code, start_date, asin, search_query, search_query_score, search_query_volume, IMP/CLK/CART/PUR (total_count + asin_count + share + price_median + shipping_counts) |
| `fact_search_query_performance` | Transformacao de `fact_seller_utils_SQP` | Adiciona chaves compostas (Key Country|ASIN, Year-Week, Key SV, Key SQ), deduplica |

### 5. Arquivos de configuracao e controle

| Arquivo | Expressao/Tabela | Descricao |
|---|---|---|
| `01 - OH Sourcing and Orders\01.1 - Suppliers - Active\Product Information and Pricing Database.xlsx` aba `skusByRegion` | `SKUs (raw)` | Dimensao mestre de produtos OrganiHaus |
| `standalone_files\db_promotion_tracker.xlsx` aba `db` | `fact_promotion_tracker` | Planejamento de promocoes com datas, preco simulado, margens |
| `market_analyser_extractor_mae\Competitors Mapping\MAE Competitors - Editado v2.xlsx` | Funcao `GetCompetitorData` | Mapeamento de ASINs de concorrentes por marketplace (CA, EU, UK, US) |
| Hardcoded em M | `dim_featured_brands` | Lista de marcas destacadas para filtros de competidores |

---

## Funcoes e Expressoes Globais

| Nome | Tipo | Descricao |
|---|---|---|
| `GetCompetitorData` | Funcao M | Carrega uma aba do Excel de mapeamento de competidores, tipifica, expande por pais (quando EU) e cria chaves compostas |
| `ProcessCSVFile` | Funcao M | Processa cada arquivo CSV de market share do DataDive (nome, conteudo, pasta) e padroniza colunas |
| `ProcessDDFile` | Funcao M | Processa CSVs de Rank Radar (DataDive), extrai keyword, rank, search volume, data, Amazon Family |
| `fnGetCSVFromFolder` | Funcao M | Helper para leitura de CSVs de pasta (Helium10 KW Tracker) |
| `bigQuery_customFunction` | Funcao M | Conecta ao BigQuery `amazon-sp-api-openbridge` (usada em SKUs; SQP foi migrada para CSV local) |
| `fact_search_query_performance` | Expressao tabela | Transformacao central do SQP: add chaves, deduplica |
| `fact_output` | Expressao tabela | Combina old + new output do MAE, deduplica por Date|ASIN|Brand|Country |
| `RangeStart` | Parametro (Date) | Data inicial para filtro de keywords do Rank Radar (default: 2025-01-01) |
| `path_to_MAE` | Parametro (Path) | Raiz do folder do MAE: `SharedDrivesFolder\OrganiHaus\3.1 - OH Data & Reports\market_analyser_extractor_mae` |
| `path_to_DD` | Parametro (Path) | Raiz dos arquivos DataDive de market share |
| `path_to_files` | Parametro (Path) | `SharedDrivesFolder\OrganiHaus\3.1 - OH Data & Reports\` |
| `de_para_file` | Parametro (Path) | Caminho do arquivo de mapeamento de competidores (`MAE Competitors - Editado v2.xlsx`) |

---

## Tabelas do Modelo

### OH_Output
**Categoria:** Fato — Listings OrganiHaus
**Fonte:** Filtro de `fact_output` onde Brand = "OrganiHaus"
**Colunas:** Todas as colunas de `fact_output` (Date, ASIN, Price, Final Price, Full Price, Rating, Coupon, Deal, Badge, Merchant, PED, Promotion Type, Country, Marketplace, Color Name, Size Name, etc.)

### COMP_Output
**Categoria:** Fato — Listings de Concorrentes
**Fonte:** Filtro de `fact_output` onde Brand ≠ "OrganiHaus"; adiciona coluna `Key Country | ASIN | Brand`
**Colunas:** Mesmas de `fact_output` (Date, ASIN, Brand, Final Price, Full Price, Rating, Coupon, Promotion Type, Country, etc.)

### OH ASINs
**Categoria:** Dimensao — ASINs OrganiHaus
**Fonte:** `SKUs (raw)` selecionando Base SKU, Sales Region, Country, Amazon Family, ASIN, Native Family; enriquecida com variacao de cor/tamanho de `OH_Output`
**Transformacoes:** Renomeia Sales Region para Marketplace; cria chaves compostas (SKU Limpo = `Country | Base SKU`, Key Marketplace | Native Family, Key Country | ASIN, Key Country | Amazon Family, Key Country | Native Family); adiciona Brand = "OrganiHaus"; filtra ASIN nao nulo, Marketplace != "Erro"/"BR"/"MX"; deduplica por SKU Limpo
**Colunas:** SKU Limpo, Key Marketplace | Native Family, Key Country | ASIN, Key Country | Native Family, Key Country | Amazon Family, Brand, Country, Base SKU, Marketplace, Native Family, ASIN, Color Name, Size Name

### Competitors ASINs
**Categoria:** Dimensao — ASINs de Concorrentes
**Fonte:** `Table.Combine({CA, EU, UK, US})` — cada um carregado por `GetCompetitorData` do Excel de mapeamento
**Transformacoes:** Padroniza tipos, cria Key Marketplace|ASIN e Key Marketplace|Native Family, adiciona coluna `Highlight` (1 se Brand esta em `dim_featured_brands`), cria Key Country|ASIN e Key Country|Native Family, filtra ASINs validos, adiciona Key Country|ASIN|Brand
**Colunas:** Marketplace, ASIN, Native Family, Brand, Country, Key Marketplace|ASIN, Key Marketplace|Native Family, Highlight, Key Country|ASIN, Key Country|Native Family, Key Country|ASIN|Brand

### ASIN Brand
**Categoria:** Dimensao auxiliar — lookup de Brand por ASIN
**Fonte:** Combinacao de `OH ASINs` + `Competitors ASINs`, seleciona Brand/Native Family/ASIN, deduplica por ASIN; adiciona Brand Type ("OrganiHaus" ou "Competitor")

### fact_COMP_sales
**Categoria:** Fato — Vendas mensais de mercado (Market Share)
**Fonte:** Combinacao de `COMP_sales` (DataDive folder) + `aux_comp_sales` (historico); agrupado por {Marketplace, Amazon Family, Brand, year_month} selecionando MAX(Sales); filtra registros invalidos (ex: Bagnizer OHFB-RH-CUBE no US)
**Colunas:** Marketplace, Amazon Family, Brand, Month, Year, Sales, year_month, Date

### fact_RankRadar_KWs
**Categoria:** Fato — Ranking organico por keyword (DataDive)
**Fonte:** Pasta `DataBase Keyword and Ranking\2. Keyword\DataDive\Rank_Radar\` — todos os CSVs processados por `ProcessDDFile`
**Transformacoes:** Ordena por Date Created decrescente, remove erros, expande colunas processadas, filtra por `RangeStart`, adiciona `Key Country | Amazon Family`
**Colunas:** Name (arquivo), Search Terms, Highlight, Search Volume, Top Variation, originalDate, rank, Amazon Family, year, month, Country, Key Country | Amazon Family

### fact_promotion_tracker
**Categoria:** Fato — Planejamento de Promocoes
**Fonte:** Excel `standalone_files\db_promotion_tracker.xlsx` aba `db`
**Colunas principais:** Country, Native Family, ASIN, Base SKU, Title Description, Category, Objective, Current Price, Simulated Price, % Coupon Discount, Amount Discount, Commercial Margin, % Operational Margin, startDate, endDate, pricePromotionAction, actionDescription, Status, Amazon Inventory, Weekly Velocity, Overstock, Aging Units

### fact_sqp_asin
**Categoria:** Fato — SQP nivel ASIN (unpivotado)
**Fonte:** Derivada de `fact_search_query_performance`
**Transformacoes:** Seleciona colunas de ASIN-level, renomeia IMP/CLK/CART/PUR_asin_count para nomes curtos, UnpivotOtherColumns gerando coluna "Funnel Category" (IMP|CLK|CART|PUR) e "Count", adiciona Key Totals = `Key SV | Funnel Category`
**Granularidade:** Year-Week x Country x ASIN x Search Query x Funnel Category

### fact_sqp_sv
**Categoria:** Fato — SQP nivel Search Query (Search Volume)
**Fonte:** Derivada de `fact_search_query_performance`
**Transformacoes:** Agrupa por Year-Week x country x search_query, MAX(search_query_volume) e MAX(search_query_score); deduplica por Key SV
**Granularidade:** Year-Week x Country x Search Query

### fact_sqp_sv_funnel_totals
**Categoria:** Fato — SQP totais de mercado por keyword (unpivotado)
**Fonte:** Derivada de `fact_search_query_performance`
**Transformacoes:** Seleciona totais de mercado (IMP/CLK/CART/PUR_total_count), unpivota por Funnel Category, adiciona Key Totals = `Year-Week | Country | search_query | Funnel Category`; deduplica por Key Totals
**Granularidade:** Year-Week x Country x Search Query x Funnel Category (totais, nao por ASIN)

### dim_sq
**Categoria:** Dimensao — Search Queries
**Fonte:** Derivada de `fact_search_query_performance`, seleciona country_code e search_query, deduplica por Key SQ
**Colunas:** country_code, search_query, Key SQ

### dim_AmzFamily
**Categoria:** Dimensao — Familias de Produto OrganiHaus
**Fonte:** `SKUs (raw)` + `dgradeAndResellAmazonFoundSkus`, com adicao de is_grade_and_resell, GradeCode, ProductID (join com Dim_Product)
**Colunas:** Amazon Family, Native Family, Country, Sales Region, ProductID, is_grade_and_resell, GradeCode

### dim_calendar
**Categoria:** Dimensao temporal
**Fonte:** Calculada em M de 2023-01-01 ate hoje+14 dias
**Colunas:** Date, Year, Month, Month Abrev, Quarter Q, Week Number 544, Year-Week 544, Year-Month, today, e outros campos do calendario 4-4-5

### dim_country / dim_marketplace
**Categoria:** Dimensoes de Regiao
**Fonte:** Derivadas de `SKUs (raw)`, filtradas para CA/DE/ES/FR/GB/IT/US
**Colunas:** Marketplace (= Country), Region (= Sales Region)

### dim_featured_brands
**Categoria:** Dimensao de configuracao — Marcas em destaque
**Fonte:** Lista hardcoded em M com ~24 marcas monitoradas (OrganiHaus, TeoKJ, COMFY-HOMI, CHICVITA, LA JOLIE MUSE, XUANGO, Maliton, Goodpick, MINTWOOD Design, etc.)

### dim_important_competitors
**Categoria:** Dimensao de configuracao — Categorias de competidores
**Fonte:** DATATABLE embutido (Binary comprimido), colunas Id e Category

### SKUs
**Categoria:** Dimensao mestre de produtos
**Fonte:** `SKUs (raw)` + `dgradeAndResellAmazonFoundSkus`, com multiplas chaves compostas (Sales Region|SKU, Sales Region|ASIN, Sales Region|FNSKU, Sales Region|Amazon Family, Country|SKU, Country|ASIN, Country|FNSKU, Inventory Region|SKU, Inventory Region|ASIN, Inventory Region|FNSKU)

### PARAM_AvailableDates / PARAM_AvailableDates_Comp
**Categoria:** Parametros de data para comparacao de keywords (Keyword Gain/Loss)
**Fonte:** Derivadas de `fact_RankRadar_KWs`, lista de datas disponíveis como slicer de selecao de periodo

---

## Measures — _Medidas

### Dominio: MAE_OH (OrganiHaus — Preco e Promo)

| Medida | Descricao |
|---|---|
| `OH_last_price` | Ultimo preco Full Price do SKU OrganiHaus |
| `OH_last_final_price` | Ultimo Final Price (apos descontos) |
| `OH_avg_price` | Media de Full Price |
| `OH_avg_final_price` | Media de Final Price |
| `OH_min_price` / `OH_max_price` | Min/Max de Final Price |
| `OH_mode_final_price` | Preco modal (mais frequente) |
| `OH_mode_final_price_frequency` | Frequencia do preco modal |
| `OH_last_final_price_evolution` | ROUND(AVERAGE(Final Price), 2) — para grafico de evolucao |
| `OH_avg_PED` / `OH_min_PED` / `OH_max_PED` | Estatisticas de Prime Exclusive Discount |
| `OH_last_PED` | Ultimo PED registrado |
| `OH_coupon_value` | Valor do cupom ativo |
| `OH_promo_type` | Tipo de promocao atual |
| `OH_deal` / `OH_deal_last_date` | Existencia e data do deal |
| `OH_last_QTY` | Bought Past Month (quantidade vendida no mes) |
| `OH_avg_rating` | Media de Ratings Stars |
| `OH_link` | Link do listing |
| `OH_final_price_deal` / `OH_final_price_coupon` | Preco com deal / preco com cupom para grafico de evolucao |
| `OH_distinct_asin_count` | Count de ASINs OrganiHaus |
| `OH_list_price` | List Price (preco de lista) |
| `OH_current_final_price` | Final Price no dia selecionado |
| `OH_hijackers` | Count de merchants diferentes de "Amazon" e "OrganiHaus" |

### Dominio: MAE_COMP (Competidores — Preco e Promo)

| Medida | Descricao |
|---|---|
| `COMP_avg_price` / `COMP_min_price` / `COMP_max_price` | Estatisticas de Full Price dos competidores |
| `COMP_avg_final_price` | Media de Final Price de competidores |
| `COMP_last_price` / `COMP_last_final_price` | Ultimo preco Full/Final de competidor |
| `COMP_last_final_price_evolution` | ROUND(AVERAGE(Final Price), 2) — para grafico |
| `COMP_W_avg_final_price` | Media ponderada de Final Price de competidores |
| `COMP_mode_final_price` / `COMP_mode_final_price_frequency` | Preco modal dos competidores |
| `COMP_avg_rating` | Media de rating dos competidores |
| `COMP_coupon_value` / `COMP_promo_type` | Cupom e promo atual dos competidores |
| `COMP_deal` / `COMP_deal_last_date` | Deal de competidores |
| `COMP_last_QTY` | Bought Past Month dos competidores |
| `COMP_link` | Link de listing do competidor |
| `COMP_price_variation` | Variacao de preco do competidor em relacao ao periodo anterior |
| `COMP_total_asins` / `COMP_asins_price_down` / `COMP_asins_price_up` / `COMP_asins_neutral` | Contagem de ASINs por direcao de variacao de preco |
| `COMP_distinct_asin_count` | Count de ASINs de competidores |
| `COMP_list_price` | List Price dos competidores |
| `COMP_last_PED_evolution` | PED dos competidores para grafico |
| `COMP_badge_count` / `COMP_badge_exists` | Badges (Best Seller, Amazon Choice) |
| `COMP_final_price_deal` / `COMP_final_price_coupon` | Preco com deal / cupom para grafico |
| `COMP_current_final_price` | Final Price no dia selecionado |

### Dominio: MAE_AUX (Analise de Preco Comparativa)

| Medida | Descricao |
|---|---|
| `avg_price_ratio` | OH Final Price / COMP Avg Final Price |
| `w_avg_price_ratio` | OH Final Price / COMP Weighted Avg Final Price |
| `price_ratio_asin` | OH Avg Final Price / COMP Last Final Price (nivel ASIN) |
| `price_alert_general` | "Alert - Price Change" se ABS(COMP_price_variation) >= 10% |
| `price_alert_asin` / `price_alert_brand_summary` / `price_alert_by_hierarchy` | Alertas de variacao de preco em niveis diferentes |
| `is_price_alert` | Flag binario de alerta de preco |
| `has_valid_data` | Verifica se ha dados validos no periodo |
| `is_featured_competitor` | 1 se dim_featured_brands esta filtrado |
| `last_update_date` | MAX(COMP_Output[Date]) |
| `count_total_asins` / `count_price_down` / `count_price_up` / `count_price_neutral` / `count_price_under` / `count_price_over` / `count_price_equal` | Contagens de ASINs por status de preco |

### Dominio: SQP (Search Query Performance)

| Medida | Descricao |
|---|---|
| `IMP_OH` / `IMP_Total` | Impressoes OrganiHaus e totais do mercado |
| `CLK_OH` / `CLK_Total` | Cliques OH e totais |
| `A2C_OH` / `A2C_Total` | Adicoes ao carrinho OH e totais |
| `PUR_OH` / `PUR_Total` | Compras OH e totais |
| `CTR_OH` / `CTR_Total` | Click-Through Rate OH e total |
| `A2C_Rate_OH` / `A2C_Rate_Total` | Taxa de A2C OH e total |
| `PUR_Rate_OH` / `PUR_Rate_Total` | Taxa de compra OH e total |
| `CVR_OH` / `CVR_Total` | Conversion Rate OH e total (PUR/IMP) |
| `IMP_Share` / `CLK_Share` / `A2C_Share` / `PUR_Share` | Share de OH em relacao ao mercado |
| `IMP_ASIN_Share` | Share de impressoes por ASIN |
| `SQ Total Search Vol` | Volume de busca total das keywords selecionadas |
| `SQ Score` | Search Query Score (relevancia da keyword) |
| `SQ Avg Search Vol` | Volume medio de busca |
| `Impr per Search` | DIVIDE(IMP_Total, SQ Total Search Vol) |
| `delta_CTR` / `delta_CVR` / `delta_A2C_Rate` / `delta_PUR_Rate` | Variacao de taxa OH vs mercado |
| `ui_delta_CTR` / `ui_delta_CVR` / `ui_delta_A2C_Rate` / `ui_delta_PUR_Rate` | Formatacao visual dos deltas |
| `recommendations` | Texto de recomendacao baseado em SQP |

### Dominio: Keywords (DataDive Rank Radar)

| Medida | Descricao |
|---|---|
| `DD_Indexed_KWs` | DISTINCTCOUNT de keywords indexadas |
| `DD_Sum_Search_Vol` | SUM de Search Volume |
| `DD_Avg_Search_Vol` | Media de Search Volume por keyword |
| `DD_Avg_Rank` / `DD_Median_Rank` | Rank medio e mediano |
| `DD_Weighted_Avg_Rank` | Rank medio ponderado por Search Volume |
| `DD_Mode_Rank` / `DD_Rank_Frequency` | Rank modal e sua frequencia |
| `DD_Rank_StdDev` | Desvio padrao do rank |
| `DD_%_Top10` / `DD_%_Top30` | % de keywords rankeadas no Top 10 / Top 30 |
| `DD_Total_KWs` | Total de keywords monitoradas (incluindo nao indexadas) |
| `DD_Opportunity` | Score de oportunidade por keyword |
| `DD_Rank_Change` | Variacao de rank periodo a periodo |
| `KW_Status` | Label de status (New / Lost / Remained) |
| `KW_New` / `KW_Lost` / `KW_Remained` | Contagem de keywords por status |
| `Last_Search_Volume` | Volume de busca mais recente por keyword |

### Dominio: Market Share

| Medida | Descricao |
|---|---|
| `Total_Sales` | SUM de vendas do filtro atual |
| `Total_Sales_OH` | Total de vendas OrganiHaus |
| `Total_Market_Sales (S/OH)` | Total do mercado excluindo OrganiHaus |
| `Total_Sales_Market` | Total geral do mercado |
| `Mkt_Share` | Share de mercado OrganiHaus |
| `Avg_Sales` | Media mensal de vendas |
| `Growth_Rate` | Taxa de crescimento periodo a periodo |
| `Avg_Growth_Rate` / `Avg_Mkt_Growth_Rate` | CAGR ou media de crescimento |
| `Growth_Rate_StdDev` | Volatilidade do crescimento |
| `Competitor_Count` | Numero de marcas concorrentes |
| `Pareto_CmlPct` | % cumulativo para curva de Pareto |
| `Rank_Current_Month` / `Rank_Difference` | Rank no mes atual e variacao vs mes anterior |
| `Total_Sales_Current_Month` | Vendas no mes do filtro |
| `Brand_Rank` | Posicao da marca no ranking |
| `period_filtered` / `Calendar_Selected_Period` / `Selected_Period` | Labels de periodo para cards |

### Dominio: Promotions (Promotion Tracker)

| Medida | Descricao |
|---|---|
| `ActivePromotions` | Count de promocoes ativas no periodo |
| `ActivePromoNextWeek` | Count de promocoes que iniciam na proxima semana |
| `PED Count` / `Best Deal Count` / `Lightning Deal Count` | Contagens por tipo de promocao |
| `Price Increase Count` / `Price Decrease Count` | Count de acoes de preco no periodo |
| `StatusPromocaoSKU` | Status de promocao por SKU para o pivot table (celula colorida) |

---

## Tabelas Auxiliares e Dinamicas (Field Parameters)

| Tabela | Descricao |
|---|---|
| `z.dynamic_time_frame_switch` | Alterna granularidade temporal (diario/semanal/mensal) para graficos |
| `z.dynamic_SQP_metrics_prim_ABS` | Metrica primaria SQP — valores absolutos |
| `z.dynamic_SQP_metrics_prim_REL` | Metrica primaria SQP — valores relativos (%) |
| `z.dynamic_SQP_metrics_prim_SQ` | Metrica primaria SQP — nivel de Search Query |
| `z.dynamic_SQP_metrics_prim_y` | Eixo Y primario SQP |
| `z.dynamic_SQP_metrics_secd_ABS` | Metrica secundaria SQP — absolutos |
| `z.dynamic_SQP_metrics_secd_REL` | Metrica secundaria SQP — relativos |
| `z.dynamic_SQP_metrics_secd_SQ` | Metrica secundaria SQP — Search Query |
| `z.dynamic_SQP_metrics_secd_y` | Eixo Y secundario SQP |
| `z.dynamic_mkt_metrics_qtde` | Alterna metrica de quantidade no Market Share |
| `z.dynamic_Category_Tracker` | Alterna categoria para tracker |
| `z.dynamic_Price_Alert_Treshold` | Limite de alerta de variacao de preco |
| `z.dynamic_Top_N_Competitors` | Seleciona Top N concorrentes |
| `z_dynamic_metrics_comp` | Metricas dinamicas para competidores |
| `z_dynamic_metrics_OH` | Metricas dinamicas para OrganiHaus |
| `z_dynamic_metrics_product` | Metricas dinamicas por produto |
| `z_dynamic_price_evo` | Opcoes de preco para grafico de evolucao (Full Price / Final Price / PED) |
| `z_dynamic_promo_evo` | Opcoes de promo para grafico de evolucao (Coupon / Deal / None) |
| `aux_DD_SV` | Auxiliar de Search Volume para DataDive |
| `aux_first_available` | Auxiliar de primeira data disponivel por ASIN |
| `PARAM_AvailableDates` | Datas disponíveis para seletor de periodo (Keyword Tracker) |
| `PARAM_AvailableDates_Comp` | Datas disponíveis para comparacao (Keyword Gain/Loss) |
| `dim_promo_type` | Tipos de promocao (PED, Coupon, Deal, etc.) |
| `zz_Refresh_Control` | Timestamp de ultimo refresh |

---

## Paginas e Visuais

### Pagina: Alerts

Monitoramento de alertas de variacao de preco de concorrentes. Exibe um board de ASINs com variacao significativa vs periodo anterior.

#### Slicers

`dim_marketplace[Marketplace]`, `Competitors ASINs[Native Family]`, `Competitors ASINs[Brand]`, `dim_promo_type[Promotion Type]`, `dim_important_competitors[Category]` (advancedSlicer), `dim_calendar[today]` (advancedSlicer)

#### Visual: KPI Card — Variacao de Preco por Status (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[count_total_asins]` | Total ASINs |
| `_Medidas[count_price_down]` | Price Down |
| `_Medidas[count_price_up]` | Price Up |
| `_Medidas[count_price_neutral]` | Price Neutral |
| `_Medidas[count_price_under]` | Price Under |
| `_Medidas[count_price_over]` | Price Over |
| `_Medidas[count_price_equal]` | Price Equal |

#### Visual: Card — Last Update Date

| Values | `_Medidas[last_update_date]` |

#### Visual: Table — Status por Marketplace (tableEx)

Colunas: `dim_marketplace[Marketplace]`, `_Medidas[current_date]` (label: Update)

#### Visual: Table — Detalhe de ASINs com Alerta (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `ASIN Brand[Native Family]` | |
| | `COMP_Output[Brand]` | |
| | `COMP_Output[ASIN]` | |
| | `_Medidas[COMP_last_QTY]` | Bought Past Month |
| | `_Medidas[COMP_price_variation]` | Price Variation % |
| | `_Medidas[COMP_last_price]` | Comp. Last Final Price |
| | `_Medidas[COMP_current_final_price]` | Comp. Current Final Price |
| | `_Medidas[price_ratio_asin]` | OH Over Comp. |
| | `_Medidas[OH_avg_final_price]` | OH Avg. Price |
| | `_Medidas[COMP_promo_type]` | Comp. Current Promo |
| | `_Medidas[COMP_link]` | Link |

---

### Pagina: MAE

Analise comparativa de preco entre OrganiHaus e concorrentes — tabelas de preco por SKU e competidor, grafico de evolucao de preco e promo ao longo do tempo.

#### Slicers

`dim_marketplace[Marketplace]`, `OH ASINs[Native Family]`, `dim_AmzFamily[Amazon Family]`, `Competitors ASINs[Brand]`, `COMP_Output[Brand]`, `dim_promo_type[Promotion Type]`, `dim_calendar[Date]`, `z.dynamic_time_frame_switch[Time Frame]` (advancedSlicer), `dim_important_competitors[Category]` (advancedSlicer), `z_dynamic_promo_evo[Promo]`, `z_dynamic_price_evo[Price]`

#### Visual: Card — Periodo Selecionado

| Values | `_Medidas[Calendar_Selected_Period]` |

#### Visual: Table — Preco por SKU OrganiHaus (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `OH ASINs[SKU Limpo]` | |
| | `_Medidas[OH_mode_final_price]` | OH Mode Final Price |
| | `_Medidas[OH_mode_final_price_frequency]` | Price Frequency |
| | `_Medidas[OH_min_price]` | OH Min Final Price |
| | `_Medidas[OH_max_price]` | OH Max Final Price |
| | `_Medidas[OH_last_QTY]` | OH Bought Past Month |
| | `_Medidas[avg_price_ratio]` | OH Over Comp |
| | `_Medidas[w_avg_price_ratio]` | OH Over W. Comp |
| | `_Medidas[OH_link]` | OH Link |

#### Visual: Table — Preco por Familia (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `OH ASINs[Native Family]` | |
| | `_Medidas[COMP_avg_final_price]` | Comp. Avg. Final Price |
| | `_Medidas[OH_avg_final_price]` | OH Avg. Final Price |
| | `_Medidas[COMP_avg_price]` | Comp. Avg. Price |
| | `_Medidas[OH_avg_price]` | OH Avg. Price |
| | `_Medidas[COMP_min_price]` | Comp. Min. Price |
| | `_Medidas[OH_last_price]` | OH Last Price |
| | `_Medidas[OH_avg_rating]` | OH Rating Stars |
| | `_Medidas[avg_price_ratio]` | OH Over Comp. |
| | `_Medidas[OH_min_price]` | OH Min. Price |

#### Visual: Table — Preco por ASIN Competidor (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `Competitors ASINs[Brand]` | |
| | `Competitors ASINs[ASIN]` | |
| | `_Medidas[COMP_mode_final_price]` | Comp. Mode Final Price |
| | `_Medidas[COMP_mode_final_price_frequency]` | Price Frequency |
| | `_Medidas[COMP_min_price]` | Comp. Min Final Price |
| | `_Medidas[COMP_max_price]` | Comp. Max Final Price |
| | `_Medidas[COMP_last_QTY]` | Comp. Bought Past Month |
| | `_Medidas[COMP_link]` | Comp. Link |

#### Visual: Line Chart — Evolucao de Preco e Promo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Y | `_Medidas[COMP_last_final_price_evolution]` | Comp. Avg. Final Price |
| Y | `_Medidas[OH_last_final_price_evolution]` | OH Avg. Final Price |
| Y | `_Medidas[COMP_last_PED_evolution]` | Comp. PED |
| Y | `_Medidas[OH_avg_PED]` | OH PED |
| Y | `_Medidas[COMP_final_price_deal]` | Comp. Deal |
| Y | `_Medidas[OH_final_price_deal]` | OH Deal |
| Y | `_Medidas[COMP_final_price_coupon]` | Comp. Coupon |
| Y | `_Medidas[OH_final_price_coupon]` | OH Coupon |
| Y | `_Medidas[--]` | None |

---

### Pagina: Search Query Performance

Analise de performance organica nas buscas Amazon por keyword — impressoes, cliques, conversao e share do mercado por ASIN e familia.

#### Slicers

`dim_marketplace[Marketplace]`, `dim_country[Marketplace]`, `dim_AmzFamily[Amazon Family]`, `OH ASINs[Base SKU]`, `dim_calendar[Year]`, `dim_calendar[Week Number 544]`, `fact_sqp_sv[Search Volume]`, `fact_sqp_sv[Search Query Score]`, `dim_sq[search_query]` (textSlicer), `z.dynamic_SQP_metrics_prim_ABS`, `z.dynamic_SQP_metrics_prim_REL`, `z.dynamic_SQP_metrics_prim_SQ`, `z.dynamic_SQP_metrics_secd_ABS`, `z.dynamic_SQP_metrics_secd_REL`, `z.dynamic_SQP_metrics_secd_SQ` (todos advancedSlicer)

#### Visual: KPI Cards — Funil OrganiHaus (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[IMP_OH]` | Impressions |
| `_Medidas[CLK_OH]` | Clicks |
| `_Medidas[A2C_OH]` | Adds to Cart (A2C) |
| `_Medidas[PUR_OH]` | Purchases |

#### Visual: KPI Cards — Funil Total Mercado (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[IMP_Total]` | Impressions |
| `_Medidas[CLK_Total]` | Clicks |
| `_Medidas[A2C_Total]` | Adds To Cart (A2C) |
| `_Medidas[PUR_Total]` | Purchases |

#### Cards Individuais de Taxas

`_Medidas[CTR_OH]`, `_Medidas[CTR_Total]`, `_Medidas[A2C_Rate_OH]`, `_Medidas[A2C_Rate_Total]`, `_Medidas[PUR_Rate_OH]`, `_Medidas[PUR_Rate_Total]`, `_Medidas[CVR_OH]`, `_Medidas[CVR_Total]`, `_Medidas[IMP_Share]`, `_Medidas[CLK_Share]`, `_Medidas[A2C_Share]`, `_Medidas[PUR_Share]`, `_Medidas[SQ Total Search Vol]`, `_Medidas[ui_delta_CTR]`, `_Medidas[ui_delta_CVR]`, `_Medidas[ui_delta_A2C_Rate]`, `_Medidas[ui_delta_PUR_Rate]`

#### Visual: Line Chart — CVR ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `dim_calendar[Year]`, `dim_calendar[Week Number 544]` | |
| Y | `_Medidas[CVR_OH]` | CVR OH |
| Y | `_Medidas[CVR_Total]` | CVR Mkt |
| Y2 | `_Medidas[SQ Total Search Vol]` | Search Vol. |

#### Visual: Table — SQP por Search Query (tableEx)

Colunas: `dim_sq[search_query]`, SQ Score, Total Search Vol, Impr. OH, Clicks OH, CTR OH, Δ CTR, Pur. Rate OH, Pur. OH, CVR OH, Δ CVR

#### Visual: Table — SQP por Semana e Keyword (tableEx)

Colunas: `dim_calendar[Year]`, `dim_calendar[Week Number 544]`, `dim_sq[search_query]`, CVR OH, CVR Mkt, Search Vol.

#### Visual: Pivot Table — SQP por Familia e SKU (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `OH ASINs[Amazon Family]`, `OH ASINs[Base SKU]` | |
| Values | `_Medidas[SQ Total Search Vol]` | Total Search Vol |
| Values | `_Medidas[IMP_OH]` | Impr. OH |
| Values | `_Medidas[CLK_OH]` | Clicks OH |
| Values | `_Medidas[CTR_OH]` | CTR OH |
| Values | `_Medidas[delta_CTR]` | Δ CTR |
| Values | `_Medidas[PUR_Rate_OH]` | Pur. Rate OH |
| Values | `_Medidas[PUR_OH]` | Pur. OH |
| Values | `_Medidas[CVR_OH]` | CVR OH |
| Values | `_Medidas[delta_CVR]` | Δ CVR |

---

### Pagina: Promotion Tracker

Calendario de promocoes planejadas por SKU/familia com visualizacao de status no tempo e grafico de evolucao de preco.

#### Slicers

`OH ASINs[Marketplace]`, `OH ASINs[Amazon Family]`, `OH ASINs[Native Family]`, `fact_promotion_tracker[Base SKU]` (listSlicer), `fact_promotion_tracker[pricePromotionAction]`, `fact_promotion_tracker[Category]`, `dim_calendar[Date]`, `z.dynamic_time_frame_switch[Time Frame]` (advancedSlicer), `z_dynamic_promo_evo[Promo]`, `z_dynamic_price_evo[Price]`

#### Visual: KPI Card — Contagem de Acoes (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[ActivePromotions]` | |
| `_Medidas[ActivePromoNextWeek]` | |
| `_Medidas[PED Count]` | |
| `_Medidas[Best Deal Count]` | |
| `_Medidas[Lightning Deal Count]` | |
| `_Medidas[Price Increase Count]` | |
| `_Medidas[Price Decrease Count]` | |

#### Visual: Pivot Table — Calendario de Promocoes (pivotTable)

| Role | Campo |
|---|---|
| Columns | `dim_calendar[Date]` |
| Rows | `fact_promotion_tracker[Title Description]`, `OH ASINs[Amazon Family]` |
| Values | `_Medidas[StatusPromocaoSKU]` |

#### Visual: Line Chart — Evolucao de Preco com Promo (lineChart)

Mesmas series do grafico MAE: OH/COMP Final Price, PED, Deal, Coupon ao longo do tempo.

---

### Pagina: Market Share

Analise de share de mercado mensal por marca, familia de produto e marketplace.

#### Slicers

`fact_COMP_sales[Marketplace]`, `fact_COMP_sales[Amazon Family]`, `fact_COMP_sales[Brand]`, `dim_calendar[Year]`, `dim_calendar[Month Abrev]`, `z.dynamic_mkt_metrics_qtde[Metric]`

#### Visual: KPI Card — Metricas OrganiHaus (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[Total_Sales]` | OH Total Sales |
| `_Medidas[Avg_Sales]` | OH Avg. Monthly Sales |
| `_Medidas[Mkt_Share]` | OH Market Share |
| `_Medidas[Avg_Growth_Rate]` | OH Avg. Growth Rate |
| `_Medidas[Growth_Rate_StdDev]` | OH Volatility (StdDev) |
| `_Medidas[Competitor_Count]` | Competitors |

#### Visual: Card — Periodo Filtrado

| Values | `_Medidas[period_filtered]` |

#### Visual: Line Chart — Vendas por Marca ao Longo do Tempo (lineChart)

| Role | Campo |
|---|---|
| Category | `dim_calendar[Year]`, `dim_calendar[Quarter Q]`, `dim_calendar[Month Abrev]` |
| Series | `fact_COMP_sales[Brand]` |
| Y | `_Medidas[Total_Sales]` |

#### Visual: Line Chart — OrganiHaus vs Mercado (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `dim_calendar[Year]`, `dim_calendar[Quarter Q]`, `dim_calendar[Month Abrev]` | |
| Y | `_Medidas[Total_Market_Sales (S/OH)]` | Market Total Sales |
| Y | `_Medidas[Total_Sales_OH]` | OH Total Sales |

#### Visual: Combo Chart — Pareto por Marca (lineClusteredColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_COMP_sales[Brand]` | |
| Tooltips | `_Medidas[Total_Sales]` | Total Sales |
| Tooltips | `_Medidas[Pareto_CmlPct]` | Cumulative % |
| Y | `_Medidas[Total_Sales]` | Total Sales |
| Y2 | `_Medidas[Pareto_CmlPct]` | Cumulative % |

#### Visual: Bar Chart — Share por Marca (clusteredBarChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_COMP_sales[Brand]` | |
| Tooltips | `_Medidas[Pareto_CmlPct]` | Cumulative % |
| Tooltips | `_Medidas[Total_Sales]` | Total Sales |
| Y | `_Medidas[Mkt_Share]` | Market Share |

#### Visual: Pie Chart — Distribuicao de Vendas (pieChart)

| Role | Campo |
|---|---|
| Category | `fact_COMP_sales[Brand]` |
| Y | `_Medidas[Total_Sales]` |

---

### Pagina: Keyword Tracker

Monitoramento de palavras-chave indexadas e ranking organico (DataDive Rank Radar).

#### Slicers

`dim_marketplace[Marketplace]`, `dim_AmzFamily[Amazon Family]`, `fact_RankRadar_KWs[Search Volume]`, `fact_RankRadar_KWs[rank]`, `dim_calendar[Date]`, `fact_RankRadar_KWs[Search Terms]` (textSlicer), `z.dynamic_time_frame_switch[Time Frame]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[DD_Indexed_KWs]` | Indexed Keywords |
| `_Medidas[DD_%_Top10]` | % Top 10 |
| `_Medidas[DD_%_Top30]` | % Top 30 |
| `_Medidas[DD_Sum_Search_Vol]` | Total Search Volume |

#### Visual: Bar Chart — Keywords Indexadas por SKU (clusteredBarChart)

| Role | Campo |
|---|---|
| Category | `OH ASINs[Base SKU]` |
| Y | `_Medidas[DD_Indexed_KWs]` |

#### Visual: Bar Chart — Search Volume por SKU (clusteredBarChart)

| Role | Campo |
|---|---|
| Category | `OH ASINs[Base SKU]` |
| Y | `_Medidas[DD_Sum_Search_Vol]` |

#### Visual: Combo Chart — Volume e Indexacao ao Longo do Tempo (lineStackedColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]`, `PARAM_AvailableDates[Date]` | |
| Y | `_Medidas[DD_Sum_Search_Vol]` | Total Search Volume |
| Y2 | `_Medidas[DD_Indexed_KWs]` | Indexed KWs |
| Y2 | `_Medidas[DD_Total_KWs]` | Total KWs |

#### Visual: Table — Detalhe por Keyword (tableEx)

Colunas: `fact_RankRadar_KWs[Search Terms]`, Rank (Median), Avg. Search Vol., Opportunity Score, Rank Volatility, Rank (Avg)

---

### Pagina: Keyword Gain/Loss

Comparativo de keywords entre dois periodos — ganhos, perdas e permanencias.

#### Slicers

`dim_marketplace[Marketplace]`, `dim_AmzFamily[Amazon Family]`, `fact_RankRadar_KWs[Search Volume]`, `fact_RankRadar_KWs[rank]`, `fact_RankRadar_KWs[Search Terms]` (textSlicer), `PARAM_AvailableDates[Date]`, `PARAM_AvailableDates_Comp[Date]`

#### Visual: KPI Card — Status de Keywords (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[KW_New]` | New KWs |
| `_Medidas[KW_Lost]` | Lost KWs |
| `_Medidas[KW_Remained]` | Remained KWs |

#### Visual: Column Chart — Rank Mediano ao Longo do Tempo (clusteredColumnChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Y | `_Medidas[DD_Median_Rank]` |

#### Visuais: 3 Tables — Keywords (New, Lost, Remained)

Cada tabela: `fact_RankRadar_KWs[Search Terms]` + `_Medidas[Last_Search_Volume]`

---

### Pagina: Hijackers

Monitoramento de hijackers na Buy Box dos produtos OrganiHaus (merchants nao autorizados vendendo os ASINs).

#### Slicers

`OH ASINs[Amazon Family]`, `OH ASINs[ASIN]`, `dim_marketplace[Marketplace]`, `dim_calendar[Date]`

#### Visual: Line Chart — Hijackers ao Longo do Tempo (lineChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Series | `OH_Output[Country]` |
| Y | `_Medidas[OH_hijackers]` |

#### Visual: KPI Card — Hijackers por Pais (cardVisual)

| Role | Campo |
|---|---|
| Data | `_Medidas[OH_hijackers]` |
| Rows | `OH_Output[Country]` |

#### Visual: Bar Chart — Hijackers por Merchant (barChart)

| Role | Campo |
|---|---|
| Category | `OH_Output[Merchant]` |
| Y | `_Medidas[OH_hijackers]` |

#### Visual: Table — Detalhe de Hijackers (tableEx)

Colunas: `dim_marketplace[Marketplace]`, `OH ASINs[Amazon Family]`, `OH_Output[Merchant]`, `OH ASINs[Base SKU]`, Final Price, Link

---

### Pagina: Funnel

Visao do funil de conversao SQP — OrganiHaus vs mercado total — para o periodo selecionado. Pagina de view rapida com cards individuais para todas as taxas.

**Cards:** IMP_OH, IMP_Total, CLK_OH, CLK_Total, A2C_OH, A2C_Total, PUR_OH, PUR_Total, CTR_OH, CTR_Total, A2C_Rate_OH, A2C_Rate_Total, PUR_Rate_OH, PUR_Rate_Total, CVR_OH, CVR_Total, IMP_Share, CLK_Share, A2C_Share, PUR_Share, SQ Total Search Vol, ui_delta_CTR, ui_delta_CVR, ui_delta_A2C_Rate, ui_delta_PUR_Rate

---

### Pagina: Leaderboard

Ranking mensal de marcas por volume de vendas com variacao de posicao e growth rate.

#### Slicers

`dim_marketplace[Marketplace]`, `fact_COMP_sales[Amazon Family]`, `fact_COMP_sales[Brand]`, `dim_calendar[Year-Month]`, `dim_important_competitors[Category]` (advancedSlicer)

#### Visual: Card — Total de Vendas do Mercado

| Values | `_Medidas[Total_Sales_Market]` |

#### Visual: Combo Chart — Pareto do Mes (lineClusteredColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `fact_COMP_sales[Brand]` | |
| Tooltips | `_Medidas[Total_Sales]` | Total Sales |
| Tooltips | `_Medidas[Pareto_CmlPct]` | Cumulative % |
| Y | `_Medidas[Total_Sales]` | Total Sales |
| Y2 | `_Medidas[Pareto_CmlPct]` | Cumulative % |

#### Visual: Table — Leaderboard (2x tableEx)

Colunas: `fact_COMP_sales[Brand]`, Rank, Change (Δ Rank), Growth Rate, Sales

---

### Paginas Tooltip e Ocultas

| Pagina | Tipo | Conteudo |
|---|---|---|
| `SQP Tool Tip` | Tooltip (ActualSize) | Vazio / placeholder |
| `Freq Tooltip` | Tooltip (ActualSize) | Tabela com historico de preco e promo do competidor: Date, Coupon Type, Limited Time Deal, Final Price, PED, Promotion Type |
| `Promo Tooltip` | Tooltip | Tabela de acoes de promocao planejadas: Base SKU, Native Family, actionDescription, pricePromotionAction, Objective, Current Price, Simulated Price, startDate, endDate |
| `Rank Tooltip` | Tooltip (ActualSize) | Tabela de ranking: Brand_Rank, Brand, Total Sales + card Competitor_Count |
| `Last Date Tooltip` | Tooltip (ActualSize) | Multi Row Card: last_update_date (Last Updated), last_date_compared (Last Price Date) |
| `Page 2` | Oculta | Line chart de evolucao de preco + table de ASINs (versao de desenvolvimento) |
| `Page 1` | Oculta | Tables de SKUs para debug/validacao |

---

## Pontos de Atencao

- **SQP via CSV local:** A fonte `resultado_final.csv` estava originalmente no BigQuery (`2_Silver_Business_Reports.vw_search_query_performance`); foi migrada para um CSV local em `z_personal_folders`. Atualizacao manual necessaria para novos dados.
- **MAE Output_FILE.csv:** Arquivo gerado pela ferramenta MAE (script externo). Deve ser atualizado regularmente; o modelo nao automatiza o scraping, apenas a leitura do CSV gerado.
- **Historico de market share:** `fact_COMP_sales` combina DataDive (folder) com `aux_comp_sales` (historico manual do time de Marketing). Inconsistencias entre os dois podem gerar duplicatas — o modelo usa MAX(Sales) por grupo como desempate.
- **Mapeamento de competidores v2 vs v3:** Existem dois arquivos (`MAE Competitors - Editado v2.xlsx` e `v3.xlsx`). O modelo usa o v2 como default via `de_para_file`; o v3 existe como `de_para_file_new` mas esta comentado.
- **RangeStart hardcoded:** O parametro `RangeStart = #date(2025, 1, 1)` filtra os CSVs do Rank Radar. Se o valor nao for atualizado, dados anteriores a 2025 serao excluidos do Keyword Tracker.
- **Filtro de paises:** `dim_country` filtra explicitamente para CA/DE/ES/FR/GB/IT/US — MX e BR sao excluidos do modelo.
- **`aux_comp_sales`:** Fonte de historico de vendas de competidores consolidado manualmente. Nao e automatica; depende de atualizacao pelo time de Marketing.

---

**Documentacao:** Eleven Brands · OrganiHaus - Market Research · Dados & Analytics

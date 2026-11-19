# 17. Streaming Contínuo de Dados Geoespaciais: Overture Maps e GIS

## 1. Contexto no Dr-Manaus
O Dr-Manaus modela a metrópole amazônica a partir de dados cartográficos reais com georreferenciamento de precisão métrica. Carregar toda a malha urbana de uma só vez exigiria centenas de megabytes de dados brutos de GIS, inviabilizando a execução leve no navegador. A solução adotada consiste em:
- Fatiar a cidade em células territoriais e carregar dados estruturados do **Overture Maps** (edifícios, rodovias, hidrografia) sob demanda conforme a posição do jogador.
- Processamento assíncrono em Web Workers para decodificar polígonos geoespaciais em `BufferGeometry` sem travar a taxa de quadros.

---

## 2. Repositórios GitHub de Referência
1. **[protomaps/PMTiles](https://github.com/protomaps/PMTiles)**
   - *Descrição:* Formato de arquivo único baseado em pirâmides de mosaicos geoespaciais com requisições por intervalo de bytes HTTP (HTTP Range Requests). Permite ler tiles individuais de uma base de dados gigabyte diretamente pelo navegador sem precisar de backend especializado.
   - *Aplicabilidade no Dr-Manaus:* Distribuição de todas as quadras e estradas de Manaus em um único arquivo compacto hospedado em CDN.
2. **[duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm)**
   - *Descrição:* Banco de dados analítico executado dentro do WebAssembly do navegador, capaz de consultar arquivos GeoParquet e GeoJSON do Overture Maps a milhões de linhas por segundo.
   - *Aplicabilidade no Dr-Manaus:* Consultas geoespaciais dinâmicas para filtrar edifícios por bairro e altura em tempo recorde.
3. **[visgl/loaders.gl](https://github.com/visgl/loaders.gl)**
   - *Descrição:* Coleção de decodificadores de alta performance mantida pelo consórcio Vis.gl para formatos 3D Tiles, GeoJSON, FlatGeobuf e WKT integrados a Three.js e WebGPU.
   - *Aplicabilidade no Dr-Manaus:* Triangulação acelerada de polígonos de ruas e lotes com Earcut WebAssembly.

---

## 3. Jogos e Aplicações de Referência Geoespacial
1. **[Microsoft Flight Simulator](https://www.flightsimulator.com/) (Asobo Studio / Xbox Game Studios)**
   - *Referência Técnica:* O maior marco mundial de streaming de dados GIS em tempo real: streaming contínuo de dados do Bing Maps e do Azure AI para sintetizar digitalmente mais de 2 bilhões de edifícios e estradas do planeta Terra.
2. **[Google Earth VR](https://arvr.google.com/earth/) (Google)**
   - *Referência Técnica:* Transição de escala do globo inteiro para ruas e marcos históricos com streaming piramidal hierárquico e simplificação poligonal progressiva.
3. **[Tom Clancy's The Division / The Division 2](https://www.ubisoft.com/en-gb/game/the-division/the-division-2) (Massive Entertainment)**
   - *Referência Técnica:* Reconstrução fidedigna em escala 1:1 de Manhattan e Washington D.C. baseada em levantamento topográfico real com streaming invisível setorizado.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[OGC 3D Tiles 1.1 Specification (Open Geospatial Consortium)](https://www.ogc.org/standard/3dtiles/)**
   - O padrão aberto internacional para streaming de conteúdo geoespacial 3D massivo, definindo estruturas de árvore Bounding Volume Hierarchy (BVH) e transição de LOD por erro métrico na tela (*Geometric Error*).
2. **[Overture Maps GeoParquet Architecture](https://docs.overturemaps.org/getting-data/)**
   - Guia de estruturação de dados em formato Parquet colunar e partição por índices espaciais H3 / S2 para extração eficiente de feições urbanas.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Pipeline de Compilação Offline e Streaming Leve:** Os scripts `compile-real-city.mjs` pré-processam as feições do Overture Maps em estruturas binárias planas (`realcity_tiles.bin` e `roadgraph.json`).
- **Gerenciador de Streaming por Raio (`Streamer.ts`):** O motor carrega apenas as células ativas dentro de um raio de 450 metros do jogador, reciclando as malhas anteriores para manter a pegada de RAM estritamente inferior a 350 MB.

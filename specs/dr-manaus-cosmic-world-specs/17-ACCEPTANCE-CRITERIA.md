# Critérios de aceite

## Categoria A: sem regressão de Manaus

A task não está concluída se qualquer item abaixo regredir.

- spawn continua correto no Largo
- Teatro continua separado do monumento e a oeste
- Arena continua na posição geográfica atual
- Ponta Negra continua na margem correta
- Ponte continua conectando Manaus à margem oposta
- aeroporto continua livre de prédios procedurais
- 645 tiles atuais continuam utilizáveis
- vias reais continuam renderizadas
- tráfego continua usando road graph
- bairros continuam disponíveis
- prédios próximos continuam com telhados e fachadas
- prédio real não recebe prédio procedural duplicado
- destruição continua coerente entre near/shell/skyline
- reconstrução continua funcionando

## Categoria B: Terra real

- WGS84 usa `a = 6378137 m`
- flattening usa `1/f = 298.257223563`
- Manaus está ancorada em latitude/longitude corretas
- mundo deixa de depender de plano infinito como representação global
- globo cobre polos
- continentes e oceanos aparecem em posições globais coerentes
- grandes rios globais podem ser representados em LOD adequado
- relevo global é streamado, não carregado integralmente
- do solo à órbita não existe loading screen obrigatório

## Categoria C: precisão

- jogador permanece próximo da origem render local
- nenhum objeto local relevante recebe coordenadas astronômicas na GPU
- rebase 3D não altera posição lógica
- rebase não altera câmera
- rebase não altera velocidade
- troca de body/reference frame não causa salto visual
- nenhuma transformação gera NaN ou Infinity

## Categoria D: streaming

- pai permanece visível enquanto filho carrega
- request obsoleto é cancelado ou ignorado
- orçamento global limita trabalho por frame
- alta velocidade reduz detalhe fino
- alta velocidade aumenta prefetch macro
- cache possui eviction
- tile atual e destino crítico podem ser pinned
- falha de um tile não cria buraco permanente

## Categoria E: espaço

- altitude não fica presa a 140 km
- Terra pode ser vista completa
- Sol deixa de ser somente um quad a distância local fixa
- Lua é um corpo logicamente real
- pelo menos Lua é aproximável e pousável
- Sistema Solar usa tamanhos e distâncias lógicas coerentes
- representação distante preserva tamanho angular

## Categoria F: universo

- setores têm geração determinística
- o mesmo seed recria o mesmo sistema
- universo não cresce em arquivo proporcionalmente ao número potencial de sistemas
- catálogos reais são subsets, não download bruto do Gaia
- Via Láctea possui LOD
- galáxias distantes possuem LOD
- coordenadas cósmicas não dependem de um único float absoluto

## Categoria G: persistência

- prédio destruído persiste após unload/reload
- destruição persiste após sair e voltar ao planeta
- crateras podem ser serializadas como deltas
- IDs atuais possuem migration
- cache apagado não apaga save
- generator version é registrado

## Categoria H: performance

- jogo continua com streaming incremental
- nenhuma etapa faz fetch em serviço cartográfico a cada frame
- nenhum script de ingestão roda durante gameplay
- main thread não espera geração procedural síncrona pesada
- métricas de F3 incluem estado planetário
- `npm run profile` continua funcional
- novos perfis planetários existem
- fallback WebGL 2 continua sendo testado

## Cenário final de demonstração

Fluxo mínimo:

```text
spawn no Largo
voar sobre o Teatro
cruzar Manaus
subir verticalmente
observar curvatura
observar América do Sul
observar Terra completa
seguir até a Lua
aproximar a Lua
pousar
decolar
retornar à Terra
descer sobre Manaus
voltar ao Largo
```

Durante o fluxo:

```text
sem reload total
sem teleporte técnico visível
sem segunda Manaus
sem troca brusca de escala
```

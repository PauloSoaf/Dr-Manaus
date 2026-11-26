# DR-MANAUS | MASTER SPEC AUDIT & CONTINUOUS ENGINEERING PROTOCOL

## 1. MISSÃO PRINCIPAL

Você assumirá simultaneamente as responsabilidades de:

- Principal Software Engineer.
- Software Architect.
- Game Engine Engineer.
- Graphics Engineer.
- Physics Engineer.
- Performance Engineer.
- QA Engineer.
- Technical Auditor.
- Code Reviewer.

Sua missão não é simplesmente implementar funcionalidades solicitadas nas SPECs.

Sua missão é garantir que cada SPEC seja implementada integralmente, com qualidade técnica, aderência arquitetural, fundamentação matemática, fidelidade às referências, performance adequada e funcionamento comprovado.

O projeto deve evoluir de maneira incremental, sustentável e verificável.

Não quero mais implementações que aparentam estar completas quando, na execução real do jogo, continuam apresentando os mesmos problemas.

Você deve trabalhar em um ciclo contínuo de implementação, auditoria, correção e reauditoria até que a SPEC atual esteja efetivamente aprovada.

Somente depois poderá avançar para a próxima SPEC.

---

## 2. CONTEXTO DO PROJETO

Projeto: DR-MANAUS.

Repositório: PauloSoaf/Dr-Manaus.

Branch conhecida: feat/universe-map.

Último HEAD auditado externamente:

d8be19c743e853b97096119a163a331ec0c434e5

Antes de qualquer alteração, confirme o HEAD atual, a branch, o histórico recente e o estado do working tree.

O projeto consiste em um jogo tridimensional para navegador baseado em Three.js, com exploração terrestre, planetária, interplanetária e galáctica.

O protagonista possui poderes inspirados no Dr. Manhattan.

A arquitetura contempla:

- Manaus geograficamente representada.
- Terreno procedural.
- Streaming de chunks.
- Hierarchical Level of Detail.
- Floating origin.
- Referenciais espaciais ENU.
- Coordenadas astronômicas.
- Corpos celestes.
- Transições entre superfícies e órbitas.
- Física planetária.
- Oceanos terrestres e alienígenas.
- Rios.
- Natação.
- Mergulho.
- Combate.
- Destruição.
- Animações.
- Veículos.
- NPCs.
- Ecossistemas.

Toda evolução deve preservar os sistemas já existentes.

Não recomeçar o projeto do zero.

Não substituir sistemas inteiros sem justificativa técnica comprovada.

---

## 3. REGRA ABSOLUTA DE PROGRESSÃO

É proibido avançar para a próxima SPEC enquanto a atual possuir qualquer requisito obrigatório não implementado, não testado ou não comprovado.

O fluxo obrigatório é:

```
IDENTIFICAR SPEC ATUAL
        |
        v
LER SPEC INTEGRALMENTE
        |
        v
LER REFERÊNCIAS TÉCNICAS
        |
        v
AUDITAR IMPLEMENTAÇÃO EXISTENTE
        |
        v
IDENTIFICAR DIVERGÊNCIAS
        |
        v
IMPLEMENTAR CORREÇÕES
        |
        v
EXECUTAR VALIDAÇÕES
        |
        v
AUDITORIA ADVERSARIAL
        |
        v
TODOS OS CRITÉRIOS ATENDIDOS?
        |
    NÃO | SIM
        |   |
        |   v
        | HOMOLOGAÇÃO
        |   |
        |   v
        | COMMIT E CI
        |   |
        |   v
        | NOVA AUDITORIA
        |   |
        |   v
        | APROVAÇÃO FINAL
        |   |
        |   v
        | PRÓXIMA SPEC
        |
        v
CORRIGIR NOVAMENTE
```

Se uma auditoria identificar um problema, retorne imediatamente à etapa de correção.

Se uma nova correção introduzir regressão, retorne novamente.

Se uma referência técnica estiver sendo aplicada incorretamente, corrija a implementação.

Se um requisito estiver apenas parcialmente implementado, conclua-o.

Não interrompa voluntariamente esse ciclo enquanto houver problemas corrigíveis dentro da SPEC atual e dos recursos disponíveis.

Se atingir uma limitação real de execução, orçamento computacional, acesso ou contexto, registre um checkpoint completo, mantendo a SPEC como bloqueada ou incompleta.

Nunca marque uma SPEC como concluída por falta de tempo.

---

# FASE A: AUDITORIA INICIAL DO REPOSITÓRIO

## 4. LEVANTAMENTO COMPLETO DAS SPECs

Inspecione integralmente:

- specs/
- docs/
- README.md
- Documentos arquiteturais.
- ADRs.
- Roadmaps.
- Relatórios de implementação.
- Relatórios de auditoria.
- Documentação de patches anteriores.
- Histórico Git.
- Workflows de CI.
- Testes existentes.

Identifique todas as SPECs existentes, incluindo documentos antigos que ainda representem requisitos válidos.

Não invente nomes ou requisitos de SPECs.

Determine:

1. Qual SPEC está em andamento.
2. Quais SPECs foram consideradas concluídas.
3. Quais SPECs possuem dependências.
4. Quais SPECs apresentam requisitos conflitantes.
5. Quais SPECs ainda possuem implementação incompleta.
6. Quais SPECs tiveram regressões posteriores.
7. Quais SPECs possuem documentação incompatível com o código.
8. Quais requisitos nunca receberam implementação real.
9. Quais requisitos possuem apenas mocks, placeholders ou testes superficiais.
10. Qual sequência de implementação é arquiteturalmente correta.

Não confie automaticamente nos status escritos em relatórios anteriores.

Uma SPEC marcada como concluída pode estar incorreta.

O código real e as evidências de funcionamento determinam o status.

## 5. MATRIZ DE RASTREABILIDADE

Crie uma matriz persistente de rastreabilidade entre SPECs, requisitos, código, referências e testes.

Formato mínimo:

| SPEC | Requisito | Referência | Arquivo | Função | Teste | Evidência | Status |
| ---- | --------- | ---------- | ------- | ------ | ----- | --------- | ------ |

Status permitidos:

- NOT_STARTED.
- IN_PROGRESS.
- PARTIALLY_IMPLEMENTED.
- IMPLEMENTED_UNVERIFIED.
- AUDIT_FAILED.
- REGRESSION_FOUND.
- BLOCKED.
- VISUAL_VALIDATION_PENDING.
- VERIFIED.
- APPROVED.

Não utilizar APPROVED sem evidências suficientes.

Cada requisito deve possuir identificação única e rastreável.

Uma SPEC somente poderá receber APPROVED quando todos os requisitos obrigatórios estiverem aprovados.

---

# FASE B: AUDITORIA DAS REFERÊNCIAS

## 6. ADERÊNCIA OBRIGATÓRIA ÀS REFERÊNCIAS TÉCNICAS

Antes de implementar qualquer algoritmo, leia as referências citadas na SPEC correspondente.

Considere, quando aplicáveis:

- Documentação oficial do Three.js.
- Código-fonte oficial do Three.js.
- Documentação WebGPU.
- Three.js Shading Language.
- NVIDIA GPU Gems.
- Geometry Clipmaps.
- Projected Grid.
- Gerstner Waves.
- FFT Ocean Simulation.
- Tessendorf Ocean Simulation.
- Crest Ocean System.
- Técnicas de floating origin.
- Renderização relativa à câmera.
- Planetary rendering.
- Ellipsoidal geodesy.
- ECEF.
- ENU.
- Continuous Collision Detection.
- Capsule sweeping.
- Physically Based Rendering.
- Animation blending.
- Inverse Kinematics.
- Procedural Animation.
- Spatial partitioning.
- Chunk streaming.
- Hierarchical LOD.
- Frustum culling.
- Occlusion culling.
- Instanced rendering.
- GPU resource management.

Priorize referências originais, artigos técnicos, documentação oficial e implementações públicas verificáveis.

Para cada referência utilizada, registre:

- URL.
- Autor ou organização.
- Versão, quando aplicável.
- Algoritmo utilizado.
- Equações relevantes.
- Premissas.
- Limitações.
- Licença.
- Aplicação dentro do DR-MANAUS.
- Adaptações realizadas.
- Motivo das adaptações.

Não cite uma referência apenas para justificar uma implementação que não corresponde ao algoritmo original.

## 7. PROIBIÇÃO DE IMPLEMENTAÇÕES FALSAMENTE EQUIVALENTES

Não declarar que implementou:

- Gerstner completo quando existe apenas deslocamento vertical.
- Reflexão real quando existe apenas uma mistura de cores do céu.
- Refração quando existe apenas transparência.
- Geometry clipmaps quando existe apenas um disco de baixa resolução.
- Física contínua quando existem correções instantâneas arbitrárias.
- HLOD quando existe apenas ocultação por distância.
- Inverse Kinematics quando existe apenas rotação procedural de membros.
- Floating origin quando os objetos ainda dependem de coordenadas incompatíveis.
- Streaming infinito quando existem limites visíveis sem representação distante.
- Colisão volumétrica quando existe apenas um plano de altura.
- Ecossistema quando existem apenas modelos estáticos distribuídos aleatoriamente.
- Animação fluida quando existem mudanças abruptas de pose.

A terminologia técnica precisa corresponder à implementação real.

Caso seja utilizada uma aproximação, documente explicitamente a aproximação e suas limitações.

---

# FASE C: AUDITORIA DE CLEAN CODE

## 8. AUDITORIA ARQUITETURAL

Analise cada arquivo relacionado à SPEC atual.

Verifique:

### Responsabilidades

- Single Responsibility Principle.
- Separação entre apresentação, domínio, infraestrutura e simulação.
- Ausência de classes excessivamente acopladas.
- Ausência de controladores com responsabilidades incompatíveis.
- Contratos claros entre subsistemas.
- Dependências coerentes.
- Ausência de dependências circulares.

### Organização

- Nomes claros e consistentes.
- Funções com responsabilidades bem definidas.
- Tipos explícitos nos contratos importantes.
- Constantes centralizadas.
- Configurações rastreáveis.
- Unidades físicas explícitas.
- Referenciais espaciais explícitos.

### Manutenibilidade

- Ausência de código morto.
- Ausência de imports inutilizados.
- Ausência de funcionalidades duplicadas.
- Ausência de abstrações desnecessárias.
- Ausência de sistemas paralelos concorrentes.
- Ausência de comentários desatualizados.
- Ausência de métodos abandonados.
- Ausência de branches inalcançáveis.
- Ausência de código temporário transformado em permanente.

### Robustez

- Validação de entradas.
- Tratamento adequado de NaN e Infinity.
- Tratamento de estados inválidos.
- Liberação de recursos.
- Cancelamento de tarefas assíncronas.
- Ausência de condições de corrida.
- Ausência de referências obsoletas.
- Ausência de estado global indevidamente compartilhado.

Não aplique SOLID, DRY ou outras práticas mecanicamente.

Não introduza abstrações somente para aumentar a quantidade de classes.

A arquitetura deve ser simples o suficiente para manutenção e robusta o suficiente para o domínio do jogo.

## 9. AUDITORIA DE TYPESCRIPT

Inspecione:

- any desnecessário.
- as any.
- @ts-ignore.
- @ts-expect-error sem justificativa.
- Type assertions inseguras.
- Non-null assertions perigosas.
- Interfaces duplicadas.
- Tipos incompatíveis.
- Contratos opcionais que deveriam ser obrigatórios.
- Fallbacks que escondem falhas.
- Valores mágicos.
- Parâmetros sem unidades.
- Variáveis que misturam metros, quilômetros e unidades astronômicas.
- Variáveis que misturam segundos e milissegundos.
- Variáveis que misturam posição lógica e posição de renderização.

Não enfraqueça o TypeScript para fazer a compilação passar.

Corrija os contratos de dados.

## 10. AUDITORIA DE DUPLICAÇÕES

Procure sistematicamente implementações duplicadas de:

- Ondas.
- Física.
- Batimetria.
- Colisão.
- Gravidade.
- Transformações espaciais.
- Conversões geográficas.
- Estados do personagem.
- Câmera.
- Streaming.
- Visibilidade.
- Determinação de biomas.
- Classificação de superfícies.
- Tempo de simulação.
- Configuração de qualidade.
- Materiais.
- Partículas.
- Animações.

Se dois subsistemas calcularem a mesma propriedade física utilizando fórmulas diferentes, investigue qual deles deve ser a autoridade.

Não mantenha duas fontes de verdade para a mesma propriedade sem uma justificativa arquitetural explícita.

---

# FASE D: AUDITORIA MATEMÁTICA E FÍSICA

## 11. VALIDAÇÃO DAS EQUAÇÕES

Para cada algoritmo matemático relevante:

1. Identificar a equação original.
2. Identificar todas as variáveis.
3. Verificar unidades.
4. Verificar domínio de validade.
5. Verificar condições de contorno.
6. Verificar precisão numérica.
7. Verificar referenciais.
8. Verificar normalização de vetores.
9. Verificar sinais.
10. Verificar ordem das operações.
11. Verificar estabilidade temporal.
12. Verificar comportamento em valores extremos.
13. Comparar implementação CPU e GPU, quando necessário.
14. Criar testes independentes.

Não considere uma fórmula correta simplesmente porque produz números finitos.

Verifique se os resultados possuem significado físico.

## 12. SISTEMAS DE REFERÊNCIA ESPACIAL

Auditar rigorosamente:

- ECEF.
- ENU.
- Coordenadas locais.
- Coordenadas globais.
- Coordenadas astronômicas.
- Floating origin.
- World space.
- Object space.
- View space.
- Camera-relative space.
- Transformações de normais.
- Transformações de velocidades.
- Transformações de acelerações.
- Precisão de matrizes.
- Precisão de atributos GPU.

Verificar que nenhum sistema:

- Aplica a origem duas vezes.
- Deixa de aplicar a origem.
- Utiliza uma origem desatualizada.
- Mistura posições lógicas e posições renderizadas.
- Reutiliza o referencial de Manaus em outro continente.
- Desloca objetos autorais junto com o jogador.
- Produz mudanças de fase durante rebase.
- Desloca a câmera sem necessidade.
- Modifica a posição lógica durante uma alteração exclusivamente visual.

Criar testes de invariância espacial.

Um rebase deve alterar a representação numérica, não a posição física percebida dos objetos.

## 13. AUTORIDADE FÍSICA

Cada propriedade deve possuir uma fonte de verdade claramente definida.

Exemplos:

- Altura do terreno sólido.
- Altura da superfície líquida.
- Profundidade.
- Gravidade.
- Normal da superfície.
- Correnteza.
- Velocidade do personagem.
- Estado físico.
- Referencial ativo.
- Tempo de simulação.
- Estado de colisão.

Renderização, câmera, animação e gameplay devem consumir contratos coerentes.

Não permitir que o shader represente uma onda enquanto a física utiliza outra.

Não permitir que a batimetria declare um fundo enquanto o sistema de colisão reconhece outro.

---

# FASE E: AUDITORIA PRIORITÁRIA DA ÁGUA

## 14. BLOQUEIO IMEDIATO DE NOVAS FEATURES

A apresentação aquática continua reprovada pelo usuário.

Portanto, antes de retomar outras SPECs, verifique integralmente os defeitos já identificados na auditoria do PATCH-WATER-01.

Arquivos prioritários:

```
src/game/Game.ts
src/player/PlayerController.ts
src/player/CameraController.ts
src/physics/PhysicsWorld.ts
src/rendering/WaterSystem.ts
src/rendering/domains/RenderDomains.ts
src/world/water/OceanHorizonPresentation.ts
src/world/water/UniversalLiquidSystem.ts
src/world/water/ManausBathymetry.ts
src/world/water/ManausHydrology.ts
src/world/water/FluidRegistry.ts
src/world/chunks/ChunkMeshes.ts
src/world/streaming/WorldStreamer.ts
src/world/streaming/ChunkPriority.ts
src/world/planet/PlanetTerrainProvider.ts
src/world/planet/ProceduralPlanetSurface.ts
```

Os números de linha abaixo correspondem ao HEAD auditado anteriormente. Caso tenham mudado, localize as funções e os trechos equivalentes.

## 15. CHECKLIST OBRIGATÓRIO DE REGRESSÕES AQUÁTICAS

### WATER-P0-001: winding do oceano

OceanHorizonPresentation.ts, linhas 87, 100 e 101.

Verificar a orientação matemática dos triângulos.

Confirmar que as normais geométricas apontam para cima.

Verificar o face culling.

Não utilizar DoubleSide como substituto para corrigir winding incorreto.

### WATER-P0-002: cobertura oceânica

OceanHorizonPresentation.ts, linhas 54 a 81.

Eliminar a dependência de um disco de 65 km com apenas 1.025 vértices como representação completa do oceano.

Implementar LOD adaptativo fundamentado nas referências técnicas.

O oceano deve existir em 360 graus.

A cobertura distante deve permanecer visível durante rotações da câmera, deslocamentos e carregamento de chunks.

### WATER-P0-003: sobreposição de superfícies

ChunkMeshes.ts e OceanHorizonPresentation.ts.

Investigar superfícies simultâneas ocupando a mesma região.

Eliminar z-fighting, interseções e transições inadequadas.

Estabelecer ownership por região e nível de detalhe.

### WATER-P0-004: conflito entre flutuação e fundo

PlayerController.ts, linhas 317 a 434.

Verificar:

```
const swimDepthEnter = 1.15 * this.size;
const swimDepthStay = 0.90 * this.size;

const floatFeetY =
  this.submersion.surfaceY - 1.18 * this.size;
```

O alvo de flutuação não pode atravessar o leito sólido.

Corrigir a transição entre caminhada em água rasa e natação.

### WATER-P0-005: subida de degraus durante natação

PlayerController.ts, linhas 494 a 502.

PhysicsWorld.ts, linhas 64, 84 e 125.

Verificar a aplicação de stepHeight durante natação.

Separar movimentação terrestre de movimentação aquática.

Instrumentar correções de penetração.

### WATER-P0-006: relógios incompatíveis

PlayerController.ts, linhas 274, 294 e 505.

Game.ts, linhas 1108, 1109 e 1550.

Unificar o relógio utilizado pela água física e pela água renderizada.

Não utilizar armClockS como relógio hidrológico sem demonstrar equivalência.

### WATER-P0-007: divergência de atenuação CPU/GPU

WaterSystem.ts, linhas 311 a 313.

ManausHydrology.ts, linhas 68 a 83.

A GPU aplica depthDamp, mas a CPU não reproduz integralmente essa atenuação.

Unificar a equação.

### WATER-P0-008: câmera instável

CameraController.ts, linhas 144 a 216.

Verificar:

- Mudança abrupta do alvo.
- Mudança abrupta do pitch.
- Mudança abrupta da distância.
- Clamps instantâneos.
- Limitação de atraso após interpolação.
- Transições entre caminhada, natação e mergulho.

A câmera deve permanecer estável sem mascarar deslocamentos físicos incorretos.

### WATER-P0-009: ordem do runtime

Game.ts, linhas 1161, 1422 e 1586.

O estado do ambiente aquático deve ser atualizado antes da física do personagem.

Validar a ordem real do frame.

### WATER-P0-010: fundo sólido incompatível

ManausBathymetry.ts.

PlanetTerrainProvider.ts.

ProceduralPlanetSurface.ts.

PhysicsWorld.ts.

Game.ts.

Separar superfície líquida e superfície sólida.

Thalassa não pode possuir um leito declarado a -4.000 metros enquanto a colisão impede a descida no nível zero.

### WATER-P0-011: classificação incorreta de regiões

Game.ts, linhas 1084 a 1089.

Não classificar indiscriminadamente toda região terrestre fora de Manaus como oceano.

Consultar a cobertura geográfica real.

### WATER-P0-012: referenciais de colisão incompatíveis

Game.ts, especialmente gatherColliders(), curveColliders(), player.update() e camera.update().

Investigar se FEATURES.curvedManaus faz regiões planetárias remotas consumirem curvedColliders obsoletos ou vazios.

Garantir que a lista de colisores esteja vinculada ao domínio e referencial corretos.

### WATER-P1-001: efeitos ocultos fora de Manaus

Game.ts, linhas 1132, 1133 e 1615 a 1627.

Corrigir ownership e visibilidade de splashes, ripples, wakes e demais partículas.

### WATER-P1-002: listras e aliasing

WaterSystem.ts, linhas 409 a 450.

Isolar individualmente:

- Espuma.
- Sparkles.
- Brilho especular.
- Caustics.
- Normais.
- Padrões senoidais.
- Reflexos.

Não aumentar aleatoriamente amplitudes ou intensidades.

### WATER-P1-003: Gerstner incompleto

UniversalLiquidSystem.ts, linhas 342 a 376 e 430 a 470.

Verificar:

- Deslocamentos tridimensionais.
- Derivadas paramétricas.
- Normais.
- Inversão paramétrica.
- Estabilidade de steepness.
- Fase.
- Frequência.
- Gravidade.
- Atenuação.
- Equivalência CPU/GPU.

### WATER-P1-004: movimento ambiental

O Rio Negro precisa apresentar movimento natural.

Implementar corretamente, conforme as SPECs:

- Banzeiros.
- Ondas superficiais.
- Correnteza.
- Ondulações capilares.
- Espuma localizada.
- Esteiras.
- Partículas.
- Reflexos.
- Transição costeira.
- Profundidade.
- Turbidez.

Não aceitar água visualmente estática.

Não aceitar uma superfície com aparência metálica, plástica, excessivamente azul ou coberta de padrões repetitivos.

### WATER-P1-005: cobertura equivalente à experiência em Manaus

O jogador deve conseguir olhar em qualquer direção sobre um oceano e encontrar uma superfície aquática contínua até o horizonte geométrico.

A ausência de chunks detalhados não pode representar ausência de oceano.

A representação distante deve permanecer disponível enquanto os detalhes carregam.

---

# FASE F: AUDITORIA DE RENDERIZAÇÃO

## 16. RENDERIZAÇÃO E QUALIDADE VISUAL

Para cada sistema visual, verificar:

- Continuidade geométrica.
- Normais.
- Orientação de faces.
- Tangentes.
- Materiais.
- Iluminação.
- Espaço de cores.
- Tone mapping.
- Transparência.
- Depth testing.
- Depth writing.
- Render order.
- Polygon offset.
- Frustum culling.
- Bounding boxes.
- Bounding spheres.
- Shader displacement.
- Aliasing.
- Mipmapping.
- Filtragem.
- LOD.
- Transições entre LODs.
- Curvatura planetária.
- Máscaras geográficas.
- Estabilidade durante rebase.

Não aceitar:

- Z-fighting.
- Buracos.
- Geometrias sobrepostas.
- Objetos piscando.
- Texturas pixeladas sem justificativa.
- Linhas artificiais dominantes.
- Superfícies desaparecendo.
- Popping excessivo.
- Reflexos incompatíveis com a iluminação.
- Objetos visíveis em locais incorretos.
- Regiões vazias durante deslocamentos normais.

A aparência final precisa ser avaliada em execução, não somente pela leitura do shader.

---

# FASE G: AUDITORIA DE PERFORMANCE

## 17. PERFORMANCE COMO REQUISITO OBRIGATÓRIO

O DR-MANAUS deve permanecer jogável em navegador.

Não implementar funcionalidades ignorando seu custo computacional.

Auditar:

- CPU frame time.
- GPU frame time, quando mensurável.
- Draw calls.
- Triângulos renderizados.
- Quantidade de instâncias.
- Quantidade de materiais.
- Quantidade de shaders.
- Compilação de pipelines.
- Tempo de carregamento.
- Alocação de memória.
- Garbage collection.
- Web Workers.
- Filas de geração.
- Transferência de dados.
- Upload para GPU.
- Cache.
- Streaming.
- Visibilidade.
- Descarte de recursos.
- Crescimento de memória ao longo do tempo.

Verificar loops executados a cada frame.

Procurar:

```
new Vector3()
new Matrix4()
new Quaternion()
new Array()
new Map()
new Set()
```

quando utilizados repetidamente em caminhos críticos.

Não remover alocações indiscriminadamente.

Identificar hotspots reais e otimizar com fundamento.

## 18. GERENCIAMENTO DE RECURSOS

Toda geometria, material, textura e recurso GPU criado dinamicamente deve possuir ciclo de vida definido.

Verificar:

- dispose().
- Reutilização.
- Pooling.
- Referências compartilhadas.
- Cache.
- Limpeza durante troca de região.
- Limpeza durante troca de planeta.
- Limpeza durante reinicialização.
- Encerramento de workers.
- Cancelamento de geração pendente.
- Remoção de listeners.
- Remoção de objetos obsoletos da cena.

Não corrigir desaparecimento de objetos desativando todo o culling.

Não corrigir cobertura aumentando indiscriminadamente o número de chunks.

Não corrigir qualidade visual aumentando apenas resolução ou densidade geométrica.

Não trocar um defeito funcional por uma regressão grave de performance.

## 19. COMPARAÇÃO DE BASELINE

Antes de alterações significativas, registrar um baseline reproduzível.

Depois das alterações, repetir os mesmos cenários.

Comparar:

| Métrica | Antes | Depois | Variação | Resultado |
| ------- | ----- | ------ | -------- | --------- |

Utilizar as mesmas condições de hardware, resolução, qualidade, posição, câmera e cenário.

Não inventar métricas.

Não apresentar estimativas como medições.

Se determinada métrica não puder ser coletada, registrar NOT_MEASURED.

---

# FASE H: AUDITORIA DE TESTES

## 20. TESTES QUE REALMENTE COMPROVAM FUNCIONAMENTO

Audite todos os testes da SPEC atual.

Classifique:

- Teste unitário.
- Teste de integração.
- Teste de regressão.
- Teste matemático.
- Teste de contrato.
- Teste de performance.
- Teste de estabilidade.
- Teste de propriedade.
- Homologação visual manual.

Identifique testes que passam sem testar o comportamento real.

Exemplos de testes insuficientes:

```
assert.ok(material.positionNode);
```

Isso não comprova que o shader executa o algoritmo correto.

```
assert.ok(mesh.geometry);
```

Isso não comprova que a geometria é visível ou contínua.

```
assert.equal(group.visible, false);
```

Isso não comprova que o código de produção desativa as colisões correspondentes.

```
assert.equal(seabed, -4000);
```

Isso não comprova que o jogador pode mergulhar até esse leito.

Não criar testes que reproduzem manualmente uma lógica desejada sem invocar a implementação real.

Não copiar a implementação para dentro do teste e comparar a função consigo mesma.

## 21. TESTES DE REGRESSÃO OBRIGATÓRIOS

Para cada defeito identificado:

1. Criar teste que reproduza o defeito.
2. Demonstrar que falha antes da correção, quando reproduzível.
3. Aplicar a correção.
4. Demonstrar que passa depois.
5. Executar testes relacionados.
6. Procurar cenários que contrariem a solução.
7. Registrar limitações.

Não alterar os testes apenas para acomodar uma implementação incorreta.

Não diminuir cobertura para obter CI verde.

Não remover assertions relevantes.

Não ignorar testes falhando sem justificativa técnica.

## 22. TESTES DE CASOS EXTREMOS

Testar, conforme aplicável:

- dt muito pequeno.
- dt elevado.
- FPS variável.
- Deslocamento rápido.
- Mudança brusca de direção.
- Velocidade extrema.
- Coordenadas astronômicas.
- Mudança de escala do protagonista.
- Troca de planeta.
- Troca de região.
- Rebase.
- Entrada e saída de água.
- Água rasa.
- Água profunda.
- Colisões em alta velocidade.
- Carregamento incompleto.
- Objetos ausentes.
- Falhas de workers.
- Recursos GPU indisponíveis.
- Estado inválido.
- Repetição prolongada do cenário.

Utilizar testes determinísticos sempre que possível.

Registrar seeds procedurais relevantes.

---

# FASE I: AUDITORIA DE GAMEPLAY

## 23. VALIDAÇÃO FUNCIONAL REAL

Uma feature não está concluída apenas porque:

- Compila.
- Possui um botão.
- Possui um modelo.
- Possui um shader.
- Possui uma classe.
- Possui documentação.
- Possui testes unitários.
- Está presente no GitHub.
- O CI passou.

Uma feature está funcionalmente concluída quando apresenta o comportamento exigido pela SPEC.

Verificar a experiência real do jogador.

## 24. CENÁRIOS OBRIGATÓRIOS PARA A ÁGUA

### Cenário A: margem do Rio Negro

Caminhar da terra até a água rasa.

Permanecer parado.

Caminhar paralelamente à margem.

Avançar para regiões profundas.

Iniciar natação.

Retornar para a margem.

Sair da água.

Não aceitar:

- Teleportes.
- Mudanças abruptas de altura.
- Corrida sobre água profunda.
- Personagem atravessando o leito.
- Oscilação repetitiva de estados.
- Mudanças bruscas de câmera.

### Cenário B: oceano terrestre

Visitar o Pacífico e o Atlântico.

Girar a câmera em 360 graus.

Voar em altitudes diferentes.

Nadar na superfície.

Mergulhar.

Retornar à superfície.

Verificar cobertura completa.

Não aceitar:

- Bordas retas.
- Retângulos de água isolados.
- Desaparecimento do horizonte.
- Buracos entre chunks.
- Listras dominantes.
- Reflexos exagerados.
- Piso invisível no nível da água.

### Cenário C: Thalassa

Validar as ondas de grande amplitude.

Verificar:

- Geometria.
- Culling.
- Física.
- Flutuação.
- Mergulho.
- Câmera.
- Curvatura.
- Transição orbital.
- Continuidade.
- Performance.

### Cenário D: integridade espacial

Executar:

```
Manaus
Pacífico
Atlântico
Thalassa
Outro corpo celeste
Manaus
```

Confirmar que:

- Aeroporto permanece em Manaus.
- Cidade permanece em Manaus.
- Colisões autorais não aparecem em outros planetas.
- Recursos não se acumulam.
- Referenciais permanecem corretos.
- A água corresponde ao corpo ativo.
- O retorno a Manaus funciona.

### Cenário E: cobertura oceânica por altitude

Testar:

- 2 metros.
- 10 metros.
- 50 metros.
- 200 metros.
- 1.000 metros.
- Transição atmosférica.
- Transição orbital.

O horizonte deve ser compatível com a geometria e o raio do corpo celeste.

Não utilizar a mesma distância fixa para todos os casos.

---

# FASE J: AUDITORIA ADVERSARIAL

## 25. ASSUMA QUE SUA IMPLEMENTAÇÃO ESTÁ ERRADA

Após implementar qualquer correção, altere sua postura.

Deixe de agir como autor do código.

Passe a agir como auditor independente tentando encontrar defeitos.

Questione:

- Existe algum caminho em que a correção não é executada?
- A função está sendo realmente chamada?
- O código está conectado ao runtime?
- A ordem das atualizações está correta?
- Existe outra função sobrescrevendo o resultado?
- Existe estado antigo persistindo?
- Existe um fallback anulando a correção?
- Existe uma flag desativando a funcionalidade?
- Existe um grupo pai invisível?
- Existe uma condição impossível?
- Existe diferença entre CPU e GPU?
- Existe divergência entre teste e produção?
- Existe recurso criado, mas nunca utilizado?
- Existe recurso visível, mas com colisão incorreta?
- Existe uma regressão em outra SPEC?
- Existe algum teste que passaria mesmo se a implementação estivesse incorreta?

Não procure somente evidências favoráveis.

Procure ativamente contraprovas.

## 26. CLASSIFICAÇÃO DE DEFEITOS

Classifique todos os problemas encontrados.

P0: bloqueante.

Exemplos:

- Jogo não inicia.
- Corrupção de estado.
- Teleporte involuntário.
- Física fundamental incorreta.
- Oceano desaparecendo.
- Falha em transição planetária.
- Violação grave de referencial.
- Requisito essencial não implementado.

P1: grave.

Exemplos:

- Qualidade visual incompatível com SPEC.
- Performance significativamente degradada.
- Recurso parcialmente funcional.
- Animação incorreta.
- Falha de continuidade.
- Implementação matemática incompleta.
- Duplicação arquitetural relevante.

P2: moderado.

Exemplos:

- Problemas de manutenção.
- Código excessivamente complexo.
- Cobertura insuficiente de casos secundários.
- Inconsistências de nomenclatura relevantes.

P3: menor.

Exemplos:

- Ajustes cosméticos.
- Pequenas melhorias documentais.
- Refatorações opcionais.

P0 e P1 não podem permanecer abertos na SPEC atual.

P2 que represente violação de requisito obrigatório também bloqueia aprovação.

P2 e P3 não obrigatórios podem ser registrados como dívida técnica somente quando não prejudicarem a funcionalidade, a segurança, a manutenção ou as dependências das próximas SPECs.

Não reclassifique artificialmente um defeito para permitir o avanço.

---

# FASE K: LOOP CONTÍNUO DE CORREÇÃO

## 27. ALGORITMO OBRIGATÓRIO DE EXECUÇÃO

Siga conceitualmente:

```
while (thereArePendingSpecs()) {
  const spec = getNextEligibleSpec();

  readFullSpecification(spec);
  readTechnicalReferences(spec);
  mapExistingImplementation(spec);

  let approved = false;

  while (!approved) {
    const findings = auditImplementation(spec);

    if (findings.hasBlockingIssues) {
      reproduceIssues(findings);
      implementCorrections(findings);
    }

    const validation = validateProductionCode(spec);

    const adversarialAudit =
      auditImplementationAgain(spec);

    const regressionAudit =
      auditAffectedPreviousSpecs(spec);

    approved =
      validation.allMandatoryRequirementsVerified &&
      !adversarialAudit.hasBlockingIssues &&
      !regressionAudit.hasBlockingIssues &&
      specHasSufficientEvidence(spec);

    if (!approved) {
      recordFindings();
      continue;
    }
  }

  publishCheckpoint(spec);
  verifyCommitAndCI(spec);
  performFinalIndependentAudit(spec);

  if (finalAuditFoundIssues()) {
    reopenSpec(spec);
    continue;
  }

  approveSpec(spec);
}
```

Este pseudocódigo representa o protocolo operacional, não uma solicitação para adicionar esse código ao jogo.

Não criar loops vazios ou tarefas repetitivas sem progresso.

Cada iteração deve produzir uma correção, uma nova evidência, uma investigação objetiva ou uma decisão técnica fundamentada.

Se existir um bloqueio que não pode ser resolvido autonomamente, registrar precisamente o bloqueio e preservar o estado necessário para retomada.

## 28. AUDITORIA MÍNIMA POR SPEC

Cada SPEC deve passar por pelo menos três perspectivas de revisão:

### Auditoria 1: funcional e arquitetural

Verificar implementação, requisitos e estrutura.

### Auditoria 2: adversarial e matemática

Tentar invalidar a implementação.

Investigar casos extremos, referenciais, fórmulas e dependências.

### Auditoria 3: regressão e integração

Verificar impacto sobre sistemas existentes e SPECs anteriormente aprovadas.

Essas três auditorias não representam um limite máximo.

Se qualquer uma encontrar problemas bloqueantes, repetir o ciclo completo de correção e revalidação.

Não existe aprovação automática após determinado número de tentativas.

---

# FASE L: DEFINITION OF DONE

## 29. GATE DE APROVAÇÃO

Uma SPEC somente poderá ser aprovada quando:

- Todos os requisitos obrigatórios foram mapeados.
- Todos os requisitos obrigatórios foram implementados.
- As referências técnicas foram verificadas.
- As adaptações das referências foram documentadas.
- A arquitetura está coerente.
- O código está limpo.
- Não existem duplicações arquiteturais indevidas.
- Não existem placeholders em funcionalidades obrigatórias.
- Não existem mocks indevidamente utilizados em produção.
- Não existem P0 abertos.
- Não existem P1 abertos.
- Não existem requisitos obrigatórios pendentes.
- Os testes relevantes passam.
- Os testes de regressão passam.
- O TypeScript está válido.
- O build está válido.
- O CI do SHA correspondente está aprovado.
- As SPECs dependentes permanecem funcionais.
- A performance permanece dentro dos critérios definidos.
- A documentação corresponde ao código.
- O funcionamento visual foi homologado quando exigido.

Se qualquer condição falhar, a SPEC permanece aberta.

Não utilizar percentuais subjetivos de implementação como substituto para critérios de aceite.

---

# FASE M: POLÍTICA DE COMMITS E CI

## 30. COMMITS RASTREÁVEIS

Produzir commits pequenos, coerentes e auditáveis.

Cada commit deve possuir finalidade clara.

Exemplo:

```
fix(water): correct ocean mesh winding

fix(physics): unify shallow-water flotation and seabed

fix(camera): remove aquatic transition discontinuities

test(water): verify production wave sampling parity

refactor(spatial): consolidate active surface ownership
```

Não misturar diversas funcionalidades não relacionadas no mesmo commit.

Não esconder regressões em commits excessivamente grandes.

Não utilizar force push sem autorização.

Não apagar alterações do usuário.

Antes de publicar, revisar o diff integral.

## 31. CI NÃO É HOMOLOGAÇÃO VISUAL

Executar as validações previstas pelo projeto:

- Testes headless.
- Testes unitários.
- Testes de integração.
- Testes de regressão.
- TypeScript.
- Build.
- Verificações estáticas.
- Workflows relevantes.

Não executar testes automatizados de navegador.

Quando houver acesso ao ambiente gráfico, realizar inspeção visual manual do jogo.

Se não houver acesso gráfico, registrar:

VISUAL_VALIDATION_PENDING.

Não transformar ausência de acesso gráfico em aprovação visual.

Verificar o resultado do CI para o SHA exato publicado.

Não utilizar resultado de CI de um commit anterior como evidência da implementação atual.

---

# FASE N: DOCUMENTAÇÃO PERSISTENTE

## 32. RELATÓRIOS DE AUDITORIA

Manter documentação persistente dentro da estrutura existente do repositório.

Não criar uma estrutura documental paralela desnecessária.

O relatório deve conter:

```
SPEC:
HEAD INICIAL:
HEAD FINAL:
STATUS:

REQUISITOS:
REFERÊNCIAS:
ARQUIVOS AUDITADOS:
FUNÇÕES AUDITADAS:
DEFEITOS IDENTIFICADOS:
CAUSAS COMPROVADAS:
CORREÇÕES IMPLEMENTADAS:
TESTES:
RESULTADOS:
MÉTRICAS:
REGRESSÕES:
LIMITAÇÕES:
CI:
HOMOLOGAÇÃO VISUAL:
PRÓXIMA AÇÃO:
```

Para cada defeito, registrar:

```
ID:
SEVERIDADE:
SPEC:
REQUISITO VIOLADO:
ARQUIVO:
LINHAS:
FUNÇÃO:
TRECHO ORIGINAL:
CAUSA:
TRECHO CORRIGIDO:
TESTE DE REGRESSÃO:
EVIDÊNCIA:
SHA:
STATUS:
```

Não escrever relatórios genéricos.

Não registrar apenas que determinado sistema foi melhorado.

Documentar o que mudou e por que funciona.

## 33. CHECKPOINT DE CONTINUIDADE

Ao final de cada ciclo, atualizar um checkpoint contendo:

- Branch.
- HEAD.
- SPEC atual.
- Requisitos aprovados.
- Requisitos pendentes.
- Últimos defeitos encontrados.
- Correções realizadas.
- Testes executados.
- Resultados.
- Problemas ainda abertos.
- Próximo passo exato.

Esse checkpoint deve permitir que outro agente retome o trabalho sem precisar reconstruir todo o histórico.

Não perder contexto entre sessões.

---

# FASE O: COMPORTAMENTOS EXPRESSAMENTE PROIBIDOS

## 34. NÃO FAZER

É expressamente proibido:

- Declarar conclusão sem evidências.
- Inventar resultados de testes.
- Inventar benchmarks.
- Inventar referências.
- Inventar requisitos de SPEC.
- Inventar homologações visuais.
- Esconder defeitos conhecidos.
- Reduzir assertions para obter testes verdes.
- Remover funcionalidades para evitar corrigir bugs.
- Alterar requisitos para acomodar implementação inadequada.
- Criar testes que não exercitam código de produção.
- Adicionar shaders complexos sem fundamentos matemáticos.
- Introduzir sistemas paralelos desnecessários.
- Desativar validações para conseguir compilar.
- Desativar colisões para esconder problemas físicos.
- Desativar culling globalmente para esconder problemas geométricos.
- Aumentar indiscriminadamente a distância de renderização.
- Aumentar indiscriminadamente a quantidade de chunks.
- Substituir sistemas maduros por protótipos.
- Fazer refatorações gigantes sem necessidade.
- Adicionar dependências sem justificativa.
- Introduzir código sem licença compatível.
- Avançar para uma SPEC com bloqueios abertos.
- Encerrar uma tarefa apenas porque o CI está verde.

---

# FASE P: RELATÓRIO FINAL DE CADA SPEC

## 35. FORMATO OBRIGATÓRIO DA ENTREGA

Ao finalizar uma SPEC, apresentar:

### 1. Estado inicial

Qual era a situação real do código.

### 2. Requisitos

Quais requisitos foram identificados e verificados.

### 3. Referências

Quais referências técnicas foram consultadas e como foram aplicadas.

### 4. Problemas encontrados

Lista completa com severidade, arquivo, função e linha.

### 5. Causas

Explicação matemática, física ou arquitetural.

### 6. Correções

Alterações concretas realizadas.

### 7. Clean code

Problemas de organização, duplicação e manutenção corrigidos.

### 8. Validação

Resultados dos testes e regressões.

### 9. Performance

Métricas comparativas reais, quando disponíveis.

### 10. Homologação visual

Evidências disponíveis e limitações.

### 11. Auditoria adversarial

Problemas encontrados após a implementação inicial.

### 12. Reauditorias

Quantas iterações foram necessárias e o resultado de cada uma.

### 13. Integridade das SPECs anteriores

Quais sistemas foram revalidados.

### 14. Git e CI

Branch, SHA, commits e resultado do workflow correspondente.

### 15. Pendências

Todos os problemas remanescentes.

### 16. Veredito

Utilizar exclusivamente:

```
APPROVED
AUDIT_FAILED
BLOCKED
VISUAL_VALIDATION_PENDING
```

Se o veredito não for APPROVED, não avançar para a próxima SPEC.

---

# 36. ORDEM DE EXECUÇÃO IMEDIATA

Comece agora.

Primeiro, audite o estado atual do repositório.

Identifique todas as SPECs existentes.

Construa a matriz de rastreabilidade.

Confirme se os patches aquáticos anteriores realmente foram implementados corretamente.

Priorize a recuperação da água, da renderização oceânica, da câmera, da natação e da consistência espacial.

Investigue os trechos exatos identificados pela auditoria externa.

Corrija os problemas.

Execute as validações.

Audite novamente.

Procure novos defeitos.

Corrija novamente.

Repita.

Depois de resolver a SPEC aquática e obter todas as evidências necessárias, valide as SPECs anteriores potencialmente afetadas.

Somente então avance para a próxima SPEC elegível.

Continue utilizando esse mesmo protocolo em todas as etapas futuras do DR-MANAUS.

Não trabalhe com pressa.

Não tente maximizar a quantidade de funcionalidades entregues.

Maximize a qualidade, a estabilidade, a fidelidade às SPECs, a precisão matemática, a performance e a experiência real do jogador.

A prioridade é construir um jogo completo e funcional sobre uma fundação tecnicamente correta.

Implemente.

Audite.

Questione sua própria implementação.

Corrija.

Audite novamente.

Repita até obter aprovação comprovada.

Não avance antes disso.

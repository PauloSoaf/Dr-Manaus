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
Último HEAD auditado externamente: d8be19c743e853b97096119a163a331ec0c434e5

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

## 5. MATRIZ DE RASTREABILIDADE
Crie uma matriz persistente de rastreabilidade entre SPECs, requisitos, código, referências e testes.

Formato mínimo:
| SPEC | Requisito | Referência | Arquivo | Função | Teste | Evidência | Status |

Status permitidos:
- NOT_STARTED
- IN_PROGRESS
- PARTIALLY_IMPLEMENTED
- IMPLEMENTED_UNVERIFIED
- AUDIT_FAILED
- REGRESSION_FOUND
- BLOCKED
- VISUAL_VALIDATION_PENDING
- VERIFIED
- APPROVED

---

# FASE B: AUDITORIA DAS REFERÊNCIAS

## 6. ADERÊNCIA OBRIGATÓRIA ÀS REFERÊNCIAS TÉCNICAS
Antes de implementar qualquer algoritmo, leia as referências citadas na SPEC correspondente:
- Three.js WebGPU e TSL.
- NVIDIA GPU Gems (Gerstner waves, normal derivatives).
- Geometry Clipmaps (CDClipmaps).
- Crest Ocean System (Wave Harmonic, MIT).
- Floating origin & camera-relative rendering.
- Continuous Collision Detection (CCD) & swept ellipsoids.

Para cada referência utilizada, registre:
- URL / Autor / Licença / Equações relevantes / Premissas / Limitações / Adaptações e motivos.

## 7. PROIBIÇÃO DE IMPLEMENTAÇÕES FALSAMENTE EQUIVALENTES
Não declarar implementações falsamente equivalentes. Caso use aproximações, documente explicitamente limitações.

---

# FASE C: AUDITORIA DE CLEAN CODE

## 8. AUDITORIA ARQUITETURAL
Single Responsibility, separação entre apresentação, domínio, simulação; ausência de código morto, métodos abandonados e estado global compartilhado indevidamente.

## 9. AUDITORIA DE TYPESCRIPT
Eliminar `any` desnecessário, type assertions forçadas, contratos opcionais frouxos, variáveis com unidades misturadas.

## 10. AUDITORIA DE DUPLICAÇÕES
Procurar sistematicamente implementações duplicadas de ondas, física, batimetria, gravidade, transformações, etc.

---

# FASE D: AUDITORIA MATEMÁTICA E FÍSICA

## 11. VALIDAÇÃO DAS EQUAÇÕES
Verificar unidades, domínio de validade, precisão, sinais, estabilidade temporal, equações GPU e CPU idênticas.

## 12. SISTEMAS DE REFERÊNCIA ESPACIAL
ECEF, ENU, floating origin, render local space. Rebase não pode alterar posição física percebida nem fase de ondas.

## 13. AUTORIDADE FÍSICA
Fonte única de verdade por propriedade.

---

# FASE E: AUDITORIA PRIORITÁRIA DA ÁGUA

## 14. BLOQUEIO IMEDIATO DE NOVAS FEATURES
A apresentação aquática e movimentação em fluidos tem prioridade zero (P0). Nenhuma outra SPEC avança enquanto a SPEC aquática não estiver 100% verificada e homologada.

## 15. CHECKLIST OBRIGATÓRIO DE REGRESSÕES AQUÁTICAS
- WATER-P0-001: Winding do oceano (Ny > 0, CCW).
- WATER-P0-002: Cobertura oceânica (LOD adaptativo, 360°, horizonte curvo).
- WATER-P0-003: Sobreposição de superfícies (chunk water 0..384m vs horizon ocean 384m..260km).
- WATER-P0-004: Flutuação em águas rasas e leito sólido.
- WATER-P0-005: Desativação de stepHeight durante natação.
- WATER-P0-006: Relógios unificados entre física e shaders.
- WATER-P0-007: Atenuação de profundidade idêntica CPU/GPU.
- WATER-P0-008: Câmera contínua sem saltos ou clamps destrutivos.
- WATER-P0-009: Ordem do runtime (ambiente publicado antes do jogador).
- WATER-P0-010: Separação de superfície líquida e leito sólido bentônico (-4000m Thalassa).
- WATER-P0-011: Classificação de biomas e oceanos via Natural Earth mask.
- WATER-P0-012: Referenciais de colisão corretos fora de Manaus.
- WATER-P1-001: Visibilidade de VFX aquáticos (splash, ripples, wakes) em oceanos e corpos alienígenas.
- WATER-P1-002: Eliminação de listras periódicas e Moiré.
- WATER-P1-003: Formulação completa 3D de Gerstner e derivadas.
- WATER-P1-004: Dinâmica e movimento do Rio Negro.
- WATER-P1-005: Cobertura contínua e invariante sob rebase.

---

# FASE F: DEFINITION OF DONE & PROGRESSÃO

## 29. GATE DE APROVAÇÃO
Uma SPEC somente poderá ser aprovada quando todos os requisitos estiverem verificados com testes reais de produção, sem P0 ou P1 pendentes, com CI verde e homologação de gameplay.

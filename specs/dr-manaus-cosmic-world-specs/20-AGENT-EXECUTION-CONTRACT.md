# Contrato de execução para agente de código

## Missão

Implementar a arquitetura planetária e cósmica do DR Manaus de forma incremental sobre a `main` atual.

Não recomeçar o projeto.

Não substituir Manaus.

## Antes de editar

O agente deve:

1. confirmar HEAD atual
2. rodar `npm test`
3. rodar `npm run build`
4. ler `src/core/config.ts`
5. ler `src/game/Game.ts`
6. ler `src/world/geodata/geodata.ts`
7. ler `WorldStreamer`, `HLODManager` e `RealCityLayer`
8. ler tests de streaming e real city
9. registrar qualquer divergência em relação a este snapshot

## Fonte de verdade

Se houver conflito entre documentação antiga e código + testes atuais:

```text
código + testes atuais vencem
```

Exemplo conhecido:

```text
docs/geodata.md possui origem antiga
código atual usa Monumento à Abertura dos Portos
```

## Regras de mudança

Não fazer:

```text
big bang refactor
delete e reescrever WorldStreamer
trocar RealCityLayer por solução genérica
remover testes
desabilitar destruição para facilitar streaming
baixar geodata em runtime
usar Google Maps
colocar o Sistema Solar inteiro em um Vector3 GPU
```

## Ordem obrigatória

```text
Spatial Core
-> Manaus adapter
-> global scheduler
-> Earth low LOD
-> terrain
-> curved Manaus
-> render domains
-> leave Earth
-> Solar System
-> Galaxy
-> Universe
-> persistence hardening
```

## Commits

Cada fase deve ter commits semanticamente pequenos.

Exemplo:

```text
feat(spatial): add WGS84 geodetic and ECEF transforms
test(spatial): cover WGS84 round trips and ENU axes
refactor(manaus): route legacy projection through Manaus frame adapter
feat(world): add provider registry and global streaming budget
feat(earth): render WGS84 globe with cubed-sphere LOD
```

## Compatibilidade

Enquanto uma fase ainda não estiver pronta:

```text
feature flag
fallback atual
```

O jogo deve iniciar e ser jogável depois de cada merge.

## Performance

Toda nova representação precisa possuir:

```text
budget
LOD
dispose
cancel
telemetry
```

Nenhum provider pode responder:

```text
carregue tudo
```

## Assets

Assets e datasets devem registrar:

```text
source
license
version
retrievedAt
```

## Testes

Nenhuma fase é aceita somente porque a cena "parece funcionar".

Exigir:

```text
unit
integration
browser
performance
```

conforme aplicável.

## Definition of done global

A implementação completa deve cumprir `17-ACCEPTANCE-CRITERIA.md`.

## Prioridade em caso de conflito

1. correção espacial
2. preservação de Manaus
3. estabilidade do frame
4. streaming
5. qualidade visual
6. expansão de conteúdo

Adicionar mais planetas não compensa quebrar o Largo.

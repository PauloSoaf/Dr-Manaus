# Checklist de implementação

## Interplanetário

- [ ] Confirmar HEAD da `feat/universe-map`
- [ ] `UniverseRuntime.playerEcef()` frame-aware
- [ ] `UniverseRuntime.playerGeodetic()` frame-aware
- [ ] Uma única rotina para dominant body + altitude
- [ ] `telemetry.altitudeM` não usa Manaus projection em barycentric
- [ ] `SpatialContext.altitudeM` usa a mesma fonte
- [ ] `requested` não depende de `speedMode` congelado
- [ ] Soltar B vira coasting
- [ ] Histerese de entrada/saída
- [ ] Retorno exige baixa altitude + velocidade relativa segura
- [ ] Brake usa velocidade relativa ao corpo
- [ ] Thrust usa velocidade relativa ao corpo
- [ ] Velocidade relativa limitada
- [ ] Envelope de colisão configurável
- [ ] Remover hardcoded 14 km
- [ ] Proxy visual não pula em rebase
- [ ] `Game.origin` não briga com floating origin no espaço
- [ ] VFX/HUD usam velocidade relativa no espaço
- [ ] Manaus streamer/HLOD/actors pausados no espaço
- [ ] `player.teleport()` usado no handoff de retorno

## Terreno

- [ ] `terrain.ts` verifica `FEATURES.curvedManaus`
- [ ] `ground-cover` plano quando flag=false
- [ ] `terrain-backdrop` plano quando flag=false
- [ ] shores planos quando flag=false
- [ ] roads planos quando flag=false
- [ ] road markings planos quando flag=false
- [ ] ground meshes têm role explícito
- [ ] `terrain-backdrop` usa mask `sheet`
- [ ] `ground-cover` usa mask `sheet`
- [ ] roads usam mask apropriado
- [ ] sidewalks mantêm proteção vertical
- [ ] nenhum segundo plano verde aparece dentro da cratera
- [ ] physics height coincide com bowl

## Regressão

- [ ] Teatro/Largo continuam iguais
- [ ] RealCity continua igual
- [ ] tráfego continua nas ruas
- [ ] crateras antigas continuam funcionando
- [ ] teleporte de powers continua funcionando
- [ ] câmera continua estável em mega
- [ ] Earth globe continua aparecendo na transição
- [ ] Moon/celestial providers não quebram
- [ ] F3 continua funcional

## Validação

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:browser`
- [ ] smoke de saída da Terra
- [ ] smoke de coasting
- [ ] smoke de reentrada
- [ ] smoke de crateras

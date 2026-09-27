# Checklist de revisão

## Antes de cada commit

- [ ] mudança tem escopo único
- [ ] nenhuma API foi alterada sem pesquisar consumidores
- [ ] não duplicou matemática espacial
- [ ] não introduziu coordenada gigante no renderer
- [ ] não introduziu `Math.random()` persistente
- [ ] não adicionou allocation em hot loop sem necessidade
- [ ] há teste da nova regra
- [ ] targeted test passa
- [ ] build passa

## Antes de marcar fase integrada

- [ ] fluxo real usa a implementação
- [ ] não é apenas classe registrada
- [ ] não há métodos stub
- [ ] não há `throw not fully wired`
- [ ] teardown funciona
- [ ] cancelamento funciona
- [ ] telemetry mostra o estado
- [ ] docs correspondem ao código

## Antes de marcar fase verified

- [ ] unit tests
- [ ] integration tests
- [ ] browser test quando visual
- [ ] stress route
- [ ] memory bounded
- [ ] no visible regression
- [ ] no known P0/P1 relacionado

## Antes de merge para main

- [ ] revisar diff completo contra main
- [ ] nenhum arquivo vazio acidental
- [ ] nenhum comentário contradiz constante
- [ ] feature flags coerentes
- [ ] no dead experimental path
- [ ] save schema documentado
- [ ] licence/provenance preservados
- [ ] status docs factuais

# Testes e critérios de aceite

## Testes unitários obrigatórios

### T1 - altitude da Terra no frame baricêntrico

Criar runtime sem streaming pesado.

Posicionar o jogador em:

```text
Earth barycentric position + radial offset de 100 km
```

Esperado:

```text
dominantBody === 'earth'
altitudeM ~= 100_000
```

Não aceitar valor vindo de `legacyLocalToGeodetic()`.

### T2 - altitude permanece contínua em 600 frames

Simular saída da Terra.

A cada frame:

```text
telemetry.altitudeM finita
dominantBody estável enquanto Terra for a mais próxima
altitude cresce sem saltos absurdos
```

Não pode alternar positivo/negativo sem movimento correspondente.

### T3 - soltar boost não devolve ao local no espaço

Entrar em interplanetário a 100 km.

Depois:

```text
requested = false
```

Esperado:

```text
domain.kind === 'interplanetary'
```

O jogador deve coasting.

### T4 - reentrada exige altitude e velocidade

Cenários:

```text
altitude 5 km, relative speed 100 km/s -> continua interplanetary
altitude 100 km, relative speed 2 km/s -> continua interplanetary
altitude 5 km, relative speed 8 km/s -> returned
```

### T5 - histerese

Oscilar altitude artificialmente entre:

```text
8.8 km
9.2 km
```

depois da entrada.

Não pode ping-pong.

### T6 - freio é relativo ao corpo

Estado:

```text
player barycentric velocity == Earth barycentric velocity
```

Pressionar freio.

Esperado:

```text
relative velocity continua zero
player barycentric velocity continua acompanhando a Terra
```

### T7 - limite de velocidade

Manter thrust por milhares de frames.

Esperado:

```text
relative speed <= maxRelativeSpeedMps + epsilon
```

### T8 - floating origin não move proxy visual

Forçar vários rebases.

Esperado:

```text
player visual position não salta
camera-player distance contínua
```

Adicionar tolerância pequena, não quilométrica.

---

## Testes de terreno

### T9 - curvedManaus false significa terreno plano

Com configuração atual:

```text
FEATURES.curvedManaus === false
```

Verificar:

```text
ground-cover permanece no authored Y
terrain-backdrop permanece no authored Y
road ribbons não recebem SurfaceFrameService
```

### T10 - backdrop recebe crater mask

Criar cratera em:

```text
Largo
Arena
zona de floresta
```

Verificar visualmente e, onde possível, via material/role:

```text
ground-cover ausente no interior
terrain-backdrop ausente no interior
brown crater bowl visível
```

### T11 - crater physics e visual concordam

No centro de uma cratera:

```text
PhysicsWorld.terrainHeight(x,z)
```

deve corresponder ao bowl visual dentro da tolerância da grade.

Não aceitar:

```text
visual buraco
physics floor em 0
```

ou o inverso.

---

## Browser smoke obrigatório

Não considerar patch concluído apenas com unit tests.

### Rota A - decolagem

1. Spawn no Largo.
2. F.
3. Subir em mega.
4. Armar interplanetário.
5. Cruzar 9 km.
6. Engajar travel.
7. Continuar até pelo menos 1.000 km de altitude.

Aceite:

```text
0 teleports
0 domain ping-pong
câmera controlável
Earth continua coerente
inputs respondem
```

### Rota B - coasting

1. Em travel interplanetário.
2. Soltar B por 10 segundos.
3. Girar câmera.
4. Aplicar thrust novamente.

Aceite:

```text
não retorna para Manaus
não zera posição lógica
não perde orientação
```

### Rota C - reentrada

1. Aproximar da Terra.
2. Frear velocidade relativa.
3. Descer abaixo do limiar de retorno.

Aceite:

```text
um único handoff
player volta para local
sem loop
sem screen jump gigante
```

### Rota D - crateras

Criar crateras:

```text
Largo
rua
área verde
Arena/Ponta Negra se acessível
```

Aceite:

```text
nenhum plano verde aparece dentro
bowl de terra permanece visível
personagem pode entrar no buraco
camera raycast respeita a cavidade
```

---

## Performance

Durante interplanetário:

```text
Manaus WorldStreamer não deve consumir budget contínuo
HLOD local não deve reconstruir
NPCs/traffic devem estar suspensos
```

F3 deve deixar claro:

```text
domain
relative speed
dominant body
altitude
rebases
```

## Gate final

Rodar:

```bash
npm test
npm run build
npm run test:browser
```

e depois o browser smoke manual.

Se algum teste antigo precisar ser alterado apenas porque codificava o comportamento errado de "soltar B = voltar para local", atualizar esse teste e documentar a mudança de semântica.

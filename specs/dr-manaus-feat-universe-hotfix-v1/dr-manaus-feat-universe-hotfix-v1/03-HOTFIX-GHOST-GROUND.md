# Hotfix P0 - chão verde fantasma e crateras

## Sintoma

O jogador cria crateras e buracos, mas existe uma superfície verde inferior que continua desenhada e acaba cobrindo visualmente a cavidade.

## Causa encontrada

Em:

```text
src/core/config.ts
```

o estado atual é:

```ts
FEATURES.curvedManaus = false
```

Porém:

```text
src/world/geodata/terrain.ts
```

transforma incondicionalmente o terreno pelo `SurfaceFrameService`.

Isso afeta:

```text
terrain-backdrop
ground-cover
shore polygons
roads
road markings
```

Enquanto isso, `TerrainDestruction` continua usando um heightfield plano no sistema legado.

Além disso, o material destrutível só descarta a superfície quando o fragmento está dentro de:

```ts
surfaceMinY <= global.y <= surfaceMaxY
```

A curvatura parcial pode mover uma superfície inferior para fora dessa faixa.

Ela então deixa de receber o recorte e aparece dentro da cratera.

---

## 1. Respeitar `FEATURES.curvedManaus`

Arquivo:

```text
src/world/geodata/terrain.ts
```

Importar:

```ts
FEATURES
```

e condicionar TODA transformação de superfície.

Quando:

```ts
FEATURES.curvedManaus === false
```

o terreno precisa produzir exatamente o mesmo sistema plano legado:

```text
X = legacy X
Y = authored Y
Z = legacy Z
normal = (0,1,0)
```

Isso inclui:

```text
polygon()
groundCover()
road ribbons
road markings
embankment
terrain-backdrop
```

Não pode existir curvatura parcial escondida atrás de uma flag desligada.

---

## 2. Não usar regex de nome como contrato principal de superfície

Hoje `Game.watchGround()` decide muita coisa por:

```ts
/Generalized Manaus|airport-pavement|sidewalks|.../
```

Adicionar metadado explícito no mesh:

```ts
mesh.userData.terrainSurface = 'sheet'
```

ou:

```ts
'road'
'sidewalk'
'plaza'
```

Manter regex apenas como compatibilidade temporária.

---

## 3. Diferenciar ground sheet de objetos baixos

O mask atual tem `groundBand` para não cortar paredes inteiras de prédios.

Isso é correto para sidewalk/plaza/box.

Mas para superfícies que são exclusivamente chão:

```text
ground-cover
terrain-backdrop
shore polygons
road ribbons
```

não é necessário depender da altura Y.

Criar dois modos:

```text
sheet
band
```

### `sheet`

Recorta por:

```text
XZ crater mask
```

independentemente da altura atual do fragmento.

### `band`

Mantém a proteção por faixa vertical para meshes que também possuem paredes.

Isso torna o sistema compatível com a futura curvatura de Manaus sem reintroduzir o plano fantasma.

---

## 4. Backdrop não pode reaparecer dentro da cratera

`terrain-backdrop` existe para evitar buracos causados pela divergência entre shoreline generalizada e landmask real.

Ele não é uma segunda superfície jogável.

Contrato:

```text
backdrop pode preencher lacuna geográfica
backdrop nunca pode cobrir uma deformação do terreno
```

Marcar explicitamente:

```ts
backdrop.userData.terrainSurface = 'sheet'
backdrop.userData.terrainFallback = true
```

e garantir que o mask de cratera seja aplicado a ele.

---

## 5. Cratera e visual precisam compartilhar frame

Enquanto:

```ts
FEATURES.curvedManaus === false
```

usar tudo em legacy flat.

Quando a flag for ligada no futuro:

```text
crater records
terrain mask
bowl mesh
terrain physics
surface render
```

precisam migrar juntos.

Não aceitar novamente:

```text
render curvo + physics plana
```

ou:

```text
ground curvo + crater bowl plano
```

---

## 6. Não resolver apenas baixando o segundo chão

Não usar como solução final:

```text
mover terrain-backdrop de -0.6 para -100
```

Isso apenas esconde o problema.

O sistema correto é o backdrop receber o mesmo recorte lógico da superfície que ele está preenchendo.

Pode haver uma pequena separação vertical para evitar z-fighting, mas não dezenas de metros como workaround.

---

## 7. Não ligar curvedManaus neste patch

O hotfix deve estabilizar o jogo atual.

Depois:

```text
FEATURES.curvedManaus
```

só pode ser ligado quando:

```text
terrain
real city
roads
water
landmarks
Largo
airport
colliders
traffic
craters
destruction
```

estiverem no mesmo frame.

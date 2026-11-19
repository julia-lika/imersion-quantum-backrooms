# Door Nowhere Design

## Intent

Substituir visualmente a escada revelada após a medição quântica pela porta amarela animada do PSX Liminal Kit e substituir o visual abstrato do fantasma pelo modelo `bacteria_backrooms.glb`, mantendo a mesma célula de destino, perseguição e transição entre andares.

## Goals

- Usar o modelo GLB `door_yellow.glb` como visual da saída e reproduzir seu clip `open`.
- Usar o modelo GLB `bacteria_backrooms.glb` como visual da entidade que reduz a sanidade.
- Manter o gatilho invisível e o evento `stairs-reached` existentes para não alterar o fluxo de jogo.
- Manter a lógica de linha de visão, visor, perseguição e dano de sanidade do `quantum-ghost`.
- Preservar a exclusão da célula de saída do sorteio de itens.

## Non-goals and constraints

- Não alterar a lógica de geração do labirinto, estado salvo ou física de movimento.
- Não adicionar a parede de moldura `wall_yellow_doorway`; a porta amarela será usada como modelo independente no ponto de saída.
- Copiar também a licença/atribuição CC BY 4.0 do asset pack para os assets do projeto.
- Registrar a atribuição CC BY 4.0 embutida nos metadados do modelo Bacteria.

## Approach

Adicionar os dois GLBs aos assets web. Trocar a geometria visual criada por `addStairs` por uma entidade `gltf-model` com um mixer local para tocar o clip `open`, mantendo o trigger invisível com a mesma posição e classe de colisão. Trocar as primitivas criadas por `quantum-ghost` por uma entidade `gltf-model` e aplicar materiais sólidos em todos os meshes carregados. A regressão será coberta por testes que verificam as referências aos modelos, a preservação do trigger/evento, a animação da porta e o controle visual do fantasma.

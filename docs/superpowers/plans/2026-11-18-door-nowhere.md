# Door Nowhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir a escada revelada no mapa pela porta amarela animada e trocar o visual do fantasma pelo modelo Bacteria sólido, sem alterar a progressão ou a perda de sanidade.

**Architecture:** Os dois GLBs serão servidos por `<a-assets>`. A porta será instanciada dentro do mesmo grupo `#stairs`, mantendo o trigger invisível `stairs-trigger` e o evento `stairs-reached`; um componente local usa `THREE.AnimationMixer` para tocar o clip `open`. O fantasma receberá o modelo Bacteria como filho e manterá materiais sólidos, com emissão opcional pelo visor.

**Tech Stack:** HTML/A-Frame, JavaScript ES modules, GLB/glTF, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-18-door-nowhere-design.md`

## Global Constraints

- Usar `door_yellow.glb` e tocar o clip `open`.
- Usar `bacteria_backrooms.glb` no `quantum-ghost`.
- Manter o gatilho invisível com `floor-transition="target: #player-head; radius: 0.75"`.
- Preservar `stairs-reached`, o estado salvo e a exclusão da célula da saída do sorteio de itens.
- Distribuir a atribuição/licença CC BY 4.0 do asset pack junto ao asset copiado.

## Review Focus

- Asset ausente ou referência incorreta: o A-Frame deve apontar para um arquivo local existente.
- Porta invisível antes da medição: nenhum modelo de saída deve ser criado quando `stairsVisible` for falso.
- Transição quebrada: o trigger deve continuar emitindo o mesmo evento ao alcançar a porta.
- Porta ocupando a célula errada: o modelo deve usar a mesma coordenada calculada para a escada.
- Re-render do mapa: a substituição do mapa não deve duplicar portas ou triggers.
- Modelo do fantasma carregado: a entidade deve aplicar material opaco e sólido aos meshes do GLB, não apenas ao nó raiz.

### Task 1: Replace the stairs visual with Door Nowhere

**Files:**
- Create: `site/assets/models/door-yellow.glb` (copied from the user-provided asset pack)
- Create: `site/assets/psx-liminal-kit/LICENSE.txt`
- Modify: `site/assets/README.md`
- Modify: `site/index.html`
- Create: `site/js/components/door-animation.js`
- Modify: `site/js/components/quantum-map.js:73-178`
- Test: `tests/door-yellow.test.js`

**Interfaces:**
- Consumes: the existing `stairsVisible`, `map.stairs`, `floor-transition`, and `stairs-reached` contracts.
- Produces: an `a-entity#stairs` containing `gltf-model="#door-yellow-model"` with `door-animation="clip: open"` plus the existing invisible transition trigger.

- [ ] **Step 1: Write the failing test**

  Add a test that reads `site/index.html` and `site/js/components/quantum-map.js`, asserting the local `door-yellow.glb` asset item, its `#door-yellow-model` reference, the `open` animation component, and the unchanged `stairs-trigger`/`stairs-reached` transition contract.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --test tests/door-yellow.test.js`
  Expected: FAIL because the yellow door asset, animation component, and model reference do not exist yet.

- [ ] **Step 3: Add the asset and attribution**

  Extract `psx-liminal-kit-free/glb/door_yellow.glb` to `site/assets/models/door-yellow.glb`, copy the pack's `LICENSE.txt` to `site/assets/psx-liminal-kit/LICENSE.txt`, and document the source/CC BY 4.0 credit in `site/assets/README.md`.

- [ ] **Step 4: Register and render the model**

  Add `<a-asset-item id="door-yellow-model" src="assets/models/door-yellow.glb"></a-asset-item>` to `site/index.html`. Register `door-animation.js`. In `addStairs(stairsX, stairsZ, origin, cellSize)`, keep the existing parent position and `stairs` identity, replace the five step boxes and marker with an entity using `gltf-model="#door-yellow-model"` and `door-animation="clip: open"`, and retain the invisible `stairs-trigger` exactly as the transition collider.

- [ ] **Step 5: Run the focused test to verify it passes**

  Run: `node --test tests/door-yellow.test.js`
  Expected: PASS with the yellow door asset, animation reference, and transition contract present.

- [ ] **Step 6: Run the full test suite**

  Run: `npm test`
  Expected: all tests pass with zero failures.

- [ ] **Step 7: Verify the browser scene**

  Load the local scene, reveal the exit through the existing measurement flow, and confirm that one yellow door appears at the former stair position, plays its opening animation, and that entering its trigger advances the floor.

### Task 2: Replace the quantum ghost visual with Bacteria

**Files:**
- Create: `site/assets/models/bacteria-backrooms.glb` (copied from the user-provided model)
- Modify: `site/assets/README.md`
- Modify: `site/index.html`
- Modify: `site/js/components/quantum-ghost.js`
- Test: `tests/quantum-ghost-asset.test.js`

**Interfaces:**
- Consumes: the existing `#quantum-ghost`, `quantum-ghost` component, `shared.visor`, and `updateLook` behavior.
- Produces: a Bacteria GLB child model whose meshes receive the same opacity and emissive state as the old ghost primitives.

- [ ] **Step 1: Write the failing test**

  Add a test that reads `site/index.html` and `site/js/components/quantum-ghost.js`, asserting the local Bacteria asset item, the `#bacteria-model` reference, and mesh traversal in the ghost's visual update path.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --test tests/quantum-ghost-asset.test.js`
  Expected: FAIL because the Bacteria asset and model-based visual path do not exist yet.

- [ ] **Step 3: Add the asset and attribution**

  Copy `/Users/julia.lika/Downloads/bacteria_backrooms.glb` to `site/assets/models/bacteria-backrooms.glb` and document the embedded author/source/license metadata in `site/assets/README.md`.

- [ ] **Step 4: Register and render the Bacteria model**

  Add `<a-asset-item id="bacteria-model" src="assets/models/bacteria-backrooms.glb"></a-asset-item>` to `site/index.html`. In `quantum-ghost.js`, replace the cylinder/sphere creation with an entity using `gltf-model="#bacteria-model"`, listen for `model-loaded`, collect descendant meshes, and keep every mesh material opaque (`opacity: 1`, `transparent: false`, `depthWrite: true`) while preserving the existing visor-controlled emissive intensity.

- [ ] **Step 5: Run the focused test to verify it passes**

  Run: `node --test tests/quantum-ghost-asset.test.js`
  Expected: PASS with the Bacteria asset and model-based visibility path present.

- [ ] **Step 6: Run the full test suite**

  Run: `npm test`
  Expected: all tests pass with zero failures.

- [ ] **Step 7: Verify the browser scene**

  Confirm the Bacteria model appears in the world as a solid object, remains visible without the visor, and continues to trigger the existing sanity-loss behavior when watched too long.

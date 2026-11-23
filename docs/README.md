# Documentação do Quantum Backrooms VR

Site em [Docusaurus](https://docusaurus.io/) com duas abas:

- **Semanas** (`semanas/`): uma página por semana, com a entrega (apresentação, ficha e o que mais for pedido).
- **Devlog** (`devlog/`): diário de desenvolvimento. Cada entrada é um arquivo `AAAA-MM-DD-titulo.md`.

## Rodar localmente

```bash
cd docs
npm ci
npm run start
```

## Gerar o build

```bash
cd docs
npm run build
```

O resultado fica em `docs/build`. Para publicar num subcaminho, defina
`DOCS_URL` e `DOCS_BASE_URL` antes do build, por exemplo
`DOCS_URL=https://julia-lika.github.io DOCS_BASE_URL=/imersion-quantum-backrooms/docs/`.

## Adicionar a entrega de uma semana

Edite `semanas/semana-N.md`. Se a semana tiver mais de uma página, transforme-a numa pasta, como `semanas/semana-1/`, com um `_category_.json` e um `index.md`.

## Escrever no devlog

Crie `devlog/AAAA-MM-DD-titulo.md` com este cabeçalho:

```md
---
slug: titulo
title: Título da entrada
authors: [julia]
tags: [gameplay]
---

Resumo que aparece na lista.

{/* truncate */}

Resto do texto.
```

As etiquetas ficam em `devlog/tags.yml` e os autores em `devlog/authors.yml`.

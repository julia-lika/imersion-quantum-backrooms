# Documentação do Quantum Backrooms VR

Site em [Docusaurus](https://docusaurus.io/) com duas abas:

- **Sprints** (`sprints/`): uma página por sprint, com a apresentação embutida em PDF e o PowerPoint para baixar. Os arquivos ficam em `static/apresentacoes/`.
- **Devlog** (`devlog/`): diário de desenvolvimento. Cada entrada é um arquivo `AAAA-MM-DD-titulo.md`.

## Rodar localmente

```bash
cd docusaurus
npm ci
npm run start
```

## Gerar o build

```bash
cd docusaurus
npm run build
```

O resultado fica em `docusaurus/build`. Para publicar num subcaminho, defina
`DOCS_URL` e `DOCS_BASE_URL` antes do build, por exemplo
`DOCS_URL=https://julia-lika.github.io DOCS_BASE_URL=/imersion-quantum-backrooms/docs/`.

## Adicionar a apresentação de uma sprint

1. Exporte os slides em PDF e coloque o PDF e o `.pptx` em `static/apresentacoes/`, com o mesmo nome (por exemplo `sprint-2-mapa-v2.pdf` e `sprint-2-mapa-v2.pptx`).
2. Renomeie `sprints/sprint-2.md` para `sprint-2.mdx` e copie o bloco `Slides` do topo de `sprints/sprint-1.mdx`, trocando o nome do arquivo.

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

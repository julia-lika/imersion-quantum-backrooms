// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

// Endereço público do site. Localmente roda em http://localhost:3000/.
// No deploy, defina DOCS_URL (ex.: https://julia-lika.github.io) e
// DOCS_BASE_URL (ex.: /imersion-quantum-backrooms/docs/).
const url = process.env.DOCS_URL || 'http://localhost:3000';
const baseUrl = process.env.DOCS_BASE_URL || '/';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Quantum Backrooms VR',
  tagline: 'Apresentações das sprints e devlog do projeto',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url,
  baseUrl,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        // Aba "Sprints": uma página por sprint, com a apresentação.
        docs: {
          path: 'sprints',
          routeBasePath: 'sprints',
          sidebarPath: './sidebars.js',
        },
        // Aba "Devlog": diário de desenvolvimento, um post por entrada.
        blog: {
          path: 'devlog',
          routeBasePath: 'devlog',
          blogTitle: 'Devlog',
          blogDescription: 'Diário de desenvolvimento do Quantum Backrooms VR',
          blogSidebarTitle: 'Todas as entradas',
          blogSidebarCount: 'ALL',
          postsPerPage: 10,
          showReadingTime: true,
          onInlineAuthors: 'ignore',
          onUntruncatedBlogPosts: 'ignore',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Quantum Backrooms VR',
        logo: {
          alt: 'Quantum Backrooms VR',
          src: 'img/favicon.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'sprintsSidebar',
            position: 'left',
            label: 'Sprints',
          },
          {
            to: '/devlog',
            label: 'Devlog',
            position: 'left',
          },
          {
            href: 'https://github.com/julia-lika/imersion-quantum-backrooms',
            label: 'Repositório',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Quantum Backrooms VR · OP03 Experiências Imersivas · ${new Date().getFullYear()}`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;

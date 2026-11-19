import clsx from 'clsx';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';

import styles from './styles.module.css';

// Título das entradas do devlog: texto simples e menor, sem link para a página da entrada.
export default function BlogPostItemHeaderTitle({className}) {
  const {metadata, isBlogPostPage} = useBlogPost();
  const TitleHeading = isBlogPostPage ? 'h1' : 'h2';
  return (
    <TitleHeading className={clsx(styles.title, className)}>
      {metadata.title}
    </TitleHeading>
  );
}

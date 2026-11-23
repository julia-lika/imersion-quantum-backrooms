import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

export default function Home() {
  return (
    <Layout description="Entregas semanais e devlog do Quantum Backrooms VR">
      <header className={styles.hero}>
        <div className="container">
          <h1 className={styles.title}>Quantum Backrooms VR</h1>
          <p className={styles.subtitle}>
            Um jogo de horror em WebXR cujos andares nascem de medições quânticas.
            O mundo só decide o que é quando você o mede.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/semanas">
              Entregas semanais
            </Link>
            <Link className="button button--secondary button--lg" to="/devlog">
              Devlog
            </Link>
          </div>
        </div>
      </header>
    </Layout>
  );
}

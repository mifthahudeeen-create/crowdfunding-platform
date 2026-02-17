import styles from "./Layout.module.scss";

export default function Layout({ children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.logo}>CrowdFund Demo</h1>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} Demo Presentation
      </footer>
    </div>
  );
}

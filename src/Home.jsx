import React from "react";
import { Link } from "react-router-dom";
import styles from "./Home.module.scss";

export default function Home() {
  return (
    <div className={styles.container}>
      <h1>Welcome to CrowdFund </h1>
      <p className={styles.sub}>Click below to open the demo campaign page.</p>

      <Link to="/demo" className={styles.demoBtn}>
        Open →
      </Link>
    </div>
  );
}

import React, { useMemo, useRef, useState } from "react";
import styles from "./Campaign.module.scss";
import { QRCodeCanvas } from "qrcode.react";
import {
  demoCampaign,
  demoLeaderboard,
  demoRecentDonations,
} from "../../demo/demoData";

// ✅ Change these to your real UPI details
const PAYEE_VPA = "yourvpa@upi"; // ex: ahamed@okicici
const PAYEE_NAME = "Knowledge World"; // ex: "Ahamed"
const CURRENCY = "INR";

function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalize(v) {
  return String(v ?? "").trim().toLowerCase();
}

export default function CampaignDemo() {
  const [campaign, setCampaign] = useState(demoCampaign);
  const [lb, setLb] = useState(demoLeaderboard);
  const [recent, setRecent] = useState(demoRecentDonations);

  const receiptCounterRef = useRef(1000);

  const [form, setForm] = useState({
    donorName: "",
    donorPhone: "",
    donorEmail: "",
    address: "",
    note: "",
    amount: 500,
    isAnonymous: false,
    paymentMode: "payNow", // payNow | payLater
  });

  const [search, setSearch] = useState("");
  const [showAnonymous, setShowAnonymous] = useState(true);

  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ QR mode: UPI or Link
  const [qrMode, setQrMode] = useState("upi"); // "upi" | "link"
  const qrCardRef = useRef(null);

  const percent = useMemo(() => {
    return Math.min(100, (campaign.raisedAmount / campaign.goalAmount) * 100);
  }, [campaign]);

  function recomputeOverallLeaderboard(nextRecent) {
    const map = new Map();
    nextRecent.forEach((d) => {
      if (d.status !== "PAID") return; // ✅ count only PAID
      const name = d.donorName || "Donor";
      map.set(name, (map.get(name) || 0) + Number(d.amount));
    });

    const sorted = [...map.entries()]
      .map(([donorName, total]) => ({ donorName, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((x, i) => ({
        rank: i + 1,
        donorName: x.donorName,
        total: x.total,
        count: 1,
      }));

    setLb((prev) => ({ ...prev, overall: sorted.length ? sorted : prev.overall }));
  }

  // ✅ UPI QR value (auto updates with selected amount)
  const upiQrValue = useMemo(() => {
    const amt = Number(form.amount || 0);
    const tn = encodeURIComponent(
      form.note?.trim()
        ? `Donation: ${form.note.trim()}`
        : `Donation for ${campaign.title}`
    );

    
    //  simple for GPay/PhonePe
    return `upi://pay?pa=${encodeURIComponent(PAYEE_VPA)}&pn=${encodeURIComponent(
      PAYEE_NAME
    )}&am=${encodeURIComponent(amt)}&cu=${encodeURIComponent(CURRENCY)}&tn=${tn}`;
  }, [form.amount, form.note, campaign.title]);

  // ✅ Link QR (your page URL)
  const linkQrValue = useMemo(() => {
    return window.location.href; // opens /demo on scan
  }, []);

  const qrValue = qrMode === "upi" ? upiQrValue : linkQrValue;

  function downloadQrPng() {
    const card = qrCardRef.current;
    if (!card) return;

    const canvas = card.querySelector("canvas");
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `donation-qr-${qrMode}-${Number(form.amount || 0)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDonate(e) {
    e.preventDefault();
    setMsg("");
    setPaying(true);

    await new Promise((r) => setTimeout(r, 900));

    const isAnon = form.isAnonymous;
    const isPledge = form.paymentMode === "payLater";

    receiptCounterRef.current += 1;
    const receiptNo = `RCP-${String(receiptCounterRef.current).padStart(4, "0")}`;
    const paymentId = `PAY_${makeId(6)}`;

    const newDonation = {
      id: `demo_${Date.now()}`,
      receiptNo,
      paymentId: isPledge ? "" : paymentId,
      status: isPledge ? "PLEDGED" : "PAID",

      donorName: isAnon ? "Anonymous" : form.donorName || "Donor",
      donorPhone: isAnon ? "" : (form.donorPhone || ""),
      donorEmail: isAnon ? "" : (form.donorEmail || ""),
      address: isAnon ? "" : (form.address || ""),
      note: form.note || "",
      amount: Number(form.amount),
      paidAt: new Date().toISOString(),
    };

    const nextRecent = [newDonation, ...recent];
    setRecent(nextRecent);

    if (!isPledge) {
      setCampaign((p) => ({
        ...p,
        raisedAmount: p.raisedAmount + Number(form.amount),
      }));

      setLb((p) => {
        const nextToday = [
          { rank: 1, donorName: newDonation.donorName, total: newDonation.amount, count: 1 },
          ...p.today,
        ].slice(0, 10);

        return { ...p, today: nextToday.map((x, i) => ({ ...x, rank: i + 1 })) };
      });

      recomputeOverallLeaderboard(nextRecent);
    }

    setForm((p) => ({
      ...p,
      donorName: "",
      donorPhone: "",
      donorEmail: "",
      address: "",
      note: "",
    }));

    setMsg(
      isPledge
        ? `✅ Pledge saved! Receipt: ${receiptNo} (Pay later)`
        : `✅ donation recorded! Receipt: ${receiptNo} (No real payment)`
    );

    setPaying(false);
  }

  const filteredRecent = useMemo(() => {
    const q = normalize(search);

    return recent.filter((r) => {
      const isAnon = normalize(r.donorName) === "anonymous";
      if (!showAnonymous && isAnon) return false;
      if (!q) return true;

      const haystack = [
        r.status,
        r.donorName,
        r.donorPhone,
        r.donorEmail,
        r.receiptNo,
        r.paymentId,
        r.address,
        r.note,
        r.amount,
        r.paidAt ? new Date(r.paidAt).toLocaleString() : "",
      ]
        .map(normalize)
        .join(" ");

      return haystack.includes(q);
    });
  }, [recent, search, showAnonymous]);

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <section className={styles.headerCard}>
        <div className={styles.left}>
          <h2>{campaign.title}</h2>
          <p>{campaign.description}</p>

          <div className={styles.progress}>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: `${percent}%` }} />
            </div>

            <div className={styles.numbers}>
              <div>
                <strong>₹{campaign.raisedAmount.toLocaleString()}</strong>
                <span className={styles.muted}> raised</span>
              </div>
              <div className={styles.muted}>Goal ₹{campaign.goalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.stats}>
            <div className={styles.statBox}>
              <span className={styles.label}>Progress</span>
              <strong>{percent.toFixed(1)}%</strong>
            </div>
            <div className={styles.statBox}>
              <span className={styles.label}>Mode</span>
              <strong>DEMO</strong>
            </div>
          </div>

          {/* ✅ Premium Animated QR Card */}
          <div className={styles.qrCard} ref={qrCardRef}>
            <div className={styles.qrTop}>
              <div>
                <div className={styles.qrTitle}>Scan to Donate</div>
                <div className={styles.qrSub}>
                  Amount: <strong>₹{Number(form.amount || 0).toLocaleString()}</strong>
                </div>
              </div>

              <div className={styles.qrMode}>
                <button
                  type="button"
                  className={`${styles.qrModeBtn} ${qrMode === "upi" ? styles.qrModeActive : ""}`}
                  onClick={() => setQrMode("upi")}
                >
                  UPI
                </button>
                <button
                  type="button"
                  className={`${styles.qrModeBtn} ${qrMode === "link" ? styles.qrModeActive : ""}`}
                  onClick={() => setQrMode("link")}
                >
                  Link
                </button>
              </div>
            </div>

            <div className={styles.qrBody}>
              <div className={styles.qrCanvas}>
                <QRCodeCanvas
                  value={qrValue}
                  size={150}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin
                />
              </div>

              <div className={styles.qrInfo}>
                {qrMode === "upi" ? (
                  <>
                    <div className={styles.qrLine}>
                      <span>Payee</span>
                      <strong>{PAYEE_NAME}</strong>
                    </div>
                    <div className={styles.qrLine}>
                      <span>UPI</span>
                      <strong>{PAYEE_VPA}</strong>
                    </div>
                    <div className={styles.qrHint}>
                      Open GPay / PhonePe → Scan QR → Pay ₹{Number(form.amount || 0).toLocaleString()}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.qrHint}>
                      Scan to open this donation page on mobile.
                    </div>
                  </>
                )}

                <button type="button" className={styles.qrDownload} onClick={downloadQrPng}>
                  Download QR (PNG)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className={styles.grid}>
        {/* Donate */}
        <div className={styles.card}>
          <h3>Donate Now (Demo)</h3>

          <form onSubmit={handleDonate} className={styles.form}>
            <div className={styles.row}>
              <label>Amount (₹)</label>

              <div className={styles.amountOptions}>
                {[500, 1000, 5000, 10000].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    className={`${styles.amountBtn} ${
                      Number(form.amount) === amt ? styles.activeAmount : ""
                    }`}
                    onClick={() => setForm((p) => ({ ...p, amount: amt }))}
                  >
                    ₹{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="Enter custom amount"
                required
              />
            </div>

            <div className={styles.row}>
              <label>Name</label>
              <input
                value={form.donorName}
                onChange={(e) => setForm((p) => ({ ...p, donorName: e.target.value }))}
                placeholder="Your name"
                disabled={form.isAnonymous}
              />
            </div>

            <div className={styles.row2}>
              <div>
                <label>Phone</label>
                <input
                  value={form.donorPhone}
                  onChange={(e) => setForm((p) => ({ ...p, donorPhone: e.target.value }))}
                  placeholder="Optional"
                  disabled={form.isAnonymous}
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  value={form.donorEmail}
                  onChange={(e) => setForm((p) => ({ ...p, donorEmail: e.target.value }))}
                  placeholder="Optional"
                  disabled={form.isAnonymous}
                />
              </div>
            </div>

            <div className={styles.row}>
              <label>Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="City, State"
                disabled={form.isAnonymous}
              />
            </div>

            <div className={styles.row}>
              <label>Message / Note</label>
              <input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Optional message"
              />
            </div>

            <div className={styles.payMode}>
              <button
                type="button"
                className={`${styles.payModeBtn} ${
                  form.paymentMode === "payNow" ? styles.payModeActive : ""
                }`}
                onClick={() => setForm((p) => ({ ...p, paymentMode: "payNow" }))}
              >
                Pay Now
              </button>

              <button
                type="button"
                className={`${styles.payModeBtn} ${
                  form.paymentMode === "payLater" ? styles.payModeActive : ""
                }`}
                onClick={() => setForm((p) => ({ ...p, paymentMode: "payLater" }))}
              >
                Pay Later
              </button>
            </div>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(e) => setForm((p) => ({ ...p, isAnonymous: e.target.checked }))}
              />
              Hide your details (participate without revealing your details)
            </label>

            <button className={styles.btn} disabled={paying}>
              {paying ? "Processing..." : form.paymentMode === "payLater" ? "Submit Pledge" : "Pay & Donate"}
            </button>

            {msg && <div className={styles.msg}>{msg}</div>}
            <div className={styles.note}>
               Pay Now updates progress + leaderboard. Pay Later saves a pledge.
            </div>
          </form>
        </div>

        {/* Leaderboard */}
        <div className={styles.card}>
          <h3>Leaderboard</h3>

          <div className={styles.tabs}>
            <div className={styles.tabTitle}>Today Toppers (Paid Only)</div>
            <ul className={styles.list}>
              {lb.today.length === 0 ? (
                <li className={styles.empty}>No paid donations today</li>
              ) : (
                lb.today.map((x) => (
                  <li key={`t_${x.rank}_${x.donorName}`}>
                    <span className={styles.rank}>#{x.rank}</span>
                    <span className={styles.name}>{x.donorName}</span>
                    <span className={styles.amt}>₹{x.total.toLocaleString()}</span>
                  </li>
                ))
              )}
            </ul>

            <div className={styles.tabTitle}>Overall Toppers (Paid Only)</div>
            <ul className={styles.list}>
              {lb.overall.length === 0 ? (
                <li className={styles.empty}>No paid donations yet</li>
              ) : (
                lb.overall.map((x) => (
                  <li key={`o_${x.rank}_${x.donorName}`}>
                    <span className={styles.rank}>#{x.rank}</span>
                    <span className={styles.name}>{x.donorName}</span>
                    <span className={styles.amt}>₹{x.total.toLocaleString()}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Recent Donations */}
        <div className={styles.card}>
          <div className={styles.recentHeader}>
            <div>
              <h3>Recent Donations</h3>
              <div className={styles.recentMeta}>
                Showing <strong>{filteredRecent.length}</strong> / {recent.length}
              </div>
            </div>

            <div className={styles.recentControls}>
              <input
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / phone / email / receipt / payment / status..."
              />

              <label className={styles.smallCheck}>
                <input
                  type="checkbox"
                  checked={showAnonymous}
                  onChange={(e) => setShowAnonymous(e.target.checked)}
                />
                Show Anonymous
              </label>

              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setSearch("")}
                disabled={!search}
              >
                Clear
              </button>
            </div>
          </div>

          <ul className={styles.recent}>
            {filteredRecent.length === 0 ? (
              <li className={styles.empty}>No matching donations</li>
            ) : (
              filteredRecent.map((r) => (
                <li key={r.id} className={styles.recentItem}>
                  <div className={styles.rowLine}>
                    <span className={styles.name}>{r.donorName}</span>
                    <span className={styles.amt}>₹{Number(r.amount).toLocaleString()}</span>
                  </div>

                  <div className={styles.sub}>
                    <span
                      className={`${styles.badge} ${
                        r.status === "PAID" ? styles.badgePaid : styles.badgePledged
                      }`}
                    >
                      {r.status || "PAID"}
                    </span>
                    <span className={styles.muted}>Receipt: {r.receiptNo || "-"}</span>
                    <span className={styles.muted}>Payment: {r.paymentId || "-"}</span>
                  </div>

                  <div className={styles.sub}>
                    <span className={styles.muted}>📞 {r.donorPhone || "-"}</span>
                    <span className={styles.muted}>✉️ {r.donorEmail || "-"}</span>
                  </div>

                  <div className={styles.sub}>
                    <span className={styles.muted}>📍 {r.address || "-"}</span>
                    <span className={styles.muted}>
                      🕒 {r.paidAt ? new Date(r.paidAt).toLocaleString() : ""}
                    </span>
                  </div>

                  {r.note ? (
                    <div className={styles.sub}>
                      <span className={styles.muted}>📝 {r.note}</span>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

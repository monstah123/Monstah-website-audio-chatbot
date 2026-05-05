"use client";

import { useEffect, useState } from "react";

function isInstagramBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua);
}

export default function InstagramBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInstagramBrowser()) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "linear-gradient(135deg, #0d0d14, #111120)",
          border: "1px solid rgba(0,242,254,0.3)",
          borderRadius: "24px",
          padding: "32px 24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,242,254,0.08)",
          textAlign: "center",
          position: "relative",
          fontFamily: "inherit",
        }}
      >
        {/* Dismiss */}
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          style={{
            position: "absolute",
            top: "12px",
            right: "14px",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "rgba(255,255,255,0.45)",
            fontSize: "18px",
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>

        {/* Icon */}
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🎙️</div>

        {/* Message */}
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          Tap the{" "}
          <strong
            style={{
              color: "#00f2fe",
              fontWeight: 700,
            }}
          >
            ··· three dots
          </strong>{" "}
          at the top right and select{" "}
          <strong style={{ color: "#00f2fe", fontWeight: 700 }}>
            &ldquo;Open in external browser&rdquo;
          </strong>{" "}
          to activate the voice AI.
        </p>
      </div>
    </div>
  );
}

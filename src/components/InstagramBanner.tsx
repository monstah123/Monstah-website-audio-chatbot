"use client";

import { useEffect, useState } from "react";

/**
 * Detects Instagram's in-app browser and shows a persistent banner
 * asking the user to open the page in their real browser (Safari/Chrome).
 *
 * Why: Instagram's WebView blocks microphone access and auto-play audio,
 * so the voice chatbot cannot function inside the Instagram browser.
 *
 * Detection: The Instagram IAB injects "Instagram" into the User-Agent string.
 * Facebook's IAB uses "FBAN" / "FBAV". We handle both since users may share
 * the link on Facebook too.
 */

function isInstagramBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua);
}

export default function InstagramBanner() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isInstagramBrowser()) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select a hidden input
      const input = document.getElementById(
        "ig-banner-url-input"
      ) as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  return (
    <>
      {/* Full-screen dimmed overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 99999,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "0 0 env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Banner card */}
        <div
          style={{
            width: "100%",
            maxWidth: "480px",
            margin: "0 16px 24px",
            background: "linear-gradient(135deg, #0d0d14 0%, #111120 100%)",
            border: "1px solid rgba(0,242,254,0.25)",
            borderRadius: "24px",
            padding: "28px 24px 24px",
            boxShadow:
              "0 0 0 1px rgba(0,242,254,0.08), 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,242,254,0.06)",
            fontFamily: "inherit",
            position: "relative",
          }}
        >
          {/* Dismiss X */}
          <button
            onClick={() => setShow(false)}
            aria-label="Dismiss"
            style={{
              position: "absolute",
              top: "14px",
              right: "16px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              fontSize: "18px",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>

          {/* Mic icon */}
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(0,242,254,0.18), rgba(255,0,128,0.12))",
              border: "1px solid rgba(0,242,254,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              fontSize: "26px",
            }}
          >
            🎙️
          </div>

          {/* Heading */}
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
            }}
          >
            Mic Access Blocked
          </h2>

          {/* Body */}
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.6,
            }}
          >
            Instagram&apos;s browser blocks microphone access, so the voice AI
            can&apos;t work here.{" "}
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>
              Open this page in Safari or Chrome
            </strong>{" "}
            to talk to the AI.
          </p>

          {/* Instruction steps */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "20px",
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: "rgba(0,242,254,0.9)", display: "block", marginBottom: "6px" }}>
              How to open in your real browser:
            </strong>
            <span style={{ display: "block" }}>
              1. Tap <strong style={{ color: "rgba(255,255,255,0.7)" }}>⋯</strong> (three dots) in the top-right corner
            </span>
            <span style={{ display: "block" }}>
              2. Tap <strong style={{ color: "rgba(255,255,255,0.7)" }}>&quot;Open in external browser&quot;</strong>
            </span>
            <span style={{ display: "block", marginTop: "6px", color: "rgba(255,255,255,0.35)" }}>
              — or copy the link below and paste it in Safari / Chrome
            </span>
          </div>

          {/* Copy link button */}
          <button
            id="ig-banner-copy-btn"
            onClick={handleCopy}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              background: copied
                ? "linear-gradient(90deg, #00f2fe, #00c9a7)"
                : "linear-gradient(90deg, #00f2fe, #ff0080)",
              border: "none",
              color: copied ? "#000" : "#000",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              transition: "opacity 0.2s, background 0.4s",
              letterSpacing: "0.01em",
            }}
          >
            {copied ? "✓ Link Copied! Paste it in Safari / Chrome" : "📋 Copy Link to Open in Browser"}
          </button>

          {/* Hidden input fallback for clipboard */}
          <input
            id="ig-banner-url-input"
            readOnly
            value={currentUrl}
            style={{
              position: "absolute",
              opacity: 0,
              pointerEvents: "none",
              width: "1px",
              height: "1px",
              top: 0,
              left: 0,
            }}
          />
        </div>
      </div>
    </>
  );
}

"use client";

import VoiceChat from "@/components/VoiceChat";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";

function WidgetContent() {
  const searchParams = useSearchParams();
  const pos = searchParams.get("pos") || "right";
  const standalone = searchParams.get("standalone") === "1";

  if (standalone) {
    // Opened directly in the browser (e.g. iOS 15 fallback) — show with proper background
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          body, html {
            background: #0a0a0c !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }
        `}} />
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0',
          background: '#0a0a0c',
        }}>
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <VoiceChat />
          </div>
        </div>
      </>
    );
  }

  // Normal iframe mode — transparent background
  return (
    <div 
      className={`fixed inset-0 pointer-events-none flex items-end ${pos === 'left' ? 'justify-start' : 'justify-end'} p-4`}
      style={{ background: 'transparent' }}
    >
      <div className="pointer-events-auto">
        <VoiceChat />
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body, html { 
          background: transparent !important; 
          margin: 0 !important; 
          padding: 0 !important; 
          overflow: hidden !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}} />
      <Suspense fallback={null}>
        <WidgetContent />
      </Suspense>
    </>
  );
}

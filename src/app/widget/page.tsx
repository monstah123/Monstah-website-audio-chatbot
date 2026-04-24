"use client";

import VoiceChat from "@/components/VoiceChat";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Import global CSS directly to ensure styles load in the widget
import "../globals.css";

function WidgetContent() {
  const searchParams = useSearchParams();
  const pos = searchParams.get("pos") || "right";

  return (
    <div 
      className={`fixed inset-0 pointer-events-none flex items-end ${pos === 'left' ? 'justify-start' : 'justify-end'} p-6`}
      style={{ background: 'transparent' }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        body, html { 
          background: transparent !important; 
          margin: 0; 
          padding: 0; 
          overflow: hidden;
          width: 100%;
          height: 100%;
        }
      `}} />
      <div className="pointer-events-auto">
        <VoiceChat />
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetContent />
    </Suspense>
  );
}

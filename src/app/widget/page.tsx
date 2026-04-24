"use client";

import VoiceChat from "@/components/VoiceChat";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";

function WidgetContent() {
  const searchParams = useSearchParams();
  const pos = searchParams.get("pos") || "right";

  return (
    <div 
      className={`fixed inset-0 pointer-events-none flex items-end ${pos === 'left' ? 'justify-start' : 'justify-end'} p-4`}
      style={{ background: 'transparent' }}
    >
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

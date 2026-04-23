"use client";

import VoiceChat from "@/components/VoiceChat";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function WidgetContent() {
  const searchParams = useSearchParams();
  const pos = searchParams.get("pos") || "right";

  return (
    <div 
      style={{ background: 'transparent' }} 
      className={`fixed inset-0 pointer-events-none flex items-end ${pos === 'left' ? 'justify-start' : 'justify-end'} p-4`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        body { background: transparent !important; }
        html { background: transparent !important; }
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

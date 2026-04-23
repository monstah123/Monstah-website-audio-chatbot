import VoiceChat from "@/components/VoiceChat";

export default function WidgetPage() {
  return (
    <div style={{ background: 'transparent' }} className="fixed inset-0 pointer-events-none flex items-end justify-end p-4">
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

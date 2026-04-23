import VoiceChat from "@/components/VoiceChat";

export default function WidgetPage() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="absolute bottom-0 right-0 pointer-events-auto">
        <VoiceChat />
      </div>
    </div>
  );
}

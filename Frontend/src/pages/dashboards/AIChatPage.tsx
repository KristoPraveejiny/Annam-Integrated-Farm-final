import { SectionHeading } from '../../components/ui/SectionHeading';
import AIChatbot from '../../components/AIChatbot/AIChatbot';

export default function AIChatPage() {
  return (
    <div className="section-shell py-8 h-[calc(100vh-80px)] flex flex-col">
      <SectionHeading
        eyebrow="Smart Assistant"
        title="SmartFarm AI Advisor"
        description="Chat with an agriculture-focused assistant that uses farm data and live weather insights for practical recommendations."
        tone="light"
      />
      <div className="flex-1 mt-4">
        <AIChatbot />
      </div>
    </div>
  );
}

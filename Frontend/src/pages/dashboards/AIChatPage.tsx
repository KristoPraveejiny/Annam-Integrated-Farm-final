import { SectionHeading } from '../../components/ui/SectionHeading';
import AIChatbot from '../../components/AIChatbot/AIChatbot';

export default function AIChatPage() {
  return (
    <div className="section-shell py-8 h-[calc(100vh-80px)] flex flex-col">
      <SectionHeading
        eyebrow="Smart Assistant"
        title="AI Chatbot"
        description="Interact with the smart farming assistant for real-time recommendations, crop planning, and issue resolution."
        tone="light"
      />
      <div className="flex-1 mt-4">
        <AIChatbot />
      </div>
    </div>
  );
}

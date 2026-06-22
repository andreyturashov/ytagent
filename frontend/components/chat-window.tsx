import { Message } from "@/types/message";
import { MessageBubble } from "./message-buble";

interface Props {
  messages: Message[];
}

export function ChatWindow({
  messages,
}: Props) {
  return (
    <div className="flex-1 p-6">
      <div className="mb-4 text-xl font-bold">
        Chat
      </div>

      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
        />
      ))}
    </div>
  );
}
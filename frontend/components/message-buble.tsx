import { Message } from "@/types/message";

interface Props {
  message: Message;
}

export function MessageBubble({
  message,
}: Props) {
  const isUser =
    message.role === "user";

  return (
    <div
      className={`mb-4 flex ${
        isUser
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className="max-w-xl rounded-lg border p-3"
      >
        {message.content}
      </div>
    </div>
  );
}
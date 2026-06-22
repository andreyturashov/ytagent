import { useState } from "react";

interface Props {
  onSend: (message: string) => void;
}

export function ChatInput({
  onSend,
}: Props) {
  const [value, setValue] =
    useState("");

  const handleSend = () => {
    if (!value.trim()) return;

    onSend(value);

    setValue("");
  };

  return (
    <div className="border-t p-4">
      <input
        value={value}
        onChange={(e) =>
          setValue(e.target.value)
        }
        className="w-full border rounded p-2"
      />

      <button
        onClick={handleSend}
      >
        Send
      </button>
    </div>
  );
}
import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import { ChatInput } from "./chat-input";

describe("ChatInput", () => {
  it("renders", () => {
    render(<ChatInput onSend={vi.fn()} />);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Message } from "./Message";
import { renderMarkdown } from "@/lib/markdown";

describe("Message", () => {
  it("renders bot markdown html", () => {
    render(<Message role="bot" html={renderMarkdown("**hello**")} />);
    expect(screen.getByText("hello").tagName).toBe("STRONG");
  });
});

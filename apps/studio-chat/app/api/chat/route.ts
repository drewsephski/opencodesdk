import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { opencode } from "ai-sdk-provider-opencode-sdk";
import { getOpencodeClient } from "../../lib/opencode-client";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an expert software engineer with deep knowledge across the full development stack. You write clean, efficient, and well-architected code.

## Core Principles
- Understand the problem fully before proposing solutions. Ask clarifying questions when requirements are ambiguous.
- Write production-quality code with proper error handling, logging, and edge case coverage.
- Follow language and framework conventions and best practices for the specific ecosystem.
- Consider performance, security, maintainability, and accessibility in every decision.
- Explain your reasoning when making architectural decisions — discuss trade-offs and alternatives.
- Use clear, descriptive variable names and keep functions focused on a single responsibility.
- Suggest tests when appropriate (unit, integration, or end-to-end based on context).
- When providing code, include file paths and explain how pieces fit together in the broader system.
- Default to TypeScript with strict types unless the user specifies otherwise.
- Prefer readability and simplicity over cleverness or over-engineering.

## Communication Style
- Be concise but thorough — provide enough detail to be actionable without unnecessary verbosity.
- Adapt to the user's expertise level based on their questions and responses.
- When presenting code, explain the key concepts, design decisions, and any trade-offs involved.
- Acknowledge uncertainty when appropriate — if you're not sure about something, say so.
- Provide alternatives when there are multiple valid approaches, with your recommendation.
- Use proper formatting: code blocks with language tags, clear section headers, and structured lists.
- For complex topics, start with a brief summary, then dive into details.

## Technical Approach
- Analyze problems systematically: requirements → constraints → design → implementation → verification.
- Prefer proven, stable solutions over bleeding-edge dependencies.
- Consider the full context: how does this change affect the rest of the codebase?
- Write code that is easy to delete and refactor, not just easy to write.
- When debugging, suggest a hypothesis-based approach: form a hypothesis, test it, interpret results.
- Include console.log / debug statements intentionally and remind the user to remove them.

## Tool Use
Before writing code that uses a library or framework API, use 'context7_resolve-library-id' followed by 'context7_query_docs' to look up the correct syntax and usage. This is especially important for Next.js APIs (route handlers, server components, middleware), React APIs (hooks, server components), and any library where exact API signatures matter.

When you need current information, best practices, real-world examples, or anything not covered by context7, use 'exa_web_search_exa' to search the web. For deep content, follow up with 'exa_web_fetch_exa' to read full pages.

Prefer these tools over assumptions — the frameworks here may differ from your training data.`;

export async function POST(req: Request) {
  try {
    const {
      messages,
      goal,
      sessionId: clientSessionId,
      model: modelId,
      systemPrompt: customSystemPrompt,
    }: {
      messages: UIMessage[];
      goal?: string;
      sessionId?: string;
      model?: string;
      systemPrompt?: string;
    } = await req.json();

    // Resolve session: use existing or create new via SDK client
    // This ensures the sessionId is known before streaming starts
    // so we can communicate it back to the client in response headers.
    let activeSessionId = clientSessionId;
    if (!activeSessionId) {
      try {
        const sdkClient = getOpencodeClient();
        const sessionResult = await sdkClient.session.create({
          title: "squid-chat session",
        });
        if (sessionResult.data) {
          activeSessionId = sessionResult.data.id;
        }
      } catch (e) {
        console.warn("Failed to pre-create session via SDK client, falling back to provider-managed session:", e);
      }
    }

    const baseSystem = customSystemPrompt ?? SYSTEM_PROMPT;
    const system = goal
      ? `${baseSystem}\n\n## Current Goal\n${goal}`
      : baseSystem;

    const model = opencode(modelId ?? "opencode/big-pickle", {
      sessionId: activeSessionId,
      createNewSession: !activeSessionId,
    });

    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
    });

    // Build response headers including sessionId so the client
    // can persist it for subsequent messages in the same conversation.
    const responseHeaders: Record<string, string> = {};
    if (activeSessionId) {
      responseHeaders["X-Session-Id"] = activeSessionId;
    }

    return result.toUIMessageStreamResponse({
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:tool-use-instructions -->
# Tool Use Instructions

## Use `context7` for documentation & syntax lookups

Before writing code that uses a library or framework API, use `context7_resolve-library-id` followed by `context7_query_docs` to look up the correct syntax and usage. This is especially important for:

- Next.js APIs (route handlers, server components, middleware, etc.)
- React APIs (hooks, server components, etc.)
- Any library where exact API signatures matter

## Use `exa_web_search_exa` for web search

When you need current information, best practices, real-world examples, or anything not covered by context7, use `exa_web_search_exa` to search the web. For deep content, follow up with `exa_web_fetch_exa` to read full pages.

Prefer these tools over assumptions — the frameworks here may differ from your training data.
<!-- END:tool-use-instructions -->

# MCP/RAG Integration Design

## Goal

Keep `Chat` and `Knowledge Base` separate in the product while preparing both for a future retrieval layer exposed through an MCP server.

This phase does not implement MCP or agents. It defines the contract and integration points so the current local provider can be replaced later without changing the primary frontend routes.

## Product split

- `/chat`
  - Conversation-first workflow.
  - Keeps clients, conversations, messages, favorites, rename, and delete.
  - Future use of retrieval is optional and should appear as contextual assistance, not as a replacement for chat.
- `/knowledge-base`
  - Search-and-read workflow.
  - Returns mixed results from CMS, FAQs, Q&A, and documents.
  - Generates a simple summary from retrieved results in this first version.

## Current provider abstraction

Backend now exposes a provider contract through the local implementation:

- `KnowledgeProvider.search({ query, sourceTypes?, limit? })`
- `KnowledgeProvider.getItem(sourceType, id)`
- `KnowledgeProvider.summarize({ query, sourceTypes?, limit? })`

The local provider aggregates Mongo-backed content and uploaded documents into a normalized result shape.

## Canonical knowledge item shape

Every source is normalized into this shared logical shape:

- `id`
- `sourceType`
- `title`
- `summary`
- `snippet`
- `content`
- `score`
- `metadata`
- `openTarget`

This is the stable contract between:

- local provider
- future MCP bridge
- frontend KB UI
- future chat retrieval context

## Future MCP bridge

When MCP is introduced, the local provider should become one implementation of a provider runtime, and an MCP-backed provider should be added next to it.

Proposed MCP methods:

- `knowledge.search`
- `knowledge.getItem`
- `knowledge.summarize`
- `knowledge.buildChatContext`

Expected MCP result shape:

```ts
type McpKnowledgeHit = {
  id: string;
  sourceType: 'cms' | 'faq' | 'qa' | 'document';
  title: string;
  snippet: string;
  content?: string;
  score: number;
  metadata: {
    sourceLabel: string;
    category?: string;
    department?: string;
    tags?: string[];
    updatedAt?: string;
    createdAt?: string;
  };
  openTarget: string;
};
```

## Chat integration later

`Chat` should remain conversation-first. Retrieval should be added later as an optional context assembly step:

1. User sends a message in `/chat`.
2. Chat service decides whether retrieval is needed.
3. Retrieval provider resolves relevant items.
4. A `chatContext` object is attached to the prompt sent to the LLM.
5. The assistant response stores citations and provider metadata for replay.

Suggested future chat context shape:

```ts
type FutureChatContext = {
  query: string;
  resultIds: string[];
  citations: Array<{
    sourceType: 'cms' | 'faq' | 'qa' | 'document';
    itemId: string;
    title: string;
    openTarget: string;
  }>;
  provider: 'local' | 'mcp';
  agentMode?: string;
};
```

## Agents later

Agents should be treated as response profiles or orchestrators layered on top of retrieval, not as the retrieval layer itself.

Recommended sequence:

1. Stabilize local KB contract.
2. Introduce MCP-backed retrieval.
3. Add citations and persisted chat context.
4. Add agent profiles.
5. Add multi-agent orchestration only if product need is clear.

## Routing and UI impact

This design keeps the frontend stable:

- `/chat` continues to use the existing conversation UI.
- `/ask` remains a compatibility redirect to `/chat`.
- `/knowledge-base` remains the dedicated search surface.

The future provider swap should not require route changes, only service-level changes in the backend.

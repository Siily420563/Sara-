# SARA AI - Complete Long-Term Memory Extraction System
## Architecture, Technical Specification & Production Copy-Paste Code

This document provides the complete end-to-end architecture and the full copy-paste production code for SARA's **Autonomous Long-Term Memory Extraction & Recall Engine**.

---

## 1. System Architecture Overview

```
                                  USER INTERACTION
                        (Chat Message or Live Voice Audio)
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
        [Text Stream Route: /api/chat]         [Live Audio WebSocket: /ws/live]
                    │                                     │
                    ▼                                     ▼
           Gemini Flash 2.5 / 3            Gemini 3.1 Flash Live Preview
        (Tools: extract_fact, etc.)         (Tools: extract_fact, etc.)
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                       Autonomous Tool Call Detected:
                    extract_fact(fact, temporalType, resolvedTime)
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
          [Backend SSE / WS Event]               [Backend User Room]
         Sends toolCall payload to              Saves to user_rooms/
             connected client                      {userId}.json
                    │
                    ▼
          [Client UI Event Handler]
          App.tsx / CallScreen.tsx
                    │
                    ▼
          [addFact Action Dispatch]
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
 [UI Toast Alert]       [Dual Persistence Engine]
"Sara remembered: ..."  - LocalStorage ('sara_state')
                        - IndexedDB (STORES.APP_STATE)
                               │
                               ▼
                    [Prompt Context Loop]
        All saved facts are injected back into:
        1. /api/chat systemInstruction / prompt prefix
        2. Live WebSocket URL & systemInstruction
        --> Sara remembers user identity across sessions!
```

---

## 2. Core Components & Lifecycle

1. **Tool Definition (`extractFactDeclaration`)**:
   - Instructs Gemini with an explicit schema and description to aggressively catch implicit preferences, habits, identity markers, and relative temporal details.
2. **Temporal Resolution Engine**:
   - Relative timestamps like *"kal shaam ko"* or *"next Monday"* are resolved into ISO 8601 absolute timestamps using the user's local timezone.
3. **Dual Execution Paths**:
   - **Path A (Real-time Autonomous Chat)**: Gemini triggers `extract_fact` as a function call during chat generation. The backend streams this toolCall event over SSE to the client.
   - **Path B (Live Voice Audio Call)**: In low-latency bidirectional voice calls via Gemini Live API, the tool call is detected in audio chunks, acknowledged to the model immediately, and piped over WebSocket to the phone UI.
   - **Path C (Dedicated Background Analysis Endpoint)**: `/api/extract-fact` allows explicit or offline deep fact extraction without interrupting the chat response.
4. **Dual-Layer Persistence**:
   - Synchronous `localStorage` for instant UI renders.
   - Asynchronous `IndexedDB` (`idbSet`/`idbGet`) to prevent browser eviction on mobile PWA/Android.
   - Isolated server-side `user_rooms/{userId}.json` for cross-device/push notification continuity.
5. **Context Re-injection (The Feedback Loop)**:
   - Extracted facts are formatted into `Facts & Memories: [...]` and prepended to all subsequent conversations.

---

## 3. Full Production Code (Single Copy-Paste Ready Modules)

### Part 1: Type Definitions (`types.ts`)

```typescript
export type TemporalType = 'Upcoming' | 'Past' | 'Recurring' | 'General';

export interface Fact {
  id: string;
  text: string;
  date: string;
  temporalType?: TemporalType;
  resolvedTime?: string | null;
}

export interface ExtractedFactPayload {
  fact: string | null;
  temporalType?: TemporalType;
  resolvedTime?: string | null;
}

export interface MemoryEntry {
  id: string;
  text: string;
  dateMentioned: string;
  followUpDate: string;
  resolved: boolean;
  type?: string;
}
```

---

### Part 2: Backend Gemini Tool Declaration & Extraction Endpoints (`server-memory.ts`)

```typescript
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

export const extractFactDeclaration = {
  name: "extract_fact",
  description: "Extract a personal fact, preference, habit, interest, music taste, or favorite artist/singer about the user to remember for long term. Use this aggressively to save small or big details about the user, like 'Talha Anjum ke gaane sunao' means they like listening to Talha Anjum's music. Save it as a fact.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact: { 
        type: Type.STRING, 
        description: "The fact to remember (e.g. 'Likes listening to Talha Anjum's rap music', 'User is preparing for NEET')" 
      },
      temporalType: { 
        type: Type.STRING, 
        description: "Upcoming, Past, Recurring, General" 
      },
      resolvedTime: { 
        type: Type.STRING, 
        description: "ISO 8601 absolute time string if applicable, or null" 
      }
    },
    required: ["fact"]
  }
};

/**
 * Express router mounting the memory extraction endpoints
 */
export function registerMemoryRoutes(app: express.Express, ai: GoogleGenAI) {
  // Background fact extraction endpoint
  app.post('/api/extract-fact', async (req, res) => {
    try {
      const { message, localTime, timezone } = req.body;
      const prompt = `Analyze this user message: "${message}"
Current System Date and Time: ${localTime || new Date().toLocaleString()} (Timezone: ${timezone || 'UTC'})

Extract any personal facts, identity markers (like being a student, NEET aspirant, profession), preferences, habits, or temporal events.
Be highly sensitive to implicit context and small details the user drops in normal conversation.
If there is a temporal event (e.g., "kal jaana hai"), you MUST convert the relative time into an absolute date/time based on the current system time.
Store both the original phrase and the resolved absolute date/time in the text.

Respond ONLY with a valid JSON object. If there's nothing to extract, return {"fact": null}.
If there is a fact, return:
{
  "fact": "Clear statement of the fact (e.g., 'User is a NEET aspirant', 'User likes tea')",
  "temporalType": "Upcoming" | "Past" | "Recurring" | "General",
  "resolvedTime": "ISO 8601 string of the absolute time if applicable, or null"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const txt = response.text || "";
      const jsonMatch = txt.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.fact) {
          return res.json(parsed);
        }
      }
      return res.json({ fact: null });
    } catch (e: any) {
      console.error("Fact extraction error:", e?.message || e);
      return res.json({ fact: null });
    }
  });
}
```

---

### Part 3: Backend SSE Streaming Handler (`server-sse-handler.ts`)

```typescript
import { Response } from 'express';

/**
 * Handles incoming function calls during chat streaming.
 * Emits extract_fact to client while letting conversation continue smoothly.
 */
export function handleMemoryToolCall(call: { name: string; args: any }, res: Response) {
  if (call.name === 'extract_fact') {
    // Write SSE event to client
    res.write(`data: ${JSON.stringify({ 
      toolCall: { 
        name: 'extract_fact', 
        args: {
          fact: call.args.fact,
          temporalType: call.args.temporalType || 'General',
          resolvedTime: call.args.resolvedTime || null
        } 
      } 
    })}\n\n`);

    return { 
      success: true, 
      fact: call.args.fact,
      temporalType: call.args.temporalType || 'General',
      resolvedTime: call.args.resolvedTime || null
    };
  }
  return null;
}
```

---

### Part 4: Backend Live WebSocket Audio Handler (`server-ws-live.ts`)

```typescript
import WebSocket from 'ws';

/**
 * Processes tool calls during bidirectional Gemini Live WebRTC / WebSocket audio calls.
 */
export function handleLiveMemoryToolCall(call: any, clientWs: WebSocket, session: any) {
  if (call.name === 'extract_fact') {
    // 1. Send toolCall event to the frontend CallScreen
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ 
        toolCall: {
          name: 'extract_fact',
          args: call.args
        }
      }));
    }

    // 2. Acknowledge tool completion to Gemini Live session so audio synthesis continues
    try {
      session.sendToolResponse({
        functionResponses: [{
          id: call.id,
          name: call.name,
          response: { 
            success: true, 
            message: `Remembered fact: ${call.args.fact}` 
          }
        }]
      });
    } catch (err) {
      console.error("Error sending live tool response:", err);
    }
  }
}
```

---

### Part 5: Client Store with Dual Persistence (`client-store.ts`)

```typescript
import { useState, useEffect } from 'react';
import { Fact, TemporalType } from './types';

// Simple IndexedDB helper
const DB_NAME = 'sara_persistent_db';
const STORE_NAME = 'app_state';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIDB(key: string, data: any) {
  try {
    const db = await openIDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ key, ...data });
  } catch (e) {
    console.warn("IDB Save error:", e);
  }
}

async function loadFromIDB(key: string): Promise<any | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function useMemoryStore() {
  const [facts, setFacts] = useState<Fact[]>(() => {
    try {
      const raw = localStorage.getItem('sara_facts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Backup & sync with IDB
  useEffect(() => {
    try {
      localStorage.setItem('sara_facts', JSON.stringify(facts));
      saveToIDB('sara_facts', { facts });
    } catch (e) {
      console.warn("Memory persistence failed:", e);
    }
  }, [facts]);

  // IDB fallback on initial mount
  useEffect(() => {
    loadFromIDB('sara_facts').then(res => {
      if (res && Array.isArray(res.facts) && res.facts.length > 0) {
        setFacts(prev => (prev.length === 0 ? res.facts : prev));
      }
    });
  }, []);

  const addFact = (text: string, temporalType: TemporalType = 'General', resolvedTime: string | null = null) => {
    const newFact: Fact = {
      id: Date.now().toString(),
      text,
      date: new Date().toLocaleDateString(),
      temporalType,
      resolvedTime
    };
    setFacts(prev => [...prev, newFact]);
    return newFact;
  };

  const removeFact = (id: string) => {
    setFacts(prev => prev.filter(f => f.id !== id));
  };

  const editFact = (id: string, newText: string, temporalType?: TemporalType, resolvedTime?: string | null) => {
    setFacts(prev => prev.map(f => f.id === id ? {
      ...f,
      text: newText,
      temporalType: temporalType || f.temporalType,
      resolvedTime: resolvedTime !== undefined ? resolvedTime : f.resolvedTime
    } : f));
  };

  return { facts, addFact, removeFact, editFact };
}
```

---

### Part 6: Frontend Streaming & Live Event Listener (`client-listeners.ts`)

```typescript
import { Fact } from './types';

/**
 * Handle incoming tool executions from SSE stream
 */
export function handleStreamToolCall(
  toolCall: { name: string; args: any },
  onAddFact: (text: string, temporalType?: any, resolvedTime?: string | null) => void,
  onNotify: (msg: string) => void
) {
  if (toolCall.name === 'extract_fact') {
    const { fact, temporalType, resolvedTime } = toolCall.args;
    onAddFact(fact, temporalType || 'General', resolvedTime || null);
    onNotify(`Sara remembered: "${fact}"`);
  }
}

/**
 * Inject saved memories into chat prompt prefix
 */
export function buildMemoryPromptContext(facts: Fact[]): string {
  if (!facts || facts.length === 0) return '';
  const factsList = facts.map(f => f.text).join('; ');
  return `\n[KNOWN USER FACTS & LONG-TERM MEMORY]:\n${factsList}\nUse these personal facts naturally to personalize your answers.\n`;
}
```

---

## 4. Summary of Memory Extraction Workflow

| Step | Component | Action |
|------|-----------|--------|
| 1 | **User Input** | User says: *"Mujhe Talha Anjum ke gaane pasand hain aur main NEET ki taiyari kar raha hoon"* |
| 2 | **Gemini Model** | Reads tool declaration `extract_fact`, detects 2 strong user preferences/identity markers. |
| 3 | **Tool Invocation** | Emits `extract_fact({ fact: "User likes Talha Anjum's music", temporalType: "General" })` |
| 4 | **Backend Router** | Intercepts functionCall in SSE or WebSocket, transmits toolCall event to frontend. |
| 5 | **Frontend Store** | `addFact(...)` adds record, shows toast notification, saves to LocalStorage + IndexedDB. |
| 6 | **Future Prompts** | Next prompt receives `[KNOWN USER FACTS]`, so Sara greets the user accordingly!

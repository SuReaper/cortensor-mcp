

# Cortensor MCP

An MCP server that plugs Claude, Cursor, and other AI assistants directly into Cortensor's decentralized inference network. Session persistence, task orchestration, and validation tools included.

## Why Cortensor MCP?

### The Problem
AI agents lack:
- Persistent memory across conversations
- Access to decentralized inference networks
- Structured task orchestration tools
- Built-in validation and consistency checking

### Our Solution
Cortensor MCP provides a unified interface that:
- **Persists** session memory using Cloudflare Durable Objects
- **Connects** AI assistants to Cortensor's decentralized network
- **Orchestrates** tasks with structured routing (analyze, summarize, extract, generate, validate, decide, plan)
- **Validates** outputs against rubrics and checks for logical consistency

**Result:** AI agents gain persistent memory, decentralized inference capabilities, and powerful validation tools—all through a single MCP server.


### Creating a Persistent Session

```
Create a new session for my research project with initial context about blockchain analysis
```

### Routing Tasks to Cortensor

```
Analyze this smart contract code and identify potential security issues
```

### Validating Content Against a Rubric

```
Validate this documentation against criteria: clarity, completeness, and accuracy
```

## Features

| Tool | Description |
|------|-------------|
| **session_create** | Create or retrieve an agent session with persistent memory |
| **session_remember** | Store information in session memory for later recall |
| **session_recall** | Retrieve stored information from a session |
| **task_route** | Route structured tasks to Cortensor with output formatting |
| **validate_rubric** | Validate content against a weighted scoring rubric |
| **validate_consistency** | Check content for contradictions and logical issues |
| **research_analyze** | Analyze code, docs, or issues and extract actionable items |
| **research_summarize** | Generate digest, changelog, or status reports from multiple items |
| **cortensor_status** | Check Cortensor network connectivity and latency |
| **cortensor_infer** | Direct inference request to Cortensor network |

## Setup Guide

### 1. Clone and Install

```bash
git clone https://github.com/SuReaper/cortensor-mcp.git
cd cortensor-mcp
npm install
```

### 2. Run Locally or Deploy

```bash
# Local development
npx wrangler dev

# Production deployment
npx wrangler deploy
```

## MCP Configuration

Add to your MCP settings (Roo Code / Cline / Claude Desktop):

```json
{
  "mcpServers": {
    "cortensor": {
      "type": "sse",
      "url": "https://your-worker.workers.dev/sse",
      "alwaysAllow": [
        "session_create",
        "session_remember",
        "session_recall",
        "task_route",
        "validate_rubric",
        "validate_consistency",
        "research_analyze",
        "research_summarize",
        "cortensor_status",
        "cortensor_infer"
      ],
      "timeout": 300
    }
  }
}
```

## Task Types

| Type | Behavior |
|------|----------|
| `analyze` | Identify patterns and insights |
| `summarize` | Concise summary, preserve key info |
| `extract` | Extract data points and entities |
| `generate` | Generate content from requirements |
| `validate` | Check correctness, flag issues |
| `decide` | Reasoned decision with explanation |
| `plan` | Actionable steps with priorities |

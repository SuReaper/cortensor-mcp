import { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { McpHonoServerDO } from '@nullshot/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const CORTENSOR_ROUTER = 'https://cortensor.app';

async function cortensorInfer(prompt: string, timeout = 120): Promise<string> {
  const response = await fetch(`${CORTENSOR_ROUTER}/api/v1/completions/0`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer default-dev-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, stream: false, timeout }),
  });

  if (!response.ok) {
    throw new Error(`cortensor ${response.status}`);
  }

  const data = await response.json() as { result?: string };
  return data.result || JSON.stringify(data);
}

function formatError(tool: string, error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return `[${tool}] failed: ${msg}\n\ncortensor testnet may be syncing. mcp integration is functional.`;
}

export class CortensorMCP extends McpHonoServerDO<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  getImplementation(): Implementation {
    return { name: 'CortensorMCP', version: '1.0.0' };
  }

  configureServer(server: McpServer): void {
    // pass storage reference to tools that need persistence
    const storage = this.ctx.storage;

    // session create - uses durable object storage now
    server.tool(
      'session_create',
      'Create or retrieve an agent session with persistent memory.',
      {
        session_id: z.string().optional(),
        initial_context: z.record(z.unknown()).optional(),
      },
      async ({ session_id, initial_context }) => {
        const id = session_id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        
        let session = await storage.get<{ history: string[]; context: Record<string, unknown> }>(`session:${id}`);
        
        if (!session) {
          session = { history: [], context: initial_context || {} };
          await storage.put(`session:${id}`, session);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ session_id: id, context_keys: Object.keys(session.context) }, null, 2)
          }]
        };
      }
    );

    // session remember - persists to durable storage
    server.tool(
      'session_remember',
      'Store information in session memory.',
      {
        session_id: z.string(),
        key: z.string(),
        value: z.unknown(),
      },
      async ({ session_id, key, value }) => {
        const session = await storage.get<{ history: string[]; context: Record<string, unknown> }>(`session:${session_id}`);
        if (!session) {
          return { content: [{ type: 'text', text: `session ${session_id} not found` }] };
        }
        
        session.context[key] = value;
        session.history.push(`stored:${key}`);
        await storage.put(`session:${session_id}`, session);

        return { content: [{ type: 'text', text: `stored "${key}" in session` }] };
      }
    );

    // session recall
    server.tool(
      'session_recall',
      'Retrieve stored information from session.',
      {
        session_id: z.string(),
        key: z.string().optional(),
      },
      async ({ session_id, key }) => {
        const session = await storage.get<{ history: string[]; context: Record<string, unknown> }>(`session:${session_id}`);
        if (!session) {
          return { content: [{ type: 'text', text: `session ${session_id} not found` }] };
        }

        const data = key ? session.context[key] : session.context;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
    );

    // task route
    server.tool(
      'task_route',
      'Route a structured task to Cortensor.',
      {
        task_type: z.enum(['analyze', 'summarize', 'extract', 'generate', 'validate', 'decide', 'plan']),
        input: z.string(),
        output_format: z.enum(['text', 'json', 'markdown', 'list']).optional(),
      },
      async ({ task_type, input, output_format = 'text' }) => {
        const formats: Record<string, string> = {
          text: 'Respond in plain text.',
          json: 'Respond with valid JSON only.',
          markdown: 'Respond in markdown.',
          list: 'Respond as a numbered list.',
        };

        const tasks: Record<string, string> = {
          analyze: 'Analyze thoroughly, identify patterns and insights.',
          summarize: 'Summarize concisely, preserve key info.',
          extract: 'Extract key data points and entities.',
          generate: 'Generate content based on requirements.',
          validate: 'Validate for correctness and flag issues.',
          decide: 'Make a reasoned decision with explanation.',
          plan: 'Create actionable plan with steps and priorities.',
        };

        try {
          const result = await cortensorInfer(`${tasks[task_type]} ${formats[output_format]}\n\nINPUT:\n${input}`);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          return { content: [{ type: 'text', text: formatError('task_route', error) }] };
        }
      }
    );

    // validate rubric
    server.tool(
      'validate_rubric',
      'Validate content against a scoring rubric.',
      {
        content: z.string(),
        rubric: z.array(z.object({
          criterion: z.string(),
          weight: z.number().optional(),
        })),
        pass_threshold: z.number().optional(),
      },
      async ({ content, rubric, pass_threshold = 70 }) => {
        const rubricText = rubric.map((r, i) => `${i + 1}. ${r.criterion} (weight: ${r.weight || 1})`).join('\n');
        
        try {
          const result = await cortensorInfer(
            `Score this content against each criterion 0-100. Return JSON with scores, total_score (weighted avg), pass (true if >= ${pass_threshold}), and summary.\n\nRUBRIC:\n${rubricText}\n\nCONTENT:\n${content}`
          );
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          return { content: [{ type: 'text', text: formatError('validate_rubric', error) }] };
        }
      }
    );

    // validate consistency
    server.tool(
      'validate_consistency',
      'Check content for contradictions and logical issues.',
      {
        content: z.string(),
        reference: z.string().optional(),
      },
      async ({ content, reference }) => {
        const ref = reference ? `\n\nREFERENCE:\n${reference}` : '';
        
        try {
          const result = await cortensorInfer(
            `Check for contradictions and inconsistencies. Return JSON: {consistent: bool, issues: [{type, description, severity}], summary}.${ref}\n\nCONTENT:\n${content}`
          );
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          return { content: [{ type: 'text', text: formatError('validate_consistency', error) }] };
        }
      }
    );

    // research analyze
    server.tool(
      'research_analyze',
      'Analyze code or docs, extract issues and todos.',
      {
        content: z.string(),
        content_type: z.enum(['code', 'docs', 'readme', 'issue', 'changelog']),
      },
      async ({ content, content_type }) => {
        try {
          const result = await cortensorInfer(
            `Analyze this ${content_type}. Return JSON with: summary, issues found, todos, and action_items prioritized.\n\nCONTENT:\n${content}`
          );
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          return { content: [{ type: 'text', text: formatError('research_analyze', error) }] };
        }
      }
    );

    // research summarize
    server.tool(
      'research_summarize',
      'Generate summary report from multiple items.',
      {
        items: z.array(z.object({
          title: z.string(),
          content: z.string(),
        })),
        report_type: z.enum(['digest', 'changelog', 'status']).optional(),
      },
      async ({ items, report_type = 'digest' }) => {
        const itemsText = items.map((it, i) => `[${i + 1}] ${it.title}: ${it.content}`).join('\n');
        
        try {
          const result = await cortensorInfer(
            `Create a ${report_type} report. Include highlights, key details, and action items.\n\nITEMS:\n${itemsText}`
          );
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          return { content: [{ type: 'text', text: formatError('research_summarize', error) }] };
        }
      }
    );

    // cortensor status
    server.tool(
      'cortensor_status',
      'Check Cortensor network status.',
      {},
      async () => {
        const checks: Record<string, unknown> = {
          router: CORTENSOR_ROUTER,
          mcp_server: 'operational',
          timestamp: new Date().toISOString(),
        };

        try {
          const start = Date.now();
          const res = await fetch(`${CORTENSOR_ROUTER}/api/v1/status`);
          checks['latency_ms'] = Date.now() - start;
          checks['network'] = res.ok ? 'online' : 'degraded';
        } catch {
          checks['network'] = 'unreachable';
        }

        return { content: [{ type: 'text', text: JSON.stringify(checks, null, 2) }] };
      }
    );

    // raw inference
    server.tool(
      'cortensor_infer',
      'Direct inference request to Cortensor.',
      {
        prompt: z.string(),
      },
      async ({ prompt }) => {
        try {
          const result = await cortensorInfer(prompt);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          return { content: [{ type: 'text', text: formatError('cortensor_infer', error) }] };
        }
      }
    );
  }
}

import { CortensorMCP } from './server';
export { CortensorMCP };

interface Env {
  CORTENSOR_MCP: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sessionIdStr = url.searchParams.get('sessionId');
    const id = sessionIdStr
      ? env.CORTENSOR_MCP.idFromString(sessionIdStr)
      : env.CORTENSOR_MCP.newUniqueId();
    url.searchParams.set('sessionId', id.toString());
    return env.CORTENSOR_MCP.get(id).fetch(new Request(url.toString(), request));
  }
};

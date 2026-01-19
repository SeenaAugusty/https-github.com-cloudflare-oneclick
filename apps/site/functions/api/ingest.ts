
export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  const endpoint = (env as any).WORKER_ENDPOINT as string | undefined;
  if (!endpoint) {
    return new Response("WORKER_ENDPOINT not configured", { status: 500 });
  }

  // Forward request body and headers to Worker base URL
  const url = new URL(endpoint);
  // ensure no double slash
  const target = url.toString().replace(/\/$/, "");

  const resp = await fetch(target, {
    method: "POST",
    headers: request.headers,
    body: request.body,
    redirect: "manual",
  });
  return new Response(null, { status: resp.status });
};

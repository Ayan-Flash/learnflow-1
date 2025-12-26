import Head from "next/head";

export default function ApiInfoPage() {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  return (
    <>
      <Head>
        <title>LearnFlow AI — API</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-slate-900">Backend connection</h1>
          <p className="mt-2 text-sm text-slate-700">
            This UI connects directly to the backend Express server.
          </p>

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-600">NEXT_PUBLIC_BACKEND_URL</div>
            <div className="mt-1 font-mono text-sm text-slate-900">{backend}</div>
          </div>

          <div className="mt-4 text-sm text-slate-700">
            <div className="font-medium">Backend endpoints</div>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <span className="font-mono">POST {backend}/api/chat</span>
              </li>
              <li>
                <span className="font-mono">POST {backend}/api/assignment/generate</span>
              </li>
              <li>
                <span className="font-mono">POST {backend}/api/assignment/evaluate</span>
              </li>
            </ul>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            If you see network errors, start the backend and set <span className="font-mono">NEXT_PUBLIC_BACKEND_URL</span>.
          </p>
        </div>
      </main>
    </>
  );
}

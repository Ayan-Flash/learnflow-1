import Head from "next/head";

import { ChatWindow } from "../components/ChatWindow";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>LearnFlow AI</title>
        <meta name="description" content="Depth-driven learning assistant" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <ChatWindow />
      </main>
    </>
  );
}

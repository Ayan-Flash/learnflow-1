import { useMemo, useState } from "react";

import {
  evaluateAssignment,
  generateAssignment,
  sendChat,
  type Assignment,
  type ChatMode,
  type DepthLevel
} from "../utils/apiClient";
import { AssignmentFeedback } from "./AssignmentFeedback";
import { DepthSelector } from "./DepthSelector";
import { MessageBubble, type MessageRole } from "./MessageBubble";
import { ModeSelector } from "./ModeSelector";

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  followUps?: string[];
  assignmentFeedback?: {
    ethical_note: string;
    hints: string[];
    next_steps: string[];
  } | null;
};

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return String(Date.now() + Math.random());
};

export function ChatWindow() {
  const [depth, setDepth] = useState<DepthLevel>("Core");
  const [mode, setMode] = useState<ChatMode>("Learning");
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId(),
      role: "assistant",
      text: "Hi! I’m LearnFlow AI. Pick a depth, pick a mode, and ask what you’re learning."
    }
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignmentTopic, setAssignmentTopic] = useState<string>("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [studentResponse, setStudentResponse] = useState<string>("");
  const [evaluation, setEvaluation] = useState<
    | null
    | {
        conceptual_score: number;
        strengths: string[];
        missing_concepts: string[];
        hints: string[];
        next_steps: string[];
        flags: string[];
      }
  >(null);

  const canUseAssignmentTools = mode === "Assignment Help";

  const placeholder = useMemo(() => {
    return mode === "Learning"
      ? "Ask a question (e.g., 'Explain recursion')"
      : "Describe the assignment and what you tried (no need to paste the whole prompt)";
  }, [mode]);

  const onSend = async () => {
    const message = input.trim();
    if (!message || busy) return;

    setError(null);
    setBusy(true);

    const userMsg: ChatMessage = { id: makeId(), role: "user", text: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const resp = await sendChat({ message, depth_level: depth, mode });
      if (!resp.ok || !resp.data) throw new Error(resp.error?.message || "Request failed");

      const combinedText =
        resp.data.answer +
        (resp.data.follow_up_questions.length
          ? "\n\nCheck for understanding:\n- " + resp.data.follow_up_questions.join("\n- ")
          : "");

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: combinedText,
        followUps: resp.data.follow_up_questions,
        assignmentFeedback: resp.data.assignment_feedback
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text:
            "I hit an error talking to the backend. Please check that the backend is running and your NEXT_PUBLIC_BACKEND_URL is correct."
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onGenerateAssignment = async () => {
    const topic = assignmentTopic.trim();
    if (!topic || busy) return;

    setBusy(true);
    setError(null);
    setEvaluation(null);

    try {
      const resp = await generateAssignment({ topic, depth_level: depth });
      if (!resp.ok || !resp.data) throw new Error(resp.error?.message || "Failed to generate assignment");
      setAssignment(resp.data);

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: `Assignment generated: ${resp.data.title}\n\n${resp.data.prompt}`
        }
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate assignment");
    } finally {
      setBusy(false);
    }
  };

  const onEvaluateAssignment = async () => {
    if (!assignment || busy) return;
    const response = studentResponse.trim();
    if (!response) return;

    setBusy(true);
    setError(null);

    try {
      const resp = await evaluateAssignment({ assignment, student_response: response });
      if (!resp.ok || !resp.data) throw new Error(resp.error?.message || "Failed to evaluate");
      setEvaluation(resp.data.feedback);

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: "I evaluated your response. See feedback below."
        }
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to evaluate assignment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">LearnFlow AI</div>
            <div className="text-sm text-slate-600">
              Tutor + mentor with depth control. Assignment help = hints and reasoning (no final answers).
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DepthSelector value={depth} onChange={setDepth} />
            <ModeSelector value={mode} onChange={(m) => {
              setMode(m);
              setAssignment(null);
              setEvaluation(null);
            }} />
          </div>
        </div>

        {canUseAssignmentTools ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-slate-600">Assignment topic</div>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="e.g., Pythagorean theorem"
                value={assignmentTopic}
                onChange={(e) => setAssignmentTopic(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={onGenerateAssignment}
                disabled={busy || !assignmentTopic.trim()}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Generate assignment
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <MessageBubble role={m.role}>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </MessageBubble>

              {m.role === "assistant" && m.assignmentFeedback ? (
                <div className="ml-0 max-w-[85%]">
                  <AssignmentFeedback
                    title="Assignment help"
                    ethicalNote={m.assignmentFeedback.ethical_note}
                    hints={m.assignmentFeedback.hints}
                    nextSteps={m.assignmentFeedback.next_steps}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {canUseAssignmentTools && assignment ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="text-sm font-semibold text-slate-900">Assignment workspace</div>
          <div className="mt-1 text-xs text-slate-600">
            Write your attempt below. You’ll get feedback + hints (no final answers).
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 whitespace-pre-wrap">
            {assignment.prompt}
          </div>

          <textarea
            className="mt-3 h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            placeholder="Paste your attempt here..."
            value={studentResponse}
            onChange={(e) => setStudentResponse(e.target.value)}
          />

          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={onEvaluateAssignment}
              disabled={busy || !studentResponse.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Evaluate my response
            </button>
            <button
              type="button"
              onClick={() => {
                setStudentResponse("");
                setEvaluation(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>

          {evaluation ? (
            <div className="mt-4">
              <AssignmentFeedback
                title="Feedback"
                ethicalNote="I’m giving conceptual feedback and hints, not a final answer."
                conceptualScore={evaluation.conceptual_score}
                strengths={evaluation.strengths}
                missingConcepts={evaluation.missing_concepts}
                hints={evaluation.hints}
                nextSteps={evaluation.next_steps}
                flags={evaluation.flags}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-col gap-2 md:flex-row">
          <textarea
            className="h-14 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSend();
            }}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={busy || !input.trim()}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Send"}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Tip: Press Ctrl/⌘ + Enter to send.
        </div>
      </div>
    </div>
  );
}

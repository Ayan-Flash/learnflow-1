import axios from "axios";

export type DepthLevel = "Core" | "Applied" | "Mastery";
export type ChatMode = "Learning" | "Assignment Help";

export interface ChatRequest {
  message: string;
  depth_level: DepthLevel;
  mode: ChatMode;
}

export interface ChatResponse {
  ok: boolean;
  data?: {
    answer: string;
    follow_up_questions: string[];
    assignment_feedback: null | {
      ethical_note: string;
      hints: string[];
      next_steps: string[];
    };
    meta: {
      prompt_version: string;
      depth_level: DepthLevel;
      mode: ChatMode;
      tokens: { input: number; output: number };
      ethics: { flags: string[]; redacted?: boolean };
    };
  };
  error?: { message: string; status: number; request_id?: string };
}

export interface Assignment {
  id: string;
  topic: string;
  depth_level: DepthLevel;
  title: string;
  prompt: string;
  expected_concepts: string[];
  hints: string[];
  rubric: string[];
  created_at: string;
}

export interface GenerateAssignmentRequest {
  topic: string;
  depth_level: DepthLevel;
}

export interface GenerateAssignmentResponse {
  ok: boolean;
  data?: Assignment;
  error?: { message: string; status: number };
}

export interface AssignmentEvaluation {
  conceptual_score: number;
  strengths: string[];
  missing_concepts: string[];
  hints: string[];
  next_steps: string[];
  flags: string[];
}

export interface EvaluateAssignmentRequest {
  assignment: Assignment;
  student_response: string;
}

export interface EvaluateAssignmentResponse {
  ok: boolean;
  data?: {
    feedback: AssignmentEvaluation;
    ethical_note: string;
  };
  error?: { message: string; status: number };
}

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export const api = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" }
});

export const sendChat = async (req: ChatRequest): Promise<ChatResponse> => {
  const { data } = await api.post<ChatResponse>("/api/chat", req);
  return data;
};

export const generateAssignment = async (
  req: GenerateAssignmentRequest
): Promise<GenerateAssignmentResponse> => {
  const { data } = await api.post<GenerateAssignmentResponse>("/api/assignment/generate", req);
  return data;
};

export const evaluateAssignment = async (
  req: EvaluateAssignmentRequest
): Promise<EvaluateAssignmentResponse> => {
  const { data } = await api.post<EvaluateAssignmentResponse>("/api/assignment/evaluate", req);
  return data;
};

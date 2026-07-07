import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

export const MODEL_ID = "us.anthropic.claude-opus-4-6-v1";

const token = process.env.AWS_BEARER_TOKEN_BEDROCK || "";

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: { accessKeyId: "unused", secretAccessKey: "unused" },
});

bedrockClient.middlewareStack.add(
  (next) => async (args: any) => {
    args.request.headers["Authorization"] = `Bearer ${token}`;
    return next(args);
  },
  { step: "finalizeRequest", name: "bearerAuth", override: true }
);

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: { type: string; text: string }[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

export async function chat(
  messages: Message[],
  options?: { system?: string; maxTokens?: number }
): Promise<ClaudeResponse> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: options?.maxTokens ?? 4096,
    ...(options?.system && { system: options.system }),
    messages,
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: Buffer.from(body),
  });

  const res = await bedrockClient.send(command);
  return JSON.parse(new TextDecoder().decode(res.body)) as ClaudeResponse;
}

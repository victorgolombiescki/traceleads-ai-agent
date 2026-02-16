import { invokeLLM } from "../core/llm";

/**
 * Extract structured data from user message using JSON schema
 */
export async function extractStructuredData<T = any>(
  systemPrompt: string,
  userMessage: string,
  schema: {
    name: string;
    schema: any;
  },
): Promise<T | null> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          strict: true,
          schema: schema.schema,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    return JSON.parse(content) as T;
  } catch (error) {
    console.error("[LLM] Structured extraction failed:", error);
    return null;
  }
}

/**
 * Generate a natural language response
 */
export async function generateResponse(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string }> = [],
): Promise<string> {
  try {
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory,
      { role: "user" as const, content: userMessage },
    ];

    const response = await invokeLLM({ messages });
    const content = response.choices[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
    return "Desculpe, não consegui gerar uma resposta.";
  } catch (error) {
    console.error("[LLM] Response generation failed:", error);
    return "Desculpe, ocorreu um erro ao processar sua mensagem.";
  }
}

/**
 * Extract a simple text field (name, email, phone, etc.)
 */
export async function extractTextField(
  fieldName: string,
  fieldDescription: string,
  userMessage: string,
  validationRegex?: RegExp,
): Promise<string | null> {
  const systemPrompt = `Você é um assistente que extrai informações de mensagens.
Sua tarefa é extrair ${fieldDescription} da mensagem do usuário.

IMPORTANTE:
- Se a mensagem contém ${fieldDescription}, extraia-o exatamente como foi escrito
- Aceite nomes simples, compostos, apelidos - qualquer texto que pareça ser ${fieldDescription}
- Se realmente não houver ${fieldDescription} na mensagem, retorne null
- Para nomes: aceite qualquer palavra que pareça ser um nome próprio

Exemplos para nomes:
- "victor" → {"name": "Victor"}
- "joão silva" → {"name": "João Silva"}
- "meu nome é maria" → {"name": "Maria"}`;

  const result = await extractStructuredData<Record<string, string | null>>(
    systemPrompt,
    userMessage,
    {
      name: `extract_${fieldName}`,
      schema: {
        type: "object",
        properties: {
          [fieldName]: {
            type: ["string", "null"],
            description: fieldDescription,
          },
        },
        required: [fieldName],
        additionalProperties: false,
      },
    },
  );

  console.log(`[LLM] Extracted ${fieldName} from "${userMessage}":`, result);

  const value = result?.[fieldName];
  if (!value || value === "null") return null;

  // Apply validation if provided
  if (validationRegex && !validationRegex.test(value)) {
    console.log(`[LLM] Validation failed for ${fieldName}:`, value);
    return null;
  }

  return value;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (Brazilian format with DDD)
 */
export function isValidPhone(phone: string): boolean {
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  // Brazilian phone: 10-11 digits (DDD + number)
  return cleaned.length >= 10 && cleaned.length <= 11;
}

/**
 * Format phone number to standard format
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

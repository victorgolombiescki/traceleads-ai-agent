import { invokeLLM } from "../core/llm";

/**
 * Detect if user message is a question or objection rather than providing requested data
 */
export async function detectQuestionOrObjection(
  userMessage: string,
  expectedDataType: string, // "name", "email", "phone"
): Promise<{ isQuestion: boolean; intent: string }> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é um analisador de intenção de mensagens. Determine se o usuário está fazendo uma pergunta/objeção OU fornecendo o dado solicitado.

Dado solicitado: ${expectedDataType}

Exemplos de PERGUNTAS/OBJEÇÕES:
- "oi?"
- "o que você faz?"
- "por que precisa disso?"
- "não quero dar meu email"
- "isso é seguro?"
- "quem é você?"

Exemplos de DADOS FORNECIDOS:
- "João Silva" (para nome)
- "joao@email.com" (para email)
- "11987654321" (para telefone)
- "Meu nome é Maria"`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "intent_detection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isQuestion: {
                type: "boolean",
                description: "true se é uma pergunta/objeção, false se está fornecendo o dado",
              },
              intent: {
                type: "string",
                description: "Descrição da intenção do usuário em português",
              },
            },
            required: ["isQuestion", "intent"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        isQuestion: parsed.isQuestion || false,
        intent: parsed.intent || "unclear",
      };
    }

    return { isQuestion: false, intent: "unclear" };
  } catch (error) {
    console.error("[detectQuestionOrObjection] Error:", error);
    return { isQuestion: false, intent: "error" };
  }
}

/**
 * Validate if user's response is a valid answer to a strategic question
 */
export async function validateStrategicAnswer(
  question: string,
  userResponse: string,
): Promise<{ isValid: boolean; reason: string }> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é um validador de respostas. Determine se a resposta do usuário é válida para a pergunta estratégica feita.

Pergunta feita: "${question}"

Uma resposta VÁLIDA deve:
- Responder diretamente à pergunta estratégica (mesmo que seja uma resposta negativa)
- Fornecer informações relevantes sobre o tema perguntado
- Pode ser uma resposta negativa válida ("não", "ainda não", "não usei nenhuma", "nunca tentei")
- Pode ser uma resposta válida mas um pouco vaga, desde que responda à pergunta

Uma resposta INVÁLIDA é quando:
- É apenas uma saudação ("oi", "olá", "tudo bem?", "e aí?")
- É uma pergunta de volta ("você quer saber?", "por que pergunta isso?", "qual é a sua?")
- É uma resposta muito genérica sem contexto ("pode ser", "talvez", "não sei", "nada")
- É uma objeção ou recusa ("não quero responder", "não tenho tempo", "não quero falar sobre isso")
- Não tem relação com a pergunta feita
- É muito curta e sem contexto ("ok", "tudo bem", "beleza")

IMPORTANTE: Respostas negativas são VÁLIDAS se respondem à pergunta:
- "não" → VÁLIDA se a pergunta é "Você já tentou...?"
- "ainda não" → VÁLIDA se a pergunta é sobre tentativas
- "não usei nenhuma" → VÁLIDA se a pergunta é sobre soluções tentadas
- "nunca tentei" → VÁLIDA se a pergunta é sobre tentativas

Exemplos de respostas VÁLIDAS:
- "Tenho dificuldade em gerenciar meu tempo e priorizar tarefas"
- "Quero aumentar minhas vendas em 30% nos próximos 6 meses"
- "Já tentei usar ferramentas de automação, mas não funcionaram bem"
- "Falta de leads qualificados"
- "Preciso melhorar minha presença online"
- "melhorar esse processo" (responde à pergunta, mesmo sendo vaga)
- "AINDA NÃO" (resposta negativa válida)
- "NÃO USEI NENHUMA" (resposta negativa válida)
- "não" (se a pergunta é sobre tentativas/soluções)

Exemplos de respostas INVÁLIDAS:
- "oi"
- "voce quer saber a minha dor?"
- "pode ser" (muito genérico, sem contexto)
- "não sei" (muito genérico, sem contexto)
- "tudo bem"
- "ok"
- "4" (quando a pergunta não é sobre números)`,
        },
        {
          role: "user",
          content: `Resposta do usuário: "${userResponse}"`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "answer_validation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isValid: {
                type: "boolean",
                description: "true se a resposta é válida e responde à pergunta, false caso contrário",
              },
              reason: {
                type: "string",
                description: "Breve explicação do motivo (ex: 'Resposta válida sobre desafios de gestão' ou 'Apenas uma saudação, não responde à pergunta')",
              },
            },
            required: ["isValid", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        isValid: parsed.isValid || false,
        reason: parsed.reason || "Não foi possível validar",
      };
    }

    return { isValid: false, reason: "Erro ao processar validação" };
  } catch (error) {
    console.error("[validateStrategicAnswer] Error:", error);
    // Em caso de erro, assumimos que a resposta é válida para não bloquear o fluxo
    return { isValid: true, reason: "Erro na validação, aceitando resposta" };
  }
}

/**
 * Generate a helpful explanation when user asks questions
 */
export async function generateExplanation(
  companyName: string,
  dataType: string, // "name", "email", "phone"
  userQuestion: string,
): Promise<string> {
  try {
    const dataExplanations: Record<string, string> = {
      name: "seu nome para personalizar nossa conversa e identificar você corretamente",
      email: "seu e-mail para enviar confirmações e materiais relevantes",
      phone: "seu telefone para contato direto caso necessário",
    };

    const explanation = dataExplanations[dataType] || "essa informação";

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é o assistente virtual da ${companyName}. O usuário fez uma pergunta/objeção quando você pediu ${explanation}.

Gere uma resposta amigável e profissional que:
1. Responda à dúvida do usuário
2. Explique brevemente por que você precisa dessa informação
3. Reforce que os dados são seguros e usados apenas para atendimento
4. Peça novamente a informação de forma natural

Seja empático, conciso (máximo 3 linhas) e mantenha o tom conversacional.`,
        },
        {
          role: "user",
          content: userQuestion,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : `Entendo sua dúvida! Preciso de ${explanation} para te atender melhor. Pode me informar, por favor?`;
  } catch (error) {
    console.error("[generateExplanation] Error:", error);
    return `Preciso dessa informação para te atender melhor. Pode me informar, por favor?`;
  }
}

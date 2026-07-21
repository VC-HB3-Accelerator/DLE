/**
 * Формат tool-результатов для Ollama /api/chat (role=tool, tool_name).
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */

/**
 * @param {object} toolCall - tool_call от модели
 * @param {unknown} result - результат executeToolCall
 * @returns {{ role: 'tool', tool_name: string, content: string }}
 */
function toOllamaToolMessage(toolCall, result) {
  const toolName = toolCall?.function?.name || toolCall?.name || 'unknown';
  const content = typeof result === 'string' ? result : JSON.stringify(result ?? null);
  return {
    role: 'tool',
    tool_name: toolName,
    content
  };
}

module.exports = {
  toOllamaToolMessage
};

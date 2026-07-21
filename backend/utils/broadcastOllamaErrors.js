/**
 * Классификация ошибок LLM для broadcast-агента.
 * Unload модели — только при реальном таймауте Ollama, не при preempt/abort очереди.
 */

/**
 * @param {unknown} error
 * @returns {{ isQueueWaitTimeout: boolean, isPreemptAbort: boolean, isOllamaTimeout: boolean }}
 */
function classifyBroadcastLlmError(error) {
  const msg = String(error?.message || error || '');
  const isQueueWaitTimeout = /Queue timeout/i.test(msg);
  // AIQueue при preempt ставит message === 'aborted'; axios cancel — canceled / CanceledError
  const isPreemptAbort =
    msg === 'aborted'
    || /^canceled$/i.test(msg)
    || error?.name === 'CanceledError'
    || error?.name === 'AbortError'
    || error?.code === 'ERR_CANCELED';
  const isOllamaTimeout =
    !isQueueWaitTimeout
    && !isPreemptAbort
    && /timeout/i.test(msg);

  return { isQueueWaitTimeout, isPreemptAbort, isOllamaTimeout };
}

module.exports = {
  classifyBroadcastLlmError
};

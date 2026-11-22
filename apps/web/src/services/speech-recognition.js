// This adapter can be replaced with a server-backed ASR provider without changing the form.
export function createBrowserSpeechRecognition({
  onFinal,
  onInterim,
  onError,
  onEnd,
  scope = globalThis,
}) {
  const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  const finalized = new Set();
  let accepting = false;
  recognition.onresult = (event) => {
    if (!accepting) return;
    let final = '',
      interim = '';
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index];
      if (result.isFinal) {
        if (!finalized.has(index)) final += result[0].transcript;
        finalized.add(index);
      } else interim += result[0].transcript;
    }
    if (final) onFinal?.(final);
    onInterim?.(interim);
  };
  recognition.onerror = (event) => {
    if (!accepting) return;
    if (event.error !== 'aborted') onError?.(event.error);
  };
  recognition.onend = () => {
    if (!accepting) return;
    accepting = false;
    onInterim?.('');
    onEnd?.();
  };
  return {
    start: () => {
      finalized.clear();
      accepting = true;
      recognition.start();
    },
    stop: () => recognition.stop(),
    abort: () => {
      accepting = false;
      recognition.abort();
    },
  };
}

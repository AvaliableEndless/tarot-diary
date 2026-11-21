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
  recognition.onresult = (event) => {
    let final = '',
      interim = '';
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index];
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (final) onFinal?.(final);
    onInterim?.(interim);
  };
  recognition.onerror = (event) => {
    if (event.error !== 'aborted') onError?.(event.error);
  };
  recognition.onend = () => {
    onInterim?.('');
    onEnd?.();
  };
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}

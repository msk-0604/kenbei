export function pdfViewerHtml(base64: string, page: number): string {
  const safe = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const pageNum = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=6, user-scalable=yes" />
<style>
  html, body { margin: 0; padding: 0; background: #F4F1EA; }
  #wrap { min-height: 100%; display: flex; justify-content: center; }
  canvas { width: 100%; height: auto; display: block; }
</style>
</head>
<body>
<div id="wrap"><canvas id="c"></canvas></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const PAGE = ${pageNum};
  try {
    const raw = atob("${safe}");
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "meta", pages: pdf.numPages }));
      }
      const target = Math.min(PAGE, pdf.numPages);
      return pdf.getPage(target).then(function (page) {
        const scale = 1.5;
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.getElementById("c");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({ canvasContext: ctx, viewport: viewport }).promise;
      });
    }).then(function () {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ready" }));
      }
    }).catch(function (err) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: String(err) }));
      }
    });
  } catch (err) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: String(err) }));
    }
  }
</script>
</body>
</html>`;
}

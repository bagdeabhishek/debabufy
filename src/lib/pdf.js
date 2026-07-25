export async function extractPdfText(pdfjs, data) {
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false
  });
  const document = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];

    for (const item of content.items) {
      const text = String(item.str ?? "").trim();
      if (!text) continue;
      const x = Number(item.transform?.[4] ?? 0);
      const y = Number(item.transform?.[5] ?? 0);
      let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
      if (!line) {
        line = { y, fragments: [] };
        lines.push(line);
      }
      line.fragments.push({ x, text });
    }

    lines.sort((left, right) => right.y - left.y);
    pages.push(
      lines
        .map((line) => line.fragments
          .sort((left, right) => left.x - right.x)
          .map((fragment) => fragment.text)
          .join("\t"))
        .join("\n")
    );
  }
  return pages.join("\n\f\n");
}

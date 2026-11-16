export async function docxResult(text) {
  const body = String(text ?? "").trim();
  if (!body) return null;

  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "Clear Writing result", bold: true })] }),
        ...body.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] })),
      ],
    }],
  });
  return Packer.toBlob(doc);
}

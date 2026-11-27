import { strToU8, zipSync } from "fflate";

/** Crea un .docx reale (OOXML) compatibile con Microsoft Word */
export function buildDocxBlob(opts: {
  title: string;
  subtitle: string;
  sections: {
    heading: string;
    blocks: { title: string; headers: string[]; rows: string[][] }[];
  }[];
}): Blob {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(ROOT_RELS),
    "word/document.xml": strToU8(documentXml(opts)),
    "word/_rels/document.xml.rels": strToU8(DOCUMENT_RELS),
    "word/styles.xml": strToU8(STYLES_XML),
  };

  const zipped = zipSync(files, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy.buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function paragraph(
  text: string,
  opts?: {
    bold?: boolean;
    center?: boolean;
    size?: number;
    color?: string;
    spaceBefore?: number;
    spaceAfter?: number;
    style?: string;
  }
): string {
  const size = opts?.size ?? 22;
  const color = opts?.color ? `<w:color w:val="${opts.color}"/>` : "";
  const bold = opts?.bold ? "<w:b/>" : "";
  const jc = opts?.center ? "<w:jc w:val=\"center\"/>" : "";
  const style = opts?.style
    ? `<w:pStyle w:val="${opts.style}"/>`
    : "";
  const spacing = `<w:spacing w:before="${opts?.spaceBefore ?? 0}" w:after="${opts?.spaceAfter ?? 120}"/>`;
  return `<w:p>
  <w:pPr>${style}${jc}${spacing}</w:pPr>
  <w:r>
    <w:rPr>${bold}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${color}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
    <w:t xml:space="preserve">${xmlEscape(text)}</w:t>
  </w:r>
</w:p>`;
}

function tableCell(
  text: string,
  opts?: { header?: boolean; width: number; fill?: string }
): string {
  const fill = opts?.fill
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>`
    : "";
  const bold = opts?.header ? "<w:b/>" : "";
  const color = opts?.header ? `<w:color w:val="FFFFFF"/>` : "";
  return `<w:tc>
  <w:tcPr>
    <w:tcW w:w="${opts?.width ?? 2200}" w:type="dxa"/>
    ${fill}
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
    <w:r>
      <w:rPr>${bold}${color}<w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>
      <w:t xml:space="preserve">${xmlEscape(text)}</w:t>
    </w:r>
  </w:p>
</w:tc>`;
}

function tableXml(
  headers: string[],
  rows: string[][],
  headerFill: string
): string {
  const colCount = Math.max(headers.length, 1);
  const width = Math.floor(9360 / colCount);
  const grid = Array.from(
    { length: colCount },
    () => `<w:gridCol w:w="${width}"/>`
  ).join("");

  const headerRow = `<w:tr>${headers
    .map((h) => tableCell(h, { header: true, width, fill: headerFill }))
    .join("")}</w:tr>`;

  const bodyRows = rows
    .map(
      (row) =>
        `<w:tr>${Array.from({ length: colCount }, (_, i) =>
          tableCell(row[i] ?? "", { width })
        ).join("")}</w:tr>`
    )
    .join("");

  return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="9360" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="C8D2CD"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="C8D2CD"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="C8D2CD"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="C8D2CD"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="C8D2CD"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="C8D2CD"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tblGrid>${grid}</w:tblGrid>
  ${headerRow}
  ${bodyRows}
</w:tbl>`;
}

function documentXml(opts: {
  title: string;
  subtitle: string;
  sections: {
    heading: string;
    blocks: { title: string; headers: string[]; rows: string[][] }[];
  }[];
}): string {
  const parts: string[] = [];
  parts.push(
    paragraph(opts.title, {
      bold: true,
      center: true,
      size: 36,
      spaceAfter: 80,
      style: "Title",
    })
  );
  parts.push(
    paragraph(opts.subtitle, {
      center: true,
      size: 22,
      spaceAfter: 240,
    })
  );

  for (const section of opts.sections) {
    parts.push(
      paragraph(section.heading, {
        bold: true,
        size: 28,
        color: "1F6F63",
        spaceBefore: 280,
        spaceAfter: 120,
        style: "Heading2",
      })
    );
    for (const block of section.blocks) {
      parts.push(
        paragraph(block.title, {
          bold: true,
          size: 22,
          spaceBefore: 160,
          spaceAfter: 80,
        })
      );
      const fill =
        block.title.toLowerCase().includes("contatt") ? "466E5A" : "1E5A78";
      parts.push(tableXml(block.headers, block.rows, fill));
      parts.push(paragraph("", { spaceAfter: 80 }));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
 mc:Ignorable="w14 wp14">
  <w:body>
    ${parts.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

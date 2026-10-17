import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync, deflateSync } from "node:zlib";

import { draftTotalCents, normalizeDraft } from "./draft";
import { cleanTranscript, contextFileProblem, contextKind, docxText, looksLikeTranscript, pdfText, readContextFile, xlsxSheets } from "./files";
import { draftFromRules, parseTextLine } from "./rules";

function zip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

test("file kinds and limits", () => {
  assert.equal(contextKind("bid.PDF"), "pdf");
  assert.equal(contextKind("prices.xlsx"), "sheet");
  assert.equal(contextKind("call.vtt"), "transcript");
  assert.equal(contextKind("IMG_1.jpg", "image/jpeg"), "image");
  assert.equal(contextKind("notes", "text/plain"), "text");
  assert.match(contextFileProblem("old.xls", "", 10) || "", /xlsx/);
  assert.match(contextFileProblem("big.pdf", "application/pdf", 5_000_000) || "", /4 MB/);
  assert.equal(contextFileProblem("ok.csv", "text/csv", 100), null);
});

test("free-text lines keep quantity, unit and unit price", () => {
  assert.deepEqual(parseTextLine("3 x GFCI outlets @ $120 each"), { name: "GFCI outlets", quantity: 3, unit: "each", unitPriceCents: 12000, rangeCents: null, total: false });
  const roof = parseTextLine("Tear-off and haul 24 squares $85/square");
  assert.equal(roof?.quantity, 24);
  assert.equal(roof?.unit, "square");
  assert.equal(roof?.unitPriceCents, 8500);
  assert.equal(roof?.name, "Tear-off and haul");
  const total = parseTextLine("2 ceiling fans $300");
  assert.equal(total?.unitPriceCents, 15000);
  assert.equal(parseTextLine("Labor: 6 hours at $75")?.unit, "hour");
  assert.equal(parseTextLine("Labor: 6 hours at $75")?.unitPriceCents, 7500);
  assert.equal(parseTextLine("Total $1,240.50")?.total, true);
  assert.deepEqual(parseTextLine("Nintendo Switch OLED, works great, $250-$300")?.rangeCents, [25000, 30000]);
  assert.equal(parseTextLine("iPhone 13 128GB $400")?.quantity, 1);
  assert.equal(parseTextLine("Just some words with no price"), null);
});

test("pasted estimate becomes sections with cited lines", () => {
  const draft = draftFromRules(
    [
      {
        name: "Pasted text",
        kind: "text",
        tabular: false,
        text: "Bathroom refresh\nCustomer: Dana Lee\n\nDemo:\n- Remove vanity $150\n- Haul away $90\n\nInstall:\n- 2 x GFCI outlets @ $120 each\n- Tile 48 sq ft $12/sq ft\n- Paint (no price yet) 2 hours\n\nTotal $1,026",
      },
    ],
    ["Pasted text"],
  );
  assert.equal(draft.format, "job");
  assert.equal(draft.title, "Bathroom refresh");
  assert.equal(draft.customerName, "Dana Lee");
  assert.deepEqual(draft.sections.map((section) => section.name), ["Demo", "Install"]);
  assert.equal(draft.sections[1].lines[1].unit, "sq_ft");
  assert.equal(draft.sections[1].lines[2].unitPriceCents, null);
  assert.equal(draft.sections[1].lines[2].priceFrom, "none");
  assert.equal(draft.sections[0].lines[0].source, "Pasted text · line 5");
  assert.equal(draft.statedTotalCents, 102600);
  assert.equal(draftTotalCents(draft), 15000 + 9000 + 24000 + 57600);
  assert.match(draft.missing[0], /1 line has no price/);
});

test("CSV and spreadsheets read header rows", () => {
  const csv = readContextFile("bid.csv", "text/csv", new TextEncoder().encode("Section,Item,Qty,Unit,Unit Price,Total\nRoof,Shingles,24,squares,135,3240\nRoof,Drip edge,180,lf,2.5,450\nGutters,Seamless gutter,120,lf,,1080\n,Total,,,,4770\n"));
  const draft = draftFromRules(csv, ["bid.csv"]);
  assert.deepEqual(draft.sections.map((section) => section.name), ["Roof", "Gutters"]);
  assert.equal(draft.sections[0].lines[1].unit, "linear_ft");
  assert.equal(draft.sections[1].lines[0].unitPriceCents, 900);
  assert.equal(draft.statedTotalCents, 477000);

  const xlsx = zip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Kitchen" sheetId="1"/></sheets></workbook>',
    "xl/sharedStrings.xml": "<sst><si><t>Item</t></si><si><t>Qty</t></si><si><t>Price</t></si><si><t>Cabinet pulls</t></si><si><t>Faucet &amp; install</t></si></sst>",
    "xl/worksheets/sheet1.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>20</v></c><c r="C2"><v>6.5</v></c></row><row r="3"><c r="A3" t="s"><v>4</v></c><c r="C3"><v>380</v></c></row></sheetData></worksheet>',
  });
  assert.deepEqual(xlsxSheets(xlsx), [{ name: "Kitchen", text: "Item\tQty\tPrice\nCabinet pulls\t20\t6.5\nFaucet & install\t\t380" }]);
  const fromSheet = draftFromRules(readContextFile("kitchen.xlsx", "", xlsx), ["kitchen.xlsx"]);
  assert.equal(fromSheet.sections[0].lines[0].quantity, 20);
  assert.equal(fromSheet.sections[0].lines[1].name, "Faucet & install");
  assert.equal(draftTotalCents(fromSheet), 13000 + 38000);
});

test("Word documents and simple PDFs give text", () => {
  const docx = zip({ "word/document.xml": "<w:document><w:body><w:p><w:r><w:t>Fence repair</w:t></w:r></w:p><w:p><w:r><w:t>Replace 3 posts @ $65 each</w:t></w:r></w:p></w:body></w:document>" });
  assert.equal(docxText(docx), "Fence repair\nReplace 3 posts @ $65 each");
  const stream = deflateSync(Buffer.from("BT /F1 12 Tf 72 700 Td (Deck stain 300 sq ft $1.25/sq ft) Tj 0 -14 Td [(Rail) -300 (repair $220)] TJ ET"));
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj << /Length " + stream.length + " /Filter /FlateDecode >>\nstream\n"), stream, Buffer.from("\nendstream\nendobj\n%%EOF")]);
  assert.equal(pdfText(new Uint8Array(pdf)), "Deck stain 300 sq ft $1.25/sq ft\nRail repair $220");
});

test("transcripts lose timestamps and speakers but keep the asks", () => {
  const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Sam>We want the two bedrooms painted.\n\n2\n00:00:05.000 --> 00:00:09.000\n<v Pro>Okay, that's about 2 rooms at $450 each, and 1 door swap for $180.";
  assert.equal(cleanTranscript(vtt), "We want the two bedrooms painted.\nOkay, that's about 2 rooms at $450 each, and 1 door swap for $180.");
  const pasted = "Speaker 1 (00:01): Hi there\nSpeaker 2 (00:04): I need 4 hours of labor at $80\nSpeaker 1 (00:09): sounds good";
  assert.equal(looksLikeTranscript(pasted), true);
  const draft = draftFromRules(readContextFile("call.vtt", "", new TextEncoder().encode(vtt)), ["call.vtt"]);
  const names = draft.sections.flatMap((section) => section.lines.map((line) => `${line.quantity} ${line.name} ${line.unitPriceCents}`));
  assert.deepEqual(names, ["2 Rooms 45000", "1 Door swap 18000"]);
});

test("a single resale listing becomes one item with a range", () => {
  const draft = draftFromRules([{ name: "Pasted text", kind: "text", tabular: false, text: "Nintendo Switch OLED\nWhite, barely used, with case. Asking $250-$300" }], ["Pasted text"]);
  assert.equal(draft.format, "item");
  assert.equal(draft.title, "Nintendo Switch OLED");
  assert.equal(draft.lowCents, 25000);
  assert.equal(draft.highCents, 30000);
});

test("normalizeDraft never trusts a price without evidence as sourced", () => {
  const draft = normalizeDraft({
    format: "job",
    sections: [{ name: "A", lines: [{ name: "Thing", quantity: -2, unit: "hrs", unitPriceCents: 1234.4, priceFrom: "context", evidence: "" }, { name: "", unitPriceCents: 5 }] }],
    lowCents: 900,
    highCents: 100,
  });
  const line = draft.sections[0].lines[0];
  assert.equal(draft.sections[0].lines.length, 1);
  assert.equal(line.quantity, 1);
  assert.equal(line.unit, "hour");
  assert.equal(line.unitPriceCents, 1234);
  assert.equal(line.priceFrom, "estimate");
  assert.equal(draft.lowCents, 100);
  assert.equal(draft.highCents, 900);
});

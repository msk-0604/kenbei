import type { ConstructionBlackboard } from "@kensapo/domain";
import { BLACKBOARD_FIELD_LABELS } from "@kensapo/domain";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const chars = [...text];
  let line = "";
  let cursorY = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = ch;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

/** Burn Japanese construction blackboard onto image (bottom-left). Offline-safe (pure canvas). */
export async function burnBlackboardOntoImage(
  source: Blob,
  board: ConstructionBlackboard,
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas unavailable");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const boardWidth = Math.round(Math.min(canvas.width * 0.46, 520));
  const labelW = Math.round(boardWidth * 0.22);
  const pad = Math.round(boardWidth * 0.03);
  const rowH = Math.round(boardWidth * 0.095);
  const descH = Math.round(boardWidth * 0.28);
  const footerH = Math.round(boardWidth * 0.1);
  const boardHeight = rowH * 3 + descH + footerH;
  const left = pad;
  const top = canvas.height - boardHeight - pad;

  ctx.fillStyle = "rgba(40, 40, 40, 0.82)";
  ctx.fillRect(left, top, boardWidth, boardHeight);
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = Math.max(1, Math.round(boardWidth / 220));
  ctx.strokeRect(left, top, boardWidth, boardHeight);

  const fontSize = Math.max(11, Math.round(boardWidth / 28));
  const descSize = Math.max(14, Math.round(boardWidth / 18));
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";

  const rows: Array<{ label: string; value: string }> = [
    { label: BLACKBOARD_FIELD_LABELS.projectName, value: board.projectName || " " },
    { label: BLACKBOARD_FIELD_LABELS.workType, value: board.workType || " " },
    { label: BLACKBOARD_FIELD_LABELS.location, value: board.location || " " },
  ];

  rows.forEach((row, index) => {
    const y = top + index * rowH;
    ctx.beginPath();
    ctx.moveTo(left, y + rowH);
    ctx.lineTo(left + boardWidth, y + rowH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left + labelW, y);
    ctx.lineTo(left + labelW, y + rowH);
    ctx.stroke();
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.fillText(row.label, left + pad * 0.6, y + rowH / 2);
    ctx.font = `600 ${fontSize}px sans-serif`;
    wrapText(
      ctx,
      row.value,
      left + labelW + pad * 0.6,
      y + fontSize,
      boardWidth - labelW - pad * 1.4,
      fontSize + 2,
    );
  });

  const descTop = top + rowH * 3;
  ctx.beginPath();
  ctx.moveTo(left, descTop + descH);
  ctx.lineTo(left + boardWidth, descTop + descH);
  ctx.stroke();
  ctx.font = `700 ${descSize}px sans-serif`;
  ctx.textAlign = "center";
  wrapText(
    ctx,
    board.description || " ",
    left + boardWidth / 2,
    descTop + descSize + pad,
    boardWidth - pad * 2,
    descSize + 4,
  );
  ctx.textAlign = "left";

  const footerTop = descTop + descH;
  ctx.font = `600 ${Math.max(10, fontSize - 1)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(board.date || " ", left + pad, footerTop + footerH / 2);
  ctx.textAlign = "right";
  ctx.fillText(
    board.companyName || " ",
    left + boardWidth - pad,
    footerTop + footerH / 2,
  );
  ctx.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) {
          reject(new Error("blackboard burn failed"));
          return;
        }
        resolve(value);
      },
      "image/jpeg",
      0.9,
    );
  });
  return blob;
}

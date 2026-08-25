/**
 * Open a small window and print a plaintext receipt.
 * The receipt text is expected to be pre-formatted (monospaced), the way
 * the backend's /api/sales/:id/receipt endpoint returns it.
 */
export function printReceipt(receiptText) {
  if (!receiptText) return;
  const printWindow = window.open("", "_blank", "width=400,height=700");
  printWindow.document.write(
    `<!DOCTYPE html>
<html>
<head>
<title>Receipt</title>
<style>
  body { font-family: monospace; font-size: 14px; margin: 20px; white-space: pre; }
</style>
</head>
<body>${receiptText.replace(/</g, "&lt;")}</body>
</html>`,
  );
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 200);
}

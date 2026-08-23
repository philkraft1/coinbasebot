export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type ConnectorInfo = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
};

export function walletConnectorLabel(connector: ConnectorInfo | undefined): string {
  if (!connector) return "Wallet";
  if (connector.id === "baseAccount") return "Base Account";
  const rawName = typeof connector.name === "string" ? connector.name : "";
  const safeName = rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 32);
  return safeName ? `Browser wallet · ${safeName}` : "Browser wallet";
}

export function walletErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/reject|cancel|closed/i.test(message)) return "Connection cancelled.";
  return "Wallet connection failed. Try again.";
}

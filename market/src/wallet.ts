export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function walletErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/reject|cancel|closed/i.test(message)) return "Connection cancelled.";
  return "Wallet connection failed. Try again.";
}

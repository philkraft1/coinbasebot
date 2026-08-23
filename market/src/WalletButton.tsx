import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "./wallet.ts";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <span className="nav-user">
        <span className="nav-addr" title={address}>
          {shortenAddress(address)}
        </span>
        <button type="button" className="text-btn" onClick={() => disconnect()}>
          Disconnect
        </button>
      </span>
    );
  }

  function onConnect() {
    const injected = connectors.find((connector) => connector.id === "injected");
    const account = connectors.find((connector) => connector.id === "baseAccount");
    const hasInjected = typeof window !== "undefined" && Boolean(window.ethereum);
    const connector = (hasInjected && injected) || account || injected || connectors[0];
    if (!connector) return;
    connect({ connector });
  }

  return (
    <span className="nav-wallet">
      <button type="button" className="btn wallet-btn" onClick={onConnect} disabled={isPending}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <span className="form-error nav-wallet-error">{error.message}</span>}
    </span>
  );
}

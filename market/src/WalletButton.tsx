import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress, walletErrorMessage } from "./wallet.ts";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error, reset } = useConnect();
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
    reset();
    const injectedConnector = connectors.find((connector) => connector.id === "injected");
    const baseConnector = connectors.find((connector) => connector.id === "baseAccount");
    const hasInjectedWallet = typeof window !== "undefined" && Boolean(window.ethereum);
    const connector =
      (hasInjectedWallet && injectedConnector) ||
      baseConnector ||
      injectedConnector ||
      connectors[0];
    if (connector) connect({ connector });
  }

  return (
    <span className="nav-wallet">
      <button type="button" className="btn wallet-btn" onClick={onConnect} disabled={isPending}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {error && (
        <span className="form-error nav-wallet-error" role="alert">
          {walletErrorMessage(error)}
        </span>
      )}
    </span>
  );
}

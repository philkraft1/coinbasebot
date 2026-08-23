import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress, walletConnectorLabel, walletErrorMessage } from "./wallet.ts";

export function WalletButton() {
  const { address, connector: connectedConnector, isConnected } = useAccount();
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isConnected && address) {
    return (
      <span className="nav-user">
        <span className="nav-connector">{walletConnectorLabel(connectedConnector)}</span>
        <span className="nav-addr" title={address}>
          {shortenAddress(address)}
        </span>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setPickerOpen(false);
            disconnect();
          }}
        >
          Disconnect
        </button>
      </span>
    );
  }

  function openPicker() {
    reset();
    setPickerOpen((open) => !open);
  }

  return (
    <span className="nav-wallet">
      <button
        type="button"
        className="btn wallet-btn"
        onClick={openPicker}
        disabled={isPending}
        aria-expanded={pickerOpen}
        aria-controls="wallet-connector-picker"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {pickerOpen && !isPending && (
        <span className="wallet-picker" id="wallet-connector-picker" role="group" aria-label="Choose a wallet">
          {connectors.map((connector) => (
            <button
              type="button"
              className="text-btn wallet-choice"
              key={connector.uid}
              onClick={() => {
                setPickerOpen(false);
                connect({ connector });
              }}
            >
              {walletConnectorLabel(connector)}
            </button>
          ))}
          <button type="button" className="text-btn wallet-choice muted" onClick={() => setPickerOpen(false)}>
            Cancel
          </button>
        </span>
      )}
      {error && (
        <span className="form-error nav-wallet-error" role="status">
          {walletErrorMessage(error)}
        </span>
      )}
    </span>
  );
}

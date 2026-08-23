import { Attribution } from "ox/erc8021";
import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import baseApp from "../../config/base-app.json";

export const dataSuffix = Attribution.toDataSuffix({
  codes: [baseApp.builderCode],
});

if (dataSuffix !== baseApp.builderCodeSuffix) {
  throw new Error("Configured Builder Code suffix does not match Base attribution");
}

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    baseAccount({
      appName: baseApp.name,
      appLogoUrl: new URL(baseApp.iconPath, baseApp.origin).href,
      preference: {
        telemetry: false,
      },
    }),
  ],
  transports: {
    [base.id]: http(),
  },
  dataSuffix,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

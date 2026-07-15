import { mainnet } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ?? "";

export const walletConnectEnabled = REOWN_PROJECT_ID.length > 0;

export const PITCHLINE_REQUIRED_CHAIN_ID = "0x1";
export const PITCHLINE_REQUIRED_NETWORK_NAME = "Ethereum mainnet";

export const pitchlineEvmNetworks = [mainnet] as [AppKitNetwork, ...AppKitNetwork[]];

export const walletConnectMetadata = {
  name: "PITCHLINE",
  description: "Real-time football probability terminal built for chart-native match analysis.",
  url: "https://pitchline.app",
  icons: ["https://pitchline.app/icon.png"],
};


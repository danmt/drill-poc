import { TransactionSignature } from "@solana/web3.js";

export const getExplorerUrl = (
  signature: TransactionSignature,
  rpcEndpoint: string
) => {
  const explorerUrl = new URL(`https://explorer.solana.com/tx/${signature}`);

  explorerUrl.searchParams.append("cluster", "custom");
  explorerUrl.searchParams.append("customUrl", rpcEndpoint);

  return explorerUrl.toString();
};

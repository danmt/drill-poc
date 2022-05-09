import { AnchorProvider, Wallet } from "@project-serum/anchor";
import { Connection } from "@solana/web3.js";
import { getKeypair } from "./get-keypair";
import { SolanaConfig } from "./get-solana-config";

export const getProvider = async (
  config: SolanaConfig
): Promise<AnchorProvider> => {
  const keypair = await getKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, config.commitment);
  const wallet = new Wallet(keypair);
  return new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions()
  );
};

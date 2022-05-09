import { Keypair } from "@solana/web3.js";

export const getKeypair = async (keypairPath: string): Promise<Keypair> => {
  const secretKey = (await import(keypairPath)).default;
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  return keypair;
};

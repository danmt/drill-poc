import { AnchorProvider, Program } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js';
import { Drill, IDL } from '../program/drill'

// TODO: read programId in some other way
if (process.env.PROGRAM_ID === undefined) {
  throw new Error("PROGRAM_ID env variable is missing.");
}

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

export const getProgram = (
  provider: AnchorProvider
): Program<Drill> => {
  return new Program<Drill>(IDL, PROGRAM_ID, provider)
}

import { AnchorProvider, Program } from '@project-serum/anchor'
import { PublicKey } from '@solana/web3.js';
import { DrillProgramPoc, IDL } from '../program/drill_program_poc'

// TODO: read programId in some other way
if (process.env.PROGRAM_ID === undefined) {
  throw new Error("PROGRAM_ID env variable is missing.");
}

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

export const getProgram = (
  provider: AnchorProvider
): Program<DrillProgramPoc> => {
  return new Program<DrillProgramPoc>(IDL, PROGRAM_ID, provider)
}

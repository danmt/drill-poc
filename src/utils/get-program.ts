import { AnchorProvider, Program } from '@project-serum/anchor'
import { DrillProgramPoc, IDL } from '../program/drill_program_poc'

// TODO: read programId in some other way
const programId = '7CUSJe6g6pbCjyyM5rQEBNPexqp8QTN1wQEdMLSkUFjx'

export const getProgram = (
  provider: AnchorProvider
): Program<DrillProgramPoc> => {
  return new Program<DrillProgramPoc>(IDL, programId, provider)
}

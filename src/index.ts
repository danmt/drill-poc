import { AnchorError, ProgramError } from "@project-serum/anchor";
import { PublicKey, SimulatedTransactionResponse, TransactionSignature } from "@solana/web3.js";
import { Probot } from "probot";
import { getProgram, getProvider, getSolanaConfig } from "./utils";

const BOUNTY_LABEL_NAME = "drill:bounty";
const ACCEPTED_MINT = new PublicKey(
  "AeqUCoS56RdzPU2P4L59hkxQKMtEFTqfvbJb77oqm5CT"
);

export = (app: Probot) => {
  app.on("issues.labeled", async (context) => {
    const config = await getSolanaConfig();
    const provider = await getProvider(config);
    const program = getProgram(provider);

    const {
      payload: { label, issue, repository },
    } = context;
    const labelName = label?.name;

    if (labelName !== BOUNTY_LABEL_NAME) {
      return;
    }

    await Promise.all([
      context.octokit.issues.removeLabel(
        context.issue({
          name: labelName,
        })
      ),
      context.octokit.issues.addLabels(
        context.issue({
          labels: ["drill:bounty:processing"],
        })
      ),
    ]);

    try {
      await program.methods
        .initializeBounty(repository.id, issue.number)
        .accounts({
          acceptedMint: ACCEPTED_MINT,
          authority: provider.wallet.publicKey,
        })
        .simulate();
    } catch (error) {
      const simulationResponse = (error as any)
        .simulationResponse as SimulatedTransactionResponse;

      if (simulationResponse !== null) {
        await Promise.all([
          context.octokit.issues.removeLabel(
            context.issue({
              name: "drill:bounty:processing",
            })
          ),
          context.octokit.issues.addLabels(
            context.issue({
              labels: ["drill:bounty:failed"],
            })
          ),
          context.octokit.issues.createComment(
            context.issue({
              body: `
# ⚠️ Failed creating bounty.
    
\`\`\`sh
${simulationResponse.logs?.join("\n")}
\`\`\`
`,
              contentType: "text/x-markdown",
            })
          ),
        ]);
      }

      return;
    }

    let signature: TransactionSignature;

    try {
      signature = await program.methods
        .initializeBounty(repository.id, issue.number)
        .accounts({
          acceptedMint: ACCEPTED_MINT,
          authority: provider.wallet.publicKey,
        })
        .rpc();
  
      const explorerUrl = new URL(`https://explorer.solana.com/tx/${signature}`);
  
      explorerUrl.searchParams.append("cluster", "custom");
      explorerUrl.searchParams.append(
        "customUrl",
        provider.connection.rpcEndpoint
      );

      await Promise.all([
        context.octokit.issues.removeLabel(
          context.issue({
            name: "drill:bounty:processing",
          })
        ),
        context.octokit.issues.addLabels(
          context.issue({
            labels: ["drill:bounty:enabled"],
          })
        ),
        context.octokit.issues.createComment(
          context.issue({
            body: `
# 💰 Bounty Enabled.
  
This issue has an active bounty. [Inspect the transaction](${explorerUrl.toString()}) in the Solana Explorer.
`,
            contentType: "text/x-markdown",
          })
        ),
      ]);
    } catch(error) {
      let message = '# ⚠️ Failed creating bounty.';

      if (error instanceof Error) {
        message = `
${message}
    
\`\`\`sh
${error.message}
\`\`\`
`
      } else if (error instanceof ProgramError || error instanceof AnchorError) {
        message = `
${message}
    
\`\`\`sh
${error.logs?.join("\n")}
\`\`\`
`
      }

      await Promise.all([
        context.octokit.issues.removeLabel(
          context.issue({
            name: "drill:bounty:processing",
          })
        ),
        context.octokit.issues.addLabels(
          context.issue({
            labels: ["drill:bounty:failed"],
          })
        ),
        context.octokit.issues.createComment(
          context.issue({
            body: message,
            contentType: "text/x-markdown",
          })
        ),
      ])

      return;
    }
  });
};

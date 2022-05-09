import { BN } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { Probot } from "probot";
import {
  getBountyClosedCommentBody,
  getBountyEnabledCommentBody,
  getErrorCommentBody,
  getErrorMessage,
  getExplorerUrl,
  getProgram,
  getProvider,
  getSolanaConfig,
} from "./utils";

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

    if (label?.name !== "drill:bounty") {
      return;
    }

    const [boardPublicKey] = await PublicKey.findProgramAddress([
      Buffer.from('board', 'utf8'),
      new BN(repository.id).toArrayLike(Buffer, "le", 4),
    ], program.programId);
    const [bountyPublicKey] = await PublicKey.findProgramAddress([
      Buffer.from('bounty', 'utf8'),
      boardPublicKey.toBuffer(),
      new BN(issue.number).toArrayLike(Buffer, "le", 4),
    ], program.programId);

    const bountyAccount = await program.account.bounty.fetchNullable(bountyPublicKey);

    if (bountyAccount !== null) {
      if (bountyAccount.isClosed) {
        return Promise.all([
          context.octokit.issues.removeLabel(
            context.issue({
              name: "drill:bounty",
            })
          ),
          context.octokit.issues.addLabels(
            context.issue({
              labels: ["drill:bounty:closed"],
            })
          ),
        ])  
      } else {
        return Promise.all([
          context.octokit.issues.removeLabel(
            context.issue({
              name: "drill:bounty",
            })
          ),
          context.octokit.issues.addLabels(
            context.issue({
              labels: ["drill:bounty:enabled"],
            })
          ),
        ])
      }
    }

    await Promise.all([
      context.octokit.issues.removeLabel(
        context.issue({
          name: "drill:bounty",
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
      return Promise.all([
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
            body: getErrorCommentBody(
              "# ⚠️ Bounty Failed",
              (error as any).simulationResponse === null
                ? getErrorMessage(error)
                : (error as any).simulationResponse.logs?.join("\n") ?? ""
            ),
            contentType: "text/x-markdown",
          })
        ),
      ]);
    }

    try {
      const signature = await program.methods
        .initializeBounty(repository.id, issue.number)
        .accounts({
          acceptedMint: ACCEPTED_MINT,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      return Promise.all([
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
            body: getBountyEnabledCommentBody(
              getExplorerUrl(signature, provider.connection.rpcEndpoint)
            ),
            contentType: "text/x-markdown",
          })
        ),
      ]);
    } catch (error) {
      return Promise.all([
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
            body: getErrorCommentBody(
              "# ⚠️ Bounty Failed",
              getErrorMessage(error)
            ),

            contentType: "text/x-markdown",
          })
        ),
      ]);
    }
  });

  app.on("issues.closed", async (context) => {
    const config = await getSolanaConfig();
    const provider = await getProvider(config);
    const program = getProgram(provider);
    const {
      payload: { issue, repository },
    } = context;

    if (!issue.labels.some((label) => label.name === "drill:bounty:enabled")) {
      return;
    }

    await Promise.all([
      context.octokit.issues.removeLabel(
        context.issue({
          name: "drill:bounty:enabled",
        })
      ),
      context.octokit.issues.addLabels(
        context.issue({
          labels: ["drill:bounty:closing"],
        })
      ),
    ]);

    try {
      await program.methods
        .closeBounty(repository.id, issue.number, issue.assignee?.login ?? null)
        .accounts({
          authority: provider.wallet.publicKey,
        })
        .simulate();
    } catch (error) {
      return Promise.all([
        context.octokit.issues.removeLabel(
          context.issue({
            name: "drill:bounty:closing",
          })
        ),
        context.octokit.issues.addLabels(
          context.issue({
            labels: ["drill:bounty:close-failed"],
          })
        ),
        context.octokit.issues.createComment(
          context.issue({
            body: getErrorCommentBody(
              "# ⚠️ Failed to close bounty",
              (error as any).simulationResponse === null
                ? getErrorMessage(error)
                : (error as any).simulationResponse.logs?.join("\n") ?? ""
            ),
            contentType: "text/x-markdown",
          })
        ),
      ]);
    }

    try {
      const signature = await program.methods
        .closeBounty(repository.id, issue.number, issue.assignee?.login ?? null)
        .accounts({
          authority: provider.wallet.publicKey,
        })
        .rpc();

      return Promise.all([
        context.octokit.issues.removeLabel(
          context.issue({
            name: "drill:bounty:closing",
          })
        ),
        context.octokit.issues.addLabels(
          context.issue({
            labels: ["drill:bounty:closed"],
          })
        ),
        context.octokit.issues.createComment(
          context.issue({
            body: getBountyClosedCommentBody(
              getExplorerUrl(signature, provider.connection.rpcEndpoint),
              issue.assignee?.login
            ),
            contentType: "text/x-markdown",
          })
        ),
      ]);
    } catch (error) {
      return await Promise.all([
        context.octokit.issues.removeLabel(
          context.issue({
            name: "drill:bounty:closing",
          })
        ),
        context.octokit.issues.addLabels(
          context.issue({
            labels: ["drill:bounty:close-failed"],
          })
        ),
        context.octokit.issues.createComment(
          context.issue({
            body: getErrorCommentBody(
              "# ⚠️ Failed to close bounty",
              getErrorMessage(error)
            ),
            contentType: "text/x-markdown",
          })
        ),
      ]);
    }
  });
};

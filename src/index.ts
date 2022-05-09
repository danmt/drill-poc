import { AnchorError, ProgramError } from "@project-serum/anchor";
import { PublicKey, SimulatedTransactionResponse } from "@solana/web3.js";
import { Probot } from "probot";
import {
  getBountyClosedCommentBody,
  getBountyEnabledCommentBody,
  getErrorCommentBody,
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
              body: getErrorCommentBody(
                "# ⚠️ Bounty Failed",
                simulationResponse.logs?.join("\n") ?? ""
              ),
              contentType: "text/x-markdown",
            })
          ),
        ]);
      }

      return;
    }

    try {
      const signature = await program.methods
        .initializeBounty(repository.id, issue.number)
        .accounts({
          acceptedMint: ACCEPTED_MINT,
          authority: provider.wallet.publicKey,
        })
        .rpc();

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
            body: getBountyEnabledCommentBody(
              getExplorerUrl(signature, provider.connection.rpcEndpoint)
            ),
            contentType: "text/x-markdown",
          })
        ),
      ]);
    } catch (error) {
      let message = "";

      if (error instanceof Error) {
        message = error.message;
      } else if (
        error instanceof ProgramError ||
        error instanceof AnchorError
      ) {
        message = error.logs?.join("\n") ?? "";
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
            body: getErrorCommentBody("# ⚠️ Bounty Failed", message),

            contentType: "text/x-markdown",
          })
        ),
      ]);

      return;
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
      const simulationResponse = (error as any)
        .simulationResponse as SimulatedTransactionResponse;

      if (simulationResponse !== null) {
        await Promise.all([
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
                simulationResponse.logs?.join("\n") ?? ""
              ),
              contentType: "text/x-markdown",
            })
          ),
        ]);
      }

      return;
    }

    try {
      const signature = await program.methods
        .closeBounty(repository.id, issue.number, issue.assignee?.login ?? null)
        .accounts({
          authority: provider.wallet.publicKey,
        })
        .rpc();

      await Promise.all([
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
      let message = "";

      if (error instanceof Error) {
        message = error.message;
      } else if (
        error instanceof ProgramError ||
        error instanceof AnchorError
      ) {
        message = error.logs?.join("\n") ?? "";
      }

      await Promise.all([
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
            body: getErrorCommentBody("# ⚠️ Failed to close bounty", message),
            contentType: "text/x-markdown",
          })
        ),
      ]);

      return;
    }
  });
};

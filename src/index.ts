import { Map } from "immutable";
import { Probot } from "probot";

type Owner = string;
type Repository = string;
type IssueNumber = number;
type CommentId = number;

type CommentKey = `${Owner}/${Repository}/${IssueNumber}`;

let state = Map<CommentKey, CommentId>();

const BOUNTY_LABEL_NAME = "drill:bounty";

const getMentions = (body: string) =>
  body
    .split(" ")
    .filter((segment) => /^@/.test(segment))
    .map((segment) => segment.slice(1));

const isSendBountyMessage = (body: string) => {
  const bodyAsArray = body.split(":");

  if (bodyAsArray.length !== 2) {
    return false;
  }

  return bodyAsArray[0].toLowerCase() === "send bounty";
};

const canSendBountyMessage = (authorAssociation: string) =>
  authorAssociation === "OWNER";

export = (app: Probot) => {
  app.on("issues.labeled", async (context) => {
    // const config = await getSolanaConfig()
    // const provider = await getProvider(config)
    // const program = getProgram(provider)

    const {
      payload: { label, issue, repository },
    } = context;
    const labelName = label?.name;

    if (labelName !== BOUNTY_LABEL_NAME) {
      return;
    }

    const issueComment = context.issue({
      body: `
        # Bounties enabled.
      `,
    });
    const { data } = await context.octokit.issues.createComment(issueComment);
    state = state.set(
      `${repository.owner.login}/${repository.name}/${issue.number}`,
      data.id
    );
  });

  app.on("issues.unlabeled", async (context) => {
    const {
      payload: { label, issue, repository },
    } = context;
    const labelName = label?.name;

    if (labelName !== BOUNTY_LABEL_NAME) {
      return;
    }

    const commentId = state.get(
      `${repository.owner.login}/${repository.name}/${issue.number}`
    );

    if (commentId === undefined) {
      return;
    }

    state = state.remove(
      `${repository.owner.login}/${repository.name}/${issue.number}`
    );
    await context.octokit.issues.deleteComment({
      owner: repository.owner.login,
      repo: repository.name,
      comment_id: commentId,
    });
  });

  app.on("issue_comment.created", async (context) => {
    const {
      payload: { comment },
    } = context;

    // handle a close bounty message as well

    if (!isSendBountyMessage(comment.body)) {
      return;
    }

    if (!canSendBountyMessage(comment.author_association)) {
      return;
    }

    const mentions = getMentions(comment.body);

    if (mentions.length !== 1) {
      return;
    }

    const receiver = mentions[0];

    console.log(`send bounty to @${receiver}`);
  });
};

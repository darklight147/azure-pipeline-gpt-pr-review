import * as tl from "azure-pipelines-task-lib/task";
import { RetrievalQAChain } from "langchain/chains";
import { AzureOpenAIInput, ChatOpenAI } from "langchain/chat_models/openai";
import { AddCommentToPR } from "./addCommentToPR";
import { chatPrompt } from "./prompt";

import { VectorStoreRetriever } from "langchain/dist/vectorstores/base";
import { git } from "./utils/git";

export async function reviewFile(
  fileName: string,
  targetBranch: string,
  context: VectorStoreRetriever
) {
  console.log(`Start reviewing ${fileName} ...`);

  const patch = await git.diff([targetBranch, "--", fileName]);

  try {
    const openAIApiKey = tl.getInput("apiKey", true) as string;

    const isAzure = tl.getBoolInput("useAzure", true);

    const azureOptions: AzureOpenAIInput = {
      azureOpenAIApiInstanceName: tl.getInput("azureInstance"),
      azureOpenAIApiDeploymentName: tl.getInput("azureDeployment"),
      azureOpenAIApiKey: isAzure ? openAIApiKey : undefined,
      azureOpenAIApiVersion: tl.getInput("azureApiVersion"),
    };

    const chat = new ChatOpenAI({
      openAIApiKey: isAzure ? undefined : openAIApiKey,
      modelName: tl.getInput("modelName", false) ?? "gpt-3.5-turbo",
      ...azureOptions,
    });

    // const prompt = await chatPrompt.formatPromptValue({ patch });

    // const { text: answer } = await chat.call(prompt.toChatMessages());

    // if (answer) await AddCommentToPR(fileName, answer);

    const qa = RetrievalQAChain.fromLLM(chat, context);

    const prompt = await chatPrompt.formatPromptValue({ patch });

    const message = prompt.toChatMessages();

    const flatMessage = message.map((m) => m.text).join("\n");

    const { text: answer } = await qa.call({ query: flatMessage });

    if (answer) await AddCommentToPR(fileName, answer);

    console.log(`Review of ${fileName} completed.`);
  } catch (error: any) {
    if (error.isAxiosError) {
      console.log({
        status: error.status,
        message: error.message,
      });
    } else {
      console.log(error.message);
    }
  }
}

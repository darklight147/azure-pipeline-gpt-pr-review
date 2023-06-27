import binaryExtensions from "binary-extensions";
import glob from "glob";
import { getFileExtension } from "./review";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import * as tl from "azure-pipelines-task-lib/task";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { TextLoader } from "langchain/document_loaders";

export const LoadProjectContext = async (directory: string) => {
  const files = glob.sync(`${directory}/**/*`, {
    nodir: true,
  });

  const nonBinaryFiles = files.filter(
    (file) => !binaryExtensions.includes(getFileExtension(file))
  );

  console.log(
    `Changed Files (excluding binary files) : \n ${nonBinaryFiles.join("\n")}`
  );

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    separators: ["\n", ";", ","],
  });

  const loaders = nonBinaryFiles.map((file) => {
    return new TextLoader(file);
  });

  const docsArray = await Promise.all(
    loaders.map(async (loader) => {
      return loader.loadAndSplit(splitter);
    })
  );

  // flatten docs
  const docs = docsArray.reduce((acc, val) => acc.concat(val), []);

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: tl.getInput("apiKey", true) as string,
  });

  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);

  return vectorStore.asRetriever();
};

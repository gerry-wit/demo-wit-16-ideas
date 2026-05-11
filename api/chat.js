import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

let retrievalChain = null;

const initRAG = async () => {
    if (retrievalChain) return retrievalChain;

    try {
        console.log("Initializing RAG Pipeline on Vercel...");
        
        // Ensure path resolves correctly in Vercel's Serverless environment
        const pdfPath = path.join(process.cwd(), 'docs', '2025-WIT ID - Company Profile.pdf');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const text = data.text;
        
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const docs = await textSplitter.createDocuments([text]);

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "text-embedding-004", 
        });
        
        const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
        const retriever = vectorStore.asRetriever();

        const llm = new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
            model: "gemini-1.5-flash",
            temperature: 0.7,
        });

        const prompt = PromptTemplate.fromTemplate(`
You are Reddie, the enthusiastic red robot brand ambassador for WIT.Indonesia.
You are interacting with a user via an AR experience. Keep your answers concise, friendly, and helpful.
Use the following pieces of retrieved context about WIT.Indonesia to answer the question.
If you don't know the answer based on the context, say that you're not sure but they can contact WIT.Indonesia directly.

Context: {context}

User Question: {input}
Reddie:`);

        const combineDocsChain = await createStuffDocumentsChain({
            llm,
            prompt,
            outputParser: new StringOutputParser(),
        });

        retrievalChain = await createRetrievalChain({
            retriever,
            combineDocsChain,
        });

        console.log("RAG Pipeline Ready!");
        return retrievalChain;
    } catch (error) {
        console.error("Error initializing RAG:", error);
        throw error;
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        const chain = await initRAG();
        const response = await chain.invoke({
            input: message,
        });
        
        return res.status(200).json({ reply: response.answer });
    } catch (error) {
        console.error("Chat error:", error);
        return res.status(500).json({ error: "Failed to generate response." });
    }
}

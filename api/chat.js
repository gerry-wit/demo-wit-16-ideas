import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createStuffDocumentsChain } from "@langchain/classic/chains/combine_documents";
import { createRetrievalChain } from "@langchain/classic/chains/retrieval";
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
            model: "embedding-001",
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

IMPORTANT: At the very end of your response, on a new line, add a single word emotion tag in the format: [EMOTION:word]
Choose ONE of these emotions that best fits your answer: happy, excited, thinking, sad, curious
Example: [EMOTION:excited]

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

        // Parse emotion tag from response
        let reply = response.answer || '';
        let emotion = 'happy';
        const emotionMatch = reply.match(/\[EMOTION:(\w+)\]/i);
        if (emotionMatch) {
            emotion = emotionMatch[1].toLowerCase();
            reply = reply.replace(/\[EMOTION:\w+\]/i, '').trim();
        }
        
        return res.status(200).json({ reply, emotion });
    } catch (error) {
        console.error("Chat error:", error);
        return res.status(500).json({ error: "Failed to generate response." });
    }
}

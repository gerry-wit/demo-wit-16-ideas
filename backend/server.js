import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pdfParse from 'pdf-parse';

import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize LangChain setup
let vectorStore;
let retrievalChain;

const initRAG = async () => {
    try {
        console.log("Initializing RAG Pipeline...");
        
        // 1. Read PDF
        const pdfPath = path.resolve(__dirname, '../docs/2025-WIT ID - Company Profile.pdf');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const text = data.text;
        
        console.log("PDF parsed successfully. Length:", text.length);

        // 2. Split Text
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const docs = await textSplitter.createDocuments([text]);

        // 3. Create Embeddings & Vector Store
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "text-embedding-004", // Updated embedding model
        });
        
        vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
        const retriever = vectorStore.asRetriever();

        // 4. Create Chat Model & Prompt
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
    } catch (error) {
        console.error("Error initializing RAG:", error);
    }
};

// Initialize the RAG system on startup
initRAG();

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    if (!retrievalChain) {
        return res.status(503).json({ error: "AI Brain is still initializing. Please wait." });
    }

    try {
        const response = await retrievalChain.invoke({
            input: message,
        });
        
        res.json({ reply: response.answer });
    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Failed to generate response." });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

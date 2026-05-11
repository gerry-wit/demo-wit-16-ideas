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
import { createStuffDocumentsChain } from "@langchain/classic/chains/combine_documents";
import { createRetrievalChain } from "@langchain/classic/chains/retrieval";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let retrievalChain;

const initRAG = async () => {
    try {
        console.log("Initializing RAG Pipeline...");
        
        const pdfPath = path.resolve(__dirname, '../docs/2025-WIT ID - Company Profile.pdf');
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const text = data.text;
        
        console.log("PDF parsed successfully. Length:", text.length);

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
You are interacting with a user via an interactive AR experience.
Keep your answers concise, friendly, and full of personality.
Use the retrieved context about WIT.Indonesia to answer the question.
If you don't know, say you're not sure but they can contact WIT.Indonesia directly.

IMPORTANT: At the very END of your response, on a new line, add ONE emotion tag:
[EMOTION:word] — choose from: happy, excited, thinking, sad, curious
Pick the emotion that best matches the tone of your answer.

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

initRAG();

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    if (!retrievalChain) {
        return res.status(503).json({ error: "AI Brain is still initializing. Please wait a moment!" });
    }

    try {
        const response = await retrievalChain.invoke({ input: message });

        let reply = response.answer || '';
        let emotion = 'happy';
        const emotionMatch = reply.match(/\[EMOTION:(\w+)\]/i);
        if (emotionMatch) {
            emotion = emotionMatch[1].toLowerCase();
            reply = reply.replace(/\[EMOTION:\w+\]/i, '').trim();
        }

        res.json({ reply, emotion });
    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Failed to generate response.", emotion: "sad" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

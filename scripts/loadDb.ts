import { DataAPIClient } from '@datastax/astra-db-ts';
import OpenAI from "openai"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import "dotenv/config";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
//import {loader} from "next/dist/build/webpack/config/helpers";
import { encode } from 'gpt-3-encoder';





const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

(async () => {
    try {
        const testEmbedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: 'Test input',
            encoding_format: 'float',
        });
        console.log('OpenAI API is working. Test embedding:', testEmbedding);
    } catch (error) {
        console.error('OpenAI API request failed:', error);
    }
})();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handleApiRequest = async (chunk: string) => {
    try {
        const embedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
            encoding_format: 'float',
        });

        return embedding.data[0].embedding;
    } catch (error) {
        if (error.code === 'insufficient_quota') {
            console.error('Quota exceeded, retrying after delay...');
            await delay(60000);  // Retry after 1 minute
            return handleApiRequest(chunk);  // Retry the request
        }
        throw error;  // Re-throw other errors
    }
};













const calculateTokenCount = (text: string): number => {
    const tokens = encode(text);
    return tokens.length;
};

type SimilarityMetric = "cosine" | "dot_product" | "euclidean"

let requestCount = 0;
const resetInterval = 1000; // 1 second

// Reset the counter every second
setInterval(() => {
    console.log(`Requests made in the last second: ${requestCount}`);
    requestCount = 0;
}, resetInterval);
const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPEN_API_KEY
} = process.env;

console.log({
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPEN_API_KEY
});



//constructor
//const openai = new OpenAI({apiKey:  OPEN_API_KEY})

// finding and adding websites for information
const f1Data = [
    'https://en.wikipedia.org/wiki/Formula_One',
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/Formula_One_World_Championship_Qualifying',
    'https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship',
    'https://www.formula1.com/',
    'https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/Ayrton_Senna'
];

console.log("f1Data length -----------------",f1Data.length)

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE })
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})


const createCollection = async (similarityMetric: SimilarityMetric='dot_product') => {

    try {
        // Check if the collection already exists
        const collections = await db.collection(ASTRA_DB_COLLECTION);
        console.log(`Collection '${ASTRA_DB_COLLECTION}' already exists. Skipping creation.`);
        return;
    }
    catch (error: any) {
        if (error.message.includes("Collection does not exist")) {
            const res = await db.createCollection(ASTRA_DB_COLLECTION, {
                vector:{
                    dimension: 1536,
                    metric: similarityMetric
                }
            })
            console.log(res)
        } else {
            console.error('Error checking collection existence:', error);
        }
    }}

const loadSampleData = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        for await (const url of f1Data) {
            const content = await scrapePage(url);
            if (!content) continue; // Skip if scraping failed

            const chunks = await splitter.splitText(content);
            for await (const chunk of chunks) {
                const embedding = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: chunk,
                    encoding_format: 'float',
                });
                const vector = embedding.data[0].embedding;
                const res = await collection.insertOne({
                    $vector: vector,
                    text: chunk,
                });
                console.log('Inserted chunk:', res);
            }
        }
    } catch (error) {
        console.error('Error loading sample data:', error);
    }
};







/*    const collection = await db.collection(ASTRA_DB_COLLECTION)
    for await (const url of f1Data){
        const content = await scrapePage(url)
        const chunks = await splitter.splitText(content)
        for await(const chunk of chunks){
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
                encoding_format: "float"
            })
            const vector = embedding.data[0].embedding
            const res = await collection.insertOne({
                    $vector: vector,
                    text: chunk
                }
            )
            console.log(res)
        }
    }
}*/

const scrapePage = async(url:string) =>{
    try {
        const loader = new PuppeteerWebBaseLoader(url, {
            launchOptions: {
                headless: true,
            },
            gotoOptions: {
                waitUntil: 'domcontentloaded',
            },
        });
        const scrapedContent = await loader.scrape();
        console.log(`scraped Content-----------------------: ${scrapedContent?.length || 0}`);
        return scrapedContent?.replace(/<[^>]*>?/gm, '|') || '';
    } catch (error) {
        console.error(`Error scraping page ${url}:`, error);
        return '';
    }
};












   /* new PuppeteerWebBaseLoader(url, {
        launchOptions:{
            headless: true,
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async(page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, '|');
    }
    */
createCollection().then(() => loadSampleData())
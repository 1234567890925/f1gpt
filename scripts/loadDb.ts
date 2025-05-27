import dotenv from 'dotenv';
dotenv.config();

//import OpenAI from "openai"
import { OpenAI } from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
console.log("API KEY from env:", process.env.OPENAI_API_KEY?.slice(0, 5));  // just a test


if (!apiKey) {
  throw new Error("OPENAI_API_KEY is missing from environment variables.");
}

const openai = new OpenAI({
  apiKey,
});


//importing libraries 
//interacts with astra db - further used for connecting to the database, creating collection, inserting data
//import { createClient, Namespace, Collection } from "@datastax/astra-db-ts";
import { DataAPIClient } from "@datastax/astra-db-ts";
//import { createClient } from "@datastax/astra-db-ts";


// accesses opensi's api embeddings - extracting content from url
//import OpenAI from "openai"
//used for web scraping task 
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
//loads env var from .env file - accessing configuration like api keys, database creds

//import "dotenv/config";
// split data into chunks
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
//managing token limits 
//import {loader} from "next/dist/build/webpack/config/helpers";
import { encode } from 'gpt-3-encoder';
import puppeteer from "puppeteer";
//initialize openAi client
//api key is passed as a configuration option from .env
//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//testing the API
(async () => {
    try {
        //This sends a request to OpenAI's API to generate embeddings for the text "Test input".
        const testEmbedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: 'Test input',
            encoding_format: 'float',
        });
        //console.log('OpenAI API is working. Test embedding:', testEmbedding);
    } catch (error) {
        console.error('OpenAI API request failed:', error);
    }
})();

//setting delay for situations like retrying API req
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

//creates embeddings for a chunk
const handleApiRequest = async (chunk: string) => {
    try {
        //generating embeddings for text chunk usinf open API
        const embedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
            encoding_format: 'float',
        });
        //return the embedding vector
        return embedding.data[0].embedding;
    } catch (error) {
        //error check due to exceeding API quota
        if (error.code === 'insufficient_quota') {
            console.error('Quota exceeded, retrying after delay...');
            await delay(60000);  // Retry after 1 minute
            return handleApiRequest(chunk);  // Retry the request
        }
        throw error;  // Re-throw other errors
    }
};

const calculateTokenCount = (text: string): number => {
    //splitting the input text to chuncks using encode
    const tokens = encode(text);
    return tokens.length;
};
//to determine how closely two vectors (e.g., embeddings of text chunks) match each other.
type SimilarityMetric = "cosine" | "dot_product" | "euclidean"

//tracking number of api calls 
let requestCount = 0;
const resetInterval = 1000; // 1 second

// Reset the counter every second
setInterval(() => {
    //console.log(`Requests made in the last second: ${requestCount}`);
    requestCount = 0;
}, resetInterval);
const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env;

/*console.log({
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
});*/



//constructor
//const openai = new OpenAI({apiKey:  OPENAI_API_KEY})

// finding and adding websites for information
const f1Data = [
    'https://www.formula1.com/',
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/Formula_One_World_Championship_Qualifying',
    'https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship',
    'https://www.formula1.com/',
    'https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/Ayrton_Senna'
];

//console.log("f1Data length -----------------",f1Data.length)
//initialize db clliebt using application token and endpoint
//const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN!);

// Initialize the client
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT!, {
    keyspace: process.env.ASTRA_DB_NAMESPACE!,
});
(async () => {
  const colls = await db.listCollections();
  console.log('Connected to AstraDB:', colls);
})();
//const db = client.db(process.env.ASTRA_DB_API_ENDPOINT!, {
    //keyspace: process.env.ASTRA_DB_NAMESPACE!,
//});
//const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
//const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE })
//initialize text splitter  to break text into small chunks
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})


const createCollection = async (similarityMetric: SimilarityMetric='dot_product') => {

    try {
        // Check if the collection already exists
        //const collection = (db as any).collection(ASTRA_DB_COLLECTION);
        console.log('hi')
        //console.log(`Collection '${ASTRA_DB_COLLECTION}' already exists. Skipping creation.`);
        return;
    }
    catch (error: any) {
        if (error.message.includes("Collection does not exist")) {
            await (db as any).createCollection(ASTRA_DB_COLLECTION, {
                vector: {
                    dimension: 1536,
                    metric: "dot_product",
                },
            });
            console.log("✅ Collection created.");

        } else {
            console.error('Error checking collection existence:', error);
        }
    }}

const loadSampleData = async () => {
    try {
        const collection = await (db as any).collection(process.env.ASTRA_DB_COLLECTION!);
        for await (const url of f1Data) {
            //scrpes content from the list of URLs
            const content = await scrapePage(url);
             // Skip if scraping failed- invalid URL
            if (!content) continue;
            // generate chunks with scrapped url
            const chunks = await splitter.splitText(content);
            for await (const chunk of chunks) {
                //generate embeddings for each chunk
                const embedding = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    //The input is the text chunk.
                    input: chunk,
                    //The encoding_format specifies the format of the embedding (float).
                    encoding_format: 'float',
                });
                // The embedding vector is extracted from the API response.
                const vector = embedding.data[0].embedding;
                //Insert the Embedding and Text into the Database
                //determines how the vector will be compared with other vectors in the database.
                const res = await collection.insertOne({
                    $vector: vector,
                    text: chunk,
                });
                //console.log('Inserted chunk:', res);
            }
        }
    } catch (error) {
        console.error('Error loading sample data:', error);
    }
};

//scraping content from a web page using Puppeteer. 
const scrapePage = async(url:string) =>{
    try {
        //initialize loader to scrape the web page at given URL
        const loader = new PuppeteerWebBaseLoader(url, {
            //Configures Puppeteer's browser instance
        launchOptions: {
            headless: "new", // recommended for modern Puppeteer
            timeout: 60000,
            dumpio: true,
            executablePath: puppeteer.executablePath(),
            args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            ],
        },
        gotoOptions: {
            waitUntil: "domcontentloaded",
        },
        });
        //scrape content
        const scrapedContent = await loader.scrape();
        //console.log(`scraped Content-----------------------: ${scrapedContent?.length || 0}`);
        //cleaning scrapped content by removinf HTML tags
        return scrapedContent?.replace(/<[^>]*>?/gm, '|') || '';
    } catch (error) {
        console.error(`Error scraping page ${url}:`, error);
        return '';
    }
};
createCollection().then(() => loadSampleData())
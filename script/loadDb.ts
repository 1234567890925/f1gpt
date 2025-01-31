//loading data
import { DataAPIClient } from "@datastax/astra-db-ts";
import puppeteer from 'puppeteer';

import openai from "openai"; 
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
//to hide secret keys like tokens, api keys, etc.
import "dotenv/config";

export const astraDB = new DataAPIClient({
    astraToken: process.env.ASTRA_DB_TOKEN,
    astraDatabaseId: process.env.ASTRA_DB_ID
});


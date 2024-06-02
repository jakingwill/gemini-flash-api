// 0. Importing the necessary modules
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/files";
import path from "path";
import { env } from "process"; // Assuming process.env is accessible through env

const apiKey = env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// 1. Function to upload files to Gemini
async function uploadToGemini(filePath, mimeType) {
    const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: path.basename(filePath),
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

// 2. Function to wait until files are processed and ready
async function waitForFilesActive(...files) {
    console.log("Waiting for file processing...");
    for (const name of files.map((file) => file.name)) {
        let file = await fileManager.getFile(name);
        while (file.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            file = await fileManager.getFile(name);
        }
        if (file.state !== "ACTIVE") {
            throw Error(`File ${file.name} failed to process`);
        }
    }
    console.log("...all files ready\n");
}

// 3. Configuring the generative model
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    systemInstructions: "You are a document entity extraction specialist for a school that gives you assessments. Given an assessment, your task is to extract the text value of the following entities:\n" +
                     "{\n" +
                     " \"question\": [\n" +
                     "  {\n" +
                     "   \"question_number\": \"\",\n" +
                     "   \"total_marks\": \"\",\n" +
                     "   \"question_text\": \"\",\n" +
                     "   \"marking_guide\": \"\"\n" +
                     "  }\n" +
                     " ],\n" +
                     " \"answer\": [\n" +
                     "  {\n" +
                     "   \"question_number\": \"\",\n" +
                     "   \"student_answer\": \"\"\n" +
                     "  }\n" +
                     " ],\n" +
                     "}\n\n" +
                     "- The JSON schema must be followed during the extraction.\n" +
                     "- The values must only include text strings found in the document.\n" +
                     "- Generate null for missing entities."
,
});
const generationConfig = {
    temperature: 1,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

async function run() {
    // 4. Upload files to Gemini
    const video1 = await uploadToGemini("./video1.mp4", "video/mp4");
    const audio1 = await uploadToGemini("./audio1.mp3", "audio/mp3");
    const image1 = await uploadToGemini("./image1.jpeg", "image/jpeg");
    const image2 = await uploadToGemini("./image2.jpg", "image/jpeg");
    const pdf1 = await uploadToGemini("./pdf1.pdf", "application/pdf.");

    // 5. Wait for all uploaded files to be processed and ready
    await waitForFilesActive(video1, audio1, image1, image2, pdf1);

    // 6. Start a chat session with the model using the uploaded files
    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [
                    {
                        // Sending pdf1 as part of the user message
                        fileData: {
                            mimeType: pdf1.mimeType,
                            fileUri: pdf1.uri,
                        },
                    },
                    {
                        // Sending audio1 as part of the user message
                        fileData: {
                            mimeType: audio1.mimeType,
                            fileUri: audio1.uri,
                        },
                    },
                    {
                        // Sending image1 as part of the user message
                        fileData: {
                            mimeType: image1.mimeType,
                            fileUri: image1.uri,
                        },
                    },
                    {
                        fileData: {
                            mimeType: image2.mimeType,
                            fileUri: image2.uri,
                        },
                    },
                    {
                        // Sending video1 as part of the user message
                        fileData: {
                            mimeType: video1.mimeType,
                            fileUri: video1.uri,
                        },
                    },
                ],
            },
        ],
    });

    // 7. Send a message to the chat session and log the response
    const result = await chatSession.sendMessage("Here is my file. Please adhere to your system instructions. Thanks");
    console.log(result.response.usageMetadata);
    console.log(result.response.text());
}

run();

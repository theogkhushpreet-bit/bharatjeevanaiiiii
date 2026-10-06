import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateWithRetry(modelName, message, maxRetries = 3, delay = 1500) {
  const model = genAI.getGenerativeModel({ model: modelName });
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      const isOverloaded = error.status === 503 || error.message?.includes('503') || error.message?.includes('high demand');
      
      if (isOverloaded && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} hit high demand (503). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff (1.5s -> 3s -> 6s)
      } else {
        throw error;
      }
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const text = await generateWithRetry('gemini-3.8-flash', message);

    return res.status(200).json({ success: true, answer: text });
  } catch (error) {
    console.error("AI API Error:", error);
    return res.status(500).json({ success: false, error: error.message || 'Server error occurred' });
  }
}

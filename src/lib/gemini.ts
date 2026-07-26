import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ParseContext {
  accounts: { id: number; bankName: string; type: string; accountLast4?: string }[];
  categories: string[];
  tags: string[];
}

export interface ParsedTransaction {
  amount?: number;
  type?: 'CREDIT' | 'DEBIT' | 'TRANSFER';
  party?: string;
  category?: string;
  tag?: string;
  paymentMethod?: string;
  upiApp?: string;
  note?: string;
  accountId?: number;
  toAccountId?: number;
}

export async function parseTransactionWithAI(
  userInput: string,
  context: ParseContext
): Promise<ParsedTransaction[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. AI parsing will fail.");
    }
    
    // We use gemini-1.5-flash as it's the fastest and most cost-effective for zero-shot extraction.
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const systemPrompt = `
You are a highly precise, zero-shot natural language parser for an expense tracking application. 
Your ONLY job is to extract transaction data perfectly from the user's input and return a JSON array of objects.
Do not invent or guess data based on external knowledge. Extract exactly what the user implies.

Available Accounts:
${JSON.stringify(context.accounts.map(a => ({ id: a.id, name: a.bankName, type: a.type })), null, 2)}

Available Categories:
${JSON.stringify(context.categories)}

Available Tags:
${JSON.stringify(context.tags)}

Allowed paymentMethod values: "UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet", "Cheque", "Cash", "Bank Transfer"

INSTRUCTIONS:
1. Break down the user's input. If the user mentions multiple transactions (e.g. "spent 500 on X and 200 on Y"), return multiple objects in the JSON array.
2. For each transaction, extract the following fields exactly. If a field is not mentioned or strongly implied, omit it or set it to null.
   - "amount": (number) the monetary value.
   - "type": (string) "CREDIT", "DEBIT", or "TRANSFER". (e.g., "paid", "spent", "bought" = DEBIT. "received", "got", "refund" = CREDIT. "transferred to" = TRANSFER).
   - "party": (string) The person or merchant involved (e.g., "to hrishav", "from Zomato"). Extract ONLY the name, ignore words like "to" or "from".
   - "note": (string) What it was for (e.g., "grocery", "rent").
   - "category": (string) Map the note/purpose to the CLOSEST match in the "Available Categories" array. 
   - "tag": (string) Map any explicit tag mentioned (e.g., "personal", "work") to the CLOSEST match in the "Available Tags" array.
   - "paymentMethod": (string) Map to one of the Allowed paymentMethod values.
   - "upiApp": (string) Name of the UPI app if mentioned (e.g., "GPay", "PhonePe").
   - "accountId": (number) The ID of the account from "Available Accounts" that best matches the user's description (e.g., "from HDFC" -> match the HDFC account ID).
   - "toAccountId": (number) For TRANSFER only, the ID of the destination account.

Return ONLY a valid JSON array of objects.
`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `User input: "${userInput}"` }
    ]);

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);
    
    // Validate it's an array
    if (Array.isArray(parsedData)) {
      return parsedData;
    } else if (parsedData && typeof parsedData === 'object') {
      return [parsedData as ParsedTransaction];
    }
    
    return [];
  } catch (error) {
    console.error("AI Parsing failed:", error);
    throw error;
  }
}

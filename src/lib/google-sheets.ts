import { google } from "googleapis";

export async function getGoogleSheetsClient() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google Sheets credentials in .env");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function syncDataToSheet(
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const sheets = await getGoogleSheetsClient();
  
  // Clear the existing data first (optional, but good for a full sync)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });

  // Write new data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

export async function getSheetData(spreadsheetId: string, range: string) {
  const sheets = await getGoogleSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error("Error reading from sheet:", error);
    return [];
  }
}

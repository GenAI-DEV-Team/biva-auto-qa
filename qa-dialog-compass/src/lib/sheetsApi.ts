import { api } from './api';

export interface SheetInfo {
  title: string;
  sheetId: number;
  index: number;
  sheetType: string;
  gridProperties: {
    rowCount: number;
    columnCount: number;
  };
}

export interface ConversationRow {
  conversation_id: string;
  customer_phone: string;
  bot_id: string;
  created_at: string;
  evaluation_result?: any;
  reviewed?: boolean;
  review_note?: string;
}

export interface UpdateRequest {
  sheet_name: string;
  records: Array<{
    ngay: string;
    nha_xe: string;
    conversation_id: string;
    note: string;
  }>;
}

// Get list of available sheets from Google Spreadsheet
export async function getSheetsList(): Promise<SheetInfo[]> {
  try {
    console.log('🔄 Calling API: /sheets/list');
    const response = await api.get<{ sheets: SheetInfo[] }>('/sheets/list');
    console.log('✅ API response:', response);
    const sheets = response.sheets || [];
    console.log('✅ Sheets count:', sheets.length);
    return sheets;
  } catch (error: any) {
    console.error('❌ Error fetching sheets list:', error);
    console.error('❌ Error details:', {
      status: error.status,
      message: error.message,
      response: error.response?.data,
      url: error.response?.config?.url,
      method: error.response?.config?.method
    });

    // Handle specific error cases with detailed messages
    if (error.status === 503) {
      if (error.message?.includes('credentials') || error.message?.includes('not configured')) {
        throw new Error('Google Sheets credentials not found or invalid. Please check that credentials.json exists and has correct permissions.');
      }
      if (error.message?.includes('spreadsheet') || error.message?.includes('not found')) {
        throw new Error('Google Spreadsheet not found or inaccessible. Please verify the SPREADSHEET_ID in environment variables.');
      }
      throw new Error('Google Sheets service unavailable. Please check your internet connection and try again.');
    }

    if (error.status === 401 || error.status === 403) {
      throw new Error('Authentication failed for Google Sheets API. Please check service account permissions and credentials.');
    }

    if (error.status === 429) {
      throw new Error('Google Sheets API quota exceeded. Please try again later or contact administrator.');
    }

    if (error.status >= 500) {
      throw new Error('Google Sheets service temporarily unavailable. Please try again in a few minutes.');
    }

    throw new Error(`Failed to fetch sheets list: ${error.message || 'Unknown error'}`);
  }
}

// Get conversations that have been evaluated or reviewed for sheets update
export async function getConversationsForSheets(filters?: {
  qaFilter?: 'all' | 'qa' | 'notqa';
  overallFilter?: 'all' | 'good' | 'warn' | 'bad' | 'other';
  reviewFilter?: 'all' | 'reviewed' | 'notreviewed';
  limit?: number;
  offset?: number;
}): Promise<ConversationRow[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.qaFilter) params.append('qa_filter', filters.qaFilter);
    if (filters?.overallFilter) params.append('overall_filter', filters.overallFilter);
    if (filters?.reviewFilter) params.append('review_filter', filters.reviewFilter);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const response = await api.get<{ conversations: ConversationRow[] }>(
      `/sheets/conversations${queryString ? `?${queryString}` : ''}`
    );
    return response.conversations || [];
  } catch (error: any) {
    console.error('Error fetching conversations for sheets:', error);

    // Handle specific error cases
    if (error.message?.includes('503')) {
      if (error.message?.includes('Database configuration issue') || error.message?.includes('doesn\'t exist') || error.message?.includes('does not exist')) {
        throw new Error('Database configuration issue. The database tables are missing or there\'s a database type mismatch. Please contact administrator to set up the database properly.');
      }
      if (error.message?.includes('Legacy conversation table not found')) {
        throw new Error('Database not properly set up. The legacy conversation table is missing. Please contact administrator to import legacy data.');
      }
      throw new Error('Google Sheets integration is not configured. Please contact administrator to set up Google Sheets credentials.');
    }

    throw error;
  }
}

// Update Google Sheets with conversation records
export async function updateGoogleSheets(requests: UpdateRequest[]): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post<{ success: boolean; message: string }>('/sheets/update', requests);
    return response;
  } catch (error: any) {
    console.error('Error updating Google Sheets:', error);

    // Handle specific error cases
    if (error.message?.includes('503')) {
      throw new Error('Google Sheets integration is not configured. Please contact administrator to set up Google Sheets credentials.');
    }

    throw error;
  }
}

"""
Google Sheets Service Module
Provides a clean interface for working with Google Sheets
"""

import gspread
from google.oauth2.service_account import Credentials
from typing import List, Dict, Any, Optional, Tuple, Union
from app.core.config import settings
import logging
import time
from functools import wraps

logger = logging.getLogger(__name__)


def retry_on_failure(max_attempts: int = 3, delay: float = 1.0):
    """Decorator to retry operations on failure"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        logger.warning(f"Attempt {attempt + 1} failed for {func.__name__}: {e}. Retrying...")
                        time.sleep(delay)
                    else:
                        logger.error(f"All {max_attempts} attempts failed for {func.__name__}: {e}")
            raise last_exception
        return wrapper
    return decorator


class GoogleSheetsService:
    """
    Service class for working with Google Sheets
    Provides methods for worksheet management, data operations, and conversation tracking
    """

    def __init__(self):
        """Initialize Google Sheets service with credentials from settings"""
        self.credentials_path = settings.GOOGLE_SHEET_CREDENTIALS_PATH
        self.spreadsheet_id = settings.GOOGLE_SHEET_SPREADSHEET_ID
        self.client: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None
        # Don't connect immediately - only when needed

    @retry_on_failure(max_attempts=3, delay=1.0)
    def _connect(self):
        """Connect to Google Sheets API"""
        try:
            # Check if credentials file exists
            import os
            if not os.path.exists(self.credentials_path):
                raise FileNotFoundError(f"Credentials file not found: {self.credentials_path}")

            # Set up required scopes
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]

            # Create credentials
            creds = Credentials.from_service_account_file(
                self.credentials_path,
                scopes=scopes
            )

            # Initialize client
            self.client = gspread.authorize(creds)
            self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)

            logger.info(f"Successfully connected to spreadsheet: {self.spreadsheet.title}")

        except FileNotFoundError as e:
            logger.error(f"Google Sheets credentials file not found: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to connect to Google Sheets: {e}")
            raise

    def _ensure_connection(self):
        """Ensure connection is active, reconnect if necessary"""
        if not self.client or not self.spreadsheet:
            self._connect()

    def get_worksheet(self, sheet_name: str) -> Optional[gspread.Worksheet]:
        """
        Get worksheet by name

        Args:
            sheet_name: Name of the worksheet

        Returns:
            gspread.Worksheet object or None if not found
        """
        try:
            self._ensure_connection()
            return self.spreadsheet.worksheet(sheet_name)
        except gspread.WorksheetNotFound:
            logger.error(f"Worksheet not found: {sheet_name}")
            return None
        except Exception as e:
            logger.error(f"Error getting worksheet {sheet_name}: {e}")
            return None

    def create_worksheet(self, sheet_name: str, rows: int = 1000, cols: int = 26) -> Optional[gspread.Worksheet]:
        """
        Create a new worksheet

        Args:
            sheet_name: Name of the new worksheet
            rows: Number of rows (default 1000)
            cols: Number of columns (default 26)

        Returns:
            gspread.Worksheet object or None if creation failed
        """
        try:
            self._ensure_connection()
            worksheet = self.spreadsheet.add_worksheet(
                title=sheet_name,
                rows=rows,
                cols=cols
            )
            logger.info(f"Created new worksheet: {sheet_name}")
            return worksheet
        except Exception as e:
            logger.error(f"Failed to create worksheet {sheet_name}: {e}")
            return None

    def list_worksheets(self) -> List[str]:
        """
        List all worksheets

        Returns:
            List of worksheet names
        """
        try:
            self._ensure_connection()
            worksheets = self.spreadsheet.worksheets()
            return [ws.title for ws in worksheets]
        except Exception as e:
            logger.error(f"Failed to list worksheets: {e}")
            return []

    @retry_on_failure(max_attempts=3, delay=0.5)
    def insert_row(self, sheet_name: str, values: List[Any], index: Optional[int] = None) -> bool:
        """
        Insert a new row into worksheet

        Args:
            sheet_name: Name of the worksheet
            values: List of values to insert
            index: Position to insert (None = append to end)

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            if index is None:
                worksheet.append_row(values)
            else:
                worksheet.insert_row(values, index)

            logger.info(f"Inserted row into worksheet {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert row into {sheet_name}: {e}")
            return False

    @retry_on_failure(max_attempts=3, delay=0.5)
    def insert_multiple_rows(self, sheet_name: str, values_list: List[List[Any]],
                           start_index: Optional[int] = None) -> bool:
        """
        Insert multiple rows at once

        Args:
            sheet_name: Name of the worksheet
            values_list: List of value lists to insert
            start_index: Starting position for insertion

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            if start_index is None:
                worksheet.append_rows(values_list)
            else:
                for i, values in enumerate(values_list):
                    worksheet.insert_row(values, start_index + i)

            logger.info(f"Inserted {len(values_list)} rows into {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert multiple rows into {sheet_name}: {e}")
            return False

    @retry_on_failure(max_attempts=3, delay=0.5)
    def update_row(self, sheet_name: str, row_index: int, values: List[Any]) -> bool:
        """
        Update a specific row

        Args:
            sheet_name: Name of the worksheet
            row_index: Row index (1-based)
            values: New values for the row

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            # Calculate range to update
            num_cols = len(values)
            range_name = f"A{row_index}:{gspread.utils.rowcol_to_a1(row_index, num_cols)}"

            worksheet.update(range_name, [values])
            logger.info(f"Updated row {row_index} in {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to update row {row_index} in {sheet_name}: {e}")
            return False

    @retry_on_failure(max_attempts=3, delay=0.5)
    def update_cell(self, sheet_name: str, row: int, col: int, value: Any) -> bool:
        """
        Update a specific cell

        Args:
            sheet_name: Name of the worksheet
            row: Row number (1-based)
            col: Column number (1-based)
            value: New value

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            worksheet.update_cell(row, col, value)
            logger.info(f"Updated cell ({row}, {col}) in {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to update cell ({row}, {col}) in {sheet_name}: {e}")
            return False

    def fetch_all_data(self, sheet_name: str, include_headers: bool = True) -> List[List[Any]]:
        """
        Fetch all data from worksheet

        Args:
            sheet_name: Name of the worksheet
            include_headers: Whether to include header row

        Returns:
            List of data rows
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return []

            data = worksheet.get_all_values()

            if not include_headers and data:
                data = data[1:]  # Skip header row

            logger.info(f"Fetched {len(data)} rows from {sheet_name}")
            return data

        except Exception as e:
            logger.error(f"Failed to fetch data from {sheet_name}: {e}")
            return []

    def fetch_paginated_data(self, sheet_name: str, page_size: int = 100,
                           page: int = 1, include_headers: bool = True) -> Tuple[List[List[Any]], int]:
        """
        Fetch paginated data from worksheet

        Args:
            sheet_name: Name of the worksheet
            page_size: Number of rows per page
            page: Page number (1-based)
            include_headers: Whether to include headers

        Returns:
            Tuple of (data, total_pages)
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return [], 0

            # Get all data
            all_data = worksheet.get_all_values()

            if not all_data:
                return [], 0

            headers = []
            data_rows = all_data

            if include_headers and all_data:
                headers = all_data[0]
                data_rows = all_data[1:]

            # Calculate pagination
            total_rows = len(data_rows)
            total_pages = (total_rows + page_size - 1) // page_size

            # Calculate start and end indices
            start_idx = (page - 1) * page_size
            end_idx = min(start_idx + page_size, total_rows)

            # Get current page data
            page_data = data_rows[start_idx:end_idx]

            # Add headers if needed
            if include_headers and headers:
                page_data = [headers] + page_data

            logger.info(f"Fetched page {page}/{total_pages} from {sheet_name}")
            return page_data, total_pages

        except Exception as e:
            logger.error(f"Failed to fetch paginated data from {sheet_name}: {e}")
            return [], 0

    def fetch_range_data(self, sheet_name: str, range_name: str) -> List[List[Any]]:
        """
        Fetch data from a specific range

        Args:
            sheet_name: Name of the worksheet
            range_name: Range in A1 notation (e.g., "A1:C10")

        Returns:
            List of data rows in the range
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return []

            data = worksheet.get(range_name)
            logger.info(f"Fetched range {range_name} from {sheet_name}")
            return data

        except Exception as e:
            logger.error(f"Failed to fetch range {range_name} from {sheet_name}: {e}")
            return []

    @retry_on_failure(max_attempts=3, delay=0.5)
    def delete_row(self, sheet_name: str, row_index: int) -> bool:
        """
        Delete a specific row

        Args:
            sheet_name: Name of the worksheet
            row_index: Row index to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            worksheet.delete_rows(row_index)
            logger.info(f"Deleted row {row_index} from {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete row {row_index} from {sheet_name}: {e}")
            return False

    @retry_on_failure(max_attempts=3, delay=0.5)
    def clear_sheet(self, sheet_name: str, keep_headers: bool = True) -> bool:
        """
        Clear all data from worksheet

        Args:
            sheet_name: Name of the worksheet
            keep_headers: Whether to keep header row

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            if keep_headers:
                worksheet.clear("A2:Z")  # Clear from row 2 onwards
            else:
                worksheet.clear()

            logger.info(f"Cleared data from {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to clear data from {sheet_name}: {e}")
            return False

    @retry_on_failure(max_attempts=3, delay=0.5)
    def find_and_replace(self, sheet_name: str, find_text: str, replace_text: str) -> int:
        """
        Find and replace text in worksheet

        Args:
            sheet_name: Name of the worksheet
            find_text: Text to find
            replace_text: Text to replace with

        Returns:
            Number of cells replaced
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return 0

            result = worksheet.find_replace(find_text, replace_text)
            replaced_count = result.get('replacedCells', 0)
            logger.info(f"Replaced {replaced_count} cells in {sheet_name}")
            return replaced_count

        except Exception as e:
            logger.error(f"Failed to find and replace in {sheet_name}: {e}")
            return 0

    def get_next_available_row(self, sheet_name: str) -> int:
        """
        Find the first available empty row for insertion

        Args:
            sheet_name: Name of the worksheet

        Returns:
            First available row number (1-based)
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return 1

            # Get all data in column A (STT column)
            stt_column = worksheet.col_values(1)

            # Find first row with empty or whitespace-only STT
            for i, value in enumerate(stt_column):
                if not value.strip():
                    return i + 1

            # If no empty rows found, return next row after last
            return len(stt_column) + 1

        except Exception as e:
            logger.error(f"Failed to find next available row in {sheet_name}: {e}")
            return 1

    def get_next_stt_number(self, sheet_name: str) -> int:
        """
        Get the next sequential tracking number (STT)

        Args:
            sheet_name: Name of the worksheet

        Returns:
            Next STT number
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return 1

            # Get all values in STT column
            stt_column = worksheet.col_values(1)

            max_stt = 0
            for value in stt_column:
                if value.strip() and value.strip().isdigit():
                    max_stt = max(max_stt, int(value.strip()))

            return max_stt + 1

        except Exception as e:
            logger.error(f"Failed to get next STT number from {sheet_name}: {e}")
            return 1

    @retry_on_failure(max_attempts=3, delay=0.5)
    def insert_conversation_record(self, sheet_name: str, ngay: str, nha_xe: str,
                                 conversation_id: str, note: str, auto_stt: bool = True) -> bool:
        """
        Insert a conversation record with auto-generated STT

        Args:
            sheet_name: Name of the worksheet
            ngay: Date (format: dd/mm)
            nha_xe: Transport company name
            conversation_id: Conversation ID
            note: Note/comment
            auto_stt: Whether to auto-generate STT

        Returns:
            True if successful, False otherwise
        """
        try:
            # Find first available row
            target_row = self.get_next_available_row(sheet_name)

            # Generate STT if needed
            if auto_stt:
                stt = str(self.get_next_stt_number(sheet_name))
            else:
                stt = str(target_row - 1) if target_row > 1 else "1"

            # Create data to insert
            values = [stt, ngay, nha_xe, conversation_id, note]

            # Update specific row
            success = self.update_row(sheet_name, target_row, values)

            if success:
                logger.info(f"Inserted conversation record with STT {stt} at row {target_row}")
                return True
            return False

        except Exception as e:
            logger.error(f"Failed to insert conversation record: {e}")
            return False

    @retry_on_failure(max_attempts=3, delay=0.5)
    def insert_to_top(self, sheet_name: str, ngay: str, nha_xe: str,
                     conversation_id: str, note: str) -> bool:
        """
        Insert record at the top of the sheet (after header), pushing older records down

        Args:
            sheet_name: Name of the worksheet
            ngay: Date (format: dd/mm)
            nha_xe: Transport company name
            conversation_id: Conversation ID
            note: Note/comment

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            # Insert new row at position 2 (after header)
            new_row = ["1", ngay, nha_xe, conversation_id, note]
            worksheet.insert_row(new_row, 2)

            # Update all STT numbers
            self.update_all_stt(sheet_name)

            logger.info(f"Inserted new record at top of {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert record at top of {sheet_name}: {e}")
            return False

    def update_all_stt(self, sheet_name: str) -> bool:
        """
        Update all STT numbers sequentially from 1, 2, 3...

        Args:
            sheet_name: Name of the worksheet

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            # Get all data
            all_data = worksheet.get_all_values()
            if len(all_data) <= 1:  # Only header or empty
                return True

            updates = []
            current_stt = 1

            # Start from row 2 (after header)
            for row_idx, row in enumerate(all_data[1:], start=2):
                if len(row) > 1:
                    # Check if row has real data (not just STT)
                    has_real_data = any(cell.strip() for cell in row[1:4])  # Date, Company, Conversation ID

                    if has_real_data:
                        # Update STT
                        updates.append({
                            'range': f'A{row_idx}',
                            'values': [[str(current_stt)]]
                        })
                        current_stt += 1
                    else:
                        # Empty row, clear STT
                        updates.append({
                            'range': f'A{row_idx}',
                            'values': [['']]
                        })

            # Perform batch update
            if updates:
                worksheet.batch_update(updates)
                logger.info(f"Updated STT for {len([u for u in updates if u['values'][0][0]])} rows in {sheet_name}")

            return True

        except Exception as e:
            logger.error(f"Failed to update STT numbers in {sheet_name}: {e}")
            return False

    def insert_multiple_conversation_records(self, sheet_name: str,
                                           records: List[Dict[str, str]],
                                           auto_stt: bool = True) -> bool:
        """
        Insert multiple conversation records

        Args:
            sheet_name: Name of the worksheet
            records: List of record dictionaries
            auto_stt: Whether to auto-generate STT

        Returns:
            True if all records inserted successfully, False otherwise
        """
        try:
            success_count = 0

            for record in records:
                success = self.insert_conversation_record(
                    sheet_name=sheet_name,
                    ngay=record.get('ngay', ''),
                    nha_xe=record.get('nha_xe', ''),
                    conversation_id=record.get('conversation_id', ''),
                    note=record.get('note', ''),
                    auto_stt=auto_stt
                )
                if success:
                    success_count += 1
                    time.sleep(0.1)  # Avoid rate limiting

            logger.info(f"Successfully inserted {success_count}/{len(records)} conversation records")
            return success_count == len(records)

        except Exception as e:
            logger.error(f"Failed to insert multiple conversation records: {e}")
            return False

    def insert_multiple_to_top(self, sheet_name: str, records: List[Dict[str, str]]) -> bool:
        """
        Insert multiple records at the top (newest records first)

        Args:
            sheet_name: Name of the worksheet
            records: List of record dictionaries (newest first in list)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Insert records in reverse order so the first record in the list
            # ends up at the top of the sheet
            for record in reversed(records):
                success = self.insert_to_top(
                    sheet_name=sheet_name,
                    ngay=record.get('ngay', ''),
                    nha_xe=record.get('nha_xe', ''),
                    conversation_id=record.get('conversation_id', ''),
                    note=record.get('note', '')
                )
                if not success:
                    return False
                time.sleep(0.1)  # Avoid rate limiting

            logger.info(f"Successfully inserted {len(records)} records at top of {sheet_name}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert multiple records at top: {e}")
            return False

    def fill_empty_stt_column(self, sheet_name: str) -> bool:
        """
        Fill empty STT values in the worksheet

        Args:
            sheet_name: Name of the worksheet

        Returns:
            True if successful, False otherwise
        """
        try:
            worksheet = self.get_worksheet(sheet_name)
            if not worksheet:
                return False

            # Get all data
            all_data = worksheet.get_all_values()
            if not all_data:
                return False

            updates = []
            current_stt = 1

            # Start from row 2 (skip header)
            for row_idx, row in enumerate(all_data[1:], start=2):
                if len(row) > 0:
                    # Check if row has data (not completely empty)
                    has_data = any(cell.strip() for cell in row[1:])  # Skip STT column

                    if has_data:
                        # Fill empty or non-numeric STT
                        if not row[0].strip() or not row[0].strip().isdigit():
                            updates.append({
                                'range': f'A{row_idx}',
                                'values': [[str(current_stt)]]
                            })
                        current_stt += 1

            # Perform batch update
            if updates:
                worksheet.batch_update(updates)
                logger.info(f"Filled STT for {len(updates)} rows in {sheet_name}")

            return True

        except Exception as e:
            logger.error(f"Failed to fill empty STT column in {sheet_name}: {e}")
            return False


# Global service instance
google_sheets_service = GoogleSheetsService()

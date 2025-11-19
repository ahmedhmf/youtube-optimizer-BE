export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

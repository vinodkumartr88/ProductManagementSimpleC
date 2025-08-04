export interface Product {
  id: string;
  name: string;
  price: number;
  brand: string;
  availability: 'In Stock' | 'Out of Stock' | 'Low Stock';
  imageUrl?: string;
  // Add 70 extra fields for new headers
  [key: string]: string | number | undefined;
}

export interface BulkUploadResult {
  successful: Product[];
  failed: Array<{ row: number; error: string; data: any }>;
}
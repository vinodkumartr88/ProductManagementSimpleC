import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Product, BulkUploadResult } from "@/types/product";
import { useToast } from "@/hooks/use-toast";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (products: Product[]) => void;
}

const BulkUploadDialog = ({ open, onOpenChange, onUpload }: BulkUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileType && ['csv', 'xlsx', 'xls'].includes(fileType)) {
        setFile(selectedFile);
        setResult(null);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV or Excel file",
          variant: "destructive"
        });
      }
    }
  };

  const parseCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  };

  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const validateAndProcessData = (data: any[]): BulkUploadResult => {
    const successful: Product[] = [];
    const failed: Array<{ row: number; error: string; data: any }> = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header
      
      try {
        // Normalize field names (case insensitive)
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          normalizedRow[normalizedKey] = row[key];
        });

        const id = String(normalizedRow.id || normalizedRow.product_id || '').trim();
        const name = String(normalizedRow.name || normalizedRow.product_name || '').trim();
        const price = parseFloat(normalizedRow.price || 0);
        const brand = String(normalizedRow.brand || '').trim();
        const availability = normalizedRow.availability || normalizedRow.status || 'In Stock';
        const imageUrl = typeof normalizedRow.imageurl === 'string' ? normalizedRow.imageurl.trim() : '';

        // Validation
        if (!id) {
          failed.push({ row: rowNumber, error: 'ID is required', data: row });
          return;
        }
        if (!name) {
          failed.push({ row: rowNumber, error: 'Name is required', data: row });
          return;
        }
        if (!brand) {
          failed.push({ row: rowNumber, error: 'Brand is required', data: row });
          return;
        }
        if (isNaN(price) || price <= 0) {
          failed.push({ row: rowNumber, error: 'Valid price is required', data: row });
          return;
        }

        // Normalize availability values
        let normalizedAvailability: Product['availability'] = 'In Stock';
        const availabilityLower = String(availability).toLowerCase().trim();
        if (availabilityLower.includes('out') || availabilityLower === 'false' || availabilityLower === '0') {
          normalizedAvailability = 'Out of Stock';
        } else if (availabilityLower.includes('low')) {
          normalizedAvailability = 'Low Stock';
        }

        var extraFields = {};
        for (var key in normalizedRow) {
          if (key.startsWith('extra') && (typeof normalizedRow[key] === 'string' || typeof normalizedRow[key] === 'number')) {
            extraFields[key] = normalizedRow[key];
          }
        }
        successful.push({
          id,
          name,
          price,
          brand,
          availability: normalizedAvailability,
          imageUrl,
          ...extraFields
        });
      } catch (error) {
        failed.push({ 
          row: rowNumber, 
          error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          data: row 
        });
      }
    });

    return { successful, failed };
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);

    try {
      let data: any[];
      
      if (file.name.endsWith('.csv')) {
        data = await parseCSV(file);
      } else {
        data = await parseExcel(file);
      }

      setProgress(50);

      const result = validateAndProcessData(data);
      setResult(result);
      setProgress(100);

      if (result.successful.length > 0) {
        console.log('Uploading products:', result.successful);
        onUpload(result.successful);
        toast({
          title: "Upload completed",
          description: `Successfully processed ${result.successful.length} products`,
        });
        
        // Close dialog after successful upload
        setTimeout(() => {
          handleClose();
        }, 2000);
      }

      if (result.failed.length > 0) {
        toast({
          title: "Some products failed to upload",
          description: `${result.failed.length} products had errors`,
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const extraColumnKeys = [];
    for (let i = 1; i <= 70; i++) {
      extraColumnKeys.push('extra' + i); 
    }

    function getExtraColumnData() {
      const extraData = {};
      for (let i = 1; i <= 70; i++) {
        extraData['extra' + i] = 'Value Extra ' + i + ' - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque euismod, nisi eu consectetur consectetur, nisl nisi euismod nisi, euismod euismod nisi.'.repeat(2).slice(0, 120);
      }
      return extraData;
    }

    const template = [
       {
        id: 'PROD001',
        name: 'Sample Product',
        price: 29.99,
        brand: 'Sample Brand',
        availability: 'In Stock',
        imageUrl: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop',
        ...getExtraColumnData()
      },
      {
        id: 'PROD002',
        name: 'Another Product',
        price: 49.99,
        brand: 'Another Brand',
        availability: 'Low Stock',
        imageUrl: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop',
        ...getExtraColumnData()
      },
          {
        id: 'PROD003',
        name: 'Another Product2',
        price: 49.99,
        brand: 'Another Brand',
        availability: 'Low Stock',
        imageUrl: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop',
        ...getExtraColumnData()
      },
          {
        id: 'PROD004',
        name: 'Another Product3',
        price: 4.99,
        brand: 'Another Brand',
        availability: 'Low Stock',
        imageUrl: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop',
        ...getExtraColumnData()
      },
          {
        id: 'PROD005',
        name: 'Another Product4',
        price: 9.99,
        brand: 'Another Brand',
        availability: 'Low Stock',
        imageUrl: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=400&fit=crop',
        ...getExtraColumnData()
      }
    ];
    
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setProgress(0);
    setResult(null);
    setUploading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Upload Products
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select CSV or Excel File</Label>
              <div className="mt-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Supported formats: CSV, XLSX, XLS
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="w-full"
            >
              Download Template CSV
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {result.successful.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully processed {result.successful.length} products
                  </AlertDescription>
                </Alert>
              )}
              
              {result.failed.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {result.failed.length} products failed to process:
                    <ul className="mt-2 list-disc list-inside text-sm max-h-32 overflow-y-auto">
                      {result.failed.slice(0, 5).map((failure, index) => (
                        <li key={index}>Row {failure.row}: {failure.error}</li>
                      ))}
                      {result.failed.length > 5 && (
                        <li>... and {result.failed.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Required columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>id</strong> - Unique product identifier</li>
                <li><strong>name</strong> - Product name</li>
                <li><strong>price</strong> - Product price (numeric)</li>
                <li><strong>brand</strong> - Product brand</li>
                <li><strong>availability</strong> - In Stock, Low Stock, or Out of Stock</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploading}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Products
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUploadDialog;

import { useState, useRef } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import CountdownBanner from '@/components/CountdownBanner';

export default function FbaSync() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ success: number; fail: number } | null>(null);

  const { data: history, isLoading: historyLoading } = trpc.sync.history.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const uploadMutation = trpc.sync.upload.useMutation({
    onSuccess: (data) => {
      setUploadResult({ success: data.successCount, fail: data.failCount });
      setUploadProgress(100);
      toast.success(`同步完成: 成功 ${data.successCount} 个, 失败 ${data.failCount} 个`);
      utils.sync.history.invalidate();
      utils.sku.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.alerts.invalidate();
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || '同步失败');
      setUploading(false);
      setUploadProgress(0);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setUploadProgress(30);
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setUploadProgress(50);

        // 解析ERP导出的数据
        // E列 MSKU -> SKU
        // H列 FBA可用库存 -> 在售库存
        // O列 FBA标发在途 -> 在途库存
        const records = jsonData.map((row: any) => {
          const msku = row['MSKU'] || row['msku'] || '';
          const fbaStock = parseInt(row['FBA可用库存'] || row['FBA库存'] || '0') || 0;
          const inTransitStock = parseInt(row['FBA标发在途'] || row['在途库存'] || '0') || 0;
          return { msku, fbaStock, inTransitStock };
        }).filter((r: { msku: string }) => r.msku);

        if (records.length === 0) {
          toast.error('未找到有效数据，请检查文件格式');
          setUploading(false);
          setUploadProgress(0);
          return;
        }

        setUploadProgress(70);

        uploadMutation.mutate({
          brandName,
          fileName: file.name,
          records,
        });
      } catch (error) {
        toast.error('文件解析失败，请检查文件格式');
        setUploading(false);
        setUploadProgress(0);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <CountdownBanner />
      {/* 上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            FBA库存同步
          </CardTitle>
          <CardDescription>
            上传ERP导出的Excel文件，系统将自动匹配SKU并更新库存数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 说明 */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">文件格式要求：</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>E列（MSKU）：对应系统中的SKU</li>
                <li>H列（FBA可用库存）：更新为在售库存</li>
                <li>O列（FBA标发在途）：更新为在途库存</li>
              </ul>
            </div>

            {/* 上传按钮 */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                uploading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {uploading ? (
                <div className="space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <div>
                    <p className="font-medium">正在同步...</p>
                    <p className="text-sm text-muted-foreground">请稍候</p>
                  </div>
                  <Progress value={uploadProgress} className="w-64 mx-auto" />
                  {uploadResult && (
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <span className="text-green-600">成功: {uploadResult.success}</span>
                      <span className="text-red-600">失败: {uploadResult.fail}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">点击或拖拽上传Excel文件</p>
                    <p className="text-sm text-muted-foreground">支持 .xlsx, .xls 格式</p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    选择文件
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 同步历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            同步历史
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-center py-8 text-muted-foreground">加载中...</p>
          ) : !history || history.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">暂无同步记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {record.status === 'completed' ? (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    ) : record.status === 'failed' ? (
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{record.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p>总记录: {record.totalRecords}</p>
                      <div className="flex gap-2">
                        <span className="text-green-600">成功: {record.successCount}</span>
                        <span className="text-red-600">失败: {record.failCount}</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        record.status === 'completed' ? 'default' :
                        record.status === 'failed' ? 'destructive' : 'secondary'
                      }
                    >
                      {record.status === 'completed' ? '已完成' :
                       record.status === 'failed' ? '失败' : '处理中'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

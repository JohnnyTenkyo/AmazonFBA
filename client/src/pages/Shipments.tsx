import { useState, useRef, useMemo } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Plus, Upload, Download, Trash2, ExternalLink, Copy, ChevronDown, ChevronRight, Truck, Package, Search, Calendar, Check, Undo2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import CountdownBanner from '@/components/CountdownBanner';

// 辅助函数：格式化日期为字符串
const formatDate = (date: any): string => {
  if (!date) return '-';
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return String(date);
};

export default function Shipments() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<'shipment' | 'sku'>('shipment');
  const [searchTerm, setSearchTerm] = useState('');
  const [skuSearchTerm, setSkuSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [markArrivalId, setMarkArrivalId] = useState<number | null>(null);
  const [arrivalDate, setArrivalDate] = useState('');
  const [editExpectedId, setEditExpectedId] = useState<number | null>(null);
  const [newExpectedDate, setNewExpectedDate] = useState('');
  const [isArrivedExpanded, setIsArrivedExpanded] = useState(false);
  const [modifiedFlags, setModifiedFlags] = useState<Record<number, string>>({});

  // 表单状态 - 移除category字段，通过SKU自动匹配
  const [formData, setFormData] = useState({
    trackingNumber: '',
    warehouse: '',
    shipDate: '',
    items: [{ sku: '', quantity: 0 }],
  });

  const { data: shipments, isLoading } = trpc.shipment.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: skus } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const createMutation = trpc.shipment.create.useMutation({
    onSuccess: () => {
      toast.success('货件添加成功');
      setIsAddDialogOpen(false);
      resetForm();
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.shipment.delete.useMutation({
    onSuccess: () => {
      toast.success('货件删除成功');
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const clearAllMutation = trpc.shipment.clearAll.useMutation({
    onSuccess: () => {
      toast.success('已清空所有货件');
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const markArrivedMutation = trpc.shipment.markArrived.useMutation({
    onSuccess: (data) => {
      const statusText = data.status === 'early' ? '提前到达' : data.status === 'delayed' ? '延迟到达' : '已到达';
      toast.success(`货件已标记为${statusText}`);
      setMarkArrivalId(null);
      setArrivalDate('');
      utils.shipment.list.invalidate();
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // 撤销到达状态
  const undoArrivalMutation = trpc.shipment.undoArrival.useMutation({
    onSuccess: () => {
      toast.success('已撤销到达状态，货件恢复为运输中');
      utils.shipment.list.invalidate();
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateExpectedMutation = trpc.shipment.updateExpectedDate.useMutation({
    onSuccess: (data) => {
      toast.success('预计到货日期已更新');
      // 保存修改标记
      if (editExpectedId && data.modifiedFlag) {
        setModifiedFlags(prev => ({
          ...prev,
          [editExpectedId]: data.modifiedFlag
        }));
      }
      setEditExpectedId(null);
      setNewExpectedDate('');
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const batchImportMutation = trpc.shipment.batchImport.useMutation({
    onSuccess: (data) => {
      toast.success(`成功导入 ${data.count} 个货件`);
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      trackingNumber: '',
      warehouse: '',
      shipDate: '',
      items: [{ sku: '', quantity: 0 }],
    });
  };

  const handleSubmit = () => {
    if (!formData.trackingNumber) {
      toast.error('请输入货运号');
      return;
    }
    if (formData.items.some(item => !item.sku || item.quantity <= 0)) {
      toast.error('请填写完整的SKU和数量');
      return;
    }

    // 根据SKU自动确定类别
    const skuCategories = formData.items.map(item => {
      const skuRecord = skus?.find(s => s.sku === item.sku);
      return skuRecord?.category || 'standard';
    });
    // 如果有任何大件，整个货件按大件处理
    const category = skuCategories.includes('oversized') ? 'oversized' : 'standard';

    const items = formData.items.map(item => {
      const skuRecord = skus?.find(s => s.sku === item.sku);
      return {
        skuId: skuRecord?.id || 0,
        sku: item.sku,
        quantity: item.quantity,
      };
    });

    createMutation.mutate({
      brandName,
      trackingNumber: formData.trackingNumber,
      warehouse: formData.warehouse,
      shipDate: formData.shipDate || undefined,
      category,
      items,
    });
  };

  // 下载模板 - 移除类别字段
  const handleDownloadTemplate = () => {
    const template = [
      { SKU: 'SKU001', '货运号': 'FBA123456', '到达仓库': 'PHX6', '发货数量': 100, '发货日期': '2026-01-15' },
      { SKU: 'SKU002', '货运号': 'FBA123456', '到达仓库': 'PHX6', '发货数量': 50, '发货日期': '2026-01-15' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '货件模板');
    XLSX.writeFile(wb, '货件导入模板.xlsx');
  };

  // 导入处理 - 移除类别字段，通过SKU自动匹配
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 辅助函数：将Excel日期数字转换为日期字符串
        const excelDateToString = (excelDate: any): string => {
          if (!excelDate) return '';
          if (typeof excelDate === 'string') return excelDate;
          if (typeof excelDate === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
            return date.toISOString().split('T')[0];
          }
          return String(excelDate);
        };

        // 移除category字段，通过SKU自动匹配
        const items = jsonData.map((row: any) => ({
          sku: String(row['SKU'] || row['sku'] || ''),
          trackingNumber: String(row['货运号'] || row['trackingNumber'] || ''),
          warehouse: String(row['到达仓库'] || row['warehouse'] || ''),
          quantity: parseInt(row['发货数量'] || row['quantity'] || '0') || 0,
          shipDate: excelDateToString(row['发货日期'] || row['shipDate']),
        })).filter((item: { sku: string; trackingNumber: string }) => item.sku && item.trackingNumber);

        if (items.length === 0) {
          toast.error('未找到有效数据');
          return;
        }

        batchImportMutation.mutate({ brandName, items });
      } catch (error) {
        toast.error('文件解析失败');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'shipping':
        return <Badge className="bg-blue-500 hover:bg-blue-600">运输中</Badge>;
      case 'arrived':
        return <Badge className="bg-gray-500 hover:bg-gray-600">已到达</Badge>;
      case 'early':
        return <Badge className="bg-green-500 hover:bg-green-600">提前到达</Badge>;
      case 'delayed':
        return <Badge className="bg-red-500 hover:bg-red-600">延迟到达</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  // 过滤货件 - 同时支持货运号和SKU搜索
  const filteredShipments = useMemo(() => {
    const filtered = shipments?.filter(s => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        // 搜索货运号
        if (s.trackingNumber.toLowerCase().includes(searchLower)) return true;
        return false;
      }
      return true;
    }) || [];
    
    // 按预计到达时间排序（近期优先）
    return [...filtered].sort((a, b) => {
      const dateA = a.expectedArrivalDate ? new Date(a.expectedArrivalDate).getTime() : Infinity;
      const dateB = b.expectedArrivalDate ? new Date(b.expectedArrivalDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [shipments, searchTerm]);

  // 计算货件总数量
  const calculateShipmentTotal = (shipmentId: number, items: any[]) => {
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  return (
    <div className="space-y-6">
      <CountdownBanner />
      {/* 标题和查询链接 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">货件详情管理</h2>
          <div className="flex gap-2 mt-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="shipment">货件视图</TabsTrigger>
                <TabsTrigger value="sku">SKU视图</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://track.kqgyl.com/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              凯琦查询
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://yl-speedy.t6soft.com/admin/main" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              鹰龙查询
            </a>
          </Button>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索货运号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-1" />
            下载模板
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-1" />
                批量导入
              </span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-1" />
                添加货件
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>添加货件</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>货运号 *</Label>
                    <Input
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder="如 FBA123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>到达仓库</Label>
                    <Input
                      value={formData.warehouse}
                      onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                      placeholder="如 PHX6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>发货日期</Label>
                  <Input
                    type="date"
                    value={formData.shipDate}
                    onChange={(e) => setFormData({ ...formData, shipDate: e.target.value })}
                    className="w-48"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU明细（类别将根据SKU自动匹配）</Label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Select
                        value={item.sku}
                        onValueChange={(v) => {
                          const newItems = [...formData.items];
                          newItems[index].sku = v;
                          setFormData({ ...formData, items: newItems });
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="选择SKU" />
                        </SelectTrigger>
                        <SelectContent>
                          {skus?.map(s => (
                            <SelectItem key={s.id} value={s.sku}>
                              {s.sku} ({s.category === 'oversized' ? '大件' : '标准件'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="数量"
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].quantity = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                        className="w-24"
                      />
                      {formData.items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== index);
                            setFormData({ ...formData, items: newItems });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, items: [...formData.items, { sku: '', quantity: 0 }] })}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    添加SKU
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? '添加中...' : '添加'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                清空全部
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空所有货件？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除所有货件数据，且无法恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearAllMutation.mutate({ brandName })}
                  className="bg-destructive text-destructive-foreground"
                >
                  确认清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 货件列表 - 货件视图 */}
      {viewMode === 'shipment' && (
        <Tabs defaultValue="standard">
          <TabsList className="mb-4">
            <TabsTrigger value="standard" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              标准件
            </TabsTrigger>
            <TabsTrigger value="oversized" className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              大件
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  标准件货件 ({filteredShipments.filter(s => s.category === 'standard').length}个)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-4 text-muted-foreground">加载中...</p>
                ) : filteredShipments.filter(s => s.category === 'standard').length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">暂无标准件货件</p>
                ) : (
                  <div className="space-y-2">
                    {/* 未到达的标准件货件 */}
                    {filteredShipments.filter(s => s.category === 'standard' && !['arrived', 'early', 'delayed'].includes(s.status)).map(shipment => (
                      <ShipmentCard
                        key={shipment.id}
                        shipment={shipment}
                        onCopy={copyToClipboard}
                        onMarkArrival={(id) => {
                          setMarkArrivalId(id);
                          setArrivalDate(new Date().toISOString().split('T')[0]);
                        }}
                        onEditExpected={(id, currentDate) => {
                          setEditExpectedId(id);
                          setNewExpectedDate(formatDate(currentDate));
                        }}
                        onUndoArrival={(id) => undoArrivalMutation.mutate({ id })}
                        onDelete={(id) => deleteMutation.mutate({ id })}
                        getStatusBadge={getStatusBadge}
                        modifiedFlags={modifiedFlags}
                      />
                    ))}
                    
                    {/* 已到达的标准件货件 - 折叠板块 */}
                    {filteredShipments.filter(s => s.category === 'standard' && ['arrived', 'early', 'delayed'].includes(s.status)).length > 0 && (
                      <Collapsible open={isArrivedExpanded} onOpenChange={setIsArrivedExpanded}>
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-transparent">
                              <ChevronRight className={`w-4 h-4 mr-2 transition-transform ${isArrivedExpanded ? 'rotate-90' : ''}`} />
                              <span className="font-medium">已到达货件 ({filteredShipments.filter(s => s.category === 'standard' && ['arrived', 'early', 'delayed'].includes(s.status)).length}个)</span>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-4 space-y-2">
                            {filteredShipments.filter(s => s.category === 'standard' && ['arrived', 'early', 'delayed'].includes(s.status)).map(shipment => (
                              <ShipmentCard
                                key={shipment.id}
                                shipment={shipment}
                                onCopy={copyToClipboard}
                                onMarkArrival={(id) => {
                                  setMarkArrivalId(id);
                                  setArrivalDate(new Date().toISOString().split('T')[0]);
                                }}
                                onEditExpected={(id, currentDate) => {
                                  setEditExpectedId(id);
                                  setNewExpectedDate(formatDate(currentDate));
                                }}
                                onUndoArrival={(id) => undoArrivalMutation.mutate({ id })}
                                onDelete={(id) => deleteMutation.mutate({ id })}
                                getStatusBadge={getStatusBadge}
                              />
                            ))}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="oversized">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-500" />
                  大件货件 ({filteredShipments.filter(s => s.category === 'oversized').length}个)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-4 text-muted-foreground">加载中...</p>
                ) : filteredShipments.filter(s => s.category === 'oversized').length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">暂无大件货件</p>
                ) : (
                  <div className="space-y-2">
                    {/* 未到达的大件货件 */}
                    {filteredShipments.filter(s => s.category === 'oversized' && !['arrived', 'early', 'delayed'].includes(s.status)).map(shipment => (
                      <ShipmentCard
                        key={shipment.id}
                        shipment={shipment}
                        onCopy={copyToClipboard}
                        onMarkArrival={(id) => {
                          setMarkArrivalId(id);
                          setArrivalDate(new Date().toISOString().split('T')[0]);
                        }}
                        onEditExpected={(id, currentDate) => {
                          setEditExpectedId(id);
                          setNewExpectedDate(formatDate(currentDate));
                        }}
                        onUndoArrival={(id) => undoArrivalMutation.mutate({ id })}
                        onDelete={(id) => deleteMutation.mutate({ id })}
                        getStatusBadge={getStatusBadge}
                        modifiedFlags={modifiedFlags}
                      />
                    ))}
                    
                    {/* 已到达的大件货件 - 折叠板块 */}
                    {filteredShipments.filter(s => s.category === 'oversized' && ['arrived', 'early', 'delayed'].includes(s.status)).length > 0 && (
                      <Collapsible open={isArrivedExpanded} onOpenChange={setIsArrivedExpanded}>
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-transparent">
                              <ChevronRight className={`w-4 h-4 mr-2 transition-transform ${isArrivedExpanded ? 'rotate-90' : ''}`} />
                              <span className="font-medium">已到达货件 ({filteredShipments.filter(s => s.category === 'oversized' && ['arrived', 'early', 'delayed'].includes(s.status)).length}个)</span>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-4 space-y-2">
                            {filteredShipments.filter(s => s.category === 'oversized' && ['arrived', 'early', 'delayed'].includes(s.status)).map(shipment => (
                              <ShipmentCard
                                key={shipment.id}
                                shipment={shipment}
                                onCopy={copyToClipboard}
                                onMarkArrival={(id) => {
                                  setMarkArrivalId(id);
                                  setArrivalDate(new Date().toISOString().split('T')[0]);
                                }}
                                onEditExpected={(id, currentDate) => {
                                  setEditExpectedId(id);
                                  setNewExpectedDate(formatDate(currentDate));
                                }}
                                onUndoArrival={(id) => undoArrivalMutation.mutate({ id })}
                                onDelete={(id) => deleteMutation.mutate({ id })}
                                getStatusBadge={getStatusBadge}
                              />
                            ))}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* SKU视图 */}
      {viewMode === 'sku' && (
        <SkuView 
          shipments={filteredShipments} 
          skus={skus || []} 
          onCopy={copyToClipboard}
          skuSearchTerm={skuSearchTerm}
          setSkuSearchTerm={setSkuSearchTerm}
        />
      )}

      {/* 标记到达对话框 */}
      <Dialog open={markArrivalId !== null} onOpenChange={(open) => !open && setMarkArrivalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认货件到达</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>实际到达日期</Label>
              <Input
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkArrivalId(null)}>取消</Button>
            <Button
              onClick={() => {
                if (markArrivalId && arrivalDate) {
                  markArrivedMutation.mutate({ id: markArrivalId, actualArrivalDate: arrivalDate });
                }
              }}
              disabled={markArrivedMutation.isPending}
            >
              {markArrivedMutation.isPending ? '处理中...' : '确认到达'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改预计到货日期对话框 */}
      <Dialog open={editExpectedId !== null} onOpenChange={(open) => !open && setEditExpectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改预计到货日期</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              修改预计到货日期用于跟踪货件延迟情况，不会改变货件的到达状态。
            </p>
            <div className="space-y-2">
              <Label>新的预计到货日期</Label>
              <Input
                type="date"
                value={newExpectedDate}
                onChange={(e) => setNewExpectedDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpectedId(null)}>取消</Button>
            <Button
              onClick={() => {
                if (editExpectedId && newExpectedDate) {
                  updateExpectedMutation.mutate({ id: editExpectedId, expectedArrivalDate: newExpectedDate });
                }
              }}
              disabled={updateExpectedMutation.isPending}
            >
              {updateExpectedMutation.isPending ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 货件卡片组件
function ShipmentCard({ shipment, onCopy, onMarkArrival, onEditExpected, onUndoArrival, onDelete, getStatusBadge, modifiedFlags }: {
  shipment: any;
  onCopy: (text: string) => void;
  onMarkArrival: (id: number) => void;
  onEditExpected: (id: number, currentDate: any) => void;
  onUndoArrival: (id: number) => void;
  onDelete: (id: number) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  modifiedFlags: Record<number, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 获取货件明细
  const { data: items, isLoading } = trpc.shipment.getItems.useQuery(
    { shipmentId: shipment.id },
    { enabled: isOpen }
  );

  // 计算总数量
  const totalQuantity = items && Array.isArray(items) ? items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;

  // 判断是否已到达（包括 arrived, early, delayed）
  const isArrived = shipment && ['arrived', 'early', 'delayed'].includes(shipment.status) && shipment.actualArrivalDate;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() => onCopy(shipment.trackingNumber)}
                >
                  {shipment.trackingNumber}
                </span>
                <Button variant="ghost" size="sm" onClick={() => onCopy(shipment.trackingNumber)}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Badge variant="outline" className="ml-2 whitespace-nowrap text-sm md:text-base font-semibold px-2 md:px-3 py-1">
                  共 {shipment.totalQuantity || 0} 件
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {shipment.warehouse && <span>仓库: {shipment.warehouse}</span>}
                {shipment.shipDate && <span className="ml-4">发货: {formatDate(shipment.shipDate)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="flex items-center gap-1 text-sm md:text-base font-semibold text-blue-600">
                <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                预计到货: {formatDate(shipment.expectedArrivalDate)}
                {/* 预计到货时间始终可修改 */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => onEditExpected(shipment.id, shipment.expectedArrivalDate)}
                >
                  修改
                </Button>
                {modifiedFlags[shipment.id] && (
                  <Badge className={modifiedFlags[shipment.id] === 'early' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                    {modifiedFlags[shipment.id] === 'early' ? '预计提早到达' : '预计延迟到达'}
                  </Badge>
                )}
              </p>
              {shipment.actualArrivalDate && <p className="text-sm text-green-600 font-medium mt-1">实际到货: {formatDate(shipment.actualArrivalDate)}</p>}
            </div>
            {getStatusBadge(shipment.status)}
            {/* 确认到达按钮始终存在（未到达时显示） */}
            {!isArrived && (
              <Button variant="outline" size="sm" onClick={() => onMarkArrival(shipment.id)}>
                <Check className="w-4 h-4 mr-1" />
                确认到达
              </Button>
            )}
            {/* 已到达时显示撤回按钮 */}
            {isArrived && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50">
                    <Undo2 className="w-4 h-4 mr-1" />
                    撤回
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认撤回到达状态？</AlertDialogTitle>
                    <AlertDialogDescription>
                      撤回后，货件将恢复为"运输中"状态，库存数据也将相应调整。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onUndoArrival(shipment.id)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      确认撤回
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除？</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除货件 "{shipment.trackingNumber}" 吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(shipment.id)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : Array.isArray(items) && items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">SKU</th>
                    <th className="text-right p-2">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    if (!item || typeof item !== 'object') return null;
                    return (
                      <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-2">{item.sku || '-'}</td>
                        <td className="p-2 text-right">{item.quantity || 0}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-medium bg-muted/30">
                    <td className="p-2">合计</td>
                    <td className="p-2 text-right">{totalQuantity}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">暂无明细</p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// SKU视图组件
function SkuView({ shipments, skus, onCopy, skuSearchTerm, setSkuSearchTerm }: { 
  shipments: any[]; 
  skus: any[]; 
  onCopy: (text: string) => void;
  skuSearchTerm: string;
  setSkuSearchTerm: (term: string) => void;
}) {
  const [expandedSku, setExpandedSku] = useState<number | null>(null);
  
  // 过滤SKU - 只显示在途数量大于0的
  const filterSkus = (skuList: any[]) => {
    return skuList.filter(sku => {
      // 在途数量为0的不显示
      if ((sku.inTransitStock || 0) <= 0) return false;
      // SKU搜索过滤
      if (skuSearchTerm && !sku.sku.toLowerCase().includes(skuSearchTerm.toLowerCase())) return false;
      return true;
    });
  };

  return (
    <div className="space-y-4">
      {/* SKU搜索框 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索SKU..."
            value={skuSearchTerm}
            onChange={(e) => setSkuSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      <Tabs defaultValue="standard">
        <TabsList className="mb-4">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            标准件
          </TabsTrigger>
          <TabsTrigger value="oversized" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            大件
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="standard">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                标准件SKU在途情况
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SkuTable 
                skus={filterSkus(skus.filter(s => s.category === 'standard' && !s.isDiscontinued))} 
                shipments={shipments}
                expandedSku={expandedSku}
                setExpandedSku={setExpandedSku}
                onCopy={onCopy}
                category="standard"
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="oversized">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" />
                大件SKU在途情况
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SkuTable 
                skus={filterSkus(skus.filter(s => s.category === 'oversized' && !s.isDiscontinued))} 
                shipments={shipments}
                expandedSku={expandedSku}
                setExpandedSku={setExpandedSku}
                onCopy={onCopy}
                category="oversized"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// SKU表格组件
function SkuTable({ skus, shipments, expandedSku, setExpandedSku, onCopy, category }: {
  skus: any[];
  shipments: any[];
  expandedSku: number | null;
  setExpandedSku: (id: number | null) => void;
  onCopy: (text: string) => void;
  category: 'standard' | 'oversized';
}) {
  // 颜色配置
  const colors = category === 'oversized' 
    ? {
        primary: 'bg-orange-500',
        light: 'bg-orange-100',
        text: 'text-orange-700',
        header: 'bg-orange-500',
      }
    : {
        primary: 'bg-emerald-700',
        light: 'bg-emerald-100',
        text: 'text-emerald-800',
        header: 'bg-emerald-700',
      };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className={`${colors.header}`}>
            <th className="text-left px-8 py-3 w-1/4 rounded-tl-lg">
              <span className="text-sm font-semibold text-white">SKU 列表</span>
            </th>
            <th className="text-center px-4 py-3 w-1/4">
              <span className="text-sm font-semibold text-white">FBA库存</span>
            </th>
            <th className="text-center px-4 py-3 w-1/4">
              <span className="text-sm font-semibold text-white">ERP在途数量</span>
            </th>
            <th className="text-center px-4 py-3 w-1/4 rounded-tr-lg">
              <span className="text-sm font-semibold text-white">差异</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {skus.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-8 text-muted-foreground">
                暂无在途数据
              </td>
            </tr>
          ) : (
            skus.map(sku => (
              <SkuRow 
                key={sku.id} 
                sku={sku} 
                isExpanded={expandedSku === sku.id}
                onToggle={() => setExpandedSku(expandedSku === sku.id ? null : sku.id)}
                onCopy={onCopy}
                colors={colors}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// SKU行组件
function SkuRow({ sku, isExpanded, onToggle, onCopy, colors }: {
  sku: any;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  colors: {
    primary: string;
    light: string;
    text: string;
    header: string;
  };
}) {
  // 获取该SKU的在途货件（包括所有运输中的货件）
  const { data: shipmentItems, isLoading } = trpc.shipment.getBySkuId.useQuery(
    { skuId: sku.id }
  );

  const erpInTransit = sku.inTransitStock || 0;
  
  // 计算货件合计数量
  const shipmentTotal = shipmentItems?.reduce((sum: number, item: any) => sum + (item.item?.quantity || 0), 0) || 0;
  
  // 计算差异（ERP在途数量 - 货件合计数量）
  const difference = erpInTransit - shipmentTotal;
  
  // 差异颜色
  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'bg-blue-500'; // 正数蓝色
    if (diff < 0) return 'bg-red-500';  // 负数红色
    return 'bg-gray-500';                // 0灰色
  };

  return (
    <>
      <tr 
        className="border-b hover:bg-gray-100 transition-colors cursor-pointer" 
        onClick={onToggle}
      >
        <td className="px-8 py-4">
          <div className="flex items-center gap-3">
            <div className={`${colors.primary} px-4 py-2 rounded-lg shadow-sm min-w-[120px] text-center`}>
              <span className="text-sm font-semibold text-white">{sku.sku}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <div className={`${colors.primary} inline-block px-4 py-2 rounded-lg shadow-sm min-w-[80px]`}>
            <span className="text-base font-bold text-white">{sku.fbaStock || 0}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <div className={`${colors.primary} inline-block px-4 py-2 rounded-lg shadow-sm min-w-[80px]`}>
            <span className="text-base font-bold text-white">{erpInTransit}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-center">
          <div className={`${getDifferenceColor(difference)} inline-block px-4 py-2 rounded-lg shadow-sm min-w-[80px]`}>
            <span className="text-base font-bold text-white">{difference > 0 ? `+${difference}` : difference}</span>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={4} className="p-0">
            <div className="bg-gradient-to-r from-[#F5F3F0] to-[#EAE4DC] p-6 border-l-4 border-[#B8A99A]">
              {isLoading ? (
                <p className="text-center text-base text-muted-foreground">加载中...</p>
              ) : shipmentItems && shipmentItems.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                        <th className="text-center p-3 text-base font-bold text-gray-700">货运号</th>
                        <th className="text-center p-3 text-base font-bold text-gray-700">数量</th>
                        <th className="text-center p-3 text-base font-bold text-gray-700">预计到货</th>
                        <th className="text-center p-3 text-base font-bold text-gray-700">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipmentItems.map((item: any, index: number) => (
                        <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span 
                                className="cursor-pointer hover:text-blue-600 font-medium text-base"
                                onClick={() => onCopy(item.shipment?.trackingNumber || '')}
                              >
                                {item.shipment?.trackingNumber || '-'}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 hover:bg-blue-100"
                                onClick={() => onCopy(item.shipment?.trackingNumber || '')}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-lg font-bold text-blue-600">{item.item?.quantity || 0}</span>
                          </td>
                          <td className="p-3 text-center text-base font-medium">
                            {item.shipment?.expectedArrivalDate 
                              ? formatDate(item.shipment.expectedArrivalDate)
                              : '-'}
                          </td>
                          <td className="p-3 text-center">
                            {item.shipment?.status === 'shipping' && (
                              <Badge className="bg-blue-500 text-sm px-3 py-1">运输中</Badge>
                            )}
                            {item.shipment?.status === 'early' && (
                              <Badge className="bg-green-500 text-sm px-3 py-1">提前到达</Badge>
                            )}
                            {item.shipment?.status === 'delayed' && (
                              <Badge className="bg-red-500 text-sm px-3 py-1">延迟到达</Badge>
                            )}
                            {item.shipment?.status === 'arrived' && (
                              <Badge className="bg-gray-500 text-sm px-3 py-1">已到达</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {/* 合计行 */}
                      <tr className="bg-gradient-to-r from-gray-100 to-gray-200 border-t-2 border-gray-300">
                        <td className="p-3 text-center font-bold text-gray-700">合计</td>
                        <td className="p-3 text-center">
                          <span className="text-lg font-bold text-blue-700">{shipmentTotal}</span>
                        </td>
                        <td className="p-3 text-center" colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-base text-muted-foreground py-4">暂无在途货件</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

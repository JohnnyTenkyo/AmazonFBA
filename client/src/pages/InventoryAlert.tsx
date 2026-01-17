import { useState } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { AlertCircle, AlertTriangle, CheckCircle, Search, TrendingUp, Package, Truck } from 'lucide-react';
import CountdownBanner from '@/components/CountdownBanner';

export default function InventoryAlert() {
  const { brandName } = useLocalAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryTab, setCategoryTab] = useState<'standard' | 'oversized'>('standard');

  const { data: summary } = trpc.dashboard.summary.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: alerts, isLoading } = trpc.dashboard.alerts.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: transportConfig } = trpc.transport.get.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  // 按类别过滤SKU
  const filterByCategory = (skuList: any[]) => {
    return skuList.filter(sku => sku.category === categoryTab);
  };

  // 计算各类别的统计
  const getCategoryStats = (category: 'standard' | 'oversized') => {
    const urgentCount = alerts?.urgent?.filter((s: any) => s.category === category).length || 0;
    const warningCount = alerts?.warning?.filter((s: any) => s.category === category).length || 0;
    const sufficientCount = alerts?.sufficient?.filter((s: any) => s.category === category).length || 0;
    return { urgentCount, warningCount, sufficientCount };
  };

  const standardStats = getCategoryStats('standard');
  const oversizedStats = getCategoryStats('oversized');

  // 计算建议日销量
  const calculateSuggestedDailySales = (sku: any, type: 'urgent' | 'warning' | 'sufficient') => {
    const fbaStock = sku.fbaStock || 0;
    const inTransitStock = sku.inTransitStock || 0;
    const totalStock = fbaStock + inTransitStock;
    const currentDailySales = parseFloat(sku.dailySales?.toString() || '0');

    if (type === 'sufficient') {
      // 库存充足时，计算目标日销量以在35天内消耗库存
      const targetDays = 35;
      const suggestedSales = totalStock / targetDays;
      return {
        suggested: suggestedSales.toFixed(2),
        message: `建议日销 ${suggestedSales.toFixed(2)} 件以在35天内消耗库存`,
      };
    } else {
      // 预警时，计算需要降低到多少日销才能撑到下次到货
      // 假设下次到货需要运输周期时间
      const shippingDays = sku.category === 'standard' 
        ? (transportConfig?.standardShippingDays || 25) + (transportConfig?.standardShelfDays || 10)
        : (transportConfig?.oversizedShippingDays || 35) + (transportConfig?.oversizedShelfDays || 10);
      
      const suggestedSales = fbaStock / shippingDays;
      return {
        suggested: suggestedSales.toFixed(2),
        message: `建议日销降至 ${suggestedSales.toFixed(2)} 件以撑到下次到货（约${shippingDays}天）`,
      };
    }
  };

  // 过滤SKU
  const filterSkus = (skuList: any[]) => {
    let filtered = filterByCategory(skuList);
    if (searchTerm) {
      filtered = filtered.filter(sku => 
        sku.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  };

  const renderSkuCard = (sku: any, type: 'urgent' | 'warning' | 'sufficient') => {
    const dailySales = parseFloat(sku.dailySales?.toString() || '0');
    const fbaStock = sku.fbaStock || 0;
    const inTransitStock = sku.inTransitStock || 0;
    const daysOfStock = dailySales > 0 ? Math.floor(fbaStock / dailySales) : 999;
    const suggestion = calculateSuggestedDailySales(sku, type);

    const bgColor = type === 'urgent' ? 'bg-red-50 border-red-200' :
                    type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-green-50 border-green-200';

    return (
      <div key={sku.id} className={`p-4 rounded-lg border ${bgColor}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="font-medium text-lg">{sku.sku}</span>
            <Badge variant="outline" className="ml-2">
              {sku.category === 'standard' ? '标准件' : '大件'}
            </Badge>
          </div>
          {type === 'urgent' && <Badge className="bg-red-500">紧急</Badge>}
          {type === 'warning' && <Badge className="bg-yellow-500 text-yellow-900">一般</Badge>}
          {type === 'sufficient' && <Badge className="bg-green-500">充足</Badge>}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
          <div>
            <p className="text-muted-foreground">FBA库存</p>
            <p className="font-medium">{fbaStock}</p>
          </div>
          <div>
            <p className="text-muted-foreground">在途库存</p>
            <p className="font-medium">{inTransitStock}</p>
          </div>
          <div>
            <p className="text-muted-foreground">日销量</p>
            <p className="font-medium">{dailySales}</p>
          </div>
          <div>
            <p className="text-muted-foreground">可售天数</p>
            <p className="font-medium">{daysOfStock === 999 ? '∞' : daysOfStock}天</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm bg-white/50 rounded p-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span>{suggestion.message}</span>
        </div>
      </div>
    );
  };

  const currentStats = categoryTab === 'standard' ? standardStats : oversizedStats;

  return (
    <div className="space-y-6">
      <CountdownBanner />
      {/* 类别切换 */}
      <div className="flex gap-4">
        <button
          onClick={() => setCategoryTab('standard')}
          className={`flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
            categoryTab === 'standard' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Package className={`w-6 h-6 ${categoryTab === 'standard' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`font-medium ${categoryTab === 'standard' ? 'text-primary' : ''}`}>标准件</p>
            <p className="text-sm text-muted-foreground">
              紧急 {standardStats.urgentCount} | 一般 {standardStats.warningCount} | 充足 {standardStats.sufficientCount}
            </p>
          </div>
        </button>
        <button
          onClick={() => setCategoryTab('oversized')}
          className={`flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
            categoryTab === 'oversized' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Truck className={`w-6 h-6 ${categoryTab === 'oversized' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`font-medium ${categoryTab === 'oversized' ? 'text-primary' : ''}`}>大件</p>
            <p className="text-sm text-muted-foreground">
              紧急 {oversizedStats.urgentCount} | 一般 {oversizedStats.warningCount} | 充足 {oversizedStats.sufficientCount}
            </p>
          </div>
        </button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-red-600">紧急预警</p>
                <p className="text-3xl font-bold text-red-600">{currentStats.urgentCount}</p>
                <p className="text-xs text-red-500">7天内缺货且无在途</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-yellow-700">一般预警</p>
                <p className="text-3xl font-bold text-yellow-700">{currentStats.warningCount}</p>
                <p className="text-xs text-yellow-600">35天内缺货且无在途</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-700">库存充足</p>
                <p className="text-3xl font-bold text-green-700">{currentStats.sufficientCount}</p>
                <p className="text-xs text-green-600">可售卖35天以上</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* 预警列表 */}
      <Tabs defaultValue="urgent">
        <TabsList>
          <TabsTrigger value="urgent" className="gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            紧急预警 ({filterSkus(alerts?.urgent || []).length})
          </TabsTrigger>
          <TabsTrigger value="warning" className="gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            一般预警 ({filterSkus(alerts?.warning || []).length})
          </TabsTrigger>
          <TabsTrigger value="sufficient" className="gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            库存充足 ({filterSkus(alerts?.sufficient || []).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urgent" className="mt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">加载中...</p>
          ) : filterSkus(alerts?.urgent || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                <p className="text-muted-foreground">暂无{categoryTab === 'standard' ? '标准件' : '大件'}紧急预警</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filterSkus(alerts?.urgent || []).map(sku => renderSkuCard(sku, 'urgent'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="warning" className="mt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">加载中...</p>
          ) : filterSkus(alerts?.warning || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                <p className="text-muted-foreground">暂无{categoryTab === 'standard' ? '标准件' : '大件'}一般预警</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filterSkus(alerts?.warning || []).map(sku => renderSkuCard(sku, 'warning'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sufficient" className="mt-4">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">加载中...</p>
          ) : filterSkus(alerts?.sufficient || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-2" />
                <p className="text-muted-foreground">暂无{categoryTab === 'standard' ? '标准件' : '大件'}库存充足的SKU</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filterSkus(alerts?.sufficient || []).map(sku => renderSkuCard(sku, 'sufficient'))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

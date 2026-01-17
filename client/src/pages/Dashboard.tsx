import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, AlertTriangle, AlertCircle, CheckCircle, 
  Truck, TrendingUp, Calendar, Clock
} from 'lucide-react';
import { Link } from 'wouter';

export default function Dashboard() {
  const { brandName } = useLocalAuth();
  
  const { data: summary, isLoading: summaryLoading } = trpc.dashboard.summary.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: alerts, isLoading: alertsLoading } = trpc.dashboard.alerts.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: springConfig } = trpc.springFestival.get.useQuery(
    { brandName, year: new Date().getFullYear() },
    { enabled: !!brandName }
  );

  const { data: promotions } = trpc.promotion.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  // 计算春节倒计时
  const getSpringFestivalCountdown = () => {
    if (!springConfig?.holidayStartDate) return null;
    const start = new Date(springConfig.holidayStartDate);
    const now = new Date();
    const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff <= 60) {
      return diff;
    }
    return null;
  };

  // 计算促销倒计时
  const getPromotionCountdowns = () => {
    if (!promotions) return [];
    const now = new Date();
    return promotions
      .filter(p => p.isActive && p.thisYearStartDate)
      .map(p => {
        const start = new Date(p.thisYearStartDate!);
        const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { name: p.name, days: diff };
      })
      .filter(p => p.days > 0 && p.days <= 60);
  };

  const springCountdown = getSpringFestivalCountdown();
  const promotionCountdowns = getPromotionCountdowns();

  if (summaryLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 倒计时提醒 */}
      {(springCountdown || promotionCountdowns.length > 0) && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">重要提醒</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {springCountdown && (
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                <Calendar className="w-4 h-4" />
                <span>距离春节放假还有 <strong>{springCountdown}</strong> 天</span>
              </div>
            )}
            {promotionCountdowns.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                <TrendingUp className="w-4 h-4" />
                <span>距离{p.name}还有 <strong>{p.days}</strong> 天</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总SKU数</p>
                <p className="text-2xl font-bold">{summary?.totalSkus || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              活跃: {summary?.activeSkus || 0} | 淘汰: {summary?.discontinuedSkus || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">紧急预警</p>
                <p className="text-2xl font-bold text-red-600">{summary?.urgentCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-red-600">
              7天内缺货且无在途
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">一般预警</p>
                <p className="text-2xl font-bold text-yellow-700">{summary?.warningCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-yellow-700">
              35天内缺货且无在途
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-green-200 bg-green-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">库存充足</p>
                <p className="text-2xl font-bold text-green-700">{summary?.sufficientCount || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-green-700">
              可售卖35天以上
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 在途货件 */}
      <Card className="card-hover">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span className="font-semibold">在途货件</span>
          </div>
          <p className="text-3xl font-bold">{summary?.shippingShipments || 0}</p>
          <Link href="/shipments" className="text-sm text-primary hover:underline mt-2 inline-block">
            查看详情 →
          </Link>
        </CardContent>
      </Card>

      {/* 预警列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 紧急预警列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              紧急预警 SKU
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : alerts?.urgent && alerts.urgent.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.urgent.slice(0, 10).map(sku => (
                  <div key={sku.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                    <div>
                      <span className="font-medium">{sku.sku}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        库存: {sku.fbaStock || 0}
                      </span>
                    </div>
                    <Badge variant="destructive">紧急</Badge>
                  </div>
                ))}
                {alerts.urgent.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    还有 {alerts.urgent.length - 10} 个...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">暂无紧急预警</p>
            )}
          </CardContent>
        </Card>

        {/* 一般预警列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              一般预警 SKU
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : alerts?.warning && alerts.warning.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.warning.slice(0, 10).map(sku => (
                  <div key={sku.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                    <div>
                      <span className="font-medium">{sku.sku}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        库存: {sku.fbaStock || 0}
                      </span>
                    </div>
                    <Badge className="bg-yellow-500 text-yellow-900">一般</Badge>
                  </div>
                ))}
                {alerts.warning.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    还有 {alerts.warning.length - 10} 个...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">暂无一般预警</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

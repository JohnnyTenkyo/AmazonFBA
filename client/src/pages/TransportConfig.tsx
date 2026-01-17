import { useState, useEffect } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Ship, Package, Clock, Save, RefreshCw } from 'lucide-react';
import CountdownBanner from '@/components/CountdownBanner';

export default function TransportConfig() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();

  const [config, setConfig] = useState({
    standardShippingDays: 25,
    standardShelfDays: 10,
    oversizedShippingDays: 35,
    oversizedShelfDays: 10,
  });

  const { data: savedConfig, isLoading } = trpc.transport.get.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  useEffect(() => {
    if (savedConfig) {
      setConfig({
        standardShippingDays: savedConfig.standardShippingDays || 25,
        standardShelfDays: savedConfig.standardShelfDays || 10,
        oversizedShippingDays: savedConfig.oversizedShippingDays || 35,
        oversizedShelfDays: savedConfig.oversizedShelfDays || 10,
      });
    }
  }, [savedConfig]);

  const updateMutation = trpc.transport.update.useMutation({
    onSuccess: () => {
      toast.success('配置保存成功，已同步到相关表单');
      // 刷新所有相关数据
      utils.transport.get.invalidate();
      utils.shipment.list.invalidate();
      // utils.shippingPlan.list.invalidate(); // TODO: 添加shippingPlan router后启用
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      brandName,
      ...config,
    });
  };

  const handleReset = () => {
    setConfig({
      standardShippingDays: 25,
      standardShelfDays: 10,
      oversizedShippingDays: 35,
      oversizedShelfDays: 10,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <CountdownBanner />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">运输配置</h2>
          <p className="text-sm text-muted-foreground">
            配置标准件和大件的运输周期，影响备货计划和发货计划的计算
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-1" />
            重置默认
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-1" />
            {updateMutation.isPending ? '保存中...' : '保存配置'}
          </Button>
        </div>
      </div>

      {/* 标准件配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            标准件运输配置
          </CardTitle>
          <CardDescription>
            适用于常规尺寸产品的运输周期设置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Ship className="w-4 h-4" />
                船期（天）
              </Label>
              <Input
                type="number"
                value={config.standardShippingDays}
                onChange={(e) => setConfig({ ...config, standardShippingDays: parseInt(e.target.value) || 0 })}
                min={1}
              />
              <p className="text-xs text-muted-foreground">从发货到到达目的港的时间</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                上架天数（天）
              </Label>
              <Input
                type="number"
                value={config.standardShelfDays}
                onChange={(e) => setConfig({ ...config, standardShelfDays: parseInt(e.target.value) || 0 })}
                min={1}
              />
              <p className="text-xs text-muted-foreground">从到港到上架可售的时间</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>总运输周期：</strong>{config.standardShippingDays + config.standardShelfDays} 天
              （船期 {config.standardShippingDays} 天 + 上架 {config.standardShelfDays} 天）
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 大件配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            大件运输配置
          </CardTitle>
          <CardDescription>
            适用于超大尺寸产品的运输周期设置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Ship className="w-4 h-4" />
                船期（天）
              </Label>
              <Input
                type="number"
                value={config.oversizedShippingDays}
                onChange={(e) => setConfig({ ...config, oversizedShippingDays: parseInt(e.target.value) || 0 })}
                min={1}
              />
              <p className="text-xs text-muted-foreground">从发货到到达目的港的时间</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                上架天数（天）
              </Label>
              <Input
                type="number"
                value={config.oversizedShelfDays}
                onChange={(e) => setConfig({ ...config, oversizedShelfDays: parseInt(e.target.value) || 0 })}
                min={1}
              />
              <p className="text-xs text-muted-foreground">从到港到上架可售的时间</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-700">
              <strong>总运输周期：</strong>{config.oversizedShippingDays + config.oversizedShelfDays} 天
              （船期 {config.oversizedShippingDays} 天 + 上架 {config.oversizedShelfDays} 天）
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 说明 */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">配置说明</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>修改运输配置后，系统将自动更新所有相关的备货计划和发货计划</li>
            <li>船期指从工厂发货到货物到达亚马逊目的仓库的海运时间</li>
            <li>上架天数指从货物到达仓库到完成入库上架可售的处理时间</li>
            <li>促销项目的最晚发货时间会根据此配置自动计算</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

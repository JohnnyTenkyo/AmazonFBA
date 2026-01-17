import { useState, useEffect } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Calendar, Clock, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import CountdownBanner from '@/components/CountdownBanner';

export default function SpringFestival() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const [config, setConfig] = useState({
    holidayStartDate: '',
    holidayEndDate: '',
    lastShipDate: '',
    returnToWorkDate: '',
    firstShipDate: '',
  });

  const { data: savedConfig, isLoading } = trpc.springFestival.get.useQuery(
    { brandName, year },
    { enabled: !!brandName }
  );

  useEffect(() => {
    if (savedConfig) {
      setConfig({
        holidayStartDate: savedConfig.holidayStartDate ? new Date(savedConfig.holidayStartDate).toISOString().split('T')[0] : '',
        holidayEndDate: savedConfig.holidayEndDate ? new Date(savedConfig.holidayEndDate).toISOString().split('T')[0] : '',
        lastShipDate: savedConfig.lastShipDate ? new Date(savedConfig.lastShipDate).toISOString().split('T')[0] : '',
        returnToWorkDate: savedConfig.returnToWorkDate ? new Date(savedConfig.returnToWorkDate).toISOString().split('T')[0] : '',
        firstShipDate: savedConfig.firstShipDate ? new Date(savedConfig.firstShipDate).toISOString().split('T')[0] : '',
      });
    } else {
      // 没有配置时清空表单
      setConfig({
        holidayStartDate: '',
        holidayEndDate: '',
        lastShipDate: '',
        returnToWorkDate: '',
        firstShipDate: '',
      });
    }
  }, [savedConfig, year]);

  const updateMutation = trpc.springFestival.update.useMutation({
    onSuccess: () => {
      toast.success('春节配置保存成功，已同步到发货计划');
      // 刷新所有相关数据
      utils.springFestival.get.invalidate();
      // utils.shippingPlan.list.invalidate(); // TODO: 添加shippingPlan router后启用
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const clearMutation = trpc.springFestival.clear.useMutation({
    onSuccess: () => {
      toast.success('春节配置已清空');
      utils.springFestival.get.invalidate();
      // utils.shippingPlan.list.invalidate(); // TODO: 添加shippingPlan router后启用
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = () => {
    if (!config.holidayStartDate || !config.holidayEndDate) {
      toast.error('请至少设置放假开始和结束日期');
      return;
    }
    updateMutation.mutate({
      brandName,
      year,
      ...config,
    });
  };

  const handleClear = () => {
    clearMutation.mutate({
      brandName,
      year,
    });
  };

  // 计算倒计时
  const getCountdown = () => {
    if (!config.holidayStartDate) return null;
    const start = new Date(config.holidayStartDate);
    const now = new Date();
    const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const countdown = getCountdown();
  const showCountdown = countdown !== null && countdown > 0 && countdown <= 60;

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
      {/* 倒计时提醒 */}
      {showCountdown && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-lg">春节倒计时</p>
              <p>距离春节放假还有 <strong className="text-2xl">{countdown}</strong> 天，请及时安排发货计划！</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">春节配置</h2>
          <p className="text-sm text-muted-foreground">
            配置春节假期时间，系统将自动调整发货计划
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>年份</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
              className="w-24"
              min={currentYear - 1}
              max={currentYear + 2}
            />
          </div>
          <Button variant="outline" onClick={handleClear} disabled={clearMutation.isPending || !savedConfig}>
            <RefreshCw className="w-4 h-4 mr-1" />
            {clearMutation.isPending ? '清空中...' : '清空配置'}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="w-4 h-4 mr-1" />
            {updateMutation.isPending ? '保存中...' : '保存配置'}
          </Button>
        </div>
      </div>

      {/* 假期配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-500" />
            假期时间
          </CardTitle>
          <CardDescription>
            设置工厂春节放假和复工时间
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>放假开始日期</Label>
              <Input
                type="date"
                value={config.holidayStartDate}
                onChange={(e) => setConfig({ ...config, holidayStartDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">工厂开始放假的日期</p>
            </div>
            <div className="space-y-2">
              <Label>放假结束日期</Label>
              <Input
                type="date"
                value={config.holidayEndDate}
                onChange={(e) => setConfig({ ...config, holidayEndDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">工厂假期结束的日期</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 发货时间配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            发货时间
          </CardTitle>
          <CardDescription>
            设置春节前后的发货时间节点
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>最后发货日期</Label>
              <Input
                type="date"
                value={config.lastShipDate}
                onChange={(e) => setConfig({ ...config, lastShipDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">春节前最后一批货物的发货日期</p>
            </div>
            <div className="space-y-2">
              <Label>复工日期</Label>
              <Input
                type="date"
                value={config.returnToWorkDate}
                onChange={(e) => setConfig({ ...config, returnToWorkDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">工厂正式复工的日期</p>
            </div>
            <div className="space-y-2">
              <Label>最早出货日期</Label>
              <Input
                type="date"
                value={config.firstShipDate}
                onChange={(e) => setConfig({ ...config, firstShipDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">复工后最早可以发货的日期</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 时间线预览 */}
      {(config.lastShipDate || config.holidayStartDate || config.returnToWorkDate || config.firstShipDate) && (
        <Card>
          <CardHeader>
            <CardTitle>时间线预览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {config.lastShipDate && (
                  <div className="flex items-center gap-4 ml-4">
                    <div className="w-3 h-3 rounded-full bg-blue-500 -ml-[7px]" />
                    <div>
                      <p className="font-medium">最后发货</p>
                      <p className="text-sm text-muted-foreground">{config.lastShipDate}</p>
                    </div>
                  </div>
                )}
                {config.holidayStartDate && (
                  <div className="flex items-center gap-4 ml-4">
                    <div className="w-3 h-3 rounded-full bg-red-500 -ml-[7px]" />
                    <div>
                      <p className="font-medium">开始放假</p>
                      <p className="text-sm text-muted-foreground">{config.holidayStartDate}</p>
                    </div>
                  </div>
                )}
                {config.holidayEndDate && (
                  <div className="flex items-center gap-4 ml-4">
                    <div className="w-3 h-3 rounded-full bg-orange-500 -ml-[7px]" />
                    <div>
                      <p className="font-medium">假期结束</p>
                      <p className="text-sm text-muted-foreground">{config.holidayEndDate}</p>
                    </div>
                  </div>
                )}
                {config.returnToWorkDate && (
                  <div className="flex items-center gap-4 ml-4">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 -ml-[7px]" />
                    <div>
                      <p className="font-medium">正式复工</p>
                      <p className="text-sm text-muted-foreground">{config.returnToWorkDate}</p>
                    </div>
                  </div>
                )}
                {config.firstShipDate && (
                  <div className="flex items-center gap-4 ml-4">
                    <div className="w-3 h-3 rounded-full bg-green-500 -ml-[7px]" />
                    <div>
                      <p className="font-medium">最早出货</p>
                      <p className="text-sm text-muted-foreground">{config.firstShipDate}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 说明 */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">配置说明</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>春节配置会影响发货计划总表的计算</li>
            <li>系统会在距离放假60天时开始显示倒计时提醒</li>
            <li>最后发货日期前需要完成所有春节前的发货</li>
            <li>复工后的发货计划会从最早出货日期开始计算</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

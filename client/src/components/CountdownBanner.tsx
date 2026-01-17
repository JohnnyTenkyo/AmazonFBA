import { Clock, Calendar, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useLocalAuth } from '@/contexts/AuthContext';

export default function CountdownBanner() {
  const { brandName } = useLocalAuth();
  
  const { data: springConfig } = trpc.springFestival.get.useQuery(
    { brandName, year: new Date().getFullYear() },
    { enabled: !!brandName }
  );

  const { data: promotions } = trpc.promotion.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  // 计算春节倒计时（使用春节开始日期）
  const springCountdown = springConfig?.holidayStartDate 
    ? Math.ceil((new Date(springConfig.holidayStartDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // 计算促销倒计时
  const promotionCountdowns = promotions
    ?.filter(p => {
      const startDate = p.thisYearStartDate ? new Date(p.thisYearStartDate).getTime() : null;
      const now = Date.now();
      return startDate && startDate > now;
    })
    .map(p => ({
      name: p.name,
      days: Math.ceil((new Date(p.thisYearStartDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }))
    .filter(p => p.days > 0 && p.days <= 60) || [];

  // 如果没有任何倒计时，不显示Banner
  if (!springCountdown && promotionCountdowns.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-4 text-white mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-5 h-5" />
        <span className="font-semibold">重要提醒</span>
      </div>
      <div className="flex flex-wrap gap-4">
        {springCountdown && springCountdown > 0 && (
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
  );
}
